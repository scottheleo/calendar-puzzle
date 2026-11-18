/*
 * Calendar Puzzle — UI (app.js).
 * Phase 2: setup screen + Mode A viewer.
 * Phase 3: Mode B interactive core (tray, select/rotate/flip, place/pickup,
 *          undo, progress, completion).
 * Hint + validation (phase 4) and save/resume (phase 5) hook in later.
 * Relies on window.Solver (solver.js).
 */
(function () {
  "use strict";

  const S = window.Solver;
  const { NROWS, NCOLS, key, rowOf, colOf, cellToName, nameToCell } = S;

  const pieceColor = (name) =>
    S.PIECE_COLORS[S.PIECE_NAMES.indexOf(name) % S.PIECE_COLORS.length];

  const $ = (sel) => document.querySelector(sel);

  // ---------- i18n + theme ----------
  let LANG = "cn";    // 'cn' | 'en'
  let THEME = "light"; // 'light' | 'dark'

  const T = {
    cn: {
      appTitle: "日历拼图",
      setupHint: "选择 3 个要露出的格子：1 个月份、1 个日期、1 个星期。",
      allowFlip: "允许翻面",
      showAnswer: "看答案",
      play: "开始游戏",
      back: "← 返回",
      prev: "← 上一个",
      next: "下一个 →",
      interactive: "互动模式",
      rotate: "旋转",
      flip: "翻面",
      deselect: "取消选择",
      undo: "撤销",
      hint: "提示",
      liveCheck: "实时校验",
      save: "保存",
      solved: "完成！🎉",
      viewAll: "查看所有解法",
      newGame: "新游戏",
      resume: "继续游戏",
      completed: "成功记录",
      resumeBtn: "继续",
      viewBtn: "查看",
      flipTag: "可翻面",
      selected: (n) => `已选 ${n} / 3`,
      computing: "计算中…",
      noSolution: "无解，请换一组格子。",
      countSome: (n) => `存在 ${n} 个解`,
      countMany: "解法很多（≥200）",
      errorPrefix: "错误：",
      savedMsg: "已保存。可在首页「继续游戏」中找到。",
      overwriteConfirm: "已有 3 个存档，将覆盖最早的一个。继续？",
      checking: "校验中…",
      deadCell: (name) => `格子「${name}」已无法被任何剩余拼块覆盖。`,
      noComplete: "剩余拼块已无法完成棋盘。",
      undoLast: "撤销上一步",
      noMoreHint: "当前局面已无解，请撤销或调整后再试。",
      iaHelp: "点击托盘里的拼块选中它，再点击棋盘放置（以拼块左上角对齐被点的格子）。空格键或点击空白处可旋转；点击已放置的拼块可拿起重放。",
      checkErr: "校验错误：",
      timePrefix: "用时 ",
    },
    en: {
      appTitle: "Calendar Puzzle",
      setupHint: "Pick 3 cells to leave open: 1 month, 1 day, 1 weekday.",
      allowFlip: "Allow flipping",
      showAnswer: "Show answer",
      play: "Play",
      back: "← Back",
      prev: "← Prev",
      next: "Next →",
      interactive: "Interactive",
      rotate: "Rotate",
      flip: "Flip",
      deselect: "Deselect",
      undo: "Undo",
      hint: "Hint",
      liveCheck: "Live check",
      save: "Save",
      solved: "Solved! 🎉",
      viewAll: "View all solutions",
      newGame: "New game",
      resume: "Resume",
      completed: "Completed",
      resumeBtn: "Resume",
      viewBtn: "View",
      flipTag: "flip on",
      selected: (n) => `${n} / 3 selected`,
      computing: "Computing…",
      noSolution: "No solution — try another set.",
      countSome: (n) => `${n} solution${n > 1 ? "s" : ""}`,
      countMany: "Many solutions (≥200)",
      errorPrefix: "Error: ",
      savedMsg: "Saved. Find it under “Resume” on the home screen.",
      overwriteConfirm: "3 saves exist; the oldest will be overwritten. Continue?",
      checking: "Checking…",
      deadCell: (name) => `Cell “${name}” can no longer be covered by any remaining piece.`,
      noComplete: "The remaining pieces cannot complete the board.",
      undoLast: "Undo last",
      noMoreHint: "No solution from here — undo or adjust and try again.",
      iaHelp: "Tap a piece, then tap the board to place it (the piece's top-left cell aligns to the cell you tap). Press Space or tap a blank area to rotate; tap a placed piece to pick it up.",
      checkErr: "Check error: ",
      timePrefix: "Time ",
    },
  };
  function t(k, arg) {
    const v = T[LANG][k];
    return typeof v === "function" ? v(arg) : v;
  }

  // display-label maps (internal identifiers stay Chinese; these are for display only)
  const MONTH_EN = {
    "1月": "Jan", "2月": "Feb", "3月": "Mar", "4月": "Apr", "5月": "May", "6月": "Jun",
    "7月": "Jul", "8月": "Aug", "9月": "Sep", "10月": "Oct", "11月": "Nov", "12月": "Dec",
  };
  const WEEK_EN = {
    "星期日": "Sun", "星期一": "Mon", "星期二": "Tue", "星期三": "Wed",
    "星期四": "Thu", "星期五": "Fri", "星期六": "Sat",
  };
  const PIECE_EN = {
    "米色直条": "Beige I", "米色异形块": "Beige F", "红色U块": "Red U", "绿色T块": "Green T",
    "黄色大L块": "Yellow L", "蓝色长L块": "Blue J", "蓝色小L块": "Blue V",
    "黄色折线块": "Yellow N", "绿色Z块": "Green Z", "红色阶梯块": "Red P",
  };
  function cellLabel(cn) {
    if (LANG === "cn") return cn;
    if (cn in MONTH_EN) return MONTH_EN[cn];
    if (cn in WEEK_EN) return WEEK_EN[cn];
    if (cn.endsWith("日")) return cn.slice(0, -1);
    return cn;
  }
  function pieceLabel(cn) { return LANG === "cn" ? cn : (PIECE_EN[cn] || cn); }
  function listJoin(arr) { return arr.join(LANG === "cn" ? "、" : ", "); }
  function targetLabels(set) {
    return listJoin([...set].map((k) => cellLabel(cellToName.get(k))));
  }

  function applyTheme() {
    document.documentElement.setAttribute("data-theme", THEME === "dark" ? "dark" : "light");
    $("#btn-theme").textContent = THEME === "dark" ? "☀️" : "🌙";
  }
  function applyLang() {
    document.documentElement.lang = LANG === "cn" ? "zh-Hans" : "en";
    for (const el of document.querySelectorAll("[data-i18n]")) {
      el.textContent = t(el.dataset.i18n);
    }
    $("#btn-lang").textContent = LANG === "cn" ? "EN" : "中";
    $("#ia-help").textContent = t("iaHelp");

    renderPickBoard();
    updateSetupStatus();
    renderResume();
    renderWins();
    if ($("#screen-viewer").classList.contains("active")) renderViewer();
    if ($("#screen-interactive").classList.contains("active")) renderInteractive();
  }


  // ---------- local geometry (independent rotate/flip for the selected piece) ----------
  function norm(pts) {
    let mr = Infinity, mc = Infinity;
    for (const [r, c] of pts) { if (r < mr) mr = r; if (c < mc) mc = c; }
    return pts.map(([r, c]) => [r - mr, c - mc]);
  }
  function rot(pts) { return norm(pts.map(([r, c]) => [c, -r])); }
  function flp(pts) { return norm(pts.map(([r, c]) => [r, -c])); }
  function firstCell(shape) {
    let best = shape[0];
    for (const p of shape) {
      if (p[0] < best[0] || (p[0] === best[0] && p[1] < best[1])) best = p;
    }
    return best;
  }

  // ---------- screen switching ----------
  function show(screenId) {
    for (const el of document.querySelectorAll(".screen")) {
      el.classList.toggle("active", el.id === screenId);
    }
  }

  // ---------- shared: grouping + cell styling for a filled board ----------
  function groupOf(k, fillMap, targetSet) {
    if (k === undefined || !cellToName.has(k)) return null;
    if (targetSet.has(k)) return "__target__";
    if (fillMap && fillMap.has(k)) return fillMap.get(k);
    return "__open__";
  }

  function brightness(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  // Build a <table class="board">. opts: { targetSet, fillMap }
  function renderFilledBoard(opts) {
    const targetSet = opts.targetSet || new Set();
    const fillMap = opts.fillMap || new Map();

    const table = document.createElement("table");
    table.className = "board";

    for (let r = 0; r < NROWS; r++) {
      const tr = document.createElement("tr");
      for (let c = 0; c < NCOLS; c++) {
        const k = key(r, c);
        const td = document.createElement("td");
        const name = cellToName.get(k);

        if (name === undefined) {
          td.className = "off";
          tr.appendChild(td);
          continue;
        }

        td.dataset.k = String(k);
        const g = groupOf(k, fillMap, targetSet);
        const isTarget = g === "__target__";
        const isOpen = g === "__open__";

        let bg, color;
        if (isTarget) { bg = "var(--cell-target-bg)"; color = "var(--cell-target-text)"; }
        else if (isOpen) { bg = "var(--cell-open-bg)"; color = "var(--cell-open-text)"; }
        else { bg = pieceColor(g); color = brightness(bg) > 0.55 ? "#000000" : "#ffffff"; }

        const border = (dr, dc) => {
          if (isTarget) return "4px solid var(--cell-target-border)";
          const nkIn = cellToName.has(key(r + dr, c + dc));
          const nk = nkIn ? key(r + dr, c + dc) : undefined;
          const ng = groupOf(nk, fillMap, targetSet);
          if (g !== null && g === ng) return "1px solid var(--line)";
          return "3px solid var(--piece-border)";
        };

        td.style.background = bg;
        td.style.color = color;
        td.style.borderTop = border(-1, 0);
        td.style.borderRight = border(0, 1);
        td.style.borderBottom = border(1, 0);
        td.style.borderLeft = border(0, -1);
        td.textContent = cellLabel(name);
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }

    const wrap = document.createElement("div");
    wrap.appendChild(table);
    return wrap;
  }

  // ================= setup screen =================
  const setup = { targets: new Set(), allowFlip: true };

  function renderPickBoard() {
    const host = $("#setup-board");
    host.innerHTML = "";
    const table = document.createElement("table");
    table.className = "board pick";

    for (let r = 0; r < NROWS; r++) {
      const tr = document.createElement("tr");
      for (let c = 0; c < NCOLS; c++) {
        const k = key(r, c);
        const td = document.createElement("td");
        const name = cellToName.get(k);
        if (name === undefined) {
          td.className = "off";
        } else {
          td.className = "cell" + (setup.targets.has(k) ? " target" : "");
          td.dataset.k = String(k);
          td.textContent = cellLabel(name);
        }
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }

    table.addEventListener("click", (e) => {
      const td = e.target.closest("td.cell");
      if (!td) return;
      const k = Number(td.dataset.k);
      if (setup.targets.has(k)) setup.targets.delete(k);
      else { if (setup.targets.size >= 3) return; setup.targets.add(k); }
      renderPickBoard();
      updateSetupStatus();
    });

    host.appendChild(table);
  }

  function targetNames() {
    return [...setup.targets].map((k) => cellToName.get(k));
  }

  function updateSetupStatus() {
    const status = $("#setup-status");
    const viewerBtn = $("#btn-viewer");
    const playBtn = $("#btn-play");

    const n = setup.targets.size;
    if (n < 3) {
      status.className = "status muted";
      status.textContent = t("selected", n);
      viewerBtn.disabled = true;
      playBtn.disabled = true;
      return;
    }

    status.className = "status muted";
    status.textContent = t("computing");
    setTimeout(() => {
      let count;
      try {
        count = S.countSolutions(targetNames(), 200, setup.allowFlip);
      } catch (err) {
        status.className = "status bad";
        status.textContent = t("errorPrefix") + err.message;
        return;
      }
      if (count === 0) {
        status.className = "status bad";
        status.textContent = t("noSolution");
        viewerBtn.disabled = true;
        playBtn.disabled = true;
      } else {
        status.className = "status good";
        status.textContent = count < 200 ? t("countSome", count) : t("countMany");
        viewerBtn.disabled = false;
        playBtn.disabled = false;
      }
    }, 20);
  }

  // ================= viewer (Mode A) =================
  const viewer = { solutions: [], index: 0, capped: false, targetSet: new Set(), titleExtra: null };

  function openViewer(targetSet) {
    const names = [...targetSet].map((k) => cellToName.get(k));
    const cap = 60;
    let sols;
    try { sols = S.solve(names, cap, setup.allowFlip); }
    catch (err) { alert(t("errorPrefix") + err.message); return; }
    if (!sols.length) return;

    viewer.solutions = sols;
    viewer.index = 0;
    viewer.capped = sols.length >= cap;
    viewer.targetSet = new Set(targetSet);
    viewer.titleExtra = null;
    renderViewer();
    show("screen-viewer");
  }

  // Show a completed (recorded) game, read-only, with its time.
  function openRecord(entry) {
    viewer.solutions = [entry.sol];
    viewer.index = 0;
    viewer.capped = false;
    viewer.targetSet = new Set(entry.targets.map((n) => nameToCell.get(n)));
    viewer.titleExtra = fmtTime(entry.elapsed);
    renderViewer();
    show("screen-viewer");
  }

  function renderViewer() {
    const sol = viewer.solutions[viewer.index];
    const fillMap = new Map();
    for (const name of Object.keys(sol)) {
      for (const cellName of sol[name]) fillMap.set(nameToCell.get(cellName), name);
    }

    let title = targetLabels(viewer.targetSet);
    if (viewer.titleExtra) title += " · " + viewer.titleExtra;
    $("#viewer-title").textContent = title;

    const board = renderFilledBoard({ targetSet: viewer.targetSet, fillMap });
    const host = $("#viewer-board");
    host.innerHTML = "";
    host.appendChild(board);

    const total = viewer.solutions.length;
    $("#viewer-count").textContent = `${viewer.index + 1} / ${total}${viewer.capped ? "+" : ""}`;
    $("#viewer-prev").disabled = viewer.index === 0;
    $("#viewer-next").disabled = viewer.index === total - 1;

    const legend = $("#viewer-legend");
    legend.innerHTML = "";
    for (const name of Object.keys(sol)) {
      const item = document.createElement("div");
      item.className = "legend-item";
      const sw = document.createElement("div");
      sw.className = "swatch";
      sw.style.background = pieceColor(name);
      const label = document.createElement("span");
      label.textContent = pieceLabel(name);
      item.appendChild(sw);
      item.appendChild(label);
      legend.appendChild(item);
    }
  }

  // ================= interactive (Mode B) =================
  const game = {
    targets: new Set(),
    allowFlip: true,
    placed: [],      // [{ pieceName, cells:[keys] }], in placement order
    sel: null,       // { name, shape:[[r,c]] } currently picked up
    lastHoverKey: null,
    startTime: null,
    validateOn: false,
  };

  function gameTargetNames() {
    return [...game.targets].map((k) => cellToName.get(k));
  }
  function placedForSolver() {
    return game.placed.map((p) => ({
      pieceName: p.pieceName,
      cells: p.cells.map((k) => cellToName.get(k)),
    }));
  }

  function occupiedMap() {
    const map = new Map(); // key -> pieceName
    for (const pl of game.placed) for (const k of pl.cells) map.set(k, pl.pieceName);
    return map;
  }

  function startPlay() {
    game.targets = new Set(setup.targets);
    game.allowFlip = setup.allowFlip;
    game.placed = [];
    game.sel = null;
    game.lastHoverKey = null;
    game.startTime = null;
    game.validateOn = false;
    $("#validate-toggle").checked = false;
    $("#ia-help").textContent = t("iaHelp");
    clearBanner();
    $("#win-overlay").classList.add("hidden");
    renderInteractive();
    show("screen-interactive");
  }

  // placement anchored so the piece's reading-order-first cell lands on anchorKey
  function computePlacement(anchorKey) {
    const occ = occupiedMap();
    const ar = rowOf(anchorKey), ac = colOf(anchorKey);
    const fc = firstCell(game.sel.shape);
    const dr = ar - fc[0], dc = ac - fc[1];
    const cells = [];
    let valid = true;
    for (const [r, c] of game.sel.shape) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= NROWS || cc < 0 || cc >= NCOLS) { valid = false; continue; }
      const kk = key(rr, cc);
      if (!cellToName.has(kk)) { valid = false; continue; }
      cells.push(kk);
      if (game.targets.has(kk) || occ.has(kk)) valid = false;
    }
    return { cells, valid };
  }

  function renderInteractive() {
    const fillMap = occupiedMap();
    const board = renderFilledBoard({ targetSet: game.targets, fillMap });
    const host = $("#ia-board");
    host.innerHTML = "";
    host.appendChild(board);
    $("#progress").textContent = `${game.placed.length} / 10`;
    renderTray();
    renderPieceControls();
    refreshPreview();
  }

  function renderTray() {
    const tray = $("#tray");
    tray.innerHTML = "";
    const placedNames = new Set(game.placed.map((p) => p.pieceName));
    for (const name of S.PIECE_NAMES) {
      if (placedNames.has(name)) continue;
      const el = miniPiece(name, S.PIECES[name]);
      if (game.sel && game.sel.name === name) el.classList.add("sel");
      el.addEventListener("click", () => selectPiece(name));
      tray.appendChild(el);
    }
  }

  function miniPiece(name, shape) {
    const s = norm(shape);
    let h = 0, w = 0;
    for (const [r, c] of s) { if (r > h) h = r; if (c > w) w = c; }
    const grid = Array.from({ length: h + 1 }, () => Array(w + 1).fill(false));
    for (const [r, c] of s) grid[r][c] = true;

    const wrap = document.createElement("div");
    wrap.className = "tray-piece";
    const table = document.createElement("table");
    for (let r = 0; r <= h; r++) {
      const tr = document.createElement("tr");
      for (let c = 0; c <= w; c++) {
        const td = document.createElement("td");
        if (grid[r][c]) td.style.background = pieceColor(name);
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    wrap.appendChild(table);
    return wrap;
  }

  function selectPiece(name) {
    game.sel = { name, shape: norm(S.PIECES[name]) };
    game.lastHoverKey = null;
    renderInteractive();
  }

  function deselect() {
    game.sel = null;
    game.lastHoverKey = null;
    renderInteractive();
  }

  function rotateSelected() {
    if (!game.sel) return;
    game.sel.shape = rot(game.sel.shape);
    renderPieceControls();
    refreshPreview();
  }
  function flipSelected() {
    if (!game.sel || !game.allowFlip) return;
    game.sel.shape = flp(game.sel.shape);
    renderPieceControls();
    refreshPreview();
  }

  function renderPieceControls() {
    const bar = $("#piece-controls");
    if (!game.sel) { bar.classList.add("hidden"); return; }
    bar.classList.remove("hidden");
    $("#btn-flip").classList.toggle("hidden", !game.allowFlip);

    const host = $("#sel-preview");
    host.innerHTML = "";
    host.appendChild(miniPieceTable(game.sel.name, game.sel.shape));
  }

  function miniPieceTable(name, shape) {
    const s = norm(shape);
    let h = 0, w = 0;
    for (const [r, c] of s) { if (r > h) h = r; if (c > w) w = c; }
    const grid = Array.from({ length: h + 1 }, () => Array(w + 1).fill(false));
    for (const [r, c] of s) grid[r][c] = true;
    const table = document.createElement("table");
    for (let r = 0; r <= h; r++) {
      const tr = document.createElement("tr");
      for (let c = 0; c <= w; c++) {
        const td = document.createElement("td");
        if (grid[r][c]) td.style.background = pieceColor(name);
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    return table;
  }

  function clearPreviewClasses() {
    for (const td of document.querySelectorAll("#ia-board td.preview-ok, #ia-board td.preview-bad")) {
      td.classList.remove("preview-ok", "preview-bad");
    }
  }

  function applyPreview(anchorKey) {
    clearPreviewClasses();
    if (!game.sel || anchorKey === null) return;
    const { cells, valid } = computePlacement(anchorKey);
    const cls = valid ? "preview-ok" : "preview-bad";
    for (const k of cells) {
      const td = document.querySelector(`#ia-board td[data-k="${k}"]`);
      if (td) td.classList.add(cls);
    }
  }

  function refreshPreview() {
    if (game.sel && game.lastHoverKey !== null) applyPreview(game.lastHoverKey);
    else clearPreviewClasses();
  }

  function shakeBoard() {
    const host = $("#ia-board");
    host.classList.remove("shake");
    void host.offsetWidth; // reflow to restart animation
    host.classList.add("shake");
  }

  function commit(anchorKey) {
    const { cells, valid } = computePlacement(anchorKey);
    if (!valid) { shakeBoard(); return; }
    if (game.startTime === null) game.startTime = Date.now();
    game.placed.push({ pieceName: game.sel.name, cells });
    game.sel = null;
    game.lastHoverKey = null;
    renderInteractive();
    if (game.placed.length === 10) { clearBanner(); onWin(); return; }
    maybeValidate();
  }

  function pickup(k) {
    const occ = occupiedMap();
    const name = occ.get(k);
    if (!name) return;
    const idx = game.placed.findIndex((p) => p.pieceName === name);
    if (idx < 0) return;
    const cells = game.placed[idx].cells;
    const shape = norm(cells.map((kk) => [rowOf(kk), colOf(kk)]));
    game.placed.splice(idx, 1);
    game.sel = { name, shape };
    game.lastHoverKey = null;
    renderInteractive();
    maybeValidate();
  }

  function undo() {
    if (!game.placed.length) return;
    game.placed.pop();
    renderInteractive();
    maybeValidate();
  }

  // ---------- hint ----------
  function showHint() {
    let res;
    try {
      res = S.hint({
        targets: gameTargetNames(),
        placed: placedForSolver(),
        allowFlip: game.allowFlip,
      });
    } catch (err) {
      $("#ia-help").textContent = t("errorPrefix") + err.message;
      return;
    }
    if (!res) {
      $("#ia-help").textContent = t("noMoreHint");
      return;
    }
    for (const name of res.cellNames) {
      const k = nameToCell.get(name);
      const td = document.querySelector(`#ia-board td[data-k="${k}"]`);
      if (td) td.classList.add("hint-cell");
    }
  }

  // ---------- validation ----------
  function clearBanner() {
    const banner = $("#val-banner");
    banner.innerHTML = "";
    banner.className = "";
  }

  function maybeValidate() {
    if (!game.validateOn || game.placed.length === 0 || game.placed.length === 10) {
      clearBanner();
      return;
    }
    const banner = $("#val-banner");
    banner.className = "banner spin";
    banner.textContent = t("checking");
    setTimeout(() => {
      const t0 = performance.now();
      let res;
      try {
        res = S.feasible({
          targets: gameTargetNames(),
          placed: placedForSolver(),
          allowFlip: game.allowFlip,
        });
      } catch (err) {
        banner.className = "banner";
        banner.textContent = t("checkErr") + err.message;
        return;
      }
      const dt = Math.round(performance.now() - t0);
      console.log("[feasible] " + dt + "ms, placed=" + game.placed.length +
        ", flip=" + game.allowFlip + " -> " + (res.ok ? "ok" : "DEAD"));
      if (res.ok) { clearBanner(); return; }

      banner.className = "banner";
      const msg = res.reason && res.reason.deadCellName
        ? t("deadCell", cellLabel(res.reason.deadCellName))
        : t("noComplete");
      const span = document.createElement("span");
      span.textContent = "⚠️ " + msg;
      const btn = document.createElement("button");
      btn.className = "btn mini";
      btn.textContent = t("undoLast");
      btn.addEventListener("click", undo);
      banner.appendChild(span);
      banner.appendChild(btn);
    }, 20);
  }

  function fmtTime(ms) {
    const s = Math.round(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return LANG === "cn"
      ? `${m}分${String(r).padStart(2, "0")}秒`
      : `${m}m ${String(r).padStart(2, "0")}s`;
  }

  function onWin() {
    const elapsed = game.startTime ? Date.now() - game.startTime : 0;
    $("#win-time").textContent = t("timePrefix") + fmtTime(elapsed);
    recordWin(elapsed);
    $("#win-overlay").classList.remove("hidden");
  }

  function wireInteractiveBoard() {
    const host = $("#ia-board");

    host.addEventListener("click", (e) => {
      const td = e.target.closest("td[data-k]");
      if (!td) return;
      const k = Number(td.dataset.k);
      const occ = occupiedMap();
      if (occ.has(k)) { pickup(k); return; }
      if (!game.sel) return;
      commit(k);
    });

    host.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return; // hover preview is desktop-only
      if (!game.sel) return;
      const td = e.target.closest("td[data-k]");
      if (!td) return;
      const k = Number(td.dataset.k);
      if (k === game.lastHoverKey) return;
      game.lastHoverKey = k;
      applyPreview(k);
    });

    host.addEventListener("pointerleave", () => {
      game.lastHoverKey = null;
      clearPreviewClasses();
    });
  }

  // ---------- save / resume (localStorage, up to 3 slots) ----------
  const SAVE_KEY = "calendarPuzzleSaves";

  function loadSaves() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || "[]"); }
    catch (e) { return []; }
  }
  function writeSaves(arr) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(arr)); return true; }
    catch (e) { alert("无法保存：浏览器存储不可用。"); return false; }
  }

  function fmtDate(ts) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function saveGame() {
    const entry = {
      id: Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      savedAt: Date.now(),
      targets: gameTargetNames(),
      allowFlip: game.allowFlip,
      validateOn: game.validateOn,
      placed: placedForSolver(),
      elapsed: game.startTime ? Date.now() - game.startTime : 0,
    };
    let saves = loadSaves();
    if (saves.length >= 3) {
      if (!confirm(t("overwriteConfirm"))) return;
      saves.sort((a, b) => a.savedAt - b.savedAt);
      saves.shift();
    }
    saves.push(entry);
    if (writeSaves(saves)) {
      $("#ia-help").textContent = t("savedMsg");
      renderResume();
    }
  }

  function deleteSave(id) {
    writeSaves(loadSaves().filter((s) => s.id !== id));
    renderResume();
  }

  function resumeGame(entry) {
    game.targets = new Set(entry.targets.map((n) => nameToCell.get(n)));
    game.allowFlip = entry.allowFlip;
    game.placed = entry.placed.map((p) => ({
      pieceName: p.pieceName,
      cells: p.cells.map((n) => nameToCell.get(n)),
    }));
    game.sel = null;
    game.lastHoverKey = null;
    game.validateOn = !!entry.validateOn;
    game.startTime = entry.elapsed ? Date.now() - entry.elapsed : null;
    $("#validate-toggle").checked = game.validateOn;
    $("#ia-help").textContent = t("iaHelp");
    clearBanner();
    $("#win-overlay").classList.add("hidden");
    renderInteractive();
    maybeValidate();
    show("screen-interactive");
  }

  function renderResume() {
    const host = $("#resume-area");
    host.innerHTML = "";
    const saves = loadSaves();
    if (!saves.length) return;

    const title = document.createElement("div");
    title.className = "resume-title";
    title.textContent = t("resume");
    host.appendChild(title);

    saves.sort((a, b) => b.savedAt - a.savedAt);
    for (const entry of saves) {
      const row = document.createElement("div");
      row.className = "resume-row";

      const info = document.createElement("div");
      info.className = "resume-info";
      const tl = document.createElement("div");
      tl.className = "resume-targets";
      tl.textContent = listJoin(entry.targets.map((n) => cellLabel(n)));
      const m = document.createElement("div");
      m.className = "resume-meta";
      m.textContent = `${entry.placed.length}/10 · ${fmtDate(entry.savedAt)}` +
        (entry.allowFlip ? " · " + t("flipTag") : "");
      info.appendChild(tl);
      info.appendChild(m);

      const go = document.createElement("button");
      go.className = "btn mini";
      go.textContent = t("resumeBtn");
      go.addEventListener("click", () => resumeGame(entry));

      const del = document.createElement("button");
      del.className = "btn mini ghost";
      del.textContent = "✕";
      del.addEventListener("click", () => deleteSave(entry.id));

      row.appendChild(info);
      row.appendChild(go);
      row.appendChild(del);
      host.appendChild(row);
    }
  }

  // ---------- completed-game records (localStorage, up to 20) ----------
  const WINS_KEY = "calendarPuzzleWins";

  function loadWins() {
    try { return JSON.parse(localStorage.getItem(WINS_KEY) || "[]"); }
    catch (e) { return []; }
  }
  function writeWins(arr) {
    try { localStorage.setItem(WINS_KEY, JSON.stringify(arr)); return true; }
    catch (e) { return false; }
  }

  function recordWin(elapsed) {
    const sol = {};
    for (const p of game.placed) sol[p.pieceName] = p.cells.map((k) => cellToName.get(k));
    const entry = {
      id: Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      savedAt: Date.now(),
      targets: gameTargetNames(),
      allowFlip: game.allowFlip,
      elapsed,
      sol,
    };
    let wins = loadWins();
    wins.unshift(entry);
    if (wins.length > 20) wins = wins.slice(0, 20);
    writeWins(wins);
    renderWins();
  }

  function deleteWin(id) {
    writeWins(loadWins().filter((s) => s.id !== id));
    renderWins();
  }

  function renderWins() {
    const host = $("#wins-area");
    host.innerHTML = "";
    const wins = loadWins();
    if (!wins.length) return;

    const title = document.createElement("div");
    title.className = "resume-title";
    title.textContent = t("completed");
    host.appendChild(title);

    for (const entry of wins) {
      const row = document.createElement("div");
      row.className = "resume-row";

      const info = document.createElement("div");
      info.className = "resume-info";
      const tl = document.createElement("div");
      tl.className = "resume-targets";
      tl.textContent = listJoin(entry.targets.map((n) => cellLabel(n)));
      const m = document.createElement("div");
      m.className = "resume-meta";
      m.textContent = `${fmtTime(entry.elapsed)} · ${fmtDate(entry.savedAt)}` +
        (entry.allowFlip ? " · " + t("flipTag") : "");
      info.appendChild(tl);
      info.appendChild(m);

      const go = document.createElement("button");
      go.className = "btn mini";
      go.textContent = t("viewBtn");
      go.addEventListener("click", () => openRecord(entry));

      const del = document.createElement("button");
      del.className = "btn mini ghost";
      del.textContent = "✕";
      del.addEventListener("click", () => deleteWin(entry.id));

      row.appendChild(info);
      row.appendChild(go);
      row.appendChild(del);
      host.appendChild(row);
    }
  }

  // ---------- wiring ----------
  function init() {
    try { LANG = localStorage.getItem("calendarPuzzleLang") || "cn"; } catch (e) {}
    try { THEME = localStorage.getItem("calendarPuzzleTheme") || "light"; } catch (e) {}
    applyTheme();
    applyLang(); // renders pick board, status, resume list, wins list, static text

    $("#btn-theme").addEventListener("click", () => {
      THEME = THEME === "dark" ? "light" : "dark";
      try { localStorage.setItem("calendarPuzzleTheme", THEME); } catch (e) {}
      applyTheme();
    });
    $("#btn-lang").addEventListener("click", () => {
      LANG = LANG === "cn" ? "en" : "cn";
      try { localStorage.setItem("calendarPuzzleLang", LANG); } catch (e) {}
      applyLang();
    });

    $("#flip-toggle").addEventListener("change", (e) => {
      setup.allowFlip = e.target.checked;
      if (setup.targets.size === 3) updateSetupStatus();
    });

    $("#btn-viewer").addEventListener("click", () => openViewer(setup.targets));
    $("#btn-play").addEventListener("click", startPlay);

    $("#viewer-prev").addEventListener("click", () => {
      if (viewer.index > 0) { viewer.index--; renderViewer(); }
    });
    $("#viewer-next").addEventListener("click", () => {
      if (viewer.index < viewer.solutions.length - 1) { viewer.index++; renderViewer(); }
    });

    $("#btn-rotate").addEventListener("click", rotateSelected);
    $("#btn-flip").addEventListener("click", flipSelected);
    $("#btn-deselect").addEventListener("click", deselect);
    $("#btn-undo").addEventListener("click", undo);
    $("#btn-hint").addEventListener("click", showHint);
    $("#btn-save").addEventListener("click", saveGame);
    $("#validate-toggle").addEventListener("change", (e) => {
      game.validateOn = e.target.checked;
      maybeValidate();
    });

    // rotate shortcuts: Space / R on keyboard, or tap a blank area
    document.addEventListener("keydown", (e) => {
      if (!$("#screen-interactive").classList.contains("active") || !game.sel) return;
      if (e.code === "Space" || e.key === " ") { e.preventDefault(); rotateSelected(); }
      else if (e.key === "r" || e.key === "R") { rotateSelected(); }
      else if ((e.key === "f" || e.key === "F") && game.allowFlip) { flipSelected(); }
    });
    $("#screen-interactive").addEventListener("click", (e) => {
      if (!game.sel) return;
      if (e.target.closest("td, button, input, label, .tray-piece, .piece-controls, #val-banner, .overlay")) return;
      rotateSelected();
    });

    $("#win-new").addEventListener("click", () => {
      $("#win-overlay").classList.add("hidden");
      show("screen-setup");
    });
    $("#win-solutions").addEventListener("click", () => {
      $("#win-overlay").classList.add("hidden");
      openViewer(game.targets);
    });

    wireInteractiveBoard();

    for (const btn of document.querySelectorAll("[data-back]")) {
      btn.addEventListener("click", () => show("screen-setup"));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
