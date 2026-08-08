import { findBestMove } from './ai.js';

self.onmessage = (e) => {
    const { id, fen, opts } = e.data;
    try {
        const move = findBestMove(fen, opts);
        self.postMessage({ id, move });
    } catch (err) {
        self.postMessage({ id, move: null, error: String(err) });
    }
};
