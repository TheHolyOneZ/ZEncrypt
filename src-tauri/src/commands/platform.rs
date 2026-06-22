#[cfg(target_os = "linux")]
pub fn supports_transparent_windows() -> bool {
    if std::env::var("WAYLAND_DISPLAY").is_ok()
        || std::env::var("XDG_SESSION_TYPE").ok().as_deref() == Some("wayland")
    {
        return true;
    }
    if std::env::var("ZENCRYPT_FORCE_TRANSPARENT").ok().as_deref() == Some("1") {
        return true;
    }
    if let Ok(desktop) = std::env::var("XDG_CURRENT_DESKTOP") {
        let d = desktop.to_ascii_lowercase();
        if d.contains("gnome") || d.contains("kde") || d.contains("plasma")
            || d.contains("unity") || d.contains("pantheon") || d.contains("budgie")
            || d.contains("cinnamon") || d.contains("deepin")
        {
            return true;
        }
    }
    false
}

#[cfg(not(target_os = "linux"))]
pub fn supports_transparent_windows() -> bool {
    true
}
