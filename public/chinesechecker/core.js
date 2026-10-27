/**
 * CantoBuddy — Chinese Checkers engine (shared by the server and the browser).
 *
 * WHY ONE FILE FOR BOTH SIDES. The server must be the only authority on what a
 * legal move is - a client that decides its own legality can teleport a peg. But
 * the browser has to highlight the destinations when a peg is picked up, and if
 * it used a second copy of the rules the two would eventually disagree and the
 * player would be told a move was legal and then refused. One module, required
 * in Node and loaded as a <script> in the browser, so that cannot happen.
 *
 * THE BOARD IS BUILT, NOT TYPED. A 121-hole star can be written out by hand as
 * seventeen rows of literal coordinates, and almost every implementation does
 * that. It is also where those implementations quietly go wrong: the row widths
 * are easy to mistype, and a single wrong width produces a board that looks
 * fine, renders fine, and has a peg that can never be reached.
 *
 * So the geometry here is derived instead. The board is a hexagonal grid of
 * radius 4 (61 cells) with one triangle of ten cells grown off each of its six
 * edges (6 x 10 = 60), which is 121 exactly. Corners are produced by rotating
 * one arm 60 degrees five times, so the six corners are identical by
 * construction and cannot drift apart. Everything below - adjacency, jumps,
 * the AI's distances - falls out of that.
 *
 * AXIAL COORDINATES. A cell is (a, b) meaning a*U + b*V with U=(1,0) and
 * V=(1/2, sqrt(3)/2). The six neighbours are then just the six unit steps, and
 * a jump is a reflection: landing = 2*over - from. No special cases per row.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CheckerCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var R = 4;                          // hexagon radius: 3*4*5+1 = 61 cells
  var K = Math.sqrt(3) / 2;           // vertical step of one lattice row
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];

  /* NO DRAWING ROTATION IS NEEDED, and that is a consequence of fixing the arm.
     With the correct equilateral arms the star already has a single point
     straight up at 90 degrees, its other five at 30/150/210/270/330, and it is
     taller than it is wide (12 x 13.86) - the shape a real board has, and the
     one that fits a phone held in one hand.

     The previous version carried a 30-degree turn to compensate for the skewed
     arm. Removing the skew removed the reason for the turn; keeping it would
     now rotate a correct board into the wrong orientation (points left and
     right, a V-notch at the top). TURN stays as a named constant so the pixel
     mapping reads the same way it did, and so a future rotation has one place
     to happen. */
  var TURN = 0;
  var COS = Math.cos(TURN);
  var SIN = Math.sin(TURN);

  function key(a, b) { return a + ',' + b; }

  /* 60 degrees counter-clockwise. In this basis: U -> V, V -> V - U, so
     (a,b) -> (-b, a+b). Applying it six times is the identity. */
  function rot(a, b) { return [-b, a + b]; }

  /* --- the six arms ------------------------------------------------------
     The arm grown off the a = R edge: rows a = R+1 .. 2R, and at each row the
     span b = -R .. R-a. That is 4,3,2,1 cells = 10, an EQUILATERAL triangle
     whose apex sits on the perpendicular bisector of the base.

     THE b RANGE IS THE WHOLE POINT, and it is where this went wrong the first
     time. The earlier version used b = -(2R-a) .. 0, which anchors every row at
     b = 0 instead of at b = -R. The row lengths were right (4,3,2,1) and the
     cell count was right (121), so nothing looked broken in the numbers — but
     the apex landed at (2R, 0) while the base's centre is at b = -R, so each
     point was a SKEWED triangle leaning the same way round the board. The star
     came out as a chiral pinwheel: still 121 cells, still 6-fold rotationally
     symmetric, and it swirled. A player reported it as "棋盤扭曲" and sent a
     photo of a real board, which is a symmetric hexagram.

     The invariant that catches it is REFLECTION, not rotation: a real board is
     symmetric about the vertical axis through its centre, a pinwheel is not.
     tools/chinesechecker-test.js now asserts that, so the two cannot be
     confused again. */
  var arm = [];
  for (var a0 = R + 1; a0 <= 2 * R; a0++) {
    for (var b0 = -R; b0 <= R - a0; b0++) arm.push([a0, b0]);
  }

  var armCells = [arm];
  for (var k = 1; k < 6; k++) {
    var prev = armCells[k - 1];
    var next = [];
    for (var i = 0; i < prev.length; i++) next.push(rot(prev[i][0], prev[i][1]));
    armCells.push(next);
  }

  /* --- assemble ---------------------------------------------------------- */
  var index = new Map();
  var CELLS = [];

  function add(a, b) {
    var kk = key(a, b);
    if (index.has(kk)) return index.get(kk);
    var id = CELLS.length;
    index.set(kk, id);
    // lattice -> plane, then the 30-degree turn described above
    var px = a + b / 2;
    var py = b * K;
    CELLS.push({
      i: id,
      a: a,
      b: b,
      x: px * COS - py * SIN,
      y: px * SIN + py * COS,
    });
    return id;
  }

  // Hexagon first so the 61 central cells are ids 0..60; the arms follow. That
  // ordering is not load-bearing, it just makes a board dump readable.
  for (var ha = -R; ha <= R; ha++) {
    for (var hb = -R; hb <= R; hb++) {
      if (Math.abs(ha + hb) <= R) add(ha, hb);
    }
  }

  var CORNERS = armCells.map(function (cells) {
    return cells.map(function (p) { return add(p[0], p[1]); });
  });

  var N = CELLS.length;
  var at = function (a, b) {
    var v = index.get(key(a, b));
    return v === undefined ? -1 : v;
  };

  var ADJ = CELLS.map(function (c) {
    var out = [];
    for (var d = 0; d < DIRS.length; d++) {
      var v = at(c.a + DIRS[d][0], c.b + DIRS[d][1]);
      if (v >= 0) out.push(v);
    }
    return out;
  });

  /* The cell directly beyond `over`, seen from `from`. -1 when that point is
     not on the board - which is the ordinary case near an edge, not an error. */
  function reflect(from, over) {
    var A = CELLS[from];
    var B = CELLS[over];
    return at(2 * B.a - A.a, 2 * B.b - A.b);
  }

  /* --- distances to each corner ------------------------------------------
     Plain BFS over the adjacency graph, once per corner at load. The AI needs
     "how far is this peg from home" thousands of times per game and recomputing
     it would be the only slow part of the whole thing. */
  var DIST = CORNERS.map(function (cells) {
    var d = new Int16Array(N).fill(-1);
    var q = [];
    for (var i = 0; i < cells.length; i++) { d[cells[i]] = 0; q.push(cells[i]); }
    for (var h = 0; h < q.length; h++) {
      var cur = q[h];
      for (var j = 0; j < ADJ[cur].length; j++) {
        var nb = ADJ[cur][j];
        if (d[nb] < 0) { d[nb] = d[cur] + 1; q.push(nb); }
      }
    }
    return d;
  });

  /* --- which corners a table uses ----------------------------------------
     Chinese checkers has no five-player arrangement that is fair - one player
     would always be nearer somebody than somebody else - so 5 is not offered.
     2 and 4 pair players on OPPOSITE corners, because two players on adjacent
     corners is a different game with a much shorter race. */
  var SEAT_CORNERS = {
    2: [0, 3],
    3: [0, 2, 4],
    4: [0, 1, 3, 4],
    6: [0, 1, 2, 3, 4, 5],
  };

  function seatCorners(seats) { return (SEAT_CORNERS[seats] || []).slice(); }
  function targetFor(seats, seat) {
    var c = SEAT_CORNERS[seats];
    if (!c) return -1;
    return (c[seat] + 3) % 6;
  }

  /* --- occupancy ---------------------------------------------------------
     A flat array, one entry per cell: -1 empty, otherwise the seat number.
     Seats are 0..5, so an Int8Array is enough and copies cheaply. */
  function emptyBoard() { return new Int8Array(N).fill(-1); }

  function initialBoard(seats) {
    var occ = emptyBoard();
    var corners = seatCorners(seats);
    for (var s = 0; s < corners.length; s++) {
      var cells = CORNERS[corners[s]];
      for (var i = 0; i < cells.length; i++) occ[cells[i]] = s;
    }
    return occ;
  }

  /* --- moves -------------------------------------------------------------
     Every destination a peg at `from` may legally reach in ONE turn: the empty
     neighbours, plus everything reachable by a chain of jumps.

     Stopping mid-chain is allowed, which is the common house rule and also the
     friendlier one - a beginner who spots a single good jump is never forced to
     find the rest of the chain before being allowed to move.

     WHAT A JUMP IS, and this was got wrong the first time. The rule is not
     "clear the peg in the next hole". It is: the peg you clear sits somewhere on
     the same line, and you land at its mirror image, and NOTHING ELSE may sit
     anywhere between you and that landing.

       "棋子 A 在同一直線的路線上有一顆棋子 B ... 以棋子 B 為中心，通過鏡像反射
        跳躍至直線另一端的空格 ... 前提是棋子 A 的前進路線中，沒有棋子 B 以外的
        棋子阻擋"

     The first version only allowed the peg to be ONE hole away. That is the
     tournament rule, and it is wrong for this game: a player pointed at a hole
     four steps away with a peg two steps away and nothing between, and the
     hint refused it. The clause about "nothing else blocking the path" is the
     giveaway - with an adjacent-only jump there is no path to block, so the
     rule would be vacuous. The published diagrams also mark each half of the
     jump "2格", i.e. peg at distance 2, landing at distance 4.

     So a jump is: walk the ray from the peg; the FIRST piece met is the one
     being cleared; the landing is its mirror image; every hole strictly between
     must be empty. That is a superset of the adjacent jump (which is just the
     case where the piece is one hole away), so it adds moves and removes none -
     nothing that used to be legal stops being legal.

     A chain is a breadth-first search over those landings, with a visited set,
     so a cycle of jumps cannot loop forever and a landing is never offered
     twice. */
  var RAYS = DIRS;

  /* The landing for a jump from `from` along `dir`, or -1 if there is none.
     `occ` must already have the moving peg removed from its origin - during a
     chain the origin hole is empty, and a jump whose path crosses it is legal. */
  function jumpLanding(occ, from, dir) {
    var A = CELLS[from];
    var k = -1;                                  // distance to the piece cleared
    for (var t = 1; ; t++) {
      var idx = at(A.a + dir[0] * t, A.b + dir[1] * t);
      if (idx < 0) return -1;                    // the ray left the board
      if (k < 0) {
        if (occ[idx] >= 0) k = t;                // this is the piece being jumped
        continue;
      }
      if (t === 2 * k) return occ[idx] < 0 ? idx : -1;  // mirror landing
      if (occ[idx] >= 0) return -1;              // something else blocks the path
    }
  }

  function legalMoves(occ, from) {
    var out = [];
    if (from < 0 || from >= N) return out;
    var seen = new Uint8Array(N);
    seen[from] = 1;

    for (var i = 0; i < ADJ[from].length; i++) {
      var nb = ADJ[from][i];
      if (occ[nb] < 0) { out.push(nb); seen[nb] = 1; }
    }

    /* The peg has left its origin, so the origin is empty while it travels.
       With adjacent-only jumps that could never matter; with a jump that can
       span the board it does - a chain can double back across the hole the peg
       started from. */
    var jumpOcc = occ.slice();
    jumpOcc[from] = -1;

    var queue = [from];
    for (var h = 0; h < queue.length; h++) {
      var cur = queue[h];
      for (var d = 0; d < RAYS.length; d++) {
        var land = jumpLanding(jumpOcc, cur, RAYS[d]);
        if (land < 0 || seen[land]) continue;
        seen[land] = 1;
        out.push(land);
        queue.push(land);
      }
    }
    return out;
  }

  /* A move is worth showing the player as a JUMP when it is not adjacent -
     i.e. the chain did some work. Used only for wording and for the AI's
     tie-break, never for legality. */
  function isJump(from, to) {
    return ADJ[from].indexOf(to) < 0;
  }

  function applyMove(occ, from, to, seat) {
    occ[from] = -1;
    occ[to] = seat;
  }

  /* --- winning -----------------------------------------------------------
     Exactly the ten target cells, all this seat's. Not "all pegs are somewhere
     in the target triangle" - the triangle is the same ten cells, so both
     readings agree - but written against the corner list so it cannot drift if
     the board ever changes shape. */
  function isWin(occ, seats, seat) {
    var target = CORNERS[targetFor(seats, seat)];
    for (var i = 0; i < target.length; i++) {
      if (occ[target[i]] !== seat) return false;
    }
    return true;
  }

  /* How many pegs are home. Drives the progress bar, not the rules. */
  function homeCount(occ, seats, seat) {
    var target = CORNERS[targetFor(seats, seat)];
    var n = 0;
    for (var i = 0; i < target.length; i++) if (occ[target[i]] === seat) n++;
    return n;
  }

  /* Total lattice steps still to travel, summed over pegs. Lower is better. */
  function travel(occ, seats, seat) {
    var d = DIST[targetFor(seats, seat)];
    var total = 0;
    for (var i = 0; i < N; i++) if (occ[i] === seat) total += d[i];
    return total;
  }

  /* --- the computer opponent ---------------------------------------------
     TWO levels, not three, and that is a finding rather than a shortcut.
     See "WHY THERE IS NO HARD" below.

     It is not a strong checkers player and is not meant to be: it has to be
     BEATABLE by someone learning the game on a phone, while still finishing the
     game so nobody is left waiting forever.

     WHY ONE PLY WAS NOT ENOUGH. The first version scored each candidate move on
     total distance-to-home. It never finished a single game - every size, every
     setting, 0 of 24. The reason is the classic "last peg" problem: a corner has
     to be filled from the BACK, and a one-ply bot fills the shallow cells first
     because they are the ones it can reach. Then the apex is walled off behind
     its own pegs, every remaining move scores the same, and it shuffles two pegs
     back and forth until the move cap.

     Two additions fix that, and neither is a tuning knob:

       - LOOKAHEAD. A move is scored on the distance it leaves AND the best
         distance reachable next move. That is what lets it see "step aside now,
         walk in next turn", which is invisible to a greedy search.
       - DEEP FIRST. Landing on a target cell that has fewer exits is worth more.
         The apex of a corner has one neighbour and is the cell you must claim
         early; if it is left until last it cannot be reached at all.

     WHY THERE IS NO HARD. Three "smarter" heuristics were written and measured
     head to head against Normal, and all three were noise:

       - a penalty on the farthest peg ("do not leave a straggler"): 6-6, and it
         LOST 5-7 to Easy, because mid-game the pegs travel independently and
         holding the front ones back is simply slower
       - a clustering charge, Hard only: 12-11
       - the same charge at every level: Hard LOST 8-12
       - two extra plies of search: 12-11, at 14ms a move instead of 0.2ms

     That last one is the tell. Distance-to-home IS moves-to-home, because the
     BFS distance counts the steps a peg must take. In a race where each seat's
     pegs travel down their own lane, minimising it is already close to optimal,
     so there is no headroom for a deeper search to find. A "Hard" would have
     been a label on the same opponent. Two honest levels is better than three
     where the top one is decoration.

     EASY IS MISTAKES, NOT NOISE. A purely random bot never converges - it
     wandered for the full cap in every game. Score noise did not work either: a
     spread small enough to still converge is small enough to pick a nearly
     correct move, and Easy measured the same strength as Normal. What is
     actually weaker is a move that is visibly wrong, so Easy guesses at random
     some of the time and plays the real move the rest. */
  var DEEP = (function () {
    // how hard each cell is to reach, as "exits it has". A corner apex with one
    // neighbour is the hardest; a cell in the open with six is the easiest.
    var w = new Float32Array(N);
    for (var i = 0; i < N; i++) w[i] = 6 - ADJ[i].length;
    return w;
  })();

  function scoreMove(occ, seats, seat, isHome) {
    var target = targetFor(seats, seat);
    var d = DIST[target];
    var total = 0;
    var far = 0;
    for (var i = 0; i < N; i++) {
      if (occ[i] !== seat) continue;
      total += d[i];
      if (d[i] > far) far = d[i];
    }
    return { total: total, far: far };
  }

  /* Best distance this seat could reach in one more move, without playing it.
     Returns the same number when no move is possible, which is what we want: a
     dead end should not look like an improvement. */
  function bestNextTravel(occ, seats, seat) {
    var mine = [];
    for (var i = 0; i < N; i++) if (occ[i] === seat) mine.push(i);
    var best = Infinity;
    for (var m = 0; m < mine.length; m++) {
      var f = mine[m];
      var dests = legalMoves(occ, f);
      for (var k = 0; k < dests.length; k++) {
        var to = dests[k];
        occ[f] = -1;
        occ[to] = seat;
        var t = scoreMove(occ, seats, seat).total;
        occ[f] = seat;
        occ[to] = -1;
        if (t < best) best = t;
      }
    }
    return best === Infinity ? scoreMove(occ, seats, seat).total : best;
  }

  function botMove(occ, seats, seat, level) {
    var mine = [];
    for (var i = 0; i < N; i++) if (occ[i] === seat) mine.push(i);

    var options = [];
    for (var m = 0; m < mine.length; m++) {
      var from = mine[m];
      var dests = legalMoves(occ, from);
      for (var d = 0; d < dests.length; d++) options.push([from, dests[d]]);
    }
    if (!options.length) return null;

    /* EASY GUESSES. Noise on the score was the first attempt and it did not
       work: a random offset that is small enough to still converge is also
       small enough to pick a nearly-correct move, so Easy measured the same
       strength as Normal (11-9 over twenty games). What actually makes a bot
       easier to beat is a move that is VISIBLY wrong - going backwards, missing
       a jump - so Easy simply guesses at random some of the time and plays the
       real move the rest. Pure random was tried first and never finished a
       game; half random still makes steady progress. */
    if (level === 'easy' && Math.random() < 0.45) {
      return options[Math.floor(Math.random() * options.length)];
    }

    var target = CORNERS[targetFor(seats, seat)];
    var isHome = new Uint8Array(N);
    for (var t = 0; t < target.length; t++) isHome[target[t]] = 1;

    var best = null;
    var bestScore = Infinity;

    for (var o = 0; o < options.length; o++) {
      var f = options[o][0];
      var to = options[o][1];

      occ[f] = -1;
      occ[to] = seat;

      var now = scoreMove(occ, seats, seat);
      var score = now.total;

      /* Look ahead. Weighted just under 1 so that a real gain now beats a
         promised gain later - otherwise the bot chases setups and never
         arrives. Easy gets it too: it is supposed to play badly, not to wander
         without ever going home. */
      score += 0.85 * bestNextTravel(occ, seats, seat);

      /* Claim the hard cells first. Without this the apex of the corner is left
         until last and then cannot be reached. */
      if (isHome[to] && !isHome[f]) score -= DEEP[to] * 0.6;

      /* Leaving home is a real cost, but not a ban: the last peg often cannot
         enter until one already home steps aside. */
      if (isHome[f] && !isHome[to]) score += 3;

      /* Easy does not get here most of the time - it has already guessed. When
         it does, it plays the same move Normal would. */
      if (level === 'easy') score += Math.random() * 1.2;

      occ[f] = seat;
      occ[to] = -1;

      // Ties broken at random so the same position is not replayed identically.
      if (score < bestScore - 1e-9 || (Math.abs(score - bestScore) < 1e-9 && Math.random() < 0.4)) {
        bestScore = score;
        best = options[o];
      }
    }
    return best;
  }

  /* --- presentation helpers ----------------------------------------------
     The client draws in lattice units and the server never needs pixels, but
     both need the same extents, so they live here rather than being guessed at
     in CSS. */
  var BOUNDS = (function () {
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (var i = 0; i < CELLS.length; i++) {
      var c = CELLS[i];
      if (c.x < minX) minX = c.x;
      if (c.x > maxX) maxX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.y > maxY) maxY = c.y;
    }
    return { minX: minX, maxX: maxX, minY: minY, maxY: maxY };
  })();

  return {
    N: N,
    CELLS: CELLS,
    CORNERS: CORNERS,
    ADJ: ADJ,
    DIST: DIST,
    BOUNDS: BOUNDS,
    SEAT_CORNERS: SEAT_CORNERS,
    seatCorners: seatCorners,
    targetFor: targetFor,
    emptyBoard: emptyBoard,
    initialBoard: initialBoard,
    legalMoves: legalMoves,
    isJump: isJump,
    applyMove: applyMove,
    isWin: isWin,
    homeCount: homeCount,
    travel: travel,
    botMove: botMove,
    reflect: reflect,
  };
});
