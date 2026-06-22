use std::path::Path;

const INCOMPRESSIBLE_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "webp", "gif", "heic", "avif",
    "mp4", "mov", "mkv", "webm", "m4v", "avi",
    "mp3", "aac", "m4a", "ogg", "opus", "flac",
    "zip", "7z", "rar", "gz", "xz", "zst", "bz2", "lz4", "br",
    "pdf",
    "docx", "xlsx", "pptx", "odt", "ods", "odp", "epub", "apk", "jar",
];


pub fn should_skip_compression(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| INCOMPRESSIBLE_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}


pub fn should_skip_compression_for_roots(roots: &[std::path::PathBuf]) -> bool {
    if roots.is_empty() {
        return false;
    }
    let skip_count = roots.iter().filter(|p| should_skip_compression(p)).count();
    skip_count * 10 > roots.len() * 8
}


pub fn compress(data: &[u8]) -> Result<Vec<u8>, String> {
    zstd::encode_all(data, 3).map_err(|e| e.to_string())
}


pub fn decompress(data: &[u8]) -> Result<Vec<u8>, String> {
    zstd::decode_all(data).map_err(|e| e.to_string())
}

