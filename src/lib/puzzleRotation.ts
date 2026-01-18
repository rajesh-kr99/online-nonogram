import type { Difficulty, PuzzleEntry } from "@/lib/nonogram";

type RotationState = {
  // puzzle IDs already used today/session window
  usedIds: string[];
  // optional: last picked, useful for debugging
  lastId?: string;
};

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function loadState(key: string): RotationState {
  if (typeof window === "undefined") return { usedIds: [] };
  const parsed = safeParse<RotationState>(localStorage.getItem(key));
  if (!parsed || !Array.isArray(parsed.usedIds)) return { usedIds: [] };
  return { usedIds: parsed.usedIds.filter((x) => typeof x === "string"), lastId: parsed.lastId };
}

function saveState(key: string, state: RotationState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(state));
}

/**
 * Returns a stable rotation key for the given difficulty.
 * The key persists across sessions until the pool is exhausted.
 */
export function getRotationKey(difficulty: Difficulty) {
  return `nonogram:rotate:${difficulty}:v1`;
}

/**
 * Pick the next puzzle from a pool without repeats until exhausted.
 * If pool is exhausted, it resets and starts over.
 */
export function pickNextFromPool(pool: PuzzleEntry[], rotationKey: string): PuzzleEntry {
  if (pool.length === 0) {
    throw new Error("Pool is empty");
  }

  const state = loadState(rotationKey);
  const used = new Set(state.usedIds);

  // candidates not used yet
  const remaining = pool.filter((p) => !used.has(p.id));

  let picked: PuzzleEntry;

  if (remaining.length > 0) {
    picked = remaining[0]; // simple deterministic "next"
    state.usedIds = [...state.usedIds, picked.id];
    state.lastId = picked.id;
    saveState(rotationKey, state);
    return picked;
  }

  // exhausted: reset, start again
  picked = pool[0];
  const nextState: RotationState = { usedIds: [picked.id], lastId: picked.id };
  saveState(rotationKey, nextState);
  return picked;
}

/**
 * Force-advance to the next puzzle (used by "New puzzle" button).
 * This is basically the same as pickNextFromPool, but exposed semantically.
 */
export function advancePool(pool: PuzzleEntry[], rotationKey: string): PuzzleEntry {
  return pickNextFromPool(pool, rotationKey);
}

/**
 * Get how many puzzles remain before pool resets.
 * Returns { used, total, remaining }.
 */
export function getPoolStatus(pool: PuzzleEntry[], rotationKey: string): {
  used: number;
  total: number;
  remaining: number;
} {
  const state = loadState(rotationKey);
  const poolIds = new Set(pool.map((p) => p.id));
  // Only count used IDs that are actually in this pool
  const usedInPool = state.usedIds.filter((id) => poolIds.has(id));
  const used = usedInPool.length;
  const total = pool.length;
  const remaining = Math.max(0, total - used);
  return { used, total, remaining };
}

/**
 * Optional: clear rotation state (e.g., user wants to "reset rotation").
 */
export function clearRotation(rotationKey: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(rotationKey);
}
