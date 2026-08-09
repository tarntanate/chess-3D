// ตัวควบคุมเกมหลัก: เชื่อมกติกา (engine) เข้ากับฉาก 3D และหน้าจอผู้ใช้ภาษาไทย
import {
    Chess, WHITE, BLACK, START_FEN, PIECE_TH, PIECE_EN, PIECE_MOVE_TH, PIECE_POINTS,
    PIECE_GLYPH, COLOR_TH, toAlgebraic
} from './src/engine.js';
import { DIFFICULTY } from './src/ai.js';
import { Board3D } from './src/graphics.js';
import { LESSONS } from './src/tutorial.js';

const $ = (id) => document.getElementById(id);

const state = {
    mode: 'ai',              // 'ai' | 'local' | 'tutorial'
    difficulty: 3,
    playerColor: WHITE,
    selected: -1,
    legalForSelected: [],
    lastMove: null,
    hint: null,
    thinking: false,
    started: false,
    over: false,
    limitStartPly: null,
    lessonIndex: 0,
    settings: {
        showMoves: true,
        limitEnabled: true,
        limitThreshold: 6,
        limitMoves: 30
    }
};

const game = new Chess(START_FEN);
game.trackRepetition = true;
game.keyCounts.set(game.positionKey(), 1);

const board = new Board3D($('scene'));
board.onPick = onSquarePicked;

/* ---------------- เอนจินคอมพิวเตอร์ (Web Worker + สำรอง) ---------------- */

let worker = null;
let workerSeq = 0;
const pending = new Map();
let fallbackAI = null;

try {
    worker = new Worker(new URL('./src/ai.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
        const cb = pending.get(e.data.id);
        if (cb) { pending.delete(e.data.id); cb(e.data.move); }
    };
    worker.onerror = () => {
        worker = null;
        for (const [, cb] of pending) cb(null);
        pending.clear();
    };
} catch {
    worker = null;
}

function requestMove(fen, opts) {
    return new Promise((resolve) => {
        if (worker) {
            const id = ++workerSeq;
            pending.set(id, resolve);
            worker.postMessage({ id, fen, opts });
            return;
        }
        // สำรอง: คิดในเธรดหลัก (กรณีเบราว์เซอร์ไม่รองรับ module worker)
        setTimeout(async () => {
            if (!fallbackAI) fallbackAI = await import('./src/ai.js');
            resolve(fallbackAI.findBestMove(fen, opts));
        }, 30);
    });
}

/* ---------------- เมนูและการตั้งค่า ---------------- */

function bindChoices(containerId, onSelect) {
    const el = $(containerId);
    el.addEventListener('click', (e) => {
        const btn = e.target.closest('.choice');
        if (!btn) return;
        el.querySelectorAll('.choice').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        onSelect(btn.dataset.value);
    });
}

bindChoices('choice-mode', (v) => {
    state.mode = v;
    $('field-difficulty').hidden = v !== 'ai';
    $('field-side').hidden = v !== 'ai';
});
bindChoices('choice-difficulty', (v) => { state.difficulty = Number(v); });
bindChoices('choice-side', (v) => { state.pendingSide = v; });

$('opt-show-moves').addEventListener('change', (e) => { state.settings.showMoves = e.target.checked; refreshHighlights(); });
$('opt-limit').addEventListener('change', (e) => { state.settings.limitEnabled = e.target.checked; updateLimit(); updateHud(); });
$('opt-limit-threshold').addEventListener('change', (e) => {
    state.settings.limitThreshold = clamp(Number(e.target.value), 3, 16);
    e.target.value = state.settings.limitThreshold;
    updateLimit(); updateHud();
});
$('opt-limit-moves').addEventListener('change', (e) => {
    state.settings.limitMoves = clamp(Number(e.target.value), 5, 100);
    e.target.value = state.settings.limitMoves;
    updateLimit(); updateHud();
});

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));

$('btn-start').addEventListener('click', startGame);
$('btn-resume').addEventListener('click', () => { $('menu').hidden = true; });
$('btn-menu').addEventListener('click', () => {
    $('btn-resume').hidden = !state.started;
    $('menu').hidden = false;
});
$('btn-flip').addEventListener('click', () => {
    board.setOrientation(board.orientation === WHITE ? BLACK : WHITE);
});
$('btn-undo').addEventListener('click', undo);
$('btn-hint').addEventListener('click', showHint);
$('btn-rematch').addEventListener('click', () => { $('result').hidden = true; startGame(); });
$('btn-result-menu').addEventListener('click', () => {
    $('result').hidden = true;
    $('btn-resume').hidden = true;
    $('menu').hidden = false;
});

