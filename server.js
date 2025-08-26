const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Game state storage
const games = new Map();
const players = new Map();

// Game class to manage game state
class Game {
    constructor(gameId, player1Id, player2Id) {
        this.gameId = gameId;
        this.player1Id = player1Id;
        this.player2Id = player2Id;
        this.player1Numbers = null;
        this.player2Numbers = null;
        this.currentTurn = player1Id;
        this.gameHistory = {
            [player1Id]: [],
            [player2Id]: []
        };
        this.gameStatus = 'waiting'; // waiting, active, finished
        this.winner = null;
        this.createdAt = Date.now();
    }

    addPlayerNumbers(playerId, numbers) {
        if (playerId === this.player1Id) {
            this.player1Numbers = numbers;
        } else if (playerId === this.player2Id) {
            this.player2Numbers = numbers;
        }

        // Check if both players have set their numbers
        if (this.player1Numbers && this.player2Numbers) {
            this.gameStatus = 'active';
            return true;
        }
        return false;
    }

    makeGuess(playerId, guess) {
        if (this.gameStatus !== 'active' || this.currentTurn !== playerId) {
            return null;
        }

        // Determine target numbers
        const targetNumbers = playerId === this.player1Id ? this.player2Numbers : this.player1Numbers;
        
        // Calculate feedback
        const feedback = this.calculateFeedback(guess, targetNumbers);
        
        // Add to history
        const historyEntry = {
            playerId: playerId,
            guess: guess,
            feedback: feedback,
            timestamp: Date.now()
        };
        
        // Ensure history array exists for this player
        if (!this.gameHistory[playerId]) {
            console.log(`Creating history array for player ${playerId}`);
            this.gameHistory[playerId] = [];
        }
        
        console.log(`Adding guess to history for player ${playerId}, history length: ${this.gameHistory[playerId].length}`);
        this.gameHistory[playerId].push(historyEntry);
        
        // Check for win
        if (feedback.correctPositions === 5) {
            this.gameStatus = 'finished';
            this.winner = playerId;
            return { ...feedback, gameOver: true, winner: playerId };
        }
        
        // Switch turns
        this.currentTurn = this.currentTurn === this.player1Id ? this.player2Id : this.player1Id;
        
        // console.log(`Turn switched. Player 1: ${this.player1Id}, Player 2: ${this.player2Id}, Current Turn: ${this.currentTurn}`);
        
        return { ...feedback, gameOver: false };
    }

    calculateFeedback(guess, targetNumbers) {
        let correctNumbers = 0;
        let correctPositions = 0;
        
        // Count correct numbers (regardless of position)
        const guessCount = new Array(10).fill(0);
        const targetCount = new Array(10).fill(0);
        
        for (let i = 0; i < 5; i++) {
            guessCount[guess[i]]++;
            targetCount[targetNumbers[i]]++;
        }
        
        for (let i = 0; i < 10; i++) {
            correctNumbers += Math.min(guessCount[i], targetCount[i]);
        }
        
        // Count correct positions
        for (let i = 0; i < 5; i++) {
            if (guess[i] === targetNumbers[i]) {
                correctPositions++;
            }
        }
        
        return {
            correctNumbers,
            correctPositions
        };
    }

    getGameState(playerId) {
        const isPlayer1 = playerId === this.player1Id;
        const opponentId = isPlayer1 ? this.player2Id : this.player1Id;
        
        // Get player's own numbers
        const myNumbers = isPlayer1 ? this.player1Numbers : this.player2Numbers;
        
        // Get opponent's numbers and check for duplicates
        const opponentNumbers = isPlayer1 ? this.player2Numbers : this.player1Numbers;
        const hasDuplicates = opponentNumbers ? this.hasDuplicates(opponentNumbers) : false;
        
        const gameState = {
            gameId: this.gameId,
            currentTurn: this.currentTurn,
            gameStatus: this.gameStatus,
            winner: this.winner,
            isMyTurn: this.currentTurn === playerId,
            myHistory: this.gameHistory[playerId] || [],
            opponentHistory: this.gameHistory[opponentId] || [],
            gameStarted: this.gameStatus === 'active' || this.gameStatus === 'finished',
            myNumbers: myNumbers,
            opponentHasDuplicates: hasDuplicates
        };
        
        // console.log(`Game state for ${playerId}: isMyTurn=${gameState.isMyTurn}, currentTurn=${this.currentTurn}`);
        
        return gameState;
    }

