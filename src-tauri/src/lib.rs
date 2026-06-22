mod commands;
mod compress;
mod crypto;
mod db;
mod format;
mod packing;
mod secure_delete;
mod settings;
mod state;

use tauri::{Emitter, Manager};

fn setup_app(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {

    {
        use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
        use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

        let open_item = MenuItem::with_id(app, "open", "Open ZEncrypt", true, None::<&str>)?;
        let sep = PredefinedMenuItem::separator(app)?;
        let quit_item = MenuItem::with_id(app, "quit", "Quit ZEncrypt", true, None::<&str>)?;
        let menu = Menu::with_items(app, &[&open_item, &sep, &quit_item])?;

        let h1 = app.handle().clone();
        let h2 = app.handle().clone();

        const TRAY_ICON_PNG: &[u8] = include_bytes!("../icons/32x32.png");
        let tray_icon = tauri::image::Image::from_bytes(TRAY_ICON_PNG)
            .ok()
            .or_else(|| app.default_window_icon().cloned())
            .ok_or("no app icon")?;

        TrayIconBuilder::with_id("main-tray")
            .icon(tray_icon)
            .icon_as_template(false)
            .tooltip("ZEncrypt")
            .menu(&menu)
            .on_menu_event(move |_tray, event| match event.id.as_ref() {
                "open" => {
                    if let Some(w) = h1.get_webview_window("main") {
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
                "quit" => h1.exit(0),
                _ => {}
            })
            .on_tray_icon_event(move |_tray, event| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event
                {
                    if let Some(w) = h2.get_webview_window("main") {
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
            })
            .build(app)?;
    }


    if let Some(main) = app.get_webview_window("main") {
        let opaque = !commands::platform::supports_transparent_windows();
        let _ = main.eval(&format!(
            "document.documentElement.classList.toggle('ze-opaque', {opaque});"
        ));


        if let (Ok(pos), Ok(size)) = (main.outer_position(), main.outer_size()) {
            let monitors = main.available_monitors().unwrap_or_default();
            let cx = pos.x + (size.width as i32) / 2;
            let cy = pos.y + (size.height as i32) / 2;
            let on_screen = monitors.iter().any(|m| {
                let mp = m.position();
                let ms = m.size();
                cx >= mp.x && cx < mp.x + ms.width as i32 && cy >= mp.y && cy < mp.y + ms.height as i32
            });
            if !on_screen && !monitors.is_empty() {
                let _ = main.center();
            }
        }
    }


    #[cfg(debug_assertions)]
    {
        use tracing_subscriber::{fmt, EnvFilter};
        let _ = fmt()
            .with_env_filter(EnvFilter::from_default_env())
            .try_init();
    }


    {
        let db_arc = app.state::<state::AppState>().db.clone();
        let settings_arc = app.state::<state::AppState>().settings.clone();
        let data_dir = app.path().app_local_data_dir()
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;
        let app_handle = app.handle().clone();

        tauri::async_runtime::spawn(async move {
            let db_path = data_dir.join("zencrypt.db");
            match tokio::task::spawn_blocking(move || db::open(&db_path)).await {
                Ok(Ok(conn)) => {

                    if let Ok(saved) = conn.query_row(
                        "SELECT value FROM settings WHERE key = 'settings_v1'",
                        [],
                        |r| r.get::<_, String>(0),
                    ) {
                        if let Ok(s) = serde_json::from_str::<settings::Settings>(&saved) {
                            if let Ok(mut g) = settings_arc.write() {
                                *g = s;
                            }
                        }
                    }

                    if let Ok(mut g) = db_arc.lock() {
                        *g = Some(conn);
                    }

                    let _ = app_handle.emit("db:ready", ());
                    tracing::info!("ZEncrypt database initialized");
                }
                Ok(Err(e)) => tracing::error!("DB open failed: {e}"),
                Err(e) => tracing::error!("DB spawn failed: {e}"),
            }
        });
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = state::AppState::new();

    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
                let _ = w.request_user_attention(Some(tauri::UserAttentionType::Informational));
            }

            if args.len() > 1 {
                let path = &args[1];
                if path.ends_with(".zsec") && std::path::Path::new(path).is_file() {
                    let _ = app.emit("open-file", path);
                }
            }
        }))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            setup_app(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::encrypt::start_encrypt_job,
            commands::encrypt::cancel_job,
            commands::decrypt::start_decrypt_job,
            commands::decrypt::preview_header,
            commands::decrypt::verify_integrity,
            commands::keyfile::generate_keyfile,
            commands::keyfile::fingerprint_keyfile,
            commands::keyfile::generate_keypair,
            commands::keyfile::inspect_pubkey,
            commands::history::list_recent,
            commands::history::clear_history,
            commands::settings::load_settings,
            commands::settings::save_settings,
        ])
        .build(tauri::generate_context!())
        .expect("error while building ZEncrypt")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                let state = app_handle.state::<state::AppState>();
                let clear = state
                    .settings
                    .read()
                    .map(|g| g.clear_history_on_exit)
                    .unwrap_or(false);
                if clear {
                    if let Ok(guard) = state.db.lock() {
                        if let Some(conn) = guard.as_ref() {
                            let _ = conn.execute("DELETE FROM operations", []);
                        }
                    }
                }
            }
        });
}
