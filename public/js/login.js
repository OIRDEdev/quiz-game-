document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const initialScreen = document.getElementById('initial-screen');
    const loginScreen = document.getElementById('login-screen');
    const startButton = document.getElementById('start-button');
    const backButton = document.getElementById('back-button');
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const errorMessage = document.getElementById('error-message');
    const languageSelect = document.getElementById('language-select');
    
    // Default translations
    const translations = {
        'en': {
            'login.title': 'CompraCerta - Quiz Game',
            'login.subtitle': 'STATISTICAL MISSION',
            'login.username': 'Enter your name',
            'login.start': 'START NOW',
            'login.enter': 'ENTER →',
            'login.error': 'Please enter a valid name (at least 3 characters)'
        },
        'pt-BR': {
            'login.title': 'CompraCerta - Quiz Game',
            'login.subtitle': 'MISSÃO ESTATÍSTICA',
            'login.username': 'Digite seu nome',
            'login.start': 'COMECE AGORA',
            'login.enter': 'ENTRAR →',
            'login.error': 'Por favor, insira um nome válido (pelo menos 3 caracteres)'
        }
    };
    
    // Load saved language or use default
    let currentLanguage = localStorage.getItem('language') || 'pt-BR';
    languageSelect.value = currentLanguage;
    
    // Function to update texts based on language
    function updateTexts() {
        const lang = translations[currentLanguage];
        
        // Update page texts
        document.title = lang['login.title'];
        document.querySelector('.main-title').textContent = lang['login.subtitle'];
        usernameInput.placeholder = lang['login.username'];
        startButton.textContent = lang['login.start'];
        document.querySelector('.button-text').textContent = lang['login.enter'];
        
        // Update HTML lang attribute
        document.documentElement.lang = currentLanguage;
        
        // Save language preference
        localStorage.setItem('language', currentLanguage);
    }
    
    // Event listener for language change
    languageSelect.addEventListener('change', (e) => {
        currentLanguage = e.target.value;
        updateTexts();
    });
    
    // Initialize texts
    updateTexts();
    
    // Check if this is an admin trying to log in
    const urlParams = new URLSearchParams(window.location.search);
    const isAdmin = urlParams.get('admin') === 'true';
    
    if (isAdmin) {
        window.location.href = '/admin';
        return;
    }
    
    // Show login screen function
    function showLoginScreen() {
        loginScreen.classList.remove('hidden');
        setTimeout(() => {
            loginScreen.classList.add('visible');
        }, 50);
        usernameInput.focus();
    }
    
    // Hide login screen function
    function hideLoginScreen() {
        loginScreen.classList.remove('visible');
        setTimeout(() => {
            loginScreen.classList.add('hidden');
            loginForm.reset();
            errorMessage.textContent = '';
        }, 300);
    }
    
    // Event listeners for buttons
    startButton.addEventListener('click', showLoginScreen);
    backButton.addEventListener('click', hideLoginScreen);
    
    // Close login modal when clicking outside
    loginScreen.addEventListener('click', (e) => {
        if (e.target === loginScreen) {
            hideLoginScreen();
        }
    });
    
    // Animate characters
    const characters = document.querySelectorAll('.character');
    characters.forEach((character, index) => {
        character.style.animationDelay = `${index * 0.2}s`;
    });
    
    // Animate coins
    const coins = document.querySelectorAll('.coin');
    coins.forEach((coin, index) => {
        coin.style.animationDelay = `${index * 0.3}s`;
    });
    
    // Handle login form submission
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const username = usernameInput.value.trim();
        const lang = translations[currentLanguage];
        
        if (username.length < 3) {
            showError(lang['login.error']);
            return;
        }
        
        // Disable the button while waiting for response
        const submitButton = loginForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.innerHTML = `<span class="button-text">...</span>`;
        
        // Send username to server using the existing socket.io logic
        socket.emit('player_login', username);
    });
    
    // Handle successful login
    socket.on('login_success', (data) => {
        // Store username in session storage
        sessionStorage.setItem('username', data.username);
        sessionStorage.setItem('socketId', socket.id);
        
        // Store selected language
        sessionStorage.setItem('language', currentLanguage);
        
        // Redirect to waiting room
        window.location.href = '/wait';
    });
    
    // Error display function
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('shake');
        
        setTimeout(() => {
            errorMessage.classList.remove('shake');
        }, 500);
    }
});