const canvas = document.getElementById('gameCanvas');
if (!canvas) {
    alert("CRITICAL ERROR: Canvas element not found! Script might be running before DOM is ready.");
    throw new Error("Canvas not found");
}
const ctx = canvas.getContext('2d');

// Game constants
const GRAVITY = 0.5;
const JUMP_FORCE = -12;
const SPEED = 5;
const CHUNK_SIZE = 800;
const LEVEL_CHUNKS = 12; 
const LEVEL_WIDTH = CHUNK_SIZE * LEVEL_CHUNKS; 

// Game State
let gameState = 'START'; // START, PLAYING, GAME_OVER
let frame = 0; 
let score = 0; 
let level = 1;

// Timing
let lastTime = 0;
let accumulator = 0;
const TIME_STEP = 1000 / 60; // 60 FPS fixed update

// URL Level Override
const urlParams = new URLSearchParams(window.location.search);
const startLevel = parseInt(urlParams.get('level'));
if (!isNaN(startLevel)) level = startLevel;

const debugMode = urlParams.get('debug') === '1' || urlParams.get('Debug') === '1';

let lives = 3;
let time = 400;

// Camera
let camera = { x: 0, y: 0 };

// Player object
const player = {
    x: 50,
    y: 300,
    width: 30,
    height: 30,
    dy: 0,
    dx: 0,
    facing: 1, 
    grounded: false,
    isBig: false,
    invulnerable: 0, // Post-hit frame buffer
    invincibleTimer: 0 // Soap power-up duration
};

// World Data Containers
let surfaceWorld = { platforms: [], ants: [], items: [] };
let showerWorld = { platforms: [], ants: [], items: [] };
let inShower = false;
let waterParticles = [];
let clouds = []; // Background clouds
let dustParticles = []; // Landing dust
let savedSurfaceX = 0; 

let effects = []; 
let projectiles = [];

// --- Level Generation ---
function generateLevel() {
    console.log("Generating Level " + level);
    surfaceWorld = { platforms: [], ants: [], items: [] };
    clouds = [];
    
    // Generate Clouds
    for(let i=0; i<20; i++) {
        clouds.push({
            x: Math.random() * LEVEL_WIDTH,
            y: Math.random() * 200,
            size: 30 + Math.random() * 50,
            speed: 0.2 + Math.random() * 0.3
        });
    }
    
    createChunk(0, 'flat');

    for (let i = 1; i < LEVEL_CHUNKS - 1; i++) {
        const r = Math.random();
        let type = 'flat';
        if (r > 0.8) type = 'gap';
        else if (r > 0.6) type = 'climb';
        else if (r > 0.4) type = 'islands';
        else if (r > 0.2) type = 'boxes';
        
        if (i === 0 && (type === 'gap' || type === 'climb')) type = 'flat';
        if (i === LEVEL_CHUNKS - 2) type = 'flat'; // Ensure safe approach to boss
        
        createChunk(i * CHUNK_SIZE, type);
    }

    createChunk((LEVEL_CHUNKS - 1) * CHUNK_SIZE, 'flat');
    
    // Goal or Boss
    if (level === 3) {
        // Boss Arena (Wider)
        const arenaX = LEVEL_WIDTH - 1200;
        console.log("Adding Boss Arena. Mega Floor X: " + arenaX);
        
        // Mega Floor (Arena + House) - Extended
        surfaceWorld.platforms.push({ x: arenaX - 100, y: 550, width: 3500, height: 50, color: 'purple' });
        // Debug Patch for 9415 hole
        surfaceWorld.platforms.push({ x: 9350, y: 550, width: 200, height: 50, color: 'blue' });

        // Platforms for jumping on boss (Lowered for accessibility)
        surfaceWorld.platforms.push(
            { x: arenaX + 100, y: 450, width: 100, height: 20, color: 'brown' },
            { x: arenaX + 600, y: 450, width: 100, height: 20, color: 'brown' },
            { x: arenaX + 350, y: 350, width: 100, height: 20, color: 'brown' },
            // Extra Platforms
            { x: arenaX + 250, y: 250, width: 80, height: 20, color: 'brown' },
            { x: arenaX + 850, y: 350, width: 100, height: 20, color: 'brown' }
        );
        
        // Boss Wall (Prevent walking past)
        surfaceWorld.platforms.push(
            { x: LEVEL_WIDTH - 10, y: 0, width: 50, height: 600, color: 'brown', type: 'boss_wall' }
        );
        
        // Queen Boss
        surfaceWorld.ants.push({
            x: arenaX + 400,
            y: 350, // Floating slightly
            width: 120, // Giant
            height: 100,
            speed: 2.25, // Faster
            direction: -1,
            type: 'queen',
            hp: 7, // 7 hits
            attackTimer: 0,
            startX: arenaX + 300,
            endX: arenaX + 1100
        });

        // --- MERV'S HOUSE (Finale) ---
        const houseX = LEVEL_WIDTH + 200;
        
        // Platform for jumping on house (Lowered for accessibility)
        surfaceWorld.platforms.push(
            { x: houseX - 100, y: 450, width: 100, height: 20, color: 'brown' }
        );

        // House Walls
        surfaceWorld.platforms.push(
            { x: houseX, y: 350, width: 20, height: 50, color: 'brown' }, // Left Wall Doorframe
            { x: houseX + 800, y: 350, width: 20, height: 50, color: 'brown' }, // Right Wall (Now Doorframe)
            { x: houseX, y: 350, width: 820, height: 20, color: 'brown' } // Ceiling
        );
        // Roof
        surfaceWorld.platforms.push(
            { x: houseX - 50, y: 350, width: 900, height: 20, color: 'red' },
            { x: houseX + 100, y: 250, width: 600, height: 100, color: 'red' }
        );
        
        // Final Victory Point
        surfaceWorld.platforms.push(
            { x: houseX + 1200, y: 350, width: 10, height: 200, color: 'silver', type: 'flagpole' }, // Pole
            { x: houseX + 1210, y: 350, width: 60, height: 40, color: 'red', type: 'flag' } // Flag
        );
    } else {
        // Standard Goal
        surfaceWorld.platforms.push(
            { x: LEVEL_WIDTH - 150, y: 450, width: 20, height: 100, color: 'white' }, 
            { x: LEVEL_WIDTH - 150, y: 450, width: 50, height: 20, color: 'red' }
        );
    }
    console.log("Total Platforms: " + surfaceWorld.platforms.length);
}

function createChunk(offsetX, type) {
    const antMultiplier = Math.pow(2, level - 1);
    const spawnScaledAnts = (baseConfig) => {
        for (let i = 0; i < antMultiplier * 3; i++) {
            let ant = { ...baseConfig };
            ant.x += (Math.random() * 40 - 20) + (i * 30); 
            ant.speed = baseConfig.speed * (0.8 + Math.random() * 0.4) * 0.75; 
            surfaceWorld.ants.push(ant);
        }
    };

    let hasPipe = false;
    if (level !== 3 && (type === 'flat' || type === 'boxes') && Math.random() > 0.6) {
        hasPipe = true;
        let pipeX = offsetX + 600;
        surfaceWorld.platforms.push(
            { x: pipeX, y: 500, width: 60, height: 50, color: 'green', type: 'pipe_body', warp: true },
            { x: pipeX - 5, y: 500, width: 70, height: 20, color: 'green', type: 'pipe_top', warp: true }
        );
    }

    if (type !== 'gap') {
        surfaceWorld.platforms.push({ x: offsetX, y: 550, width: CHUNK_SIZE, height: 50, color: 'green' });
    } else {
        surfaceWorld.platforms.push(
            { x: offsetX, y: 550, width: 150, height: 50, color: 'green' },
            { x: offsetX + 200, y: 450, width: 100, height: 20, color: 'brown' }, 
            { x: offsetX + 350, y: 350, width: 100, height: 20, color: 'brown' },
            { x: offsetX + 500, y: 450, width: 100, height: 20, color: 'brown' },
            { x: offsetX + 650, y: 550, width: 150, height: 50, color: 'green' }
        );
        spawnScaledAnts({ x: offsetX + 350, y: 300, width: 30, height: 20, speed: 2, direction: 1, type: 'flyer' });
        spawnScaledAnts({ x: offsetX + 200, y: 200, width: 30, height: 20, speed: 2.5, direction: -1, type: 'flyer' });
        spawnCoinInAir(offsetX + 350, 250, surfaceWorld.items);
    }

    if (type === 'climb') {
        surfaceWorld.platforms.push(
            { x: offsetX + 100, y: 450, width: 100, height: 20, color: 'brown' },
            { x: offsetX + 250, y: 350, width: 100, height: 20, color: 'brown' },
            { x: offsetX + 400, y: 250, width: 100, height: 20, color: 'brown' }, 
            { x: offsetX + 550, y: 350, width: 100, height: 20, color: 'brown' },
            { x: offsetX + 700, y: 450, width: 100, height: 20, color: 'brown' }
        );
        spawnScaledAnts({ x: offsetX + 420, y: 220, width: 30, height: 20, speed: 2, direction: 1, type: 'walker' });
        surfaceWorld.platforms.push({ x: offsetX + 430, y: 140, width: 40, height: 40, color: 'gold', active: true });
        spawnScaledAnts({ x: offsetX + 600, y: 520, width: 30, height: 20, speed: 2, direction: -1, type: 'walker' });
    }

    if (type === 'islands') {
        surfaceWorld.platforms.push(
            { x: offsetX + 50, y: 450, width: 100, height: 20, color: 'brown' },
            { x: offsetX + 200, y: 350, width: 400, height: 20, color: 'brown' }, 
            { x: offsetX + 650, y: 450, width: 100, height: 20, color: 'brown' }
        );
        spawnScaledAnts({ x: offsetX + 250, y: 320, width: 30, height: 20, speed: 2, direction: 1, type: 'walker' });
        spawnScaledAnts({ x: offsetX + 450, y: 320, width: 30, height: 20, speed: 2, direction: -1, type: 'walker' });
        
        surfaceWorld.platforms.push(
            { x: offsetX + 300, y: 220, width: 40, height: 40, color: 'gold', active: true },
            { x: offsetX + 340, y: 220, width: 40, height: 40, color: 'brown' },
            { x: offsetX + 380, y: 220, width: 40, height: 40, color: 'gold', active: true }
        );
        spawnScaledAnts({ x: offsetX + 300, y: 100, width: 30, height: 20, speed: 2, direction: 1, type: 'flyer' });
    }

    if (type === 'boxes') {
        let boxY = 420;
        surfaceWorld.platforms.push(
            { x: offsetX + 100, y: boxY, width: 40, height: 40, color: 'gold', active: true },
            { x: offsetX + 140, y: boxY, width: 40, height: 40, color: 'brown' },
            { x: offsetX + 180, y: boxY, width: 40, height: 40, color: 'gold', active: true },
            { x: offsetX + 220, y: boxY, width: 40, height: 40, color: 'brown' },
            { x: offsetX + 260, y: boxY, width: 40, height: 40, color: 'gold', active: true }
        );
        
        surfaceWorld.platforms.push(
            { x: offsetX + 180, y: 290, width: 40, height: 40, color: 'gold', active: true, content: 'latte' } 
        );
        
        surfaceWorld.platforms.push(
            { x: offsetX + 400, y: 450, width: 60, height: 20, color: 'brown' },
            { x: offsetX + 480, y: 350, width: 60, height: 20, color: 'brown' },
            { x: offsetX + 560, y: 250, width: 60, height: 20, color: 'brown' }
        );

        spawnScaledAnts({ x: offsetX + 150, y: boxY - 30, width: 30, height: 20, speed: 1.5, direction: 1, type: 'walker' }); 
        spawnScaledAnts({ x: offsetX + 300, y: 520, width: 30, height: 20, speed: 2, direction: 1, type: 'walker' }); 
        spawnScaledAnts({ x: offsetX + 600, y: 520, width: 30, height: 20, speed: 3, direction: -1, type: 'walker' }); 
        spawnScaledAnts({ x: offsetX + 400, y: 100, width: 30, height: 20, speed: 3, direction: 1, type: 'flyer' });
    }
}

