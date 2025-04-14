// server.js - Main server file

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const fs = require('fs');
const os = require('os');
// Initialize express app, server and socket.io
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/wait', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'waitroom.html'));
});

app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Load quiz questions from JSON file
const quizData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'quiz.json'), 'utf8'));

// Game state
let gameState = {
  isActive: false,
  currentQuestion: 0,
  questionTimer: null,
  timePerQuestion: 20, // seconds
  remainingTime: 20,
  players: {},
  playerAnswers: {},
  statistics: {
    questionStats: []
  }
};

// Socket.IO Connection
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Player login
  socket.on('player_login', (username) => {
    // Store player info
    gameState.players[socket.id] = {
      id: socket.id,
      username: username,
      score: 0,
      answers: []
    };
    
    // Send player to waiting room
    socket.emit('login_success', { username });
    
    // Notify admin about the new player
    io.to('admin').emit('player_joined', {
      playerId: socket.id,
      username: username
    });
    
    // Update all waiting players with the current list
    io.emit('update_waiting_players', Object.values(gameState.players));
  });

  
  socket.on('admin_login', (password) => {
    // In a real application, you would verify the password
    // For this example, we'll use a simple check
    if (password === 'admin123') {
      socket.join('admin');
      socket.emit('admin_login_success');
      socket.emit('update_game_state', {
        isActive: gameState.isActive,
        currentQuestion: gameState.currentQuestion,
        totalQuestions: quizData.questions.length,
        players: Object.values(gameState.players)
      });
    } else {
      socket.emit('admin_login_failed');
    }
  });
  
  // Admin starts the game
  socket.on('start_game', () => {
    if (Object.keys(gameState.players).length === 0) {
      socket.emit('error_message', { message: 'No players have joined yet!' });
      return;
    }

    gameState.isActive = true;
    gameState.currentQuestion = 0;
    gameState.playerAnswers = {};
    gameState.statistics.questionStats = [];

    // Notify all players that game is starting
    io.emit('game_starting');
    
    // After a short delay, send the first question
    setTimeout(() => {
      sendNextQuestion();
    }, 3000);
  });

  // Admin pauses the game
  socket.on('pause_game', () => {
    if (gameState.isActive) {
      gameState.isActive = false;
      clearInterval(gameState.questionTimer);
      io.emit('game_paused');
    }
  });

  // Admin resumes the game
  socket.on('resume_game', () => {
    if (!gameState.isActive) {
      gameState.isActive = true;
      io.emit('game_resumed');
      
      // Resume the timer
      startQuestionTimer(gameState.remainingTime);
    }
  });

  // Admin ends the game
  socket.on('end_game', () => {
    if (gameState.isActive) {
      clearInterval(gameState.questionTimer);
      gameState.isActive = false;
      
      // Calculate final scores and rankings
      const players = Object.values(gameState.players)
        .sort((a, b) => b.score - a.score);
      
      io.emit('game_ended', { 
        leaderboard: players,
        statistics: gameState.statistics
      });
    }
  });
  const currentQuestion = quizData.questions[gameState.currentQuestion];
  // Player submits an answer
  socket.on('submit_answer', (data) => {
    if (!gameState.isActive || gameState.playerAnswers[socket.id]) {
      return; // Game not active or player already answered
    }

    const currentQ = quizData.questions[gameState.currentQuestion];
    const isCorrect = data.answer === currentQ.correctAnswer;
    const currentQuestion = quizData.questions[gameState.currentQuestion];
    // Record the player's answer
    gameState.playerAnswers[socket.id] = {
      playerId: socket.id,
      username: gameState.players[socket.id].username,
      answer: data.answer,
      isCorrect: isCorrect
    };
    
    // Update player's score
    if (isCorrect) {
      // Give more points for quick answers
      const timeBonus = Math.ceil(gameState.remainingTime / 5);
      const pointsEarned = 10 + timeBonus;
      gameState.players[socket.id].score += pointsEarned;
    }
    
    // Store the answer in player's history
    gameState.players[socket.id].answers.push({
      questionIndex: gameState.currentQuestion,
      answer: data.answer,
      isCorrect: isCorrect
    });
    
    // Acknowledge the answer
    socket.emit('answer_received', {
      isCorrect: isCorrect,
      correctAnswer: currentQuestion.correctAnswer,
      explanation: currentQuestion.explanation
    });
    
    // Update admin with real-time answer stats
    updateAnswerStatistics();
  });

  // New socket event handler for leaderboard requests
  socket.on('request_leaderboard', () => {
    // Calculate and sort players by score
    const sortedPlayers = Object.values(gameState.players)
        .sort((a, b) => b.score - a.score);
    
    // Send leaderboard to the requesting client
    socket.emit('leaderboard_update', {
        leaderboard: sortedPlayers
    });
  });

  // Disconnect event
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Remove player from game state
    if (gameState.players[socket.id]) {
      const username = gameState.players[socket.id].username;
      delete gameState.players[socket.id];
      
      // Update waiting room
      io.emit('update_waiting_players', Object.values(gameState.players));
      
      // Notify admin
      io.to('admin').emit('player_left', {
        playerId: socket.id,
        username: username
      });
    }
  });
});

