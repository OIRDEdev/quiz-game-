document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    
    // Admin UI elements
    const loginPanel = document.getElementById('login-panel');
    const dashboard = document.getElementById('dashboard');
    const gameSummary = document.getElementById('game-summary');
    const adminPassword = document.getElementById('admin-password');
    const adminLoginBtn = document.getElementById('admin-login-btn');
    const startGameBtn = document.getElementById('start-game');
    const pauseGameBtn = document.getElementById('pause-game');
    const resumeGameBtn = document.getElementById('resume-game');
    const endGameBtn = document.getElementById('end-game');
    const adminPlayersList = document.getElementById('admin-players-list');
    const gameStatusText = document.getElementById('game-status-text');
    const adminQuestionCounter = document.getElementById('admin-question-counter');
    const adminQuestionText = document.getElementById('admin-question-text');
    const adminCorrectAnswer = document.getElementById('admin-correct-answer');
    const adminExplanation = document.getElementById('admin-explanation');
    const answersCount = document.getElementById('answers-count');
    const correctCount = document.getElementById('correct-count');
    startGameBtn.disabled = true;
    // Charts
    let answersChart = null;
    let performanceChart = null;

    // Admin login
    adminLoginBtn.addEventListener('click', () => {
        const password = adminPassword.value.trim();
        
        if (!password) {
            alert('Please enter the admin password');
            return;
        }
        
        socket.emit('admin_login', password);
    });
    
    // Handle admin login result
    socket.on('admin_login_success', () => {
        loginPanel.classList.add('hidden');
        dashboard.classList.remove('hidden');
        startGameBtn.disabled = false;
    });
    
    socket.on('admin_login_failed', () => {
        alert('Invalid admin password. Please try again.');
    });
    
    // Update game state
    socket.on('update_game_state', (data) => {
        // Update game status
        updateGameStatus(data.isActive);
        
        // Update question counter
        adminQuestionCounter.textContent = `${data.currentQuestion}/${data.totalQuestions}`;
        
        // Update buttons based on game state
        updateButtonsState(data.isActive);
        
        // Update players list
        updatePlayersList(data.players);
    });
    
    // Handle player join/leave
    socket.on('player_joined', (data) => {
        addPlayerToList(data);
    });
    
    socket.on('player_left', (data) => {
        removePlayerFromList(data.playerId);
    });
    
    // Update waiting players list
    socket.on('update_waiting_players', (players) => {
        updatePlayersList(players);
    });
    
    // Admin receives question data
    socket.on('admin_question_data', (data) => {
        // Update question counter
        adminQuestionCounter.textContent = `${data.index + 1}/${data.total}`;
        
        // Update question display
        adminQuestionText.textContent = data.question;
        adminCorrectAnswer.textContent = data.correctAnswer;
        adminExplanation.textContent = data.explanation;
        
        // Reset answer stats
        answersCount.textContent = `0/${Object.keys(data.players || {}).length}`;
        correctCount.textContent = '0 (0%)';
        
        // Initialize chart
        initAnswersChart(data.options);
    });
    
    // Admin receives stats updates
    socket.on('stats_update', (data) => {
        // Update answer counts
        answersCount.textContent = `${data.answerCount}/${data.totalPlayers}`;
        
        const correctPercentage = data.answerCount > 0 
            ? Math.round((data.questionStats.correctAnswers / data.answerCount) * 100) 
            : 0;
            
        correctCount.textContent = `${data.questionStats.correctAnswers} (${correctPercentage}%)`;
        
        // Update chart data
        updateAnswersChart(data.questionStats.answerDistribution);
    });
    
    // Game ended
    socket.on('game_ended', (data) => {
        dashboard.classList.add('hidden');
        gameSummary.classList.remove('hidden');
        
        // Update buttons
        startGameBtn.disabled = false;
        pauseGameBtn.disabled = true;
        resumeGameBtn.disabled = true;
        endGameBtn.disabled = true;
        
        // Update game status
        gameStatusText.textContent = 'Game Ended';
        
        // Populate leaderboard
        const adminLeaderboard = document.getElementById('admin-leaderboard');
        adminLeaderboard.innerHTML = '';
        
        data.leaderboard.forEach((player, index) => {
            const rankItem = document.createElement('li');
            rankItem.innerHTML = `
                <span>${index + 1}. ${player.username}</span>
                <span>${player.score} points</span>
            `;
            adminLeaderboard.appendChild(rankItem);
        });
        
        // Create performance overview chart
        createPerformanceChart(data.statistics);
    });
    
    // Game control buttons
    startGameBtn.addEventListener('click', () => {
        socket.emit('start_game');
    });
    
    pauseGameBtn.addEventListener('click', () => {
        socket.emit('pause_game');
    });
    
    resumeGameBtn.addEventListener('click', () => {
        socket.emit('resume_game');
    });
    
    endGameBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to end the game?')) {
            socket.emit('end_game');
        }
    });
    
    // Helper functions
    function updateGameStatus(isActive) {
        gameStatusText.textContent = isActive ? 'In Progress' : 'Not Started';
    }
    
    function updateButtonsState(isActive) {
        startGameBtn.disabled = isActive;
        pauseGameBtn.disabled = !isActive;
        resumeGameBtn.disabled = isActive;
        endGameBtn.disabled = !isActive;
    }
    
    function updatePlayersList(players) {
        adminPlayersList.innerHTML = '';
        
        if (players.length === 0) {
            const emptyItem = document.createElement('li');
            emptyItem.textContent = 'No players connected';
            adminPlayersList.appendChild(emptyItem);
            return;
        }
        
        players.forEach(player => {
            addPlayerToList(player);
        });
    }
    
    function addPlayerToList(player) {
        // Remove any existing entry for this player
        removePlayerFromList(player.id);
        
        const playerItem = document.createElement('li');
        playerItem.id = `player-${player.id}`;
        playerItem.innerHTML = `
            <span>${player.username}</span>
            <span class="player-score">${player.score || 0} pts</span>
        `;
        adminPlayersList.appendChild(playerItem);
    }
    
    function removePlayerFromList(playerId) {
        const existingPlayer = document.getElementById(`player-${playerId}`);
        if (existingPlayer) {
            existingPlayer.remove();
        }
    }
    
    function initAnswersChart(options) {
        // Destroy existing chart if it exists
        if (answersChart) {
            answersChart.destroy();
        }
        
        // Initialize data with zeros
        const data = {};
        options.forEach(option => {
            data[option] = 0;
        });
        
        // Create chart
        const ctx = document.getElementById('answers-chart').getContext('2d');
        answersChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: options,
                datasets: [{
                    label: 'Answers',
                    data: Object.values(data),
                    backgroundColor: [
                        'rgba(54, 162, 235, 0.6)',
                        'rgba(255, 99, 132, 0.6)',
                        'rgba(255, 206, 86, 0.6)',
                        'rgba(75, 192, 192, 0.6)',
                        'rgba(153, 102, 255, 0.6)'
                    ],
                    borderColor: [
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 99, 132, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        precision: 0
                    }
                }
            }
        });
    }
    
    function updateAnswersChart(distributionData) {
        if (!answersChart) return;
        
        // Update chart data
        answersChart.data.datasets[0].data = Object.values(distributionData);
        answersChart.update();
    }
    
    function createPerformanceChart(statistics) {
        if (performanceChart) {
            performanceChart.destroy();
        }
        
        // Prepare data
        const questionNumbers = [];
        const correctPercentages = [];
        
        statistics.questionStats.forEach((stat, index) => {
            questionNumbers.push(`Q${index + 1}`);
            const percentage = stat.totalAnswers > 0 
                ? (stat.correctAnswers / stat.totalAnswers) * 100 
                : 0;
            correctPercentages.push(percentage.toFixed(1));
        });
        
        // Create chart
        const ctx = document.getElementById('performance-chart').getContext('2d');
        performanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: questionNumbers,
                datasets: [{
                    label: 'Correct Answer %',
                    data: correctPercentages,
                    fill: false,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.y}% correct`;
                            }
                        }
                    }
                }
            }
        });
    }
});