"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import styles from "./page.module.css";
import AdSlot from "@/components/AdSlot";
import NonogramBoard from "@/components/NonogramBoard";
import StatsModal from "@/components/StatsModal";
import { useLocalStorageBoolean } from "@/hooks/useLocalStorageBoolean";
import {
  type Grid,
  type CellValue,
  type Difficulty,
  createEmptyGrid,
  computeCluesFromSolution,
  isSolved,
  isValidPlayerGrid,
  isValidPlayerGridStack,
  getLocalDateISO,
  getFeaturedPuzzle,
  getNextPuzzleNoRepeat,
  makeDailySeenKey,
  PUZZLES,
} from "@/lib/nonogram";

// ==============================================
// LOCALSTORAGE HELPERS
// ==============================================

/** Stats data shape */
interface Stats {
  totalSolved: number;
  totalSolvedByDifficulty: Record<Difficulty, number>;
  solvedToday: number;
  lastSolvedDateISO: string | null;
  seenTodayByDifficulty?: Record<Difficulty, number>;
}

const STATS_KEY = "nonogram:stats:v1";

/** Create default stats object */
function createDefaultStats(): Stats {
  return {
    totalSolved: 0,
    totalSolvedByDifficulty: { easy: 0, medium: 0, hard: 0 },
    solvedToday: 0,
    lastSolvedDateISO: null,
    seenTodayByDifficulty: { easy: 0, medium: 0, hard: 0 },
  };
}

/** Load stats from localStorage (with migration for older formats) */
function loadStats(): Stats {
  if (typeof window === "undefined") return createDefaultStats();
  try {
    const saved = localStorage.getItem(STATS_KEY);
    if (!saved) return createDefaultStats();
    const parsed = JSON.parse(saved);
    if (typeof parsed !== "object" || parsed === null) return createDefaultStats();

    // Migrate: ensure all fields exist
    const stats: Stats = {
      totalSolved:
        typeof parsed.totalSolved === "number" ? parsed.totalSolved : 0,
      totalSolvedByDifficulty:
        typeof parsed.totalSolvedByDifficulty === "object" &&
        parsed.totalSolvedByDifficulty !== null
          ? {
              easy:
                typeof parsed.totalSolvedByDifficulty.easy === "number"
                  ? parsed.totalSolvedByDifficulty.easy
                  : 0,
              medium:
                typeof parsed.totalSolvedByDifficulty.medium === "number"
                  ? parsed.totalSolvedByDifficulty.medium
                  : 0,
              hard:
                typeof parsed.totalSolvedByDifficulty.hard === "number"
                  ? parsed.totalSolvedByDifficulty.hard
                  : 0,
            }
          : { easy: 0, medium: 0, hard: 0 },
      solvedToday:
        typeof parsed.solvedToday === "number" ? parsed.solvedToday : 0,
      lastSolvedDateISO:
        typeof parsed.lastSolvedDateISO === "string"
          ? parsed.lastSolvedDateISO
          : null,
      seenTodayByDifficulty:
        typeof parsed.seenTodayByDifficulty === "object" &&
        parsed.seenTodayByDifficulty !== null
          ? {
              easy:
                typeof parsed.seenTodayByDifficulty.easy === "number"
                  ? parsed.seenTodayByDifficulty.easy
                  : 0,
              medium:
                typeof parsed.seenTodayByDifficulty.medium === "number"
                  ? parsed.seenTodayByDifficulty.medium
                  : 0,
              hard:
                typeof parsed.seenTodayByDifficulty.hard === "number"
                  ? parsed.seenTodayByDifficulty.hard
                  : 0,
            }
          : { easy: 0, medium: 0, hard: 0 },
    };

    return stats;
  } catch {
    return createDefaultStats();
  }
}

/** Save stats to localStorage */
function saveStats(stats: Stats): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // localStorage might be full or disabled
  }
}

/** Generate a solved marker key for a puzzle */
function getSolvedMarkerKey(difficulty: Difficulty, puzzleId: string): string {
  return `nonogram:solved:${difficulty}:${puzzleId}:v1`;
}

/** Check if a puzzle has been marked as solved */
function isPuzzleMarkedSolved(difficulty: Difficulty, puzzleId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      localStorage.getItem(getSolvedMarkerKey(difficulty, puzzleId)) === "true"
    );
  } catch {
    return false;
  }
}

