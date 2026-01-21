# Corrected React Logic - Code Reference

## The Complete Refactored Solution

This document contains the key sections of corrected React code, extracted from the full implementation.

---

## 1. State Variables (Refactored)

```tsx
// ========== PERSISTENT STATE ==========
// Tracks whether the puzzle is won or in progress
// This is SAVED to localStorage via saveGameSession()
const [gameStatus, setGameStatus] = useState<'in_progress' | 'solved'>(
  'in_progress'
);

// ========== UI STATE (Session-only) ==========
// Controls modal visibility - NOT persisted
// Resets to false on every page load
const [victoryOpen, setVictoryOpen] = useState(false);

// ========== SESSION FLAGS ==========
// Tracks if the victory modal has been shown in THIS session
// NOT persisted (lost on page reload by design)
// Used with useRef to prevent re-renders while still tracking state
const hasShownVictoryModalRef = useRef(false);

// Tracks if the game grid has been loaded from storage
const hasLoadedRef = useRef(false);

// Tracks if user has made any move (to start timer)
const hasMovedRef = useRef(false);

// Other state...
const [playerGrid, setPlayerGrid] = useState<Grid<CellValue>>(() =>
  createEmptyGrid(size)
);
const [undoStack, setUndoStack] = useState<Grid<CellValue>[]>([]);
const [redoStack, setRedoStack] = useState<Grid<CellValue>[]>([]);
const [checkMessage, setCheckMessage] = useState<string | null>(null);
```

---

## 2. Loading Effect (The Critical Fix)

```tsx
// ============================================================
// LOAD GAME SESSION WITH PROPER STATE INITIALIZATION
// 
// This effect is responsible for:
// 1. Loading the saved grid from localStorage
// 2. Restoring the game status ('solved' or 'in_progress')
// 3. CRITICAL: Always closing the modal on load
// 4. Resetting the session flag to allow new victories
// ============================================================

useEffect(() => {
  // Load saved progress with date awareness
  const saved = loadGameSession(difficulty, todayISO);
  
  if (saved) {
    // Restore all saved state
    setPlayerGrid(saved.grid);
    setUndoStack(saved.undoStack);
    setRedoStack(saved.redoStack);
    
    // Load the game status from localStorage
    // This determines if the badge will show
    setGameStatus(saved.status === 'solved' ? 'solved' : 'in_progress');
    
    // *** CRITICAL FIX ***
    // Always explicitly close the modal, even if the game is solved
    // This prevents the modal from showing when page loads
    // Even though the grid is full (and isSolved would return true)
    setVictoryOpen(false);
  } else {
    // No saved game: start fresh
    setPlayerGrid(createEmptyGrid(size));
    setUndoStack([]);
    setRedoStack([]);
    setGameStatus('in_progress');
    setVictoryOpen(false);
  }
  
  // Clear any message
  setCheckMessage(null);
  
  // Mark that we've completed the load
  hasLoadedRef.current = true;
  
  // *** CRITICAL FIX ***
  // Reset the session flag when loading a new puzzle
  // This allows the victory modal to show if user solves it NOW
  // But prevents showing it just because the grid is loaded as full
  hasShownVictoryModalRef.current = false;
  
}, [storageKey, size, difficulty, todayISO]);
```

**Key Insights:**
- `setVictoryOpen(false)` is unconditional - it ALWAYS closes the modal
- `hasShownVictoryModalRef.current = false` resets the flag per load
- These two lines together prevent the re-appearing modal bug

---

## 3. Auto-Check Effect (The Core Logic)

```tsx
// ============================================================
// AUTO-CHECK: DETECT WHEN PUZZLE IS SOLVED
//
// This is the "smart" victory detector that:
// 1. Waits for initial load (Guard 1)
// 2. Checks if puzzle is actually solved (Guard 2)
// 3. Only shows modal once per session (Guard 3)
// 4. Always updates the persistent game status
// ============================================================

useEffect(() => {
  // ─────────────────────────────────────────────────────────
  // GUARD 1: Wait for initial data load
  // ─────────────────────────────────────────────────────────
  // Don't run during component mount or while loading data
  // This prevents the effect from triggering on the initial render
  if (!hasLoadedRef.current) return;
  
  // ─────────────────────────────────────────────────────────
  // Check the solved state once
  // ─────────────────────────────────────────────────────────
  const isPuzzleSolved = isSolved(playerGrid, solution);

  if (isPuzzleSolved) {
    // Pause the timer when puzzle is solved
    timer.pause();

    // ───────────────────────────────────────────────────────
    // Update persistent game status
    // This ALWAYS runs when puzzle is solved
    // It's separate from the modal show logic
    // ───────────────────────────────────────────────────────
    setGameStatus('solved');

    // ───────────────────────────────────────────────────────
    // GUARD 2 & 3: Show modal only once per session
    // ───────────────────────────────────────────────────────
    // Check if we've already shown the modal in THIS session
    // This ref survives state changes but resets on page load
    if (!hasShownVictoryModalRef.current) {
      // Mark that we've shown it (prevent duplicate shows)
      hasShownVictoryModalRef.current = true;
      
      // Show the modal for the first time
      setVictoryOpen(true);
      
      // Mark the puzzle as solved (for stats)
      markPuzzleSolved(difficulty, puzzleId);

      // Update the stats
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
    // Puzzle is NOT solved
    // Update game status to in_progress
    setGameStatus('in_progress');
  }
  
}, [playerGrid, solution, difficulty, puzzleId, todayISO, timer]);
```

