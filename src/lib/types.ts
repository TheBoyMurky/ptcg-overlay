export interface Card {
  category: "pokemon" | "trainer" | "energy";
  name: string;
  setCode: string;
  collectorNumber: string;
  quantity: number;
}
export interface ParsedDeck {
  cards: Card[];
  total: number;
}
export interface DeckVersion {
  id: string;
  deckId: string;
  name: string;
  version: number;
  originalExport: string;
}
export type Result = "win" | "loss" | "draw";
export interface MatchInput {
  deckVersionId: string;
  opponent: string;
  createOpponent: boolean;
  result: Result;
  wentFirst: boolean | null;
  format: "standard" | "expanded";
  mode: "ranked" | "casual" | "other";
  notes: string;
}
export interface MatchRecord extends Omit<
  MatchInput,
  "opponent" | "createOpponent"
> {
  id: string;
  deckName: string;
  version: number;
  opponent: string | null;
  playedAt: string;
}
