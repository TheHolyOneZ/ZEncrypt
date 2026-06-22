use std::path::PathBuf;
use tauri::{AppHandle, Emitter, State};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::{
    compress::{self, should_skip_compression_for_roots},
    crypto::{
        aead::Cipher,
        kdf::{KdfParams, KdfPreset, derive_key},
        pubkey::{read_pubkey_file, wrap_for_recipient},
        Key,
    },
    format::{
        header::{Flags, ZencHeader},
    },
    crypto::stream::ChunkEncoder,
    packing,
    secure_delete::{DeleteMode, secure_delete},
    state::AppState,
};

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EncryptRequest {
    pub input_paths: Vec<String>,
    pub output_path: String,
    pub password: Option<String>,
    pub keyfile_path: Option<String>,
    pub recipient_pubkey_path: Option<String>,
    pub cipher: String,
    pub kdf_preset: String,
    pub chunk_size: u32,
    pub compress: bool,
    pub secure_delete_mode: Option<String>,
}

use super::ProgressPayload;

#[tauri::command]
pub async fn start_encrypt_job(
    app: AppHandle,
    state: State<'_, AppState>,
    req: EncryptRequest,
) -> Result<String, String> {
    let job_id = Uuid::new_v4();
    let job_id_str = job_id.to_string();
    let token = CancellationToken::new();

    state.jobs.insert(job_id, token.clone());

    let app_h = app.clone();
    let jobs = state.jobs.clone();
    let db = state.db.clone();
    let job_id_str_inner = job_id_str.clone();

    tokio::spawn(async move {
        let result = run_encrypt_job(app_h.clone(), token.clone(), &req, &job_id_str_inner).await;
        jobs.remove(&job_id);

        match result {
            Ok(total_bytes) => {
                let _ = app_h.emit("job:done", &job_id_str_inner);
                let _ = record_operation(&db, "encrypt", &req.input_paths, &req.output_path, "success", total_bytes);
            }
            Err(e) if e == "cancelled" => {
                let _ = app_h.emit("job:cancelled", &job_id_str_inner);
            }
            Err(e) => {
                let _ = app_h.emit("job:failed", serde_json::json!({ "jobId": job_id_str_inner, "message": e }));
                let _ = record_operation(&db, "encrypt", &req.input_paths, &req.output_path, "failed", 0);
            }
        }
    });

    Ok(job_id_str)
}

