/*
 * Calendar Puzzle solver — pure-JS port of calendar_puzzle.py.
 *
 * Exposes globalThis.Solver (browser) and module.exports (node CJS, for the
 * parity test). Cells are integer keys = row * 7 + col. Off-board positions
 * are simply absent from the board map.
 */
(function () {
  "use strict";

  const NROWS = 8;
  const NCOLS = 7;

  const key = (r, c) => r * NCOLS + c;
  const rowOf = (k) => Math.floor(k / NCOLS);
  const colOf = (k) => k % NCOLS;

  // Insertion order defines color assignment (matches _PIECE_COLORS in Python).
  const PIECE_COLORS = [
    "#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f",
    "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ac",
  ];

  // Default piece shapes from _default_pieces(). Total area = 47.
  const PIECES = {
    "米色直条":   [[0, 0], [0, 1], [0, 2], [0, 3]],
    "米色异形块": [[0, 2], [1, 0], [1, 1], [1, 2], [2, 0]],
    "红色U块":    [[0, 0], [0, 2], [1, 0], [1, 1], [1, 2]],
    "绿色T块":    [[0, 1], [1, 1], [2, 0], [2, 1], [2, 2]],
    "黄色大L块":  [[0, 2], [1, 2], [2, 0], [2, 1], [2, 2]],
    "蓝色长L块":  [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]],
    "蓝色小L块":  [[0, 2], [1, 0], [1, 1], [1, 2]],
    "黄色折线块": [[0, 1], [0, 2], [0, 3], [1, 0], [1, 1]],
    "绿色Z块":    [[0, 0], [0, 1], [1, 1], [1, 2]],
    "红色阶梯块": [[0, 0], [0, 1], [1, 0], [1, 1], [1, 2]],
  };
  const PIECE_NAMES = Object.keys(PIECES);

  function buildBoard() {
    const cellToName = new Map();

    const months = [
      "1月", "2月", "3月", "4月", "5月", "6月",
      "7月", "8月", "9月", "10月", "11月", "12月",
    ];
    months.forEach((name, i) => {
      cellToName.set(key(Math.floor(i / 6), i % 6), name);
    });

    for (let i = 0; i < 31; i++) {
      cellToName.set(key(2 + Math.floor(i / 7), i % 7), (i + 1) + "日");
    }

    cellToName.set(key(6, 3), "星期日");
    cellToName.set(key(6, 4), "星期一");
    cellToName.set(key(6, 5), "星期二");
    cellToName.set(key(6, 6), "星期三");
    cellToName.set(key(7, 4), "星期四");
    cellToName.set(key(7, 5), "星期五");
    cellToName.set(key(7, 6), "星期六");

    const nameToCell = new Map();
    for (const [k, n] of cellToName) nameToCell.set(n, k);
    return { cellToName, nameToCell };
  }

  const { cellToName, nameToCell } = buildBoard();
  const ALL_CELLS = new Set(cellToName.keys());

  // ---- geometry (operates on arrays of [r, c]) ----

  function normalize(pts) {
    let minR = Infinity, minC = Infinity;
    for (const [r, c] of pts) {
      if (r < minR) minR = r;
      if (c < minC) minC = c;
    }
    return pts.map(([r, c]) => [r - minR, c - minC]);
  }

  function canonical(pts) {
    const n = normalize(pts);
    n.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return n.map(([r, c]) => r + "," + c).join(";");
  }

  function rotate90(pts) {
    return normalize(pts.map(([r, c]) => [c, -r]));
  }

  function flip(pts) {
    return normalize(pts.map(([r, c]) => [r, -c]));
  }

  function orientations(shape, allowFlip) {
    const seen = new Map();
    const starts = allowFlip ? [shape, flip(shape)] : [shape];
    for (const start of starts) {
      let cur = start;
      for (let i = 0; i < 4; i++) {
        const norm = normalize(cur);
        const sig = canonical(norm);
        if (!seen.has(sig)) seen.set(sig, norm);
        cur = rotate90(cur);
      }
    }
    return [...seen.values()];
  }

  // ---- placement generation ----

  function generatePlacements(availableCells, allowFlip) {
    const result = {};
    for (const name of PIECE_NAMES) {
      const seen = new Set();
      const list = [];
      for (const shape of orientations(PIECES[name], allowFlip)) {
        let h = 0, w = 0;
        for (const [r, c] of shape) {
          if (r > h) h = r;
          if (c > w) w = c;
        }
        h += 1;
        w += 1;
        for (let ro = 0; ro <= NROWS - h; ro++) {
          for (let co = 0; co <= NCOLS - w; co++) {
            let ok = true;
            const arr = [];
            for (const [r, c] of shape) {
              const k = key(r + ro, c + co);
              if (!availableCells.has(k)) { ok = false; break; }
              arr.push(k);
            }
            if (!ok) continue;
            arr.sort((a, b) => a - b);
            const sig = arr.join(",");
            if (seen.has(sig)) continue;
            seen.add(sig);
            list.push({ pieceName: name, cells: new Set(arr), arr });
          }
        }
      }
      result[name] = list;
    }
    return result;
  }

  function shuffleInPlace(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ---- generalized backtracking core (min-candidates-first) ----

  function completions(availableCells, usedPiecesInit, maxSolutions, allowFlip, prebuilt, shuffle) {
    const placementsByPiece = prebuilt || generatePlacements(availableCells, allowFlip);

    const placementsByCell = new Map();
    for (const k of availableCells) placementsByCell.set(k, []);
    for (const name of PIECE_NAMES) {
      for (const p of placementsByPiece[name]) {
        for (const k of p.arr) {
          const lst = placementsByCell.get(k);
          if (lst) lst.push(p);
        }
      }
    }

    const totalPieces = PIECE_NAMES.length;
    const raw = [];
    const selected = [];
    const used = new Set(usedPiecesInit);

    function subsetOf(set, arr) {
      for (const k of arr) if (!set.has(k)) return false;
      return true;
    }

    function search(uncovered) {
      if (raw.length >= maxSolutions) return;
      if (uncovered.size === 0) {
        if (used.size === totalPieces) raw.push(selected.slice());
        return;
      }

      let best = null;
      for (const cell of uncovered) {
        const opts = [];
        for (const p of placementsByCell.get(cell)) {
          if (used.has(p.pieceName)) continue;
          if (!subsetOf(uncovered, p.arr)) continue;
          opts.push(p);
        }
        if (opts.length === 0) return;
        if (best === null || opts.length < best.length) {
          best = opts;
          if (best.length === 1) break;
        }
      }

      const order = shuffle ? shuffleInPlace(best.slice()) : best;
      for (const p of order) {
        selected.push(p);
        used.add(p.pieceName);
        const next = new Set(uncovered);
        for (const k of p.arr) next.delete(k);
        search(next);
        used.delete(p.pieceName);
        selected.pop();
        if (raw.length >= maxSolutions) return;
      }
    }

    search(new Set(availableCells));
    return raw;
  }

  // ---- public helpers ----

  function emptyNamesToCells(emptyCells) {
    const pts = [];
    for (const n of emptyCells) {
      if (!nameToCell.has(n)) throw new Error("棋盘中不存在格子：" + n);
      pts.push(nameToCell.get(n));
    }
    return pts;
  }

  function availableFrom(targetNames, placed) {
    const available = new Set(ALL_CELLS);
    for (const k of emptyNamesToCells(targetNames)) available.delete(k);
    const used = [];
    if (placed) {
      for (const pl of placed) {
        used.push(pl.pieceName);
        for (const name of pl.cells) available.delete(nameToCell.get(name));
      }
    }
    return { available, used };
  }

  function solve(emptyCells, maxSolutions, allowFlip) {
    if (maxSolutions == null) maxSolutions = 3;
    if (allowFlip == null) allowFlip = true;

    const empties = emptyNamesToCells(emptyCells);
    if (empties.length !== 3) throw new Error("需要恰好 3 个留空格。");
    if (new Set(empties).size !== 3) throw new Error("三个留空格不能重复。");
    if (maxSolutions < 1) return [];

    const available = new Set(ALL_CELLS);
    for (const k of empties) available.delete(k);

    const raw = completions(available, [], maxSolutions, allowFlip, null, false);
    return raw.map((sol) => {
      const obj = {};
      for (const p of sol) obj[p.pieceName] = p.arr.map((k) => cellToName.get(k));
      return obj;
    });
  }

  function countSolutions(emptyCells, limit, allowFlip) {
    if (limit == null) limit = 10000;
    if (allowFlip == null) allowFlip = true;
    return solve(emptyCells, limit, allowFlip).length;
  }

  // Validation: can the remaining pieces still complete the board?
  function feasible(opts) {
    const targets = opts.targets;
    const placed = opts.placed || [];
    const allowFlip = opts.allowFlip == null ? true : opts.allowFlip;

    const { available, used } = availableFrom(targets, placed);
    const usedSet = new Set(used);
    const placements = generatePlacements(available, allowFlip);

    // Fast path: a still-uncovered cell no remaining piece can reach is a dead end.
    const covered = new Set();
    for (const name of PIECE_NAMES) {
      if (usedSet.has(name)) continue;
      for (const p of placements[name]) {
        for (const k of p.arr) covered.add(k);
      }
    }
    for (const k of available) {
      if (!covered.has(k)) {
        return { ok: false, reason: { deadCellName: cellToName.get(k) } };
      }
    }

    if (available.size === 0) return { ok: true };

    const raw = completions(available, used, 1, allowFlip, placements, false);
    if (raw.length === 0) return { ok: false, reason: {} };
    return { ok: true };
  }

  // Hint: cells of one piece drawn from a random valid completion, or null.
  function hint(opts) {
    const targets = opts.targets;
    const placed = opts.placed || [];
    const allowFlip = opts.allowFlip == null ? true : opts.allowFlip;

    const { available, used } = availableFrom(targets, placed);
    if (available.size === 0) return null;

    const raw = completions(available, used, 1, allowFlip, null, true);
    if (raw.length === 0) return null;

    const p = raw[0][0];
    return { pieceName: p.pieceName, cellNames: p.arr.map((k) => cellToName.get(k)) };
  }

  const Solver = {
    NROWS, NCOLS, key, rowOf, colOf,
    cellToName, nameToCell, ALL_CELLS,
    PIECES, PIECE_NAMES, PIECE_COLORS,
    orientations, generatePlacements,
    solve, countSolutions, feasible, hint,
  };

  globalThis.Solver = Solver;
  if (typeof module !== "undefined" && module.exports) module.exports = Solver;
})();
