// Shadow Circuit — drawing only: the world's state and the current screen
// in, pixels out. The 1280x720 field is scaled to fit the window and centred,
// the margin filled with the backdrop colour. Vision cones are drawn as fans
// of rays stopped by the first solid they hit, so a cone visibly bends
// around corners and crates — the same line-of-sight rule the world uses.
// Everything is flat canvas shapes and text; nothing is loaded.
import { DETECTION, FIELD, FONT, GUARD, PALETTE } from './config.js';
import { GUARD_CHASE, GUARD_SUSPICIOUS } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_VICTORY = 'victory';

/** The one menu button every panel screen shares, in field coordinates. */
export const MENU_BUTTON = { x: 500, y: 492, w: 280, h: 54 };

const PANEL = { x: 300, y: 148, w: 680, h: 424 };
const TILE = 40;
const CONE_RAYS = 22;

const BUTTON_LABELS = {
  [SCREEN_TITLE]: 'INFILTRATE',
  [SCREEN_PAUSED]: 'RESUME',
  [SCREEN_CAUGHT]: 'TRY AGAIN',
  [SCREEN_CLEAR]: 'NEXT FLOOR',
  [SCREEN_VICTORY]: 'PLAY AGAIN',
};

/** Distance from (ox, oy) along the unit direction to this rect, or Infinity. */
function rayRect(ox, oy, dx, dy, r) {
  let tmin = 0;
  let tmax = Infinity;
  if (Math.abs(dx) < 1e-9) {
    if (ox < r.x || ox > r.x + r.w) return Infinity;
  } else {
    let t1 = (r.x - ox) / dx;
    let t2 = (r.x + r.w - ox) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  if (Math.abs(dy) < 1e-9) {
    if (oy < r.y || oy > r.y + r.h) return Infinity;
  } else {
    let t1 = (r.y - oy) / dy;
    let t2 = (r.y + r.h - oy) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, bold) {
    const key = size + (bold ? 'b' : '');
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  // --- the facility ---------------------------------------------------------

  function drawFloor(state) {
    context.fillStyle = PALETTE.floor;
    context.fillRect(0, FIELD.hudHeight, FIELD.width, FIELD.height - FIELD.hudHeight);
    context.fillStyle = PALETTE.floorAlt;
    for (let ty = FIELD.hudHeight; ty < FIELD.height; ty += TILE) {
      for (let tx = 0; tx < FIELD.width; tx += TILE) {
        if (((tx / TILE) + ((ty - FIELD.hudHeight) / TILE)) % 2 === 0) context.fillRect(tx, ty, TILE, TILE);
      }
    }
    context.strokeStyle = PALETTE.gridLine;
    context.lineWidth = 1;
    context.beginPath();
    for (let tx = 0; tx <= FIELD.width; tx += TILE) {
      context.moveTo(tx + 0.5, FIELD.hudHeight);
      context.lineTo(tx + 0.5, FIELD.height);
    }
    for (let ty = FIELD.hudHeight; ty <= FIELD.height; ty += TILE) {
      context.moveTo(0, ty + 0.5);
      context.lineTo(FIELD.width, ty + 0.5);
    }
    context.stroke();

    // The exit pad: dim until the core is stolen, then lit and pulsing.
    const e = state.exit;
    const live = state.objective.taken;
    const pulse = live ? 0.72 + 0.28 * Math.sin(state.time * 5) : 1;
    context.fillStyle = live ? PALETTE.exit : PALETTE.exitDim;
    context.globalAlpha = live ? pulse : 0.55;
    context.fillRect(e.x, e.y, e.w, e.h);
    context.globalAlpha = 1;
    context.strokeStyle = live ? PALETTE.exit : PALETTE.exitDim;
    context.lineWidth = 2;
    context.strokeRect(e.x + 3, e.y + 3, e.w - 6, e.h - 6);
    text('EXIT', e.x + e.w / 2, e.y + e.h / 2 + 5, 13, live ? '#06281a' : PALETTE.muted, 'center', true);
  }

  function drawObjective(state) {
    if (state.objective.taken) return;
    const { x, y } = state.objective;
    const bob = Math.sin(state.time * 3) * 3;
    context.fillStyle = PALETTE.objectiveGlow;
    context.beginPath();
    context.arc(x, y + bob, 30 + Math.sin(state.time * 4) * 4, 0, Math.PI * 2);
    context.fill();
    context.save();
    context.translate(x, y + bob);
    context.rotate(Math.PI / 4 + state.time * 0.8);
    context.fillStyle = PALETTE.objective;
    context.fillRect(-11, -11, 22, 22);
    context.fillStyle = '#8a6d1d';
    context.fillRect(-5, -5, 10, 10);
    context.restore();
    text(state.objectiveName.toUpperCase(), x, y + 44, 12, PALETTE.objective, 'center', true);
  }

  function drawCone(state, guard) {
    const hot = guard.sees || guard.mode === GUARD_CHASE;
    context.fillStyle = hot ? PALETTE.coneHot : PALETTE.coneCalm;
    context.strokeStyle = hot ? PALETTE.coneHotEdge : PALETTE.coneEdge;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(guard.x, guard.y);
    for (let i = 0; i <= CONE_RAYS; i += 1) {
      const angle = guard.angle - GUARD.visionHalfAngle + (2 * GUARD.visionHalfAngle * i) / CONE_RAYS;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      let dist = GUARD.visionRange;
      for (const s of state.solids) dist = Math.min(dist, rayRect(guard.x, guard.y, dx, dy, s));
      context.lineTo(guard.x + dx * dist, guard.y + dy * dist);
    }
    context.closePath();
    context.fill();
    context.stroke();
  }

  function drawSolids(state) {
    for (const wall of state.walls) {
      context.fillStyle = PALETTE.wallEdge;
      context.fillRect(wall.x, wall.y + 5, wall.w, wall.h);
      context.fillStyle = PALETTE.wall;
      context.fillRect(wall.x, wall.y, wall.w, wall.h);
      context.fillStyle = PALETTE.wallTop;
      context.fillRect(wall.x, wall.y, wall.w, 4);
    }
    for (const crate of state.crates) {
      context.fillStyle = PALETTE.crate;
      context.fillRect(crate.x, crate.y, crate.w, crate.h);
      context.fillStyle = PALETTE.crateTop;
      context.fillRect(crate.x + 4, crate.y + 4, crate.w - 8, crate.h - 8);
      context.strokeStyle = PALETTE.crate;
      context.lineWidth = 2;
      context.strokeRect(crate.x + 4, crate.y + 4, crate.w - 8, crate.h - 8);
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    context.strokeStyle = PALETTE.playerDark;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(p.x, p.y, p.sneaking ? 19 : 16, 0, Math.PI * 2);
    if (p.sneaking) context.setLineDash([5, 5]);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(p.x, p.y, 13, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.playerDark;
    context.beginPath();
    context.arc(p.x, p.y, 6, 0, Math.PI * 2);
    context.fill();
    // Facing tick.
    context.strokeStyle = PALETTE.player;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(p.x + Math.cos(p.angle) * 13, p.y + Math.sin(p.angle) * 13);
    context.lineTo(p.x + Math.cos(p.angle) * 21, p.y + Math.sin(p.angle) * 21);
    context.stroke();
    if (state.objective.taken) {
      context.fillStyle = PALETTE.objective;
      context.fillRect(p.x + 8, p.y - 16, 8, 8);
    }
  }

  function drawGuard(state, guard) {
    const alert = guard.mode === GUARD_CHASE;
    context.fillStyle = alert ? PALETTE.guardAlert : PALETTE.guard;
    context.beginPath();
    context.arc(guard.x, guard.y, 14, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.guardDark;
    context.beginPath();
    context.arc(guard.x, guard.y, 7, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = alert ? PALETTE.guardAlert : PALETTE.guard;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(guard.x + Math.cos(guard.angle) * 14, guard.y + Math.sin(guard.angle) * 14);
    context.lineTo(guard.x + Math.cos(guard.angle) * 23, guard.y + Math.sin(guard.angle) * 23);
    context.stroke();
    if (guard.mode === GUARD_SUSPICIOUS) text('?', guard.x, guard.y - 24, 22, PALETTE.objective, 'center', true);
    else if (alert) text('!', guard.x, guard.y - 24, 24, PALETTE.danger, 'center', true);
  }

  // --- HUD -------------------------------------------------------------------

  function drawHud(state) {
    context.fillStyle = PALETTE.hudBand;
    context.fillRect(0, 0, FIELD.width, FIELD.hudHeight);
    context.fillStyle = PALETTE.panelEdge;
    context.fillRect(0, FIELD.hudHeight - 2, FIELD.width, 2);
    context.textBaseline = 'middle';
    text(state.levelName, 20, FIELD.hudHeight / 2, 19, PALETTE.text, 'left', true);

    // Detection meter, centre stage: yellow warming to red as it fills.
    const meterW = 340;
    const meterX = FIELD.width / 2 - meterW / 2;
    text('DETECTION', meterX - 12, FIELD.hudHeight / 2, 13, PALETTE.muted, 'right', true);
    context.fillStyle = PALETTE.meterBack;
    context.fillRect(meterX, 18, meterW, 20);
    const d = state.detection;
    if (d > 0.005) {
      context.fillStyle = d >= DETECTION.alertAt ? PALETTE.danger : d >= DETECTION.suspiciousAt ? '#ff9f43' : PALETTE.objective;
      context.fillRect(meterX, 18, meterW * d, 20);
    }
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    context.strokeRect(meterX, 18, meterW, 20);

    const status = state.objective.taken
      ? 'CORE STOLEN — REACH THE EXIT'
      : `STEAL THE ${state.objectiveName.toUpperCase()}`;
    text(status, FIELD.width - 20, FIELD.hudHeight / 2, 15, state.objective.taken ? PALETTE.exit : PALETTE.objective, 'right', true);
    context.textBaseline = 'alphabetic';
  }

  // --- panels ------------------------------------------------------------------

  function drawButton(label) {
    const b = MENU_BUTTON;
    context.fillStyle = PALETTE.exit;
    context.fillRect(b.x, b.y, b.w, b.h);
    text(label, b.x + b.w / 2, b.y + b.h / 2 + 8, 22, '#06281a', 'center', true);
  }

  function drawPanelShell(title, titleColor) {
    context.fillStyle = 'rgba(4, 6, 10, 0.72)';
    context.fillRect(0, FIELD.hudHeight, FIELD.width, FIELD.height - FIELD.hudHeight);
    context.fillStyle = PALETTE.panel;
    context.fillRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
    text(title, FIELD.width / 2, PANEL.y + 84, 52, titleColor, 'center', true);
  }

  function drawLines(lines, startY, size, color) {
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, startY + i * (size + 12), size, color, 'center', false);
    }
  }

  const TITLE_LINES = [
    'Sneak past the patrols. Steal the core. Reach the exit unseen.',
    'Move: WASD or arrow keys      Sneak: hold Shift',
    'Stay out of the vision cones — walls and crates block sight.',
    'A full detection meter means caught. P pauses, R retries.',
  ];
  const CAUGHT_LINES = ['The patrols spotted you and the alarm did the rest.', 'Watch the cones, use the crates, and sneak when close.'];
  const CLEAR_LINES = ['Core secured and not a soul saw you leave.', 'The next floor is watched more closely.'];
  const VICTORY_LINES = ['All three floors cleared. Every core lifted,', 'every patrol none the wiser. The circuit is yours.'];
  const PAUSED_LINES = ['The patrols will wait for you.'];

  /** Paint one frame: the facility, then the HUD or a panel for the screen. */
  function draw(state, screen, extra) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);

    drawFloor(state);
    drawObjective(state);
    for (const guard of state.guards) drawCone(state, guard);
    drawSolids(state);
    for (const guard of state.guards) drawGuard(state, guard);
    drawPlayer(state);
    drawHud(state);

    if (screen === SCREEN_PLAY) return;
    if (screen === SCREEN_TITLE) {
      drawPanelShell('SHADOW CIRCUIT', PALETTE.player);
      drawLines(TITLE_LINES, PANEL.y + 150, 19, PALETTE.muted);
      if (extra > 0) text(`Campaign best: ${extra} of 3 floors cleared`, FIELD.width / 2, PANEL.y + 330, 17, PALETTE.objective, 'center', false);
    } else if (screen === SCREEN_PAUSED) {
      drawPanelShell('PAUSED', PALETTE.text);
      drawLines(PAUSED_LINES, PANEL.y + 170, 20, PALETTE.muted);
    } else if (screen === SCREEN_CAUGHT) {
      drawPanelShell('CAUGHT', PALETTE.danger);
      drawLines(CAUGHT_LINES, PANEL.y + 160, 19, PALETTE.muted);
      text(state.levelName, FIELD.width / 2, PANEL.y + 268, 17, PALETTE.text, 'center', false);
    } else if (screen === SCREEN_CLEAR) {
      drawPanelShell('FLOOR CLEAR', PALETTE.exit);
      drawLines(CLEAR_LINES, PANEL.y + 160, 19, PALETTE.muted);
      text(state.levelName, FIELD.width / 2, PANEL.y + 268, 17, PALETTE.text, 'center', false);
    } else if (screen === SCREEN_VICTORY) {
      drawPanelShell('CIRCUIT COMPLETE', PALETTE.objective);
      drawLines(VICTORY_LINES, PANEL.y + 160, 19, PALETTE.muted);
    }
    const label = BUTTON_LABELS[screen];
    if (label) drawButton(label);
    text('or press Space', FIELD.width / 2, MENU_BUTTON.y + MENU_BUTTON.h + 30, 14, PALETTE.muted, 'center', false);
  }

  /** Convert a pointer position in client pixels to field coordinates. */
  function toLogical(clientX, clientY) {
    const ratio = window.devicePixelRatio || 1;
    return {
      x: (clientX * ratio - view.x) / view.scale,
      y: (clientY * ratio - view.y) / view.scale,
    };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toLogical };
}