    hasDuplicates(numbers) {
        if (!numbers) return false;
        const seen = new Set();
        for (let num of numbers) {
            if (seen.has(num)) return true;
            seen.add(num);
        }
        return false;
    }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    
    // Store player info
    players.set(socket.id, {
        id: socket.id,
        gameId: null,
        name: null
    });

    // Join game room
    socket.on('joinGame', (data) => {
        const { gameId, playerName } = data;
        const player = players.get(socket.id);
        
        if (!player) return;
        
        player.gameId = gameId;
        player.name = playerName;
        
        socket.join(gameId);
        
        // Get or create game
        let game = games.get(gameId);
        if (!game) {
            // Create new game with this player
            console.log(`Creating new game ${gameId} with player ${socket.id}`);
            game = new Game(gameId, socket.id, null);
            games.set(gameId, game);
        } else if (!game.player2Id) {
            // Join existing game
            console.log(`Player ${socket.id} joining existing game ${gameId} as Player 2`);
            game.player2Id = socket.id;
            
            // Initialize history array for the second player
            if (!game.gameHistory[socket.id]) {
                game.gameHistory[socket.id] = [];
            }
        } else {
            console.log(`Game ${gameId} is full, cannot join`);
            return;
        }
        
        // Notify players
        io.to(gameId).emit('gameUpdate', {
            type: 'playerJoined',
            playerId: socket.id,
            playerName: playerName
        });
        
        // Send game state to all players in the game
        if (game) {
            console.log(`Game ${gameId}: Player 1: ${game.player1Id}, Player 2: ${game.player2Id}`);
            
            // Always send state to Player 1
            const player1Socket = io.sockets.sockets.get(game.player1Id);
            if (player1Socket) {
                const player1State = game.getGameState(game.player1Id);
                console.log(`Sending state to Player 1:`, player1State);
                player1Socket.emit('gameState', player1State);
            }
            
            // If Player 2 exists, send state to them too
            if (game.player2Id) {
                const player2Socket = io.sockets.sockets.get(game.player2Id);
                if (player2Socket) {
                    const player2State = game.getGameState(game.player2Id);
                    console.log(`Sending state to Player 2:`, player2State);
                    player2Socket.emit('gameState', player2State);
                }
            }
            
            // If this is the second player joining, also send a special update
            if (game.player2Id && game.player2Id === socket.id) {
                console.log(`Second player joined, sending special update to both players`);
                io.to(gameId).emit('gameUpdate', {
                    type: 'secondPlayerJoined',
                    playerId: socket.id,
                    playerName: playerName
                });
            }
        }
        
        console.log(`Player ${playerName} joined game ${gameId}`);
    });

    // Set player numbers
    socket.on('setNumbers', (data) => {
        const { numbers } = data;
        const player = players.get(socket.id);
        
        if (!player || !player.gameId) return;
        
        const game = games.get(player.gameId);
        if (!game) return;
        
        console.log(`Player ${socket.id} setting numbers for game ${player.gameId}`);
        const gameStarted = game.addPlayerNumbers(socket.id, numbers);
        console.log(`Game started: ${gameStarted}, Game status: ${game.gameStatus}`);
        
        if (gameStarted) {
            console.log(`Game is starting! Sending gameStarted event to both players`);
            // Send game started event to both players
            io.to(player.gameId).emit('gameUpdate', {
                type: 'gameStarted'
            });
            
            // Send updated game state to both players
            const player1Socket = io.sockets.sockets.get(game.player1Id);
            const player2Socket = io.sockets.sockets.get(game.player2Id);
            
            if (player1Socket) {
                const player1State = game.getGameState(game.player1Id);
                console.log(`Sending final state to Player 1:`, player1State);
                player1Socket.emit('gameState', player1State);
            }
            if (player2Socket) {
                const player2State = game.getGameState(game.player2Id);
                console.log(`Sending final state to Player 2:`, player2State);
                player2Socket.emit('gameState', player2State);
            }
        } else {
            console.log(`Player ${socket.id} set numbers, waiting for other player`);
            io.to(player.gameId).emit('gameUpdate', {
                type: 'numbersSet',
                playerId: socket.id
            });
            
            // Don't send game state here - it will be sent when the game actually starts
        }
    });