function generateShowerLevel() {
    showerWorld = { platforms: [], ants: [], items: [], spawners: [] };
    const width = 2000;
    
    // Bounds
    showerWorld.platforms.push({ x: 0, y: 550, width: width, height: 50, color: 'tile_blue' });
    showerWorld.platforms.push({ x: 0, y: 0, width: width, height: 50, color: 'tile_blue' });
    showerWorld.platforms.push({ x: -50, y: 0, width: 50, height: 600, color: 'tile_blue' });
    showerWorld.platforms.push({ x: width, y: 0, width: 50, height: 600, color: 'tile_blue' });

    // Caulk Lines & Spawners
    for(let x = 300; x < width - 300; x += 600) {
        // Vertical Caulk Line (Floor to Ceiling)
        showerWorld.platforms.push({ x: x, y: 0, width: 40, height: 600, color: 'caulk_line' });
        // Dark Hole
        showerWorld.platforms.push({ x: x + 5, y: 250, width: 30, height: 40, color: 'dark_hole' });
        showerWorld.spawners.push({ x: x + 20, y: 270 });
    }

    // Platforms inside
    for(let x = 200; x < width - 200; x += 300) {
        // Avoid placing platforms directly on caulk lines
        if (x % 600 === 300) continue; 

        // Lower platforms for reachability
        showerWorld.platforms.push({ x: x, y: 430, width: 100, height: 20, color: 'tile_white' });
        showerWorld.platforms.push({ x: x+150, y: 310, width: 100, height: 20, color: 'tile_white' });
        
        spawnCoinInAir(x + 20, 380, showerWorld.items);
        spawnCoinInAir(x + 60, 380, showerWorld.items);
        spawnCoinInAir(x + 170, 260, showerWorld.items);
        
        // Soap chance
        if (Math.random() > 0.7) spawnItem(x + 50, 400, 'soap_bar', showerWorld.items);
    }

    // Crawling Ceiling Ants (More Dense)
    for(let x = 100; x < width - 100; x += 40) {
        // Spawn on ceiling
        showerWorld.ants.push({ 
            x: x, 
            y: 50, // Ceiling 
            width: 30, 
            height: 20, 
            speed: (1 + Math.random()) * 0.75, 
            direction: 1, 
            type: 'crawler',
            state: 'crawling' // crawling, falling, dead
        });
    }

    // Exit Pipe
    showerWorld.platforms.push(
        { x: width - 100, y: 450, width: 60, height: 100, color: 'green', type: 'pipe_body', exit: true },
        { x: width - 105, y: 450, width: 70, height: 20, color: 'green', type: 'pipe_top', warp: false, exit: true }
    );
}

function spawnCoinInAir(x, y, itemArray) {
    itemArray.push({
        x: x,
        y: y,
        width: 20,
        height: 20,
        dy: 0, 
        type: 'pedicure_token'
    });
}

function spawnItem(x, y, content, itemArray) {
    let type = content || 'pedicure_token';
    itemArray.push({
        x: x + 10,
        y: y - 20,
        width: 20,
        height: 20,
        dy: -8, 
        type: type
    });
}

function initGame() {
    // Reset all stats
    lives = 3;
    score = 0;
    
    // Check URL override again
    const urlParams = new URLSearchParams(window.location.search);
    const startLevel = parseInt(urlParams.get('level'));
    level = !isNaN(startLevel) ? startLevel : 1;
    
    resetLevel();
}

function resetLevel(keepPowerups = false) {
    const params = new URLSearchParams(window.location.search);
    const levelParam = params.get('level');

    // Boss Warp (Only if explicitly requested)
    if (level === 3 && levelParam === '3boss') {
        player.x = LEVEL_WIDTH - 1300; // Start outside Arena
    } else {
        player.x = 50;
    }
    
    player.y = 300;
    player.dy = 0;
    player.dx = 0;
    
    if (!keepPowerups) {
        player.isBig = false;
        player.hasExterminatorSuit = false; // Reset powerup
        player.width = 30;
        player.height = 30;
    }
    
    player.shootTimer = 0; // Animation timer
    player.holdingAnt = false;
    player.invulnerable = 0;
    camera.x = 0;
    time = 400; // Reset time per level/death
    inShower = false;
    projectiles = []; // Clear projectiles
    generateLevel(); 
}

function hurtPlayer() {
    if (player.invulnerable > 0 || player.invincibleTimer > 0) return;

    if (player.hasExterminatorSuit) {
        player.hasExterminatorSuit = false;
        player.isBig = false;
        player.width = 30;
        player.height = 30;
        player.y += 30; 
        player.invulnerable = 60;
        effects.push({ x: player.x, y: player.y - 40, text: "POWER DOWN!", life: 60 });
        return;
    }

    if (player.isBig) {
        player.isBig = false;
        player.width = 30;
        player.height = 30;
        player.y += 30; 
        player.invulnerable = 60; 
    } else {
        gameState = 'PLAYER_DYING';
    }
}

const keys = {};