async fn run_encrypt_job(
    app: AppHandle,
    token: CancellationToken,
    req: &EncryptRequest,
    job_id: &str,
) -> Result<u64, String> {

    let cipher = match req.cipher.as_str() {
        "chacha20" => Cipher::ChaCha20Poly1305,
        "aes256gcm" => Cipher::Aes256Gcm,
        other => return Err(format!("unknown cipher: {other}")),
    };


    let kdf_preset = match req.kdf_preset.as_str() {
        "interactive" => KdfPreset::Interactive,
        "moderate" => KdfPreset::Moderate,
        "paranoid" => KdfPreset::Paranoid,
        other => return Err(format!("unknown KDF preset: {other}")),
    };


    let recipient_pk_path = req.recipient_pubkey_path.as_deref().filter(|p| !p.is_empty());
    let is_pubkey_mode = recipient_pk_path.is_some();


    let password = req.password.as_deref().filter(|p| !p.is_empty()).map(|p| p.as_bytes().to_vec());
    let keyfile_hash: Option<[u8; 32]> = if let Some(kf_path) = &req.keyfile_path {
        if kf_path.is_empty() {
            None
        } else {
            let kf_bytes = tokio::fs::read(kf_path).await.map_err(|e| format!("keyfile read error: {e}"))?;
            Some(*blake3::hash(&kf_bytes).as_bytes())
        }
    } else {
        None
    };

    if is_pubkey_mode {
        if password.is_some() || keyfile_hash.is_some() {
            return Err("public-key mode cannot be combined with a password or keyfile".into());
        }
    } else if password.is_none() && keyfile_hash.is_none() {
        return Err("provide a password and/or a keyfile".into());
    }


    let kdf_params = KdfParams::from_preset(kdf_preset);


    let roots: Vec<PathBuf> = req.input_paths.iter().map(PathBuf::from).collect();
    let do_compress = req.compress && !should_skip_compression_for_roots(&roots);

    let mut flags = Flags::empty();
    if keyfile_hash.is_some() {
        flags |= Flags::HAS_KEYFILE;
    }
    if do_compress {
        flags |= Flags::IS_COMPRESSED;
    }
    if is_pubkey_mode {
        flags |= Flags::IS_PUBKEY;
    }

    let mut base_nonce = [0u8; 12];
    rand::RngCore::fill_bytes(&mut rand::thread_rng(), &mut base_nonce);

    let keyfile_fp = keyfile_hash.map(|h| [h[0], h[1], h[2], h[3]]);


    let (pubkey_block, pubkey_file_key): (Option<Vec<u8>>, Option<Key>) = if let Some(pk_path) = recipient_pk_path {
        let pk_bytes = tokio::fs::read(pk_path).await.map_err(|e| format!("recipient key read error: {e}"))?;
        let recipient_pk = read_pubkey_file(&pk_bytes)?;
        let (k, block) = wrap_for_recipient(&recipient_pk)?;
        (Some(block), Some(k))
    } else {
        (None, None)
    };

    let header = ZencHeader {
        cipher,
        flags,
        kdf: kdf_params.clone(),
        base_nonce,
        keyfile_fp,
        pubkey_block,
    };
    let aad = header.to_aad_bytes();


    if token.is_cancelled() {
        return Err("cancelled".into());
    }

    let key = if let Some(k) = pubkey_file_key {
        k
    } else {
        tokio::task::spawn_blocking({
            let pw = password.clone();
            let kf = keyfile_hash;
            let params = kdf_params.clone();
            move || derive_key(pw.as_deref(), kf.as_ref(), &params)
        })
        .await
        .map_err(|e| e.to_string())??
    };

    if token.is_cancelled() {
        return Err("cancelled".into());
    }


    let out_path = PathBuf::from(&req.output_path);
    let temp_path = out_path.with_extension("zsec.partial");

    let chunk_size = req.chunk_size as usize;


    let result = tokio::task::spawn_blocking({
        let roots = roots.clone();
        let temp_path = temp_path.clone();
        let out_path = out_path.clone();
        let token = token.clone();
        let job_id = job_id.to_string();
        let app = app.clone();

        move || -> Result<u64, String> {

            let mut tar_buf = Vec::new();
            packing::pack_inputs(&roots, &mut tar_buf).map_err(|e| e.to_string())?;

            if token.is_cancelled() {
                return Err("cancelled".into());
            }

            let plaintext: Vec<u8> = if do_compress {
                compress::compress(&tar_buf)?
            } else {
                tar_buf
            };

            if token.is_cancelled() {
                return Err("cancelled".into());
            }

            let total_bytes = plaintext.len() as u64;
            let start_time = std::time::Instant::now();


            let mut f = std::fs::File::create(&temp_path).map_err(|e| e.to_string())?;
            header.write_to(&mut f).map_err(|e| e.to_string())?;

            let mut encoder = ChunkEncoder::new(
                cipher,
                key,
                base_nonce,
                aad,
                &mut f,
                chunk_size,
            );


            let report_every = (chunk_size * 16).max(1);
            let mut bytes_done: u64 = 0;
            let mut pos = 0;

            while pos < plaintext.len() {
                if token.is_cancelled() {
                    drop(encoder);
                    drop(f);
                    let _ = std::fs::remove_file(&temp_path);
                    return Err("cancelled".into());
                }

                let take = report_every.min(plaintext.len() - pos);
                encoder.write_all(&plaintext[pos..pos + take])?;
                pos += take;
                bytes_done += take as u64;

                let elapsed = start_time.elapsed().as_secs_f64();
                let throughput = if elapsed > 0.0 { bytes_done as f64 / elapsed / 1_048_576.0 } else { 0.0 };
                let eta_ms = if throughput > 0.0 {
                    let remaining = (total_bytes - bytes_done) as f64 / (throughput * 1_048_576.0) * 1000.0;
                    remaining as u64
                } else {
                    0
                };

                let _ = app.emit("job:progress", ProgressPayload {
                    job_id: job_id.clone(),
                    bytes_done,
                    bytes_total: total_bytes,
                    throughput_mbs: (throughput * 100.0).round() / 100.0,
                    eta_ms,
                });
            }

            encoder.finish()?;


            f.sync_all().map_err(|e| e.to_string())?;
            drop(f);
            std::fs::rename(&temp_path, &out_path).map_err(|e| e.to_string())?;

            Ok(total_bytes)
        }
    })
    .await
    .map_err(|e| e.to_string())?;

    let total_bytes = match result {
        Err(e) => {
            let _ = std::fs::remove_file(&temp_path);
            return Err(e);
        }
        Ok(n) => n,
    };


    if let Some(mode_str) = &req.secure_delete_mode {
        let mode = match mode_str.as_str() {
            "1pass" => Some(DeleteMode::OnePass),
            "3pass" => Some(DeleteMode::ThreePass),
            "7pass" => Some(DeleteMode::SevenPass),
            _ => None,
        };
        if let Some(mode) = mode {
            let mut failures: Vec<String> = Vec::new();
            for root in &roots {
                if let Err(e) = secure_delete(root, mode) {
                    tracing::warn!("secure delete failed for {:?}: {e}", root);
                    failures.push(format!("{}: {}", root.display(), e));
                }
            }
            if !failures.is_empty() {
                let _ = app.emit(
                    "job:warning",
                    serde_json::json!({
                        "id": job_id,
                        "kind": "secure_delete",
                        "message": format!("Originals could not be removed:\n{}", failures.join("\n")),
                    }),
                );
            }
        }
    }

    Ok(total_bytes)
}

#[tauri::command]
pub async fn cancel_job(state: State<'_, AppState>, job_id: String) -> Result<(), String> {
    let uuid = Uuid::parse_str(&job_id).map_err(|e| e.to_string())?;
    if let Some(token) = state.jobs.get(&uuid) {
        token.cancel();
    }
    Ok(())
}

fn record_operation(
    db: &std::sync::Arc<std::sync::Mutex<Option<rusqlite::Connection>>>,
    kind: &str,
    input_paths: &[String],
    output_path: &str,
    status: &str,
    total_bytes: u64,
) -> Result<(), String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    let input_json = serde_json::to_string(input_paths).unwrap_or_default();
    let file_count = input_paths.len() as i64;

    if let Ok(guard) = db.lock() {
        if let Some(conn) = guard.as_ref() {
            let _ = conn.execute(
                "INSERT INTO operations (kind, input_paths, output_path, file_count, total_bytes, status, started_at, ended_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
                rusqlite::params![kind, input_json, output_path, file_count, total_bytes as i64, status, now],
            );
        }
    }
    Ok(())
}
