// กติกาและกลไกหมากรุกสากล (board 8x8, index 0 = a1, 63 = h8)

export const WHITE = 'w';
export const BLACK = 'b';
export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const PIECE_TH = { p: 'เบี้ย', n: 'ม้า', b: 'บิชอป', r: 'เรือ', q: 'ควีน', k: 'ขุน' };
export const PIECE_GLYPH = {
    w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
    b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' }
};
export const COLOR_TH = { w: 'ฝ่ายขาว', b: 'ฝ่ายดำ' };

export const fileOf = (i) => i & 7;
export const rankOf = (i) => i >> 3;
export const squareIndex = (f, r) => r * 8 + f;
export const onBoard = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;
export const toAlgebraic = (i) => 'abcdefgh'[fileOf(i)] + (rankOf(i) + 1);
export const fromAlgebraic = (s) => squareIndex(s.charCodeAt(0) - 97, parseInt(s[1], 10) - 1);
export const opposite = (c) => (c === WHITE ? BLACK : WHITE);

const KNIGHT_DELTAS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const DIAG = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const ALL8 = DIAG.concat(ORTH);

export class Chess {
    constructor(fen = START_FEN) {
        this.trackRepetition = false;
        this.load(fen);
    }

    load(fen) {
        const parts = fen.trim().split(/\s+/);
        this.board = new Array(64).fill(null);
        const rows = parts[0].split('/');
        for (let row = 0; row < 8; row++) {
            let f = 0;
            for (const ch of rows[row]) {
                if (ch >= '1' && ch <= '8') {
                    f += Number(ch);
                } else {
                    const color = ch === ch.toUpperCase() ? WHITE : BLACK;
                    this.board[squareIndex(f, 7 - row)] = { type: ch.toLowerCase(), color };
                    f++;
                }
            }
        }
        this.turn = parts[1] === 'b' ? BLACK : WHITE;
        const c = parts[2] || '-';
        this.castling = { wk: c.includes('K'), wq: c.includes('Q'), bk: c.includes('k'), bq: c.includes('q') };
        this.ep = parts[3] && parts[3] !== '-' ? fromAlgebraic(parts[3]) : -1;
        this.halfmove = parseInt(parts[4] || '0', 10);
        this.fullmove = parseInt(parts[5] || '1', 10);
        this.history = [];
        this.keyCounts = new Map();
        if (this.trackRepetition) this._pushKey();
    }

    fen() {
        let out = '';
        for (let r = 7; r >= 0; r--) {
            let empty = 0;
            for (let f = 0; f < 8; f++) {
                const p = this.board[squareIndex(f, r)];
                if (!p) { empty++; continue; }
                if (empty) { out += empty; empty = 0; }
                out += p.color === WHITE ? p.type.toUpperCase() : p.type;
            }
            if (empty) out += empty;
            if (r > 0) out += '/';
        }
        const c = (this.castling.wk ? 'K' : '') + (this.castling.wq ? 'Q' : '') +
            (this.castling.bk ? 'k' : '') + (this.castling.bq ? 'q' : '');
        return `${out} ${this.turn} ${c || '-'} ${this.ep >= 0 ? toAlgebraic(this.ep) : '-'} ${this.halfmove} ${this.fullmove}`;
    }

    positionKey() {
        let out = '';
        for (let i = 0; i < 64; i++) {
            const p = this.board[i];
            out += p ? (p.color === WHITE ? p.type.toUpperCase() : p.type) : '.';
        }
        return out + this.turn + (this.castling.wk ? 'K' : '') + (this.castling.wq ? 'Q' : '') +
            (this.castling.bk ? 'k' : '') + (this.castling.bq ? 'q' : '') + this.ep;
    }

    _pushKey() {
        const k = this.positionKey();
        this.keyCounts.set(k, (this.keyCounts.get(k) || 0) + 1);
    }

    _popKey() {
        const k = this.positionKey();
        const n = (this.keyCounts.get(k) || 1) - 1;
        if (n <= 0) this.keyCounts.delete(k); else this.keyCounts.set(k, n);
    }