window.addEventListener('keydown', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
    keys[e.code] = true;
    if (gameState === 'START' && e.key === 'Enter') {
        initGame();
        gameState = 'PLAYING';
    }
    if ((gameState === 'GAME_OVER' || gameState === 'VICTORY') && e.code === 'Space') {
        gameState = 'START';
    }
    if (gameState === 'PLAYER_DYING') {
        lives--;
        if (lives > 0) {
            // Respawn
            effects.push({ x: player.x, y: player.y - 50, text: "-1 LIFE", life: 60 });
            resetLevel(); 
            gameState = 'PLAYING';
        } else {
            gameState = 'GAME_OVER';
        }
    }
    
    // Shooting / Throwing (Shift)
    if (e.key === 'Shift' && gameState === 'PLAYING') {
        if (player.holdingAnt) {
            const heldType = player.holdingAnt;
            player.holdingAnt = false;
            
            // Throw Ant
            const currentAnts = inShower ? showerWorld.ants : surfaceWorld.ants;
            currentAnts.push({
                x: player.facing === 1 ? player.x + player.width : player.x - 30,
                y: player.y + 10,
                width: 30, height: 20,
                speed: 0,
                dx: player.facing * 10,
                dy: -5,
                state: 'projectile_return',
                rotation: 0,
                type: 'walker', // Force standard ant type for drawing
                isQueenProjectile: heldType === 'queen' // Mark for scaling
            });
            return;
        }

        if (player.hasExterminatorSuit) {
            player.shootTimer = 30; // Animation
            
            // Spawn Mist Cloud
            const reach = 150;
            const cloudX = player.facing === 1 ? player.x + player.width : player.x - reach;
            
            projectiles.push({
                type: 'cloud',
                x: cloudX,
                y: player.y + 10, 
                width: reach,
                height: 50, 
                life: 60 
            });
        }
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

function update() {
    if (gameState !== 'PLAYING') return;
    
    frame++;

    // Time ticking
    if (frame % 60 === 0) {
        time--;
        if (time <= 0) {
            hurtPlayer();
        }
    }

    let platforms = inShower ? showerWorld.platforms : surfaceWorld.platforms;
    let ants = inShower ? showerWorld.ants : surfaceWorld.ants;
    let items = inShower ? showerWorld.items : surfaceWorld.items;
    
            if (inShower) {
    
                if (frame % 5 === 0) { 
    
                    waterParticles.push({
    
                        x: camera.x + Math.random() * canvas.width,
    
                        y: 0,
    
                        speed: 5 + Math.random() * 5,
    
                        life: 100
    
                    });
    
                }
    
                
    
                // Continuous Ant Spawning (from caulking holes)
    
                if (frame % 30 === 0 && showerWorld.spawners && showerWorld.spawners.length > 0) {
                     const spawner = showerWorld.spawners[Math.floor(Math.random() * showerWorld.spawners.length)];
                     // Check if too many ants already
                     const activeAnts = showerWorld.ants.filter(a => a.state !== 'dead' && a.state !== 'ground_dead').length;
                     
                     if (activeAnts < 20) {
                         showerWorld.ants.push({ 
                            x: spawner.x, 
                            y: spawner.y, 
                            width: 30, 
                            height: 20, 
                            speed: (1 + Math.random()) * 0.75, 
                            direction: Math.random() > 0.5 ? 1 : -1, 
                            type: 'crawler',
                            state: 'crawling', // Start crawling around hole first
                            axis: Math.random() > 0.5 ? 'x' : 'y'
                        });
                     }
                }
    
        
    
                for (let i = waterParticles.length - 1; i >= 0; i--) {
    
                let p = waterParticles[i];
    
                p.y += p.speed;
    
                p.life--;
    
                if (p.life <= 0) waterParticles.splice(i, 1);
    
            }
    
        } else {
    
            // Clouds
    
            clouds.forEach(c => {
    
                c.x += c.speed;
    
                if (c.x > LEVEL_WIDTH) c.x = -c.size;
    
            });
    
        }
    
        
    
        // Dust
    
        for (let i = dustParticles.length - 1; i >= 0; i--) {
    
            let p = dustParticles[i];
    
            p.x += p.dx;
    
            p.y += p.dy;
    
            p.life--;
    
            if (p.life <= 0) dustParticles.splice(i, 1);
    
        }
    
        
    
        // Player Logic
    
        if (player.invincibleTimer > 0) player.invincibleTimer--;
    
        const currentSpeed = (player.invincibleTimer > 0) ? SPEED * 1.5 : SPEED;
    
    
    
        // Player Movement
    
        if (keys['ArrowLeft']) {
    
            player.dx = -currentSpeed;
    
            player.facing = -1;
    
        } else if (keys['ArrowRight']) {
    
            player.dx = currentSpeed;
    
            player.facing = 1;
    
        } else {
    
            player.dx = 0;
    
        }

    if (keys['Space'] && player.grounded) {
        player.dy = JUMP_FORCE;
        player.grounded = false;
    }

    player.dy += GRAVITY;
    player.x += player.dx;
    player.y += player.dy;

    if (player.x < 0) player.x = 0;
    
    // Boss Lockout (One-way door)
    if (level === 3 && player.x > LEVEL_WIDTH - 1100) {
        if (player.x < LEVEL_WIDTH - 1200) player.x = LEVEL_WIDTH - 1200;
    }

    // Check if Queen is Alive
    const queenAlive = level === 3 && ants.some(a => a.type === 'queen' && a.hp > 0 && a.state !== 'dead' && a.state !== 'ground_dead' && a.state !== 'falling_dead');

    let limit = inShower ? 2000 : LEVEL_WIDTH;
    if (level === 3 && (player.hasCrown || !queenAlive)) limit = LEVEL_WIDTH + 2000;
    
    // Boss Arena Trap (Only if Queen is Alive and no Crown)
    if (level === 3 && !player.hasCrown && queenAlive && player.x > LEVEL_WIDTH - 1000) {
        // Once in, can't leave left
        if (player.x < LEVEL_WIDTH - 1000) player.x = LEVEL_WIDTH - 1000;
        // Can't leave right (fall off)
        if (player.x > LEVEL_WIDTH - 50) player.x = LEVEL_WIDTH - 50;
    }
    
    if (player.x + player.width > limit) player.x = limit - player.width;

    // Final Victory
    if (level === 3 && player.hasCrown && player.x >= LEVEL_WIDTH + 1400) {
        gameState = 'VICTORY';
        score += 20000;
        return;
    }

    if (!inShower && player.x >= LEVEL_WIDTH - 200) {
        if (level != 3) {
            console.log("Level Transition Triggered. Level: " + level);
            level++;
            effects.push({ x: player.x, y: player.y - 50, text: "LEVEL " + level + "!", life: 120 });
            resetLevel(true);
            return; // Stop processing this frame to avoid glitches
        }
    }

    camera.x = player.x - canvas.width / 2;
    if (camera.x < 0) camera.x = 0;
    if (camera.x > limit - canvas.width) camera.x = limit - canvas.width;

    // --- ANT LOGIC (Moved before platforms to preserve dy for stomps) ---
    for (let i = ants.length - 1; i >= 0; i--) {
        const ant = ants[i];
        
        if (ant.type === 'crawler') {
            if (ant.state === 'crawling') {
                // Handle axis (default to 'x' if not set)
                const axis = ant.axis || 'x';
                
                // Randomly switch axis
                if (Math.random() < 0.01) {
                    ant.axis = (axis === 'x') ? 'y' : 'x';
                }
                // Randomly switch direction
                if (Math.random() < 0.01) {
                    ant.direction *= -1;
                }

                if (axis === 'x') {
                    ant.x += ant.speed * ant.direction;
                    if (ant.x > limit || ant.x < 0) ant.direction *= -1;
                } else { // axis === 'y'
                    ant.y += ant.speed * ant.direction;
                    if (ant.y > 550 || ant.y < 0) ant.direction *= -1; // Floor check
                }

                const onscreen = ant.x > camera.x - 100 && ant.x < camera.x + canvas.width + 100;

                if (onscreen && Math.random() > 0.999) { // Random chance to die/fall (Lowered)
                    ant.state = 'falling';
                    ant.dy = 0;
                    ant.axis = 'x'; // Default to normal falling behavior
                }
            } 
            else if (ant.state === 'falling') {
                ant.dy = (ant.dy || 0) + GRAVITY;
                ant.y += ant.dy;
                ant.grounded = false;
                
                // Hit ground
                if (ant.y > 550) { // Approx floor
                     ant.state = 'ground_dead';
                     ant.y = 560; // Settle
                     ant.grounded = true;
                }
            }
            else if (ant.state === 'ground_dead') {
                ant.grounded = true;
            }
            else if (ant.state === 'dead') {
                ant.life--;
                if (ant.life <= 0) ants.splice(i, 1);
            }
        } else if (ant.type === 'queen') {
            if (ant.invulnerable > 0) ant.invulnerable--;

            if (ant.state === 'falling_dead') {
                 ant.dy = (ant.dy || 0) + GRAVITY;
                 ant.y += ant.dy;
                 if (ant.y > 550) {
                     ant.y = 500;
                     ant.dy = 0;
                     ant.state = 'ground_dead';
                 }
            } else if (ant.state === 'ground_dead') {
                 ant.y = 500;
                 ant.dy = 0;
            }
            // Activate only when player is close
            else if (ant.state !== 'dead' && ant.state !== 'falling_dead' && ant.state !== 'ground_dead' && Math.abs(player.x - ant.x) < 2500) {
                // console.log("Queen Active"); // Debug
                
                // Clear other ants in arena - REMOVED

                // Boss Logic
                // Patrol (Erratic)
                ant.x += ant.speed * ant.direction + Math.sin(frame * 0.1) * 3; 
                if (ant.x < ant.startX || ant.x > ant.endX) ant.direction *= -1;
                
                // Hover (Erratic)
                ant.y = 300 + Math.sin(frame * 0.05) * 80 + Math.sin(frame * 0.15) * 40;

                // Attack
                ant.attackTimer = (ant.attackTimer || 0) - 1;
                if (ant.attackTimer <= 0) {
                    ant.attackTimer = 90; // Fast throws! (1.5s)
                    // Throw MINION ant
                    let throwDx = (player.x - ant.x) * 0.015;
                    // Cap speed (max 4.5, approx 2x walking speed)
                    if (throwDx > 4.5) throwDx = 4.5;
                    if (throwDx < -4.5) throwDx = -4.5;

                    surfaceWorld.ants.push({
                        x: ant.x + ant.width/2,
                        y: ant.y + ant.height + 10,
                        width: 30, height: 20,
                        speed: 0,
                        dx: throwDx, // Aim at player (capped)
                        dy: -8, // Arc up
                        type: 'thrown_minion', 
                        state: 'falling' 
                    });
                }

                // Collision detection with Queen
                if (player.x < ant.x + ant.width && player.x + player.width > ant.x &&
                    player.y < ant.y + ant.height && player.y + player.height > ant.y) {
                    
                    // Check if player is in the 'stomp zone' (top 95% of Queen's hitbox)
                    if (player.y + player.height < ant.y + ant.height * 0.95) {
                        // Player is in the safe stomp zone.
                        if (player.dy >= 0) { // Stomp only if player is falling or flat
                            if (ant.invulnerable > 0) {
                                player.dy = JUMP_FORCE * 1.2;
                                player.y -= 20; // Force separation
                            } else {
                                ant.hp--; // Damage Queen
                                ant.invulnerable = 60;
                                player.dy = JUMP_FORCE * 1.2; // Bounce Merv higher
                                player.y -= 20; // Force separation
                                
                                // Queen Death Logic
                                if (ant.hp <= 0) {
                                    ant.state = 'falling_dead';
                                    ant.dy = 0; // Start falling
                                    score += 5000;
                                    effects.push({ x: ant.x, y: ant.y, text: "QUEEN DEFEATED!", life: 180 });
                                    // spawnHouseAnts(); // Removed
                                    // Drop Rewards
                                    surfaceWorld.items.push({ x: ant.x + ant.width/2, y: ant.y, width: 40, height: 40, type: 'crown', dy: -8 });
                                    surfaceWorld.items.push({ x: ant.x, y: ant.y, width: 30, height: 30, type: 'latte', dy: -6 });
                                    surfaceWorld.items.push({ x: ant.x + ant.width, y: ant.y, width: 30, height: 30, type: 'latte', dy: -6 });
                                } else {
                                    effects.push({ x: ant.x, y: ant.y, text: "HIT!", life: 60 });
                                }
                            }
                        } else {
                            // Player is moving UP into the safe zone (e.g., jumping up, not stomping)
                            // Push player up slightly to prevent sticking/clipping. No damage.
                            player.y = ant.y + ant.height * 0.2 - player.height; 
                        }
                    } else {
                        // Player is NOT in the safe top zone (i.e., hitting sides or bottom)
                        hurtPlayer();
                    }
                } // Closing brace for player collision if
            } // Closing brace for if (ant.state !== 'dead')
        } else if (ant.state === 'projectile_return') {
            // Homing Missile Logic
            ant.x += ant.dx;
            ant.y += ant.dy;
            ant.rotation = (ant.rotation || 0) + 0.5; // Spin!

            // Hit Other Ants (Collateral Damage)
            for (let m = ants.length - 1; m >= 0; m--) {
                const victim = ants[m];
                if (victim !== ant && victim.type !== 'queen' && victim.state !== 'dead' && victim.state !== 'ground_dead' && victim.state !== 'falling_dead') {
                    if (ant.x < victim.x + victim.width && ant.x + ant.width > victim.x &&
                        ant.y < victim.y + victim.height && ant.y + ant.height > victim.y) {
                        
                        // Kill Both
                        ant.state = 'falling_dead';
                        ant.dx = 0;
                        ant.rotation = 0;
                        
                        victim.state = 'falling_dead';
                        victim.dy = -5; // Pop up
                        
                        effects.push({ x: ant.x, y: ant.y, text: "STRIKE!", life: 60 });
                        break;
                    }
                }
            }

            // Hit Queen?
            const queen = ants.find(a => a.type === 'queen');
            if (queen && ant !== queen && queen.state !== 'dead' && queen.state !== 'falling_dead' && queen.state !== 'ground_dead') {
                if (ant.x < queen.x + queen.width && ant.x + ant.width > queen.x &&
                    ant.y < queen.y + queen.height && ant.y + ant.height > queen.y) {
                    
                    // Kill projectile
                    ant.state = 'dead'; 
                    ant.life = 0; // Instant gone
                    
                    if (queen.invulnerable > 0) {
                        effects.push({ x: queen.x, y: queen.y, text: "BLOCK!", life: 30 });
                    } else {
                        queen.hp--;
                        queen.invulnerable = 60;
                        
                        if (queen.hp <= 0) {
                            queen.state = 'falling_dead';
                        queen.dy = 0;
                        score += 5000;
                        effects.push({ x: queen.x, y: queen.y, text: "HOUSE UNLOCKED!", life: 180 });
                        // spawnHouseAnts(); // Removed
                        
                        // Drop Rewards
                        surfaceWorld.items.push({ x: queen.x + queen.width/2, y: queen.y, width: 40, height: 40, type: 'crown', dy: -8 });
                        surfaceWorld.items.push({ x: queen.x, y: queen.y, width: 30, height: 30, type: 'latte', dy: -6 });
                        surfaceWorld.items.push({ x: queen.x + queen.width, y: queen.y, width: 30, height: 30, type: 'latte', dy: -6 });
                    } else {
                        effects.push({ x: queen.x, y: queen.y, text: "HIT!", life: 60 });
                    }
                    }
                }
            }
        } else {
            // Normal behavior (Walker/Flyer/Thrown Minion)
            
            // Movement (Only if alive)
            if (ant.state !== 'ground_dead' && ant.state !== 'falling_dead') {
                ant.grounded = false;
                ant.x += (ant.dx !== undefined) ? ant.dx : (ant.speed * ant.direction);
                
                // Boss Arena Containment
                if (level === 3 && ant.type !== 'thrown_minion' && ant.state !== 'projectile_return') {
                    const arenaStart = LEVEL_WIDTH - 1200;
                    
                    if (ant.isMinion) {
                        // Keep INSIDE arena
                        if (ant.x < arenaStart) { ant.x = arenaStart; ant.direction = 1; }
                        if (ant.x > LEVEL_WIDTH - 50) { ant.x = LEVEL_WIDTH - 50; ant.direction = -1; }
                    } else {
                        // Keep OUTSIDE arena
                        if (ant.x > arenaStart - 50) { ant.x = arenaStart - 50; ant.direction = -1; }
                    }
                }
                
                if (ant.type === 'flyer') {
                    ant.y += Math.sin(frame * 0.1) * 2;
                    // Flyers float, no gravity
                } else {
                    // Walkers have gravity
                    ant.dy = (ant.dy || 0) + GRAVITY;
                    ant.y += ant.dy;
                }
                
                if (ant.x < 0 || ant.x + ant.width > limit) ant.direction *= -1;
            } else {
                // Dead/Falling Physics
                ant.dy = (ant.dy || 0) + GRAVITY;
                ant.y += ant.dy;
            }
            
            platforms.forEach(p => {
                if (p.color === 'caulk_line' || p.color === 'dark_hole') return; // Ignore

                if (ant.x < p.x + p.width &&
                    ant.x + ant.width > p.x &&
                    ant.y < p.y + p.height &&
                    ant.y + ant.height > p.y) {
                        
                        // Landing Logic (Alive Walkers or Dead Ants)
                        if ((ant.type !== 'flyer' || ant.state === 'falling_dead') && ant.dy > 0 && ant.y + ant.height - ant.dy <= p.y + 10) {
                            ant.y = p.y - ant.height;
                            ant.dy = 0;
                            ant.grounded = true;
                            if (ant.state === 'falling_dead') ant.state = 'ground_dead';
                            
                            if (ant.type === 'thrown_minion') {
                                ant.type = 'walker';
                                ant.state = undefined;
                                ant.isMinion = true; // Mark as Queen's minion to avoid cleanup
                                ant.speed = (2 + Math.random()) * 0.75;
                                ant.direction = Math.random() > 0.5 ? 1 : -1;
                                delete ant.dx;
                            }
                        }
                        // Turn around on wall/pipe hit (Side collision - Alive only)
                        else if (ant.state !== 'ground_dead' && ant.state !== 'falling_dead') {
                            if (p.type === 'pipe_body' || p.type === 'pipe_top' || (ant.type !== 'flyer' && !ant.grounded)) {
                                 ant.direction *= -1;
                                 ant.x += ant.speed * ant.direction * 2; // Bounce out
                            } else {
                                 ant.direction *= -1;
                                 ant.x += ant.speed * ant.direction;
                            }
                        }
                    }
            });

            
             // Remove if fell off map (if somehow missed floor)
            if (ant.y > 700) {
                ants.splice(i, 1);
            }
        }

        // Player Collision
        // 1. Pickup Dead Ant
        if (ant.state === 'ground_dead') {
            if (player.x < ant.x + ant.width && player.x + player.width > ant.x &&
                player.y < ant.y + ant.height && player.y + player.height > ant.y) {
                if (!player.holdingAnt) {
                    player.holdingAnt = ant.type || 'walker';
                    ants.splice(i, 1);
                    continue; // Skip rest
                }
            }
        }

        // 2. Active/Falling Ant Collision
        // falling_dead ants are dangerous!
        if (ant.state !== 'dead' && ant.state !== 'ground_dead' && ant.state !== 'projectile_return') {
            // Adjust hitbox for vertical crawlers
            let hitW = ant.width;
            let hitH = ant.height;
            if (ant.axis === 'y' && ant.state === 'crawling') {
                hitW = ant.height;
                hitH = ant.width;
            }

            if (player.x < ant.x + hitW &&
                player.x + player.width > ant.x &&
                player.y < ant.y + hitH &&
                player.y + player.height > ant.y) {
                
                // TYPE 7: Falling Dead Ants
                if (ant.state === 'falling_dead') {
                    // Only Wall Ants (Crawlers) are dangerous when falling dead
                    if (ant.type === 'crawler' && Math.abs(ant.dy) > 2) hurtPlayer();
                    continue; 
                }

                // TYPE 2: Wall Ants (Crawlers) (Dangerous!)
                if (ant.type === 'crawler') {
                    hurtPlayer();
                    continue; 
                }

                // TYPES 3, 4, 6: Flyer, Walker, Floating (Stompable)
                // Hit Logic: Top 10% vs Bottom 90%
                const stompThreshold = ant.y + (ant.height || 20) * 0.1;
                const prevFeet = player.y + player.height - player.dy;
                const validStomp = (player.dy >= 0 && prevFeet <= stompThreshold + 5) || (player.y + player.height <= ant.y + 15);

                console.log(`COLLISION: Type=${ant.type} State=${ant.state} | Py=${Math.round(player.y)} Pdy=${player.dy.toFixed(2)} PrevFeet=${Math.round(prevFeet)} | Ay=${Math.round(ant.y)} Thresh=${Math.round(stompThreshold)} | Stomp=${validStomp}`);

                if (validStomp) {
                    console.log("-> RESULT: STOMP SUCCESS");
                    if (ant.type === 'thrown_minion') {
                        ant.state = 'ground_dead'; 
                    } else {
                        ant.state = 'falling_dead'; 
                        ant.dy = 0;
                    }
                    player.dy = JUMP_FORCE / 1.5;
                } else {
                    console.log("-> RESULT: HURT PLAYER");
                    hurtPlayer();
                }
            }
        }
    }

    player.grounded = false;
    platforms.forEach(platform => {
        if (platform.color === 'caulk_line' || platform.color === 'dark_hole') return; // No collision with background
        if (platform.type === 'flag' || platform.type === 'flagpole') return; // No collision with flag
        if (platform.type === 'boss_wall' && player.hasCrown) return; // Pass through if victorious

        if (player.x < platform.x + platform.width &&
            player.x + player.width > platform.x &&
            player.y <= platform.y + platform.height &&
            player.y + player.height >= platform.y) {
            
            // Landing on top
            if (player.dy >= 0 && player.y + player.height - player.dy <= platform.y + 5) { // Threshold for standing
                if (platform.color === 'purple') console.log("Landed on Purple Floor");
                player.y = platform.y - player.height; // Snap ALWAYS
                
                if (player.dy > 1) { // Only dust on real landing
                    // Dust! (Only if moving or landing hard)
                    if (!inShower && (Math.abs(player.dx) > 0.1 || player.dy > 5)) {
                        for(let k=0; k<5; k++) dustParticles.push({ x: player.x+15, y: player.y+30, dx: Math.random()*4-2, dy: -Math.random()*2, life: 20, size: Math.random()*4 });
                    }
                }
                player.dy = 0;
                player.grounded = true;
                
                // Warp Logic (Check if standing on pipe)
                if (platform.warp && keys['ArrowDown']) {
                    savedSurfaceX = player.x + 100; 
                    inShower = true;
                    generateShowerLevel();
                    player.x = 50;
                    player.y = 300;
                    return; // Stop processing platforms
                }
                
                // Exit Shower
                if (inShower && platform.exit && keys['ArrowDown']) {
                     inShower = false;
                     player.x = savedSurfaceX;
                     player.y = 300;
                     player.dy = 0;
                     return;
                }
            }
            // Hitting head on bottom
            else if (player.dy < 0 && player.y - player.dy >= platform.y + platform.height) {
                player.y = platform.y + platform.height;
                player.dy = 0;
                
                if (platform.color === 'gold' && platform.active) {
                    platform.active = false;
                    platform.color = '#b8860b'; 
                    
                    let content = 'coin';
                    const r = Math.random();
                    if (r > 0.9) content = 'soap_bar';
                    else if (r > 0.7) content = 'latte';
                    
                    spawnItem(platform.x, platform.y, content, items);
                }
            }
            // Side collisions
            else if (player.dx > 0) {
                player.x = platform.x - player.width;
            } else if (player.dx < 0) {
                player.x = platform.x + platform.width;
            }
        }
    });

    if (player.y > canvas.height) {
        hurtPlayer();
        player.y = 0; // Prevent infinite loop of death in same frame
        if (lives > 0) { 
             player.x = 50; player.y = 300; player.dy = 0;
        }
    }
    
    for (let i = ants.length - 1; i >= 0; i--) {
        const ant = ants[i];
        
        if (ant.type === 'crawler') {
            if (ant.state === 'crawling') {
                // Handle axis (default to 'x' if not set)
                const axis = ant.axis || 'x';
                
                // Randomly switch axis
                if (Math.random() < 0.01) {
                    ant.axis = (axis === 'x') ? 'y' : 'x';
                }
                // Randomly switch direction
                if (Math.random() < 0.01) {
                    ant.direction *= -1;
                }

                if (axis === 'x') {
                    ant.x += ant.speed * ant.direction;
                    if (ant.x > limit || ant.x < 0) ant.direction *= -1;
                } else { // axis === 'y'
                    ant.y += ant.speed * ant.direction;
                    if (ant.y > 550 || ant.y < 0) ant.direction *= -1; // Floor check
                }

                const onscreen = ant.x > camera.x - 100 && ant.x < camera.x + canvas.width + 100;

                if (onscreen && Math.random() > 0.999) { // Random chance to die/fall (Lowered)
                    ant.state = 'falling';
                    ant.dy = 0;
                    ant.axis = 'x'; // Default to normal falling behavior
                }
            } 
            else if (ant.state === 'falling') {
                ant.dy = (ant.dy || 0) + GRAVITY;
                ant.y += ant.dy;
                ant.grounded = false;
                
                // Hit ground
                if (ant.y > 550) { // Approx floor
                     ant.state = 'ground_dead';
                     ant.y = 560; // Settle
                     ant.grounded = true;
                }
            }
            else if (ant.state === 'ground_dead') {
                ant.grounded = true;
            }
            else if (ant.state === 'dead') {
                ant.life--;
                if (ant.life <= 0) ants.splice(i, 1);
            }
        } else if (ant.type === 'queen') {
            if (ant.invulnerable > 0) ant.invulnerable--;

            if (ant.state === 'falling_dead') {
                 ant.dy = (ant.dy || 0) + GRAVITY;
                 ant.y += ant.dy;
                 if (ant.y > 550) {
                     ant.y = 500;
                     ant.dy = 0;
                     ant.state = 'ground_dead';
                 }
            } else if (ant.state === 'ground_dead') {
                 ant.y = 500;
                 ant.dy = 0;
            }
            // Activate only when player is close
            else if (ant.state !== 'dead' && ant.state !== 'falling_dead' && ant.state !== 'ground_dead' && Math.abs(player.x - ant.x) < 2500) {
                // console.log("Queen Active"); // Debug
                
                // Clear other ants in arena - REMOVED

                // Boss Logic
                // Patrol (Erratic)
                ant.x += ant.speed * ant.direction + Math.sin(frame * 0.1) * 3; 
                if (ant.x < ant.startX || ant.x > ant.endX) ant.direction *= -1;
                
                // Hover (Erratic & Vertical)
                ant.y = 300 + Math.sin(frame * 0.05) * 80 + Math.sin(frame * 0.15) * 40;

                // Attack
                ant.attackTimer = (ant.attackTimer || 0) - 1;
                if (ant.attackTimer <= 0) {
                    ant.attackTimer = 90; // Fast throws! (1.5s)
                    // Throw MINION ant
                    let throwDx = (player.x - ant.x) * 0.015;
                    // Cap speed (max 4.5, approx 2x walking speed)
                    if (throwDx > 4.5) throwDx = 4.5;
                    if (throwDx < -4.5) throwDx = -4.5;

                    surfaceWorld.ants.push({
                        x: ant.x + ant.width/2,
                        y: ant.y + ant.height + 10,
                        width: 30, height: 20,
                        speed: 0,
                        dx: throwDx, // Aim at player (capped)
                        dy: -8, // Arc up
                        type: 'thrown_minion', 
                        state: 'falling' 
                    });
                }

                // Collision
                if (player.x < ant.x + ant.width && player.x + player.width > ant.x &&
                    player.y < ant.y + ant.height && player.y + player.height > ant.y) {
                    
                    // Top Zone (Safe / Attack)
                    // Stomp if player feet are in the upper 95% of the Queen's hitbox
                    if (player.y + player.height < ant.y + ant.height * 0.95) {
                        // If falling (landing), deal damage and bounce
                        if (player.dy >= 0) {
                            if (ant.invulnerable > 0) {
                                player.dy = JUMP_FORCE * 1.2;
                            } else {
                                ant.hp--;
                                ant.invulnerable = 60;
                                player.dy = JUMP_FORCE * 1.2; // Mega Bounce
                                
                                // Queen Death Logic
                                if (ant.hp <= 0) {
                                    ant.state = 'falling_dead';
                                    ant.dy = 0; // Start falling
                                    score += 5000;
                                    effects.push({ x: ant.x, y: ant.y, text: "QUEEN DEFEATED!", life: 180 });
                                    // spawnHouseAnts(); // Removed
                                    // Drop Rewards
                                    surfaceWorld.items.push({ x: ant.x + ant.width/2, y: ant.y, width: 40, height: 40, type: 'crown', dy: -8 });
                                    surfaceWorld.items.push({ x: ant.x, y: ant.y, width: 30, height: 30, type: 'latte', dy: -6 });
                                    surfaceWorld.items.push({ x: ant.x + ant.width, y: ant.y, width: 30, height: 30, type: 'latte', dy: -6 });
                                } else {
                                    effects.push({ x: ant.x, y: ant.y, text: "HIT!", life: 60 });
                                }
                            }
                        }
                        // If jumping up through her (unlikely) or hovering, just push player up safely.
                        else {
                            player.y = ant.y + ant.height * 0.2 - player.height; // Push player up
                        }
                    } else {
                        // Hit from side/bottom -> Ouch
                        hurtPlayer();
                    }
                }
            }
        } else if (ant.state === 'projectile_return') {
            // Homing Missile Logic
            ant.x += ant.dx;
            ant.y += ant.dy;
            ant.rotation = (ant.rotation || 0) + 0.5; // Spin!

            // Hit Other Ants (Collateral Damage)
            for (let m = ants.length - 1; m >= 0; m--) {
                const victim = ants[m];
                if (victim !== ant && victim.type !== 'queen' && victim.state !== 'dead' && victim.state !== 'ground_dead' && victim.state !== 'falling_dead') {
                    if (ant.x < victim.x + victim.width && ant.x + ant.width > victim.x &&
                        ant.y < victim.y + victim.height && ant.y + ant.height > victim.y) {
                        
                        // Kill Both
                        ant.state = 'falling_dead';
                        ant.dx = 0;
                        ant.rotation = 0;
                        
                        victim.state = 'falling_dead';
                        victim.dy = -5; // Pop up
                        
                        effects.push({ x: ant.x, y: ant.y, text: "STRIKE!", life: 60 });
                        break;
                    }
                }
            }

            // Hit Queen?
            const queen = ants.find(a => a.type === 'queen');
            if (queen && ant !== queen && queen.state !== 'dead' && queen.state !== 'falling_dead' && queen.state !== 'ground_dead') {
                if (ant.x < queen.x + queen.width && ant.x + ant.width > queen.x &&
                    ant.y < queen.y + queen.height && ant.y + ant.height > queen.y) {
                    
                    // Kill projectile
                    ant.state = 'dead'; 
                    ant.life = 0; // Instant gone
                    
                    if (queen.invulnerable > 0) {
                        effects.push({ x: queen.x, y: queen.y, text: "BLOCK!", life: 30 });
                    } else {
                        queen.hp--;
                        queen.invulnerable = 60;
                        
                        if (queen.hp <= 0) {
                            queen.state = 'falling_dead';
                        queen.dy = 0;
                        score += 5000;
                        effects.push({ x: queen.x, y: queen.y, text: "HOUSE UNLOCKED!", life: 180 });
                        // spawnHouseAnts(); // Removed
                        
                        // Drop Rewards
                        surfaceWorld.items.push({ x: queen.x + queen.width/2, y: queen.y, width: 40, height: 40, type: 'crown', dy: -8 });
                        surfaceWorld.items.push({ x: queen.x, y: queen.y, width: 30, height: 30, type: 'latte', dy: -6 });
                        surfaceWorld.items.push({ x: queen.x + queen.width, y: queen.y, width: 30, height: 30, type: 'latte', dy: -6 });
                    } else {
                        effects.push({ x: queen.x, y: queen.y, text: "HIT!", life: 60 });
                    }
                    }
                }
            }
        } else {
            // Normal behavior (Walker/Flyer)
            
            // Random Death (DISABLED DEBUG)
            // const onscreen = ant.x > camera.x - 100 && ant.x < camera.x + canvas.width + 100;
            // if (onscreen && ant.state !== 'ground_dead' && ant.state !== 'falling_dead' && Math.random() > 0.999) {
            //      ant.state = 'falling_dead';
            //      ant.dy = 0;
            // }

            // Movement (Only if alive)
            if (ant.state !== 'ground_dead' && ant.state !== 'falling_dead') {
                ant.grounded = false;
                ant.x += (ant.dx !== undefined) ? ant.dx : (ant.speed * ant.direction);
                
                // Boss Arena Containment
                if (level === 3 && ant.type !== 'thrown_minion' && ant.state !== 'projectile_return') {
                    const arenaStart = LEVEL_WIDTH - 1200;
                    
                    if (ant.isMinion) {
                        // Keep INSIDE arena
                        if (ant.x < arenaStart) { ant.x = arenaStart; ant.direction = 1; }
                        if (ant.x > LEVEL_WIDTH - 50) { ant.x = LEVEL_WIDTH - 50; ant.direction = -1; }
                    } else {
                        // Keep OUTSIDE arena
                        if (ant.x > arenaStart - 50) { ant.x = arenaStart - 50; ant.direction = -1; }
                    }
                }
                
                if (ant.type === 'flyer') {
                    ant.y += Math.sin(frame * 0.1) * 2;
                    // Flyers float, no gravity
                } else {
                    // Walkers have gravity
                    ant.dy = (ant.dy || 0) + GRAVITY;
                    ant.y += ant.dy;
                }
                
                if (ant.x < 0 || ant.x + ant.width > limit) ant.direction *= -1;
            } else {
                // Dead/Falling Physics
                ant.dy = (ant.dy || 0) + GRAVITY;
                ant.y += ant.dy;
            }
            
            platforms.forEach(p => {
                if (p.color === 'caulk_line' || p.color === 'dark_hole') return; // Ignore

                if (ant.x < p.x + p.width &&
                    ant.x + ant.width > p.x &&
                    ant.y < p.y + p.height &&
                    ant.y + ant.height > p.y) {
                        
                        // Landing Logic (Alive Walkers or Dead Ants)
                        if ((ant.type !== 'flyer' || ant.state === 'falling_dead') && ant.dy > 0 && ant.y + ant.height - ant.dy <= p.y + 10) {
                            ant.y = p.y - ant.height;
                            ant.dy = 0;
                            ant.grounded = true;
                            if (ant.state === 'falling_dead') ant.state = 'ground_dead';
                            
                            if (ant.type === 'thrown_minion') {
                                ant.type = 'walker';
                                ant.state = undefined;
                                ant.isMinion = true; // Mark as Queen's minion to avoid cleanup
                                ant.speed = (2 + Math.random()) * 0.75;
                                ant.direction = Math.random() > 0.5 ? 1 : -1;
                                delete ant.dx;
                            }
                        }
                        // Turn around on wall/pipe hit (Side collision - Alive only)
                        else if (ant.state !== 'ground_dead' && ant.state !== 'falling_dead') {
                            if (p.type === 'pipe_body' || p.type === 'pipe_top' || (ant.type !== 'flyer' && !ant.grounded)) {
                                 ant.direction *= -1;
                                 ant.x += ant.speed * ant.direction * 2; // Bounce out
                            } else {
                                 ant.direction *= -1;
                                 ant.x += ant.speed * ant.direction;
                            }
                        }
                    }
            });

            
             // Remove if fell off map (if somehow missed floor)
            if (ant.y > 700) {
                ants.splice(i, 1);
            }
        }

        // Player Collision
        // 1. Pickup Dead Ant
        if (ant.state === 'ground_dead') {
            if (player.x < ant.x + ant.width && player.x + player.width > ant.x &&
                player.y < ant.y + ant.height && player.y + player.height > ant.y) {
                if (!player.holdingAnt) {
                    player.holdingAnt = ant.type || 'walker';
                    ants.splice(i, 1);
                    continue; // Skip rest
                }
            }
        }

        // 2. Active/Falling Ant Collision
        // falling_dead ants are dangerous!
        if (ant.state !== 'dead' && ant.state !== 'ground_dead' && ant.state !== 'projectile_return') {
            // Adjust hitbox for vertical crawlers
            let hitW = ant.width;
            let hitH = ant.height;
            if (ant.axis === 'y' && ant.state === 'crawling') {
                hitW = ant.height; // 20
                hitH = ant.width;  // 30
            }

            if (player.x < ant.x + hitW &&
                player.x + player.width > ant.x &&
                player.y < ant.y + hitH &&
                player.y + player.height > ant.y) {
                
                // TYPE 7: Falling Dead Ants
                if (ant.state === 'falling_dead') {
                    // Only Wall Ants (Crawlers) are dangerous when falling dead
                    if (ant.type === 'crawler' && Math.abs(ant.dy) > 2) hurtPlayer();
                    continue; 
                }

                // TYPE 2: Wall Ants (Crawlers) (Dangerous!)
                if (ant.type === 'crawler') {
                    hurtPlayer();
                    continue; 
                }

                // TYPES 3, 4, 6: Flyer, Walker, Floating (Stompable)
                // Hit Logic: Top 10% vs Bottom 90%
                const stompThreshold = ant.y + (ant.height || 20) * 0.1;
                const prevFeet = player.y + player.height - player.dy;
                const validStomp = (player.dy >= 0 && prevFeet <= stompThreshold + 5) || (player.y + player.height <= ant.y + 15);

                console.log(`COLLISION: Type=${ant.type} State=${ant.state} | Py=${Math.round(player.y)} Pdy=${player.dy.toFixed(2)} PrevFeet=${Math.round(prevFeet)} | Ay=${Math.round(ant.y)} Thresh=${Math.round(stompThreshold)} | Stomp=${validStomp}`);

                if (validStomp) {
                    console.log("-> RESULT: STOMP SUCCESS");
                    if (ant.type === 'thrown_minion') {
                        ant.state = 'ground_dead'; 
                    } else {
                        ant.state = 'falling_dead'; 
                        ant.dy = 0;
                    }
                    player.dy = JUMP_FORCE / 1.5;
                } else {
                    console.log("-> RESULT: HURT PLAYER");
                    hurtPlayer();
                }
            }
        }
    }
    
    if (player.invulnerable > 0) player.invulnerable--;
    
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        item.dy += GRAVITY;
        item.y += item.dy;
        
        if (player.x < item.x + item.width &&
            player.x + player.width > item.x &&
            player.y < item.y + item.height &&
            player.y + player.height > item.y) {
                
            if (item.type === 'pedicure_token') {
                score += 5; 
                effects.push({ x: player.x, y: player.y - 20, text: "+$5", life: 30 });
            } else if (item.type === 'latte') {
                if (player.isBig) {
                    player.hasExterminatorSuit = true;
                    effects.push({ x: player.x, y: player.y - 40, text: "EXTERMINATOR!", life: 60 });
                } else {
                    player.isBig = true;
                    player.width = 60; 
                    player.height = 60;
                    player.y -= 30; 
                    effects.push({ x: player.x, y: player.y - 40, text: "BIG MERV!", life: 60 });
                }
            } else if (item.type === 'soap_bar') {
                player.invincibleTimer = 600; // 10 seconds
                effects.push({ x: player.x, y: player.y - 40, text: "SOAP POWER!", life: 60 });
            } else if (item.type === 'crown') {
                player.hasCrown = true;
                score += 10000;
                effects.push({ x: player.x, y: player.y - 60, text: "ALL HAIL QUEEN MERV!", life: 300 });
            }
            items.splice(i, 1);
        }
        
        platforms.forEach(p => {
             if (item.x < p.x + p.width &&
                item.x + item.width > p.x &&
                item.y < p.y + p.height &&
                item.y + item.height > p.y) {
                     if (item.dy > 0) {
                         item.y = p.y - item.height;
                         item.dy = 0;
                     }
                }
        });
    }
    
    // Decrease Shoot Timer
    if (player.shootTimer > 0) player.shootTimer--;

    // Projectiles (Mist Clouds)
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.life--;
        
        if (p.life <= 0) {
            projectiles.splice(i, 1);
            continue;
        }
        
        // Ant Collision
        for (let j = ants.length - 1; j >= 0; j--) {
            let ant = ants[j];
            if (ant.state !== 'dead' && ant.state !== 'ground_dead' && ant.state !== 'falling_dead') {
                if (p.x < ant.x + ant.width && 
                    p.x + p.width > ant.x && 
                    p.y < ant.y + ant.height && 
                    p.y + p.height > ant.y) {
                    
                    if (ant.type === 'queen') {
                        // Poison ineffective!
                        ant.isUpset = 30; 
                    } else {
                        ant.state = 'falling_dead';
                        ant.dy = -2; // Pop up
                    }
                }
            }
        }
    }
    
    // Final Absolute Floor Constraint (Nuclear Fix)
    if (level === 3 && player.x > 8300 && player.y >= 520) {
        // console.log("AbsFloor TRIGGERED. y=" + player.y);
        player.y = 520;
        player.dy = 0;
        player.grounded = true;
    } else if (level === 3 && player.x > 8300 && player.y > 520) {
         console.log("AbsFloor FAILED condition. y=" + player.y);
    }

    for (let i = effects.length - 1; i >= 0; i--) {
        effects[i].y -= 1; 
        effects[i].life--;
        if (effects[i].life <= 0) effects.splice(i, 1);
    }
}

