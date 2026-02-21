// Basic OffscreenCanvas particle renderer for FluidBackground
// Runs in a Web Worker. Receives an OffscreenCanvas via postMessage.

let canvas = null;
let ctx = null;
let width = 0;
let height = 0;
let dpr = 1;
let particles = [];
let particleCount = 40;
let isLow = false;
let running = false;
let fps = 60;
let mouseX = 0;
let mouseY = 0;
let loopId = null;

function initParticles() {
  particles.length = 0;
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2;
    const distance = 100 + Math.random() * 50;
    particles.push({
      x: width / 2 + Math.cos(angle) * distance,
      y: height / 2 + Math.sin(angle) * distance,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      radius: 30 + Math.random() * 40,
      age: Math.random() * 100,
    });
  }
}

function resize(w, h, _dpr) {
  width = Math.floor(w * (_dpr || 1));
  height = Math.floor(h * (_dpr || 1));
  dpr = _dpr || 1;
  if (canvas) {
    try {
      canvas.width = width;
      canvas.height = height;
    } catch (e) {}
  }
  initParticles();
}

function step() {
  if (!ctx) return;

  // clear
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // update
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.vx += (Math.random() - 0.5) * 0.4;
    p.vy += (Math.random() - 0.5) * 0.4;
    p.vx *= 0.95;
    p.vy *= 0.95;

    const dx = mouseX - p.x;
    const dy = mouseY - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    if (dist < 500) {
      const force = (1 - dist / 500) * 0.5;
      p.vx += (dx / dist) * force;
      p.vy += (dy / dist) * force;
    }

    const centerDx = width / 2 - p.x;
    const centerDy = height / 2 - p.y;
    const centerDist = Math.sqrt(centerDx * centerDx + centerDy * centerDy) || 1;
    if (centerDist > 800) {
      p.vx += (centerDx / centerDist) * 0.1;
      p.vy += (centerDy / centerDist) * 0.1;
    }

    p.x += p.vx;
    p.y += p.vy;

    if (p.x < -p.radius) p.x = width + p.radius;
    if (p.x > width + p.radius) p.x = -p.radius;
    if (p.y < -p.radius) p.y = height + p.radius;
    if (p.y > height + p.radius) p.y = -p.radius;
  }

  // draw
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
    gradient.addColorStop(0, "rgba(160, 80, 255, 0.95)");
    gradient.addColorStop(0.3, "rgba(130, 60, 220, 0.7)");
    gradient.addColorStop(0.7, "rgba(100, 40, 180, 0.3)");
    gradient.addColorStop(1, "rgba(80, 20, 150, 0)");

    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = "source-over";
}

function loop() {
  if (!running) return;
  step();
  loopId = setTimeout(loop, 1000 / fps);
}

self.onmessage = function (e) {
  const msg = e.data;
  if (!msg) return;
  if (msg.type === "init") {
    try {
      canvas = msg.canvas;
      ctx = canvas.getContext("2d");
      particleCount = msg.particleCount || 40;
      isLow = !!msg.isLow;
      fps = isLow ? 30 : 60;
      resize(msg.width || 800, msg.height || 600, msg.dpr || 1);
      running = true;
      loop();
    } catch (err) {
      // ignore
    }
  } else if (msg.type === "resize") {
    resize(msg.width, msg.height, msg.dpr);
  } else if (msg.type === "mousemove") {
    mouseX = msg.x * (msg.dpr || 1);
    mouseY = msg.y * (msg.dpr || 1);
  } else if (msg.type === "setOptions") {
    if (typeof msg.particleCount === "number") particleCount = msg.particleCount;
    if (typeof msg.isLow === "boolean") {
      isLow = msg.isLow;
      fps = isLow ? 30 : 60;
    }
  } else if (msg.type === "destroy") {
    running = false;
    if (loopId) clearTimeout(loopId);
    try {
      // close worker
      self.close();
    } catch (e) {}
  }
};
