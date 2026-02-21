"use client";

import { useEffect, useRef } from "react";
import { usePerformance } from "./usePerformance";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  age: number;
}

export default function FluidBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const perf = usePerformance();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size with devicePixelRatio scaling and throttle resize
    const dpr = Math.min(window.devicePixelRatio || 1, Math.max(1, perf.dpr || 1.5));
    let resizeTimeout: number | null = null;
    const setCanvasSize = () => {
      // Backing store pixels
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      // CSS size stays full-window
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      // Scale context if needed
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    setCanvasSize();
    const onResize = () => {
      if (resizeTimeout) window.clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        setCanvasSize();
        resizeTimeout = null;
      }, 150);
    };
    window.addEventListener("resize", onResize);

    // Particle system
    const particles: Particle[] = [];
    // Adapt particle count based on performance
    let particleCount = 40;
    if (perf.isLow) particleCount = 16;

    // Initialize particles
    const initParticles = () => {
      particles.length = 0;
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const distance = 100 + Math.random() * 50;
        particles.push({
          x: canvas.width / 2 + Math.cos(angle) * distance,
          y: canvas.height / 2 + Math.sin(angle) * distance,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          radius: 30 + Math.random() * 40,
          age: Math.random() * 100,
        });
      }
    };
    initParticles();

    // Track mouse with light throttling to avoid heavy update rates
    let mouseX = canvas.width / 2;
    let mouseY = canvas.height / 2;
    let lastMouseUpdate = 0;

    const onMouseMove = (e: MouseEvent) => {
      const now = performance.now();
      // Update at most every 40ms (~25Hz)
      if (now - lastMouseUpdate > 40) {
        mouseX = e.clientX;
        mouseY = e.clientY;
        lastMouseUpdate = now;
      }
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });

    let animationId: number;

    // Frame-skipping when in low-power mode
    let frameCounter = 0;
    const render = () => {
      frameCounter++;
      const skip = perf.isLow ? 1 : 0; // skip every other frame when low
      if (skip && frameCounter % (skip + 1) !== 0) {
        animationId = requestAnimationFrame(render);
        return;
      }
      // Clear to white background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update particles
      particles.forEach((particle) => {
        // Add noise/random motion
        particle.vx += (Math.random() - 0.5) * 0.4;
        particle.vy += (Math.random() - 0.5) * 0.4;

        // Damping
        particle.vx *= 0.95;
        particle.vy *= 0.95;

        // Mouse attraction (strong)
        const dx = mouseX - particle.x;
        const dy = mouseY - particle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 500) {
          const force = (1 - dist / 500) * 0.5;
          particle.vx += (dx / dist) * force;
          particle.vy += (dy / dist) * force;
        }

        // Center attraction (keeps particles from flying off)
        const centerDx = canvas.width / 2 - particle.x;
        const centerDy = canvas.height / 2 - particle.y;
        const centerDist = Math.sqrt(centerDx * centerDx + centerDy * centerDy);
        if (centerDist > 800) {
          particle.vx += (centerDx / centerDist) * 0.1;
          particle.vy += (centerDy / centerDist) * 0.1;
        }

        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Age particles
        particle.age++;

        // Wrapping at edges
        if (particle.x < -particle.radius)
          particle.x = canvas.width + particle.radius;
        if (particle.x > canvas.width + particle.radius)
          particle.x = -particle.radius;
        if (particle.y < -particle.radius)
          particle.y = canvas.height + particle.radius;
        if (particle.y > canvas.height + particle.radius)
          particle.y = -particle.radius;
      });

      // Draw particles with blending
      particles.forEach((particle) => {
        const gradient = ctx.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          particle.radius,
        );

        // Purple/blue metaball gradient
        gradient.addColorStop(0, "rgba(160, 80, 255, 0.95)");
        gradient.addColorStop(0.3, "rgba(130, 60, 220, 0.7)");
        gradient.addColorStop(0.7, "rgba(100, 40, 180, 0.3)");
        gradient.addColorStop(1, "rgba(80, 20, 150, 0)");

        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.globalCompositeOperation = "source-over";

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      if (resizeTimeout) window.clearTimeout(resizeTimeout);
      cancelAnimationFrame(animationId);
    };
  }, [perf.isLow, perf.dpr]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        display: "block",
      }}
    />
  );
}