function drawHills() {
    ctx.save();
    // Parallax: Move slower than camera
    ctx.translate(-camera.x * 0.2, 0);
    
    // Draw rolling hills
    ctx.fillStyle = '#228B22'; // Forest Green
    ctx.beginPath();
    // Simple sine wave hills
    ctx.moveTo(0, 600);
    for(let x=0; x<LEVEL_WIDTH + 1000; x+=50) {
        let y = 450 + Math.sin(x * 0.005) * 100;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(LEVEL_WIDTH + 1000, 600);
    ctx.fill();
    
    // Hill highlight/rim
    ctx.strokeStyle = '#32CD32';
    ctx.lineWidth = 5;
    ctx.stroke();
    
    ctx.restore();
}

function drawHouseInterior() {
    if (level !== 3) return;
    const houseX = LEVEL_WIDTH + 200;
    
    // Furniture inside house (Background layer)
    // Fireplace
    ctx.fillStyle = '#8B4513'; // Brick
    ctx.fillRect(houseX + 400, 450, 100, 100);
    ctx.fillStyle = 'black'; // Opening
    ctx.fillRect(houseX + 420, 500, 60, 50);
    // Fire flicker
    ctx.fillStyle = 'orange';
    const flicker = Math.sin(frame * 0.2) * 5;
    ctx.beginPath();
    ctx.moveTo(houseX + 430, 550);
    ctx.lineTo(houseX + 450, 510 + flicker);
    ctx.lineTo(houseX + 470, 550);
    ctx.fill();
    
    // Chair
    ctx.fillStyle = '#A52A2A'; // Red Chair
    ctx.fillRect(houseX + 200, 480, 60, 70); // Back
    ctx.fillRect(houseX + 200, 520, 80, 30); // Seat
    ctx.fillStyle = '#8B0000';
    ctx.fillRect(houseX + 200, 550, 10, 20); // Leg
    ctx.fillRect(houseX + 270, 550, 10, 20); // Leg
    
    // Table
    ctx.fillStyle = '#DEB887'; // Wood
    ctx.fillRect(houseX + 600, 500, 100, 10); // Top
    ctx.fillRect(houseX + 610, 510, 10, 40); // Leg
    ctx.fillRect(houseX + 680, 510, 10, 40); // Leg
    // Lamp or Flower on table
    ctx.fillStyle = 'green'; ctx.fillRect(houseX + 640, 480, 5, 20);
    ctx.fillStyle = 'pink'; ctx.beginPath(); ctx.arc(houseX + 642, 480, 10, 0, Math.PI*2); ctx.fill();

    // Roof Text
    ctx.fillStyle = 'black';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText("Merv's House", houseX + 400, 320);
}

function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0); 
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'START') {
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = 'black';
        ctx.textAlign = 'center';
        ctx.font = 'bold 50px Courier New';
        ctx.fillText("ANTAGONIZED", canvas.width/2, 200);
        ctx.font = '30px Courier New';
        ctx.fillText("Ants Invade", canvas.width/2, 250);
        ctx.fillStyle = 'red';
        ctx.font = '20px Arial';
        ctx.fillText("Press ENTER to Start", canvas.width/2, 400);
        return;
    }

    if (inShower) {
        ctx.fillStyle = '#e0f7fa'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#b2ebf2';
        ctx.lineWidth = 1;
        const offset = Math.floor(camera.x) % 40;
        ctx.beginPath();
        for(let x = -offset; x < canvas.width; x+=40) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
        for(let y = 0; y < canvas.height; y+=40) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
        ctx.stroke();
    } else {
        // SNES Sky Gradient
        let grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, "#4facfe"); // Deep Blue top
        grad.addColorStop(1, "#00f2fe"); // Cyan bottom
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        drawHills();

        // Draw Clouds (Parallax-ish)
        ctx.save();
        ctx.translate(-camera.x * 0.5, 0); // Slower scroll
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        clouds.forEach(c => {
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.size, 0, Math.PI*2);
            ctx.arc(c.x + c.size*0.5, c.y - c.size*0.2, c.size*0.8, 0, Math.PI*2);
            ctx.fill();
        });
        ctx.restore();
    }

    ctx.save();
    ctx.translate(-camera.x, 0);

    drawHouseInterior();

    let platforms = inShower ? showerWorld.platforms : surfaceWorld.platforms;
    let items = inShower ? showerWorld.items : surfaceWorld.items;
    let ants = inShower ? showerWorld.ants : surfaceWorld.ants;

    // Optimization: Only draw onscreen objects
    platforms.forEach(platform => {
        if (platform.x + platform.width > camera.x && platform.x < camera.x + canvas.width) drawPlatform(platform);
    });
    items.forEach(item => {
        if (item.x + item.width > camera.x && item.x < camera.x + canvas.width) drawItem(item);
    });
    ants.forEach(ant => {
        if (ant.x + ant.width > camera.x && ant.x < camera.x + canvas.width) drawAnt(ant);
    });
    
    // Projectiles (Mist)
    projectiles.forEach(p => {
        ctx.fillStyle = `rgba(50, 205, 50, ${p.life / 60 * 0.5})`; 
        for(let k=0; k<10; k++) { 
             let px = p.x + Math.random() * p.width;
             let py = p.y + Math.random() * p.height;
             let size = 10 + Math.random() * 20;
             ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI*2); ctx.fill();
        }
    });
    
    if (inShower) {
        ctx.fillStyle = 'rgba(0, 0, 255, 0.5)';
        waterParticles.forEach(p => {
            ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill();
        });
    } else {
        ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
        dustParticles.forEach(p => {
            ctx.fillRect(p.x, p.y, p.size, p.size);
        });
    }

    effects.forEach(eff => {
        ctx.fillStyle = '#00FF00';
        ctx.font = 'bold 20px Arial';
        ctx.fillText(eff.text, eff.x, eff.y);
    });

    drawPlayer(player);
    
    // DEBUG: Hitboxes & Stomp Boxes
    if (debugMode) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'magenta';
        // Vulnerable Zone (Top to Hands)
        ctx.strokeRect(player.x, player.y, player.width, 15);
        
        // Attack Zone (Hands to Below Feet)
        ctx.strokeStyle = '#00FF00'; // Bright Green
        ctx.strokeRect(player.x, player.y + 15, player.width, 20);
        
        ants.forEach(ant => {
            let hitW = ant.width;
            let hitH = ant.height;
            if (ant.axis === 'y' && ant.state === 'crawling') {
                hitW = ant.height;
                hitH = ant.width;
            }
            ctx.strokeStyle = 'magenta';
            ctx.strokeRect(ant.x, ant.y, hitW, hitH);
            
            // DEBUG: Stomp Line (Top 10%)
            ctx.strokeStyle = 'cyan'; 
            ctx.beginPath(); 
            ctx.moveTo(ant.x, ant.y + (hitH * 0.1)); 
            ctx.lineTo(ant.x + hitW, ant.y + (hitH * 0.1)); 
            ctx.stroke();
        });
    }

    ctx.restore();
    
    // HUD
    ctx.fillStyle = inShower ? 'black' : 'white';
    ctx.font = 'bold 20px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText(`Self Care Fund: $${score}`, 20, 30);
    ctx.fillText(`LIVES: ${lives}`, 320, 30); // Adjusted x pos
    ctx.fillText(`TIME: ${time}`, 450, 30);
    ctx.fillText(`LEVEL: ${level}`, 580, 30);
    if (inShower) ctx.fillText("SHOWER MODE", 20, 60);
    
    if (gameState === 'GAME_OVER') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'red';
        ctx.textAlign = 'center';
        ctx.font = '40px Arial';
        ctx.fillText("GAME OVER", canvas.width/2, canvas.height/2);
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.fillText(`Self Care Fund: $${score}`, canvas.width/2, canvas.height/2 + 40);
        ctx.fillText("Press SPACE to Menu", canvas.width/2, canvas.height/2 + 80);
    } 

    if (gameState === 'VICTORY') {
        // Happy Home Background
        ctx.fillStyle = '#87CEEB'; // Sky
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#228B22'; // Grass
        ctx.fillRect(0, 450, canvas.width, 150);
        
        const cx = canvas.width/2;
        const cy = canvas.height/2;

        // Clean House
        ctx.fillStyle = '#A0522D'; // Wood
        ctx.fillRect(cx - 100, 300, 200, 150);
        ctx.fillStyle = '#8B0000'; // Roof
        ctx.beginPath(); ctx.moveTo(cx - 120, 300); ctx.lineTo(cx, 200); ctx.lineTo(cx + 120, 300); ctx.fill();
        ctx.fillStyle = '#ADD8E6'; // Window
        ctx.fillRect(cx - 60, 350, 40, 40);
        ctx.fillRect(cx + 20, 350, 40, 40);

        // Queen Merv (Jumping for Joy)
        const oldX = player.x; const oldY = player.y; const oldFacing = player.facing;
        player.x = cx - 150; 
        player.y = 450 - player.height - Math.abs(Math.sin(frame * 0.1) * 50); // Jumping
        player.facing = 1;
        drawPlayer(player);
        player.x = oldX; player.y = oldY; player.facing = oldFacing; // Restore

        // Text
        ctx.fillStyle = '#FFD700';
        ctx.textAlign = 'center';
        ctx.font = 'bold 40px Courier New';
        ctx.fillText("ANT FREE HOME!", cx, 100);
        ctx.font = '30px Courier New';
        ctx.fillText("ALL HAIL QUEEN MERV!", cx, 150);
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.fillText(`Final Score: $${score}`, cx, 550);
        ctx.fillText("Press SPACE to Restart", cx, 580);
    }
    // DEBUG OVERLAY (Global)
    if (debugMode) {
        ctx.fillStyle = 'magenta';
        ctx.font = '16px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`Lvl: ${level} Pos: ${Math.round(player.x)},${Math.round(player.y)}  Grounded: ${player.grounded} AbsFloor: ${(level === 3 && player.x > 8700 && player.y >= 520)}`, 10, canvas.height - 20);
    }
}