/* ---------------- เริ่มเกม ---------------- */

function startGame() {
    $('menu').hidden = true;
    $('result').hidden = true;
    state.started = true;
    state.over = false;
    state.selected = -1;
    state.legalForSelected = [];
    state.lastMove = null;
    state.hint = null;
    state.limitStartPly = null;

    if (state.mode === 'ai') {
        const pick = state.pendingSide || 'w';
        state.playerColor = pick === 'random' ? (Math.random() < 0.5 ? WHITE : BLACK) : (pick === 'b' ? BLACK : WHITE);
    } else {
        state.playerColor = WHITE;
    }

    $('tutorial-panel').hidden = state.mode !== 'tutorial';
    $('panel-captured').hidden = state.mode === 'tutorial';

    if (state.mode === 'tutorial') {
        setupTutorialUI();
        loadLesson(state.lessonIndex);
    } else {
        resetTo(START_FEN);
        board.setOrientation(state.playerColor);
        if (state.mode === 'ai' && game.turn !== state.playerColor) setTimeout(computerMove, 500);
    }
    updateHud();
    renderMoveList();
}

function resetTo(fen) {
    game.load(fen);
    game.trackRepetition = true;
    game.keyCounts = new Map();
    game.keyCounts.set(game.positionKey(), 1);
    state.selected = -1;
    state.legalForSelected = [];
    state.lastMove = null;
    state.hint = null;
    state.over = false;
    state.limitStartPly = null;
    board.syncBoard(game.board);
    updateLimit();
    hidePieceInfo();
    refreshHighlights();
    renderMoveList();
    updateHud();
}

/* ---------------- การโต้ตอบบนกระดาน ---------------- */

function canControl(color) {
    if (state.over || state.thinking || board.animating) return false;
    if (state.mode === 'ai') return color === state.playerColor;
    return true; // local และ tutorial ควบคุมได้ทั้งสองฝ่าย
}

function onSquarePicked(square) {
    if (!state.started) return;
    const piece = game.board[square];

    if (state.selected >= 0) {
        const candidates = state.legalForSelected.filter((m) => m.to === square);
        if (candidates.length) {
            if (candidates.length > 1 && candidates[0].promotion) {
                askPromotion(candidates);
            } else {
                playMove(candidates[0]);
            }
            return;
        }
    }

    if (piece && piece.color === game.turn && canControl(piece.color)) {
        state.selected = square;
        state.legalForSelected = game.moves({ square });
        state.hint = null;
    } else {
        state.selected = -1;
        state.legalForSelected = [];
    }
    showPieceInfo(piece, square);
    refreshHighlights();
}

/** แถบบอกชื่อหมากที่คลิก ช่วยมือใหม่จำชื่อและวิธีเดิน */
function showPieceInfo(piece, square) {
    const el = $('piece-info');
    if (!piece) { el.hidden = true; return; }
    const t = piece.type;
    const movable = piece.color === game.turn && canControl(piece.color);
    const count = movable ? game.moves({ square }).length : -1;
    $('pi-glyph').textContent = PIECE_GLYPH[piece.color][t];
    $('pi-name').innerHTML = `${PIECE_TH[t]} <span class="en">(${PIECE_EN[t]})</span>` +
        ` · ${COLOR_TH[piece.color]} · ${toAlgebraic(square)}` +
        (PIECE_POINTS[t] ? ` <span class="pts">· ≈ ${PIECE_POINTS[t]} แต้ม</span>` : '');
    $('pi-desc').textContent = PIECE_MOVE_TH[t] +
        (count === 0 ? ' — ตอนนี้เดินไม่ได้' : count > 0 ? ` — ตอนนี้เดินได้ ${count} ช่อง` : '');
    el.hidden = false;
}

function hidePieceInfo() {
    $('piece-info').hidden = true;
}

function askPromotion(candidates) {
    const wrap = $('promo-choices');
    wrap.innerHTML = '';
    const color = candidates[0].color;
    for (const type of ['q', 'r', 'b', 'n']) {
        const move = candidates.find((m) => m.promotion === type);
        if (!move) continue;
        const btn = document.createElement('button');
        btn.innerHTML = `${PIECE_GLYPH[color][type]}<small>${PIECE_TH[type]}</small>`;
        btn.addEventListener('click', () => {
            $('promo').hidden = true;
            playMove(move);
        }, { once: true });
        wrap.appendChild(btn);
    }
    $('promo').hidden = false;
}