    kingSquare(color) {
        for (let i = 0; i < 64; i++) {
            const p = this.board[i];
            if (p && p.type === 'k' && p.color === color) return i;
        }
        return -1;
    }

    isAttacked(target, byColor) {
        const b = this.board;
        const tf = fileOf(target), tr = rankOf(target);

        // เบี้ย
        const pawnRank = tr - (byColor === WHITE ? 1 : -1);
        for (const df of [-1, 1]) {
            const f = tf + df;
            if (onBoard(f, pawnRank)) {
                const p = b[squareIndex(f, pawnRank)];
                if (p && p.color === byColor && p.type === 'p') return true;
            }
        }
        // ม้า
        for (const [df, dr] of KNIGHT_DELTAS) {
            const f = tf + df, r = tr + dr;
            if (!onBoard(f, r)) continue;
            const p = b[squareIndex(f, r)];
            if (p && p.color === byColor && p.type === 'n') return true;
        }
        // ขุน
        for (const [df, dr] of ALL8) {
            const f = tf + df, r = tr + dr;
            if (!onBoard(f, r)) continue;
            const p = b[squareIndex(f, r)];
            if (p && p.color === byColor && p.type === 'k') return true;
        }
        // แนวทแยง / แนวตรง
        for (const [dirs, types] of [[DIAG, 'bq'], [ORTH, 'rq']]) {
            for (const [df, dr] of dirs) {
                let f = tf + df, r = tr + dr;
                while (onBoard(f, r)) {
                    const p = b[squareIndex(f, r)];
                    if (p) {
                        if (p.color === byColor && types.includes(p.type)) return true;
                        break;
                    }
                    f += df; r += dr;
                }
            }
        }
        return false;
    }

    inCheck(color = this.turn) {
        const k = this.kingSquare(color);
        return k >= 0 && this.isAttacked(k, opposite(color));
    }

    moves({ square = -1, legal = true } = {}) {
        const list = [];
        const color = this.turn;
        for (let i = 0; i < 64; i++) {
            if (square >= 0 && i !== square) continue;
            const p = this.board[i];
            if (!p || p.color !== color) continue;
            this._pseudoMoves(i, p, list);
        }
        if (!legal) return list;
        const out = [];
        for (const m of list) {
            this.makeMove(m);
            const ok = !this.inCheck(color);
            this.undoMove();
            if (ok) out.push(m);
        }
        return out;
    }

    _add(list, from, to, extra = {}) {
        const captured = this.board[to] ? this.board[to].type : null;
        list.push({ from, to, piece: this.board[from].type, color: this.board[from].color, captured, promotion: null, flag: null, ...extra });
    }