function drawPlayer(p) {
    if (p.invulnerable > 0 && Math.floor(frame / 4) % 2 === 0) return; 

    ctx.save();
    ctx.translate(p.x + p.width/2, p.y + p.height/2 - 5); // Shift up for larger sprite
    
    // Rainbow Effect
    if (p.invincibleTimer > 0) {
        let hue = (frame * 10) % 360;
        ctx.filter = `hue-rotate(${hue}deg)`;
    }

    const scale = p.width / 24; // 1.25x larger
    ctx.scale(scale, scale);

    if (p.facing === -1) ctx.scale(-1, 1);

    // Animation state
    const isMoving = Math.abs(p.dx) > 0.1;
    const legAngle = isMoving ? Math.sin(frame * 0.5) * 0.5 : 0;
    const armAngle = isMoving ? Math.cos(frame * 0.16) * 0.16 : 0; // Fixed prev replacement

    // Colors
    const bodyColor = p.hasExterminatorSuit ? 'white' : '#4169E1';
    const shirtColor = p.hasExterminatorSuit ? 'white' : '#32CD32';

    // Hair Background (Drawn first so it's behind body/neck)
    // ... (Keep existing hair code) ...
    ctx.fillStyle = '#b8860b'; // Darker Dirty Blonde
    ctx.beginPath();
    ctx.arc(-6, -14, 5, 0, Math.PI*2); // Ponytail
    ctx.fill();

    ctx.fillStyle = '#d4af37'; // Main Hair Color
    // Draw a longer, fuller bob behind the face
    ctx.beginPath();
    ctx.roundRect(-11, -22, 22, 22, 5); // Rounded rectangle hair mass
    ctx.fill();

    // Backpack (Exterminator)
    if (p.hasExterminatorSuit) {
        ctx.fillStyle = '#f0f0f0'; // White pack
        ctx.fillRect(-12, -10, 6, 15);
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ctx.strokeRect(-12, -10, 6, 15);
    }

    // Legs
    ctx.fillStyle = 'brown'; // Boots
    ctx.save();
    ctx.translate(-5, 10);
    ctx.rotate(legAngle);
    ctx.fillRect(-3, 0, 6, 12);
    ctx.restore();
    
    ctx.save();
    ctx.translate(5, 10);
    ctx.rotate(-legAngle);
    ctx.fillRect(-3, 0, 6, 12);
    ctx.restore();

    // Body (Overalls)
    ctx.fillStyle = bodyColor;
    ctx.fillRect(-7, 0, 14, 12);
    
    // Shirt
    ctx.fillStyle = shirtColor;
    
    // Left Arm
    ctx.save();
    ctx.translate(-8, -2);
    ctx.rotate(-armAngle);
    ctx.fillRect(-3, 0, 6, 10);
    ctx.fillStyle = '#ffe0bd'; // Hand
    ctx.fillRect(-3, 10, 6, 4);
    ctx.restore();

    // Body (Upper Shirt)
    ctx.fillStyle = shirtColor;
    ctx.fillRect(-6, -5, 12, 10);
    
    // Right Arm
    ctx.save();
    ctx.translate(8, -2);
    
    let rArmRot = armAngle;
    if (p.shootTimer > 0) rArmRot = 0.5; 
    
    ctx.rotate(rArmRot);
    ctx.fillStyle = shirtColor;
    ctx.fillRect(-3, 0, 6, 10);
    ctx.fillStyle = '#ffe0bd'; // Hand
    ctx.fillRect(-3, 10, 6, 4);
    
    // Wand (Exterminator)
    if (p.hasExterminatorSuit) {
        ctx.fillStyle = '#888'; // Grey Wand
        ctx.fillRect(-2, 12, 4, 10); // Handle
        ctx.fillRect(-2, 22, 10, 4); // Nozzle
        ctx.fillStyle = '#32CD32'; // Green tip
        ctx.fillRect(6, 21, 3, 6);
    }
    
    ctx.restore();

    // HEAD
    // ... (rest is same) ...
    
    // Neck (Drawn after hair so it's visible)
    ctx.fillStyle = '#ffe0bd';
    ctx.fillRect(-3, -10, 6, 6);

    // 2. Skin Head (Face) - Same color as hands
    ctx.fillStyle = '#ffe0bd'; 
    ctx.beginPath();
    ctx.arc(0, -16, 9, 0, Math.PI*2);
    ctx.fill();
    
    // 3. Front Hair (High Bangs/Fringe)
    ctx.fillStyle = '#d4af37';
    ctx.beginPath();
    ctx.arc(0, -18, 10, Math.PI * 1.1, Math.PI * 1.9); // Higher top cap
    ctx.quadraticCurveTo(0, -17, -10, -19); // Shallower bangs curve, higher up
    ctx.fill();
    
    // 4. Face Details
    ctx.fillStyle = 'black';
    if (gameState === 'PLAYER_DYING') {
         // Shocked Face
         ctx.beginPath(); ctx.arc(2, -16, 2.5, 0, Math.PI*2); ctx.fill(); // Left Eye (Wide)
         ctx.beginPath(); ctx.arc(6, -16, 2.5, 0, Math.PI*2); ctx.fill(); // Right Eye (Wide)
         
         // O Mouth
         ctx.strokeStyle = 'black'; 
         ctx.fillStyle = 'black'; 
         ctx.beginPath();
         ctx.arc(4, -10, 2, 0, Math.PI*2);
         ctx.fill();
    } else {
        // Normal Face
        ctx.beginPath(); 
        ctx.arc(2, -16, 1.5, 0, Math.PI*2); // Left Eye
        ctx.arc(6, -16, 1.5, 0, Math.PI*2); // Right Eye
        ctx.fill();
        
        ctx.fillStyle = '#ffb6c1'; // Blush
        ctx.beginPath(); ctx.arc(5, -13, 2, 0, Math.PI*2); ctx.fill();
        
        // Smile
        ctx.strokeStyle = '#b35a5a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(3, -12, 3, 0.2, Math.PI - 0.2);
        ctx.stroke();
    }

    // Queen Merv Crown
    if (p.hasCrown) {
        ctx.fillStyle = '#FFD700'; // Gold
        ctx.beginPath();
        ctx.moveTo(-10, -20);
        ctx.lineTo(10, -20);
        ctx.lineTo(10, -35);
        ctx.lineTo(5, -25);
        ctx.lineTo(0, -40);
        ctx.lineTo(-5, -25);
        ctx.lineTo(-10, -35);
        ctx.fill();
    }

    // Holding Ant (Ammo)
    if (p.holdingAnt) {
        ctx.save();
        ctx.translate(12 * p.facing, 5); // In hand
        let s = 0.8;
        if (p.holdingAnt === 'queen') s = 2.0; 
        ctx.scale(s * p.facing, -s); // Upside down, facing forward
        // Simple Ant
        ctx.fillStyle = '#5D4037';
        ctx.beginPath(); ctx.arc(-8, 0, 6, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(6, 0, 4, 0, Math.PI*2); ctx.fill();
        // Legs
        ctx.strokeStyle = '#2d1e18'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-12, 10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(10, 10); ctx.stroke();
        ctx.restore();
    }

    ctx.restore();
}

function drawAnt(ant) {
    ctx.save();
    ctx.translate(ant.x + ant.width/2, ant.y + ant.height/2);
    
    // DEBUG: Ant Type/State
    if (debugMode) {
        ctx.fillStyle = 'magenta';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText((ant.type || 'walker') + " / " + (ant.state || 'active'), 0, -30);
    }
    
    // Rotation (Projectiles)
    if (ant.rotation) ctx.rotate(ant.rotation);
    
    if (ant.state === 'dead') {
         ctx.globalAlpha = ant.life / 100;
         ctx.scale(1, -1); 
    } else if (ant.state === 'ground_dead' || ant.state === 'falling_dead') {
         ctx.globalAlpha = 1;
         ctx.scale(1, -1); 
    }

    // Handle Rotation for Wall Crawling
    if (ant.state === 'crawling') {
        if (ant.axis === 'y') {
            ctx.rotate(ant.direction === 1 ? Math.PI / 2 : -Math.PI / 2);
        } else {
            if (ant.direction === -1) ctx.scale(-1, 1);
        }
        // Add a creepy little jitter/wobble
        ctx.rotate(Math.sin(frame * 0.2) * 0.05);
    } else if (ant.direction === -1) {
        ctx.scale(-1, 1);
    }
    
    if (ant.type === 'queen' && ant.state !== 'projectile_return') {
        if (ant.isUpset > 0) ant.isUpset--;

        // Wings (Back)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath(); ctx.ellipse(10, -30, 40, 15, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(10, -30, 40, 15, 0.2, 0, Math.PI * 2); ctx.fill();

        // Legs
        ctx.strokeStyle = '#2d1e18';
        ctx.lineWidth = 4;
        const legW = Math.sin(frame * 0.1) * 5;
        // Front
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(30, 20); ctx.lineTo(40 + legW, 40); ctx.stroke();
        // Mid
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 30); ctx.lineTo(0 + legW, 50); ctx.stroke();
        // Back
        ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-30, 20); ctx.lineTo(-40 - legW, 40); ctx.stroke();

        // Giant Queen Body
        const drawSegment = (x, y, r, color) => {
            let grad = ctx.createRadialGradient(x-5, y-5, 2, x, y, r);
            let c1 = color || '#5D4037';
            let c2 = '#3E2723';
            
            if (ant.isUpset > 0) { // Angry Red
                c1 = '#FF0000';
                c2 = '#8B0000';
            }

            grad.addColorStop(0, c1); 
            grad.addColorStop(1, c2); 
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
        };
        
        drawSegment(-30, 0, 35, '#4a2c2a'); // Abdomen
        drawSegment(0, -10, 25);   // Thorax
        drawSegment(30, -20, 25);  // Head
        
        // Face
        ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(40, -25, 8, 0, Math.PI*2); ctx.fill(); // Eye
        ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(42, -25, 3, 0, Math.PI*2); ctx.fill(); // Pupil
        
        // Crown (if alive)
        if (ant.hp > 0) {
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.moveTo(15, -40);
            ctx.lineTo(45, -40);
            ctx.lineTo(45, -60);
            ctx.lineTo(35, -50);
            ctx.lineTo(30, -65);
            ctx.lineTo(25, -50);
            ctx.lineTo(15, -60);
            ctx.fill();
        }
        
        ctx.restore();
        return;
    }
    
    // 3D Segments helper
    const drawSegment = (x, y, r) => {
        let grad = ctx.createRadialGradient(x-2, y-2, 1, x, y, r);
        grad.addColorStop(0, '#5D4037'); 
        grad.addColorStop(1, '#3E2723'); 
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI*2);
        ctx.fill();
    };

    if (ant.type === 'queen' && ant.state === 'projectile_return') {
        ctx.scale(2.5, 2.5);
    }
    
    if (ant.isQueenProjectile) {
        ctx.scale(5, 5);
    }

    // Legs (Improved elbow joints)
    if (ant.state !== 'dead' && ant.state !== 'ground_dead') {
        ctx.strokeStyle = '#2d1e18';
        ctx.lineWidth = 2;
        const legWiggle = Math.sin(frame * 0.8) * 3;
        
        // Helper for elbowed leg
        const drawLeg = (startX, startY, endX, endY, reverse) => {
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            // Knee/Elbow joint (higher than start/end)
            let midX = (startX + endX) / 2;
            let midY = Math.min(startY, endY) - 5; 
            ctx.lineTo(midX, midY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        };

        // All legs attach to Thorax (0,0)
        drawLeg(2, 0, 10 + legWiggle, 10, false); // Front
        drawLeg(0, 0, 0, 12 - legWiggle, false);   // Mid
        drawLeg(-2, 0, -10 - legWiggle, 10, false); // Back
    }

    // Body
    drawSegment(-10, 0, 7); // Abdomen
    drawSegment(0, 0, 5);   // Thorax
    drawSegment(8, -2, 5);  // Head
    
    // Face
    ctx.fillStyle = 'white';
    ctx.beginPath(); ctx.arc(10, -4, 2, 0, Math.PI*2); ctx.fill(); // Eye
    ctx.fillStyle = 'black';
    ctx.beginPath(); ctx.arc(11, -4, 1, 0, Math.PI*2); ctx.fill(); // Pupil
    
    // Angry Brow
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(8, -7);
    ctx.lineTo(12, -5);
    ctx.stroke();
    
    // Antennae
    ctx.strokeStyle = '#3E2723';
    ctx.beginPath();
    ctx.moveTo(10, -6); ctx.lineTo(14, -12);
    ctx.stroke();

    // Draw wings if flyer, falling, or in the air (not grounded)
    if (ant.type === 'flyer' || ant.state === 'falling' || (!ant.grounded && ant.state !== 'ground_dead' && ant.type !== 'crawler')) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.8)';
        ctx.lineWidth = 1;
        ctx.save();
        ctx.translate(0, -5);
        ctx.rotate(Math.sin(frame * 0.8) * 0.5);
        ctx.beginPath(); ctx.ellipse(0, -8, 4, 10, 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
}

