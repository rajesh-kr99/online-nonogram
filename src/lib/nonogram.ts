/**
 * Nonogram Game Utilities
 * Pure TypeScript functions for nonogram puzzle logic.
 */

import puzzlesData from './puzzles.json';

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
  name: string | null;
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

/** Registry of all available puzzles by difficulty (loaded from puzzles.json) */
export const PUZZLES: Record<Difficulty, PuzzleEntry[]> = puzzlesData as Record<Difficulty, PuzzleEntry[]>;

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

/**
 * Get the daily puzzle (same for all users) for a given difficulty and date.
 * Uses day index from a fixed start date to cycle through puzzles deterministically.
 * This is the ONLY puzzle shown for that difficulty on that day.
 * 
 * All users globally see the same puzzle on the same day.
 * The puzzle cycles through the pool automatically using modulo.
 * 
 * @param difficulty - The difficulty level (easy, medium, hard)
 * @param dateISO - The date in ISO format (YYYY-MM-DD)
 * @returns The puzzle for that day
 * @throws Error if no puzzles exist for the difficulty
 */
export function getDailyPuzzle(difficulty: Difficulty, dateISO: string): PuzzleEntry {
  const pool = PUZZLES[difficulty];

  if (pool.length === 0) {
    throw new Error(`No puzzles available for difficulty: ${difficulty}`);
  }

  if (pool.length === 1) return pool[0];

  // Calculate day index from fixed start date
  const msPerDay = 1000 * 60 * 60 * 24;
  const startDate = new Date('2024-01-01');
  const currentDate = new Date(`${dateISO}T00:00:00Z`);
  const dayIndex = Math.floor((currentDate.getTime() - startDate.getTime()) / msPerDay);

  // Use modulo to cycle through puzzles for this difficulty
  const puzzleIndex = dayIndex % pool.length;

  return pool[puzzleIndex];
}
