import { useState } from "react";
import { api, desktop, errorMessage } from "../lib/api";
import type { DeckVersion, ParsedDeck } from "../lib/types";
import example from "../../fixtures/team-rocket.txt?raw";

export function DeckImporter({ decks }: { decks: DeckVersion[] }) {
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [existingId, setExistingId] = useState("");
  const [preview, setPreview] = useState<ParsedDeck | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const uniqueDecks = decks.filter(
    (deck, index) =>
      decks.findIndex((other) => other.deckId === deck.deckId) === index,
  );

  function changeText(value: string) {
    setText(value);
    setPreview(null);
    setError("");
    setMessage("");
  }
  async function inspect() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setPreview(await api.preview(text));
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      await api.saveDeck(name, existingId || null, text);
      setPreview(null);
      setText("");
      setName("");
      setExistingId("");
      setMessage(
        "Baralho salvo. Ele já pode ser usado para registrar partidas.",
      );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel import-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">DO JOGO PARA O SEU HISTÓRICO</span>
          <h2>Importar baralho</h2>
        </div>
        <span className="tag">60 cartas</span>
      </div>
      <p className="muted">
        Cole a lista exportada pelo Pokémon TCG Live. Você poderá conferir as
        cartas antes de salvar.
      </p>
      <fieldset disabled={busy}>
        <label>
          Salvar como
          <select
            value={existingId}
            onChange={(e) => setExistingId(e.target.value)}
          >
            <option value="">Novo baralho</option>
            {uniqueDecks.map((deck) => (
              <option key={deck.deckId} value={deck.deckId}>
                Nova versão de {deck.name}
              </option>
            ))}
          </select>
        </label>
        {!existingId && (
          <label>
            Nome do baralho
            <input
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Equipe Rocket"
            />
          </label>
        )}
        <label>
          Lista exportada
          <textarea
            rows={10}
            spellCheck={false}
            value={text}
            onChange={(e) => changeText(e.target.value)}
            placeholder={"Pokémon: 8\n4 Team Rocket's Spidops DRI 187\n…"}
          />
        </label>
        <div className="actions">
          <button
            className="secondary"
            onClick={() => {
              changeText(example);
              setName("Equipe Rocket");
            }}
          >
            Usar exemplo Rocket
          </button>
          <button disabled={!desktop || !text.trim()} onClick={inspect}>
            {busy ? "Processando…" : "Conferir lista"}
          </button>
        </div>
      </fieldset>
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
      {preview && (
        <div className="deck-preview">
          <h3>Lista conferida · {preview.total} cartas</h3>
          <div className="category-counts">
            {(["pokemon", "trainer", "energy"] as const).map(
              (category, index) => (
                <span key={category}>
                  {["Pokémon", "Treinador", "Energia"][index]}{" "}
                  <strong>
                    {preview.cards
                      .filter((card) => card.category === category)
                      .reduce((sum, card) => sum + card.quantity, 0)}
                  </strong>
                </span>
              ),
            )}
          </div>
          <ul className="card-list">
            {preview.cards.map((card) => (
              <li key={`${card.setCode}-${card.collectorNumber}`}>
                <strong>{card.quantity}×</strong>
                <span>{card.name}</span>
                <small>
                  {card.setCode} {card.collectorNumber}
                </small>
              </li>
            ))}
          </ul>
          <p className="muted small">
            Conferência de estrutura e quantidade. Não verifica a legalidade das
            cartas no formato.
          </p>
          <button
            disabled={busy || (!existingId && !name.trim())}
            onClick={save}
          >
            Salvar {existingId ? "nova versão" : "baralho"}
          </button>
        </div>
      )}
    </section>
  );
}
