"use client";

import type React from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import type { Grid, CellValue } from "@/lib/nonogram";
import styles from "./NonogramBoard.module.css";

export interface NonogramBoardProps {
  /** Grid size (width and height) */
  size: number;
  /** Current player grid state */
  value: Grid<CellValue>;
  /** Called when the grid changes */
  onChange: (nextGrid: Grid<CellValue>, actionLabel?: string) => void;
  /** Called when a row is completed */
  onRowComplete?: (rowIndex: number) => void;
  /** Clues for each row */
  rowClues: number[][];
  /** Clues for each column */
  colClues: number[][];
  /** If true, disables all painting/interaction (default: false) */
  readOnly?: boolean;
}

type PaintMode = "fill" | "x" | null;
type MobileMode = "fill" | "x";

/**
 * Deep copy a grid.
 * TODO: For larger grids (10x10, 15x15), cloning on every cell enter
 * may cause lag. Consider a version counter approach instead:
 * store draft reference + bump a counter to trigger re-render
 * without full clone overhead.
 */
function cloneGrid(grid: Grid<CellValue>): Grid<CellValue> {
  return grid.map((row) => [...row]);
}

export default function NonogramBoard({
  size,
  value,
  onChange,
  onRowComplete,
  rowClues,
  colClues,
  readOnly = false,
}: NonogramBoardProps) {
  // Mobile mode toggle (Fill or X)
  const [mobileMode, setMobileMode] = useState<MobileMode>("fill");

  // Track window width for responsive cell sizing
  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );

  // Update window width on resize
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Calculate responsive cell size based on puzzle size and viewport width
  const calculateCellSize = (puzzleSize: number): string => {
    // Min and max cell sizes
    const minCell = 20;
    const maxCell = 120;

    // Base responsive calculation using viewport width
    // Smaller puzzles get bigger cells, larger puzzles get smaller cells
    let cellSize: number;

    if (puzzleSize === 5) {
      // 5x5: Use more of the viewport, scale with width
      cellSize = Math.max(minCell, Math.min(maxCell, windowWidth / 15));
    } else if (puzzleSize === 10) {
      // 10x10: Medium scaling
      cellSize = Math.max(minCell, Math.min(maxCell, windowWidth / 22));
    } else {
      // 15x15: Smallest cells to fit on screen, but still scale
      cellSize = Math.max(minCell, Math.min(maxCell, windowWidth / 45));
    }

    return `${Math.round(cellSize)}px`;
  };

  // Drag painting state
  const [paintMode, setPaintMode] = useState<PaintMode>(null);
  const [paintValue, setPaintValue] = useState<CellValue>(0);
  const isPainting = useRef(false);
  const isPaintingRef = useRef(false);

  // Keep both refs in sync
  const setPainting = useCallback((next: boolean) => {
    isPainting.current = next;
    isPaintingRef.current = next;
  }, []);

  // Check if a row is complete (all cells filled with correct value)
  const isRowComplete = useCallback(
    (grid: Grid<CellValue>, rowIndex: number): boolean => {
      return grid[rowIndex].every((cell) => cell === 1);
    },
    []
  );

  // Detect newly completed rows and trigger callbacks
  const checkRowCompletions = useCallback(
    (prevGrid: Grid<CellValue>, nextGrid: Grid<CellValue>) => {
      if (!onRowComplete) return;
      for (let i = 0; i < size; i++) {
        const wasComplete = isRowComplete(prevGrid, i);
        const isNowComplete = isRowComplete(nextGrid, i);
        if (!wasComplete && isNowComplete) {
          onRowComplete(i);
        }
      }
    },
    [size, onRowComplete, isRowComplete]
  );

  // Batched painting: draft grid and change tracking
  const draftGridRef = useRef<Grid<CellValue> | null>(null);
  const didChangeRef = useRef(false);

  // Preview state for UI during painting
  const [previewGrid, setPreviewGrid] = useState<Grid<CellValue> | null>(null);

  // Commit the draft grid to onChange
  const commitDraft = useCallback(() => {
    if (didChangeRef.current && draftGridRef.current) {
      checkRowCompletions(value, draftGridRef.current);
      onChange(draftGridRef.current, "Paint cells");
    }
    // Clean up
    draftGridRef.current = null;
    didChangeRef.current = false;
    setPreviewGrid(null);
  }, [onChange, checkRowCompletions, value]);

  // Stop painting helper (commit + reset all state)
  const stopPainting = useCallback(() => {
    if (isPaintingRef.current) {
      commitDraft();
    }
    setPainting(false);
    setPaintMode(null);
    setPaintValue(0);
  }, [commitDraft, setPainting]);

  // Clear preview and painting state when size changes (puzzle switch)
  const prevSizeRef = useRef(size);

  useEffect(() => {
    if (prevSizeRef.current === size) return;
    prevSizeRef.current = size;

    // If a puzzle switches mid-gesture, stop safely
    stopPainting();
    setPreviewGrid(null);
  }, [size, stopPainting]);

  // The grid to display: preview during painting, otherwise value
  // Ensure displayGrid dimensions match size to prevent render errors during puzzle switch
  const displayGrid =
    previewGrid && previewGrid.length === size && previewGrid[0]?.length === size
      ? previewGrid
      : value.length === size && value[0]?.length === size
        ? value
        : null;

  // Calculate max clue length for sizing (minimum 1 to avoid empty grid columns/rows)
  const maxRowClueLength = Math.max(1, ...rowClues.map((c) => c.length));
  const maxColClueLength = Math.max(1, ...colClues.map((c) => c.length));

  // Toggle cell value based on mode
  const toggleCell = useCallback(
    (grid: Grid<CellValue>, row: number, col: number, mode: "fill" | "x"): CellValue => {
      const current = grid[row][col];
      if (mode === "fill") {
        // Toggle between empty(0) and filled(1)
        return current === 1 ? 0 : 1;
      } else {
        // Toggle between empty(0) and X(2)
        return current === 2 ? 0 : 2;
      }
    },
    []
  );

  // Apply a value to the draft grid (mutates draft, updates preview)
  const applyToDraft = useCallback(
    (row: number, col: number, newValue: CellValue) => {
      const draft = draftGridRef.current;
      if (!draft) return;
      // Bounds check to prevent painting into wrong grid during puzzle switch
      if (row < 0 || col < 0 || row >= size || col >= size) return;
      if (draft[row]?.[col] === newValue) return;

      draft[row][col] = newValue;
      didChangeRef.current = true;
      // Update preview to trigger re-render
      setPreviewGrid(cloneGrid(draft));
    },
    [size]
  );

  // Handle mouse down on a cell
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, row: number, col: number) => {
      if (readOnly) return;
      e.preventDefault();

      const isRightClick = e.button === 2;
      const mode: "fill" | "x" = isRightClick ? "x" : "fill";

      // Initialize draft grid
      const draft = cloneGrid(value);
      draftGridRef.current = draft;
      didChangeRef.current = false;

      // Toggle the clicked cell
      const newValue = toggleCell(draft, row, col, mode);

      setPainting(true);
      setPaintMode(mode);
      // Drag painting always applies 1 (fill) or 2 (X)
      setPaintValue(mode === "fill" ? 1 : 2);

      // Apply to draft
      applyToDraft(row, col, newValue);
    },
    [readOnly, value, toggleCell, applyToDraft]
  );

  // Handle mouse enter during drag
  const handleMouseEnter = useCallback(
    (row: number, col: number) => {
      if (readOnly) return;
      if (!isPainting.current || paintMode === null) return;
      applyToDraft(row, col, paintValue);
    },
    [readOnly, paintMode, paintValue, applyToDraft]
  );

  // Handle mouse up (stop painting and commit)
  const handleMouseUp = useCallback(() => {
    stopPainting();
  }, [stopPainting]);

  // Handle touch/tap for mobile (uses mobileMode)
  const handleTouchStart = useCallback(
    (e: React.TouchEvent, row: number, col: number) => {
      if (readOnly) return;
      e.preventDefault();

      // Initialize draft grid
      const draft = cloneGrid(value);
      draftGridRef.current = draft;
      didChangeRef.current = false;

      // Toggle the touched cell
      const newValue = toggleCell(draft, row, col, mobileMode);

      setPainting(true);
      setPaintMode(mobileMode);
      // Drag painting always applies 1 (fill) or 2 (X)
      setPaintValue(mobileMode === "fill" ? 1 : 2);

      // Apply to draft
      applyToDraft(row, col, newValue);
    },
    [readOnly, value, mobileMode, toggleCell, applyToDraft]
  );

  // Handle touch move for drag painting on mobile
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (readOnly) return;
      if (!isPainting.current || paintMode === null) return;

      e.preventDefault();

      const touch = e.touches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
      const cellButton = el?.closest("button[data-row][data-col]") as HTMLButtonElement | null;
      if (!cellButton) return;

      const rowAttr = cellButton.dataset.row;
      const colAttr = cellButton.dataset.col;
      if (rowAttr == null || colAttr == null) return;

      const row = Number(rowAttr);
      const col = Number(colAttr);
      if (!Number.isInteger(row) || !Number.isInteger(col)) return;
      // Bounds check to prevent painting into wrong grid during puzzle switch
      if (row < 0 || col < 0 || row >= size || col >= size) return;

      applyToDraft(row, col, paintValue);
    },
    [readOnly, paintMode, paintValue, applyToDraft, size]
  );

  // Handle touch end (commit)
  const handleTouchEnd = useCallback(() => {
    stopPainting();
  }, [stopPainting]);

  // Attach global listeners while painting (catches mouse/touch up outside board)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!paintMode) return; // only when actively painting

    const onWinMouseUp = () => stopPainting();
    const onWinTouchEnd = () => stopPainting();
    const onWinTouchCancel = () => stopPainting();
    const onVisibility = () => stopPainting();
    const onBlur = () => stopPainting();

    window.addEventListener("mouseup", onWinMouseUp);
    window.addEventListener("touchend", onWinTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onWinTouchCancel, { passive: true });
    window.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("mouseup", onWinMouseUp);
      window.removeEventListener("touchend", onWinTouchEnd);
      window.removeEventListener("touchcancel", onWinTouchCancel);
      window.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [paintMode, stopPainting]);

  // Prevent context menu on right-click
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // Render cell content
  const renderCellContent = (cellValue: CellValue) => {
    if (cellValue === 1) {
      return <div className={styles.cellFilled} />;
    }
    if (cellValue === 2) {
      return <span className={styles.cellX}>×</span>;
    }
    return null;
  };

  // If grid dimensions don't match, don't render the board (transitioning between puzzles)
  if (!displayGrid) {
    return (
      <div className={styles.boardContainer}>
        <div className={styles.board} style={{ padding: "20px" }}>
          Loading...
        </div>
      </div>
    );
  }

  // Calculate total "cell units" the board needs (grid cells + clue bands)
  const cellCountX = size + maxRowClueLength;
  const cellCountY = size + maxColClueLength;

  return (
    <div
      className={styles.boardContainer}
      style={{
        "--cells-x": cellCountX,
        "--cells-y": cellCountY,
        "--n": size,
        "--rc": maxRowClueLength,
        "--cc": maxColClueLength,
        "--cell": calculateCellSize(size),
      } as React.CSSProperties}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onContextMenu={handleContextMenu}
    >
      {/* Mobile Mode Toggle */}
      <div className={styles.modeToggleRow}>
        <button
          className={`${styles.modeButton} ${mobileMode === "fill" ? styles.modeActive : ""}`}
          onClick={() => setMobileMode("fill")}
          aria-pressed={mobileMode === "fill"}
          aria-label="Fill mode: left click or tap to fill cells"
        >
          Fill Mode
        </button>
        <button
          className={`${styles.modeButton} ${mobileMode === "x" ? styles.modeActive : ""}`}
          onClick={() => setMobileMode("x")}
          aria-pressed={mobileMode === "x"}
          aria-label="X mode: left click or tap to mark cells with X"
        >
          X Mode
        </button>
      </div>

      {/* Board Scroll Wrapper */}
      <div className={styles.boardScroll}>
        <div className={styles.boardScrollInner}>
          {/* Board Grid with Clues */}
          <div
            className={styles.board}
            onContextMenu={handleContextMenu}
            style={{
              gridTemplateColumns: `repeat(var(--rc), var(--clue)) repeat(var(--n), var(--cell))`,
              gridTemplateRows: `repeat(var(--cc), var(--clue)) repeat(var(--n), var(--cell))`,
            }}
          >
            {/* Empty corner (top-left) */}
            <div
              className={styles.cornerSpace}
              style={{
                gridColumn: `1 / ${maxRowClueLength + 1}`,
                gridRow: `1 / ${maxColClueLength + 1}`,
              }}
            />

        {/* Column Clues (above grid) */}
        {colClues.map((clues, colIndex) => (
          <div
            key={`col-clue-${colIndex}`}
            className={styles.colClueCell}
            style={{
              gridColumn: maxRowClueLength + 1 + colIndex,
              gridRow: `1 / ${maxColClueLength + 1}`,
            }}
          >
            {clues.map((clue, i) => (
              <span key={i} className={styles.clueNumber}>
                {clue}
              </span>
            ))}
          </div>
        ))}

        {/* Row Clues (left of grid) */}
        {rowClues.map((clues, rowIndex) => (
          <div
            key={`row-clue-${rowIndex}`}
            className={styles.rowClueCell}
            style={{
              gridColumn: `1 / ${maxRowClueLength + 1}`,
              gridRow: maxColClueLength + 1 + rowIndex,
            }}
          >
            {clues.map((clue, i) => (
              <span key={i} className={styles.clueNumber}>
                {clue}
              </span>
            ))}
          </div>
        ))}

        {/* Grid Cells */}
        {Array.from({ length: size }, (_, row) =>
          Array.from({ length: size }, (_, col) => (
            <button
              key={`cell-${row}-${col}`}
              className={`${styles.cell}${readOnly ? " " + styles.cellReadOnly : ""}`}
              style={{
                gridColumn: maxRowClueLength + 1 + col,
                gridRow: maxColClueLength + 1 + row,
              }}
              data-row={row}
              data-col={col}
              disabled={readOnly}
              onMouseDown={(e) => handleMouseDown(e, row, col)}
              onMouseEnter={() => handleMouseEnter(row, col)}
              onMouseUp={handleMouseUp}
              onContextMenu={handleContextMenu}
              onTouchStart={(e) => handleTouchStart(e, row, col)}
              aria-label={`Cell row ${row + 1}, column ${col + 1}, ${
                displayGrid[row][col] === 0
                  ? "empty"
                  : displayGrid[row][col] === 1
                    ? "filled"
                    : "marked X"
              }`}
            >
              {renderCellContent(displayGrid[row][col])}
            </button>
          ))
        )}
          </div>
        </div>
      </div>
    </div>
  );
}
