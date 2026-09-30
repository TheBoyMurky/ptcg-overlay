use serde::Serialize;
use std::collections::HashSet;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Card {
    pub category: String,
    pub name: String,
    pub set_code: String,
    pub collector_number: String,
    pub quantity: u32,
}

#[derive(Debug, Serialize)]
pub struct ParsedDeck {
    pub cards: Vec<Card>,
    pub total: u32,
}

// A leitura acontece em Rust tanto na prévia quanto ao salvar. Assim, as duas
// operações usam exatamente as mesmas regras e a interface não decide o que é válido.
pub fn parse_export(text: &str) -> Result<ParsedDeck, String> {
    if text.len() > 100_000 {
        return Err("O export é muito grande. Cole apenas a lista de um baralho.".into());
    }
    let mut cards = Vec::new();
    let mut section: Option<(&str, usize, usize)> = None;
    let mut categories = HashSet::new();
    let mut identities = HashSet::new();
    let mut declared_total = None;

    fn check_section(section: Option<(&str, usize, usize)>) -> Result<(), String> {
        if let Some((name, expected, actual)) = section {
            if expected != actual {
                return Err(format!(
                    "A seção {name} declara {expected} entradas, mas contém {actual}."
                ));
            }
        }
        Ok(())
    }

    for (index, raw) in text.lines().enumerate() {
        let line = raw.trim().trim_start_matches('\u{feff}');
        if line.is_empty() {
            continue;
        }
        let error = |message: &str| format!("Linha {}: {message}", index + 1);
        if declared_total.is_some() {
            return Err(error("há conteúdo depois do total de cartas."));
        }
        if let Some((label, value)) = line.split_once(':') {
            let label = label.trim().to_lowercase();
            let category = match label.as_str() {
                "pokémon" | "pokemon" => Some("pokemon"),
                "treinador" | "treinadores" | "trainer" | "trainers" => Some("trainer"),
                "energia" | "energias" | "energy" => Some("energy"),
                _ => None,
            };
            if let Some(category) = category {
                check_section(section)?;
                if !categories.insert(category) {
                    return Err(error("seção repetida."));
                }
                let count = value
                    .trim()
                    .parse::<usize>()
                    .map_err(|_| error("quantidade de entradas inválida."))?;
                section = Some((category, count, 0));
                continue;
            }
            if label == "total de cartas" || label == "total cards" || label == "total" {
                declared_total = Some(
                    value
                        .trim()
                        .parse::<u32>()
                        .map_err(|_| error("total inválido."))?,
                );
                continue;
            }
        }
        let Some((category, _, count)) = section.as_mut() else {
            return Err(error("carta sem cabeçalho de categoria."));
        };
        // Os dois últimos campos são coleção e número. Todo o meio é o nome,
        // que pode conter espaços, apóstrofos, acentos ou símbolos de energia.
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 4 {
            return Err(error("use: quantidade nome coleção número."));
        }
        let quantity = parts[0]
            .parse::<u32>()
            .map_err(|_| error("quantidade inválida."))?;
        if !(1..=60).contains(&quantity) {
            return Err(error("a quantidade deve estar entre 1 e 60."));
        }
        let set_code = parts[parts.len() - 2].to_uppercase();
        let number = parts[parts.len() - 1].to_string();
        if !set_code.chars().all(|c| c.is_ascii_alphanumeric())
            || !number
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '/')
        {
            return Err(error("coleção ou número da carta inválido."));
        }
        if !identities.insert((set_code.clone(), number.clone())) {
            return Err(error(
                "esta impressão já aparece na lista; reúna as quantidades em uma linha.",
            ));
        }
        cards.push(Card {
            category: category.to_string(),
            quantity,
            name: parts[1..parts.len() - 2].join(" "),
            set_code,
            collector_number: number,
        });
        *count += 1;
    }
    check_section(section)?;
    let total = cards.iter().map(|card| card.quantity).sum();
    if let Some(declared) = declared_total {
        if declared != total {
            return Err(format!(
                "O total declarado é {declared}, mas a lista soma {total} cartas."
            ));
        }
    }
    if total != 60 {
        return Err(format!(
            "O baralho deve conter 60 cartas; encontramos {total}."
        ));
    }
    Ok(ParsedDeck { cards, total })
}

#[cfg(test)]
mod tests {
    use super::*;
    const EXAMPLE: &str = include_str!("../../fixtures/team-rocket.txt");

    #[test]
    fn imports_reference_and_preserves_printings() {
        let deck = parse_export(EXAMPLE).unwrap();
        assert_eq!(deck.total, 60);
        assert_eq!(deck.cards.len(), 29);
        for (category, expected) in [("pokemon", 16), ("trainer", 33), ("energy", 11)] {
            assert_eq!(
                deck.cards
                    .iter()
                    .filter(|c| c.category == category)
                    .map(|c| c.quantity)
                    .sum::<u32>(),
                expected
            );
        }
        assert_eq!(
            deck.cards
                .iter()
                .filter(|c| c.name == "Team Rocket's Giovanni")
                .count(),
            2
        );
        assert!(deck.cards.iter().any(|c| c.name == "Basic {G} Energy"));
    }

    #[test]
    fn accepts_english_crlf_and_blank_lines() {
        let text = EXAMPLE
            .replace("Treinador:", "Trainer:")
            .replace("Energia:", "Energy:")
            .replace("Total de cartas:", "Total Cards:")
            .replace('\n', "\r\n");
        assert_eq!(parse_export(&text).unwrap().total, 60);
    }

    #[test]
    fn rejects_bad_counts_lines_and_duplicate_printings() {
        for text in [
            EXAMPLE.replace("Pokémon: 8", "Pokémon: 16"),
            EXAMPLE.replace("4 Team Rocket's Spidops", "0 Team Rocket's Spidops"),
            EXAMPLE.replace("Total de cartas: 60", "Total de cartas: 59"),
            EXAMPLE.replace("DRI 225", "DRI 238"),
            EXAMPLE.replace("1 Poké Pad 30C 126", "carta quebrada"),
            EXAMPLE.replace("6 Basic {G}", "5 Basic {G}"),
        ] {
            assert!(parse_export(&text).is_err(), "Deveria rejeitar {text}");
        }
    }
}