    _pseudoMoves(i, p, list) {
        const b = this.board;
        const f = fileOf(i), r = rankOf(i);
        if (p.type === 'p') {
            const dir = p.color === WHITE ? 1 : -1;
            const startRank = p.color === WHITE ? 1 : 6;
            const promoRank = p.color === WHITE ? 7 : 0;
            const one = squareIndex(f, r + dir);
            if (onBoard(f, r + dir) && !b[one]) {
                if (r + dir === promoRank) {
                    for (const q of ['q', 'r', 'b', 'n']) this._add(list, i, one, { promotion: q });
                } else {
                    this._add(list, i, one);
                    const two = squareIndex(f, r + 2 * dir);
                    if (r === startRank && !b[two]) this._add(list, i, two, { flag: 'double' });
                }
            }
            for (const df of [-1, 1]) {
                const nf = f + df, nr = r + dir;
                if (!onBoard(nf, nr)) continue;
                const to = squareIndex(nf, nr);
                const target = b[to];
                if (target && target.color !== p.color) {
                    if (nr === promoRank) {
                        for (const q of ['q', 'r', 'b', 'n']) this._add(list, i, to, { promotion: q });
                    } else this._add(list, i, to);
                } else if (!target && to === this.ep) {
                    list.push({ from: i, to, piece: 'p', color: p.color, captured: 'p', promotion: null, flag: 'ep' });
                }
            }
            return;
        }
        if (p.type === 'n') {
            for (const [df, dr] of KNIGHT_DELTAS) {
                const nf = f + df, nr = r + dr;
                if (!onBoard(nf, nr)) continue;
                const to = squareIndex(nf, nr);
                if (!b[to] || b[to].color !== p.color) this._add(list, i, to);
            }
            return;
        }
        if (p.type === 'k') {
            for (const [df, dr] of ALL8) {
                const nf = f + df, nr = r + dr;
                if (!onBoard(nf, nr)) continue;
                const to = squareIndex(nf, nr);
                if (!b[to] || b[to].color !== p.color) this._add(list, i, to);
            }
            this._castleMoves(i, p, list);
            return;
        }
        const dirs = p.type === 'b' ? DIAG : p.type === 'r' ? ORTH : ALL8;
        for (const [df, dr] of dirs) {
            let nf = f + df, nr = r + dr;
            while (onBoard(nf, nr)) {
                const to = squareIndex(nf, nr);
                if (!b[to]) { this._add(list, i, to); }
                else {
                    if (b[to].color !== p.color) this._add(list, i, to);
                    break;
                }
                nf += df; nr += dr;
            }
        }
    }

    _castleMoves(i, p, list) {
        const b = this.board;
        const home = p.color === WHITE ? 4 : 60;
        if (i !== home) return;
        const enemy = opposite(p.color);
        if (this.isAttacked(home, enemy)) return;
        const canK = p.color === WHITE ? this.castling.wk : this.castling.bk;
        const canQ = p.color === WHITE ? this.castling.wq : this.castling.bq;
        if (canK) {
            const rook = b[home + 3];
            if (rook && rook.type === 'r' && rook.color === p.color && !b[home + 1] && !b[home + 2] &&
                !this.isAttacked(home + 1, enemy) && !this.isAttacked(home + 2, enemy)) {
                list.push({ from: i, to: home + 2, piece: 'k', color: p.color, captured: null, promotion: null, flag: 'castleK' });
            }
        }
        if (canQ) {
            const rook = b[home - 4];
            if (rook && rook.type === 'r' && rook.color === p.color && !b[home - 1] && !b[home - 2] && !b[home - 3] &&
                !this.isAttacked(home - 1, enemy) && !this.isAttacked(home - 2, enemy)) {
                list.push({ from: i, to: home - 2, piece: 'k', color: p.color, captured: null, promotion: null, flag: 'castleQ' });
            }
        }
    }

    makeMove(m) {
        const b = this.board;
        const piece = b[m.from];
        const undo = {
            move: m,
            castling: { ...this.castling },
            ep: this.ep,
            halfmove: this.halfmove,
            fullmove: this.fullmove,
            capturedPiece: null,
            capturedSquare: -1
        };
        let capSq = -1;
        if (m.flag === 'ep') capSq = squareIndex(fileOf(m.to), rankOf(m.from));
        else if (b[m.to]) capSq = m.to;
        if (capSq >= 0) { undo.capturedPiece = b[capSq]; undo.capturedSquare = capSq; b[capSq] = null; }

        b[m.to] = m.promotion ? { type: m.promotion, color: piece.color } : piece;
        b[m.from] = null;

        if (m.flag === 'castleK') { b[m.from + 1] = b[m.from + 3]; b[m.from + 3] = null; }
        if (m.flag === 'castleQ') { b[m.from - 1] = b[m.from - 4]; b[m.from - 4] = null; }

        if (piece.type === 'k') {
            if (piece.color === WHITE) { this.castling.wk = false; this.castling.wq = false; }
            else { this.castling.bk = false; this.castling.bq = false; }
        }
        if (m.from === 0 || capSq === 0) this.castling.wq = false;
        if (m.from === 7 || capSq === 7) this.castling.wk = false;
        if (m.from === 56 || capSq === 56) this.castling.bq = false;
        if (m.from === 63 || capSq === 63) this.castling.bk = false;

        this.ep = (piece.type === 'p' && Math.abs(rankOf(m.to) - rankOf(m.from)) === 2) ? (m.from + m.to) / 2 : -1;
        this.halfmove = (piece.type === 'p' || capSq >= 0) ? 0 : this.halfmove + 1;
        if (this.turn === BLACK) this.fullmove++;
        this.turn = opposite(this.turn);
        this.history.push(undo);
        if (this.trackRepetition) this._pushKey();
        return undo;
    }

