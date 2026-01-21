# Victory Modal Fix - Testing Guide

## Browser Setup

1. Open browser DevTools: `F12`
2. Go to **Application** → **LocalStorage** → `http://localhost:3000`
3. Keep DevTools open in split view to watch state changes

## Test Scenario 1: The Winning Moment ✅

**Goal:** Verify modal appears when user solves a puzzle during gameplay

### Steps:

1. **Start fresh**
   - Delete all localStorage entries for this difficulty
   - Reload page
   - Verify grid is empty
   - Verify no "✓ Solved" badge visible

2. **Play the puzzle**
   - Fill in ~10 cells correctly (any cells)
   - Verify modal doesn't appear with partial grid
   - Verify timer is running

3. **Complete the puzzle**
   - Fill in the LAST correct cell to complete the grid
   - **EXPECTED:** Victory modal pops up immediately ✓
   - **EXPECTED:** Modal shows puzzle name, time, difficulty
   - **EXPECTED:** Buttons: "Continue" and "Share Result"

4. **Verify localStorage**
   - Check localStorage for key `puzzle_easy_2026-01-20_*`
   - Look for field: `"status":"solved"`

5. **Close the modal**
   - Click "Continue" button
   - **EXPECTED:** Modal closes ✓
   - **EXPECTED:** "✓ Solved" badge now visible below date ✓
   - **EXPECTED:** Grid remains full ✓

### Pass Criteria:
- ✅ Modal shows exactly once on solve
- ✅ Puzzle name/time display correctly
- ✅ Status saved as 'solved'
- ✅ Solved badge visible after modal closes

---

## Test Scenario 2: The Revisit ✅

**Goal:** Verify modal does NOT appear when loading a pre-solved puzzle

### Steps:

1. **Start with solved puzzle from Scenario 1**
   - The puzzle should still be solved in localStorage
   - Verify "✓ Solved" badge is visible

2. **Hard refresh the page**
   - Press `Ctrl+Shift+R` (hard refresh, clears cache)
   - **EXPECTED:** Page reloads
   - **EXPECTED:** NO victory modal appears! ✗ (This was the bug)
   - **EXPECTED:** Grid loads as full/completed ✓
   - **EXPECTED:** "✓ Solved" badge is visible ✓

3. **Verify state restoration**
   - Open DevTools → localStorage
   - Find the puzzle key: `puzzle_easy_2026-01-20_*`
   - Check: `"status":"solved"` ✓

4. **Navigate away and back**
   - Switch to "Medium" difficulty
   - Switch back to "Easy"
   - **EXPECTED:** Still no modal popup ✓
   - **EXPECTED:** Solved badge still visible ✓

5. **Refresh page again**
   - Press `F5` (regular refresh)
   - **EXPECTED:** NO modal popup ✓
   - **EXPECTED:** Grid still full ✓
   - **EXPECTED:** Solved badge still visible ✓

### Pass Criteria:
- ✅ Modal never appears on page load/reload
- ✅ Modal never appears when switching difficulties
- ✅ Solved badge always visible when status is 'solved'
- ✅ Grid persists correctly

---

## Test Scenario 3: The Restart ✅

**Goal:** Verify restart clears everything and allows re-solving

### Steps:

1. **Start with solved puzzle from Scenario 2**
   - Verify grid is full
   - Verify "✓ Solved" badge visible

2. **Click the "Restart" button**
   - **EXPECTED:** Grid becomes completely empty ✓
   - **EXPECTED:** "✓ Solved" badge disappears ✓
   - **EXPECTED:** Victory modal closes (if was open) ✓
   - **EXPECTED:** Timer resets to 0:00 ✓

3. **Verify localStorage changed**
   - Check the same puzzle key: `puzzle_easy_2026-01-20_*`
   - Check field: `"status":"in_progress"` ✓ (changed from 'solved')
   - Check field: `"playerGrid"` should be all `null` values

