use tauri::State;
use crate::{settings::Settings, state::AppState};

#[tauri::command]
pub fn load_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    let guard = state.settings.read().map_err(|_| "settings lock poisoned")?;
    Ok(guard.clone())
}

#[tauri::command]
pub fn save_settings(state: State<'_, AppState>, settings: Settings) -> Result<(), String> {
    let mut guard = state.settings.write().map_err(|_| "settings lock poisoned")?;
    *guard = settings.clone();


    if let Ok(db_guard) = state.db.lock() {
        if let Some(conn) = db_guard.as_ref() {
            let json = serde_json::to_string(&settings).unwrap_or_default();
            let _ = conn.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES ('settings_v1', ?1)",
                rusqlite::params![json],
            );
        }
    }
    Ok(())
}
