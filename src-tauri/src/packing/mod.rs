use std::io::{Read, Write};
use std::path::{Path, PathBuf};

#[derive(Debug, serde::Serialize)]
pub struct UnpackStats {
    pub files: u64,
    pub total_bytes: u64,
}


pub fn pack_inputs<W: Write>(roots: &[PathBuf], out: W) -> std::io::Result<u64> {
    let mut builder = tar::Builder::new(out);
    builder.follow_symlinks(false);

    let mut total_bytes: u64 = 0;

    for root in roots {
        let canon = root.canonicalize()?;
        if canon.is_file() {
            let file_name = canon
                .file_name()
                .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidInput, "no filename"))?
                .to_string_lossy()
                .into_owned();
            let meta = std::fs::metadata(&canon)?;
            total_bytes += meta.len();
            builder.append_path_with_name(&canon, &file_name)?;
        } else if canon.is_dir() {
            let base_name = canon
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| "archive".to_string());
            for entry in walkdir(&canon, &canon)? {
                let rel = entry
                    .strip_prefix(&canon)
                    .map_err(|_| std::io::Error::new(std::io::ErrorKind::Other, "strip prefix failed"))?;
                let archive_path = PathBuf::from(&base_name).join(rel);
                let meta = std::fs::metadata(&entry)?;
                if meta.is_file() {
                    total_bytes += meta.len();
                    builder.append_path_with_name(&entry, &archive_path)?;
                } else if meta.is_dir() {
                    builder.append_dir(&archive_path, &entry)?;
                }
            }
        }
    }

    builder.finish()?;
    Ok(total_bytes)
}


pub fn unpack_stream<R: Read>(r: R, out_dir: &Path) -> std::io::Result<UnpackStats> {
    let mut archive = tar::Archive::new(r);
    let mut files: u64 = 0;
    let mut total_bytes: u64 = 0;

    for entry in archive.entries()? {
        let mut entry = entry?;
        let entry_path = entry.path()?.into_owned();


        if entry_path.is_absolute() || entry_path.components().any(|c| c == std::path::Component::ParentDir) {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("dangerous path in archive: {}", entry_path.display()),
            ));
        }

        let out_path = out_dir.join(&entry_path);
        if entry.header().entry_type().is_dir() {
            std::fs::create_dir_all(&out_path)?;
        } else if entry.header().entry_type().is_file() {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let size = entry.header().size().unwrap_or(0);
            entry.unpack(&out_path)?;
            total_bytes += size;
            files += 1;
        }

    }

    Ok(UnpackStats { files, total_bytes })
}

fn walkdir(root: &Path, dir: &Path) -> std::io::Result<Vec<PathBuf>> {
    let mut entries = Vec::new();
    entries.push(dir.to_path_buf());
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let meta = std::fs::symlink_metadata(&path)?;
        if meta.is_symlink() {
            let target = std::fs::canonicalize(&path)?;

            if !target.starts_with(root) {
                tracing::warn!("skipping symlink that escapes root: {}", path.display());
                continue;
            }
        }
        if path.is_dir() {
            entries.extend(walkdir(root, &path)?);
        } else {
            entries.push(path);
        }
    }
    Ok(entries)
}