// Helper Functions
function sendNextQuestion() {
  if (gameState.currentQuestion >= quizData.questions.length) {
    // End of quiz
    clearInterval(gameState.questionTimer);
    gameState.isActive = false;
    
    // Calculate final scores and rankings
    const players = Object.values(gameState.players)
      .sort((a, b) => b.score - a.score);
    
    io.emit('game_ended', { 
      leaderboard: players,
      statistics: gameState.statistics
    });
    return;
  }

  // Reset answers for this question
  gameState.playerAnswers = {};
  
  // Get current question data
  const currentQuestion = quizData.questions[gameState.currentQuestion];
  
  // Don't send the correct answer and explanation to players
  const questionForPlayers = {
    question: currentQuestion.question,
    options: currentQuestion.options,
    index: gameState.currentQuestion,
    total: quizData.questions.length
  };
  
  // Send question to all players
  io.emit('new_question', questionForPlayers);
  
  // Send complete question data to admin
  io.to('admin').emit('admin_question_data', {
    ...currentQuestion,
    index: gameState.currentQuestion,
    total: quizData.questions.length
  });
  
  // Initialize statistics for this question
  gameState.statistics.questionStats[gameState.currentQuestion] = {
    questionIndex: gameState.currentQuestion,
    questionText: currentQuestion.question,
    totalAnswers: 0,
    correctAnswers: 0,
    answerDistribution: {}
  };
  
  // Initialize answer counts for each option
  currentQuestion.options.forEach(option => {
    gameState.statistics.questionStats[gameState.currentQuestion].answerDistribution[option] = 0;
  });
  
  // Start the timer
  gameState.remainingTime = gameState.timePerQuestion;
  startQuestionTimer(gameState.timePerQuestion);
}

function startQuestionTimer(seconds) {
  // Clear any existing timer
  if (gameState.questionTimer) {
    clearInterval(gameState.questionTimer);
  }
  
  gameState.remainingTime = seconds;
  
  // Broadcast initial time
  io.emit('question_timer', { time: gameState.remainingTime });
  
  // Set up the interval
  gameState.questionTimer = setInterval(() => {
    gameState.remainingTime -= 1;
    
    // Broadcast time update
    io.emit('question_timer', { time: gameState.remainingTime });
    
    if (gameState.remainingTime <= 0) {
      clearInterval(gameState.questionTimer);
      
      // Time's up, show correct answer
      const currentQuestion = quizData.questions[gameState.currentQuestion];
      io.emit('show_answer', {
        correctAnswer: currentQuestion.correctAnswer,
        explanation: currentQuestion.explanation
      });
      
      // Update final statistics for this question
      updateAnswerStatistics(true);
      
      // Wait a bit before moving to next question
      setTimeout(() => {
        gameState.currentQuestion++;
        if (gameState.isActive) {
          sendNextQuestion();
        }
      }, 5000);
    }
  }, 1000);
}

function updateAnswerStatistics(isFinal = false) {
  const stats = gameState.statistics.questionStats[gameState.currentQuestion];
  const answers = Object.values(gameState.playerAnswers);
  
  // Reset counts
  stats.totalAnswers = answers.length;
  stats.correctAnswers = answers.filter(a => a.isCorrect).length;
  
  // Count each option
  Object.keys(stats.answerDistribution).forEach(option => {
    stats.answerDistribution[option] = answers.filter(a => a.answer === option).length;
  });
  
  // Send statistics update to admin
  io.to('admin').emit('stats_update', {
    questionStats: stats,
    answerCount: stats.totalAnswers,
    totalPlayers: Object.keys(gameState.players).length,
    isFinal: isFinal
  });
  
  // If this is the final update for this question, broadcast the current leaderboard
  if (isFinal) {
    const sortedPlayers = Object.values(gameState.players)
        .sort((a, b) => b.score - a.score);
    
    io.emit('leaderboard_update', {
        leaderboard: sortedPlayers
    });
  }
}

const PORT = process.env.PORT || 3000;
// Start the server
server.listen(PORT, () => {
  const interfaces = os.networkInterfaces();
  let localIp = 'localhost';

  for (let iface of Object.values(interfaces)) {
    for (let alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) {
        localIp = alias.address;
        break;
      }
    }
  }

  console.log(`\n🔗 Links para acessar o servidor:`);
  console.log(`➡️ Localhost: http://localhost:${PORT}`);
  console.log(`➡️ Network:  http://${localIp}:${PORT}\n`);
});