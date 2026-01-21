# React Patterns Used in Victory Modal Fix

## Pattern 1: Persistent State vs. Session State

### When to Use
- When you have data that should survive page reloads (game progress) but UI state that shouldn't (modal visibility)

### Implementation
```tsx
// Persistent: Saved to localStorage automatically
const [gameStatus, setGameStatus] = useState<'solved' | 'in_progress'>('in_progress');

// Session-only: Lost on page reload (intended)
const [victoryOpen, setVictoryOpen] = useState(false);

// Session-only marker: Prevents duplicate actions
const hasShownVictoryModalRef = useRef(false);
```

### Why It Matters
- **gameStatus** is the source of truth (persisted via `saveGameSession`)
- **victoryOpen** is purely for rendering (reset on every page load)
- **hasShownVictoryModalRef** prevents the same victory from showing twice in one session

---

## Pattern 2: useRef for Session Flags

### When to Use
- Tracking whether an event has happened once per session
- Preventing duplicate side effects without creating new render cycles
- Session-only state that shouldn't trigger re-renders

### How It Differs from useState
```tsx
// useState: Changes trigger re-renders
const [hasShown, setHasShown] = useState(false);
// When you update: re-render happens
// All component code runs again
// Previous effects may re-run

// useRef: Changes don't trigger re-renders
const hasShownRef = useRef(false);
// When you update: NO re-render
// Subsequent code uses the updated value
// Perfect for one-time guards
```

### The Victory Modal Pattern
```tsx
const hasShownVictoryModalRef = useRef(false);

useEffect(() => {
  if (!hasShownVictoryModalRef.current && isSolved()) {
    hasShownVictoryModalRef.current = true; // ← No re-render triggered
    setVictoryOpen(true); // ← This causes ONE render
  }
}, [playerGrid]);
```

**Why this works:**
1. On first solve: ref is `false` → shows modal once → sets ref to `true`
2. If grid changes again: ref is `true` → guard prevents modal
3. On page reload: new ref instance with value `false` → could show again (but we prevent with load logic)

---

## Pattern 3: Effect Dependency Order Matters

### The Problem
```tsx
// This can trigger on load AND on solve
useEffect(() => {
  if (isSolved(playerGrid, solution)) {
    setVictoryOpen(true); // ← Triggers because playerGrid changed
  }
}, [playerGrid, solution]);
```

When you load a solved puzzle:
- `playerGrid` is set in the loading effect
- This effect re-runs immediately (because playerGrid changed)
- `isSolved()` returns true
- Modal opens unintentionally

### The Solution
```tsx
useEffect(() => {
  if (!hasLoadedRef.current) return; // ← Guard: only run after initial load
  
  if (isSolved(playerGrid, solution)) {
    if (!hasShownVictoryModalRef.current) { // ← Guard: only once per session
      hasShownVictoryModalRef.current = true;
      setVictoryOpen(true);
    }
  }
}, [playerGrid, solution]);
```

Now the effect is "safe":
1. First run during mount: `hasLoadedRef.current === false` → bails out
2. After load: `hasLoadedRef.current === true` → can run
3. If solved: `hasShownVictoryModalRef.current` prevents duplicate shows

---

## Pattern 4: Load-Time vs. Runtime State Management

### The Key Distinction
```tsx
// LOAD-TIME: What state should be restored from storage?
useEffect(() => {
  const saved = loadGameSession(difficulty, todayISO);
  if (saved) {
    setPlayerGrid(saved.grid);        // Restore grid
    setGameStatus(saved.status);      // Restore game status
    setVictoryOpen(false);            // ← CRITICAL: Don't restore modal state!
  }
  hasLoadedRef.current = true;
}, [storageKey]);

// RUNTIME: What happens during gameplay?
useEffect(() => {
  if (!hasLoadedRef.current) return; // ← Wait until load is complete
  
  if (isSolved(playerGrid, solution)) {
    if (!hasShownVictoryModalRef.current) {
      hasShownVictoryModalRef.current = true;
      setVictoryOpen(true); // ← Show modal ONLY if solved during gameplay
    }
  }
}, [playerGrid, solution]);
```

### The Philosophy
**Load-time:** Restore persistent data but reset transient state  
**Runtime:** Handle user interactions based on current session context

---

## Pattern 5: Reset Handler with Complete State Cleanup

### Bad Reset
```tsx
const handleReset = () => {
  setPlayerGrid(createEmptyGrid(size));
  // Forgot to reset hasShownVictoryModalRef
  // Forgot to reset victoryOpen
  // Forgot to reset gameStatus
};
```

Result: User clicks restart, modal doesn't show again if they re-solve.

### Good Reset
```tsx
const handleReset = useCallback(() => {
  // Persistent state
  setGameStatus('in_progress');
  
  // UI state
  setPlayerGrid(createEmptyGrid(size));
  setUndoStack([]);
  setRedoStack([]);
  setVictoryOpen(false);
  
  // Session flags
  hasMovedRef.current = false;
  hasShownVictoryModalRef.current = false;
  
  // Side effects
  timer.resetTimer();
}, [size, timer]);
```