function drawPlatform(p) {
    if (p.width === 3000) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 5;
        ctx.strokeRect(p.x, p.y, p.width, p.height);
    }

    if (p.color === 'caulk_line') {
        ctx.fillStyle = '#f5f5f5'; // Bright white caulk
        ctx.fillRect(p.x, p.y, p.width, p.height);
        // Add vertical texture lines
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x + 10, p.y); ctx.lineTo(p.x + 10, p.y + p.height);
        ctx.moveTo(p.x + 30, p.y); ctx.lineTo(p.x + 30, p.y + p.height);
        ctx.stroke();
        return;
    }
    if (p.color === 'dark_hole') {
        ctx.fillStyle = '#050505'; // Near black
        // Irregular shape using multiple ellipses
        for(let i=0; i<3; i++) {
            ctx.beginPath();
            let ox = (i-1) * 3;
            let oy = (i-1) * 2;
            ctx.ellipse(p.x + p.width/2 + ox, p.y + p.height/2 + oy, p.width/2 - i*2, p.height/2 - i*1, (frame*0.01*i), 0, Math.PI*2);
            ctx.fill();
        }
        // Gooey rim
        ctx.strokeStyle = '#2d1e18';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(p.x + p.width/2, p.y + p.height/2, p.width/2 + 2, p.height/2 + 2, 0, 0, Math.PI*2);
        ctx.stroke();
        return;
    }

    if (p.type === 'flagpole') {
        ctx.fillStyle = '#C0C0C0';
        ctx.fillRect(p.x, p.y, p.width, p.height);
        ctx.fillStyle = '#gold'; // Ball on top
        ctx.beginPath(); ctx.arc(p.x + p.width/2, p.y, 10, 0, Math.PI*2); ctx.fill();
        return;
    }
    if (p.type === 'flag') {
        ctx.fillStyle = '#FF4500'; // Bright Red
        ctx.beginPath();
        const wave = Math.sin(frame * 0.15) * 5;
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.width, p.y + 20 + wave); // Tip of triangle
        ctx.lineTo(p.x, p.y + 40);
        ctx.fill();
        return;
    }

    if (p.type === 'pipe_top' || p.type === 'pipe_body') {
        // Gradient Pipe
        let grad = ctx.createLinearGradient(p.x, 0, p.x + p.width, 0);
        grad.addColorStop(0, '#006400');
        grad.addColorStop(0.2, '#32CD32'); // Highlight
        grad.addColorStop(0.5, '#008000');
        grad.addColorStop(1, '#004400');
        
        ctx.fillStyle = grad;
        ctx.fillRect(p.x, p.y, p.width, p.height);
        
        ctx.strokeStyle = '#004400';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, p.width, p.height);
        
        // Pipe Top Lip
        if (p.type === 'pipe_top') {
            ctx.fillStyle = '#005500';
            ctx.fillRect(p.x + 5, p.y + p.height - 5, p.width - 10, 5); // Dark band
        }
        return;
    }
    
    if (p.color === 'tile_blue' || p.color === 'tile_white') {
        // ... (Keep existing tile logic)
        ctx.fillStyle = p.color === 'tile_blue' ? '#81d4fa' : '#ffffff';
        ctx.fillRect(p.x, p.y, p.width, p.height);
        ctx.strokeStyle = '#4fc3f7'; ctx.lineWidth = 1;
        ctx.strokeRect(p.x, p.y, p.width, p.height);
        ctx.beginPath();
        for(let tx=20; tx<p.width; tx+=20) { ctx.moveTo(p.x+tx, p.y); ctx.lineTo(p.x+tx, p.y+p.height); }
        for(let ty=20; ty<p.height; ty+=20) { ctx.moveTo(p.x, p.y+ty); ctx.lineTo(p.x+p.width, p.y+ty); }
        ctx.stroke();
        return;
    }

    if (p.color === 'white' || p.color === 'red') {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.width, p.height);
        return;
    }
    
    // Beveled Blocks (Ground, Bricks, Gold)
    let mainColor = p.color;
    let lightColor, darkColor;
    
    if (p.color.includes('gold') || p.color === '#b8860b') {
        mainColor = '#FFD700'; // Gold
        lightColor = '#FFFFE0';
        darkColor = '#DAA520';
        if (p.color === '#b8860b') mainColor = '#cd853f'; // Used box
    } else if (p.color === 'green') { // Grass
        mainColor = '#8B4513'; // Dirt body
        lightColor = '#A0522D';
        darkColor = '#5a2d0c';
    } else { // Brick/Brown
        mainColor = '#A0522D';
        lightColor = '#CD853F';
        darkColor = '#8B4513';
    }

    ctx.fillStyle = mainColor;
    ctx.fillRect(p.x, p.y, p.width, p.height);
    
    // Bevels
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + p.height);
    ctx.lineTo(p.x, p.y);
    ctx.lineTo(p.x + p.width, p.y);
    ctx.strokeStyle = lightColor;
    ctx.lineWidth = 4;
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(p.x + p.width, p.y);
    ctx.lineTo(p.x + p.width, p.y + p.height);
    ctx.lineTo(p.x, p.y + p.height);
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Specific Details
    if (p.color === 'green') { // Grass Top
        ctx.fillStyle = '#228B22';
        ctx.fillRect(p.x, p.y, p.width, 10);
        ctx.fillStyle = '#32CD32'; // Grass highlight
        for(let i=0; i<p.width; i+=10) ctx.fillRect(p.x+i, p.y, 5, 2);
    } 
    else if (p.color.includes('gold') || p.color === '#b8860b') { // Box details
        ctx.fillStyle = 'black';
        ctx.fillRect(p.x+2, p.y+2, 2, 2);
        ctx.fillRect(p.x+36, p.y+2, 2, 2);
        ctx.fillRect(p.x+2, p.y+36, 2, 2);
        ctx.fillRect(p.x+36, p.y+36, 2, 2);
        if (p.active) {
            ctx.fillStyle = 'black';
            ctx.font = 'bold 20px Arial';
            ctx.fillText("?", p.x + 13, p.y + 28);
        }
    } else { // Brick texture
        ctx.strokeStyle = darkColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for(let i=0; i<p.height; i+=20) { ctx.moveTo(p.x, p.y + i); ctx.lineTo(p.x + p.width, p.y + i); }
        for(let i=0; i<p.width; i+=20) { for(let j=0; j<p.height; j+=20) {
            let offset = (j % 40 === 0) ? 0 : 10;
            if (i+offset < p.width) { ctx.moveTo(p.x + i + offset, p.y + j); ctx.lineTo(p.x + i + offset, p.y + j + 20); }
        }}
        ctx.stroke();
    }
}

