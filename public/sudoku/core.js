/**
 * CantoBuddy — Sudoku engine (shared by the server and the browser).
 *
 * Why one file for both sides: the server needs to GENERATE a puzzle and hold
 * the solution as the source of truth (a client must never be trusted with the
 * answer in a race), and the browser needs to RENDER it. A single module,
 * required in Node and loaded as a <script> in the browser (UMD below), means
 * the generation logic lives in exactly one place and the two can never drift.
 *
 * THE FOUR LEVELS. Sudoku difficulty is mostly "how many cells are given", so
 * the levels also vary the GRID — a 4×4 (Easy) is genuinely playable by an
 * elderly first-timer, a 6×6 (Medium) is a step up, the 9×9 (Hard) is the
 * classic board, and Expert keeps the 9×9 board with ~8 fewer clues than Hard.
 * Each size has its own box shape (2×2, 2×3, 3×3) and its own number of givens,
 * set so every board has exactly one solution.
 *
 * UNIQUENESS MATTERS. A puzzle with two solutions would let a player fill a cell
 * that is locally correct but not the server's stored answer, and the server
 * would wrongly call it a mistake. So every removal is checked: a cell is only
 * taken out if the puzzle still has exactly one solution.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SudokuCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Per-level configuration: grid size (n), box [rows, cols], and how many cells
  // are given (the rest are blanks to fill). Fewer givens => harder. Expert keeps
  // the classic 9x9 board but with ~8 fewer clues than Hard.
  var LEVELS = {
    easy:   { n: 4, br: 2, bc: 2, clues: 6 },
    medium: { n: 6, br: 2, bc: 3, clues: 14 },
    hard:   { n: 9, br: 3, bc: 3, clues: 34 },
    expert: { n: 9, br: 3, bc: 3, clues: 26 },
  };

  function cfgFor(level) {
    return LEVELS[level] || LEVELS.easy;
  }

  function range(a, b) {
    var o = [];
    for (var i = a; i <= b; i++) o.push(i);
    return o;
  }

  function shuffle(arr, rnd) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function canPlace(g, n, br, bc, idx, val) {
    var r = Math.floor(idx / n), c = idx % n;
    for (var k = 0; k < n; k++) {
      if (g[r * n + k] === val) return false;
      if (g[k * n + c] === val) return false;
    }
    var rs = Math.floor(r / br) * br, cs = Math.floor(c / bc) * bc;
    for (var dr = 0; dr < br; dr++) {
      for (var dc = 0; dc < bc; dc++) {
        if (g[(rs + dr) * n + (cs + dc)] === val) return false;
      }
    }
    return true;
  }

  function fill(g, n, br, bc, rnd) {
    var idx = g.indexOf(0);
    if (idx === -1) return true;
    var cand = shuffle(range(1, n), rnd);
    for (var i = 0; i < cand.length; i++) {
      var v = cand[i];
      if (canPlace(g, n, br, bc, idx, v)) {
        g[idx] = v;
        if (fill(g, n, br, bc, rnd)) return true;
        g[idx] = 0;
      }
    }
    return false;
  }

  // Count solutions up to `limit` (so a uniqueness check costs at most two finds).
  function countSolutions(g, n, br, bc, limit) {
    var idx = g.indexOf(0);
    if (idx === -1) return 1;
    var total = 0;
    for (var v = 1; v <= n; v++) {
      if (canPlace(g, n, br, bc, idx, v)) {
        g[idx] = v;
        total += countSolutions(g, n, br, bc, limit - total);
        g[idx] = 0;
        if (total >= limit) return total;
      }
    }
    return total;
  }

  /**
   * Generate a fully solved grid, then dig out cells while keeping the solution
   * unique. Returns the puzzle (0 = blank), the solution, and the size/box info.
   */
  function generate(level, rnd) {
    rnd = rnd || Math.random;
    var c = cfgFor(level);
    var n = c.n, br = c.br, bc = c.bc;
    var solution = new Array(n * n).fill(0);
    fill(solution, n, br, bc, rnd);

    var puzzle = solution.slice();
    var target = c.clues;
    var givens = n * n;
    var positions = shuffle(range(0, n * n - 1), rnd);

    for (var i = 0; i < positions.length && givens > target; i++) {
      var idx = positions[i];
      var keep = puzzle[idx];
      puzzle[idx] = 0;
      // Only keep the removal if the puzzle still has exactly one solution.
      if (countSolutions(puzzle.slice(), n, br, bc, 2) !== 1) {
        puzzle[idx] = keep;
      } else {
        givens--;
      }
    }
    return { n: n, br: br, bc: bc, puzzle: puzzle, solution: solution, givens: givens };
  }

  return {
    generate: generate,
    canPlace: canPlace,
    countSolutions: countSolutions,
    LEVELS: LEVELS,
    CLUES: { 4: LEVELS.easy.clues, 6: LEVELS.medium.clues, 9: LEVELS.hard.clues },
    BOX: { 4: [LEVELS.easy.br, LEVELS.easy.bc], 6: [LEVELS.medium.br, LEVELS.medium.bc], 9: [LEVELS.hard.br, LEVELS.hard.bc] },
  };
});