    // Make a guess
    socket.on('makeGuess', (data) => {
        const { guess } = data;
        const player = players.get(socket.id);
        
        if (!player || !player.gameId) return;
        
        const game = games.get(player.gameId);
        if (!game) return;
        
        const result = game.makeGuess(socket.id, guess);
        if (!result) return;
        
        // Send result to both players with their respective game states
        io.to(player.gameId).emit('gameUpdate', {
            type: 'guessResult',
            playerId: socket.id,
            guess: guess,
            feedback: result
        });
        
        // Send updated game state to both players
        const player1Socket = io.sockets.sockets.get(game.player1Id);
        const player2Socket = io.sockets.sockets.get(game.player2Id);
        
        if (player1Socket) {
            player1Socket.emit('gameState', game.getGameState(game.player1Id));
        }
        if (player2Socket) {
            player2Socket.emit('gameState', game.getGameState(game.player2Id));
        }
        
        if (result.gameOver) {
            io.to(player.gameId).emit('gameUpdate', {
                type: 'gameOver',
                winner: result.winner
            });
            
            // Send final game state to both players
            const player1Socket = io.sockets.sockets.get(game.player1Id);
            const player2Socket = io.sockets.sockets.get(game.player2Id);
            
            if (player1Socket) {
                player1Socket.emit('gameState', game.getGameState(game.player1Id));
            }
            if (player2Socket) {
                player2Socket.emit('gameState', game.getGameState(game.player2Id));
            }
        }
    });

    // Handle game recovery attempts
    socket.on('attemptRecovery', (data) => {
        const { gameId, playerName } = data;
        console.log(`Recovery attempt for game ${gameId} by ${playerName}`);
        
        const game = games.get(gameId);
        if (!game) {
            console.log(`Game ${gameId} not found for recovery`);
            socket.emit('recoveryResponse', { success: false });
            return;
        }
        
        // Check if this player was in this game
        const wasPlayer1 = game.player1Id === socket.id || 
                          (game.player1Id && players.get(game.player1Id)?.name === playerName);
        const wasPlayer2 = game.player2Id === socket.id || 
                          (game.player2Id && players.get(game.player2Id)?.name === playerName);
        
        if (!wasPlayer1 && !wasPlayer2) {
            console.log(`Player ${playerName} was not in game ${gameId}`);
            socket.emit('recoveryResponse', { success: false });
            return;
        }
        
        // Update player info and rejoin the game
        const player = players.get(socket.id);
        if (player) {
            player.gameId = gameId;
            player.name = playerName;
        }
        
        socket.join(gameId);
        
        // Send recovery response with current game state
        const playerId = wasPlayer1 ? game.player1Id : game.player2Id;
        const gameState = game.getGameState(playerId);
        
        socket.emit('recoveryResponse', { 
            success: true, 
            gameState: gameState 
        });
        
        console.log(`Recovery successful for ${playerName} in game ${gameId}`);
    });

    // Get game state
    socket.on('getGameState', () => {
        const player = players.get(socket.id);
        if (!player || !player.gameId) return;
        
        const game = games.get(player.gameId);
        if (!game) return;
        
        socket.emit('gameState', game.getGameState(socket.id));
    });

    // Disconnect handling
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        
        const player = players.get(socket.id);
        if (player && player.gameId) {
            const game = games.get(player.gameId);
            if (game) {
                // Notify other player
                const otherPlayerId = game.player1Id === socket.id ? game.player2Id : game.player1Id;
                if (otherPlayerId) {
                    io.to(otherPlayerId).emit('gameUpdate', {
                        type: 'playerDisconnected',
                        playerId: socket.id
                    });
                }
                
                // Clean up game if both players are gone
                if (!otherPlayerId || !players.has(otherPlayerId)) {
                    games.delete(player.gameId);
                }
            }
        }
        
        players.delete(socket.id);
    });
});

// API endpoints
app.get('/api/games', (req, res) => {
    const activeGames = Array.from(games.values())
        .filter(game => game.gameStatus === 'waiting')
        .map(game => ({
            gameId: game.gameId,
            player1Name: players.get(game.player1Id)?.name || 'Player 1',
            createdAt: game.createdAt
        }));
    
    res.json(activeGames);
});

app.post('/api/games', (req, res) => {
    const { playerName } = req.body;
    const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    res.json({ gameId, message: 'Game created successfully' });
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Number Wordle server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to play!`);
}); 