4. **Re-solve the puzzle**
   - Fill in the same pattern as before
   - **EXPECTED:** Modal appears on final cell! ✓
   - **EXPECTED:** Stats increment (check Stats modal)

5. **Close modal again**
   - Click "Continue"
   - **EXPECTED:** "✓ Solved" badge visible again ✓

### Pass Criteria:
- ✅ Grid completely clears on restart
- ✅ Status changes back to 'in_progress'
- ✅ Badge disappears after restart
- ✅ Modal shows again on re-solve
- ✅ Stats update correctly

---

## Edge Case Tests

### Edge Case 1: Partial Solve → Restart → Resume

1. Solve ~5 cells
2. Reload page
3. **EXPECTED:** Those 5 cells are restored ✓
4. Click "Restart"
5. **EXPECTED:** Grid clears ✓
6. Reload page
7. **EXPECTED:** Grid is empty (restarted state saved) ✓
8. Complete the puzzle
9. **EXPECTED:** Modal shows ✓

### Edge Case 2: Switch Difficulty With Open Modal

1. Solve a puzzle (modal open)
2. Don't close the modal
3. Click "Medium" difficulty button
4. **EXPECTED:** Modal closes ✓
5. Medium puzzle loads
6. **EXPECTED:** NO modal showing ✓
7. **EXPECTED:** Can solve medium puzzle normally ✓

### Edge Case 3: Rapid Completions

1. Solve Easy puzzle (modal shows)
2. Close modal, switch to Medium without closing modal first
3. **EXPECTED:** Modal closes on difficulty change ✓
4. Solve Medium puzzle
5. **EXPECTED:** Medium modal shows ✓
6. Verify both puzzles saved as 'solved'

### Edge Case 4: Multiple Days

1. Play puzzle on January 20
2. Complete it (modal shows, save)
3. Change system date to January 21
4. **EXPECTED:** New puzzle loads ✓
5. **EXPECTED:** Grid is empty (different day) ✓
6. Complete January 21 puzzle
7. **EXPECTED:** Modal shows ✓
8. Change date back to January 20
9. **EXPECTED:** January 20 puzzle still shows as solved ✓
10. **EXPECTED:** NO modal on load ✓

---

## localStorage Key Reference

### Format:
```
puzzle_${difficulty}_${date}:v1
nonogram:solved:${difficulty}:${puzzleId}:v1
nonogram:stats:v1
nonogram:timer:${difficulty}:${date}:v1
```

### Example Keys (for Easy puzzle on 2026-01-20):
```
puzzle_easy_2026-01-20_easy-001_v1
nonogram:solved:easy:easy-001:v1
nonogram:stats:v1
nonogram:timer:easy:2026-01-20:v1
```

### What to Check:
```json
{
  "playerGrid": [[...], [...], ...],
  "undoStack": [],
  "redoStack": [],
  "timerSeconds": 123,
  "status": "solved" // ← KEY: This determines solved badge
}
```

---

## Visual Checklist

### Game States

**State 1: Fresh Puzzle (status: in_progress)**
```
═══════════════════════════════════════
  Easy Puzzle • 2026-01-20
  
  [Empty 5×5 grid]
  
  Timer: 0:00
═══════════════════════════════════════
```

**State 2: Solving (status: in_progress)**
```
═══════════════════════════════════════
  Easy Puzzle • 2026-01-20
  
  [Partially filled grid]
  
  Timer: 1:23
═══════════════════════════════════════
```

**State 3: Victory! (Modal open)**
```
┌─────────────────────────────────────┐
│  🎉 SOLVED! 🎉                       │
│                                     │
│  Easy Puzzle                        │
│  Time: 2:45                         │
│                                     │
│  [Continue] [Share Result]          │
└─────────────────────────────────────┘

Below modal:
═══════════════════════════════════════
  Easy Puzzle • 2026-01-20
  ✓ Solved
  
  [Full grid showing solution]
  
  Timer: 2:45 (paused)
═══════════════════════════════════════
```

