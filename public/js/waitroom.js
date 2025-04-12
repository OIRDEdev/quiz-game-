document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const playersList = document.getElementById('players-list');
    
    // Check if user is logged in
    const username = sessionStorage.getItem('username');
    const socketId = sessionStorage.getItem('socketId');
    
    if (!username || !socketId) {
        // Redirect to login if not logged in
        window.location.href = '/';
        return;
    }
    
    // Function to update players list
    function updatePlayersList(players) {
        playersList.innerHTML = '';
        
        if (players.length === 0) {
            const emptyItem = document.createElement('li');
            emptyItem.textContent = 'No players yet';
            playersList.appendChild(emptyItem);
            return;
        }
        
        players.forEach(player => {
            const playerItem = document.createElement('li');
            playerItem.textContent = player.username;
            playersList.appendChild(playerItem);
        });
    }
    
    // Update waiting players list when received from server
    socket.on('update_waiting_players', (players) => {
        updatePlayersList(players);
    });
    
    // Handle game starting event
    socket.on('game_starting', () => {
        window.location.href = '/game';
    });
    
    // Reconnect logic
    socket.on('connect', () => {
        if (socket.id !== socketId) {
            // Re-login if socket ID changed (reconnection)
            socket.emit('player_login', username);
            sessionStorage.setItem('socketId', socket.id);
        }
    });
});