function playMove(move) {
    state.selected = -1;
    state.legalForSelected = [];
    state.hint = null;
    hidePieceInfo();

    game.makeMove(move);
    state.lastMove = { from: move.from, to: move.to };
    addMoveRecord(move);
    updateLimit();

    board.animateMove(move, game.board, () => {
        refreshHighlights();
        updateHud();
        const finished = checkGameEnd();
        if (state.mode === 'tutorial') checkLessonGoal(move);
        if (!finished && state.mode === 'ai' && game.turn !== state.playerColor) {
            setTimeout(computerMove, 260);
        }
    });
    refreshHighlights();
    updateHud();
}

async function computerMove() {
    if (state.over || state.mode !== 'ai') return;
    state.thinking = true;
    hidePieceInfo();
    $('thinking').hidden = false;
    const cfg = DIFFICULTY[state.difficulty];
    const found = await requestMove(game.fen(), cfg);
    state.thinking = false;
    $('thinking').hidden = true;
    if (state.over || !found) return;

    const legal = game.moves();
    const move = legal.find((m) => m.from === found.from && m.to === found.to &&
        (m.promotion || null) === (found.promotion || null)) || legal[0];
    if (move) playMove(move);
}

/* ---------------- ย้อนกลับ / คำแนะนำ ---------------- */

function undo() {
    if (state.thinking || board.animating || !game.history.length) return;
    const steps = (state.mode === 'ai' && game.history.length >= 2) ? 2 : 1;
    for (let i = 0; i < steps; i++) game.undoMove();
    moveRecords.length = Math.max(0, moveRecords.length - steps);
    state.over = false;
    state.selected = -1;
    state.legalForSelected = [];
    const last = game.history[game.history.length - 1];
    state.lastMove = last ? { from: last.move.from, to: last.move.to } : null;
    state.hint = null;
    updateLimit();
    board.syncBoard(game.board);
    refreshHighlights();
    renderMoveList();
    updateHud();
}

async function showHint() {
    if (state.over || state.thinking || board.animating) return;
    if (state.mode === 'ai' && game.turn !== state.playerColor) return;
    hidePieceInfo();
    $('thinking').hidden = false;
    state.thinking = true;
    const found = await requestMove(game.fen(), { depth: 3, timeMs: 2000, quiescence: true });
    state.thinking = false;
    $('thinking').hidden = true;
    if (!found) return;
    state.hint = { from: found.from, to: found.to };
    refreshHighlights();
    toast(`ลองเดิน ${toAlgebraic(found.from)} → ${toAlgebraic(found.to)}`);
}

/* ---------------- กติกาจำกัดตาเดินท้ายเกม ---------------- */

function updateLimit() {
    if (!state.settings.limitEnabled) { state.limitStartPly = null; return; }
    const total = game.countPieces();
    if (total > state.settings.limitThreshold) {
        state.limitStartPly = null;
        return;
    }
    if (state.limitStartPly === null || state.limitStartPly > game.history.length) {
        state.limitStartPly = game.history.length;
    }
}

function limitRemaining() {
    if (state.limitStartPly === null) return null;
    const used = game.history.length - state.limitStartPly;
    return Math.max(0, state.settings.limitMoves * 2 - used);
}

/* ---------------- ตรวจจบเกม ---------------- */

function checkGameEnd() {
    const st = game.status();
    if (st.over) {
        finish(st.winner, st.reason);
        return true;
    }
    const remain = limitRemaining();
    if (remain !== null && remain <= 0) {
        finish(null, 'limit');
        return true;
    }
    return false;
}

const RESULT_TEXT = {
    checkmate: 'รุกฆาต!',
    stalemate: 'เสมอ — อับ (Stalemate) ฝ่ายถึงตาเดินไม่มีตาเดินที่ถูกกติกา แต่ไม่ได้ถูกรุก',
    material: 'เสมอ — หมากที่เหลือไม่พอทำรุกฆาตได้',
    fiftymove: 'เสมอ — ครบ 50 ตาเดินโดยไม่มีการกินและไม่มีเบี้ยเดิน',
    repetition: 'เสมอ — เกิดตำแหน่งเดิมซ้ำ 3 ครั้ง',
    limit: 'เสมอ — ครบจำนวนตาเดินที่กำหนดไว้ในช่วงท้ายเกม'
};