**State 4: Solved + Revisit (No modal)**
```
═══════════════════════════════════════
  Easy Puzzle • 2026-01-20    ✓ Solved
  
  [Full grid showing solution]
  
  Timer: 2:45 (paused)
═══════════════════════════════════════
```

**State 5: After Restart (in_progress)**
```
═══════════════════════════════════════
  Easy Puzzle • 2026-01-20
  
  [Empty 5×5 grid]
  
  Timer: 0:00
═══════════════════════════════════════
```

---

## Common Issues and Solutions

### Issue 1: Modal appears on every page load
**Cause:** `hasShownVictoryModalRef` not being reset on load  
**Fix:** Check loading effect resets ref: `hasShownVictoryModalRef.current = false`  
**Verify:** Line ~423 in page.tsx

### Issue 2: Modal doesn't appear when solving
**Cause:** `hasShownVictoryModalRef` check is wrong  
**Fix:** Ensure condition is `if (!hasShownVictoryModalRef.current)` not `if (hasShownVictoryModalRef.current)`  
**Verify:** Line ~469 in page.tsx

### Issue 3: Solved badge doesn't show
**Cause:** `gameStatus` not being updated  
**Fix:** Check auto-check effect sets `setGameStatus('solved')`  
**Verify:** Line ~468 in page.tsx

### Issue 4: Restart doesn't clear modal
**Cause:** Modal not being closed in restart handler  
**Fix:** Add `setVictoryOpen(false)` to reset handler  
**Verify:** Line ~511 in page.tsx

### Issue 5: Stats not updating
**Cause:** Stats update only runs once per puzzle  
**Fix:** Check `markPuzzleSolved()` prevents double counting  
**Verify:** Line ~470 in page.tsx

---

## Console Commands for Testing

```javascript
// Check current game status
localStorage.getItem('puzzle_easy_2026-01-20_easy-001_v1')
// Output: {..., "status":"solved", ...}

// Clear all puzzles
Object.keys(localStorage).forEach(key => {
  if (key.startsWith('puzzle_')) localStorage.removeItem(key);
});

// Check all solved markers
Object.keys(localStorage).forEach(key => {
  if (key.startsWith('nonogram:solved:')) console.log(key);
});

// Get all game sessions
JSON.stringify(
  Object.keys(localStorage)
    .filter(k => k.startsWith('puzzle_'))
    .map(k => [k, JSON.parse(localStorage.getItem(k))]),
  null, 2
)
```

---

## Automated Test Cases (For QA)

```typescript
describe('Victory Modal Bug Fix', () => {
  
  test('Scenario 1: Shows modal on winning move', async () => {
    // Setup
    render(<Home />);
    await fillGridWithSolution();
    
    // Assert
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/SOLVED/)).toBeVisible();
  });

  test('Scenario 2: Does not show modal on page reload if already solved', async () => {
    // Setup: Save a solved game
    const solvedGrid = getSolvedGrid();
    localStorage.setItem('puzzle_easy_2026-01-20_*', 
      JSON.stringify({ 
        playerGrid: solvedGrid, 
        status: 'solved' 
      })
    );
    
    // Act: Reload
    render(<Home />);
    
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText(/✓ Solved/)).toBeVisible();
  });

  test('Scenario 3: Restart clears everything', async () => {
    // Setup: Solved game
    render(<Home with={solvedState} />);
    
    // Act
    fireEvent.click(screen.getByText(/Restart/));
    
    // Assert
    expect(screen.queryByText(/✓ Solved/)).not.toBeInTheDocument();
    expect(allGridCells()).toHaveLength(0);
  });
});
```

---

## Sign-Off

Once all three scenarios pass:
- ✅ Scenario 1: Winning Moment - Modal shows on solve
- ✅ Scenario 2: Revisit - No modal on page load, badge shows
- ✅ Scenario 3: Restart - Grid clears, modal hidden, can re-solve

**The bug is FIXED and ready for production.**

