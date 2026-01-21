"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import styles from "./page.module.css";
import AdSlot from "@/components/AdSlot";
import NonogramBoard from "@/components/NonogramBoard";
import StatsModal from "@/components/StatsModal";
import Timer from "@/components/Timer";
import VictoryModal from "@/components/VictoryModal";

// Sound effects
const playSound = (type: "row-complete-1" | "row-complete-2" | "victory") => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  if (type === "row-complete-1") {
    // Higher pitch beep
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } else if (type === "row-complete-2") {
    // Lower pitch beep
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.15);
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
  } else if (type === "victory") {
    // Victory chord
    const osc2 = audioContext.createOscillator();
    osc2.connect(gainNode);
    oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
    osc2.frequency.setValueAtTime(659.25, audioContext.currentTime); // E5
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
    oscillator.start(audioContext.currentTime);
    osc2.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.4);
    osc2.stop(audioContext.currentTime + 0.4);
  }
};
import { useLocalStorageBoolean } from "@/hooks/useLocalStorageBoolean";
import { usePersistentTimer } from "@/hooks/usePersistentTimer";
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
  getDailyPuzzle,
  makeDailySeenKey,
  PUZZLES,
} from "@/lib/nonogram";
import {
  loadGameSession,
  saveGameSession,
  getTodayISO,
  getStorageKey,
  cleanupOldGameData,
} from "@/lib/storageManager";

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
  const [showTimer, setShowTimer] = useLocalStorageBoolean("showTimer", true);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");

  // Apply dark mode based on calmMode
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (calmMode) {
      document.documentElement.classList.add("dark-mode");
    } else {
      document.documentElement.classList.remove("dark-mode");
    }
  }, [calmMode]);

  const hasEasy = PUZZLES.easy.length > 0;
  const hasMedium = PUZZLES.medium.length > 0;
  const hasHard = PUZZLES.hard.length > 0;

  // Track today's date (updates every 60s for midnight rollover)
  const [todayISO, setTodayISO] = useState(() => getLocalDateISO());

  // Cleanup old game data on app mount (remove sessions older than 30 days)
  useEffect(() => {
    cleanupOldGameData(30);
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const next = getLocalDateISO();
      setTodayISO((prev) => (prev === next ? prev : next));
    }, 60_000);
    return () => clearInterval(intervalId);
  }, []);

  // Get the daily puzzle for current difficulty and date
  const puzzle = useMemo(() => {
    try {
      return getDailyPuzzle(difficulty, todayISO);
    } catch {
      const fallback = PUZZLES.easy?.[0];
      if (!fallback) throw new Error("No puzzles available");
      return fallback;
    }
  }, [difficulty, todayISO]);

  const { size, id: puzzleId, solution, name: puzzleName } = puzzle;

  const storageKey = useMemo(() => {
    return `nonogram:${difficulty}:${todayISO}:${puzzleId}:v1`;
  }, [difficulty, todayISO, puzzleId]);

  // Use persistent timer hook with unique key per difficulty
  const timerKey = useMemo(() => {
    return `timer:${difficulty}:${todayISO}`;
  }, [difficulty, todayISO]);

  const timer = usePersistentTimer(timerKey);

  const [playerGrid, setPlayerGrid] = useState<Grid<CellValue>>(() =>
    createEmptyGrid(size)
  );
  const [undoStack, setUndoStack] = useState<Grid<CellValue>[]>([]);
  const [redoStack, setRedoStack] = useState<Grid<CellValue>[]>([]);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  const [victoryOpen, setVictoryOpen] = useState(false);

  // Track game status: 'in_progress' or 'solved' (persisted in localStorage)
  const [gameStatus, setGameStatus] = useState<'in_progress' | 'solved'>('in_progress');

  const hasMovedRef = useRef(false);

  const hasLoadedRef = useRef(false);

  // Track whether the victory modal has been shown in this session (NOT persisted)
  // This prevents auto-showing the modal on page reload
  const hasShownVictoryModalRef = useRef(false);

  // Track the previous game status to detect when puzzle becomes solved (not just loaded as solved)
  const prevGameStatusRef = useRef<'in_progress' | 'solved'>('in_progress');

  const [stats, setStats] = useState<Stats>(createDefaultStats);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

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

    if (needsSave) {
      saveStats(loaded);
    }
    setStats(loaded);
  }, [todayISO]);

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
    // Load saved progress with date awareness
    const saved = loadGameSession(difficulty, todayISO);
    if (saved) {
      setPlayerGrid(saved.grid);
      setUndoStack(saved.undoStack);
      setRedoStack(saved.redoStack);
      
      // Load the game status from localStorage (won or in_progress)
      // BUT do NOT open the victory modal on load
      const loadedStatus = saved.status === 'solved' ? 'solved' : 'in_progress';
      setGameStatus(loadedStatus);
      
      // Track the loaded status so auto-check knows this puzzle was already solved
      prevGameStatusRef.current = loadedStatus;
      
      console.log(`[Load] Puzzle ${puzzleId} loaded with status: ${loadedStatus}, prevGameStatusRef: ${prevGameStatusRef.current}`);
      
      setVictoryOpen(false); // Always start with modal closed on load
    } else {
      setPlayerGrid(createEmptyGrid(size));
      setUndoStack([]);
      setRedoStack([]);
      setGameStatus('in_progress');
      prevGameStatusRef.current = 'in_progress';
      
      console.log(`[Load] New puzzle ${puzzleId} created`);
      
      setVictoryOpen(false);
    }
    setCheckMessage(null);
    hasLoadedRef.current = true;
    // Reset the victory modal flag when loading a new puzzle
    hasShownVictoryModalRef.current = false;
  }, [storageKey, size, difficulty, todayISO]);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    saveGameSession(difficulty, todayISO, {
      grid: playerGrid,
      undoStack,
      redoStack,
      timerSeconds: timer.seconds,
      status: gameStatus, // Persist the game status
    });
  }, [difficulty, todayISO, playerGrid, undoStack, redoStack, gameStatus, timer.seconds]);

  // Auto-check: detect when puzzle is solved
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    
    const isPuzzleSolved = isSolved(playerGrid, solution);

    if (isPuzzleSolved) {
      // Pause timer
      timer.pause();

      // Only show the victory modal if:
      // 1. The puzzle status CHANGED from 'in_progress' to 'solved' (not loaded as solved)
      // 2. The modal hasn't been shown in this session yet
      console.log(`[Auto-check] Puzzle solved! prevGameStatus=${prevGameStatusRef.current}, hasShown=${hasShownVictoryModalRef.current}`);
      
      if (prevGameStatusRef.current === 'in_progress' && !hasShownVictoryModalRef.current) {
        console.log(`[Auto-check] SHOWING MODAL - status changed from in_progress to solved`);
        hasShownVictoryModalRef.current = true;
        setVictoryOpen(true);
        markPuzzleSolved(difficulty, puzzleId);

        // Update stats
        setStats((prev) => {
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
      } else {
        console.log(`[Auto-check] NOT showing modal - status was already solved or modal already shown`);
      }
      
      // Update the previous status tracker ONLY if it was in_progress
      // This prevents the modal from showing again on subsequent renders
      if (prevGameStatusRef.current === 'in_progress') {
        prevGameStatusRef.current = 'solved';
      }
      
      // Update game status
      setGameStatus('solved');
    }
    // NOTE: Do NOT update prevGameStatusRef in the else branch!
    // The load effect handles setting prevGameStatusRef correctly on puzzle load
    // Only update gameStatus for unsolved grids
    else {
      setGameStatus('in_progress');
    }
  }, [playerGrid, solution, difficulty, puzzleId, todayISO, timer]);

  const { rowClues, colClues } = useMemo(
    () => computeCluesFromSolution(solution),
    [solution]
  );

  const handleGridChange = useCallback((nextGrid: Grid<CellValue>) => {
    // Start timer on first move
    if (!hasMovedRef.current) {
      hasMovedRef.current = true;
      timer.play(); // Start the persistent timer
    }

    setPlayerGrid((prevGrid) => {
      setUndoStack((prev) => [...prev, prevGrid]);
      setRedoStack([]);
      return nextGrid;
    });
    setCheckMessage(null);
  }, [playerGrid, timer]);

  const handleRowComplete = useCallback((rowIndex: number) => {
    // Row completion detected (currently silent)
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
    // Clear the grid
    setPlayerGrid(createEmptyGrid(size));
    setUndoStack([]);
    setRedoStack([]);
    
    // Reset game status to in_progress
    setGameStatus('in_progress');
    prevGameStatusRef.current = 'in_progress';
    
    // Reset UI state
    setCheckMessage(null);
    setVictoryOpen(false);
    
    // Reset session flags
    hasMovedRef.current = false;
    hasShownVictoryModalRef.current = false; // Allow modal to show again if puzzle is re-solved
    
    // Reset timer
    timer.resetTimer();
  }, [size, timer]);

  const handleDifficultyChange = useCallback(
    (newDifficulty: Difficulty) => {
      if (newDifficulty === difficulty) return;
      // Pause timer when switching difficulties
      timer.pause();
      hasMovedRef.current = false; // Reset moved flag for new puzzle
      hasShownVictoryModalRef.current = false; // Reset victory modal flag for new puzzle
      // Close any open modals before switching
      setVictoryOpen(false);
      setDifficulty(newDifficulty);
    },
    [difficulty, timer]
  );

  const isSolvedNow = checkMessage === "solved";

  return (
    <div className={styles.container}>
      {/* Compact Mobile Header */}
      <header className={styles.header}>
        <div className={styles.headerTop}>
          {/* Left: Logo */}
          <h1 className={styles.siteTitleMobile}>Nonogram</h1>
          
          {/* Center: Timer */}
          {showTimer && (
            <div className={styles.headerTimer}>
              <Timer
                isRunning={timer.isRunning}
                seconds={timer.seconds}
              />
            </div>
          )}
          
          {/* Right: Settings Icon */}
          <button
            className={styles.settingsButton}
            onClick={() => setSettingsModalOpen(true)}
            aria-label="Open settings"
            title="Settings"
          >
            ⚙️
          </button>
        </div>

        {/* Difficulty Tabs */}
        <nav className={styles.headerNav} aria-label="Puzzle difficulty">
          <button
            className={`${styles.difficultyButton} ${
              difficulty === "easy" ? styles.difficultyButtonActive : ""
            }`}
            onClick={() => handleDifficultyChange("easy")}
            disabled={!hasEasy}
            aria-pressed={difficulty === "easy"}
          >
            Easy
          </button>
          <button
            className={`${styles.difficultyButton} ${
              difficulty === "medium" ? styles.difficultyButtonActive : ""
            }`}
            onClick={() => handleDifficultyChange("medium")}
            disabled={!hasMedium}
            aria-pressed={difficulty === "medium"}
          >
            Medium
          </button>
          <button
            className={`${styles.difficultyButton} ${
              difficulty === "hard" ? styles.difficultyButtonActive : ""
            }`}
            onClick={() => handleDifficultyChange("hard")}
            disabled={!hasHard}
            aria-pressed={difficulty === "hard"}
          >
            Hard
          </button>
        </nav>
      </header>

      {/* Settings Modal (Mobile Only) */}
      {settingsModalOpen && (
        <div className={styles.settingsModal}>
          <div className={styles.settingsModalContent}>
            <div className={styles.settingsModalHeader}>
              <h2>Settings</h2>
              <button
                className={styles.closeButton}
                onClick={() => setSettingsModalOpen(false)}
                aria-label="Close settings"
              >
                ✕
              </button>
            </div>

            <div className={styles.settingsModalBody}>
              {/* Dark Mode Toggle */}
              <div className={styles.settingsItem}>
                <label htmlFor="darkModeToggle">Dark Mode</label>
                <button
                  id="darkModeToggle"
                  className={`${styles.toggle} ${calmMode ? styles.toggleActive : ""}`}
                  onClick={() => setCalmMode(!calmMode)}
                  aria-pressed={calmMode}
                >
                  {calmMode ? "ON" : "OFF"}
                </button>
              </div>

              {/* Timer Toggle */}
              <div className={styles.settingsItem}>
                <label htmlFor="timerToggle">Timer</label>
                <button
                  id="timerToggle"
                  className={`${styles.toggle} ${showTimer ? styles.toggleActive : ""}`}
                  onClick={() => setShowTimer(!showTimer)}
                  aria-pressed={showTimer}
                >
                  {showTimer ? "ON" : "OFF"}
                </button>
              </div>

              {/* Stats Button */}
              <button
                className={styles.settingsButton2}
                onClick={() => {
                  setStatsModalOpen(true);
                  setSettingsModalOpen(false);
                }}
              >
                View Statistics
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={styles.main}>
        {/* Center Column: Puzzle + Controls */}
        <div className={styles.puzzleColumn}>
          {/* Nonogram Board */}
          <div className={styles.puzzleArea}>
            <NonogramBoard
              key={difficulty}
              size={size}
              value={playerGrid}
              onChange={handleGridChange}
              onRowComplete={handleRowComplete}
              rowClues={rowClues}
              colClues={colClues}
            />
          </div>

          {/* Puzzle Info + Controls Row - All in one line */}
          <div className={styles.bottomBar}>
            <p className={styles.dailyMeta}>
              {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Puzzle • {todayISO}
            </p>
            {gameStatus === 'solved' && (
              <span className={styles.solvedBadge}>✓ Solved</span>
            )}
            
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
                title="Undo (Ctrl+Z)"
              >
                ↶ Undo
              </button>
              <button
                className={styles.controlButton}
                aria-label="Restart puzzle"
                onClick={handleReset}
                title="Restart puzzle"
              >
                ⟲ Restart
              </button>
            </div>
          </div>

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

      <VictoryModal
        open={victoryOpen}
        puzzleName={puzzleName}
        time={timer.display}
        difficulty={difficulty}
        onClose={() => {
          // Save game state before closing modal
          saveGameSession(difficulty, todayISO, {
            grid: playerGrid,
            undoStack,
            redoStack,
            timerSeconds: timer.seconds,
            status: "solved",
          });
          setVictoryOpen(false);
        }}
        onNextPuzzle={() => {
          setVictoryOpen(false);
          setCheckMessage(null); // Clear victory message so it doesn't show again
        }}
      />
    </div>
  );
}
