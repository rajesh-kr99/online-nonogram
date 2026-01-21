/**
 * Storage Manager for Daily Nonogram Game
 * Implements "Session vs Daily" lifecycle with date-aware localStorage
 * 
 * Key Strategy:
 * - Store data with date in the key: "puzzle_easy_2026-01-19"
 * - Check if saved date matches today
 * - If same day: resume | If different day: start fresh (but keep history)
 * - Auto-cleanup old data after 30 days
 */

import { Grid, CellValue, Difficulty } from "./nonogram";

export interface GameSessionData {
  grid: Grid<CellValue>;
  undoStack: Grid<CellValue>[];
  redoStack: Grid<CellValue>[];
  timerSeconds: number;
  status: "in_progress" | "solved";
  lastSavedDate: string; // ISO date YYYY-MM-DD
}

/**
 * Get today's date in ISO format (YYYY-MM-DD)
 * Uses local timezone, not UTC
 */
export function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Generate storage key for a puzzle
 * Format: "puzzle_${difficulty}_${dateISO}"
 * Example: "puzzle_easy_2026-01-19"
 */
export function getStorageKey(difficulty: Difficulty, dateISO: string): string {
  return `puzzle_${difficulty}_${dateISO}`;
}

/**
 * Check if stored data is from today or an old day
 * Returns true if data was saved today, false if from a different day
 */
export function isDataFromToday(data: GameSessionData): boolean {
  const today = getTodayISO();
  return data.lastSavedDate === today;
}

/**
 * Load game session data from localStorage
 * 
 * Returns:
 * - Full data if it exists AND is from today
 * - null if no data OR data is from a different day (but data remains in storage for history)
 */
export function loadGameSession(
  difficulty: Difficulty,
  dateISO: string
): GameSessionData | null {
  if (typeof window === "undefined") return null;

  try {
    const key = getStorageKey(difficulty, dateISO);
    const saved = localStorage.getItem(key);

    if (!saved) return null;

    const data = JSON.parse(saved) as GameSessionData;

    // Check if data is from today
    if (!isDataFromToday(data)) {
      // Data is from old day - return null to start fresh
      // Note: We intentionally do NOT delete it - keep for history/stats
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Save game session data to localStorage
 * Automatically attaches today's date
 */
export function saveGameSession(
  difficulty: Difficulty,
  dateISO: string,
  data: Omit<GameSessionData, "lastSavedDate">
): void {
  if (typeof window === "undefined") return;

  try {
    const key = getStorageKey(difficulty, dateISO);
    const sessionData: GameSessionData = {
      ...data,
      lastSavedDate: getTodayISO(),
    };
    localStorage.setItem(key, JSON.stringify(sessionData));
  } catch {
    // localStorage might be full or disabled
  }
}

/**
 * Get all stored puzzle data (for history/stats)
 * Returns all puzzle keys and their data
 */
export function getAllStoredSessions(): {
  key: string;
  difficulty: Difficulty;
  dateISO: string;
  data: GameSessionData;
}[] {
  if (typeof window === "undefined") return [];

  try {
    const results = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("puzzle_")) continue;

      const parts = key.split("_");
      if (parts.length !== 3) continue; // Invalid format

      const difficulty = parts[1] as Difficulty;
      const dateISO = parts[2];

      const saved = localStorage.getItem(key);
      if (!saved) continue;

      try {
        const data = JSON.parse(saved) as GameSessionData;
        results.push({ key, difficulty, dateISO, data });
      } catch {
        // Skip malformed data
      }
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Delete a specific puzzle session from storage
 * Use for archiving or cleanup
 */
export function deleteGameSession(
  difficulty: Difficulty,
  dateISO: string
): void {
  if (typeof window === "undefined") return;

  try {
    const key = getStorageKey(difficulty, dateISO);
    localStorage.removeItem(key);
  } catch {
    // Ignore errors
  }
}

/**
 * Cleanup old game data from localStorage
 * Deletes puzzle data older than specified days (default: 30 days)
 * 
 * Call this once on app startup to manage storage space
 * 5MB limit for localStorage - with daily data this could fill up after 2+ years
 */
export function cleanupOldGameData(olderThanDays: number = 30): void {
  if (typeof window === "undefined") return;

  try {
    const today = new Date();
    const keysToDelete: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("puzzle_")) continue;

      // Extract date from key: "puzzle_easy_2026-01-19"
      const parts = key.split("_");
      if (parts.length !== 3) continue;

      const dateStr = parts[2]; // "2026-01-19"
      const fileDate = new Date(`${dateStr}T00:00:00Z`);

      // Calculate days difference
      const diffTime = Math.abs(today.getTime() - fileDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Mark for deletion if older than threshold
      if (diffDays > olderThanDays) {
        keysToDelete.push(key);
      }
    }

    // Delete marked keys
    keysToDelete.forEach((key) => {
      localStorage.removeItem(key);
    });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Get statistics for all played puzzles
 * Useful for building a "calendar" or "history" feature
 */
export function getGameStats(): {
  totalPlayed: number;
  totalSolved: number;
  byDifficulty: Record<Difficulty, { played: number; solved: number }>;
  oldestDate: string | null;
  newestDate: string | null;
} {
  const sessions = getAllStoredSessions();

  const stats = {
    totalPlayed: sessions.length,
    totalSolved: sessions.filter((s) => s.data.status === "solved").length,
    byDifficulty: {
      easy: { played: 0, solved: 0 },
      medium: { played: 0, solved: 0 },
      hard: { played: 0, solved: 0 },
    },
    oldestDate: null as string | null,
    newestDate: null as string | null,
  };

  if (sessions.length > 0) {
    const dates = sessions.map((s) => new Date(s.dateISO).getTime());
    stats.oldestDate = new Date(Math.min(...dates)).toISOString().split("T")[0];
    stats.newestDate = new Date(Math.max(...dates)).toISOString().split("T")[0];
  }

  for (const session of sessions) {
    stats.byDifficulty[session.difficulty].played++;
    if (session.data.status === "solved") {
      stats.byDifficulty[session.difficulty].solved++;
    }
  }

  return stats;
}
