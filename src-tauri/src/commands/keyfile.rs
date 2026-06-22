use rand::RngCore;

use crate::crypto::pubkey;

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyfileInfo {
    pub path: String,
    pub fingerprint: String,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeypairInfo {
    pub public_path: String,
    pub private_path: String,
    pub fingerprint: String,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PubkeyInfo {
    pub path: String,
    pub fingerprint: String,
}


#[tauri::command]
pub async fn generate_keyfile(path: String) -> Result<KeyfileInfo, String> {
    let mut bytes = vec![0u8; 512];
    rand::thread_rng().fill_bytes(&mut bytes);

    tokio::fs::write(&path, &bytes)
        .await
        .map_err(|e| format!("write keyfile failed: {e}"))?;

    let fingerprint = format!("{}", blake3::hash(&bytes));
    Ok(KeyfileInfo { path, fingerprint })
}


#[tauri::command]
pub async fn fingerprint_keyfile(path: String) -> Result<String, String> {
    let bytes = tokio::fs::read(&path)
        .await
        .map_err(|e| format!("read keyfile failed: {e}"))?;

    Ok(format!("{}", blake3::hash(&bytes)))
}


#[tauri::command]
pub async fn generate_keypair(base_path: String) -> Result<KeypairInfo, String> {
    let (sk, pk) = pubkey::generate_keypair();

    let pub_path = format!("{}.{}", base_path, pubkey::PUBKEY_EXT);
    let priv_path = format!("{}.{}", base_path, pubkey::PRIVKEY_EXT);

    let mut pub_buf = Vec::new();
    pubkey::write_pubkey_file(&pk, &mut pub_buf);
    let mut priv_buf = Vec::new();
    pubkey::write_privkey_file(&sk, &mut priv_buf);

    tokio::fs::write(&pub_path, &pub_buf).await.map_err(|e| format!("write public key failed: {e}"))?;
    tokio::fs::write(&priv_path, &priv_buf).await.map_err(|e| format!("write private key failed: {e}"))?;

    Ok(KeypairInfo {
        public_path: pub_path,
        private_path: priv_path,
        fingerprint: pubkey::fingerprint_hex(&pk),
    })
}


#[tauri::command]
pub async fn inspect_pubkey(path: String) -> Result<PubkeyInfo, String> {
    let bytes = tokio::fs::read(&path).await.map_err(|e| format!("read public key failed: {e}"))?;
    let pk = pubkey::read_pubkey_file(&bytes)?;
    Ok(PubkeyInfo { path, fingerprint: pubkey::fingerprint_hex(&pk) })
}
