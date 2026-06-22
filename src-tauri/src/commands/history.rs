use tauri::State;
use crate::state::AppState;

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationRow {
    pub id: i64,
    pub kind: String,
    pub input_paths: String,
    pub output_path: String,
    pub file_count: i64,
    pub total_bytes: i64,
    pub status: String,
    pub started_at: i64,
    pub ended_at: i64,
}

#[tauri::command]
pub fn list_recent(state: State<'_, AppState>, limit: i64) -> Result<Vec<OperationRow>, String> {
    let guard = state.db.lock().map_err(|_| "db lock poisoned")?;
    let Some(conn) = guard.as_ref() else {
        return Ok(vec![]);
    };

    let mut stmt = conn
        .prepare(
            "SELECT id, kind, input_paths, output_path, file_count, total_bytes, status, started_at, ended_at
             FROM operations ORDER BY started_at DESC LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![limit], |r| {
            Ok(OperationRow {
                id: r.get(0)?,
                kind: r.get(1)?,
                input_paths: r.get(2)?,
                output_path: r.get(3)?,
                file_count: r.get(4)?,
                total_bytes: r.get(5)?,
                status: r.get(6)?,
                started_at: r.get(7)?,
                ended_at: r.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .flatten()
        .collect();

    Ok(rows)
}

#[tauri::command]
pub fn clear_history(state: State<'_, AppState>) -> Result<(), String> {
    let guard = state.db.lock().map_err(|_| "db lock poisoned")?;
    if let Some(conn) = guard.as_ref() {
        conn.execute("DELETE FROM operations", []).map_err(|e| e.to_string())?;
    }
    Ok(())
}