**Three Guards Explained:**

1. **Guard 1: `if (!hasLoadedRef.current) return;`**
   - Prevents effect from running during initial mount
   - Loading effect sets `hasLoadedRef.current = true`
   - Subsequent effect runs are safe (data is loaded)

2. **Guard 2: `if (!isPuzzleSolved)`**
   - Only continues if puzzle is actually solved
   - Early return if grid doesn't match solution
   - Reduces unnecessary code execution

3. **Guard 3: `if (!hasShownVictoryModalRef.current)`**
   - Prevents duplicate victory modals in same session
   - Sets ref to `true` on first solve to block future runs
   - Ref is reset on page reload (new component instance)
   - Ref is reset in load effect (explicit reset)
   - Ref is reset in reset handler (allow re-solve)

---

## 4. Save Effect

```tsx
// ============================================================
// SAVE GAME SESSION WHENEVER STATE CHANGES
// ============================================================

useEffect(() => {
  // Don't save until we've loaded the game
  if (!hasLoadedRef.current) return;

  // Save the complete game state to localStorage
  saveGameSession(difficulty, todayISO, {
    grid: playerGrid,
    undoStack,
    redoStack,
    timerSeconds: timer.seconds,
    // IMPORTANT: Use gameStatus instead of deriving it
    // This ensures the status is always correct
    status: gameStatus,
  });
}, [difficulty, todayISO, playerGrid, undoStack, redoStack, gameStatus, timer.seconds]);
```

**Key Change:**
- `status: gameStatus` instead of `status: checkMessage === "solved" ? "solved" : "in_progress"`
- Ensures the persistent status is always accurate

---

## 5. Reset Handler (Complete Cleanup)

```tsx
// ============================================================
// RESET: CLEAR EVERYTHING FOR A FRESH SOLVE
// ============================================================

const handleReset = useCallback(() => {
  // ─────────────────────────────────────────────────────────
  // Clear the grid and undo/redo stacks
  // ─────────────────────────────────────────────────────────
  setPlayerGrid(createEmptyGrid(size));
  setUndoStack([]);
  setRedoStack([]);
  
  // ─────────────────────────────────────────────────────────
  // Reset persistent game status
  // ─────────────────────────────────────────────────────────
  setGameStatus('in_progress');
  
  // ─────────────────────────────────────────────────────────
  // Reset all UI state
  // ─────────────────────────────────────────────────────────
  setCheckMessage(null);
  setVictoryOpen(false);
  
  // ─────────────────────────────────────────────────────────
  // Reset all session flags
  // ─────────────────────────────────────────────────────────
  hasMovedRef.current = false;
  
  // IMPORTANT: Reset this so the victory modal can show again
  // if the user solves the puzzle a second time in this session
  hasShownVictoryModalRef.current = false;
  
  // ─────────────────────────────────────────────────────────
  // Reset timer
  // ─────────────────────────────────────────────────────────
  timer.resetTimer();
}, [size, timer]);
```

**Checklist:**
- ✅ Grid is completely empty
- ✅ Game status reset to 'in_progress'
- ✅ Modal is closed
- ✅ Badge will disappear (no status)
- ✅ Session flags reset (modal can show again)
- ✅ Timer is reset

---

## 6. Difficulty Change Handler

```tsx
// ============================================================
// CHANGE DIFFICULTY: SWITCH TO DIFFERENT PUZZLE
// ============================================================

const handleDifficultyChange = useCallback(
  (newDifficulty: Difficulty) => {
    // Don't switch if already on same difficulty
    if (newDifficulty === difficulty) return;
    
    // Pause current timer
    timer.pause();
    
    // Reset movement flag for new puzzle
    hasMovedRef.current = false;
    
    // Reset victory flag for new puzzle
    // This allows the new puzzle's victory to show modal
    hasShownVictoryModalRef.current = false;
    
    // Close any open modals before switching
    setVictoryOpen(false);
    
    // Switch to new difficulty (triggers puzzle load)
    setDifficulty(newDifficulty);
  },
  [difficulty, timer]
);
```