/** Mark a puzzle as solved */
function markPuzzleSolved(difficulty: Difficulty, puzzleId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getSolvedMarkerKey(difficulty, puzzleId), "true");
  } catch {
    // localStorage might be full or disabled
  }
}

/** Load seen puzzle IDs from localStorage by key */
function loadSeenIds(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

/** Save seen puzzle IDs to localStorage by key (de-duplicates before saving) */
function saveSeenIds(key: string, ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const unique = Array.from(new Set(ids));
    localStorage.setItem(key, JSON.stringify(unique));
  } catch {
    // localStorage might be full or disabled
  }
}

/** Clear seen puzzle IDs from localStorage by key */
function clearSeenIds(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Load saved progress from localStorage */
function loadProgress(
  storageKey: string,
  size: number
): {
  playerGrid: Grid<CellValue>;
  undoStack: Grid<CellValue>[];
  redoStack: Grid<CellValue>[];
} | null {
  if (typeof window === "undefined") return null;

  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return null;

    const parsed = JSON.parse(saved);
    if (typeof parsed !== "object" || parsed === null) return null;

    if (!isValidPlayerGrid(parsed.playerGrid, size)) return null;

    const undoStack = isValidPlayerGridStack(parsed.undoStack, size)
      ? parsed.undoStack
      : [];
    const redoStack = isValidPlayerGridStack(parsed.redoStack, size)
      ? parsed.redoStack
      : [];

    return {
      playerGrid: parsed.playerGrid,
      undoStack,
      redoStack,
    };
  } catch {
    return null;
  }
}