function drawItem(item) {
    ctx.save();
    ctx.translate(item.x + item.width/2, item.y + item.height/2);
    if (item.type === 'latte') {
        // Cup Body
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.moveTo(-8, -10);
        ctx.lineTo(8, -10);
        ctx.lineTo(6, 10);
        ctx.lineTo(-6, 10);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Brown Lid/Coffee top
        ctx.fillStyle = '#6F4E37'; // Coffee brown
        ctx.fillRect(-9, -12, 18, 4);
        
        // Logo dot (Starbucks-esque)
        ctx.fillStyle = '#00704A'; 
        ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.fill();
    } else if (item.type === 'crown') {
        ctx.fillStyle = '#FFD700'; // Gold
        ctx.strokeStyle = '#DAA520';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-15, 10);
        ctx.lineTo(15, 10);
        ctx.lineTo(15, -10);
        ctx.lineTo(5, 0);
        ctx.lineTo(0, -15);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-15, -10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    } else if (item.type === 'soap_bar') {
        ctx.fillStyle = '#ffc0cb'; // Pink soap
        ctx.fillRect(-10, -5, 20, 10);
        ctx.strokeStyle = 'white'; ctx.lineWidth = 1; ctx.strokeRect(-10, -5, 20, 10);
        ctx.fillStyle = 'white'; ctx.font = '8px Arial'; ctx.fillText("SOAP", 0, 3);
    } else {
        ctx.fillStyle = '#FFD700'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#DAA520'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#DAA520'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText("$", 0, 1);
    }
    ctx.restore();
}

