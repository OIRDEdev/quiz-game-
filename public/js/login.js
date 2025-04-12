document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const usernameInput = document.getElementById('username');
    const playButton = document.getElementById('play-button');
    
    // Check if this is an admin trying to log in
    const urlParams = new URLSearchParams(window.location.search);
    const isAdmin = urlParams.get('admin') === 'true';
    
    if (isAdmin) {
        window.location.href = '/admin';
        return;
    }
    
    // Handle play button click
    playButton.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        
        if (!username) {
            alert('Please enter your name to continue!');
            return;
        }
        
        // Send username to server
        socket.emit('player_login', username);
        
        // Disable the button while waiting for response
        playButton.disabled = true;
        playButton.textContent = 'Joining...';
    });
    
    // Handle successful login
    socket.on('login_success', (data) => {
        // Store username in session storage
        sessionStorage.setItem('username', data.username);
        sessionStorage.setItem('socketId', socket.id);
        
        // Redirect to waiting room
        window.location.href = '/wait';
    });
});