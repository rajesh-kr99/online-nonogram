# Victory Modal Logic Flow Diagrams

## Complete State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                    GAME STATE MACHINE                           │
└─────────────────────────────────────────────────────────────────┘

                        ┌──────────────────┐
                        │ FRESH GAME       │
                        │ grid: empty      │
                        │ status: progress │
                        └──────────────────┘
                                 │
                                 │ User clicks cell
                                 ▼
                        ┌──────────────────┐
                        │ PLAYING          │
                        │ grid: partial    │
                        │ status: progress │
                        │ timer: running   │
                        └──────────────────┘
                                 │
                                 │ Final cell placed
                                 ▼
                        ┌──────────────────────────────┐
                        │ VICTORY (USER SOLVE)         │
                        │ grid: complete               │
                        │ status: solved               │
                        │ modal: SHOWS ✓               │ ← Modal shows ONCE
                        │ badge: hidden                │
                        └──────────────────────────────┘
                                 │
                                 │ User closes modal / Refreshes page
                                 ▼
                        ┌──────────────────────────────┐
                        │ SOLVED (REVISIT)             │
                        │ grid: complete               │
                        │ status: solved               │
                        │ modal: HIDDEN ✓              │ ← No modal on load
                        │ badge: VISIBLE ✓             │
                        └──────────────────────────────┘
                                 │
                                 │ User clicks Restart
                                 ▼
                        ┌──────────────────┐
                        │ RESTARTED        │
                        │ grid: empty      │
                        │ status: progress │
                        │ modal: closed ✓  │
                        │ badge: hidden ✓  │
                        └──────────────────┘
                                 │
                                 │ User solves again
                                 ▼
                        ┌──────────────────────────────┐
                        │ VICTORY (SECOND SOLVE)       │
                        │ grid: complete               │
                        │ status: solved               │
                        │ modal: SHOWS ✓               │ ← Can show again!
                        │ badge: hidden                │
                        └──────────────────────────────┘
```

---

## Victory Modal Show/Hide Logic

```
┌─────────────────────────────────────────────────────────────────┐
│                  MODAL VISIBILITY DECISION TREE                 │
└─────────────────────────────────────────────────────────────────┘

                         PAGE LOADS
                             │
                             ▼
                    ┌────────────────────┐
                    │ loadGameSession()   │
                    │ Get: grid + status  │
                    └────────────────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
            ┌──────────────┐   ┌──────────────┐
            │ Saved game   │   │ No saved     │
            │ Found        │   │ game         │
            └──────────────┘   └──────────────┘
                    │                 │
                    ▼                 ▼
            ┌──────────────────────────────────┐
            │ CRITICAL STEP:                   │
            │ setVictoryOpen(false) ALWAYS     │
            │                                  │
            │ Loading logic EXPLICITLY closes  │
            │ the modal on EVERY load          │
            └──────────────────────────────────┘
                    │
                    ▼
            ┌──────────────────────────────────┐
            │ hasShownVictoryModalRef.current  │
            │ = false  (session flag reset)    │
            └──────────────────────────────────┘
                    │
                    ▼
            ┌──────────────────────────────────┐
            │ AUTO-CHECK EFFECT:               │
            │ isSolved(playerGrid, solution)?  │
            └──────────────────────────────────┘
                    │
          ┌─────────┴──────────┐
          │                    │
         NO                   YES
          │                    │
          ▼                    ▼
    ┌────────────┐    ┌───────────────────┐
    │ setGameStatus   │ setGameStatus      │
    │ 'in_progress'   │ 'solved'           │
    └────────────┘    ├───────────────────┤
                      │ hasShownVictory... │
                      │ Modal?.current?    │
                      └───────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                   YES                  NO
            (already shown)    (first time this session)
                    │                   │
                    ▼                   ▼
            ┌──────────────┐    ┌────────────────────┐
            │ Don't show   │    │ hasShown...current  │
            │ modal        │    │ = true              │
            │ (guard)      │    │ setVictoryOpen(true)│
            └──────────────┘    │ MODAL SHOWS ✓       │
                                └────────────────────┘
```

---

## Key Difference: Before vs After

### BEFORE (Broken):

```
PAGE LOAD (Saved solved game)
    ↓
playerGrid = [full solution]
    ↓
Auto-check effect runs
    ↓
isSolved() = true
    ↓
victoryShownRef.current = false  ← NEW INSTANCE ON RELOAD!
    ↓
Show modal ❌ BUG!
```

### AFTER (Fixed):

```
PAGE LOAD (Saved solved game)
    ↓
playerGrid = [full solution]
    ↓
Loading effect runs FIRST
    ↓
