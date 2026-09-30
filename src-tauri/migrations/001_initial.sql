-- Cada versão é imutável: mudar uma lista não altera as partidas anteriores.
CREATE TABLE decks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE deck_versions (
    id TEXT PRIMARY KEY,
    deck_id TEXT NOT NULL REFERENCES decks(id),
    version INTEGER NOT NULL CHECK(version > 0),
    original_export TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(deck_id, version)
);
CREATE TABLE deck_cards (
    version_id TEXT NOT NULL REFERENCES deck_versions(id),
    category TEXT NOT NULL CHECK(category IN ('pokemon', 'trainer', 'energy')),
    name TEXT NOT NULL,
    set_code TEXT NOT NULL,
    collector_number TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 60),
    PRIMARY KEY(version_id, set_code, collector_number)
);
CREATE TABLE archetypes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE
);
CREATE TABLE matches (
    id TEXT PRIMARY KEY,
    deck_version_id TEXT NOT NULL REFERENCES deck_versions(id),
    opponent_archetype_id TEXT REFERENCES archetypes(id),
    result TEXT NOT NULL CHECK(result IN ('win', 'loss', 'draw')),
    went_first INTEGER CHECK(went_first IN (0, 1)),
    format TEXT NOT NULL CHECK(format IN ('standard', 'expanded')),
    mode TEXT NOT NULL CHECK(mode IN ('ranked', 'casual', 'other')),
    notes TEXT NOT NULL DEFAULT '',
    played_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX matches_played_at ON matches(played_at);
CREATE INDEX matches_deck_version ON matches(deck_version_id);
PRAGMA user_version = 1;
