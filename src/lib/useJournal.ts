import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { api, desktop, errorMessage } from "./api";
import type { DeckVersion, MatchRecord } from "./types";

export function useJournal() {
  const [decks, setDecks] = useState<DeckVersion[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [opponents, setOpponents] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(desktop);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    if (!desktop) return;
    const request = ++generation.current;
    try {
      const [nextDecks, nextMatches, nextOpponents] = await Promise.all([
        api.decks(),
        api.matches(),
        api.opponents(),
      ]);
      if (request !== generation.current) return;
      setDecks(nextDecks);
      setMatches(nextMatches);
      setOpponents(nextOpponents);
      setError("");
    } catch (error) {
      if (request === generation.current) setError(errorMessage(error));
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (!desktop) return;
    // Eventos atualizam as duas janelas após uma gravação. A limpeza evita
    // acumular ouvintes quando o React recria um componente no desenvolvimento.
    const subscription = listen("data-changed", () => {
      void refresh();
    });
    void subscription.catch((error) => setError(errorMessage(error)));
    window.addEventListener("focus", refresh);
    return () => {
      generation.current++;
      void subscription.then((unlisten) => unlisten()).catch(() => {});
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);
  return { decks, matches, opponents, error, loading, refresh };
}