function gameLoop(timestamp) {
    try {
        if (!lastTime) lastTime = timestamp;
        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;

        accumulator += deltaTime;

        // Prevent spiral of death if the game runs too slowly
        if (accumulator > 1000) accumulator = 1000;

        while (accumulator >= TIME_STEP) {
            update();
            accumulator -= TIME_STEP;
        }
        
        draw();
        requestAnimationFrame(gameLoop);
    } catch (e) {
        ctx.fillStyle = 'red';
        ctx.font = '12px monospace';
        ctx.fillText("Runtime Error: " + e.message, 10, 20);
        // Split stack by newlines and print
        if (e.stack) {
            const lines = e.stack.split('\n');
            for (let i = 0; i < lines.length && i < 20; i++) {
                ctx.fillText(lines[i], 10, 40 + i * 15);
            }
        }
        console.error(e);
    }
}

function spawnHouseAnts() {
    const houseX = LEVEL_WIDTH + 200; // Correct house start
    // Infestation!
    for(let i=0; i<20; i++) {
        surfaceWorld.ants.push({
            x: 10155 + Math.random() * 50 - 25, // Spawn at 10155 (with slight jitter)
            y: 500,
            width: 30, height: 20,
            speed: (2 + Math.random() * 3) * 0.75,
            direction: Math.random() > 0.5 ? 1 : -1
            // Default type (walking ant)
        });
    }
}

try {
    requestAnimationFrame(gameLoop);
} catch (e) {
    ctx.fillStyle = 'red';
    ctx.font = '20px Arial';
    ctx.fillText("Startup Error: " + e.message, 10, 50);
    console.error(e);
}

// Mobile Controls Logic
function setupMobileControls() {
    const buttons = document.querySelectorAll('#mobile-controls button');
    
    const keyMap = {
        'ArrowLeft': { code: 'ArrowLeft', key: 'ArrowLeft' },
        'ArrowRight': { code: 'ArrowRight', key: 'ArrowRight' },
        'ArrowUp': { code: 'ArrowUp', key: 'ArrowUp' },
        'ArrowDown': { code: 'ArrowDown', key: 'ArrowDown' },
        'Space': { code: 'Space', key: ' ' },
        'Enter': { code: 'Enter', key: 'Enter' },
        'Shift': { code: 'ShiftLeft', key: 'Shift' }
    };

    buttons.forEach(btn => {
        const dataKey = btn.getAttribute('data-key');
        if (!dataKey || !keyMap[dataKey]) return;
        
        const { code, key } = keyMap[dataKey];

        const triggerKey = (eventType) => {
            const event = new KeyboardEvent(eventType, {
                code: code,
                key: key,
                bubbles: true,
                cancelable: true,
                view: window
            });
            window.dispatchEvent(event);
        };

        const startHandler = (e) => {
            if (e.cancelable) e.preventDefault(); // Prevent default touch actions (scrolling)
            if (e.type === 'mousedown' && e.button !== 0) return; // Only left click
            
            if (!btn.classList.contains('active')) {
                btn.classList.add('active');
                triggerKey('keydown');
            }
        };

        const endHandler = (e) => {
            if (e.cancelable) e.preventDefault();
            if (btn.classList.contains('active')) {
                btn.classList.remove('active');
                triggerKey('keyup');
            }
        };

        btn.addEventListener('touchstart', startHandler, { passive: false });
        btn.addEventListener('touchend', endHandler, { passive: false });
        // Mouse support for testing on desktop
        btn.addEventListener('mousedown', startHandler);
        
        // Handle dragging off the button
        btn.addEventListener('touchcancel', endHandler);
    });
    
    // Global mouseup to handle dragging mouse off buttons
    window.addEventListener('mouseup', () => {
        buttons.forEach(btn => {
             if (btn.classList.contains('active')) {
                 btn.classList.remove('active');
                 const dataKey = btn.getAttribute('data-key');
                 if (dataKey && keyMap[dataKey]) {
                     const { code, key } = keyMap[dataKey];
                     const event = new KeyboardEvent('keyup', { code: code, key: key, bubbles: true });
                     window.dispatchEvent(event);
                 }
             }
        });
    });
}

// Initialize controls if they exist
if (document.getElementById('mobile-controls')) {
    setupMobileControls();
}

// Release held controls when the visitor leaves the game tab.
window.addEventListener('blur', () => {
    Object.keys(keys).forEach(key => keys[key] = false);
    document.querySelectorAll('#mobile-controls .active').forEach(button => button.classList.remove('active'));
});
