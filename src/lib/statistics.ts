import type { MatchRecord } from "./types";

export function summarize(matches: MatchRecord[]) {
  const wins = matches.filter((match) => match.result === "win").length;
  const losses = matches.filter((match) => match.result === "loss").length;
  const draws = matches.length - wins - losses;
  // Empates contam no total de partidas, mas não como vitórias.
  return {
    total: matches.length,
    wins,
    losses,
    draws,
    winRate: matches.length ? Math.round((wins / matches.length) * 100) : null,
  };
}

export function byOpponent(matches: MatchRecord[]) {
  const groups = new Map<string, MatchRecord[]>();
  for (const match of matches) {
    const name = match.opponent ?? "Desconhecido";
    groups.set(name, [...(groups.get(name) ?? []), match]);
  }
  return [...groups]
    .map(([name, items]) => ({ name, ...summarize(items) }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}
