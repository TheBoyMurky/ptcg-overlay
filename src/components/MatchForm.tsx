import { useEffect, useState } from "react";
import { api, desktop, errorMessage } from "../lib/api";
import type { DeckVersion, MatchInput, Result } from "../lib/types";
import { OpponentPicker, normalizeOpponent } from "./OpponentPicker";

export function MatchForm({
  decks,
  opponents,
  compact = false,
}: {
  decks: DeckVersion[];
  opponents: string[];
  compact?: boolean;
}) {
  const [deckVersionId, setDeckVersionId] = useState("");
  const [opponent, setOpponent] = useState("");
  const [createOpponent, setCreateOpponent] = useState(false);
  const opponentReady =
    !opponent.trim() ||
    createOpponent ||
    opponents.some(
      (name) => normalizeOpponent(name) === normalizeOpponent(opponent),
    );
  const [wentFirst, setWentFirst] = useState("unknown");
  const [format, setFormat] = useState<MatchInput["format"]>("standard");
  const [mode, setMode] = useState<MatchInput["mode"]>("ranked");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!decks.some((deck) => deck.id === deckVersionId))
      setDeckVersionId(decks[0]?.id ?? "");
  }, [decks, deckVersionId]);

  async function save(result: Result) {
    if (busy || !opponentReady) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api.recordMatch({
        deckVersionId,
        opponent,
        createOpponent,
        result,
        wentFirst: wentFirst === "unknown" ? null : wentFirst === "first",
        format,
        mode,
        notes,
      });
      setOpponent("");
      setCreateOpponent(false);
      setNotes("");
      setWentFirst("unknown");
      setMessage("Partida registrada.");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={compact ? "compact-form" : "panel"}>
      {!compact && (
        <>
          <span className="eyebrow">UMA PARTIDA, UM APRENDIZADO</span>
          <h2>Registrar resultado</h2>
        </>
      )}
      {decks.length === 0 && (
        <p className="muted">
          Importe um baralho na janela principal para começar.
        </p>
      )}
      <fieldset disabled={busy || !desktop || decks.length === 0}>
        <label>
          Seu baralho
          <select
            value={deckVersionId}
            onChange={(e) => setDeckVersionId(e.target.value)}
          >
            <option value="" disabled>
              Selecione um baralho
            </option>
            {decks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.name} · v{deck.version}
              </option>
            ))}
          </select>
        </label>
        <OpponentPicker
          names={opponents}
          value={opponent}
          confirmed={createOpponent}
          onChange={(name) => {
            setOpponent(name);
            setCreateOpponent(false);
          }}
          onCreate={() => setCreateOpponent(true)}
        />
        <div className="form-row">
          <label>
            Formato
            <select
              value={format}
              onChange={(e) =>
                setFormat(e.target.value as MatchInput["format"])
              }
            >
              <option value="standard">Padrão</option>
              <option value="expanded">Expandido</option>
            </select>
          </label>
          <label>
            Modalidade
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as MatchInput["mode"])}
            >
              <option value="ranked">Ranqueada</option>
              <option value="casual">Casual</option>
              <option value="other">Outra</option>
            </select>
          </label>
        </div>
        <label>
          Ordem de jogo
          <select
            value={wentFirst}
            onChange={(e) => setWentFirst(e.target.value)}
          >
            <option value="unknown">Não informado</option>
            <option value="first">Joguei primeiro</option>
            <option value="second">Joguei segundo</option>
          </select>
        </label>
        {!compact && (
          <label>
            Observações
            <textarea
              rows={2}
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="O que você aprendeu nesta partida?"
            />
          </label>
        )}
        <div className="result-buttons">
          <button
            disabled={!deckVersionId || !opponentReady}
            onClick={() => save("win")}
          >
            Vitória
          </button>
          <button
            disabled={!deckVersionId || !opponentReady}
            className="loss-button"
            onClick={() => save("loss")}
          >
            Derrota
          </button>
          <button
            disabled={!deckVersionId || !opponentReady}
            className="secondary"
            onClick={() => save("draw")}
          >
            Empate
          </button>
        </div>
      </fieldset>
      {busy && (
        <p role="status" className="muted small">
          Salvando…
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice success" role="status">
          {message}
        </p>
      )}
      {!compact && (
        <p className="muted small">
          O registro usa a data e a hora atuais. A versão selecionada fica
          preservada no histórico.
        </p>
      )}
    </section>
  );
}
