use dashmap::DashMap;
use rusqlite::Connection;
use std::sync::{Arc, Mutex, RwLock};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::settings::Settings;

pub type JobId = Uuid;

pub struct AppState {
    pub db: Arc<Mutex<Option<Connection>>>,
    pub jobs: Arc<DashMap<JobId, CancellationToken>>,
    pub settings: Arc<RwLock<Settings>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            db: Arc::new(Mutex::new(None)),
            jobs: Arc::new(DashMap::new()),
            settings: Arc::new(RwLock::new(Settings::default())),
        }
    }
}