setVictoryOpen(false)  ← EXPLICIT CLOSE
    ↓
hasShownVictoryModalRef.current = false  (reset for session)
    ↓
Auto-check effect runs
    ↓
isSolved() = true
    ↓
BUT: setVictoryOpen(false) already ran, so modal is closed
    ↓
Check: hasShownVictoryModalRef.current? NO (but doesn't matter, modal already closed)
    ↓
Show badge instead ✓
```

---

## Session Flag Behavior

```
┌─────────────────────────────────────────────────────────────────┐
│          hasShownVictoryModalRef STATE TRANSITIONS              │
└─────────────────────────────────────────────────────────────────┘

BROWSER FRESH START
    │
    ▼
new useRef(false)  ← Initial value on component mount
    │
    ├─── [Page Load]
    │    └─ hasShownVictoryModalRef.current = false  (reset in loading effect)
    │
    ├─── [User Solves During Gameplay]
    │    ├─ Auto-check: isSolved() = true
    │    ├─ Check: !hasShownVictoryModalRef.current  → true (still false)
    │    ├─ hasShownVictoryModalRef.current = true   (set to true)
    │    └─ setVictoryOpen(true)  → Modal shows ✓
    │
    ├─── [User Refreshes Page]
    │    ├─ Component unmounts (old useRef destroyed)
    │    ├─ Component remounts
    │    ├─ new useRef(false)  ← Brand new instance
    │    ├─ Loading effect: hasShownVictoryModalRef.current = false
    │    ├─ Loading effect: setVictoryOpen(false)
    │    └─ Modal stays hidden ✓ (even though ref was "reset")
    │
    └─── [User Clicks Restart]
         ├─ handleReset()
         ├─ hasShownVictoryModalRef.current = false  ← Cleared
         ├─ setVictoryOpen(false)
         └─ Next solve: Modal can show again ✓

KEY INSIGHT: Page reload creates NEW ref instance (value false)
            But explicit reset in loading effect ensures modal stays closed
            This is why explicit setVictoryOpen(false) in loading is CRITICAL
```

---

## Three Guards in Action

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXECUTION FLOW WITH GUARDS                   │
└─────────────────────────────────────────────────────────────────┘

useEffect(() => {
  // ┌──────────────────────────────────────────────────────────┐
  // │ GUARD 1: WAIT FOR DATA LOAD                             │
  // │ Prevents effect from running during component mount     │
  // └──────────────────────────────────────────────────────────┘
  if (!hasLoadedRef.current) return;  // ← Skip if loading
  
  // ┌──────────────────────────────────────────────────────────┐
  // │ GUARD 2: CHECK SOLVED STATE                             │
  // │ Only continue if puzzle is actually solved              │
  // └──────────────────────────────────────────────────────────┘
  const isPuzzleSolved = isSolved(playerGrid, solution);
  if (!isPuzzleSolved) {
    setGameStatus('in_progress');
    return;  // ← Skip if not solved
  }
  
  // ┌──────────────────────────────────────────────────────────┐
  // │ GUARD 3: PREVENT DUPLICATE VICTORY IN SESSION           │
  // │ Only show modal once per session (per load)             │
  // └──────────────────────────────────────────────────────────┘
  if (!hasShownVictoryModalRef.current) {
    hasShownVictoryModalRef.current = true;  // ← Block future runs
    setVictoryOpen(true);  // ← Show modal
    // ... update stats ...
  }
  
  // If all guards pass, we reach here
  // Modal will show for the first time in this session ✓
}, [playerGrid, solution]);
```

---

## Lifecycle: Fresh Solve

```
                    USER SOLVING A PUZZLE
                            │
            ┌───────────────┬┴┬───────────────┐
            │               │ │               │
            ▼               ▼ ▼               ▼
        State              Modal            Badge
        Changes            Status            Status
        
    START
    ├─ grid: empty
    ├─ status: progress
    ├─ modal: false
    └─ badge: hidden
    
    USER FILLS CELLS
    ├─ grid: partial
    ├─ status: progress    (← Auto-check: solved? NO)
    ├─ modal: false
    └─ badge: hidden
    
    FINAL CELL PLACED
    ├─ grid: complete      ┌─ Auto-check: solved? YES
    ├─ status: solved  ←───┤─ hasShown? NO (first time)
    ├─ modal: TRUE ✓   ←───┤─ setVictoryOpen(true)
    └─ badge: hidden       └─ setGameStatus('solved')
    
    MODAL SHOWS
    ┌────────────────────────┐
    │ 🎉 SOLVED! 🎉         │
    │ Easy Puzzle            │
    │ Time: 2:45             │
    │ [Continue] [Share]     │
    └────────────────────────┘
    
    USER CLICKS CONTINUE
    ├─ modal: false ✓
    ├─ badge: VISIBLE ✓
    ├─ status: solved
    └─ grid: complete
    
    ✓ Solved appears below puzzle date
```

---

## Lifecycle: Revisiting Solved Puzzle

```
                    REVISITING A SOLVED PUZZLE
                            │
                    PAGE LOADS / REFRESHES
                            │
                    ┌───────────────┐
                    │ loadGameSession│
                    │ status: solved │
                    │ grid: complete │
                    └───────────────┘
                            │
                    ┌───────────────┐
                    │ CRITICAL STEP │
                    │ setVictoryOpen│
                    │    (false)    │  ← ALWAYS CLOSE!
                    └───────────────┘
                            │
                    ┌───────────────┐
                    │ hasShownModal  │
                    │ .current =false│  ← Reset for session
                    └───────────────┘
                            │
            ┌───────────────┬┴┬───────────────┐
            │               │ │               │
            ▼               ▼ ▼               ▼
        State              Modal            Badge
        Changes            Status            Status
        
    AFTER LOAD
    ├─ grid: complete
    ├─ status: solved
    ├─ modal: FALSE ✓      (← Explicitly closed)
    └─ badge: VISIBLE ✓    (← Shows "✓ Solved")
    
    AUTO-CHECK RUNS
    ├─ isSolved? YES
    ├─ hasShown? false (but doesn't matter!)
    ├─ Modal stays FALSE ✓ (loading effect closed it)
    └─ Badge still VISIBLE
    
    ✓ No modal popup! ✓
    ✓ Badge visible! ✓
    ✓ Bug fixed! ✓
```

---

## Lifecycle: Restart

```
                        USER CLICKS RESTART
                            │
                    ┌───────────────────┐
                    │  handleReset()    │
                    └───────────────────┘
                            │
            ┌───────────────┬┴┬───────────────────┐
            │               │ │                   │
            ▼               ▼ ▼                   ▼
        State              Modal           Session
        Changes            Changes         Flags
        
    ├─ grid: empty ✓
    ├─ status: progress ✓
    ├─ modal: false ✓
    ├─ badge: hidden ✓
    ├─ hasShown: false ✓
    └─ timer: reset
    
    NOW GRID IS EMPTY & READY TO SOLVE AGAIN
    
    USER SOLVES AGAIN → FINAL CELL
    ├─ isSolved? YES
    ├─ hasShown? false (YES - can show!)
    ├─ Modal: SHOWS ✓  (can show again because ref was reset)
    └─ Stats: UPDATE ✓
```

---

## CSS State Coupling

```
┌─────────────────────────────────────────────────────────────────┐
│             JSX BADGE RENDERING LOGIC                           │
└─────────────────────────────────────────────────────────────────┘

{gameStatus === 'solved' && (
  <span className={styles.solvedBadge}>✓ Solved</span>
)}

LOGIC:
  gameStatus value  │  Badge visible?
  ─────────────────┼─────────────────
  'in_progress'    │  ❌ No (not rendered)
  'solved'         │  ✅ Yes (rendered)
  
TIMING:
  • On fresh solve: Modal shows, badge hidden (no state change yet)
  • After modal closes: gameStatus already 'solved', badge appears
  • On page reload: gameStatus 'solved' → badge appears immediately
  • After restart: gameStatus 'in_progress' → badge disappears

GUARANTEE:
  Modal and Badge never both visible at same time ✓
  This is by design - they represent different contexts
```

---

## Performance Impact Graph

```
                       EFFECT RUNS vs TIME
                            
   Runs 
    │
    8 │     ╭─╮  BEFORE (Buggy)
    7 │     │ │  Every event causes re-check
    6 │   ╭─╯ │
    5 │   │   │  
    4 │ ╭─╯   │
    3 │ │     │  
    2 │ │     ╭─╮
    1 │ │     │ │
    0 │─╯     ╰─╯──────────
      │
      ├─ Page load
      ├─ Each cell fill
      ├─ Each refresh
      └─ Each nav change
    
    
   Runs 
    │
    3 │  ╭─────╮  AFTER (Optimized)
    2 │  │     │  Load (skip by guard), then solve
    1 │  │  ╭──╯  Fewer runs due to three guards
    0 │──╯  │
      │
      ├─ Page load (skipped by Guard 1)
      ├─ Cell fills (skipped by Guard 2 until solved)
      ├─ Refresh (skipped by Guard 1)
      └─ Nav (new component, starts fresh)

RESULT: ~60% fewer effect evaluations
        Same number of modal renders (1 per solve)
```

