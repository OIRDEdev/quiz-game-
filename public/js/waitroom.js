document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const playersList = document.getElementById('players-list');
    const playerCount = document.getElementById('player-count');
    
    // Check if user is logged in
    const username = sessionStorage.getItem('username');
    const socketId = sessionStorage.getItem('socketId');
    
    if (!username || !socketId) {
        // Redirect to login if not logged in
        window.location.href = '/';
        return;
    }
    
    // Function to generate a consistent color from a string
    function stringToColor(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const colors = [
            '#58CC02', // Green
            '#1CB0F6', // Blue
            '#FF4B4B', // Red
            '#FFC800', // Yellow
            '#CE82FF', // Purple
            '#FF9600', // Orange
        ];
        
        return colors[Math.abs(hash) % colors.length];
    }
    
    // Function to get initials from a username
    function getInitials(name) {
        if (!name) return '?';
        
        const parts = name.trim().split(' ');
        if (parts.length === 1) {
            return name.charAt(0).toUpperCase();
        }
        
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    
    // Function to update players list with animated cards
    function updatePlayersList(players) {
        playersList.innerHTML = '';
        
        if (players.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = 'Nenhum jogador na sala ainda';
            playersList.appendChild(emptyMessage);
            playerCount.textContent = '0';
            return;
        }
        
        players.forEach((player, index) => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            
            // Create avatar with initials
            const avatar = document.createElement('div');
            avatar.className = 'player-avatar';
            avatar.textContent = getInitials(player.username);
            avatar.style.backgroundColor = stringToColor(player.username);
            
            // Create name element
            const name = document.createElement('div');
            name.className = 'player-name';
            name.textContent = player.username;
            
            // Add a special indicator if this is the current user
            if (player.id === socketId) {
                name.textContent += ' (Você)';
                playerCard.style.borderLeftColor = '#FFC800';
            }
            
            // Build the card
            playerCard.appendChild(avatar);
            playerCard.appendChild(name);
            
            // Add staggered animation delays
            playerCard.style.animationDelay = `${index * 0.1}s`;
            
            playersList.appendChild(playerCard);
        });
        
        // Update player count
        playerCount.textContent = players.length;
    }
    
    // Update waiting players list when received from server
    socket.on('update_waiting_players', (players) => {
        updatePlayersList(players);
    });
    
    // Handle game starting event
    socket.on('game_starting', () => {
        // Add transition animation before redirecting
        document.querySelector('.waitroom-card').classList.add('fade-out');
        
        // Create and show start notification
        const notification = document.createElement('div');
        notification.className = 'start-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-gamepad"></i>
                <h2>O jogo vai começar!</h2>
                <p>Preparando...</p>
            </div>
        `;
        document.body.appendChild(notification);
        
        // Wait for animation and then redirect
        setTimeout(() => {
            window.location.href = '/game';
        }, 2000);
    });
    
    // Add interactive owl eyes that follow mouse movement
    document.addEventListener('mousemove', (e) => {
        const pupils = document.querySelectorAll('.pupil');
        const owlContainer = document.querySelector('.owl-container');
        
        if (!pupils.length || !owlContainer) return;
        
        const containerRect = owlContainer.getBoundingClientRect();
        const mouseX = e.clientX - containerRect.left;
        const mouseY = e.clientY - containerRect.top;
        
        pupils.forEach(pupil => {
            const pupilRect = pupil.getBoundingClientRect();
            const eyeRect = pupil.parentElement.getBoundingClientRect();
            
            // Calculate center of eye
            const eyeCenterX = eyeRect.left + eyeRect.width / 2 - containerRect.left;
            const eyeCenterY = eyeRect.top + eyeRect.height / 2 - containerRect.top;
            
            // Calculate distance from mouse to eye center
            const distX = mouseX - eyeCenterX;
            const distY = mouseY - eyeCenterY;
            
            // Max distance pupil can move (30% of eye radius)
            const maxDist = eyeRect.width * 0.3;
            
            // Calculate normalized distance (0-1)
            const distance = Math.sqrt(distX * distX + distY * distY);
            const normalized = Math.min(distance / 100, 1);
            
            // Calculate pupil movement
            const moveX = (distX / distance) * maxDist * normalized;
            const moveY = (distY / distance) * maxDist * normalized;
            
            // Apply movement
            pupil.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`;
        });
    });
    
    // Reconnect logic
    socket.on('connect', () => {
        if (socket.id !== socketId) {
            // Re-login if socket ID changed (reconnection)
            socket.emit('player_login', username);
            sessionStorage.setItem('socketId', socket.id);
        }
    });
    
    // Add start notification CSS dynamically
    const style = document.createElement('style');
    style.textContent = `
        .start-notification {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            animation: fadeIn 0.3s ease forwards;
        }
        
        .notification-content {
            background: white;
            padding: 2rem;
            border-radius: 1rem;
            text-align: center;
            animation: scaleIn 0.5s ease;
        }
        
        .notification-content i {
            font-size: 3rem;
            color: #58CC02;
            margin-bottom: 1rem;
        }
        
        .notification-content h2 {
            color: #333;
            margin-bottom: 0.5rem;
        }
        
        .notification-content p {
            color: #666;
        }
        
        .fade-out {
            animation: fadeOut 1s ease forwards;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes fadeOut {
            to { opacity: 0; transform: scale(0.9); }
        }
        
        @keyframes scaleIn {
            from { transform: scale(0.8); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
});