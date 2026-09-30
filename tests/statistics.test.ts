import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summarize, byOpponent } from "../src/lib/statistics";
import type { MatchRecord } from "../src/lib/types";

const match = (
  result: MatchRecord["result"],
  opponent: string | null = null,
): MatchRecord => ({
  id: result,
  deckVersionId: "v1",
  deckName: "Rocket",
  version: 1,
  opponent,
  result,
  wentFirst: null,
  format: "standard",
  mode: "ranked",
  notes: "",
  playedAt: "2026-09-30T12:00:00Z",
});
describe("estatísticas de partidas", () => {
  it("não inventa uma taxa para um histórico vazio", () => {
    assert.deepEqual(summarize([]), {
      total: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: null,
    });
  });
  it("inclui empates no denominador e recalcula após remover uma partida", () => {
    const games = [match("win"), match("loss"), match("draw")];
    assert.equal(summarize(games).winRate, 33);
    assert.equal(summarize(games.slice(0, 2)).winRate, 50);
  });
  it("agrupa adversários e preserva o tamanho da amostra", () => {
    const groups = byOpponent([
      match("win", "Charizard"),
      match("loss", "Charizard"),
      match("draw"),
    ]);
    assert.equal(groups[0].name, "Charizard");
    assert.equal(groups[0].total, 2);
    assert.equal(groups[0].winRate, 50);
    assert.equal(groups[1].name, "Desconhecido");
    assert.equal(groups[1].total, 1);
    assert.equal(groups[1].draws, 1);
  });
});
