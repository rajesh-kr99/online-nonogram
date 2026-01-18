/**
 * Nonogram Game Utilities
 * Pure TypeScript functions for nonogram puzzle logic.
 */

// ==============================================
// TYPES
// ==============================================

/** Player cell state: 0=empty, 1=filled, 2=markedX */
export type CellValue = 0 | 1 | 2;

/** Solution cell state: 0=empty, 1=filled */
export type SolutionCell = 0 | 1;

/** Generic 2D grid type */
export type Grid<T> = T[][];

// ==============================================
// GRID CREATION
// ==============================================

/**
 * Creates an empty grid of the given size filled with the specified value.
 * @param size - The width and height of the square grid
 * @param value - The initial cell value (default: 0)
 * @returns A size x size grid filled with the given value
 */
export function createEmptyGrid(size: number, value: CellValue = 0): Grid<CellValue> {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => value)
  );
}

// ==============================================
// CLUE COMPUTATION
// ==============================================

/**
 * Computes the row and column clues from a solution grid.
 * Clues represent consecutive runs of filled cells (1s).
 * If a row/column has no filled cells, the clue is [0].
 *
 * @param solution - The solution grid with filled (1) and empty (0) cells
 * @returns Object containing rowClues and colClues arrays
 */
export function computeCluesFromSolution(solution: Grid<SolutionCell>): {
  rowClues: number[][];
  colClues: number[][];
} {
  const size = solution.length;

  const computeLineClues = (line: SolutionCell[]): number[] => {
    const clues: number[] = [];
    let count = 0;

    for (const cell of line) {
      if (cell === 1) {
        count++;
      } else if (count > 0) {
        clues.push(count);
        count = 0;
      }
    }

    if (count > 0) clues.push(count);

    return clues.length > 0 ? clues : [0];
  };

  const rowClues: number[][] = solution.map((row) => computeLineClues(row));

  const colClues: number[][] = [];
  for (let col = 0; col < size; col++) {
    const column: SolutionCell[] = [];
    for (let row = 0; row < size; row++) {
      column.push(solution[row][col]);
    }
    colClues.push(computeLineClues(column));
  }

  return { rowClues, colClues };
}

// ==============================================
// SOLUTION CHECKING
// ==============================================

/**
 * Checks if the player's grid matches the solution.
 * Solved when:
 * - Every solution=1 cell has player=1 (filled)
 * - Every solution=0 cell has player!=1 (empty or X are OK)
 */
export function isSolved(
  player: Grid<CellValue>,
  solution: Grid<SolutionCell>
): boolean {
  const size = solution.length;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const solutionCell = solution[row][col];
      const playerCell = player[row][col];

      if (solutionCell === 1) {
        if (playerCell !== 1) return false;
      } else {
        if (playerCell === 1) return false;
      }
    }
  }

  return true;
}

// ==============================================
// GRID VALIDATION
// ==============================================

export function isValidPlayerGrid(grid: unknown, size: number): grid is Grid<CellValue> {
  if (!Array.isArray(grid)) return false;
  if (grid.length !== size) return false;

  for (const row of grid) {
    if (!Array.isArray(row)) return false;
    if (row.length !== size) return false;
    for (const cell of row) {
      if (cell !== 0 && cell !== 1 && cell !== 2) return false;
    }
  }

  return true;
}

export function isValidSolutionGrid(grid: unknown, size: number): grid is Grid<SolutionCell> {
  if (!Array.isArray(grid)) return false;
  if (grid.length !== size) return false;

  for (const row of grid) {
    if (!Array.isArray(row)) return false;
    if (row.length !== size) return false;
    for (const cell of row) {
      if (cell !== 0 && cell !== 1) return false;
    }
  }

  return true;
}

export function isValidPlayerGridStack(data: unknown, size: number): data is Grid<CellValue>[] {
  if (!Array.isArray(data)) return false;
  for (const grid of data) {
    if (!isValidPlayerGrid(grid, size)) return false;
  }
  return true;
}

// ==============================================
// PUZZLE REGISTRY
// ==============================================

/** Puzzle difficulty levels (Daily removed) */
export type Difficulty = "easy" | "medium" | "hard";

/** Puzzle metadata with solution */
export interface PuzzleEntry {
  size: number;
  id: string;
  solution: Grid<SolutionCell>;
}

// ==============================================
// SAMPLE DATA
// ==============================================

/**
 * Sample 5x5 solution grid for testing.
 * Pattern: Hourglass / X shape
 */
export const SAMPLE_5X5_SOLUTION: Grid<SolutionCell> = [
  [1, 0, 0, 0, 1],
  [0, 1, 0, 1, 0],
  [0, 0, 1, 0, 0],
  [0, 1, 0, 1, 0],
  [1, 0, 0, 0, 1],
];