**Checklist for Reset:**
- ✅ Clear game progress (grid, undo/redo)
- ✅ Reset game status to 'in_progress'
- ✅ Close any open modals
- ✅ Reset all session flags
- ✅ Reset timer/side effects

---

## Pattern 6: Conditional UI Based on Persistent State

### Implementation
```tsx
{gameStatus === 'solved' && (
  <span className={styles.solvedBadge}>✓ Solved</span>
)}
```

**Why This is Better Than Showing Modal:**
- Modal is intrusive (blocks interaction)
- Badge is informative (passive, non-blocking)
- User can choose to restart or move on
- Shows historical state without blocking gameplay

---

## Pattern 7: Effect Guards with Multiple Flags

```tsx
useEffect(() => {
  // Guard 1: Wait for initial data load
  if (!hasLoadedRef.current) return;
  
  // Guard 2: Only run on relevant changes
  const isPuzzleSolved = isSolved(playerGrid, solution);
  
  if (isPuzzleSolved) {
    // Guard 3: Prevent duplicate action in this session
    if (!hasShownVictoryModalRef.current) {
      hasShownVictoryModalRef.current = true;
      
      // Now it's safe to act
      setVictoryOpen(true);
    }
  }
}, [playerGrid, solution, difficulty, puzzleId, todayISO, timer]);
```

**Guard Hierarchy:**
1. **Guard 1 (hasLoadedRef):** Prevents action during initial mount
2. **Guard 2 (isPuzzleSolved):** Prevents action if puzzle isn't solved
3. **Guard 3 (hasShownVictoryModalRef):** Prevents duplicate action in session

This multi-layered approach is robust and prevents edge cases.

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Storing Modal State in localStorage
```tsx
// DON'T do this:
const [victoryOpen, setVictoryOpen] = useLocalStorageBoolean('victoryOpen', false);
```
Result: Modal pops up every time user loads the page.

### ❌ Mistake 2: Only Using useState for Victory Flag
```tsx
// DON'T do this:
const [hasShownVictory, setHasShownVictory] = useState(false);
```
Result: Every state change re-runs effects, can trigger modal multiple times.

### ❌ Mistake 3: Not Resetting Session Flags on Load
```tsx
// DON'T do this:
useEffect(() => {
  setPlayerGrid(saved.grid);
  // Forgot to reset hasShownVictoryModalRef
}, [storageKey]);
```
Result: Puzzle loaded from storage never shows victory modal.

### ❌ Mistake 4: Checking Solved State in Dependency Array
```tsx
// DON'T do this:
useEffect(() => {
  // ... victory logic
}, [isSolved(playerGrid, solution)]); // ← Calls function on every render!
```
Result: Effect runs constantly, can be inefficient.

Better:
```tsx
useEffect(() => {
  const isPuzzleSolved = isSolved(playerGrid, solution);
  // ... use isPuzzleSolved
}, [playerGrid, solution]); // ← Dependencies are stable values
```

---

## Performance Considerations

### Effect Optimization
```tsx
// Current optimization: three guards prevent unnecessary work
useEffect(() => {
  if (!hasLoadedRef.current) return;           // ← Skip if loading
  if (!isSolved(playerGrid, solution)) return; // ← Skip if not solved
  if (hasShownVictoryModalRef.current) return; // ← Skip if already shown
  
  // Only reach here when:
  // - Data is loaded
  // - Puzzle is solved
  // - Victory hasn't been shown yet
  
  // Safe to do expensive operations:
  setVictoryOpen(true);
  markPuzzleSolved(difficulty, puzzleId);
  updateStats();
}, [playerGrid, solution]);
```

### Memory Usage
- `useRef` doesn't cause re-renders (lighter than useState)
- Multiple `hasShownVictoryModalRef` booleans cost minimal memory
- Session flags are cleaned up automatically when component unmounts

---

## Testing These Patterns

### Unit Test Pattern
```tsx
describe('Victory Modal', () => {
  test('shows modal when solving puzzle', () => {
    // Render with empty grid
    // Complete the puzzle
    // Assert modal appears
  });
  
  test('does not show modal on revisit', () => {
    // Load a pre-solved game
    // Assert modal is not in DOM
    // Assert "Solved" badge is visible
  });
  
  test('resets properly', () => {
    // Load solved game
    // Click restart
    // Assert grid is empty
    // Assert "Solved" badge is gone
    // Assert modal would show on re-solve
  });
});
```

---

## Summary

| Pattern | Purpose | React Construct |
|---------|---------|-----------------|
| Persistent State | Data that survives reloads | `useState` + localStorage |
| Session State | UI that resets on reload | `useState` alone |
| Session Flags | One-time actions per session | `useRef` |
| Load Guards | Prevent actions before init | `useRef` + effect check |
| Modal Prevention | No duplicate victories | `useRef` + condition |
| Reset Handler | Complete state cleanup | `useCallback` with full scope |

