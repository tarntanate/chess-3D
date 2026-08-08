// เอนจินคิดหมากของคอมพิวเตอร์: negamax + alpha-beta + quiescence + iterative deepening
import { Chess, WHITE, fileOf, rankOf } from './engine.js';

const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

const PST = {
    p: [
        0, 0, 0, 0, 0, 0, 0, 0,
        5, 10, 10, -20, -20, 10, 10, 5,
        5, -5, -10, 0, 0, -10, -5, 5,
        0, 0, 0, 20, 20, 0, 0, 0,
        5, 5, 10, 25, 25, 10, 5, 5,
        10, 10, 20, 30, 30, 20, 10, 10,
        50, 50, 50, 50, 50, 50, 50, 50,
        0, 0, 0, 0, 0, 0, 0, 0
    ],
    n: [
        -50, -40, -30, -30, -30, -30, -40, -50,
        -40, -20, 0, 5, 5, 0, -20, -40,
        -30, 5, 10, 15, 15, 10, 5, -30,
        -30, 0, 15, 20, 20, 15, 0, -30,
        -30, 5, 15, 20, 20, 15, 5, -30,
        -30, 0, 10, 15, 15, 10, 0, -30,
        -40, -20, 0, 0, 0, 0, -20, -40,
        -50, -40, -30, -30, -30, -30, -40, -50
    ],
    b: [
        -20, -10, -10, -10, -10, -10, -10, -20,
        -10, 5, 0, 0, 0, 0, 5, -10,
        -10, 10, 10, 10, 10, 10, 10, -10,
        -10, 0, 10, 10, 10, 10, 0, -10,
        -10, 5, 5, 10, 10, 5, 5, -10,
        -10, 0, 5, 10, 10, 5, 0, -10,
        -10, 0, 0, 0, 0, 0, 0, -10,
        -20, -10, -10, -10, -10, -10, -10, -20
    ],
    r: [
        0, 0, 5, 10, 10, 5, 0, 0,
        -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        5, 10, 10, 10, 10, 10, 10, 5,
        0, 0, 0, 0, 0, 0, 0, 0
    ],
    q: [
        -20, -10, -10, -5, -5, -10, -10, -20,
        -10, 0, 5, 0, 0, 0, 0, -10,
        -10, 5, 5, 5, 5, 5, 0, -10,
        0, 0, 5, 5, 5, 5, 0, -5,
        -5, 0, 5, 5, 5, 5, 0, -5,
        -10, 0, 5, 5, 5, 5, 0, -10,
        -10, 0, 0, 0, 0, 0, 0, -10,
        -20, -10, -10, -5, -5, -10, -10, -20
    ],
    k: [
        20, 30, 10, 0, 0, 10, 30, 20,
        20, 20, 0, 0, 0, 0, 20, 20,
        -10, -20, -20, -20, -20, -20, -20, -10,
        -20, -30, -30, -40, -40, -30, -30, -20,
        -30, -40, -40, -50, -50, -40, -40, -30,
        -30, -40, -40, -50, -50, -40, -40, -30,
        -30, -40, -40, -50, -50, -40, -40, -30,
        -30, -40, -40, -50, -50, -40, -40, -30
    ],
    kEnd: [
        -50, -30, -30, -30, -30, -30, -30, -50,
        -30, -30, 0, 0, 0, 0, -30, -30,
        -30, -10, 20, 30, 30, 20, -10, -30,
        -30, -10, 30, 40, 40, 30, -10, -30,
        -30, -10, 30, 40, 40, 30, -10, -30,
        -30, -10, 20, 30, 30, 20, -10, -30,
        -30, -20, -10, 0, 0, -10, -20, -30,
        -50, -40, -30, -20, -20, -30, -40, -50
    ]
};

const mirror = (i) => squareMirror[i];
const squareMirror = new Array(64);
for (let i = 0; i < 64; i++) squareMirror[i] = (7 - rankOf(i)) * 8 + fileOf(i);

function evaluate(game) {
    let score = 0;
    let material = 0;
    const pieces = [];
    for (let i = 0; i < 64; i++) {
        const p = game.board[i];
        if (!p) continue;
        pieces.push(p);
        if (p.type !== 'k' && p.type !== 'p') material += VALUE[p.type];
    }
    const endgame = material <= 1300;
    for (let i = 0; i < 64; i++) {
        const p = game.board[i];
        if (!p) continue;
        const table = p.type === 'k' ? (endgame ? PST.kEnd : PST.k) : PST[p.type];
        const idx = p.color === WHITE ? i : mirror(i);
        const v = VALUE[p.type] + table[idx];
        score += p.color === WHITE ? v : -v;
    }
    // โบนัสคู่บิชอปเล็กน้อย
    const bishops = { w: 0, b: 0 };
    for (const p of pieces) if (p.type === 'b') bishops[p.color]++;
    if (bishops.w >= 2) score += 25;
    if (bishops.b >= 2) score -= 25;
    return game.turn === WHITE ? score : -score;
}