function finish(winner, reason) {
    state.over = true;
    if (state.mode === 'tutorial') {
        if (reason === 'checkmate') setTutorialStatus(`🎉 รุกฆาตสำเร็จ! ${COLOR_TH[winner]}ชนะ`, false);
        else setTutorialStatus(RESULT_TEXT[reason] || 'จบบทเรียน', true);
        updateHud();
        return;
    }
    let title, text;
    if (winner) {
        const isPlayer = state.mode === 'ai' && winner === state.playerColor;
        title = state.mode === 'ai' ? (isPlayer ? '🏆 คุณชนะ!' : '😢 คุณแพ้') : `🏆 ${COLOR_TH[winner]}ชนะ`;
        text = `${RESULT_TEXT.checkmate} ${COLOR_TH[winner]}เป็นฝ่ายชนะ`;
    } else {
        title = '🤝 เสมอ';
        text = RESULT_TEXT[reason] || 'เกมจบลงด้วยผลเสมอ';
    }
    $('result-title').textContent = title;
    $('result-text').textContent = text;
    $('result').hidden = false;
    updateHud();
}

/* ---------------- หน้าจอ ---------------- */

const moveRecords = [];

function addMoveRecord(move) {
    const check = game.inCheck(game.turn);
    const mate = check && game.moves().length === 0;
    moveRecords.push({
        no: Math.floor(moveRecords.length / 2) + 1,
        color: move.color,
        glyph: PIECE_GLYPH[move.color][move.promotion || move.piece],
        text: game.describeMove(move) + (mate ? ' รุกฆาต#' : check ? ' รุก+' : '')
    });
    renderMoveList();
}

function renderMoveList() {
    const list = $('move-list');
    list.innerHTML = '';
    moveRecords.forEach((r, i) => {
        const li = document.createElement('li');
        if (i === moveRecords.length - 1) li.className = 'latest';
        li.innerHTML = `<span class="num">${r.color === WHITE ? r.no + '.' : ''}</span>` +
            `<span class="glyph">${r.glyph}</span><span>${r.text}</span>`;
        list.appendChild(li);
    });
    list.scrollTop = list.scrollHeight;
}

function refreshHighlights() {
    const moves = [];
    const captures = [];
    if (state.settings.showMoves) {
        for (const m of state.legalForSelected) {
            if (m.captured) captures.push(m.to);
            else moves.push(m.to);
        }
    }
    const checkSq = game.inCheck(game.turn) ? game.kingSquare(game.turn) : -1;
    board.setHighlights({
        selected: state.selected,
        moves: [...new Set(moves)],
        captures: [...new Set(captures)],
        last: state.lastMove,
        check: checkSq,
        hint: state.hint
    });
}

function updateHud() {
    const turnEl = $('turn-indicator');
    const check = game.inCheck(game.turn);
    turnEl.classList.toggle('black', game.turn === BLACK);
    turnEl.classList.toggle('check', check && !state.over);
    let label = `ตาของ${COLOR_TH[game.turn]}`;
    if (state.mode === 'ai') label += game.turn === state.playerColor ? ' (คุณ)' : ' (คอมพิวเตอร์)';
    if (state.over) label = 'เกมจบแล้ว';
    else if (check) label += ' — ถูกรุก!';
    $('turn-text').textContent = label;

    const modeText = state.mode === 'ai'
        ? `กับคอมพิวเตอร์ (${DIFFICULTY[state.difficulty].name})`
        : state.mode === 'local' ? 'เล่น 2 คน' : 'โหมดเรียนรู้';
    $('stat-mode').textContent = modeText;
    $('stat-move').textContent = String(game.fullmove);

    const remain = limitRemaining();
    $('row-limit').hidden = remain === null;
    if (remain !== null) $('stat-limit').textContent = `เหลือ ${Math.ceil(remain / 2)} ตา`;

    const msg = $('status-msg');
    msg.className = 'status-msg';
    if (state.over) {
        msg.textContent = 'เกมจบแล้ว — กด "เมนู" เพื่อเริ่มใหม่';
    } else if (remain !== null && remain <= 10) {
        msg.textContent = `ใกล้ครบกำหนดตาเดินท้ายเกม (${Math.ceil(remain / 2)} ตา)`;
        msg.classList.add('warn');
    } else if (check) {
        msg.textContent = `${COLOR_TH[game.turn]}ถูกรุก ต้องแก้รุกทันที`;
        msg.classList.add('bad');
    } else if (game.halfmove >= 80) {
        msg.textContent = `กฎ 50 ตาเดิน: เหลืออีก ${Math.ceil((100 - game.halfmove) / 2)} ตา`;
        msg.classList.add('warn');
    } else {
        msg.textContent = '';
    }

    $('btn-undo').disabled = !game.history.length || state.thinking;
    $('btn-hint').disabled = state.over || state.thinking;

    updateCaptured();
}

