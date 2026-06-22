pub mod decrypt;
pub mod encrypt;
pub mod history;
pub mod keyfile;
pub mod settings;
pub mod platform;

#[derive(Debug, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProgressPayload {
    pub job_id: String,
    pub bytes_done: u64,
    pub bytes_total: u64,
    pub throughput_mbs: f64,
    pub eta_ms: u64,
}