function orderMoves(moves) {
    for (const m of moves) {
        m._score = 0;
        if (m.captured) m._score += 10 * VALUE[m.captured] - VALUE[m.piece];
        if (m.promotion) m._score += VALUE[m.promotion];
        if (m.flag === 'castleK' || m.flag === 'castleQ') m._score += 60;
    }
    moves.sort((a, b) => b._score - a._score);
    return moves;
}

function quiesce(game, alpha, beta, ctx) {
    ctx.nodes++;
    const stand = evaluate(game);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    const caps = game.moves().filter((m) => m.captured || m.promotion);
    orderMoves(caps);
    for (const m of caps) {
        game.makeMove(m);
        const score = -quiesce(game, -beta, -alpha, ctx);
        game.undoMove();
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
    }
    return alpha;
}

const MATE = 100000;

function negamax(game, depth, alpha, beta, ply, ctx) {
    if (ctx.nodes % 2048 === 0 && Date.now() > ctx.deadline) { ctx.timeout = true; return 0; }
    ctx.nodes++;
    const moves = game.moves();
    if (moves.length === 0) return game.inCheck(game.turn) ? -MATE + ply : 0;
    if (game.halfmove >= 100 || game.insufficientMaterial()) return 0;
    if (depth <= 0) return ctx.quiescence ? quiesce(game, alpha, beta, ctx) : evaluate(game);

    orderMoves(moves);
    let best = -Infinity;
    for (const m of moves) {
        game.makeMove(m);
        const score = -negamax(game, depth - 1, -beta, -alpha, ply + 1, ctx);
        game.undoMove();
        if (ctx.timeout) return 0;
        if (score > best) best = score;
        if (score > alpha) alpha = score;
        if (alpha >= beta) break;
    }
    return best;
}

/**
 * หาตาเดินที่ดีที่สุด
 * @param {string} fen
 * @param {{depth:number, timeMs:number, blunder:number, spread:number, quiescence:boolean}} opts
 */
export function findBestMove(fen, opts = {}) {
    const { depth = 3, timeMs = 2500, blunder = 0, spread = 0, quiescence = true } = opts;
    const game = new Chess(fen);
    let root = game.moves();
    if (!root.length) return null;

    const ctx = { nodes: 0, deadline: Date.now() + timeMs, timeout: false, quiescence };
    let scored = root.map((m) => ({ move: m, score: -Infinity }));
    orderMoves(root);

    for (let d = 1; d <= depth; d++) {
        const current = [];
        for (const m of root) {
            game.makeMove(m);
            // ใช้หน้าต่างเต็มที่ราก เพื่อให้ได้คะแนนจริงของทุกตาเดิน (ใช้จัดอันดับและสุ่มระดับง่าย)
            const score = -negamax(game, d - 1, -Infinity, Infinity, 1, ctx);
            game.undoMove();
            if (ctx.timeout) break;
            current.push({ move: m, score });
        }
        if (ctx.timeout) break;
        current.sort((a, b) => b.score - a.score);
        scored = current;
        root = current.map((s) => s.move);
    }

    scored.sort((a, b) => b.score - a.score);

    // ถ้ามีตารุกฆาต ให้เดินทันทีเสมอ ไม่ต้องสุ่ม
    const bestScore = scored[0].score;
    if (bestScore < MATE - 100) {
        // ระดับง่ายจะเดินพลาดบ้าง เพื่อให้ผู้เริ่มต้นสู้ได้
        if (blunder > 0 && Math.random() < blunder) {
            const pick = scored[Math.floor(Math.random() * scored.length)];
            return simplify(pick.move, pick.score);
        }
        if (spread > 0) {
            const pool = scored.filter((s) => bestScore - s.score <= spread);
            const pick = pool[Math.floor(Math.random() * pool.length)];
            return simplify(pick.move, pick.score);
        }
    }
    const ties = scored.filter((s) => s.score === bestScore);
    const pick = ties[Math.floor(Math.random() * ties.length)];
    return simplify(pick.move, pick.score);
}

function simplify(m, score) {
    return { from: m.from, to: m.to, promotion: m.promotion, flag: m.flag, score };
}

export const DIFFICULTY = {
    1: { name: 'มือใหม่', depth: 1, timeMs: 600, blunder: 0.35, spread: 120, quiescence: false },
    2: { name: 'ง่าย', depth: 2, timeMs: 1200, blunder: 0.15, spread: 60, quiescence: false },
    3: { name: 'ปานกลาง', depth: 3, timeMs: 2500, blunder: 0.03, spread: 20, quiescence: true },
    4: { name: 'ยาก', depth: 4, timeMs: 4000, blunder: 0, spread: 0, quiescence: true },
    5: { name: 'ผู้เชี่ยวชาญ', depth: 5, timeMs: 7000, blunder: 0, spread: 0, quiescence: true }
};