function updateCaptured() {
    const start = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
    const alive = { w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 } };
    for (const p of game.board) if (p) alive[p.color][p.type]++;

    const build = (color) => {
        let out = '';
        let score = 0;
        for (const t of ['q', 'r', 'b', 'n', 'p']) {
            const lost = Math.max(0, start[t] - alive[color][t]);
            out += PIECE_GLYPH[color][t].repeat(lost);
            score += lost * PIECE_POINTS[t];
        }
        return { out, score };
    };
    const lostBlack = build(BLACK);   // ขาวกินได้
    const lostWhite = build(WHITE);   // ดำกินได้
    $('cap-by-white').textContent = lostBlack.out || '—';
    $('cap-by-black').textContent = lostWhite.out || '—';

    const diff = lostBlack.score - lostWhite.score;
    $('material-diff').textContent = diff === 0 ? 'เสมอกัน'
        : diff > 0 ? `ฝ่ายขาว +${diff}` : `ฝ่ายดำ +${-diff}`;
}

let toastTimer = null;
function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

/* ---------------- โหมดเรียนรู้ ---------------- */

function setupTutorialUI() {
    const sel = $('tut-select');
    if (sel.options.length === 0) {
        LESSONS.forEach((l, i) => {
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.textContent = l.title;
            sel.appendChild(opt);
        });
        sel.addEventListener('change', () => loadLesson(Number(sel.value)));
        $('tut-prev').addEventListener('click', () => loadLesson(state.lessonIndex - 1));
        $('tut-next').addEventListener('click', () => loadLesson(state.lessonIndex + 1));
        $('tut-reset').addEventListener('click', () => loadLesson(state.lessonIndex));
        $('tut-close').addEventListener('click', () => { $('tutorial-panel').hidden = true; });
    }
}

function loadLesson(index) {
    state.lessonIndex = clamp(index, 0, LESSONS.length - 1);
    const lesson = LESSONS[state.lessonIndex];
    $('tut-select').value = String(state.lessonIndex);
    $('tut-content').innerHTML = lesson.html;
    $('tut-prev').disabled = state.lessonIndex === 0;
    $('tut-next').disabled = state.lessonIndex === LESSONS.length - 1;
    setTutorialStatus('', false);
    moveRecords.length = 0;
    resetTo(lesson.fen);
    board.setOrientation(WHITE);
}

function setTutorialStatus(text, fail) {
    const el = $('tut-status');
    el.textContent = text;
    el.classList.toggle('fail', !!fail);
}

function checkLessonGoal(move) {
    const lesson = LESSONS[state.lessonIndex];
    if (!lesson || lesson.goal === 'free') return;
    if (lesson.goal === 'mate') {
        const st = game.status();
        if (st.over && st.reason === 'checkmate') {
            setTutorialStatus('🎉 เยี่ยมมาก! ทำรุกฆาตสำเร็จ กด "ถัดไป" เพื่อเรียนบทต่อไป', false);
        } else if (move.color === WHITE) {
            setTutorialStatus('ยังไม่รุกฆาต ลองใหม่ได้ด้วยปุ่ม "เริ่มบทนี้ใหม่"', true);
        }
    } else if (lesson.goal === 'promote') {
        if (move.promotion && move.color === WHITE) {
            setTutorialStatus(`🎉 เลื่อนขั้นเป็น${PIECE_TH[move.promotion]}สำเร็จ!`, false);
        }
    }
}

/* ---------------- เริ่มต้น ---------------- */

board.syncBoard(game.board);
refreshHighlights();
updateHud();
$('field-difficulty').hidden = false;
$('field-side').hidden = false;

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        state.selected = -1;
        state.legalForSelected = [];
        hidePieceInfo();
        refreshHighlights();
    }
    if (e.key.toLowerCase() === 'u') undo();
    if (e.key.toLowerCase() === 'f') board.setOrientation(board.orientation === WHITE ? BLACK : WHITE);
});
