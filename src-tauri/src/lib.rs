pub mod database;
pub mod parser;

#[cfg(feature = "desktop")]
mod desktop {
    use crate::{database, parser};
    use rusqlite::Connection;
    use std::sync::Mutex;
    use tauri::{Emitter, Manager, State};

    // As duas janelas compartilham uma conexão. O Mutex impede que escrevam
    // ao mesmo tempo; cada comando libera o bloqueio quando termina.
    struct Database(Mutex<Connection>);

    fn with_db<T>(
        db: State<Database>,
        operation: impl FnOnce(&mut Connection) -> Result<T, String>,
    ) -> Result<T, String> {
        let mut conn =
            db.0.lock()
                .map_err(|_| "O banco está indisponível. Reinicie o aplicativo.".to_string())?;
        operation(&mut conn)
    }

    #[tauri::command]
    fn preview_deck(text: String) -> Result<parser::ParsedDeck, String> {
        parser::parse_export(&text)
    }

    #[tauri::command]
    fn list_decks(db: State<Database>) -> Result<Vec<database::DeckVersion>, String> {
        with_db(db, |conn| database::list_decks(conn))
    }

    #[tauri::command]
    fn save_deck(
        app: tauri::AppHandle,
        db: State<Database>,
        name: String,
        existing_id: Option<String>,
        text: String,
    ) -> Result<String, String> {
        let id = with_db(db, |conn| {
            database::save_deck(conn, &name, existing_id.as_deref(), &text)
        })?;
        // A gravação já ocorreu. Uma falha na notificação não deve causar uma
        // nova tentativa de gravação e duplicar dados; foco também atualiza a tela.
        let _ = app.emit("data-changed", ());
        Ok(id)
    }

    #[tauri::command]
    fn list_opponents(db: State<Database>) -> Result<Vec<String>, String> {
        with_db(db, |conn| database::list_opponents(conn))
    }

    #[tauri::command]
    fn list_matches(db: State<Database>) -> Result<Vec<database::MatchRecord>, String> {
        with_db(db, |conn| database::list_matches(conn))
    }

    #[tauri::command]
    fn record_match(
        app: tauri::AppHandle,
        db: State<Database>,
        input: database::MatchInput,
    ) -> Result<(), String> {
        with_db(db, |conn| database::record_match(conn, input))?;
        let _ = app.emit("data-changed", ());
        Ok(())
    }

    #[tauri::command]
    fn delete_match(app: tauri::AppHandle, db: State<Database>, id: String) -> Result<(), String> {
        with_db(db, |conn| database::delete_match(conn, &id))?;
        let _ = app.emit("data-changed", ());
        Ok(())
    }

    #[tauri::command]
    fn open_overlay(app: tauri::AppHandle) -> Result<(), String> {
        let window = app
            .get_webview_window("overlay")
            .ok_or("Overlay não encontrado.")?;
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())
    }

    pub fn run() {
        tauri::Builder::default()
            .setup(|app| {
                let directory = app.path().app_data_dir()?;
                std::fs::create_dir_all(&directory)?;
                let mut connection = Connection::open(directory.join("journal.db"))?;
                database::migrate(&mut connection).map_err(std::io::Error::other)?;
                app.manage(Database(Mutex::new(connection)));
                Ok(())
            })
            .on_window_event(|window, event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    if window.label() == "main" {
                        // A janela oculta do overlay não deve deixar o processo
                        // aberto depois que o usuário fecha a janela principal.
                        window.app_handle().exit(0);
                    } else if window.label() == "overlay" {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                }
            })
            .invoke_handler(tauri::generate_handler![
                preview_deck,
                list_decks,
                save_deck,
                list_matches,
                list_opponents,
                record_match,
                delete_match,
                open_overlay
            ])
            .run(tauri::generate_context!())
            .expect("Não foi possível iniciar o PTCG Journal");
    }
}

#[cfg(feature = "desktop")]
pub use desktop::run;