/**
 * Medium 10x10 solution grid.
 * Pattern: Smiley face
 */
export const MEDIUM_10X10_SOLUTION: Grid<SolutionCell> = [
  [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
  [1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 0, 0, 0, 0, 1, 0, 1],
  [1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
  [1, 0, 0, 0, 1, 1, 0, 0, 0, 1],
  [0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
  [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
];

/**
 * Medium puzzle (formerly "daily"): Heart shape
 */
export const DAILY_HEART_SOLUTION: Grid<SolutionCell> = [
  [0, 1, 1, 0, 0, 0, 0, 1, 1, 0],
  [1, 1, 1, 1, 0, 0, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

/**
 * Medium puzzle (formerly "daily"): Arrow pointing up
 */
export const DAILY_ARROW_SOLUTION: Grid<SolutionCell> = [
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 1, 1, 0, 1, 1, 0, 1, 1, 0],
  [1, 1, 0, 0, 1, 1, 0, 0, 1, 1],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
];

/**
 * Medium puzzle (formerly "daily"): Diamond shape
 */
export const DAILY_DIAMOND_SOLUTION: Grid<SolutionCell> = [
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
  [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
  [0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
  [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
  [0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
];

/**
 * Additional 5x5 puzzle: Plus sign
 */
const EASY_PLUS_SOLUTION: Grid<SolutionCell> = [
  [0, 0, 1, 0, 0],
  [0, 0, 1, 0, 0],
  [1, 1, 1, 1, 1],
  [0, 0, 1, 0, 0],
  [0, 0, 1, 0, 0],
];

/**
 * Additional 5x5 puzzle: Square frame
 */
const EASY_FRAME_SOLUTION: Grid<SolutionCell> = [
  [1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 1, 1, 1, 1],
];

/**
 * Easy 5x5 puzzle: Diamond
 */
const EASY_DIAMOND_SOLUTION: Grid<SolutionCell> = [
  [0, 0, 1, 0, 0],
  [0, 1, 0, 1, 0],
  [1, 0, 0, 0, 1],
  [0, 1, 0, 1, 0],
  [0, 0, 1, 0, 0],
];

/**
 * Easy 5x5 puzzle: Box
 */
const EASY_BOX_SOLUTION: Grid<SolutionCell> = [
  [1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 1, 1, 1, 1],
];

/**
 * Easy 5x5 puzzle: Arrow Right
 */
const EASY_ARROW_SOLUTION: Grid<SolutionCell> = [
  [0, 1, 0, 0, 0],
  [0, 0, 1, 0, 0],
  [1, 1, 1, 1, 1],
  [0, 0, 1, 0, 0],
  [0, 1, 0, 0, 0],
];

/**
 * Easy 5x5 puzzle: Heart (outline)
 */
const EASY_HEART_SOLUTION: Grid<SolutionCell> = [
  [0, 1, 0, 1, 0],
  [1, 0, 1, 0, 1],
  [1, 0, 0, 0, 1],
  [0, 1, 0, 1, 0],
  [0, 0, 1, 0, 0],
];

/**
 * Medium 10x10 puzzle: Letter "A"
 */
const MEDIUM_A_SOLUTION: Grid<SolutionCell> = [
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
  [0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

/**
 * Medium 10x10 puzzle: Checker Cross
 */
const MEDIUM_CROSS_SOLUTION: Grid<SolutionCell> = [
  [0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

/**
 * Medium 10x10 puzzle: House
 */
const MEDIUM_HOUSE_SOLUTION: Grid<SolutionCell> = [
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
  [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 1, 1, 1, 1, 0, 0, 1],
  [1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
  [1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

/**
 * Medium 10x10 puzzle: Spiral
 */
const MEDIUM_SPIRAL_SOLUTION: Grid<SolutionCell> = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 1, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 0, 0, 1, 0, 1],
  [1, 0, 1, 0, 1, 1, 0, 1, 0, 1],
  [1, 0, 1, 0, 1, 1, 0, 1, 0, 1],
  [1, 0, 1, 0, 0, 0, 0, 1, 0, 1],
  [1, 0, 1, 1, 1, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

/** Registry of all available puzzles by difficulty (pools for rotation) */
export const PUZZLES: Record<Difficulty, PuzzleEntry[]> = {
  easy: [
    { size: 5, id: "easy-001", solution: SAMPLE_5X5_SOLUTION },
    { size: 5, id: "easy-002", solution: EASY_PLUS_SOLUTION },
    { size: 5, id: "easy-003", solution: EASY_FRAME_SOLUTION },
    { size: 5, id: "easy-004", solution: EASY_DIAMOND_SOLUTION },
    { size: 5, id: "easy-005", solution: EASY_BOX_SOLUTION },
    { size: 5, id: "easy-006", solution: EASY_ARROW_SOLUTION },
    { size: 5, id: "easy-007", solution: EASY_HEART_SOLUTION },
  ],
  medium: [
    { size: 10, id: "medium-001", solution: MEDIUM_10X10_SOLUTION },
    { size: 10, id: "medium-002", solution: MEDIUM_A_SOLUTION },
    { size: 10, id: "medium-003", solution: MEDIUM_CROSS_SOLUTION },
    { size: 10, id: "medium-004", solution: MEDIUM_HOUSE_SOLUTION },
    { size: 10, id: "medium-005", solution: MEDIUM_SPIRAL_SOLUTION },

    // formerly daily puzzles - now just more medium puzzles
    { size: 10, id: "medium-006", solution: DAILY_HEART_SOLUTION },
    { size: 10, id: "medium-007", solution: DAILY_ARROW_SOLUTION },
    { size: 10, id: "medium-008", solution: DAILY_DIAMOND_SOLUTION },
  ],
  hard: [],
};

// ==============================================
// DAILY FEATURED PUZZLE HELPERS
// ==============================================

/**
 * Returns "YYYY-MM-DD" in the user's local time.
 * Useful if you want each difficulty to show a different "featured" puzzle per day.
 */
export function getLocalDateISO(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

function getPreviousDateISO(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  return getLocalDateISO(date);
}

/**
 * Get the "featured" puzzle for a given difficulty and date.
 * Deterministic selection based on `${difficulty}:${dateISO}` hash.
 * If pool.length > 1, avoids repeating yesterday's featured when possible.
 * @throws Error if no puzzles exist for the difficulty
 */
export function getFeaturedPuzzle(difficulty: Difficulty, dateISO: string): PuzzleEntry {
  const pool = PUZZLES[difficulty];

  if (pool.length === 0) {
    throw new Error(`No puzzles available for difficulty: ${difficulty}`);
  }

  if (pool.length === 1) return pool[0];

  const seedToday = `${difficulty}:${dateISO}`;
  let indexToday = hashString(seedToday) % pool.length;

  const seedYesterday = `${difficulty}:${getPreviousDateISO(dateISO)}`;
  const indexYesterday = hashString(seedYesterday) % pool.length;

  // Avoid repeating yesterday's featured
  if (indexToday === indexYesterday) {
    indexToday = (indexToday + 1) % pool.length;
  }

  return pool[indexToday];
}

/**
 * Get the index of a puzzle in the pool for a given difficulty.
 * Returns -1 if not found.
 */
export function getPuzzleIndex(difficulty: Difficulty, puzzleId: string): number {
  const pool = PUZZLES[difficulty];
  return pool.findIndex((p) => p.id === puzzleId);
}

/**
 * Get the next puzzle that hasn't been seen yet.
 * - If startFrom is provided and not in alreadySeenIds, returns startFrom.
 * - Otherwise, iterates through the pool starting from startFrom's index+1 (wrapping)
 *   to find the first unseen puzzle.
 * - If all puzzles are seen, returns startFrom ?? pool[0] (caller can decide to reset).
 * @throws Error if no puzzles exist for the difficulty
 */
export function getNextPuzzleNoRepeat(
  difficulty: Difficulty,
  dateISO: string,
  alreadySeenIds: string[],
  startFrom?: PuzzleEntry
): PuzzleEntry {
  const pool = PUZZLES[difficulty];

  if (pool.length === 0) {
    throw new Error(`No puzzles available for difficulty: ${difficulty}`);
  }

  const seenSet = new Set(alreadySeenIds);

  // If startFrom is provided and not yet seen, prefer it
  if (startFrom && !seenSet.has(startFrom.id)) {
    return startFrom;
  }

  // Get the featured puzzle for today as a starting reference if no startFrom
  const featured = startFrom ?? getFeaturedPuzzle(difficulty, dateISO);
  const featuredIndex = getPuzzleIndex(difficulty, featured.id);
  const startIndex = featuredIndex >= 0 ? featuredIndex : 0;

  // Iterate through pool starting from featured index + 1, wrapping around
  for (let offset = 1; offset <= pool.length; offset++) {
    const idx = (startIndex + offset) % pool.length;
    const candidate = pool[idx];
    if (!seenSet.has(candidate.id)) {
      return candidate;
    }
  }

  // All puzzles seen - return startFrom or pool[0]
  return startFrom ?? pool[0];
}

/**
 * Generate a localStorage key for tracking seen puzzles per difficulty per day.
 */
export function makeDailySeenKey(difficulty: Difficulty, dateISO: string): string {
  return `nonogram:seen:${difficulty}:${dateISO}:v1`;
}
