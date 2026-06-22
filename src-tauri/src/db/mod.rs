use rusqlite::{Connection, Result};
use std::path::Path;

const SCHEMA: &str = include_str!("schema.sql");

const MIGRATIONS: &[&str] = &[SCHEMA];

pub fn open(path: &Path) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    run_migrations(&conn)?;
    restrict_permissions(path);
    Ok(conn)
}

fn run_migrations(conn: &Connection) -> Result<()> {
    let mut ver: i32 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    while (ver as usize) < MIGRATIONS.len() {
        let sql = MIGRATIONS[ver as usize];
        conn.execute_batch(sql)?;
        ver += 1;
        conn.execute_batch(&format!("PRAGMA user_version = {};", ver))?;
    }
    Ok(())
}

#[cfg(unix)]
fn restrict_permissions(path: &Path) {
    use std::fs::{set_permissions, Permissions};
    use std::os::unix::fs::PermissionsExt;
    let _ = set_permissions(path, Permissions::from_mode(0o600));
}

#[cfg(not(unix))]
fn restrict_permissions(_path: &Path) {}
