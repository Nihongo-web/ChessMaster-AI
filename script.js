/**
 * CHESSMASTER AI - MODULAR JAVASCRIPT
 * Role: Dynamic Principal Architect
 * Feature: Flip Board with Coordinate Sync
 */

class ChessApp {
    constructor() {
        this.game = new Chess();
        this.board = null;
        this.engine = null;
        this.canvas = document.getElementById('arrowCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.isEngineReady = false;
        this.analysisData = {}; 
        this.currentBestMoves = [];
        this.pendingMove = null;

        this.init();
    }

    async init() {
        this.initBoard();
        await this.initEngine();
        this.initEvents();
        setTimeout(() => this.handleResize(), 500);
    }

    initBoard() {
        const config = {
            draggable: true,
            position: 'start',
            pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
            onDragStart: (source, piece) => this.onDragStart(source, piece),
            onDrop: (source, target) => this.onDrop(source, target),
            onSnapEnd: () => {
                this.board.position(this.game.fen());
                this.updatePGNAndStatus();
                this.triggerAnalysis();
            }
        };
        this.board = Chessboard('board', config);
    }

    async initEngine() {
        try {
            document.getElementById('engineStatus').textContent = 'Loading...';
            const sfUrl = 'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js';
            const response = await fetch(sfUrl);
            const script = await response.text();
            const blob = new Blob([script], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            
            this.engine = new Worker(workerUrl);
            this.engine.onmessage = (e) => this.handleEngineMessage(e.data);
            
            this.send('uci');
            this.send('isready');
            this.send('ucinewgame');
            
            document.getElementById('engineStatus').textContent = 'Ready';
            document.getElementById('engineStatus').className = 'text-green-500';
            this.isEngineReady = true;
            this.triggerAnalysis();
        } catch (err) {
            console.error(err);
            document.getElementById('engineStatus').textContent = 'Error';
            document.getElementById('engineStatus').className = 'text-red-500';
        }
    }

    initEvents() {
        window.addEventListener('resize', () => this.handleResize());
        document.getElementById('resetBtn').onclick = () => this.resetGame();
        document.getElementById('undoBtn').onclick = () => this.undoMove();
        document.getElementById('copyPgnBtn').onclick = () => this.copyPGN();
        
        // Integration of Flip Button
        const flipBtn = document.getElementById('flipBtn');
        if (flipBtn) {
            flipBtn.onclick = () => this.flipBoard();
        }
        
        document.getElementById('multipvInput').oninput = (e) => {
            document.getElementById('multipvVal').textContent = e.target.value;
        };

        ['eloInput', 'depthInput', 'multipvInput'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.onchange = () => this.triggerAnalysis();
        });
    }

    // --- FITUR FLIP BOARD ---
    flipBoard() {
        this.board.flip();
        this.drawArrows(); // Re-draw arrows based on new orientation
    }

    handleResize() {
        const boardEl = document.getElementById('board');
        if (!boardEl) return;
        this.canvas.width = boardEl.clientWidth;
        this.canvas.height = boardEl.clientHeight;
        this.drawArrows();
    }

    updatePGNAndStatus() {
        const pgn = this.game.pgn();
        document.getElementById('pgnText').textContent = pgn || 'Game Start';
        
        const pgnBox = document.getElementById('pgnText');
        pgnBox.scrollTop = pgnBox.scrollHeight;

        const gameOverPanel = document.getElementById('gameOverPanel');
        const gameResult = document.getElementById('gameResult');
        const gameReason = document.getElementById('gameReason');

        if (this.game.game_over()) {
            gameOverPanel.classList.remove('hidden');
            if (this.game.in_checkmate()) {
                gameResult.textContent = 'CHECKMATE!';
                gameReason.textContent = (this.game.turn() === 'w' ? 'Black' : 'White') + ' wins.';
            } else {
                gameResult.textContent = 'DRAW!';
                gameReason.textContent = 'Game drawn.';
            }
        } else {
            gameOverPanel.classList.add('hidden');
        }
    }

    copyPGN() {
        const pgn = this.game.pgn();
        navigator.clipboard.writeText(pgn).then(() => {
            const btn = document.getElementById('copyPgnBtn');
            const oldText = btn.textContent;
            btn.textContent = 'COPIED!';
            setTimeout(() => btn.textContent = oldText, 2000);
        });
    }

    onDragStart(source, piece) {
        if (this.game.game_over()) return false;
        if ((this.game.turn() === 'w' && piece.search(/^b/) !== -1) ||
            (this.game.turn() === 'b' && piece.search(/^w/) !== -1)) {
            return false;
        }
    }

    onDrop(source, target) {
        const move = this.game.move({ from: source, to: target, promotion: 'q' });
        
        if (move === null) return 'snapback';

        if (move.flags.includes('p')) {
            this.game.undo();
            this.pendingMove = { from: source, to: target };
            this.showPromotionUI();
            return 'snapback';
        }

        this.clearCanvas();
    }

    showPromotionUI() {
        const modal = document.getElementById('promotionModal');
        const turn = this.game.turn();
        const prefix = turn === 'w' ? 'w' : 'b';
        
        document.getElementById('promoQ').src = `https://chessboardjs.com/img/chesspieces/wikipedia/${prefix}Q.png`;
        document.getElementById('promoR').src = `https://chessboardjs.com/img/chesspieces/wikipedia/${prefix}R.png`;
        document.getElementById('promoB').src = `https://chessboardjs.com/img/chesspieces/wikipedia/${prefix}B.png`;
        document.getElementById('promoN').src = `https://chessboardjs.com/img/chesspieces/wikipedia/${prefix}N.png`;
        
        modal.classList.remove('hidden');
    }

    selectPromotion(pieceType) {
        document.getElementById('promotionModal').classList.add('hidden');
        if (this.pendingMove) {
            this.game.move({
                from: this.pendingMove.from,
                to: this.pendingMove.to,
                promotion: pieceType
            });
            this.board.position(this.game.fen());
            this.updatePGNAndStatus();
            this.triggerAnalysis();
            this.pendingMove = null;
        }
    }

    resetGame() {
        this.game.reset();
        this.board.start();
        this.clearCanvas();
        this.updatePGNAndStatus();
        this.triggerAnalysis();
    }

    undoMove() {
        this.game.undo();
        this.board.position(this.game.fen());
        this.clearCanvas();
        this.updatePGNAndStatus();
        this.triggerAnalysis();
    }

    send(cmd) { if (this.engine) this.engine.postMessage(cmd); }

    triggerAnalysis() {
        if (!this.isEngineReady || this.game.game_over()) return;

        const elo = document.getElementById('eloInput').value;
        const depth = document.getElementById('depthInput').value;
        const multipv = document.getElementById('multipvInput').value;

        this.analysisData = {};
        this.currentBestMoves = [];
        this.clearCanvas();

        this.send(`stop`);
        this.send(`setoption name MultiPV value ${multipv}`);
        this.send(`setoption name UCI_LimitStrength value true`);
        this.send(`setoption name UCI_Elo value ${elo}`);
        this.send(`position fen ${this.game.fen()}`);
        this.send(`go depth ${depth}`);
    }

    handleEngineMessage(msg) {
        if (msg.startsWith('info')) this.parseAnalysisInfo(msg);
        if (msg.startsWith('bestmove')) this.drawArrows();
    }

    parseAnalysisInfo(msg) {
        const pvIdMatch = msg.match(/multipv (\d+)/);
        if (!pvIdMatch) return;

        const pvId = pvIdMatch[1];
        const cpMatch = msg.match(/score cp (-?\d+)/);
        const mateMatch = msg.match(/score mate (-?\d+)/);
        const pvLineMatch = msg.match(/ pv (.*)/);

        let scoreStr = '0.00';
        let isMate = false;

        if (mateMatch) {
            scoreStr = `M${Math.abs(mateMatch[1])}`;
            isMate = true;
        } else if (cpMatch) {
            let cp = parseInt(cpMatch[1]);
            if (this.game.turn() === 'b') cp = -cp;
            scoreStr = (cp > 0 ? '+' : '') + (cp / 100).toFixed(2);
        }

        if (pvLineMatch) {
            const line = pvLineMatch[1];
            this.analysisData[pvId] = {
                score: scoreStr,
                isMate: isMate,
                line: line.split(' ').slice(0, 5).join(' '),
                bestMove: line.split(' ')[0]
            };
            this.updateUI();
        }
    }

    updateUI() {
        const linesContainer = document.getElementById('analysisLines');
        const evalScoreEl = document.getElementById('evalScore');
        const mateWarning = document.getElementById('mateWarning');
        
        linesContainer.innerHTML = '';
        this.currentBestMoves = [];

        const ids = Object.keys(this.analysisData).sort((a, b) => a - b);
        ids.forEach(id => {
            const data = this.analysisData[id];
            this.currentBestMoves.push(data.bestMove);

            const lineDiv = document.createElement('div');
            lineDiv.className = 'bg-white/5 p-3 rounded border-l-4 border-blue-500/50';
            lineDiv.innerHTML = `
                <div class="flex justify-between items-center mb-1">
                    <span class="text-[10px] font-bold text-gray-500">LINE ${id}</span>
                    <span class="text-xs font-bold ${data.isMate ? 'text-red-400' : 'text-blue-300'}">${data.score}</span>
                </div>
                <p class="text-[11px] text-gray-400 font-mono">${data.line}</p>
            `;
            linesContainer.appendChild(lineDiv);

            if (id === '1') {
                evalScoreEl.textContent = data.score;
                if (data.isMate) mateWarning.classList.remove('hidden');
                else mateWarning.classList.add('hidden');
            }
        });
        this.drawArrows();
    }

    clearCanvas() { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }

    drawArrows() {
        this.clearCanvas();
        this.currentBestMoves.forEach((move, index) => {
            const alpha = 0.8 - (index * 0.2);
            const color = index === 0 ? `rgba(255, 235, 59, ${alpha})` : `rgba(0, 255, 255, ${alpha})`;
            this.drawSingleArrow(move, color);
        });
    }

    drawSingleArrow(moveStr, color) {
        if (!moveStr || moveStr.length < 4) return;
        const from = moveStr.substring(0, 2);
        const to = moveStr.substring(2, 4);

        // Updated getCoords with Flip Logic
        const getCoords = (sq) => {
            const isFlipped = this.board.orientation() === 'black';
            let c = sq.charCodeAt(0) - 97; // a=0, b=1...
            let r = 8 - parseInt(sq[1]);   // row 8=0, row 1=7

            if (isFlipped) {
                c = 7 - c; // Flip kolom
                r = 7 - r; // Flip baris
            }

            const s = this.canvas.width / 8;
            return { x: c * s + s / 2, y: r * s + s / 2 };
        };

        const s = getCoords(from), e = getCoords(to);
        this.ctx.strokeStyle = this.ctx.fillStyle = color;
        this.ctx.lineWidth = 10; this.ctx.lineCap = 'round';
        this.ctx.beginPath(); this.ctx.moveTo(s.x, s.y); this.ctx.lineTo(e.x, e.y); this.ctx.stroke();
        
        const a = Math.atan2(e.y - s.y, e.x - s.x), h = 20;
        this.ctx.beginPath(); this.ctx.moveTo(e.x, e.y);
        this.ctx.lineTo(e.x - h * Math.cos(a - Math.PI / 6), e.y - h * Math.sin(a - Math.PI / 6));
        this.ctx.lineTo(e.x - h * Math.cos(a + Math.PI / 6), e.y - h * Math.sin(a + Math.PI / 6));
        this.ctx.closePath(); this.ctx.fill();
    }
}

window.onload = () => { window.chessApp = new ChessApp(); };
