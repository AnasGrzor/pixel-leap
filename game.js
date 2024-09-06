const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('highScore');
const startScreen = document.getElementById('startScreen');
const startButton = document.getElementById('startButton');

// Move these constants to the top
const GAME_WIDTH = 800;
const GAME_HEIGHT = 400;
const MOBILE_BREAKPOINT = 768; // px
const TOUCH_BUTTON_SIZE = 50; // px

// Initialize isMobile
let isMobile = window.innerWidth < MOBILE_BREAKPOINT;

// Now define these constants using isMobile
const PLATFORM_MIN_WIDTH = isMobile ? 80 : 60;
const PLATFORM_MAX_WIDTH = isMobile ? 180 : 150;
const PLATFORM_MIN_HEIGHT = 10;
const PLATFORM_MAX_HEIGHT = 30;
const PLATFORM_MIN_GAP = isMobile ? 40 : 30;
const PLATFORM_MAX_GAP = isMobile ? 140 : 120;

const SKY_WIDTH = GAME_WIDTH * 2;

let gameRunning = false;
let scale = 1;
let score = 0;
let highScore = 0;

const GRAVITY = 0.5;
const JUMP_FORCE = 12;
const JUMP_DURATION = 30; // frames
const MAX_JUMPS = 2;
const DOUBLE_JUMP_FORCE = 10; // Slightly weaker than the initial jump

// Update the player object
const player = {
    x: 50,
    y: 200,
    width: isMobile ? 40 : 30,
    height: isMobile ? 40 : 30,
    speed: 5,
    velocityX: 0,
    velocityY: 0,
    isJumping: false,
    jumpCount: 0,
    color: '#FF5733'
};

let platforms = [];
let coins = [];
let obstacles = []; // Step 1: Define an array for obstacles
let cameraX = 0;

const CAMERA_BUFFER = GAME_WIDTH / 3;

let worldOffset = 0;
const WORLD_SHIFT_THRESHOLD = 10000;

let playerScreenX = GAME_WIDTH / 3;

let touchLeftButton, touchRightButton, touchJumpButton;

// Step 1: Load sprite images
const playerSprite = new Image();
playerSprite.src = 'assets/images/rogue.png'; // Replace with the actual path to your player sprite

// Step 1: Load multiple obstacle sprite images
const obstacleSprites = [
    new Image(),
    new Image(),
    new Image(),
    new Image()
];

obstacleSprites[0].src = 'assets/images/spike.png'; // Path for spike
obstacleSprites[1].src = 'assets/images/spike2.png'; // Path for spike2
obstacleSprites[2].src = 'assets/images/spike3.png'; // Path for spike3
obstacleSprites[3].src = 'assets/images/spike4.png'; // Path for spike4

const backgroundMusic = new Audio('assets/audio/music.mp3'); // Replace with the actual path to your music file 
backgroundMusic.volume = 0.2; // Set volume to 20% (adjust as needed)

function generatePlatform(startX) {
    const width = PLATFORM_MIN_WIDTH + Math.random() * (PLATFORM_MAX_WIDTH - PLATFORM_MIN_WIDTH);
    const height = PLATFORM_MIN_HEIGHT + Math.random() * (PLATFORM_MAX_HEIGHT - PLATFORM_MIN_HEIGHT);
    const y = GAME_HEIGHT - height - Math.random() * (GAME_HEIGHT / 2);
    return { x: startX, y, width, height };
}

function generateCoin(platform) {
    const x = platform.x + Math.random() * (platform.width - 20);
    const y = platform.y - 30 - Math.random() * 50;
    return { x, y, width: 20, height: 20, collected: false };
}

// Step 2: Update the generateObstacle function to use a random sprite
function generateObstacle(startX) {
    const width = 40; // Fixed width for obstacles
    const height = 40; // Fixed height for obstacles
    const y = GAME_HEIGHT - height; // Position at the bottom
    const spriteIndex = Math.floor(Math.random() * obstacleSprites.length); // Randomly select an index
    return { x: startX, y, width, height, sprite: obstacleSprites[spriteIndex] }; // Include the selected sprite
}

// Step 3: Update the initializeLevel function to include obstacles
function initializeLevel() {
    platforms = [];
    coins = [];
    obstacles = []; // Reset obstacles
    let platformX = 0;

    platforms.push({ x: 0, y: GAME_HEIGHT - 50, width: 200, height: 20 });

    while (platformX < GAME_WIDTH * 2) {
        const platform = generatePlatform(platformX);
        platforms.push(platform);

        if (Math.random() < 0.5) {
            coins.push(generateCoin(platform));
        }

        // Generate obstacles randomly
        if (Math.random() < 0.2) { // 20% chance to create an obstacle
            obstacles.push(generateObstacle(platformX + platform.width));
        }

        platformX += platform.width + PLATFORM_MIN_GAP + Math.random() * (PLATFORM_MAX_GAP - PLATFORM_MIN_GAP);
    }

    player.x = 50;
    player.y = platforms[0].y - player.height;
}

