document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    
    // Game elements
    const timer = document.getElementById('timer');
    const timerProgress = document.getElementById('timer-progress');
    const currentQuestionEl = document.getElementById('current-question');
    const totalQuestionsEl = document.getElementById('total-questions');
    const questionText = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const answerResult = document.getElementById('answer-result');
    const resultIcon = document.getElementById('result-icon');
    const resultText = document.getElementById('result-text');
    const explanationContainer = document.getElementById('explanation-container');
    const correctAnswer = document.getElementById('correct-answer');
    const explanation = document.getElementById('explanation');
    const gameOver = document.getElementById('game-over');
    const leaderboard = document.getElementById('leaderboard');
    const backToLobby = document.getElementById('back-to-lobby');
    // Add new leaderboard elements
    const questionLeaderboard = document.getElementById('question-leaderboard');
    const liveLeaderboard = document.getElementById('live-leaderboard');
    
    // Store previous rankings to track changes
    let previousRanks = {};
    
    // Check if user is logged in
    const username = sessionStorage.getItem('username');
    
    if (!username) {
        // Redirect to login if not logged in
        window.location.href = '/';
        return;
    }
    
    // Game state
    let selectedOption = null;
    let hasAnswered = false;
    
    // Handle receiving new question
    socket.on('new_question', (data) => {
        // Reset UI state
        resetUIForNewQuestion();
        
        // Update question counter
        currentQuestionEl.textContent = data.index + 1;
        totalQuestionsEl.textContent = data.total;
        
        // Update question text
        questionText.textContent = data.question;
        
        // Create option buttons
        data.options.forEach(option => {
            const optionButton = document.createElement('div');
            optionButton.className = 'option';
            optionButton.textContent = option;
            optionButton.dataset.value = option;
            
            // Option click handler
            optionButton.addEventListener('click', () => {
                if (hasAnswered) return;
                
                // Deselect previous option if any
                if (selectedOption) {
                    selectedOption.classList.remove('selected');
                }
                
                // Select this option
                optionButton.classList.add('selected');
                selectedOption = optionButton;
                
                // Submit answer to server
                socket.emit('submit_answer', {
                    answer: option
                });
                
                

                hasAnswered = true;
                
                // Disable all options
                disableOptions();
            });
            
            optionsContainer.appendChild(optionButton);
        });
    });
    
    // Handle question timer
    socket.on('question_timer', (data) => {
        // Update timer text
        timer.textContent = data.time;
        
        // Update timer progress bar
        const timePercentage = (data.time / 20) * 100;
        timerProgress.style.width = `${timePercentage}%`;
        
        // Change color when time is running out
        if (data.time <= 5) {
            timerProgress.style.backgroundColor = '#f44336';
        } else if (data.time <= 10) {
            timerProgress.style.backgroundColor = '#ff9800';
        } else {
            timerProgress.style.backgroundColor = '#4caf50';
        }
    });
    
    // Handle answer feedback
    socket.on('answer_received', (data) => {
        showAnswerResult(data.isCorrect);

        correctAnswer.textContent = data.correctAnswer;
        explanation.textContent = data.explanation;
        explanationContainer.classList.remove('hidden');
    });
    
    // Handle showing correct answer
    socket.on('show_answer', (data) => {
        // If user didn't answer, disable all options
        if (!hasAnswered) {
            disableOptions();
        }
        
        // Highlight correct option
        const options = optionsContainer.querySelectorAll('.option');
        options.forEach(option => {
            if (option.dataset.value === data.correctAnswer) {
                option.classList.add('correct');
            } else if (option === selectedOption) {
                option.classList.add('incorrect');
            }
        });
        
        
        // Wait a bit before showing the leaderboard
        setTimeout(() => {
            // Request current leaderboard from server
            socket.emit('request_leaderboard');
        }, 2000);
    });
    
    // Handle receiving leaderboard data
    socket.on('leaderboard_update', (data) => {
        // Hide question container and show leaderboard
        answerResult.classList.add('hidden');
        
        updateLiveLeaderboard(data.leaderboard);
        questionLeaderboard.classList.remove('hidden');

        document.querySelector('.question-container').classList.add('hidden');
        explanationContainer.classList.add('hidden');
        
        // Add animation class to make it stand out
        questionLeaderboard.classList.add('leaderboard-active');
    });
    
    // Handle game ended
    socket.on('game_ended', (data) => {
        // Hide all game elements
        document.querySelector('.game-container').classList.add('hidden');
        questionLeaderboard.classList.add('hidden');
        gameOver.classList.remove('hidden');
        
        // Populate final leaderboard
        const sortedPlayers = data.leaderboard.slice(0, 10); // Top 10 players
        
        leaderboard.innerHTML = '';
        sortedPlayers.forEach((player, index) => {
            const rankItem = document.createElement('li');
            rankItem.innerHTML = `
                <span>${index + 1}. ${player.username}</span>
                <span>${player.score} points</span>
            `;
            leaderboard.appendChild(rankItem);
        });
    });
    
    // Game paused notification
    socket.on('game_paused', () => {
        showNotification('Game Paused', 'The game has been paused by the admin.');
    });
    
    // Game resumed notification
    socket.on('game_resumed', () => {
        hideNotification();
    });
    
    // Back to lobby button
    backToLobby.addEventListener('click', () => {
        window.location.href = '/';
    });
    
    // Helper functions
    function resetUIForNewQuestion() {
        // Clear options
        optionsContainer.innerHTML = '';
        
        // Reset answer state
        selectedOption = null;
        hasAnswered = false;
        
        // Hide result and explanation
        answerResult.classList.add('hidden');
        explanationContainer.classList.add('hidden');
        
        // Hide leaderboard and show question container again
        questionLeaderboard.classList.add('hidden');
        questionLeaderboard.classList.remove('leaderboard-active');
        document.querySelector('.question-container').classList.remove('hidden');
    }
    
    function disableOptions() {
        const options = optionsContainer.querySelectorAll('.option');
        options.forEach(option => {
            option.classList.add('disabled');
        });
    }
    
    function showAnswerResult(isCorrect) {
        resultIcon.innerHTML = isCorrect ? '✓' : '✗';
        resultText.textContent = isCorrect ? 'Correct!' : 'Incorrect!';
        answerResult.style.backgroundColor = isCorrect ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)';
        answerResult.classList.remove('hidden');
    }
    
    function showNotification(title, message) {
        // Create notification if it doesn't exist
        if (!document.getElementById('game-notification')) {
            const notification = document.createElement('div');
            notification.id = 'game-notification';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background-color: white;
                padding: 1rem;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 1000;
                text-align: center;
            `;
            
            const notificationTitle = document.createElement('h3');
            notificationTitle.id = 'notification-title';
            
            const notificationMessage = document.createElement('p');
            notificationMessage.id = 'notification-message';
            
            notification.appendChild(notificationTitle);
            notification.appendChild(notificationMessage);
            document.body.appendChild(notification);
        }
        
        // Update notification content
        document.getElementById('notification-title').textContent = title;
        document.getElementById('notification-message').textContent = message;
        document.getElementById('game-notification').style.display = 'block';
    }
    
    function hideNotification() {
        const notification = document.getElementById('game-notification');
        if (notification) {
            notification.style.display = 'none';
        }
    }
    
    // Reconnect logic
    socket.on('connect', () => {
        // Refresh page if reconnected to get current state
        if (document.querySelector('.game-container').style.display !== 'none') {
            socket.emit('player_login', username);
        }
    });
    
    // New function to update live leaderboard with animations
    function updateLiveLeaderboard(players) {
        // Take only top 10 players
        const topPlayers = players.slice(0, 10);
        
        // Clear the leaderboard
        liveLeaderboard.innerHTML = '';
        
        // Populate with new data
        topPlayers.forEach((player, index) => {
            const rankItem = document.createElement('li');
            rankItem.className = 'leaderboard-item';
            rankItem.dataset.playerId = player.id;
            
            // Determine if rank changed for animation
            let rankChangeClass = '';
            let rankChangeIcon = '';
            
            if (previousRanks[player.id] !== undefined) {
                if (index < previousRanks[player.id]) {
                    rankChangeClass = 'rank-up';
                    rankChangeIcon = '↑';
                } else if (index > previousRanks[player.id]) {
                    rankChangeClass = 'rank-down';
                    rankChangeIcon = '↓';
                }
            }
            
            // Highlight current user
            const isCurrentUser = player.id === socket.id;
            const currentUserClass = isCurrentUser ? 'current-user' : '';
            
            rankItem.innerHTML = `
                <div class="rank-change-indicator ${rankChangeClass}"></div>
                <div class="rank-info ${currentUserClass}">
                    <span class="rank-position">${index + 1}.</span>
                    <span class="player-name">${player.username}${isCurrentUser ? ' (You)' : ''}</span>
                    <span class="rank-change-icon">${rankChangeIcon}</span>
                    <span class="player-score">${player.score} pts</span>
                </div>
            `;
            
            liveLeaderboard.appendChild(rankItem);
            
            // Add entrance animation with sequential delay
            rankItem.style.animationDelay = `${index * 0.1}s`;
            rankItem.classList.add('animate-entrance');
            
            // Add transition effect
            if (rankChangeClass) {
                setTimeout(() => {
                    rankItem.querySelector('.rank-change-indicator').classList.remove(rankChangeClass);
                }, 2000);
            }
        });
        
        // Store current ranks for next comparison
        topPlayers.forEach((player, index) => {
            previousRanks[player.id] = index;
        });
    }
});