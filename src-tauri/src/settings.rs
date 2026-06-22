use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub default_cipher: String,
    pub default_kdf_preset: String,
    pub default_compression: bool,
    pub default_secure_delete: String,
    pub default_chunk_size: u32,
    pub auto_open_output_folder: bool,
    pub confirm_overwrite: String,
    pub show_ssd_warning: bool,
    pub remember_last_keyfile_path: bool,
    pub last_keyfile_path: String,
    pub clear_history_on_exit: bool,
    pub compact_mode: bool,
    #[serde(default = "default_clipboard_clear_seconds")]
    pub clipboard_clear_seconds: u32,
    #[serde(default)]
    pub randomize_output_filename: bool,
}

fn default_clipboard_clear_seconds() -> u32 { 30 }

impl Default for Settings {
    fn default() -> Self {
        Self {
            default_cipher: "chacha20".into(),
            default_kdf_preset: "interactive".into(),
            default_compression: true,
            default_secure_delete: "off".into(),
            default_chunk_size: 262144,
            auto_open_output_folder: false,
            confirm_overwrite: "always".into(),
            show_ssd_warning: true,
            remember_last_keyfile_path: false,
            last_keyfile_path: String::new(),
            clear_history_on_exit: false,
            compact_mode: false,
            clipboard_clear_seconds: 30,
            randomize_output_filename: false,
        }
    }
}
