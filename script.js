
/* =========================================================
   GLITCH//RUN — PHASE 1 GAME ENGINE
   HTML Canvas + Vanilla JavaScript
   ========================================================= */

(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const scoreElement = document.getElementById("score");
  const energyElement = document.getElementById("energy");
  const bestElement = document.getElementById("best");
  const speedElement = document.getElementById("speedValue");
  const overlay = document.getElementById("overlay");
  const overlayKicker = document.getElementById("overlayKicker");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const startButton = document.getElementById("startButton");
  const gameStatus = document.getElementById("gameStatus");

  const COLORS = {
    cyan: "#39f5ff",
    purple: "#a855f7",
    pink: "#ff4f91",
    yellow: "#ffd166",
    white: "#effaff",
    background: "#080e20"
  };

  let width = 800;
  let height = 390;
  let groundY = 310;
  let lastTime = 0;
  let animationId = 0;
  let running = false;
  let gameOver = false;
  let elapsed = 0;
  let score = 0;
  let energy = 0;
  let speed = 300;
  let obstacleTimer = 0;
  let energyTimer = 0;
  let backgroundOffset = 0;
  let shake = 0;
  let flash = 0;

  let obstacles = [];
  let crystals = [];
  let particles = [];
  let stars = [];

  let best = loadBest();

  const player = {
    x: 90,
    y: 0,
    size: 29,
    velocityY: 0,
    grounded: true,
    rotation: 0,
    trailTimer: 0
  };

  function loadBest() {
    try {
      return Number(localStorage.getItem("glitchRunBest")) || 0;
    } catch {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem("glitchRunBest", String(best));
    } catch {
      // The game still works if browser storage is unavailable.
    }
  }

  function formatNumber(value) {
    return Math.floor(value).toString().padStart(6, "0");
  }

  function updateHUD() {
    scoreElement.textContent = formatNumber(score);
    energyElement.textContent = String(energy).padStart(2, "0");
    bestElement.textContent = formatNumber(best);
    speedElement.textContent = (speed / 300).toFixed(1) + "x";
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    groundY = height * 0.79;

    player.x = Math.max(42, width * 0.115);
    player.size = Math.max(23, Math.min(30, width * 0.037));

    if (!running || player.grounded) {
      player.y = groundY - player.size;
    }

    createStars();
    draw();
  }

  function createStars() {
    stars = [];

    for (let i = 0; i < 65; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * (groundY - 20),
        size: Math.random() * 1.7 + 0.4,
        alpha: Math.random() * 0.6 + 0.15,
        speed: Math.random() * 0.12 + 0.025
      });
    }
  }

  function resetGame() {
    elapsed = 0;
    score = 0;
    energy = 0;
    speed = 300;
    obstacleTimer = 1;
    energyTimer = 1.2;
    backgroundOffset = 0;
    shake = 0;
    flash = 0;

    obstacles = [];
    crystals = [];
    particles = [];

    player.x = Math.max(42, width * 0.115);
    player.y = groundY - player.size;
    player.velocityY = 0;
    player.grounded = true;
    player.rotation = 0;
    player.trailTimer = 0;

    updateHUD();
  }

  function startGame() {
    if (running) return;

    resetGame();
    running = true;
    gameOver = false;
    lastTime = performance.now();

    overlay.classList.add("hidden");
    gameStatus.textContent = "RUN IN PROGRESS";

    cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(loop);
  }

  function endGame() {
    if (!running) return;

    running = false;
    gameOver = true;

    shake = 10;
    flash = 0.65;

    if (score > best) {
      best = score;
      saveBest();
    }

    updateHUD();

    gameStatus.textContent = "RUN TERMINATED";
    overlayKicker.textContent = "CONNECTION LOST";
    overlayTitle.innerHTML = 'SYSTEM<br><span>CRASHED.</span>';
    overlayText.textContent =
      "Score: " + score + "  •  Energy collected: " + energy +
      ". The system got you this time.";
    startButton.textContent = "↻ RUN IT BACK";
    overlay.classList.remove("hidden");
  }

  function jump() {
    if (!running) return;

    if (player.grounded) {
      player.velocityY = -Math.max(570, height * 1.7);
      player.grounded = false;
      player.rotation = 0;

      burst(
        player.x + player.size / 2,
        groundY - 3,
        COLORS.cyan,
        7
      );
    }
  }

  function handleAction(event) {
    if (event && event.type === "keydown") {
      if (
        event.code === "Space" ||
        event.code === "ArrowUp"
      ) {
        event.preventDefault();

        if (event.repeat) return;

        if (!running) {
          startGame();
        } else {
          jump();
        }
      }

      return;
    }

    if (!running) return;
    jump();
  }

  startButton.addEventListener("click", startGame);

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    handleAction(event);
  });

  document.addEventListener("keydown", handleAction);

  window.addEventListener("resize", resizeCanvas);

  function spawnObstacle() {
    const tall = Math.random() < 0.32;
    const obstacleWidth = tall ? 25 : 31;
    const obstacleHeight = tall
      ? 37 + Math.random() * 15
      : 25 + Math.random() * 10;

    obstacles.push({
      x: width + 20,
      y: groundY - obstacleHeight,
      w: obstacleWidth,
      h: obstacleHeight,
      tall,
      passed: false
    });
  }

  function spawnCrystal() {
    const pattern = Math.random();

    const count = pattern < 0.35 ? 3 : pattern < 0.7 ? 2 : 1;
    const spacing = 31;
    const baseY = groundY - 65 - Math.random() * 65;

    for (let i = 0; i < count; i++) {
      crystals.push({
        x: width + 20 + i * spacing,
        y: baseY + (i % 2 === 0 ? 0 : -10),
        size: 10,
        phase: Math.random() * Math.PI * 2,
        collected: false
      });
    }
  }

  function burst(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const force = 45 + Math.random() * 180;

      particles.push({
        x,
        y,
        vx: Math.cos(angle) * force,
        vy: Math.sin(angle) * force,
        life: 0.35 + Math.random() * 0.45,
        maxLife: 0.8,
        size: 2 + Math.random() * 3,
        color
      });
    }
  }

  function update(dt) {
    elapsed += dt;

    speed = Math.min(640, 300 + elapsed * 5.5);
    backgroundOffset += speed * dt;

    score += dt * (speed / 10);
    score = Math.floor(score);

    player.velocityY += 1750 * dt;
    player.y += player.velocityY * dt;

    if (player.y + player.size >= groundY) {
      player.y = groundY - player.size;
      player.velocityY = 0;
      player.grounded = true;
    } else {
      player.grounded = false;
      player.rotation += dt * 3.5;
    }

    player.trailTimer -= dt;

    if (player.trailTimer <= 0) {
      player.trailTimer = 0.045;

      particles.push({
        x: player.x + 3,
        y: player.y + player.size * 0.75,
        vx: -35 - Math.random() * 45,
        vy: (Math.random() - 0.5) * 35,
        life: 0.22,
        maxLife: 0.22,
        size: 2 + Math.random() * 2,
        color: COLORS.cyan
      });
    }

    obstacleTimer -= dt;

    if (obstacleTimer <= 0) {
      spawnObstacle();

      const difficulty = Math.min(0.55, elapsed * 0.003);
      obstacleTimer = Math.max(
        0.72,
        1.35 + Math.random() * 0.85 - difficulty
      );
    }

    energyTimer -= dt;

    if (energyTimer <= 0) {
      spawnCrystal();
      energyTimer = 1.5 + Math.random() * 1.5;
    }

    const hitboxInset = 5;
    const px = player.x + hitboxInset;
    const py = player.y + hitboxInset;
    const pw = player.size - hitboxInset * 2;
    const ph = player.size - hitboxInset * 2;

    for (const obstacle of obstacles) {
      obstacle.x -= speed * dt;

      if (
        px < obstacle.x + obstacle.w &&
        px + pw > obstacle.x &&
        py < obstacle.y + obstacle.h &&
        py + ph > obstacle.y
      ) {
        endGame();
        return;
      }

      if (!obstacle.passed && obstacle.x + obstacle.w < player.x) {
        obstacle.passed = true;
        score += 15;
      }
    }

    for (const crystal of crystals) {
      crystal.x -= speed * dt;
      crystal.phase += dt * 4;

      const dx = px + pw / 2 - crystal.x;
      const dy = py + ph / 2 - crystal.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (!crystal.collected && distance < player.size / 2 + crystal.size) {
        crystal.collected = true;
        energy++;
        score += 50;
        burst(crystal.x, crystal.y, COLORS.yellow, 12);
        flash = 0.13;
      }
    }

    obstacles = obstacles.filter((item) => item.x + item.w > -30);
    crystals = crystals.filter((item) => !item.collected && item.x > -30);

    for (const star of stars) {
      star.x -= speed * dt * star.speed;

      if (star.x < 0) {
        star.x = width + Math.random() * 30;
        star.y = Math.random() * (groundY - 20);
      }
    }

    for (const particle of particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.max(0, 1 - dt * 1.6);
      particle.vy += 100 * dt;
      particle.life -= dt;
    }

    particles = particles.filter((particle) => particle.life > 0);

    shake = Math.max(0, shake - dt * 25);
    flash = Math.max(0, flash - dt * 2.5);

    updateHUD();
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#0a1025");
    gradient.addColorStop(0.7, "#0b1430");
    gradient.addColorStop(1, "#10102c");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Distant neon atmosphere
    const glow = ctx.createRadialGradient(
      width * 0.72, height * 0.38, 5,
      width * 0.72, height * 0.38, width * 0.55
    );

    glow.addColorStop(0, "rgba(91, 48, 183, 0.20)");
    glow.addColorStop(1, "rgba(91, 48, 183, 0)");

    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    // Distant digital skyline
    const buildingWidth = 45;
    const offset = (backgroundOffset * 0.12) % buildingWidth;

    for (let x = -buildingWidth - offset; x < width + buildingWidth; x += buildingWidth) {
      const index = Math.floor((x + offset) / buildingWidth);
      const buildingHeight = 35 + Math.abs((index * 47) % 80);

      ctx.fillStyle = "rgba(33, 50, 93, 0.36)";
      ctx.fillRect(
        x,
        groundY - buildingHeight - 10,
        buildingWidth - 7,
        buildingHeight
      );

      ctx.fillStyle = "rgba(57, 245, 255, 0.2)";

      for (
        let wy = groundY - buildingHeight + 5;
        wy < groundY - 15;
        wy += 13
      ) {
        if ((Math.floor(x / 5) + Math.floor(wy / 13)) % 3 === 0) {
          ctx.fillRect(x + 9, wy, 3, 3);
          ctx.fillRect(x + 20, wy, 3, 3);
        }
      }
    }

    // Stars
    for (const star of stars) {
      ctx.globalAlpha = star.alpha;
      ctx.fillStyle = COLORS.white;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }

    ctx.globalAlpha = 1;

    // Horizon
    ctx.strokeStyle = "rgba(57, 245, 255, 0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    // Perspective floor
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, groundY, width, height - groundY);
    ctx.clip();

    ctx.strokeStyle = "rgba(57, 110, 255, 0.22)";
    ctx.lineWidth = 1;

    const gridSpacing = 42;
    const gridOffset = backgroundOffset % gridSpacing;

    for (let x = -width; x <= width * 2; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(width / 2 + (x - width / 2) * 0.05, groundY);
      ctx.lineTo(x - gridOffset, height);
      ctx.stroke();
    }

    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      const y = groundY + Math.pow(t, 1.8) * (height - groundY);

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawPlayer() {
    const s = player.size;

    ctx.save();
    ctx.translate(player.x + s / 2, player.y + s / 2);
    ctx.rotate(player.grounded ? 0 : player.rotation);

    // Neon shadow/glow
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 20;

    const gradient = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
    gradient.addColorStop(0, "#f4ffff");
    gradient.addColorStop(0.4, COLORS.cyan);
    gradient.addColorStop(1, "#4784ff");

    ctx.fillStyle = gradient;
    ctx.fillRect(-s / 2, -s / 2, s, s);

    ctx.shadowBlur = 0;

    // Inner dark core
    ctx.fillStyle = "#101a35";
    ctx.fillRect(-s / 2 + 5, -s / 2 + 5, s - 10, s - 10);

    // Eyes
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(-s / 2 + 7, -s / 2 + 8, 4, 4);
    ctx.fillRect(s / 2 - 11, -s / 2 + 8, 4, 4);

    ctx.restore();

    // Ground shadow
    const shadowWidth = player.grounded ? s * 1.5 : s * 1.1;
    ctx.fillStyle = "rgba(57, 245, 255, 0.18)";
    ctx.beginPath();
    ctx.ellipse(
      player.x + s / 2,
      groundY + 2,
      shadowWidth / 2,
      3,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  function drawObstacle(obstacle) {
    const { x, y, w, h } = obstacle;

    ctx.save();

    ctx.shadowColor = COLORS.pink;
    ctx.shadowBlur = 13;

    ctx.fillStyle = "rgba(255, 79, 145, 0.13)";
    ctx.strokeStyle = COLORS.pink;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;

    ctx.strokeStyle = "rgba(255, 170, 207, 0.8)";
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + 8);
    ctx.lineTo(x + w / 2, y + h - 5);
    ctx.stroke();

    ctx.restore();
  }

  function drawCrystal(crystal) {
    const pulse = 1 + Math.sin(crystal.phase) * 0.12;
    const s = crystal.size * pulse;

    ctx.save();
    ctx.translate(crystal.x, crystal.y);
    ctx.rotate(Math.PI / 4 + Math.sin(crystal.phase) * 0.1);
    ctx.scale(pulse, pulse);

    ctx.shadowColor = COLORS.yellow;
    ctx.shadowBlur = 17;

    ctx.fillStyle = COLORS.yellow;
    ctx.fillRect(-s / 2, -s / 2, s, s);

    ctx.shadowBlur = 0;

    ctx.fillStyle = "#fff6cc";
    ctx.fillRect(-s / 4, -s / 4, s / 2, s / 2);

    ctx.restore();
  }

  function drawParticles() {
    for (const particle of particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;

      ctx.shadowColor = particle.color;
      ctx.shadowBlur = 8;

      ctx.fillRect(
        particle.x,
        particle.y,
        particle.size,
        particle.size
      );
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function draw() {
    ctx.save();

    if (shake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * shake,
        (Math.random() - 0.5) * shake
      );
    }

    drawBackground();

    for (const crystal of crystals) {
      drawCrystal(crystal);
    }

    for (const obstacle of obstacles) {
      drawObstacle(obstacle);
    }

    drawParticles();
    drawPlayer();

    // Subtle scan lines
    ctx.fillStyle = "rgba(160, 200, 255, 0.025)";

    for (let y = 0; y < height; y += 4) {
      ctx.fillRect(0, y, width, 1);
    }

    ctx.restore();

    if (flash > 0) {
      ctx.fillStyle = "rgba(57, 245, 255, " + Math.min(flash, 0.18) + ")";
      ctx.fillRect(0, 0, width, height);
    }

    // Small version label
    ctx.fillStyle = "rgba(150, 180, 230, 0.5)";
    ctx.font = "10px monospace";
    ctx.fillText("GLITCH_ENGINE // V1.0", 12, 19);
  }

  function loop(timestamp) {
    if (!running) return;

    const dt = Math.min((timestamp - lastTime) / 1000, 0.035);
    lastTime = timestamp;

    update(dt);
    draw();

    if (running) {
      animationId = requestAnimationFrame(loop);
    }
  }

  // Initialize the game immediately.
  resizeCanvas();
  resetGame();

  overlayKicker.textContent = "INITIALIZING RUNNER";
  overlayTitle.innerHTML = 'ENTER THE<br><span>GLITCH.</span>';
  overlayText.textContent =
    "Jump over the hazards. Collect the energy. Don't get caught.";
  startButton.textContent = "▶ START RUN";
  gameStatus.textContent = "READY FOR DEPLOYMENT";

  draw();
})();
