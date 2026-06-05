'use client';

import { useEffect, useRef, useCallback } from 'react';

// ─── Constants ─────────────────────────────────────────────────────────────
const W = 600;
const H = 160;
const GROUND_Y = 130;
const DEER_X = 70;
const GRAVITY = 0.6;
const JUMP_VEL = -12.5;
const INITIAL_SPEED = 5;
const MAX_SPEED = 11;
const SPEED_ACCEL = 0.0008;

// LandEthic palette
const C = {
  sky:        '#EAF3DE',
  ground:     '#3B6D11',
  groundLine: '#97C459',
  deerBody:   '#A0522D',
  deerLegs:   '#7B3F1F',
  deerBelly:  '#C8845A',
  deerHead:   '#A0522D',
  deerEye:    '#1a1a1a',
  deerNose:   '#7B3F1F',
  antler:     '#7B3F1F',
  tailWhite:  '#F5F0E8',
  bush:       '#3B6D11',
  bushDark:   '#27500A',
  tree:       '#27500A',
  treeTrunk:  '#6B4226',
  score:      '#3B6D11',
  gameover:   '#3B6D11',
  hint:       '#639922',
};

// ─── Types ─────────────────────────────────────────────────────────────────
interface Deer {
  y: number;
  vy: number;
  onGround: boolean;
  legPhase: number; // 0–1 walk cycle
  dead: boolean;
}

type ObstacleKind = 'bush_small' | 'bush_large' | 'tree';

interface Obstacle {
  x: number;
  kind: ObstacleKind;
  w: number;
  h: number;
}

interface GameState {
  deer: Deer;
  obstacles: Obstacle[];
  speed: number;
  score: number;
  frame: number;
  nextObstacle: number;
  running: boolean;
  started: boolean;
  dead: boolean;
  groundOffset: number; // scrolling ground texture
}

