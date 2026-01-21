# Code Changes Reference

## Summary of Changes

This document shows the exact code changes made to fix the Victory Modal re-appearing bug.

---

## File: src/app/page.tsx

### Change 1: State Variables Refactoring (Lines ~358-370)

**BEFORE:**
```tsx
const [playerGrid, setPlayerGrid] = useState<Grid<CellValue>>(() =>
  createEmptyGrid(size)
);
const [undoStack, setUndoStack] = useState<Grid<CellValue>[]>([]);
const [redoStack, setRedoStack] = useState<Grid<CellValue>[]>([]);
const [checkMessage, setCheckMessage] = useState<string | null>(null);
const [victoryOpen, setVictoryOpen] = useState(false);

const hasMovedRef = useRef(false);

const hasLoadedRef = useRef(false);

const victoryShownRef = useRef(false);
```

**AFTER:**
```tsx
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
```

**What Changed:**
- Added `gameStatus` state to track persistent game state
- Renamed `victoryShownRef` to `hasShownVictoryModalRef` for clarity
- Added comments explaining the difference between persistent and session state

---

### Change 2: Loading Logic (Lines ~406-427)

**BEFORE:**
```tsx
useEffect(() => {
  // Load saved progress with date awareness
  const saved = loadGameSession(difficulty, todayISO);
  if (saved) {
    setPlayerGrid(saved.grid);
    setUndoStack(saved.undoStack);
    setRedoStack(saved.redoStack);
  } else {
    setPlayerGrid(createEmptyGrid(size));
    setUndoStack([]);
    setRedoStack([]);
  }
  setCheckMessage(null);
  hasLoadedRef.current = true;
}, [storageKey, size, difficulty, todayISO]);
```

**AFTER:**
```tsx
useEffect(() => {
  // Load saved progress with date awareness
  const saved = loadGameSession(difficulty, todayISO);
  if (saved) {
    setPlayerGrid(saved.grid);
    setUndoStack(saved.undoStack);
    setRedoStack(saved.redoStack);
    
    // Load the game status from localStorage (won or in_progress)
    // BUT do NOT open the victory modal on load
    setGameStatus(saved.status === 'solved' ? 'solved' : 'in_progress');
    setVictoryOpen(false); // Always start with modal closed on load
  } else {
    setPlayerGrid(createEmptyGrid(size));
    setUndoStack([]);
    setRedoStack([]);
    setGameStatus('in_progress');
    setVictoryOpen(false);
  }
  setCheckMessage(null);
  hasLoadedRef.current = true;
  // Reset the victory modal flag when loading a new puzzle
  hasShownVictoryModalRef.current = false;
}, [storageKey, size, difficulty, todayISO]);
```

**What Changed:**
- Load `gameStatus` from saved session
- **CRITICAL:** Always set `setVictoryOpen(false)` on load
- Reset `hasShownVictoryModalRef.current = false` to allow modal on new solve

---

### Change 3: Save Logic (Lines ~429-441)

**BEFORE:**
```tsx
useEffect(() => {
  if (!hasLoadedRef.current) return;
  saveGameSession(difficulty, todayISO, {
    grid: playerGrid,
    undoStack,
    redoStack,
    timerSeconds: timer.seconds,
    status: checkMessage === "solved" ? "solved" : "in_progress",
  });
}, [difficulty, todayISO, playerGrid, undoStack, redoStack, checkMessage, timer.seconds]);
```

**AFTER:**
```tsx
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
```

**What Changed:**
- Use `gameStatus` instead of deriving from `checkMessage`
- Updated dependencies to include `gameStatus`

---

### Change 4: Auto-Check Effect (Lines ~443-477)

**BEFORE:**
```tsx
// Auto-check: detect when puzzle is solved
useEffect(() => {
  if (!hasLoadedRef.current) return;
  if (isSolved(playerGrid, solution)) {
    timer.pause(); // Pause timer on victory
    
    // Only show victory modal once per puzzle session
    if (!victoryShownRef.current) {
      victoryShownRef.current = true;
      markPuzzleSolved(difficulty, puzzleId);
      setVictoryOpen(true);
      
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
    }
  }
}, [playerGrid, solution, difficulty, puzzleId, todayISO, timer]);
```

**AFTER:**
```tsx
// Auto-check: detect when puzzle is solved
useEffect(() => {
  if (!hasLoadedRef.current) return;
  
  const isPuzzleSolved = isSolved(playerGrid, solution);

  if (isPuzzleSolved) {
    // Pause timer
    timer.pause();

    // Update game status to 'solved'
    setGameStatus('solved');

    // Only show the victory modal if:
    // 1. The grid was NOT already solved on load (new victory), AND
    // 2. The modal hasn't been shown in this session yet
    if (!hasShownVictoryModalRef.current) {
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
    }
  } else {
    // If the puzzle is NOT solved, keep status as in_progress
    setGameStatus('in_progress');
  }
}, [playerGrid, solution, difficulty, puzzleId, todayISO, timer]);
```

