class MultiplayerNumberWordle {
    constructor() {
        this.socket = null;
        this.gameId = null;
        this.playerName = null;
        this.isMyTurn = false;
        this.gameState = null;
        this.currentTab = 'my-guesses';
        
        // Single player mode properties
        this.singlePlayerMode = false;
        this.aiNumbers = [];
        this.playerNumbers = [];
        this.singlePlayerHistory = [];
        this.gameStartTime = null;
        this.guessCount = 0;
        this.gameBoardShown = false;
        
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
            
            // If this is the first time we're getting game state and the game has started, show the board
            if (state.gameStarted && !this.gameBoardShown) {
                this.showGameBoard();
                this.gameBoardShown = true;
            }
        });
    }

    initializeEventListeners() {
        // Lobby events
        document.getElementById('createGame').addEventListener('click', () => this.createGame());
        document.getElementById('joinGame').addEventListener('click', () => this.joinGame());
        document.getElementById('startSinglePlayer').addEventListener('click', () => this.startSinglePlayer());
        
        // Game setup events
        document.getElementById('setNumbers').addEventListener('click', () => this.setNumbers());
        
        // Game events
        document.getElementById('submitGuess').addEventListener('click', () => this.submitGuess());
        document.getElementById('submitSinglePlayerGuess').addEventListener('click', () => this.submitSinglePlayerGuess());
        document.getElementById('newGame').addEventListener('click', () => this.resetGame());
        document.getElementById('newGameFromWinner').addEventListener('click', () => this.resetGame());
        document.getElementById('newSinglePlayerGame').addEventListener('click', () => this.resetSinglePlayer());
        document.getElementById('newSinglePlayerGameFromWinner').addEventListener('click', () => this.resetSinglePlayer());
        document.getElementById('backToLobby').addEventListener('click', () => this.backToLobby());
        
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

        // Single player guess inputs
        const singleGuessInputs = document.querySelectorAll('.single-guess-input');
        singleGuessInputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                if (e.target.value.length === 1) {
                    const nextInput = singleGuessInputs[index + 1];
                    if (nextInput) {
                        nextInput.focus();
                    }
                }
            });
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && e.target.value === '') {
                    const prevInput = singleGuessInputs[index - 1];
                    if (prevInput) {
                        prevInput.focus();
                    }
                }
                
                if (e.key === 'Enter') {
                    this.submitSinglePlayerGuess();
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
        // Request updated game state since it's sent separately
        this.socket.emit('getGameState');
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
        // Reset multiplayer game state
        this.gameId = null;
        this.playerName = null;
        this.isMyTurn = false;
        this.gameState = null;
        this.gameBoardShown = false;
        
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

    // Single Player Mode Methods
    startSinglePlayer() {
        const playerName = document.getElementById('singlePlayerName').value.trim();
        if (!playerName) {
            alert('Please enter your name!');
            return;
        }

        this.singlePlayerMode = true;
        this.playerName = playerName;
        this.gameStartTime = Date.now();
        this.guessCount = 0;
        
        // Generate AI numbers
        this.aiNumbers = this.generateAINumbers();
        this.playerNumbers = [];
        this.singlePlayerHistory = [];
        
        // Show single player board
        this.showSinglePlayerBoard();
        
        console.log('AI Numbers:', this.aiNumbers); // For debugging
    }

    generateAINumbers() {
        const numbers = [];
        for (let i = 0; i < 5; i++) {
            numbers.push(Math.floor(Math.random() * 10));
        }
        return numbers;
    }

    showSinglePlayerBoard() {
        document.getElementById('gameLobby').style.display = 'none';
        document.getElementById('singlePlayerBoard').style.display = 'block';
        
        document.getElementById('singlePlayerNameDisplay').textContent = this.playerName;
        this.updateSinglePlayerHistoryDisplay();
        
        // Focus first input
        document.querySelector('.single-guess-input[data-position="0"]').focus();
    }

    submitSinglePlayerGuess() {
        const guess = this.getCurrentSinglePlayerGuess();
        if (!this.validateGuess(guess)) {
            alert('Please enter 5 numbers for your guess!');
            return;
        }

        this.guessCount++;
        
        // Calculate feedback for player's guess
        const playerFeedback = this.calculateFeedback(guess, this.aiNumbers);
        
        // Add to history
        this.singlePlayerHistory.push({
            type: 'player',
            guess: [...guess],
            feedback: playerFeedback,
            timestamp: Date.now()
        });
        
        // Check if player won
        if (playerFeedback.correctPositions === 5) {
            this.endSinglePlayerGame('player');
            return;
        }
        
        // Update display
        this.updateSinglePlayerHistoryDisplay();
        this.clearSinglePlayerGuessInputs();
        
        // Focus first input for next player turn
        document.querySelector('.single-guess-input[data-position="0"]').focus();
    }

    getCurrentSinglePlayerGuess() {
        const inputs = document.querySelectorAll('.single-guess-input');
        return Array.from(inputs).map(input => parseInt(input.value));
    }

    clearSinglePlayerGuessInputs() {
        const inputs = document.querySelectorAll('.single-guess-input');
        inputs.forEach(input => {
            input.value = '';
        });
    }

    // AI guessing removed - single player mode is just player vs AI secret numbers

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

    endSinglePlayerGame(winner) {
        const gameDuration = Math.floor((Date.now() - this.gameStartTime) / 1000);
        const minutes = Math.floor(gameDuration / 60);
        const seconds = gameDuration % 60;
        const durationText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        document.getElementById('singlePlayerWinnerText').textContent = 
            `Congratulations! You won in ${this.guessCount} guesses!`;
        
        document.getElementById('totalGuesses').textContent = this.guessCount;
        document.getElementById('gameDuration').textContent = durationText;
        
        document.getElementById('singlePlayerBoard').style.display = 'none';
        document.getElementById('singlePlayerWinner').style.display = 'block';
    }

    updateSinglePlayerHistoryDisplay() {
        const container = document.getElementById('singlePlayerHistoryContainer');
        container.innerHTML = '';
        
        this.singlePlayerHistory.forEach(entry => {
            const entryElement = document.createElement('div');
            entryElement.className = 'guess-entry';
            
            const feedbackText = `Correct numbers: ${entry.feedback.correctNumbers}, Correct positions: ${entry.feedback.correctPositions}`;
            
            entryElement.innerHTML = `
                <div class="guess-numbers">
                    ${entry.guess.map(num => `<div class="guess-number">${num}</div>`).join('')}
                </div>
                <div class="feedback">
                    <strong>You</strong> - ${feedbackText}
                </div>
            `;
            
            container.appendChild(entryElement);
        });
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    resetSinglePlayer() {
        this.singlePlayerMode = false;
        this.aiNumbers = [];
        this.playerNumbers = [];
        this.singlePlayerHistory = [];
        this.gameStartTime = null;
        this.guessCount = 0;
        
        // Clear all inputs
        const allInputs = document.querySelectorAll('input');
        allInputs.forEach(input => input.value = '');
        
        // Reset display
        document.getElementById('singlePlayerBoard').style.display = 'none';
        document.getElementById('singlePlayerWinner').style.display = 'none';
        document.getElementById('gameLobby').style.display = 'block';
        
        // Clear history
        document.getElementById('singlePlayerHistoryContainer').innerHTML = '';
        
        // Focus first input
        document.getElementById('singlePlayerName').focus();
    }

    backToLobby() {
        this.resetSinglePlayer();
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MultiplayerNumberWordle();
}); 