/** Save progress to localStorage */
function saveProgress(
  storageKey: string,
  playerGrid: Grid<CellValue>,
  undoStack: Grid<CellValue>[],
  redoStack: Grid<CellValue>[]
): void {
  if (typeof window === "undefined") return;

  try {
    const data = { playerGrid, undoStack, redoStack };
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch {
    // localStorage might be full or disabled
  }
}

export default function Home() {
  const [calmMode, setCalmMode] = useLocalStorageBoolean("calmMode", false);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");

  const hasEasy = PUZZLES.easy.length > 0;
  const hasMedium = PUZZLES.medium.length > 0;
  const hasHard = PUZZLES.hard.length > 0;

  // Track today's date (updates every 60s for midnight rollover)
  const [todayISO, setTodayISO] = useState(() => getLocalDateISO());

  useEffect(() => {
    const intervalId = setInterval(() => {
      const next = getLocalDateISO();
      setTodayISO((prev) => (prev === next ? prev : next));
    }, 60_000);
    return () => clearInterval(intervalId);
  }, []);

  const [activePuzzleId, setActivePuzzleId] = useState<string | null>(null);
  const activePuzzleIdRef = useRef<string | null>(null);

  useEffect(() => {
    activePuzzleIdRef.current = activePuzzleId;
  }, [activePuzzleId]);

  const [seenIdsToday, setSeenIdsToday] = useState<string[]>([]);

  const pool = useMemo(() => PUZZLES[difficulty] ?? [], [difficulty]);

  // On difficulty or date change: load seen IDs and pick appropriate puzzle
  useEffect(() => {
    if (pool.length === 0) return;

    const seenKey = makeDailySeenKey(difficulty, todayISO);
    const loadedSeenIds = loadSeenIds(seenKey);
    setSeenIdsToday(loadedSeenIds);

    const currentId = activePuzzleIdRef.current;
    if (currentId && pool.some((p) => p.id === currentId)) return;

    const featured = getFeaturedPuzzle(difficulty, todayISO);
    const seenSet = new Set(loadedSeenIds);

    let puzzleToPlay = featured;
    if (seenSet.has(featured.id)) {
      puzzleToPlay = getNextPuzzleNoRepeat(
        difficulty,
        todayISO,
        loadedSeenIds,
        featured
      );
    }

    setActivePuzzleId(puzzleToPlay.id);
  }, [difficulty, todayISO, pool]);

  const puzzle = useMemo(() => {
    if (pool.length === 0) {
      const fallback = PUZZLES.easy?.[0];
      if (!fallback) throw new Error("No puzzles available");
      return fallback;
    }
    const found = pool.find((p) => p.id === activePuzzleId);
    return found ?? pool[0];
  }, [pool, activePuzzleId]);

  const { size, id: puzzleId, solution } = puzzle;

  // Mark the active puzzle as seen when puzzleId changes
  useEffect(() => {
    if (!puzzleId) return;
    if (pool.length === 0) return;

    const seenKey = makeDailySeenKey(difficulty, todayISO);
    const loaded = loadSeenIds(seenKey);

    if (!loaded.includes(puzzleId)) {
      const updated = [...loaded, puzzleId];
      saveSeenIds(seenKey, updated);
      setSeenIdsToday(updated);
    } else {
      // keep state in sync
      setSeenIdsToday(loaded);
    }
  }, [difficulty, todayISO, puzzleId, pool.length, setSeenIdsToday]);

  const remainingCount = useMemo(() => {
    const seenSet = new Set(seenIdsToday);
    return pool.filter((p) => !seenSet.has(p.id)).length;
  }, [pool, seenIdsToday]);

  const featuredPuzzleId = useMemo(() => {
    if (pool.length === 0) return null;
    return getFeaturedPuzzle(difficulty, todayISO).id;
  }, [difficulty, todayISO, pool]);

  const isOnFeatured = puzzleId === featuredPuzzleId;

  const storageKey = useMemo(() => {
    return `nonogram:${difficulty}:${todayISO}:${puzzleId}:v1`;
  }, [difficulty, todayISO, puzzleId]);

  const [playerGrid, setPlayerGrid] = useState<Grid<CellValue>>(() =>
    createEmptyGrid(size)
  );
  const [undoStack, setUndoStack] = useState<Grid<CellValue>[]>([]);
  const [redoStack, setRedoStack] = useState<Grid<CellValue>[]>([]);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  const hasLoadedRef = useRef(false);

  const [stats, setStats] = useState<Stats>(createDefaultStats);
  const [statsModalOpen, setStatsModalOpen] = useState(false);

  // Load stats on mount, reset daily counts if date changed
  useEffect(() => {
    const loaded = loadStats();
    let needsSave = false;

    // Reset daily stats if it's a new day
    if (loaded.lastSolvedDateISO !== todayISO) {
      loaded.solvedToday = 0;
      loaded.lastSolvedDateISO = todayISO;
      needsSave = true;
    }

    // Compute seenTodayByDifficulty from localStorage for all difficulties
    const difficulties: Difficulty[] = ["easy", "medium", "hard"];
    const seenCounts: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
    for (const d of difficulties) {
      const seenKey = makeDailySeenKey(d, todayISO);
      const seenIds = loadSeenIds(seenKey);
      seenCounts[d] = seenIds.length;
    }

    // Only mark as needing save if seenTodayByDifficulty actually changed
    const prev = loaded.seenTodayByDifficulty ?? { easy: 0, medium: 0, hard: 0 };
    if (
      prev.easy !== seenCounts.easy ||
      prev.medium !== seenCounts.medium ||
      prev.hard !== seenCounts.hard
    ) {
      loaded.seenTodayByDifficulty = seenCounts;
      needsSave = true;
    }

    if (needsSave) {
      saveStats(loaded);
    }
    setStats(loaded);
  }, [todayISO]);

  // Update seenTodayByDifficulty when seenIdsToday changes
  useEffect(() => {
    const count = seenIdsToday.length;
    setStats((prev) => {
      const currentCount = prev.seenTodayByDifficulty?.[difficulty] ?? 0;
      if (currentCount === count) return prev;

      const newStats: Stats = {
        ...prev,
        seenTodayByDifficulty: {
          ...(prev.seenTodayByDifficulty ?? { easy: 0, medium: 0, hard: 0 }),
          [difficulty]: count,
        },
      };
      saveStats(newStats);
      return newStats;
    });
  }, [seenIdsToday.length, difficulty]);

  // Update stats when a puzzle is solved (only count once per puzzle)
  useEffect(() => {
    if (checkMessage !== "solved") return;
    if (isPuzzleMarkedSolved(difficulty, puzzleId)) return;

    // Mark puzzle as solved to prevent double counting
    markPuzzleSolved(difficulty, puzzleId);

    setStats((prev) => {
      // If it's a new day, reset solvedToday before incrementing
      const isNewDay = prev.lastSolvedDateISO !== todayISO;
      const baseSolvedToday = isNewDay ? 0 : prev.solvedToday;

      const newStats: Stats = {
        totalSolved: prev.totalSolved + 1,
        totalSolvedByDifficulty: {
          ...prev.totalSolvedByDifficulty,
          [difficulty]: prev.totalSolvedByDifficulty[difficulty] + 1,
        },
        solvedToday: baseSolvedToday + 1,
        lastSolvedDateISO: todayISO,
      };
      saveStats(newStats);
      return newStats;
    });
  }, [checkMessage, difficulty, puzzleId, todayISO]);

  useEffect(() => {
    const saved = loadProgress(storageKey, size);
    if (saved) {
      setPlayerGrid(saved.playerGrid);
      setUndoStack(saved.undoStack);
      setRedoStack(saved.redoStack);
    } else {
      setPlayerGrid(createEmptyGrid(size));
      setUndoStack([]);
      setRedoStack([]);
    }
    setCheckMessage(null);
    hasLoadedRef.current = true;
  }, [storageKey, size]);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    saveProgress(storageKey, playerGrid, undoStack, redoStack);
  }, [storageKey, playerGrid, undoStack, redoStack]);

  const { rowClues, colClues } = useMemo(
    () => computeCluesFromSolution(solution),
    [solution]
  );

  const handleGridChange = useCallback((nextGrid: Grid<CellValue>) => {
    setPlayerGrid((prevGrid) => {
      setUndoStack((prev) => [...prev, prevGrid]);
      setRedoStack([]);
      return nextGrid;
    });
    setCheckMessage(null);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const newUndoStack = [...undoStack];
    const previousGrid = newUndoStack.pop()!;
    setUndoStack(newUndoStack);
    setRedoStack((prev) => [...prev, playerGrid]);
    setPlayerGrid(previousGrid);
    setCheckMessage(null);
  }, [undoStack, playerGrid]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const newRedoStack = [...redoStack];
    const nextGrid = newRedoStack.pop()!;
    setRedoStack(newRedoStack);
    setUndoStack((prev) => [...prev, playerGrid]);
    setPlayerGrid(nextGrid);
    setCheckMessage(null);
  }, [redoStack, playerGrid]);

  const handleReset = useCallback(() => {
    setPlayerGrid(createEmptyGrid(size));
    setUndoStack([]);
    setRedoStack([]);
    setCheckMessage(null);
  }, [size]);

  const handleCheck = useCallback(() => {
    setCheckMessage(isSolved(playerGrid, solution) ? "solved" : "not-solved");
  }, [playerGrid, solution]);

  const handleDifficultyChange = useCallback(
    (newDifficulty: Difficulty) => {
      if (newDifficulty === difficulty) return;
      setDifficulty(newDifficulty);
    },
    [difficulty]
  );

  const isSolvedNow = checkMessage === "solved";

  // ✅ FIXED: a stable "New puzzle" handler that never gets stuck on "featured/current"
  // and properly resets when all puzzles are seen for the day.
  const handleNewPuzzle = useCallback(() => {
    if (pool.length === 0) return;

    const seenKey = makeDailySeenKey(difficulty, todayISO);

    // Always reload from storage to avoid rapid-click state races
    const loadedSeen = loadSeenIds(seenKey);
    const seenSet = new Set(loadedSeen);
    seenSet.add(puzzleId); // mark current as seen
    const seen = Array.from(seenSet);

    // Persist immediately (prevents repeats on rapid clicks)
    saveSeenIds(seenKey, seen);
    setSeenIdsToday(seen);

    const featured = getFeaturedPuzzle(difficulty, todayISO);

    // Find the next unseen puzzle
    let next = getNextPuzzleNoRepeat(difficulty, todayISO, seen, featured);

    // If everything is seen, reset the day-cycle and pick a fresh start
    if (seen.includes(next.id)) {
      clearSeenIds(seenKey);

      // fresh cycle: "no seen" yet for today
      const freshSeen: string[] = [];

      // Start from featured if it's fine; otherwise the helper will move forward
      next = getNextPuzzleNoRepeat(difficulty, todayISO, freshSeen, featured);

      // Mark the chosen start puzzle as seen
      saveSeenIds(seenKey, [next.id]);
      setSeenIdsToday([next.id]);
    }

    // Switch puzzle (let loadProgress effect handle grid state)
    setActivePuzzleId(next.id);
    setCheckMessage(null);
  }, [pool, difficulty, todayISO, puzzleId]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <h1 className={styles.siteTitle}>Online Nonogram</h1>
          <nav className={styles.nav} aria-label="Puzzle difficulty">
            <button
              className={`${styles.navButton} ${
                difficulty === "easy" ? styles.navButtonActive : ""
              }`}
              onClick={() => handleDifficultyChange("easy")}
              disabled={!hasEasy}
              aria-pressed={difficulty === "easy"}
              aria-label="Easy difficulty puzzles"
            >
              Easy
            </button>
            <button
              className={`${styles.navButton} ${
                difficulty === "medium" ? styles.navButtonActive : ""
              }`}
              onClick={() => handleDifficultyChange("medium")}
              disabled={!hasMedium}
              aria-pressed={difficulty === "medium"}
              aria-label="Medium difficulty puzzles"
            >
              Medium
            </button>
            <button
              className={`${styles.navButton} ${
                difficulty === "hard" ? styles.navButtonActive : ""
              }`}
              onClick={() => handleDifficultyChange("hard")}
              disabled={!hasHard}
              aria-pressed={difficulty === "hard"}
              aria-label="Hard difficulty puzzles"
            >
              Hard
            </button>
            <button
              className={styles.navButton}
              onClick={() => setStatsModalOpen(true)}
              aria-label="View statistics"
            >
              Stats
            </button>
            <button
              className={`${styles.calmModeToggle} ${
                calmMode ? styles.calmModeActive : ""
              }`}
              onClick={() => setCalmMode(!calmMode)}
              aria-pressed={calmMode}
              aria-label={`Calm mode is ${
                calmMode ? "on" : "off"
              }. Click to ${calmMode ? "show" : "hide"} advertisements.`}
            >
              Calm Mode: {calmMode ? "ON" : "OFF"}
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        {/* Left Column: Puzzle + Controls */}
        <div className={styles.puzzleColumn}>
          {/* Nonogram Board */}
          <div className={styles.puzzleArea}>
            <NonogramBoard
              size={size}
              value={playerGrid}
              onChange={handleGridChange}
              rowClues={rowClues}
              colClues={colClues}
            />
          </div>

          {/* Controls Row */}
          <div
            className={styles.controlsRow}
            role="toolbar"
            aria-label="Puzzle controls"
          >
            <button
              className={styles.controlButton}
              aria-label="Undo last action"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
            >
              Undo
            </button>
            <button
              className={styles.controlButton}
              aria-label="Redo last undone action"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
            >
              Redo
            </button>
            <button
              className={styles.controlButton}
              aria-label={
                isSolvedNow ? "Puzzle already solved" : "Check puzzle for errors"
              }
              onClick={handleCheck}
              disabled={isSolvedNow}
            >
              Check
            </button>
            <button
              className={styles.controlButton}
              aria-label="Reset puzzle to start"
              onClick={handleReset}
            >
              Reset
            </button>

            {/* IMPORTANT: New puzzle should NEVER be hidden/disabled when solved */}
            <button
              className={styles.controlButton}
              aria-label="Load a new puzzle"
              onClick={handleNewPuzzle}
              disabled={pool.length <= 1}
            >
              New puzzle
            </button>
          </div>

          {/* Puzzle info label */}
          <p className={styles.dailyMeta}>
            Featured {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} •{" "}
            {todayISO}
            {!isOnFeatured && <span> • You're on another puzzle</span>}
            {pool.length > 1 && (
              <span>
                {" "}
                •{" "}
                {remainingCount === 0
                  ? "All seen today"
                  : `${remainingCount} of ${pool.length} remaining`}
              </span>
            )}
          </p>

          {/* Check Result Message */}
          {checkMessage && (
            <p
              className={
                checkMessage === "solved"
                  ? styles.successMessage
                  : styles.errorMessage
              }
              role="status"
              aria-live="polite"
            >
              {checkMessage === "solved"
                ? "🎉 Congratulations! Puzzle solved!"
                : "Not solved yet. Keep trying!"}
            </p>
          )}
        </div>

        {/* Ad Container */}
        <aside className={styles.adContainer}>
          <div className={styles.adDesktopWrapper}>
            <AdSlot
              variant="desktop"
              show={!calmMode}
              slotId="nonogram-desktop-rail-1"
            />
          </div>
          <div className={styles.adMobileWrapper}>
            <AdSlot
              variant="mobile"
              show={!calmMode}
              slotId="nonogram-mobile-banner-1"
            />
          </div>
        </aside>
      </main>

      {/* Stats Modal */}
      <StatsModal
        open={statsModalOpen}
        stats={{
          totalSolved: stats.totalSolved,
          totalSolvedByDifficulty: stats.totalSolvedByDifficulty,
          solvedToday: stats.solvedToday,
          lastSolvedDateISO: stats.lastSolvedDateISO,
          seenTodayByDifficulty: stats.seenTodayByDifficulty,
        }}
        onClose={() => setStatsModalOpen(false)}
      />
    </div>
  );
}
