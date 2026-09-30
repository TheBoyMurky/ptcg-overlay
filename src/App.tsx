import { useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DeckImporter } from "./components/DeckImporter";
import { MatchForm } from "./components/MatchForm";
import { api, desktop, errorMessage } from "./lib/api";
import { summarize, byOpponent } from "./lib/statistics";
import { useJournal } from "./lib/useJournal";

const resultLabels = { win: "Vitória", loss: "Derrota", draw: "Empate" };
const modeLabels = { ranked: "Ranqueada", casual: "Casual", other: "Outra" };

export default function App({ overlay }: { overlay: boolean }) {
  const { decks, matches, opponents, error, loading, refresh } = useJournal();
  const [page, setPage] = useState<"overview" | "decks">("overview");
  const [filter, setFilter] = useState("");
  const [formatFilter, setFormatFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [actionError, setActionError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exportText, setExportText] = useState("");
  const filtered = matches.filter(
    (match) =>
      (!filter || match.deckVersionId === filter) &&
      (!formatFilter || match.format === formatFilter) &&
      (!modeFilter || match.mode === modeFilter),
  );
  const stats = summarize(filtered);

  async function removeMatch(id: string) {
    setBusy(true);
    setActionError("");
    try {
      await api.deleteMatch(id);
      setDeleting(null);
      await refresh();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (overlay) {
    const today = matches.filter(
      (match) =>
        new Date(match.playedAt).toDateString() === new Date().toDateString(),
    );
    const daily = summarize(today);
    return (
      <main className="overlay-shell">
        <header className="overlay-header">
          <strong
            onPointerDown={(event) => {
              if (desktop && event.button === 0)
                void getCurrentWindow()
                  .startDragging()
                  .catch((error) => setActionError(errorMessage(error)));
            }}
          >
            ◈ PTCG JOURNAL
          </strong>
          <button
            className="icon-button"
            aria-label="Ocultar overlay"
            onClick={() => {
              if (desktop)
                void getCurrentWindow()
                  .hide()
                  .catch((error) => setActionError(errorMessage(error)));
            }}
          >
            ×
          </button>
        </header>
        <div className="overlay-stats">
          <span>Hoje · todos os baralhos</span>
          <strong>
            {daily.wins} V <span>/</span> {daily.losses} D <span>/</span>{" "}
            {daily.draws} E
          </strong>
        </div>
        {(error || actionError) && (
          <p className="notice error" role="alert">
            {error || actionError}
          </p>
        )}
        <MatchForm decks={decks} opponents={opponents} compact />
        <p className="overlay-foot">Arraste pelo título para reposicionar.</p>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("overview");
          }}
        >
          <span className="brand-mark">◈</span>
          <span>
            PTCG<strong>JOURNAL</strong>
          </span>
        </a>
        <span className="sidebar-caption">SEU JOGO, EM PERSPECTIVA</span>
        <nav aria-label="Principal">
          <button
            className={page === "overview" ? "nav-item active" : "nav-item"}
            onClick={() => setPage("overview")}
          >
            <span>▦</span> Visão geral
          </button>
          <button
            className={page === "decks" ? "nav-item active" : "nav-item"}
            onClick={() => setPage("decks")}
          >
            <span>▤</span> Meus baralhos
          </button>
        </nav>
        <div className="sidebar-footer">
          <span className="status-dot" />{" "}
          {desktop ? "Dados neste computador" : "Prévia da interface"}
          <small>Seu histórico começa aqui.</small>
        </div>
      </aside>
      <main className="main-content">
        <header className="page-header">
          <div>
            <span className="eyebrow">
              POKÉMON TCG LIVE · COMPANHEIRO DE PARTIDAS
            </span>
            <h1>
              {page === "overview"
                ? "Cada partida conta."
                : "Prepare seu próximo jogo."}
            </h1>
            <p className="muted">
              {page === "overview"
                ? "Registre seus resultados. Conheça seus confrontos. Evolua seu jogo."
                : "Importe suas listas e acompanhe a evolução de cada baralho."}
            </p>
          </div>
          <button
            className="secondary overlay-button"
            disabled={!desktop}
            onClick={() => {
              void api
                .openOverlay()
                .catch((error) => setActionError(errorMessage(error)));
            }}
          >
            ↗ Abrir overlay
          </button>
        </header>
        {!desktop && (
          <p className="notice">
            Prévia no navegador: o banco local e o overlay ficam disponíveis no
            aplicativo desktop.
          </p>
        )}
        {loading && <p role="status">Carregando seu histórico…</p>}
        {(error || actionError) && (
          <div className="notice error" role="alert">
            {error || actionError}{" "}
            <button
              className="secondary"
              onClick={() => {
                setActionError("");
                void refresh();
              }}
            >
              Tentar novamente
            </button>
          </div>
        )}
        {page === "overview" ? (
          <>
            <div className="filters">
              <label>
                Baralho / versão
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="">Todos os baralhos</option>
                  {decks.map((deck) => (
                    <option key={deck.id} value={deck.id}>
                      {deck.name} · v{deck.version}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Formato
                <select
                  value={formatFilter}
                  onChange={(e) => setFormatFilter(e.target.value)}
                >
                  <option value="">Todos os formatos</option>
                  <option value="standard">Padrão</option>
                  <option value="expanded">Expandido</option>
                </select>
              </label>
              <label>
                Modalidade
                <select
                  value={modeFilter}
                  onChange={(e) => setModeFilter(e.target.value)}
                >
                  <option value="">Todas as modalidades</option>
                  <option value="ranked">Ranqueada</option>
                  <option value="casual">Casual</option>
                  <option value="other">Outra</option>
                </select>
              </label>
            </div>
            <section className="stats-grid" aria-label="Estatísticas">
              <article className="stat-card">
                <span>PARTIDAS</span>
                <strong>{stats.total}</strong>
                <small>no histórico selecionado</small>
              </article>
              <article className="stat-card highlight">
                <span>TAXA DE VITÓRIA</span>
                <strong>
                  {stats.winRate === null ? "—" : `${stats.winRate}%`}
                </strong>
                <small>vitórias ÷ todas as partidas</small>
              </article>
              <article className="stat-card">
                <span>VITÓRIAS / DERROTAS</span>
                <strong>
                  {stats.wins}
                  <em> / </em>
                  {stats.losses}
                </strong>
                <small>
                  {stats.draws} {stats.draws === 1 ? "empate" : "empates"}
                </small>
              </article>
            </section>
            <div className="dashboard-grid">
              <div className="stack">
                <section className="panel">
                  <div className="section-heading">
                    <h2>Seus confrontos</h2>
                    <span className="tag">Por adversário</span>
                  </div>
                  {stats.total === 0 ? (
                    <div className="empty-state">
                      <span className="empty-symbol">◎</span>
                      <h3>O próximo jogo é o começo.</h3>
                      <p>
                        Os resultados registrados aparecerão aqui,
                        <br /> agrupados por baralho adversário.
                      </p>
                    </div>
                  ) : (
                    <div className="matchups">
                      {byOpponent(filtered).map((group) => (
                        <div className="matchup" key={group.name}>
                          <div>
                            <strong>{group.name}</strong>
                            <small>
                              {group.total} partidas · {group.wins} V /{" "}
                              {group.losses} D / {group.draws} E
                            </small>
                          </div>
                          <strong>{group.winRate}%</strong>
                          <div className="bar-track">
                            <span style={{ width: `${group.winRate}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                <section className="panel">
                  <div className="section-heading">
                    <h2>Últimas partidas</h2>
                    <span className="tag">{filtered.length} registros</span>
                  </div>
                  {filtered.length === 0 ? (
                    <p className="muted empty-history">
                      Nenhuma partida neste histórico.
                    </p>
                  ) : (
                    <ul className="history">
                      {filtered.map((match) => (
                        <li key={match.id}>
                          <div className="history-top">
                            <span className={`result-badge ${match.result}`}>
                              {resultLabels[match.result]}
                            </span>
                            <time dateTime={match.playedAt}>
                              {new Date(match.playedAt).toLocaleString(
                                "pt-BR",
                                { dateStyle: "short", timeStyle: "short" },
                              )}
                            </time>
                          </div>
                          <strong>
                            {match.deckName}{" "}
                            <span className="muted">
                              v{match.version} ×{" "}
                              {match.opponent ?? "Desconhecido"}
                            </span>
                          </strong>
                          <small>
                            {match.format === "standard"
                              ? "Padrão"
                              : "Expandido"}{" "}
                            · {modeLabels[match.mode]} ·{" "}
                            {match.wentFirst === null
                              ? "Ordem não informada"
                              : match.wentFirst
                                ? "Jogou primeiro"
                                : "Jogou segundo"}
                          </small>
                          {match.notes && (
                            <p className="match-notes">{match.notes}</p>
                          )}
                          {deleting === match.id ? (
                            <div className="delete-confirm">
                              <span>Excluir este registro?</span>
                              <button
                                disabled={busy}
                                className="danger"
                                onClick={() => removeMatch(match.id)}
                              >
                                Excluir
                              </button>
                              <button
                                disabled={busy}
                                className="secondary"
                                onClick={() => setDeleting(null)}
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              className="text-button"
                              onClick={() => setDeleting(match.id)}
                            >
                              Excluir registro
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
              <MatchForm decks={decks} opponents={opponents} />
            </div>
          </>
        ) : (
          <div className="decks-grid">
            <DeckImporter decks={decks} />
            <section className="panel">
              <div className="section-heading">
                <h2>Sua coleção de listas</h2>
                <span className="tag">{decks.length} versões</span>
              </div>
              {decks.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-symbol">▤</span>
                  <h3>Seu primeiro baralho.</h3>
                  <p>
                    Cole um export ou experimente
                    <br /> a lista da Equipe Rocket.
                  </p>
                </div>
              ) : (
                <ul className="saved-decks">
                  {decks.map((deck) => (
                    <li key={deck.id}>
                      <div>
                        <strong>{deck.name}</strong>
                        <small>Versão {deck.version} · 60 cartas</small>
                      </div>
                      <button
                        className="secondary"
                        onClick={() => setExportText(deck.originalExport)}
                      >
                        Ver export
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {exportText && (
                <div className="export-view">
                  <label>
                    Export original — selecione e copie
                    <textarea
                      readOnly
                      rows={12}
                      value={exportText}
                      onFocus={(e) => e.target.select()}
                    />
                  </label>
                  <button
                    className="text-button"
                    onClick={() => setExportText("")}
                  >
                    Fechar export
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
        <footer className="page-footer">
          PTCG Journal{" "}
          <span>
            Projeto pessoal independente · Registro manual de partidas
          </span>
        </footer>
      </main>
    </div>
  );
}