function updateLevel() {
    platforms = platforms.filter(p => p.x + p.width > cameraX - 100);
    coins = coins.filter(c => c.x > cameraX - 100);
    obstacles = obstacles.filter(o => o.x > cameraX - 100); // Filter out obstacles that are off-screen

    while (platforms[platforms.length - 1].x + platforms[platforms.length - 1].width < cameraX + GAME_WIDTH * 1.5) {
        const lastPlatform = platforms[platforms.length - 1];
        const newPlatform = generatePlatform(lastPlatform.x + lastPlatform.width + PLATFORM_MIN_GAP + Math.random() * (PLATFORM_MAX_GAP - PLATFORM_MIN_GAP));
        platforms.push(newPlatform);

        if (Math.random() < 0.5) {
            coins.push(generateCoin(newPlatform));
        }

        // Generate obstacles randomly
        if (Math.random() < 0.2) { // 20% chance to create an obstacle
            obstacles.push(generateObstacle(newPlatform.x + newPlatform.width));
        }
    }
}

// Step 4: Update the updatePlayer function to check for collisions with obstacles
function updatePlayer() {
    if (player.isJumping) {
        jumpTimer++;
        if (jumpTimer <= JUMP_DURATION) {
            const t = jumpTimer / JUMP_DURATION;
            const easeT = easeOutQuad(t);
            player.velocityY = -(player.jumpCount === 1 ? JUMP_FORCE : DOUBLE_JUMP_FORCE) * (1 - easeT);
        } else {
            player.isJumping = false;
            jumpTimer = 0;
        }
    }

    player.velocityY += GRAVITY;
    player.velocityX += (targetVelocityX - player.velocityX) * 0.1;

    const maxHorizontalSpeed = 5;
    player.velocityX = Math.max(Math.min(player.velocityX, maxHorizontalSpeed), -maxHorizontalSpeed);

    player.x += player.velocityX;
    player.y += player.velocityY;

    // Prevent player from going above the screen
    if (player.y < 0) {
        player.y = 0;
        player.velocityY = 0;
    }

    cameraX = player.x - playerScreenX;

    player.velocityX *= 0.9;

    let onPlatform = false;
    platforms.forEach(platform => {
        if (
            player.x < platform.x + platform.width &&
            player.x + player.width > platform.x &&
            player.y + player.height > platform.y &&
            player.y + player.height < platform.y + player.velocityY + 5
        ) {
            player.y = platform.y - player.height;
            player.velocityY = 0;
            player.isJumping = false;
            player.jumpCount = 0;
            jumpTimer = 0;
            onPlatform = true;
        }
    });

    // Check if player is on the ground
    if (player.y + player.height >= GAME_HEIGHT) {
        player.y = GAME_HEIGHT - player.height;
        player.velocityY = 0;
        player.isJumping = false;
        player.jumpCount = 0;
        jumpTimer = 0;
        onPlatform = true;
    }

    if (!onPlatform && !player.isJumping && player.velocityY >= 0) {
        player.isJumping = true;
        jumpTimer = JUMP_DURATION; // Start falling immediately
    }

    coins = coins.filter(coin => {
        if (
            !coin.collected &&
            player.x < coin.x + coin.width &&
            player.x + player.width > coin.x &&
            player.y < coin.y + coin.height &&
            player.y + player.height > coin.y
        ) {
            updateScore();
            return false;
        }
        return true;
    });

    // Check for collisions with obstacles
    obstacles.forEach(obstacle => {
        if (
            player.x < obstacle.x + obstacle.width &&
            player.x + player.width > obstacle.x &&
            player.y < obstacle.y + obstacle.height &&
            player.y + player.height > obstacle.y
        ) {
            gameOver(); // Call game over function on collision
        }
    });

    if (player.y + player.height > GAME_HEIGHT) {
        player.y = GAME_HEIGHT - player.height;
        player.velocityY = 0;
        player.isJumping = false;
    }

    if (cameraX < 0) {
        cameraX = 0;
        player.x = playerScreenX;
    }
}

function updateScore() {
    score += 10;
    scoreElement.textContent = score.toString();
    if (score > highScore) {
        highScore = score;
        highScoreElement.textContent = highScore.toString();
        localStorage.setItem('highScore', highScore.toString());
    }
}

