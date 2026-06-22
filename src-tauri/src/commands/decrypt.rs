use std::io::Cursor;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, State};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::{
    compress,
    crypto::{kdf::derive_key, pubkey::{read_privkey_file, unwrap_with_private_key}, stream::ChunkDecoder, Key},
    format::header::{Flags, ZencHeader, ZencHeaderInfo},
    packing,
    state::AppState,
};

use super::ProgressPayload;

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecryptRequest {
    pub input_path: String,
    pub output_dir: String,
    pub password: Option<String>,
    pub keyfile_path: Option<String>,
    pub private_key_path: Option<String>,
}


#[tauri::command]
pub async fn preview_header(input_path: String) -> Result<ZencHeaderInfo, String> {
    let bytes = tokio::fs::read(&input_path)
        .await
        .map_err(|e| format!("read error: {e}"))?;

    let header = ZencHeader::read_from(&mut Cursor::new(&bytes)).map_err(|e| e.to_string())?;
    Ok(ZencHeaderInfo::from(&header))
}

#[tauri::command]
pub async fn start_decrypt_job(
    app: AppHandle,
    state: State<'_, AppState>,
    req: DecryptRequest,
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
        let result = run_decrypt_job(app_h.clone(), token.clone(), &req, &job_id_str_inner).await;
        jobs.remove(&job_id);

        match result {
            Ok(total_bytes) => {
                let _ = app_h.emit("job:done", &job_id_str_inner);
                let _ = record_decrypt_operation(&db, &req.input_path, &req.output_dir, "success", total_bytes);
            }
            Err(e) if e == "cancelled" => {
                let _ = app_h.emit("job:cancelled", &job_id_str_inner);
            }
            Err(e) => {
                let _ = app_h.emit("job:failed", serde_json::json!({ "jobId": job_id_str_inner, "message": e }));
                let _ = record_decrypt_operation(&db, &req.input_path, &req.output_dir, "failed", 0);
            }
        }
    });

    Ok(job_id_str)
}

async fn run_decrypt_job(
    app: AppHandle,
    token: CancellationToken,
    req: &DecryptRequest,
    job_id: &str,
) -> Result<u64, String> {
    let encrypted_bytes = tokio::fs::read(&req.input_path)
        .await
        .map_err(|e| format!("read error: {e}"))?;

    if token.is_cancelled() {
        return Err("cancelled".into());
    }

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
    let private_key_bytes: Option<Vec<u8>> = if let Some(pk_path) = &req.private_key_path {
        if pk_path.is_empty() {
            None
        } else {
            Some(tokio::fs::read(pk_path).await.map_err(|e| format!("private key read error: {e}"))?)
        }
    } else {
        None
    };

    let out_dir = PathBuf::from(&req.output_dir);
    tokio::fs::create_dir_all(&out_dir).await.map_err(|e| e.to_string())?;

    let total_encrypted = encrypted_bytes.len() as u64;
    let app_clone = app.clone();
    let job_id_str = job_id.to_string();

    let result = tokio::task::spawn_blocking({
        let encrypted_bytes = encrypted_bytes.clone();
        let out_dir = out_dir.clone();
        let token = token.clone();

        move || -> Result<u64, String> {
            let mut cursor = Cursor::new(encrypted_bytes.as_slice());
            let header = ZencHeader::read_from(&mut cursor).map_err(|e| e.to_string())?;
            let header_size = cursor.position();
            let payload_total = total_encrypted.saturating_sub(header_size);
            let aad = header.to_aad_bytes();

            let key: Key = if header.flags.contains(Flags::IS_PUBKEY) {
                let pk_bytes = private_key_bytes
                    .as_deref()
                    .ok_or_else(|| "this archive needs a private key file".to_string())?;
                let sk = read_privkey_file(pk_bytes)?;
                let block = header.pubkey_block.as_deref()
                    .ok_or_else(|| "pubkey archive missing key block".to_string())?;
                unwrap_with_private_key(block, &sk)?
            } else {
                derive_key(password.as_deref(), keyfile_hash.as_ref(), &header.kdf)?
            };

            if token.is_cancelled() {
                return Err("cancelled".into());
            }

            let mut dec = ChunkDecoder::new(
                header.cipher,
                key,
                header.base_nonce,
                aad,
                &mut cursor,
            );

            let mut plaintext = Vec::new();
            let start_time = std::time::Instant::now();

            while let Some(chunk) = dec.next_chunk()? {
                if token.is_cancelled() {
                    return Err("cancelled".into());
                }
                plaintext.extend_from_slice(&chunk);

                let bytes_done = dec.bytes_consumed();
                let elapsed = start_time.elapsed().as_secs_f64();
                let throughput_mbs = if elapsed > 0.01 {
                    (bytes_done as f64 / elapsed / 1_048_576.0 * 100.0).round() / 100.0
                } else {
                    0.0
                };
                let eta_ms = if throughput_mbs > 0.0 && payload_total > bytes_done {
                    ((payload_total - bytes_done) as f64 / (throughput_mbs * 1_048_576.0) * 1000.0) as u64
                } else {
                    0
                };

                let _ = app_clone.emit("job:progress", ProgressPayload {
                    job_id: job_id_str.clone(),
                    bytes_done,
                    bytes_total: payload_total,
                    throughput_mbs,
                    eta_ms,
                });
            }

            let total_plaintext = plaintext.len() as u64;


            let tar_bytes = if header.flags.contains(crate::format::header::Flags::IS_COMPRESSED) {
                compress::decompress(&plaintext)?
            } else {
                plaintext
            };


            packing::unpack_stream(Cursor::new(tar_bytes), &out_dir).map_err(|e| e.to_string())?;

            Ok(total_plaintext)
        }
    })
    .await
    .map_err(|e| e.to_string())?;

    result
}