    undoMove() {
        if (!this.history.length) return null;
        if (this.trackRepetition) this._popKey();
        const u = this.history.pop();
        const m = u.move;
        const b = this.board;
        const moved = b[m.to];
        b[m.from] = m.promotion ? { type: 'p', color: moved.color } : moved;
        b[m.to] = null;
        if (u.capturedSquare >= 0) b[u.capturedSquare] = u.capturedPiece;
        if (m.flag === 'castleK') { b[m.from + 3] = b[m.from + 1]; b[m.from + 1] = null; }
        if (m.flag === 'castleQ') { b[m.from - 4] = b[m.from - 1]; b[m.from - 1] = null; }
        this.castling = u.castling;
        this.ep = u.ep;
        this.halfmove = u.halfmove;
        this.fullmove = u.fullmove;
        this.turn = opposite(this.turn);
        return m;
    }

    countPieces() {
        let n = 0;
        for (let i = 0; i < 64; i++) if (this.board[i]) n++;
        return n;
    }

    insufficientMaterial() {
        const minor = [];
        for (let i = 0; i < 64; i++) {
            const p = this.board[i];
            if (!p || p.type === 'k') continue;
            if (p.type === 'p' || p.type === 'r' || p.type === 'q') return false;
            minor.push({ ...p, square: i });
        }
        if (minor.length === 0) return true;                     // ขุน vs ขุน
        if (minor.length === 1) return true;                     // + ม้า หรือ บิชอป 1 ตัว
        if (minor.length === 2 && minor.every((p) => p.type === 'b')) {
            const sqColor = (i) => (fileOf(i) + rankOf(i)) % 2;
            return sqColor(minor[0].square) === sqColor(minor[1].square) && minor[0].color !== minor[1].color;
        }
        return false;
    }

    isThreefold() {
        return (this.keyCounts.get(this.positionKey()) || 0) >= 3;
    }

    /** สถานะเกมมาตรฐาน (ยังไม่รวมกติกาจำกัดตาเดินท้ายเกม ซึ่งจัดการที่ตัวควบคุมเกม) */
    status() {
        const legal = this.moves();
        const check = this.inCheck(this.turn);
        if (legal.length === 0) {
            if (check) return { over: true, winner: opposite(this.turn), reason: 'checkmate' };
            return { over: true, winner: null, reason: 'stalemate' };
        }
        if (this.insufficientMaterial()) return { over: true, winner: null, reason: 'material' };
        if (this.halfmove >= 100) return { over: true, winner: null, reason: 'fiftymove' };
        if (this.trackRepetition && this.isThreefold()) return { over: true, winner: null, reason: 'repetition' };
        return { over: false, winner: null, reason: check ? 'check' : null, check };
    }

    /** ข้อความบรรยายตาเดินเป็นภาษาไทย */
    describeMove(m) {
        if (m.flag === 'castleK') return 'เข้าป้อมด้านขุน (O-O)';
        if (m.flag === 'castleQ') return 'เข้าป้อมด้านควีน (O-O-O)';
        let s = `${PIECE_TH[m.piece]} ${toAlgebraic(m.from)}→${toAlgebraic(m.to)}`;
        if (m.captured) s += ` (กิน${PIECE_TH[m.captured]}${m.flag === 'ep' ? ' แบบผ่าน' : ''})`;
        if (m.promotion) s += ` เลื่อนขั้นเป็น${PIECE_TH[m.promotion]}`;
        return s;
    }
}
