import { invoke, isTauri } from "@tauri-apps/api/core";
import type { DeckVersion, MatchInput, MatchRecord, ParsedDeck } from "./types";

export const desktop = isTauri();

// A interface pede operações ao Rust. Ela não acessa o arquivo SQLite nem
// conhece SQL, o que deixa as regras de persistência em um único lugar.
function command<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  if (!desktop)
    return Promise.reject(
      new Error("Abra o aplicativo desktop para acessar o banco local."),
    );
  return invoke<T>(name, args);
}
export const api = {
  decks: () => command<DeckVersion[]>("list_decks"),
  matches: () => command<MatchRecord[]>("list_matches"),
  opponents: () => command<string[]>("list_opponents"),
  preview: (text: string) => command<ParsedDeck>("preview_deck", { text }),
  saveDeck: (name: string, existingId: string | null, text: string) =>
    command<string>("save_deck", { name, existingId, text }),
  recordMatch: (input: MatchInput) => command<void>("record_match", { input }),
  deleteMatch: (id: string) => command<void>("delete_match", { id }),
  openOverlay: () => command<void>("open_overlay"),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