// ─── Drawing helpers ────────────────────────────────────────────────────────
function drawDeer(ctx: CanvasRenderingContext2D, deer: Deer) {
  const x = DEER_X;
  const y = deer.y;
  const phase = deer.legPhase;

  // Leg swing angles (alternating pairs)
  const frontSwing = Math.sin(phase * Math.PI * 2) * 14;
  const backSwing  = -frontSwing;

  ctx.save();
  ctx.translate(x, y);

  // ── Tail ──────────────────────────────────────────────────────────────────
  ctx.fillStyle = C.tailWhite;
  ctx.beginPath();
  ctx.ellipse(-17, -18, 5, 6, Math.PI * 0.3, 0, Math.PI * 2);
  ctx.fill();

  // ── Back legs ─────────────────────────────────────────────────────────────
  ctx.strokeStyle = C.deerLegs;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';

  // back-left leg (further, slightly lighter)
  ctx.save();
  ctx.translate(-8, 0);
  ctx.rotate(((backSwing - 6) * Math.PI) / 180);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 18);
  ctx.lineTo(3, 26);
  ctx.stroke();
  ctx.restore();

  // back-right leg
  ctx.save();
  ctx.translate(-4, 0);
  ctx.rotate(((backSwing + 6) * Math.PI) / 180);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 18);
  ctx.lineTo(3, 26);
  ctx.stroke();
  ctx.restore();

  // ── Body ──────────────────────────────────────────────────────────────────
  ctx.fillStyle = C.deerBody;
  ctx.beginPath();
  ctx.ellipse(0, -12, 20, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // belly highlight
  ctx.fillStyle = C.deerBelly;
  ctx.beginPath();
  ctx.ellipse(2, -8, 13, 7, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // ── Front legs ────────────────────────────────────────────────────────────
  ctx.strokeStyle = C.deerLegs;
  ctx.lineWidth = 3.5;

  // front-left leg
  ctx.save();
  ctx.translate(8, -2);
  ctx.rotate(((frontSwing - 6) * Math.PI) / 180);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 18);
  ctx.lineTo(-2, 26);
  ctx.stroke();
  ctx.restore();

  // front-right leg
  ctx.save();
  ctx.translate(12, -2);
  ctx.rotate(((frontSwing + 6) * Math.PI) / 180);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 18);
  ctx.lineTo(-2, 26);
  ctx.stroke();
  ctx.restore();

  // ── Neck ──────────────────────────────────────────────────────────────────
  ctx.fillStyle = C.deerBody;
  ctx.beginPath();
  ctx.moveTo(14, -20);
  ctx.lineTo(20, -36);
  ctx.lineTo(26, -34);
  ctx.lineTo(20, -18);
  ctx.closePath();
  ctx.fill();

  // ── Head ──────────────────────────────────────────────────────────────────
  ctx.fillStyle = C.deerHead;
  ctx.beginPath();
  ctx.ellipse(22, -40, 10, 7, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // snout
  ctx.fillStyle = C.deerBelly;
  ctx.beginPath();
  ctx.ellipse(28, -37, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // nose
  ctx.fillStyle = C.deerNose;
  ctx.beginPath();
  ctx.arc(31, -37, 2, 0, Math.PI * 2);
  ctx.fill();

  // eye
  ctx.fillStyle = C.deerEye;
  ctx.beginPath();
  ctx.arc(20, -42, 2, 0, Math.PI * 2);
  ctx.fill();

  // eye shine
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(21, -43, 0.8, 0, Math.PI * 2);
  ctx.fill();

  // ear
  ctx.fillStyle = C.deerBody;
  ctx.beginPath();
  ctx.ellipse(15, -46, 3.5, 5, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#E8A87C';
  ctx.beginPath();
  ctx.ellipse(15, -46, 2, 3.5, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // ── Antlers ───────────────────────────────────────────────────────────────
  ctx.strokeStyle = C.antler;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  // main beam
  ctx.beginPath();
  ctx.moveTo(17, -48);
  ctx.lineTo(13, -60);
  ctx.stroke();

  // tines
  ctx.beginPath();
  ctx.moveTo(14, -55);
  ctx.lineTo(8, -58);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(13, -60);
  ctx.lineTo(17, -65);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(13, -60);
  ctx.lineTo(7, -64);
  ctx.stroke();

  ctx.restore();
}

function drawBush(ctx: CanvasRenderingContext2D, x: number, kind: ObstacleKind) {
  ctx.save();
  ctx.translate(x, GROUND_Y);

  if (kind === 'bush_small') {
    // Small bush: 2 overlapping circles
    ctx.fillStyle = C.bush;
    ctx.beginPath();
    ctx.arc(0, -10, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(14, -9, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.bushDark;
    ctx.beginPath();
    ctx.arc(7, -15, 8, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'bush_large') {
    // Large bush: 3 circles
    ctx.fillStyle = C.bushDark;
    ctx.beginPath();
    ctx.arc(0, -14, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(20, -12, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.bush;
    ctx.beginPath();
    ctx.arc(10, -20, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-5, -10, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(25, -9, 9, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Tree: trunk + canopy
    // Trunk
    ctx.fillStyle = C.treeTrunk;
    ctx.fillRect(-5, -32, 10, 32);

    // Canopy layers
    ctx.fillStyle = C.tree;
    ctx.beginPath();
    ctx.moveTo(-22, -32);
    ctx.lineTo(0, -68);
    ctx.lineTo(22, -32);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-18, -48);
    ctx.lineTo(0, -78);
    ctx.lineTo(18, -48);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = C.bushDark;
    ctx.beginPath();
    ctx.moveTo(-14, -58);
    ctx.lineTo(0, -84);
    ctx.lineTo(14, -58);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawGround(ctx: CanvasRenderingContext2D, offset: number) {
  // Ground fill
  ctx.fillStyle = C.ground;
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

  // Ground line
  ctx.fillStyle = C.groundLine;
  ctx.fillRect(0, GROUND_Y, W, 3);

  // Scrolling grass tufts
  ctx.fillStyle = C.groundLine;
  for (let i = 0; i < 12; i++) {
    const gx = ((i * 55 - offset) % (W + 20) + W + 20) % (W + 20) - 10;
    // tuft
    ctx.beginPath();
    ctx.moveTo(gx, GROUND_Y);
    ctx.lineTo(gx - 3, GROUND_Y - 6);
    ctx.lineTo(gx, GROUND_Y - 4);
    ctx.lineTo(gx + 3, GROUND_Y - 7);
    ctx.lineTo(gx + 6, GROUND_Y - 3);
    ctx.lineTo(gx + 6, GROUND_Y);
    ctx.closePath();
    ctx.fill();
  }
}

function obstacleHitbox(obs: Obstacle): { x: number; y: number; w: number; h: number } {
  const pad = 4; // generous inner padding
  return {
    x: obs.x + pad,
    y: GROUND_Y - obs.h + pad,
    w: obs.w - pad * 2,
    h: obs.h - pad,
  };
}

const OBSTACLE_SIZES: Record<ObstacleKind, { w: number; h: number }> = {
  bush_small: { w: 28,  h: 22 },
  bush_large: { w: 40,  h: 30 },
  tree:       { w: 44,  h: 84 },
};

function spawnObstacle(x: number): Obstacle {
  const kinds: ObstacleKind[] = ['bush_small', 'bush_small', 'bush_large', 'tree'];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  return { x, kind, ...OBSTACLE_SIZES[kind] };
}

// ─── Component ─────────────────────────────────────────────────────────────
export default function DeerRunGame() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const stateRef   = useRef<GameState | null>(null);
  const rafRef     = useRef<number | null>(null);

  const initState = useCallback((): GameState => ({
    deer: { y: GROUND_Y - 26, vy: 0, onGround: true, legPhase: 0, dead: false },
    obstacles: [],
    speed: INITIAL_SPEED,
    score: 0,
    frame: 0,
    nextObstacle: 80,
    running: false,
    started: false,
    dead: false,
    groundOffset: 0,
  }), []);

  const jump = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;

    if (s.dead) {
      // Restart
      stateRef.current = initState();
      stateRef.current.running = true;
      stateRef.current.started = true;
      return;
    }

    if (!s.started) {
      s.started = true;
      s.running = true;
    }

    if (s.deer.onGround) {
      s.deer.vy = JUMP_VEL;
      s.deer.onGround = false;
    }
  }, [initState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    if (!ctx) return;

    stateRef.current = initState();

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };
    const onTouch = (e: TouchEvent) => { e.preventDefault(); jump(); };
    const onClick = () => jump();

    window.addEventListener('keydown', onKey);
    canvas.addEventListener('touchstart', onTouch, { passive: false });
    canvas.addEventListener('click', onClick);

    function tick() {
      rafRef.current = requestAnimationFrame(tick);
      const s = stateRef.current;
      if (!s) return;

      // ── Update ────────────────────────────────────────────────────────────
      if (s.running && !s.dead) {
        s.frame++;
        s.score += s.speed * 0.05;
        s.speed = Math.min(MAX_SPEED, INITIAL_SPEED + s.frame * SPEED_ACCEL);

        // Ground scrolling
        s.groundOffset = (s.groundOffset + s.speed) % 660;

        // Deer physics
        s.deer.vy += GRAVITY;
        s.deer.y  += s.deer.vy;
        const floorY = GROUND_Y - 26;
        if (s.deer.y >= floorY) {
          s.deer.y  = floorY;
          s.deer.vy = 0;
          s.deer.onGround = true;
        }

        // Leg animation (faster at higher speed)
        if (s.deer.onGround) {
          s.deer.legPhase = (s.deer.legPhase + s.speed * 0.012) % 1;
        }

        // Spawn obstacles
        s.nextObstacle--;
        if (s.nextObstacle <= 0) {
          s.obstacles.push(spawnObstacle(W + 10));
          // Gap varies with speed (closer together at higher speeds, but not crazy)
          s.nextObstacle = Math.floor(Math.random() * 60 + 110) - s.speed * 3;
          s.nextObstacle = Math.max(s.nextObstacle, 50);
        }

        // Move obstacles
        for (const obs of s.obstacles) {
          obs.x -= s.speed;
        }
        s.obstacles = s.obstacles.filter((o) => o.x + o.w > -10);

        // Collision
        const deerBox = {
          x: DEER_X - 14,
          y: s.deer.y - 46,
          w: 44,
          h: 46,
        };
        for (const obs of s.obstacles) {
          const ob = obstacleHitbox(obs);
          if (
            deerBox.x < ob.x + ob.w &&
            deerBox.x + deerBox.w > ob.x &&
            deerBox.y < ob.y + ob.h &&
            deerBox.y + deerBox.h > ob.y
          ) {
            s.dead = true;
            s.running = false;
            s.deer.dead = true;
          }
        }
      }

      // ── Draw ──────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, W, H);

      // Sky
      ctx.fillStyle = C.sky;
      ctx.fillRect(0, 0, W, H);

      // Ground
      drawGround(ctx, s.groundOffset);

      // Obstacles
      for (const obs of s.obstacles) {
        drawBush(ctx, obs.x + obs.w / 2, obs.kind);
      }

      // Deer (flash red briefly on death)
      if (s.dead && Math.floor(Date.now() / 80) % 2 === 0) {
        ctx.globalAlpha = 0.5;
      }
      drawDeer(ctx, s.deer);
      ctx.globalAlpha = 1;

      // Score
      ctx.fillStyle = C.score;
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(Math.floor(s.score).toString().padStart(5, '0'), W - 16, 24);

      // Overlays
      if (!s.started && !s.dead) {
        ctx.fillStyle = 'rgba(59,109,17,0.08)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = C.gameover;
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Press SPACE or tap to play', W / 2, H / 2 - 6);
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillStyle = C.hint;
        ctx.fillText('Help the deer jump while your plan is generated!', W / 2, H / 2 + 14);
      }

      if (s.dead) {
        ctx.fillStyle = 'rgba(59,109,17,0.08)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = C.gameover;
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', W / 2, H / 2 - 8);
        ctx.font = '13px system-ui, sans-serif';
        ctx.fillStyle = C.hint;
        ctx.fillText(`Score: ${Math.floor(s.score)}  ·  Press SPACE or tap to restart`, W / 2, H / 2 + 12);
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('keydown', onKey);
      canvas.removeEventListener('touchstart', onTouch);
      canvas.removeEventListener('click', onClick);
    };
  }, [initState, jump]);

  return (
    <div className="select-none" style={{ touchAction: 'none' }}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="w-full rounded-2xl border border-[#C8DFA0] cursor-pointer"
        style={{ imageRendering: 'crisp-edges', maxHeight: 160 }}
      />
    </div>
  );
}
