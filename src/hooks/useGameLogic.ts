import { useState, useCallback, useEffect, useRef } from "react";
import type { Grid, CellValue } from "@/lib/nonogram";
import { createEmptyGrid } from "@/lib/nonogram";

export interface GameLogicState {
  playerGrid: Grid<CellValue>;
  undoStack: Grid<CellValue>[];
  redoStack: Grid<CellValue>[];
  timerSeconds: number;
  timerRunning: boolean;
}

/**
 * Custom hook that manages game state (grid, undo/redo, timer) per difficulty.
 * All state is persisted to localStorage under a unique key (e.g., 'nonogram:easy:2024-01-19:puzzle-id:v1')
 * This prevents state leakage between difficulties.
 */
export function useGameLogic(
  storageKey: string,
  gridSize: number,
  onGridChange?: (grid: Grid<CellValue>) => void
) {
  const [playerGrid, setPlayerGrid] = useState<Grid<CellValue>>(() =>
    createEmptyGrid(gridSize)
  );
  const [undoStack, setUndoStack] = useState<Grid<CellValue>[]>([]);
  const [redoStack, setRedoStack] = useState<Grid<CellValue>[]>([]);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const hasLoadedRef = useRef(false);

  // Load game state from localStorage on mount
  useEffect(() => {
    if (hasLoadedRef.current) return;
    if (typeof window === "undefined") return;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.playerGrid && Array.isArray(parsed.playerGrid)) {
          setPlayerGrid(parsed.playerGrid);
        }
        if (parsed.undoStack && Array.isArray(parsed.undoStack)) {
          setUndoStack(parsed.undoStack);
        }
        if (parsed.redoStack && Array.isArray(parsed.redoStack)) {
          setRedoStack(parsed.redoStack);
        }
        if (typeof parsed.timerSeconds === "number") {
          setTimerSeconds(parsed.timerSeconds);
        }
        if (typeof parsed.timerRunning === "boolean") {
          setTimerRunning(parsed.timerRunning);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
    hasLoadedRef.current = true;
  }, [storageKey]);

  // Auto-save game state to localStorage whenever it changes
  useEffect(() => {
    if (!hasLoadedRef.current || typeof window === "undefined") return;

    try {
      const state = {
        playerGrid,
        undoStack,
        redoStack,
        timerSeconds,
        timerRunning,
      };
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // localStorage might be full or disabled
    }
  }, [playerGrid, undoStack, redoStack, timerSeconds, timerRunning, storageKey]);

  const handleGridChange = useCallback(
    (nextGrid: Grid<CellValue>) => {
      setPlayerGrid((prevGrid) => {
        setUndoStack((prev) => [...prev, prevGrid]);
        setRedoStack([]);
        return nextGrid;
      });
      onGridChange?.(nextGrid);
    },
    [onGridChange]
  );

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const newStack = [...prev];
      const previousGrid = newStack.pop()!;
      setRedoStack((redoPrev) => [...redoPrev, playerGrid]);
      setPlayerGrid(previousGrid);
      return newStack;
    });
  }, [playerGrid]);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const newStack = [...prev];
      const nextGrid = newStack.pop()!;
      setUndoStack((undoPrev) => [...undoPrev, playerGrid]);
      setPlayerGrid(nextGrid);
      return newStack;
    });
  }, [playerGrid]);

  const handleReset = useCallback(() => {
    // Wipe only this difficulty's state from localStorage
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignore localStorage errors
    }
    // Reset all state to initial values
    setPlayerGrid(createEmptyGrid(gridSize));
    setUndoStack([]);
    setRedoStack([]);
    setTimerSeconds(0);
    setTimerRunning(false);
  }, [storageKey, gridSize]);

  return {
    playerGrid,
    undoStack,
    redoStack,
    timerSeconds,
    timerRunning,
    setPlayerGrid,
    setTimerSeconds,
    setTimerRunning,
    handleGridChange,
    handleUndo,
    handleRedo,
    handleReset,
    hasLoaded: hasLoadedRef.current,
  };
}