#[tauri::command]
pub async fn verify_integrity(
    app: AppHandle,
    input_path: String,
    password: Option<String>,
    keyfile_path: Option<String>,
    private_key_path: Option<String>,
) -> Result<bool, String> {
    let encrypted_bytes = tokio::fs::read(&input_path)
        .await
        .map_err(|e| format!("read error: {e}"))?;

    let password = password.filter(|p| !p.is_empty()).map(|p| p.into_bytes());
    let keyfile_hash: Option<[u8; 32]> = if let Some(kf_path) = keyfile_path {
        if kf_path.is_empty() {
            None
        } else {
            let kf_bytes = tokio::fs::read(&kf_path).await.map_err(|e| format!("keyfile read: {e}"))?;
            Some(*blake3::hash(&kf_bytes).as_bytes())
        }
    } else {
        None
    };
    let private_key_bytes: Option<Vec<u8>> = if let Some(pk_path) = private_key_path {
        if pk_path.is_empty() {
            None
        } else {
            Some(tokio::fs::read(&pk_path).await.map_err(|e| format!("private key read: {e}"))?)
        }
    } else {
        None
    };

    let total_encrypted = encrypted_bytes.len() as u64;
    let app_clone = app.clone();
    let path_tag = input_path.clone();

    tokio::task::spawn_blocking(move || {
        let mut cursor = Cursor::new(&encrypted_bytes);
        let header = ZencHeader::read_from(&mut cursor).map_err(|e| e.to_string())?;
        let header_size = cursor.position();
        let payload_total = total_encrypted.saturating_sub(header_size);
        let aad = header.to_aad_bytes();
        let key: Key = if header.flags.contains(Flags::IS_PUBKEY) {
            let pk_bytes = private_key_bytes
                .as_deref()
                .ok_or_else(|| "this archive needs a private key file".to_string())?;
            let sk = read_privkey_file(pk_bytes)?;
            let block = header.pubkey_block.as_deref()
                .ok_or_else(|| "pubkey archive missing key block".to_string())?;
            unwrap_with_private_key(block, &sk)?
        } else {
            derive_key(password.as_deref(), keyfile_hash.as_ref(), &header.kdf)?
        };

        let mut dec = ChunkDecoder::new(header.cipher, key, header.base_nonce, aad, &mut cursor);
        let mut last_emit = std::time::Instant::now();
        while dec.next_chunk()?.is_some() {

            if last_emit.elapsed().as_millis() >= 100 {
                let _ = app_clone.emit("verify:progress", serde_json::json!({
                    "inputPath": &path_tag,
                    "bytesDone": dec.bytes_consumed(),
                    "bytesTotal": payload_total,
                }));
                last_emit = std::time::Instant::now();
            }
        }

        let _ = app_clone.emit("verify:progress", serde_json::json!({
            "inputPath": &path_tag,
            "bytesDone": payload_total,
            "bytesTotal": payload_total,
        }));

        Ok::<bool, String>(true)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn record_decrypt_operation(
    db: &std::sync::Arc<std::sync::Mutex<Option<rusqlite::Connection>>>,
    input_path: &str,
    output_dir: &str,
    status: &str,
    total_bytes: u64,
) -> Result<(), String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    let input_json = serde_json::to_string(&[input_path]).unwrap_or_default();

    if let Ok(guard) = db.lock() {
        if let Some(conn) = guard.as_ref() {
            let _ = conn.execute(
                "INSERT INTO operations (kind, input_paths, output_path, file_count, total_bytes, status, started_at, ended_at)
                 VALUES ('decrypt', ?1, ?2, 1, ?3, ?4, ?5, ?5)",
                rusqlite::params![input_json, output_dir, total_bytes as i64, status, now],
            );
        }
    }
    Ok(())
}
