use crate::parser::parse_export;
use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

type Result<T> = std::result::Result<T, String>;
fn db_error(error: rusqlite::Error) -> String {
    format!("Não foi possível acessar o banco local: {error}")
}

pub fn migrate(conn: &mut Connection) -> Result<()> {
    conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;")
        .map_err(db_error)?;
    let version: i64 = conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(db_error)?;
    if version > 1 {
        return Err("O banco foi criado por uma versão mais recente do aplicativo.".into());
    }
    if version == 0 {
        let tx = conn.transaction().map_err(db_error)?;
        tx.execute_batch(include_str!("../migrations/001_initial.sql"))
            .map_err(db_error)?;
        tx.commit().map_err(db_error)?;
    }
    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeckVersion {
    pub id: String,
    pub deck_id: String,
    pub name: String,
    pub version: i64,
    pub original_export: String,
}

pub fn list_decks(conn: &Connection) -> Result<Vec<DeckVersion>> {
    let mut stmt = conn.prepare("SELECT v.id, d.id, d.name, v.version, v.original_export FROM deck_versions v JOIN decks d ON d.id = v.deck_id ORDER BY d.created_at DESC, v.version DESC").map_err(db_error)?;
    let rows = stmt
        .query_map([], |r| {
            Ok(DeckVersion {
                id: r.get(0)?,
                deck_id: r.get(1)?,
                name: r.get(2)?,
                version: r.get(3)?,
                original_export: r.get(4)?,
            })
        })
        .map_err(db_error)?;
    rows.collect::<std::result::Result<Vec<_>, _>>()
        .map_err(db_error)
}

pub fn save_deck(
    conn: &mut Connection,
    name: &str,
    existing_id: Option<&str>,
    text: &str,
) -> Result<String> {
    let parsed = parse_export(text)?;
    let name = name.trim();
    if existing_id.is_none() && (name.is_empty() || name.chars().count() > 100) {
        return Err("Informe um nome de até 100 caracteres.".into());
    }
    let now = Utc::now().to_rfc3339();
    let version_id = Uuid::new_v4().to_string();
    // Uma transação salva o baralho, a versão e todas as cartas juntos.
    // Se qualquer etapa falhar, o SQLite desfaz a operação inteira.
    let tx = conn.transaction().map_err(db_error)?;
    let deck_id = if let Some(id) = existing_id {
        let changed = tx
            .execute(
                "UPDATE decks SET updated_at = ?1 WHERE id = ?2",
                params![now, id],
            )
            .map_err(db_error)?;
        if changed == 0 {
            return Err("Baralho não encontrado.".into());
        }
        id.to_string()
    } else {
        let id = Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO decks VALUES (?1, ?2, ?3, ?3)",
            params![id, name, now],
        )
        .map_err(db_error)?;
        id
    };
    let version: i64 = tx
        .query_row(
            "SELECT COALESCE(MAX(version), 0) + 1 FROM deck_versions WHERE deck_id = ?1",
            [&deck_id],
            |r| r.get(0),
        )
        .map_err(db_error)?;
    tx.execute(
        "INSERT INTO deck_versions VALUES (?1, ?2, ?3, ?4, ?5)",
        params![version_id, deck_id, version, text, now],
    )
    .map_err(db_error)?;
    for card in parsed.cards {
        tx.execute(
            "INSERT INTO deck_cards VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                version_id,
                card.category,
                card.name,
                card.set_code,
                card.collector_number,
                card.quantity
            ],
        )
        .map_err(db_error)?;
    }
    tx.commit().map_err(db_error)?;
    Ok(version_id)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchInput {
    pub deck_version_id: String,
    pub opponent: String,
    #[serde(default)]
    pub create_opponent: bool,
    pub result: String,
    pub went_first: Option<bool>,
    pub format: String,
    pub mode: String,
    pub notes: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchRecord {
    pub id: String,
    pub deck_version_id: String,
    pub deck_name: String,
    pub version: i64,
    pub opponent: Option<String>,
    pub result: String,
    pub went_first: Option<bool>,
    pub format: String,
    pub mode: String,
    pub notes: String,
    pub played_at: String,
}

pub fn list_opponents(conn: &Connection) -> Result<Vec<String>> {
    let mut stmt = conn
        .prepare("SELECT name FROM archetypes ORDER BY name COLLATE NOCASE")
        .map_err(db_error)?;
    let rows = stmt.query_map([], |row| row.get(0)).map_err(db_error)?;
    rows.collect::<std::result::Result<Vec<_>, _>>()
        .map_err(db_error)
}

fn normalize_opponent(name: &str) -> String {
    name.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

pub fn record_match(conn: &mut Connection, input: MatchInput) -> Result<()> {
    if !["win", "loss", "draw"].contains(&input.result.as_str())
        || !["standard", "expanded"].contains(&input.format.as_str())
        || !["ranked", "casual", "other"].contains(&input.mode.as_str())
    {
        return Err("Resultado, formato ou modalidade inválidos.".into());
    }
    let opponent = input
        .opponent
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    if opponent.chars().count() > 100 || input.notes.chars().count() > 2000 {
        return Err("Use até 100 caracteres no adversário e 2000 nas observações.".into());
    }
    let tx = conn.transaction().map_err(db_error)?;
    let opponent_id: Option<String> = if opponent.is_empty() {
        None
    } else {
        // A confirmação pertence ao cadastro de um nome novo. Escolher um nome
        // existente nunca cria outra instância, mesmo com espaços ou caixa diferentes.
        let existing = list_opponents(&tx)?
            .into_iter()
            .find(|name| normalize_opponent(name) == normalize_opponent(&opponent));
        let canonical = if let Some(name) = existing {
            name
        } else {
            if !input.create_opponent {
                return Err(
                    "Selecione um baralho adversário da lista ou confirme o cadastro de um novo."
                        .into(),
                );
            }
            tx.execute(
                "INSERT INTO archetypes (id, name) VALUES (?1, ?2)",
                params![Uuid::new_v4().to_string(), opponent],
            )
            .map_err(db_error)?;
            opponent
        };
        Some(
            tx.query_row(
                "SELECT id FROM archetypes WHERE name = ?1 COLLATE NOCASE",
                [canonical],
                |r| r.get(0),
            )
            .map_err(db_error)?,
        )
    };
    let now = Utc::now().to_rfc3339();
    tx.execute(
        "INSERT INTO matches VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9, ?9)",
        params![
            Uuid::new_v4().to_string(),
            input.deck_version_id,
            opponent_id,
            input.result,
            input.went_first,
            input.format,
            input.mode,
            input.notes.trim(),
            now
        ],
    )
    .map_err(db_error)?;
    tx.commit().map_err(db_error)
}

pub fn list_matches(conn: &Connection) -> Result<Vec<MatchRecord>> {
    let mut stmt = conn.prepare("SELECT m.id, m.deck_version_id, d.name, v.version, a.name, m.result, m.went_first, m.format, m.mode, m.notes, m.played_at FROM matches m JOIN deck_versions v ON v.id = m.deck_version_id JOIN decks d ON d.id = v.deck_id LEFT JOIN archetypes a ON a.id = m.opponent_archetype_id ORDER BY m.played_at DESC, m.id").map_err(db_error)?;
    let rows = stmt
        .query_map([], |r| {
            Ok(MatchRecord {
                id: r.get(0)?,
                deck_version_id: r.get(1)?,
                deck_name: r.get(2)?,
                version: r.get(3)?,
                opponent: r.get(4)?,
                result: r.get(5)?,
                went_first: r.get(6)?,
                format: r.get(7)?,
                mode: r.get(8)?,
                notes: r.get(9)?,
                played_at: r.get(10)?,
            })
        })
        .map_err(db_error)?;
    rows.collect::<std::result::Result<Vec<_>, _>>()
        .map_err(db_error)
}

pub fn delete_match(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM matches WHERE id = ?1", [id])
        .map_err(db_error)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    const EXAMPLE: &str = include_str!("../../fixtures/team-rocket.txt");
    fn input(id: String) -> MatchInput {
        MatchInput {
            deck_version_id: id,
            opponent: "Charizard ex".into(),
            create_opponent: true,
            result: "win".into(),
            went_first: Some(true),
            format: "standard".into(),
            mode: "ranked".into(),
            notes: "Teste".into(),
        }
    }

    #[test]
    fn versions_preserve_history_and_invalid_match_rolls_back() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();
        migrate(&mut conn).unwrap();
        let first = save_deck(&mut conn, "Rocket", None, EXAMPLE).unwrap();
        record_match(&mut conn, input(first.clone())).unwrap();
        let deck_id = list_decks(&conn).unwrap()[0].deck_id.clone();
        save_deck(&mut conn, "", Some(&deck_id), EXAMPLE).unwrap();
        assert_eq!(list_decks(&conn).unwrap()[0].version, 2);
        let matches = list_matches(&conn).unwrap();
        assert_eq!(matches[0].deck_version_id, first);
        assert_eq!(matches[0].version, 1);
        let mut invalid = input("missing".into());
        invalid.opponent = "Não deve persistir".into();
        assert!(record_match(&mut conn, invalid).is_err());
        let count: i64 = conn
            .query_row("SELECT count(*) FROM archetypes", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
        delete_match(&conn, &matches[0].id).unwrap();
        assert!(list_matches(&conn).unwrap().is_empty());
        assert!(save_deck(&mut conn, "inválido", None, "texto inválido").is_err());
        assert_eq!(list_decks(&conn).unwrap().len(), 2);
    }

    #[test]
    fn opponent_creation_requires_confirmation_and_reuses_existing_names() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();
        let deck = save_deck(&mut conn, "Rocket", None, EXAMPLE).unwrap();
        let mut first = input(deck.clone());
        first.opponent = "  Flabébé   ex  ".into();
        first.create_opponent = false;
        assert!(record_match(&mut conn, first).is_err());
        assert!(list_opponents(&conn).unwrap().is_empty());
        assert!(list_matches(&conn).unwrap().is_empty());

        let mut confirmed = input(deck.clone());
        confirmed.opponent = "  Flabébé   ex  ".into();
        record_match(&mut conn, confirmed).unwrap();
        for create in [false, true] {
            let mut existing = input(deck.clone());
            existing.opponent = "FLABÉBÉ  EX".into();
            existing.create_opponent = create;
            record_match(&mut conn, existing).unwrap();
        }
        assert_eq!(list_opponents(&conn).unwrap(), vec!["Flabébé ex"]);
        assert!(list_matches(&conn)
            .unwrap()
            .iter()
            .all(|m| m.opponent.as_deref() == Some("Flabébé ex")));

        let mut typo = input(deck.clone());
        typo.opponent = "Flabébe ex".into();
        typo.create_opponent = false;
        assert!(record_match(&mut conn, typo).is_err());
        assert_eq!(list_matches(&conn).unwrap().len(), 3);
        for game in list_matches(&conn).unwrap() {
            delete_match(&conn, &game.id).unwrap();
        }
        // A lista é um cadastro próprio: excluir partidas não elimina suas opções.
        assert_eq!(list_opponents(&conn).unwrap(), vec!["Flabébé ex"]);
        let mut unknown = input(deck);
        unknown.opponent = "  ".into();
        unknown.create_opponent = false;
        record_match(&mut conn, unknown).unwrap();
        assert!(list_matches(&conn).unwrap()[0].opponent.is_none());
    }

    #[test]
    fn data_survives_reopening_file() {
        let path = std::env::temp_dir().join(format!("ptcg-test-{}.db", Uuid::new_v4()));
        {
            let mut conn = Connection::open(&path).unwrap();
            migrate(&mut conn).unwrap();
            save_deck(&mut conn, "Persistente", None, EXAMPLE).unwrap();
        }
        let conn = Connection::open(&path).unwrap();
        assert_eq!(list_decks(&conn).unwrap()[0].original_export, EXAMPLE);
        drop(conn);
        std::fs::remove_file(path).unwrap();
    }
}