**Why Close Modal Here:**
- User might switch difficulty while victory modal is open
- Need to ensure modal is closed before showing new puzzle
- Prevents UI confusion

---

## 7. JSX: Puzzle Info with Solved Badge

```tsx
{/* Puzzle info label with solved badge */}
<div className={styles.puzzleInfoContainer}>
  <p className={styles.dailyMeta}>
    {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Puzzle • {todayISO}
  </p>
  
  {/* Conditional badge: Only show if game is solved */}
  {gameStatus === 'solved' && (
    <span className={styles.solvedBadge}>✓ Solved</span>
  )}
</div>
```

**Rendering Logic:**
- `gameStatus === 'in_progress'` → Badge hidden (CSS: not rendered)
- `gameStatus === 'solved'` → Badge visible (shows "✓ Solved")
- When modal closes, badge automatically appears (no additional code)

---

## 8. CSS: Solved Badge Styling

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

**Design Notes:**
- Subtle green color (not overwhelming)
- Small text (not intrusive)
- Rounded corners (matches design system)
- Responsive (wraps on mobile)
- Dark mode support (brighter green)

---

## Complete Effect Dependency Reference

### Loading Effect
```tsx
useEffect(() => { /* ... */ }, [storageKey, size, difficulty, todayISO]);
```
- Runs when puzzle changes or date changes
- Loads fresh state from storage
- Resets all session flags

### Save Effect
```tsx
useEffect(() => { /* ... */ }, [difficulty, todayISO, playerGrid, undoStack, redoStack, gameStatus, timer.seconds]);
```
- Runs whenever game state changes
- Persists to localStorage
- Only after initial load

### Auto-Check Effect
```tsx
useEffect(() => { /* ... */ }, [playerGrid, solution, difficulty, puzzleId, todayISO, timer]);
```
- Runs when grid changes or solution changes
- Detects victory condition
- Updates game status and modal visibility

### Dark Mode Effect
```tsx
useEffect(() => { /* ... */ }, [calmMode]);
```
- Runs when dark mode toggles
- Updates document class

---

## Common Patterns Used

### Pattern 1: Three-Layer Guards
```tsx
if (!loaded) return;           // Guard 1: data readiness
if (!condition) return;        // Guard 2: specific check
if (!flag) { /* action */ }    // Guard 3: one-time action
```

### Pattern 2: useRef for Session State
```tsx
const hasShownRef = useRef(false);
// Set to true to prevent future runs
hasShownRef.current = true;
// Reset on new session/load
hasShownRef.current = false;
```

### Pattern 3: Separate Persistent from Transient State
```tsx
// Persisted
const [persistedState, setPersistedState] = useState(...);

// Not persisted
const [uiState, setUiState] = useState(false);

// Session-only
const sessionRef = useRef(false);
```

### Pattern 4: Explicit State Closure
```tsx
// Don't rely on side effects, explicitly set initial state
useEffect(() => {
  setUIState(false); // ALWAYS set, not conditionally
  sessionRef.current = false; // ALWAYS reset
}, [dependencies]);
```

---

## Testing the Refactored Code

### Test Case 1: Fresh Solve
```typescript
test('shows victory modal on final cell placement', () => {
  // Grid: partial
  // User places final cell → grid: complete
  // Auto-check: isSolved? YES
  // hasShown? NO → Show modal ✓
  expect(victoryModal).toBeVisible();
});
```

### Test Case 2: Page Reload (Already Solved)
```typescript
test('does not show modal when loading solved puzzle', () => {
  // localStorage: status: 'solved', grid: full
  // Load effect: setVictoryOpen(false) ← Explicit close
  // Load effect: hasShownRef = false ← Reset
  // Auto-check: isSolved? YES, hasShown? NO
  // BUT modal was closed in load effect! ✓
  expect(victoryModal).not.toBeVisible();
  expect(solvedBadge).toBeVisible();
});
```

### Test Case 3: Restart then Re-Solve
```typescript
test('modal shows again after restart', () => {
  // Reset: grid empty, status in_progress, hasShown = false
  // User solves again
  // Auto-check: isSolved? YES, hasShown? NO
  // Show modal ✓
  expect(victoryModal).toBeVisible();
});
```

