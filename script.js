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
        this.notes = {}; // Track notes for each number (0-9)
        
        // Mobile persistence properties
        this.lastGameState = null;
        this.recoveryAttempts = 0;
        this.maxRecoveryAttempts = 3;
        
        // Player tracking
        this.player1Name = null;
        this.player2Name = null;
        
        this.initializeSocket();
        this.initializeEventListeners();
        this.updateConnectionStatus('connecting');
    }

    initializeSocket() {
        // Configure Socket.IO for mobile persistence
        this.socket = io({
            transports: ['websocket', 'polling'],
            upgrade: true,
            rememberUpgrade: true,
            timeout: 20000,
            forceNew: false
        });
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateConnectionStatus('connected');
            this.loadActiveGames();
            
            // Try to recover game state if we were in a game
            this.attemptGameRecovery();
        });
        
        this.socket.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
            this.updateConnectionStatus('disconnected');
            
            // Store current game state for recovery
            this.storeGameStateForRecovery();
        });
        
        this.socket.on('reconnect', (attemptNumber) => {
            console.log('Reconnected after', attemptNumber, 'attempts');
            this.updateConnectionStatus('connected');
            
            // Attempt to recover game state
            this.attemptGameRecovery();
        });
        
        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log('Reconnection attempt', attemptNumber);
            this.updateConnectionStatus('connecting');
        });
        
        this.socket.on('reconnect_error', (error) => {
            console.log('Reconnection error:', error);
            this.updateConnectionStatus('disconnected');
        });
        
        this.socket.on('reconnect_failed', () => {
            console.log('Reconnection failed');
            this.updateConnectionStatus('disconnected');
        });
        
        this.socket.on('gameUpdate', (data) => {
            this.handleGameUpdate(data);
        });
        
        this.socket.on('gameState', (state) => {
            console.log('Received game state:', state);
            this.updateGameState(state);
        });
        
        // Handle game recovery responses
        this.socket.on('recoveryResponse', (data) => {
            this.handleRecoveryResponse(data.success, data.gameState);
        });
        
        // Handle player reconnection
        this.socket.on('playerReconnected', (data) => {
            this.handlePlayerReconnected(data);
        });
        
        // Handle page visibility changes (mobile app switching)
        this.setupVisibilityHandling();
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
        document.getElementById('newSinglePlayerGameFromGiveUp').addEventListener('click', () => this.resetSinglePlayer());
        document.getElementById('backToLobby').addEventListener('click', () => this.backToLobby());
        document.getElementById('backToLobbyFromGiveUp').addEventListener('click', () => this.backToLobby());
        document.getElementById('giveUp').addEventListener('click', () => this.giveUp());
        
        // History tab events
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // Notes events
        document.getElementById('clearNotes').addEventListener('click', () => this.clearAllNotes());
        
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
            
            // Set the first player (game creator) as player1
            this.player1Name = playerName;
            
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
        
        // If this is the first player joining, set them as player1
        if (!this.player1Name) {
            this.player1Name = playerName;
        }
        
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
        
        // Focus first input box for next guess
        document.querySelector('.guess-input[data-position="0"]').focus();
    }

    handleGameUpdate(data) {
        switch (data.type) {
            case 'playerJoined':
                this.handlePlayerJoined(data);
                break;
            case 'secondPlayerJoined':
                this.handleSecondPlayerJoined(data);
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
            case 'playerReconnected':
                this.handlePlayerReconnected(data);
                break;
        }
    }

    handlePlayerJoined(data) {
        const playersList = document.getElementById('playersList');
        if (data.gameState && data.gameState.gameStarted) {
            // Game has started, show both player names
            this.updatePlayerListDisplay();
            this.updateGameState(data.gameState);
        } else {
            // Only one player so far, show current player
            playersList.textContent = this.playerName;
        }
    }

    handleSecondPlayerJoined(data) {
        console.log('Second player joined:', data);
        
        // Set the second player name
        this.player2Name = data.playerName;
        
        // Update waiting message
        document.getElementById('waitingMessage').textContent = 'Both players joined! Set your numbers to start the game.';
        
        // Update player list display
        this.updatePlayerListDisplay();
        
        // Request updated game state
        this.socket.emit('getGameState');
    }

    updatePlayerListDisplay() {
        const playersList = document.getElementById('playersList');
        if (!playersList) return;
        
        if (this.player1Name && this.player2Name) {
            // Both players have joined
            playersList.textContent = `${this.player1Name} and ${this.player2Name}`;
        } else if (this.player1Name) {
            // Only first player has joined
            playersList.textContent = this.player1Name;
        } else {
            // No players yet
            playersList.textContent = 'Waiting for players...';
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
        console.log('Game started event received:', data);
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
        
        // Show revealed numbers if available
        this.showRevealedNumbers();
    }

    showRevealedNumbers() {
        // Check if we have revealed numbers in the game state
        if (this.gameState && this.gameState.revealedNumbers) {
            const revealed = this.gameState.revealedNumbers;
            
            // Show the revealed numbers section
            document.getElementById('revealedNumbersSection').style.display = 'block';
            
            // Update player names
            document.getElementById('player1NameDisplay').textContent = revealed.player1Name;
            document.getElementById('player2NameDisplay').textContent = revealed.player2Name;
            
            // Display Player 1 numbers
            const player1Container = document.getElementById('player1NumbersDisplay');
            player1Container.innerHTML = '';
            if (revealed.player1Numbers) {
                revealed.player1Numbers.forEach(num => {
                    const numberElement = document.createElement('div');
                    numberElement.className = 'revealed-number';
                    numberElement.textContent = num;
                    player1Container.appendChild(numberElement);
                });
            }
            
            // Display Player 2 numbers
            const player2Container = document.getElementById('player2NumbersDisplay');
            player2Container.innerHTML = '';
            if (revealed.player2Numbers) {
                revealed.player2Numbers.forEach(num => {
                    const numberElement = document.createElement('div');
                    numberElement.className = 'revealed-number';
                    numberElement.textContent = num;
                    player2Container.appendChild(numberElement);
                });
            }
            
            // Show game statistics if available
            this.showGameStats();
        }
    }

    showGameStats() {
        if (this.gameState) {
            const statsSection = document.getElementById('gameStatsSection');
            const statsGrid = document.getElementById('statsGrid');
            
            if (statsSection && statsGrid) {
                statsSection.style.display = 'block';
                statsGrid.innerHTML = '';
                
                // Calculate and display various statistics
                const stats = this.calculateGameStats();
                
                // Total guesses for each player
                const player1Guesses = stats.player1Guesses;
                const player2Guesses = stats.player2Guesses;
                
                // Add stat items
                this.addStatItem(statsGrid, player1Guesses, 'Player 1 Guesses');
                this.addStatItem(statsGrid, player2Guesses, 'Player 2 Guesses');
                
                // Game duration if available
                if (stats.gameDuration) {
                    this.addStatItem(statsGrid, stats.gameDuration, 'Game Duration');
                }
                
                // Winner info
                const winnerName = this.gameState.winner === this.socket.id ? 'You' : 'Opponent';
                this.addStatItem(statsGrid, winnerName, 'Winner');
            }
        }
    }

    calculateGameStats() {
        const stats = {
            player1Guesses: 0,
            player2Guesses: 0,
            gameDuration: null
        };
        
        if (this.gameState) {
            // Count guesses for each player
            if (this.gameState.myHistory) {
                stats.player1Guesses = this.gameState.myHistory.length;
            }
            if (this.gameState.opponentHistory) {
                stats.player2Guesses = this.gameState.opponentHistory.length;
            }
            
            // Calculate game duration if we have timestamps
            if (this.gameState.myHistory && this.gameState.myHistory.length > 0) {
                const firstGuess = this.gameState.myHistory[0].timestamp;
                const lastGuess = this.gameState.myHistory[this.gameState.myHistory.length - 1].timestamp;
                const duration = Math.floor((lastGuess - firstGuess) / 1000);
                const minutes = Math.floor(duration / 60);
                const seconds = duration % 60;
                stats.gameDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }
        }
        
        return stats;
    }

    addStatItem(container, value, label) {
        const statItem = document.createElement('div');
        statItem.className = 'stat-item';
        statItem.innerHTML = `
            <div class="stat-value">${value}</div>
            <div class="stat-label">${label}</div>
        `;
        container.appendChild(statItem);
    }

    handlePlayerDisconnected(data) {
        if (data.gracePeriod) {
            // Show grace period message instead of immediately ending game
            this.showGracePeriodMessage(data.playerName);
        } else {
            alert('The other player has disconnected from the game.');
            this.resetGame();
        }
    }

    showGracePeriodMessage(playerName) {
        // Create or update grace period message
        let graceMessage = document.getElementById('gracePeriodMessage');
        if (!graceMessage) {
            graceMessage = document.createElement('div');
            graceMessage.id = 'gracePeriodMessage';
            graceMessage.className = 'grace-period-message';
            graceMessage.innerHTML = `
                <div class="grace-period-content">
                    <h3>⏰ Player Disconnected</h3>
                    <p><strong>${playerName}</strong> has disconnected from the game.</p>
                    <p>You can wait up to <strong>5 minutes</strong> for them to rejoin.</p>
                    <div class="grace-period-timer" id="gracePeriodTimer">5:00</div>
                    <p class="grace-period-note">The game will continue automatically when they return.</p>
                    <button class="end-game-btn" id="endGameEarly">End Game Now</button>
                </div>
            `;
            
            // Insert after the game header
            const gameHeader = document.querySelector('.game-header');
            if (gameHeader) {
                gameHeader.parentNode.insertBefore(graceMessage, gameHeader.nextSibling);
            }
            
            // Add event listener for ending game early
            document.getElementById('endGameEarly').addEventListener('click', () => {
                this.endGameEarly();
            });
            
            // Start countdown timer
            this.startGracePeriodTimer();
        } else {
            // Update existing message
            graceMessage.querySelector('p strong').textContent = playerName;
        }
    }

    startGracePeriodTimer() {
        let timeLeft = 300; // 5 minutes in seconds
        const timerElement = document.getElementById('gracePeriodTimer');
        
        const countdown = setInterval(() => {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            if (timeLeft <= 0) {
                clearInterval(countdown);
                this.gracePeriodExpired();
            }
            timeLeft--;
        }, 1000);
        
        // Store the interval ID so we can clear it if needed
        this.gracePeriodInterval = countdown;
    }

    gracePeriodExpired() {
        const graceMessage = document.getElementById('gracePeriodMessage');
        if (graceMessage) {
            graceMessage.innerHTML = `
                <div class="grace-period-content expired">
                    <h3>⏰ Grace Period Expired</h3>
                    <p>The other player did not return within 5 minutes.</p>
                    <button class="new-game-btn" onclick="this.resetGame()">Return to Lobby</button>
                </div>
            `;
        }
    }

    endGameEarly() {
        if (confirm('Are you sure you want to end the game? The other player will not be able to rejoin.')) {
            this.resetGame();
        }
    }

    handlePlayerReconnected(data) {
        // Remove grace period message
        const graceMessage = document.getElementById('gracePeriodMessage');
        if (graceMessage) {
            graceMessage.remove();
        }
        
        // Clear any grace period timer
        if (this.gracePeriodInterval) {
            clearInterval(this.gracePeriodInterval);
            this.gracePeriodInterval = null;
        }
        
        // Show reconnection message
        this.showReconnectionMessage(data.playerName);
        
        // Update game state
        if (data.gameState) {
            this.updateGameState(data.gameState);
        }
    }

    showReconnectionMessage(playerName) {
        // Create temporary reconnection notification
        const notification = document.createElement('div');
        notification.className = 'reconnection-notification';
        notification.innerHTML = `
            <div class="reconnection-content">
                <h3>🎉 Player Reconnected!</h3>
                <p><strong>${playerName}</strong> has rejoined the game.</p>
            </div>
        `;
        
        // Insert at the top of the game board
        const gameBoard = document.getElementById('gameBoard');
        if (gameBoard) {
            gameBoard.insertBefore(notification, gameBoard.firstChild);
            
            // Remove after 3 seconds
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 3000);
        }
    }

    updateGameState(state) {
        console.log('Updating game state:', state);
        this.gameState = state;
        this.isMyTurn = state.isMyTurn;
        
        // Update UI based on game state
        if (state.gameStarted && !this.gameBoardShown) {
            console.log('Game started, showing game board');
            this.showGameBoard();
            this.gameBoardShown = true;
        }
        
        if (state.gameStarted) {
            this.updateCurrentPlayerDisplay();
            this.updateHistoryDisplay();
            this.updateMyNumbersDisplay(state);
            this.updateDuplicateWarning(state);
            
            // If game is finished, show winner screen with revealed numbers
            if (state.gameStatus === 'finished' && state.winner) {
                this.handleGameOver({ winner: state.winner });
            }
        }
        
        // Fallback: if game is started but board not shown, force show it
        if (state.gameStarted && !this.gameBoardShown) {
            console.log('Fallback: forcing game board to show');
            this.showGameBoard();
            this.gameBoardShown = true;
        }
    }

    updateMyNumbersDisplay(state) {
        const container = document.getElementById('myNumbersDisplay');
        if (!container) return;
        
        if (state.myNumbers && state.myNumbers.length === 5) {
            container.innerHTML = '';
            state.myNumbers.forEach(num => {
                const numberElement = document.createElement('div');
                numberElement.className = 'my-number';
                numberElement.textContent = num;
                container.appendChild(numberElement);
            });
        } else {
            container.innerHTML = '<p>Numbers not set yet</p>';
        }
    }

    updateDuplicateWarning(state) {
        const warning = document.getElementById('duplicateWarning');
        if (!warning) return;
        
        if (state.opponentHasDuplicates) {
            warning.style.display = 'block';
        } else {
            warning.style.display = 'none';
        }
    }

    initializeNotesGrid() {
        const container = document.getElementById('notesGrid');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Create grid for numbers 0-9
        for (let i = 0; i < 10; i++) {
            const noteElement = document.createElement('div');
            noteElement.className = 'note-number unknown';
            noteElement.textContent = i;
            noteElement.dataset.number = i;
            
            noteElement.addEventListener('click', () => this.toggleNote(i));
            
            container.appendChild(noteElement);
        }
        
        this.updateNotesDisplay();
    }

    toggleNote(number) {
        // Cycle through: unknown -> definitely-in -> definitely-not -> unknown
        if (!this.notes[number] || this.notes[number] === 'unknown') {
            this.notes[number] = 'definitely-in';
        } else if (this.notes[number] === 'definitely-in') {
            this.notes[number] = 'definitely-not';
        } else {
            this.notes[number] = 'unknown';
        }
        
        this.updateNotesDisplay();
    }

    updateNotesDisplay() {
        const noteElements = document.querySelectorAll('.note-number');
        noteElements.forEach(element => {
            const number = parseInt(element.dataset.number);
            const noteState = this.notes[number] || 'unknown';
            
            // Remove all classes and add the current one
            element.className = `note-number ${noteState}`;
        });
    }

    clearAllNotes() {
        this.notes = {};
        this.updateNotesDisplay();
    }

    setupVisibilityHandling() {
        // Handle page visibility changes (mobile app switching)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('Page hidden - storing game state');
                this.storeGameStateForRecovery();
            } else {
                console.log('Page visible - checking connection');
                if (!this.socket.connected) {
                    console.log('Socket not connected, attempting reconnection');
                    this.socket.connect();
                }
            }
        });

        // Handle beforeunload (page refresh/close)
        window.addEventListener('beforeunload', () => {
            this.storeGameStateForRecovery();
        });

        // Handle mobile-specific events
        if ('onpagehide' in window) {
            window.addEventListener('pagehide', () => {
                this.storeGameStateForRecovery();
            });
        }

        // Handle online/offline events
        window.addEventListener('online', () => {
            console.log('Device came online');
            if (!this.socket.connected) {
                this.socket.connect();
            }
        });

        window.addEventListener('offline', () => {
            console.log('Device went offline');
            this.updateConnectionStatus('disconnected');
        });
    }

    storeGameStateForRecovery() {
        if (this.gameId && this.gameState) {
            const recoveryData = {
                gameId: this.gameId,
                playerName: this.playerName,
                gameState: this.gameState,
                notes: this.notes,
                timestamp: Date.now()
            };
            
            try {
                localStorage.setItem('numberWordleRecovery', JSON.stringify(recoveryData));
                console.log('Game state stored for recovery');
            } catch (error) {
                console.log('Could not store game state:', error);
            }
        }
    }

    attemptGameRecovery() {
        if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
            console.log('Max recovery attempts reached');
            return;
        }

        try {
            const recoveryData = localStorage.getItem('numberWordleRecovery');
            if (recoveryData) {
                const data = JSON.parse(recoveryData);
                const timeSinceStored = Date.now() - data.timestamp;
                
                // Only attempt recovery if data is less than 1 hour old
                if (timeSinceStored < 3600000 && data.gameId && data.playerName) {
                    console.log('Attempting game recovery for:', data.gameId);
                    
                    // Try to rejoin the game
                    this.socket.emit('attemptRecovery', {
                        gameId: data.gameId,
                        playerName: data.playerName
                    });
                    
                    this.recoveryAttempts++;
                } else {
                    console.log('Recovery data too old, clearing');
                    localStorage.removeItem('numberWordleRecovery');
                }
            }
        } catch (error) {
            console.log('Error during game recovery:', error);
        }
    }

    handleRecoveryResponse(success, gameState) {
        if (success && gameState) {
            console.log('Game recovery successful');
            this.gameId = gameState.gameId;
            this.playerName = gameState.playerName;
            this.gameState = gameState;
            this.gameBoardShown = true;
            
            // Restore notes if available
            try {
                const recoveryData = localStorage.getItem('numberWordleRecovery');
                if (recoveryData) {
                    const data = JSON.parse(recoveryData);
                    if (data.notes) {
                        this.notes = data.notes;
                    }
                }
            } catch (error) {
                console.log('Could not restore notes:', error);
            }
            
            // Show the game board
            this.showGameBoard();
            this.updateGameState(gameState);
            
            // Clear recovery data
            localStorage.removeItem('numberWordleRecovery');
            this.recoveryAttempts = 0;
            
            console.log('Game recovered successfully');
        } else {
            console.log('Game recovery failed');
            this.recoveryAttempts = 0;
            localStorage.removeItem('numberWordleRecovery');
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
        console.log('Showing game board for game:', this.gameId);
        document.getElementById('gameSetup').style.display = 'none';
        document.getElementById('gameBoard').style.display = 'block';
        
        document.getElementById('gameCodeGame').textContent = this.gameId;
        this.updateCurrentPlayerDisplay();
        this.updateHistoryDisplay();
        
        // Update numbers display and duplicate warning if game state exists
        if (this.gameState) {
            this.updateMyNumbersDisplay(this.gameState);
            this.updateDuplicateWarning(this.gameState);
        }
        
        // Initialize notes grid
        this.initializeNotesGrid();
        
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
        this.notes = {};
        
        // Reset player tracking
        this.player1Name = null;
        this.player2Name = null;
        
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
        document.getElementById('singlePlayerGiveUp').style.display = 'none';
        document.getElementById('gameLobby').style.display = 'block';
        
        // Clear history
        document.getElementById('singlePlayerHistoryContainer').innerHTML = '';
        
        // Focus first input
        document.getElementById('singlePlayerName').focus();
    }

    backToLobby() {
        this.resetSinglePlayer();
    }

    giveUp() {
        const gameDuration = Math.floor((Date.now() - this.gameStartTime) / 1000);
        const minutes = Math.floor(gameDuration / 60);
        const seconds = gameDuration % 60;
        const durationText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Display AI numbers
        const aiNumbersContainer = document.getElementById('aiNumbersRevealed');
        aiNumbersContainer.innerHTML = '';
        
        this.aiNumbers.forEach(num => {
            const numberElement = document.createElement('div');
            numberElement.className = 'ai-number';
            numberElement.textContent = num;
            aiNumbersContainer.appendChild(numberElement);
        });
        
        // Update stats
        document.getElementById('giveUpTotalGuesses').textContent = this.guessCount;
        document.getElementById('giveUpGameDuration').textContent = durationText;
        
        // Hide game board, show give up screen
        document.getElementById('singlePlayerBoard').style.display = 'none';
        document.getElementById('singlePlayerGiveUp').style.display = 'block';
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MultiplayerNumberWordle();
}); 