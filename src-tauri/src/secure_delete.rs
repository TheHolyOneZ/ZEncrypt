use std::fs::OpenOptions;
use std::io::Write;
use std::path::Path;
use rand::RngCore;

#[derive(Debug, Clone, Copy, serde::Deserialize, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DeleteMode {
    #[serde(rename = "1pass")]
    OnePass,
    #[serde(rename = "3pass")]
    ThreePass,
    #[serde(rename = "7pass")]
    SevenPass,
}


pub fn secure_delete(path: &Path, mode: DeleteMode) -> Result<(), String> {
    let meta = std::fs::symlink_metadata(path)
        .map_err(|e| format!("failed to stat {:?}: {e}", path))?;

    if meta.file_type().is_symlink() {
        std::fs::remove_file(path).map_err(|e| format!("remove symlink failed: {e}"))?;
        return Ok(());
    }

    if meta.is_dir() {
        for entry in std::fs::read_dir(path).map_err(|e| format!("read_dir failed: {e}"))? {
            let entry = entry.map_err(|e| format!("read_dir entry failed: {e}"))?;
            secure_delete(&entry.path(), mode)?;
        }
        std::fs::remove_dir(path).map_err(|e| format!("remove_dir failed: {e}"))?;
        return Ok(());
    }

    let len = meta.len() as usize;

    match mode {
        DeleteMode::OnePass => {
            overwrite_pass(path, len, FillMode::Zeros)?;
        }
        DeleteMode::ThreePass => {
            overwrite_pass(path, len, FillMode::Zeros)?;
            overwrite_pass(path, len, FillMode::Ones)?;
            overwrite_pass(path, len, FillMode::Random)?;
        }
        DeleteMode::SevenPass => {

            overwrite_pass(path, len, FillMode::Zeros)?;
            overwrite_pass(path, len, FillMode::Ones)?;
            overwrite_pass(path, len, FillMode::Pattern(0x55))?;
            overwrite_pass(path, len, FillMode::Pattern(0xAA))?;
            overwrite_pass(path, len, FillMode::Random)?;
            overwrite_pass(path, len, FillMode::Random)?;
            overwrite_pass(path, len, FillMode::Random)?;
        }
    }

    std::fs::remove_file(path).map_err(|e| format!("remove failed: {e}"))?;
    Ok(())
}

enum FillMode {
    Zeros,
    Ones,
    Pattern(u8),
    Random,
}

fn overwrite_pass(path: &Path, len: usize, fill: FillMode) -> Result<(), String> {
    let mut f = OpenOptions::new()
        .write(true)
        .open(path)
        .map_err(|e| format!("open for overwrite failed: {e}"))?;

    let chunk = 65_536usize;
    let mut buf = vec![0u8; chunk.min(len.max(1))];
    let mut remaining = len;

    match fill {
        FillMode::Zeros => {}
        FillMode::Ones => buf.fill(0xFF),
        FillMode::Pattern(b) => buf.fill(b),
        FillMode::Random => {}
    }

    while remaining > 0 {
        let to_write = remaining.min(buf.len());
        if matches!(fill, FillMode::Random) {
            rand::thread_rng().fill_bytes(&mut buf[..to_write]);
        }
        f.write_all(&buf[..to_write]).map_err(|e| e.to_string())?;
        remaining -= to_write;
    }

    f.flush().map_err(|e| e.to_string())?;

    f.sync_all().map_err(|e| e.to_string())?;
    Ok(())
}


#[allow(dead_code)]
#[cfg(target_os = "linux")]
pub fn is_rotational(path: &Path) -> bool {
    fn rotational_for(path: &Path) -> Option<bool> {
        let canon = std::fs::canonicalize(path).ok()?;
        let mount = find_mount_point(&canon)?;
        let dev = std::fs::metadata(&mount).ok()?.dev();
        let major = (dev >> 8) & 0xFFF;
        let dev_name = device_name_from_major(major as u32)?;
        let rot_path = format!("/sys/block/{}/queue/rotational", dev_name);
        let val = std::fs::read_to_string(&rot_path).ok()?;
        Some(val.trim() == "1")
    }
    rotational_for(path).unwrap_or(false)
}

#[cfg(not(target_os = "linux"))]
pub fn is_rotational(_path: &Path) -> bool {
    false
}

#[cfg(target_os = "linux")]
#[allow(unused_imports)]
use std::os::unix::fs::MetadataExt;

#[cfg(target_os = "linux")]
fn find_mount_point(path: &Path) -> Option<std::path::PathBuf> {
    let mut p = path.to_path_buf();
    loop {
        if p.exists() {
            return Some(p);
        }
        if !p.pop() {
            return None;
        }
    }
}

#[cfg(target_os = "linux")]
fn device_name_from_major(_major: u32) -> Option<String> {


    let entries = std::fs::read_dir("/sys/block").ok()?;
    for entry in entries.flatten() {
        let dev_file = entry.path().join("dev");
        if let Ok(content) = std::fs::read_to_string(&dev_file) {
            if let Some(maj_str) = content.split(':').next() {
                if maj_str.trim().parse::<u32>().ok() == Some(_major) {
                    return Some(entry.file_name().to_string_lossy().into_owned());
                }
            }
        }
    }
    None
}
