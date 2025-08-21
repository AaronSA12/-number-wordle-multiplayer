class MultiplayerNumberWordle {
    constructor() {
        this.socket = null;
        this.gameId = null;
        this.playerName = null;
        this.isMyTurn = false;
        this.gameState = null;
        this.currentTab = 'my-guesses';
        
        this.initializeSocket();
        this.initializeEventListeners();
        this.updateConnectionStatus('connecting');
    }

    initializeSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.updateConnectionStatus('connected');
            this.loadActiveGames();
        });
        
        this.socket.on('disconnect', () => {
            this.updateConnectionStatus('disconnected');
        });
        
        this.socket.on('gameUpdate', (data) => {
            this.handleGameUpdate(data);
        });
        
        this.socket.on('gameState', (state) => {
            this.updateGameState(state);
        });
    }

    initializeEventListeners() {
        // Lobby events
        document.getElementById('createGame').addEventListener('click', () => this.createGame());
        document.getElementById('joinGame').addEventListener('click', () => this.joinGame());
        
        // Game setup events
        document.getElementById('setNumbers').addEventListener('click', () => this.setNumbers());
        
        // Game events
        document.getElementById('submitGuess').addEventListener('click', () => this.submitGuess());
        document.getElementById('newGame').addEventListener('click', () => this.resetGame());
        document.getElementById('newGameFromWinner').addEventListener('click', () => this.resetGame());
        
        // History tab events
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // Input handling
        this.setupInputHandling();
    }

    setupInputHandling() {
        // Setup inputs
        const setupInputs = document.querySelectorAll('.number-input');
        setupInputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                if (e.target.value.length === 1) {
                    const nextInput = setupInputs[index + 1];
                    if (nextInput) {
                        nextInput.focus();
                    }
                }
            });
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && e.target.value === '') {
                    const prevInput = setupInputs[index - 1];
                    if (prevInput) {
                        prevInput.focus();
                    }
                }
            });
        });

        // Guess inputs
        const guessInputs = document.querySelectorAll('.guess-input');
        guessInputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                if (e.target.value.length === 1) {
                    const nextInput = guessInputs[index + 1];
                    if (nextInput) {
                        nextInput.focus();
                    }
                }
            });
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && e.target.value === '') {
                    const prevInput = guessInputs[index - 1];
                    if (prevInput) {
                        prevInput.focus();
                    }
                }
                
                if (e.key === 'Enter') {
                    this.submitGuess();
                }
            });
        });
    }

    async createGame() {
        const playerName = document.getElementById('createPlayerName').value.trim();
        if (!playerName) {
            alert('Please enter your name!');
            return;
        }

        try {
            const response = await fetch('/api/games', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ playerName })
            });
            
            const data = await response.json();
            this.gameId = data.gameId;
            this.playerName = playerName;
            
            this.socket.emit('joinGame', { gameId: this.gameId, playerName: this.playerName });
            this.showGameSetup();
            
        } catch (error) {
            console.error('Error creating game:', error);
            alert('Failed to create game. Please try again.');
        }
    }

    joinGame() {
        const playerName = document.getElementById('joinPlayerName').value.trim();
        const gameCode = document.getElementById('gameCode').value.trim().toUpperCase();
        
        if (!playerName || !gameCode) {
            alert('Please enter both your name and the game code!');
            return;
        }

        this.gameId = gameCode;
        this.playerName = playerName;
        
        this.socket.emit('joinGame', { gameId: this.gameId, playerName: this.playerName });
        this.showGameSetup();
    }

    async loadActiveGames() {
        try {
            const response = await fetch('/api/games');
            const games = await response.json();
            this.displayActiveGames(games);
        } catch (error) {
            console.error('Error loading games:', error);
        }
    }

    displayActiveGames(games) {
        const gamesList = document.getElementById('gamesList');
        gamesList.innerHTML = '';
        
        if (games.length === 0) {
            gamesList.innerHTML = '<p>No active games available</p>';
            return;
        }
        
        games.forEach(game => {
            const gameItem = document.createElement('div');
            gameItem.className = 'game-item';
            gameItem.innerHTML = `
                <h4>Game ${game.gameId}</h4>
                <p>Host: ${game.player1Name}</p>
                <p>Created: ${new Date(game.createdAt).toLocaleTimeString()}</p>
            `;
            
            gameItem.addEventListener('click', () => {
                document.getElementById('gameCode').value = game.gameId;
                document.getElementById('joinPlayerName').focus();
            });
            
            gamesList.appendChild(gameItem);
        });
    }

    showGameSetup() {
        document.getElementById('gameLobby').style.display = 'none';
        document.getElementById('gameSetup').style.display = 'block';
        
        document.getElementById('gameCodeDisplay').textContent = this.gameId;
        document.getElementById('currentPlayerName').textContent = `${this.playerName}'s Numbers`;
        
        // Focus first input
        document.querySelector('.number-input[data-position="0"]').focus();
    }

    setNumbers() {
        const numbers = this.getPlayerNumbers();
        if (!this.validateNumbers(numbers)) {
            alert('Please enter 5 numbers (0-9)!');
            return;
        }

        this.socket.emit('setNumbers', { numbers });
    }

    getPlayerNumbers() {
        const inputs = document.querySelectorAll('.number-input');
        return Array.from(inputs).map(input => parseInt(input.value));
    }

    validateNumbers(numbers) {
        return numbers.every(num => !isNaN(num) && num >= 0 && num <= 9);
    }

    submitGuess() {
        if (!this.isMyTurn) {
            alert("It's not your turn!");
            return;
        }

        const guess = this.getCurrentGuess();
        if (!this.validateGuess(guess)) {
            alert('Please enter 5 numbers for your guess!');
            return;
        }

        this.socket.emit('makeGuess', { guess });
        this.clearGuessInputs();
    }

    getCurrentGuess() {
        const inputs = document.querySelectorAll('.guess-input');
        return Array.from(inputs).map(input => parseInt(input.value));
    }

    validateGuess(guess) {
        return guess.every(num => !isNaN(num) && num >= 0 && num <= 9);
    }

    clearGuessInputs() {
        const inputs = document.querySelectorAll('.guess-input');
        inputs.forEach(input => {
            input.value = '';
        });
    }

    handleGameUpdate(data) {
        switch (data.type) {
            case 'playerJoined':
                this.handlePlayerJoined(data);
                break;
            case 'numbersSet':
                this.handleNumbersSet(data);
                break;
            case 'gameStarted':
                this.handleGameStarted(data);
                break;
            case 'guessResult':
                this.handleGuessResult(data);
                break;
            case 'gameOver':
                this.handleGameOver(data);
                break;
            case 'playerDisconnected':
                this.handlePlayerDisconnected(data);
                break;
        }
    }

    handlePlayerJoined(data) {
        const playersList = document.getElementById('playersList');
        if (data.gameState && data.gameState.gameStarted) {
            playersList.textContent = `${data.playerName} and ${this.playerName}`;
            this.updateGameState(data.gameState);
        } else {
            playersList.textContent = this.playerName;
        }
    }

    handleNumbersSet(data) {
        if (data.playerId !== this.socket.id) {
            document.getElementById('waitingMessage').textContent = 'Other player has set their numbers. Waiting for game to start...';
        }
        
        // Request updated game state
        this.socket.emit('getGameState');
    }

    handleGameStarted(data) {
        this.updateGameState(data.gameState);
        this.showGameBoard();
    }

    handleGuessResult(data) {
        // Game state will be updated separately via gameState event
        this.updateHistoryDisplay();
        
        if (data.feedback.gameOver) {
            this.handleGameOver({ winner: data.feedback.winner });
        }
    }

    handleGameOver(data) {
        const winnerText = data.winner === this.socket.id ? 
            'You win! You correctly guessed the other player\'s number sequence!' :
            'The other player wins! They correctly guessed your number sequence!';
        
        document.getElementById('winnerText').textContent = winnerText;
        document.getElementById('gameBoard').style.display = 'none';
        document.getElementById('winnerScreen').style.display = 'block';
    }

    handlePlayerDisconnected(data) {
        alert('The other player has disconnected from the game.');
        this.resetGame();
    }

    updateGameState(state) {
        this.gameState = state;
        this.isMyTurn = state.isMyTurn;
        
        // Update UI based on game state
        if (state.gameStarted) {
            this.updateCurrentPlayerDisplay();
            this.updateHistoryDisplay();
        }
    }

    updateCurrentPlayerDisplay() {
        const currentPlayerElement = document.getElementById('currentPlayer');
        if (this.isMyTurn) {
            currentPlayerElement.textContent = 'Your Turn!';
        } else {
            currentPlayerElement.textContent = 'Opponent\'s Turn';
        }
    }

    updateHistoryDisplay() {
        if (!this.gameState) return;
        
        const container = document.getElementById('historyContainer');
        container.innerHTML = '';
        
        const history = this.currentTab === 'my-guesses' ? 
            this.gameState.myHistory : 
            this.gameState.opponentHistory;
        
        history.forEach(entry => {
            const entryElement = document.createElement('div');
            entryElement.className = 'guess-entry';
            
            const playerText = this.currentTab === 'my-guesses' ? 'You' : 'Opponent';
            const feedbackText = `Correct numbers: ${entry.feedback.correctNumbers}, Correct positions: ${entry.feedback.correctPositions}`;
            
            entryElement.innerHTML = `
                <div class="guess-numbers">
                    ${entry.guess.map(num => `<div class="guess-number">${num}</div>`).join('')}
                </div>
                <div class="feedback">
                    <strong>${playerText}</strong> - ${feedbackText}
                </div>
            `;
            
            container.appendChild(entryElement);
        });
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Update history display
        this.updateHistoryDisplay();
    }

    showGameBoard() {
        document.getElementById('gameSetup').style.display = 'none';
        document.getElementById('gameBoard').style.display = 'block';
        
        document.getElementById('gameCodeGame').textContent = this.gameId;
        this.updateCurrentPlayerDisplay();
        this.updateHistoryDisplay();
        
        // Focus first guess input
        document.querySelector('.guess-input[data-position="0"]').focus();
    }

    resetGame() {
        // Reset game state
        this.gameId = null;
        this.playerName = null;
        this.isMyTurn = false;
        this.gameState = null;
        
        // Clear all inputs
        const allInputs = document.querySelectorAll('input');
        allInputs.forEach(input => input.value = '');
        
        // Reset display
        document.getElementById('gameLobby').style.display = 'block';
        document.getElementById('gameSetup').style.display = 'none';
        document.getElementById('gameBoard').style.display = 'none';
        document.getElementById('winnerScreen').style.display = 'none';
        
        // Clear history
        document.getElementById('historyContainer').innerHTML = '';
        
        // Reset waiting message
        document.getElementById('waitingMessage').textContent = 'Waiting for other player to join...';
        
        // Reload active games
        this.loadActiveGames();
        
        // Focus first input
        document.getElementById('createPlayerName').focus();
    }

    updateConnectionStatus(status) {
        const indicator = document.getElementById('statusIndicator');
        const text = document.getElementById('statusText');
        
        indicator.className = `status-indicator ${status}`;
        
        switch (status) {
            case 'connected':
                text.textContent = 'Connected';
                break;
            case 'disconnected':
                text.textContent = 'Disconnected';
                break;
            case 'connecting':
                text.textContent = 'Connecting...';
                break;
        }
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MultiplayerNumberWordle();
}); 