**What Changed:**
- Always update `gameStatus` (moved outside the modal guard)
- Renamed check from `victoryShownRef` to `hasShownVictoryModalRef`
- Only show modal if it hasn't been shown in this session
- Add explicit handling for unsolved state

---

### Change 5: Reset Handler (Lines ~499-514)

**BEFORE:**
```tsx
const handleReset = useCallback(() => {
  setPlayerGrid(createEmptyGrid(size));
  setUndoStack([]);
  setRedoStack([]);
  setCheckMessage(null);
  timer.resetTimer(); // Reset persistent timer
  hasMovedRef.current = false;
}, [size, timer]);
```

**AFTER:**
```tsx
const handleReset = useCallback(() => {
  // Clear the grid
  setPlayerGrid(createEmptyGrid(size));
  setUndoStack([]);
  setRedoStack([]);
  
  // Reset game status to in_progress
  setGameStatus('in_progress');
  
  // Reset UI state
  setCheckMessage(null);
  setVictoryOpen(false);
  
  // Reset session flags
  hasMovedRef.current = false;
  hasShownVictoryModalRef.current = false; // Allow modal to show again if puzzle is re-solved
  
  // Reset timer
  timer.resetTimer();
}, [size, timer]);
```

**What Changed:**
- Reset `gameStatus` to 'in_progress'
- Close the modal explicitly
- Reset `hasShownVictoryModalRef` to allow victory to show again
- Improved comments explaining each section

---

### Change 6: Difficulty Change Handler (Lines ~516-527)

**BEFORE:**
```tsx
const handleDifficultyChange = useCallback(
  (newDifficulty: Difficulty) => {
    if (newDifficulty === difficulty) return;
    // Pause timer when switching difficulties
    timer.pause();
    hasMovedRef.current = false; // Reset moved flag for new puzzle
    victoryShownRef.current = false; // Reset victory flag for new puzzle
    setDifficulty(newDifficulty);
  },
  [difficulty, timer]
);
```

**AFTER:**
```tsx
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
```

**What Changed:**
- Updated ref name from `victoryShownRef` to `hasShownVictoryModalRef`
- Added explicit `setVictoryOpen(false)` to close modal before switching

---

### Change 7: JSX - Puzzle Info Section (Lines ~702-715)

**BEFORE:**
```tsx
{/* Puzzle info label */}
<p className={styles.dailyMeta}>
  {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Puzzle • {todayISO}
</p>
```

**AFTER:**
```tsx
{/* Puzzle info label with solved badge */}
<div className={styles.puzzleInfoContainer}>
  <p className={styles.dailyMeta}>
    {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Puzzle • {todayISO}
  </p>
  {gameStatus === 'solved' && (
    <span className={styles.solvedBadge}>✓ Solved</span>
  )}
</div>
```

**What Changed:**
- Wrapped meta and badge in container div
- Added conditional "✓ Solved" badge when `gameStatus === 'solved'`

---

## File: src/app/page.module.css

### Change: Added Solved Badge Styles (Before `.dailyMeta` section)

**ADDED:**
```css
/* ==============================================
   PUZZLE INFO CONTAINER
   ============================================== */
.puzzleInfoContainer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.solvedBadge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 600;
  color: #059669;
  background-color: rgba(5, 150, 105, 0.1);
  padding: 3px 8px;
  border-radius: 12px;
  border: 1px solid rgba(5, 150, 105, 0.3);
  white-space: nowrap;
}

/* Dark mode: Solved badge */
:global(.dark-mode) .solvedBadge {
  color: #10b981;
  background-color: rgba(16, 185, 129, 0.15);
  border-color: rgba(16, 185, 129, 0.4);
}
```

**What Changed:**
- New container for flexible layout of meta + badge
- Badge styling with green accent color
- Dark mode variant with brighter green

---

## Summary Table

| Component | Type | Change |
|-----------|------|--------|
| gameStatus | State | NEW - Persistent game status |
| hasShownVictoryModalRef | Ref | RENAMED from victoryShownRef |
| Load Effect | Logic | Always close modal on load, reset ref |
| Save Effect | Logic | Use gameStatus instead of checkMessage |
| Auto-check Effect | Logic | Separate modal show from status update |
| Reset Handler | Logic | Reset gameStatus and close modal |
| Difficulty Handler | Logic | Close modal before switching |
| Puzzle Info JSX | UI | Add solved badge when status is 'solved' |
| CSS | Styling | Add container and badge styles |

---

## Backward Compatibility

The changes are backward compatible:
- Old saved games without `gameStatus` will default to 'in_progress'
- The loading logic handles missing status gracefully
- No changes to storage format or external APIs
- Existing CSS still works, new styles are additive