function drawBackground() {
    const skyOffset = cameraX * 0.5; // Slower parallax effect
    
    ctx.fillStyle = '#87CEEB'; // Sky blue color
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // Add some clouds for effect
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    for (let i = 0; i < 10; i++) {
        const cloudX = ((i * 200 - skyOffset) % SKY_WIDTH + SKY_WIDTH) % SKY_WIDTH;
        ctx.beginPath();
        ctx.arc(cloudX, 50, 30, 0, Math.PI * 2);
        ctx.arc(cloudX + 25, 50, 25, 0, Math.PI * 2);
        ctx.arc(cloudX + 50, 50, 30, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Define frame dimensions
const PLAYER_FRAME_WIDTH = 30; // Width of each frame
const PLAYER_FRAME_HEIGHT = 30; // Height of each frame
const PLAYER_FRAMES = 1; // Total number of frames in the spritesheet
let currentPlayerFrame = 0; // Current frame to display

// Update the drawPlayer function to use the spritesheet
function drawPlayer() {
    ctx.drawImage(
        playerSprite,
        currentPlayerFrame * PLAYER_FRAME_WIDTH, // Source x
        0, // Source y (assuming all frames are in the first row)
        PLAYER_FRAME_WIDTH, // Source width
        PLAYER_FRAME_HEIGHT, // Source height
        player.x - cameraX, // Destination x
        player.y, // Destination y
        player.width, // Destination width
        player.height // Destination height
    );

    // Update the frame for animation (if needed)
    currentPlayerFrame = (currentPlayerFrame + 1) % PLAYER_FRAMES; // Loop through frames
}

function drawPlatforms() {
    ctx.fillStyle = '#4CAF50';
    platforms.forEach(platform => {
        const screenX = platform.x - cameraX;
        ctx.fillRect(screenX, platform.y, platform.width, platform.height);
        
        ctx.fillStyle = '#45a049';
        ctx.fillRect(screenX, platform.y, platform.width, 5);
    });
}

function drawCoins() {
    ctx.fillStyle = '#FFD700';
    coins.forEach(coin => {
        if (!coin.collected) {
            const screenX = coin.x - cameraX;
            ctx.beginPath();
            ctx.arc(screenX + coin.width / 2, coin.y + coin.height / 2, coin.width / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#FFA500';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });
}

// Step 3: Update the drawObstacles function to use the selected sprite
function drawObstacles() {
    obstacles.forEach(obstacle => {
        const screenX = obstacle.x - cameraX;
        ctx.drawImage(obstacle.sprite, screenX, obstacle.y, obstacle.width, obstacle.height); // Use the selected sprite
    });
}

function gameLoop() {
    if (!gameRunning) return;

    ctx.save();
    ctx.scale(1 / scale, 1 / scale);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    updatePlayer();
    updateLevel();
    
    drawBackground();
    drawPlatforms();
    drawCoins();
    drawObstacles(); // Draw obstacles
    drawPlayer();

    requestAnimationFrame(gameLoop);
}

// Step 4: Update the startGame function to play background music
function startGame() {
    gameRunning = true;
    score = 0;
    scoreElement.textContent = '0';
    loadHighScore(); // Load the high score when starting the game
    startScreen.style.display = 'none';
    resizeCanvas();
    initializeLevel();
    if (isMobile) {
        createTouchControls();
    }
    backgroundMusic.loop = true; // Loop the music
    backgroundMusic.play(); // Play the background music
    gameLoop();
}

let targetVelocityX = 0;

document.addEventListener('keydown', (e) => {
    if (!gameRunning) return;
    if (e.key === 'ArrowLeft') targetVelocityX = -player.speed / scale;
    if (e.key === 'ArrowRight') targetVelocityX = player.speed / scale;
    if (e.key === 'ArrowUp' && player.jumpCount < MAX_JUMPS) {
        player.isJumping = true;
        player.jumpCount++;
        jumpTimer = 0;
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        targetVelocityX = 0;
    }
});

window.addEventListener('resize', resizeCanvas);

startButton.addEventListener('click', startGame);

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    isMobile = window.innerWidth < MOBILE_BREAKPOINT;
    scale = Math.min(
        window.innerWidth / GAME_WIDTH,
        window.innerHeight / GAME_HEIGHT
    );
    ctx.scale(scale, scale);
    
    // Update player size based on new isMobile value
    player.width = isMobile ? 40 : 30;
    player.height = isMobile ? 40 : 30;
    
    if (isMobile) {
        createTouchControls();
    } else {
        removeTouchControls();
    }
}

function createTouchControls() {
    touchLeftButton = document.createElement('div');
    touchRightButton = document.createElement('div');
    touchJumpButton = document.createElement('div');

    const buttonStyle = `
        position: absolute;
        width: ${TOUCH_BUTTON_SIZE}px;
        height: ${TOUCH_BUTTON_SIZE}px;
        background-color: rgba(255, 255, 255, 0.5);
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 24px;
        user-select: none;
    `;

    touchLeftButton.style.cssText = buttonStyle + 'left: 20px; bottom: 20px;';
    touchRightButton.style.cssText = buttonStyle + 'left: 80px; bottom: 20px;';
    touchJumpButton.style.cssText = buttonStyle + 'right: 20px; bottom: 20px;';

    touchLeftButton.innerHTML = '←';
    touchRightButton.innerHTML = '→';
    touchJumpButton.innerHTML = '↑';

    document.body.appendChild(touchLeftButton);
    document.body.appendChild(touchRightButton);
    document.body.appendChild(touchJumpButton);

    addTouchListeners();
}

function removeTouchControls() {
    if (touchLeftButton) touchLeftButton.remove();
    if (touchRightButton) touchRightButton.remove();
    if (touchJumpButton) touchJumpButton.remove();
}

function addTouchListeners() {
    touchLeftButton.addEventListener('touchstart', () => { targetVelocityX = -player.speed / scale; });
    touchLeftButton.addEventListener('touchend', () => { targetVelocityX = 0; });

    touchRightButton.addEventListener('touchstart', () => { targetVelocityX = player.speed / scale; });
    touchRightButton.addEventListener('touchend', () => { targetVelocityX = 0; });

    touchJumpButton.addEventListener('touchstart', () => {
        if (player.jumpCount < MAX_JUMPS) {
            player.isJumping = true;
            player.jumpCount++;
            jumpTimer = 0;
        }
    });
}

window.addEventListener('load', () => {
    resizeCanvas();
    loadHighScore();
    drawBackground();
    initializeLevel();
    drawPlatforms();
    drawCoins();
    drawObstacles(); // Draw obstacles
    drawPlayer();
});

function easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
}

function loadHighScore() {
    const savedHighScore = localStorage.getItem('highScore');
    if (savedHighScore !== null) {
        highScore = parseInt(savedHighScore, 10);
        highScoreElement.textContent = highScore.toString();
    }
}

// Step 5: Stop the music on game over
function gameOver() {
    gameRunning = false; // Stop the game
    backgroundMusic.pause(); // Stop the background music
    gameOverScreen.style.display = 'block'; // Show game over screen
}

// Step 1: Create game over elements
const gameOverScreen = document.createElement('div');
gameOverScreen.style.position = 'absolute';
gameOverScreen.style.top = '50%';
gameOverScreen.style.left = '50%';
gameOverScreen.style.transform = 'translate(-50%, -50%)';
gameOverScreen.style.display = 'none'; // Initially hidden
gameOverScreen.style.textAlign = 'center';
gameOverScreen.style.color = 'white';
gameOverScreen.style.fontSize = '48px';
gameOverScreen.innerHTML = `
    <div>Game Over!</div>
    <button id="restartButton" style="margin-top: 20px; font-size: 24px;">Restart</button>
`;
document.body.appendChild(gameOverScreen);

// Step 2: Update the gameOver function
function gameOver() {
    gameRunning = false; // Stop the game
    backgroundMusic.pause(); // Stop the background music
    gameOverScreen.style.display = 'block'; // Show game over screen
}

// Step 3: Add event listener to restart button
document.getElementById('restartButton').addEventListener('click', () => {
    gameOverScreen.style.display = 'none'; // Hide game over screen
    startGame(); // Restart the game
});

// Preload function
function preloadAssets(callback) {
    let assetsLoaded = 0;
    const totalAssets = 2; // Number of assets to load

    playerSprite.onload = () => {
        console.log(`Player sprite loaded successfully: ${playerSprite.src}`);
        assetsLoaded++;
        if (assetsLoaded === totalAssets) callback();
    };
    obstacleSprites.forEach(sprite => {
        sprite.onload = () => {
            console.log(`Obstacle sprite loaded successfully: ${sprite.src}`);
            assetsLoaded++;
            if (assetsLoaded === totalAssets) callback();
        };
    });

    obstacleSprites.forEach(sprite => {
        sprite.src = sprite.src; // Ensure these paths are correct
    });
}

// Call preloadAssets before starting the game
preloadAssets(() => {
    startGame(); // Start the game after assets are loaded
});