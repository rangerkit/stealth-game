// Shadow Circuit — the game's rules and state, with no drawing and no browser
// in it. The player slips through three guarded floors; each guard walks a
// fixed waypoint route and watches a vision cone. A cone only counts when it
// has line of sight: walls and crates block it. Being seen fills the shared
// detection meter (faster up close, slower while sneaking); a full meter —
// or a guard's hand on the player — ends the run. Steal the data core, then
// reach the exit pad. step() advances one fixed step and reports what
// happened as bit flags, so the caller reacts without the world knowing
// about screens.
import { DETECTION, EXIT, FIELD, GUARD, OBJECTIVE, PLAYER } from './config.js';

export const EVENT_CAUGHT = 1;
export const EVENT_OBJECTIVE = 2;
export const EVENT_CLEAR = 4;

export const GUARD_PATROL = 'patrol';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_CHASE = 'chase';

// ---------------------------------------------------------------------------
// Level data. Walls and crates are solid rectangles {x, y, w, h}; the outer
// border is added by the loader. Guard routes are waypoint lists {x, y},
// walked ping-pong; a one-waypoint route is a guard who stands and scans.
// ---------------------------------------------------------------------------

const LEVELS = [
  {
    name: 'Floor 1 — Server Farm',
    objectiveName: 'data core',
    start: { x: 96, y: 624 },
    objective: { x: 1150, y: 150 },
    exit: { x: 48, y: 600 },
    walls: [
      { x: 320, y: 80, w: 20, h: 330 },
      { x: 320, y: 300, w: 440, h: 20 },
      { x: 740, y: 300, w: 20, h: 260 },
      { x: 120, y: 470, w: 400, h: 20 },
    ],
    crates: [
      { x: 1180, y: 420, w: 44, h: 44 },
      { x: 880, y: 520, w: 44, h: 44 },
      { x: 980, y: 210, w: 44, h: 44 },
      { x: 200, y: 540, w: 44, h: 44 },
    ],
    guards: [
      [{ x: 420, y: 160 }, { x: 1080, y: 160 }],
      [{ x: 1080, y: 250 }, { x: 1080, y: 540 }],
      [{ x: 470, y: 615 }, { x: 960, y: 615 }],
    ],
  },
  {
    name: 'Floor 2 — Cold Storage',
    objectiveName: 'data core',
    start: { x: 120, y: 392 },
    objective: { x: 1150, y: 624 },
    exit: { x: 48, y: 372 },
    walls: [
      { x: 80, y: 230, w: 480, h: 20 },
      { x: 720, y: 230, w: 480, h: 20 },
      { x: 620, y: 250, w: 20, h: 260 },
      { x: 200, y: 510, w: 420, h: 20 },
      { x: 860, y: 510, w: 340, h: 20 },
      { x: 290, y: 380, w: 20, h: 250 },
    ],
    crates: [
      { x: 450, y: 370, w: 44, h: 44 },
      { x: 830, y: 370, w: 44, h: 44 },
      { x: 1050, y: 120, w: 44, h: 44 },
      { x: 150, y: 590, w: 44, h: 44 },
      { x: 700, y: 590, w: 44, h: 44 },
    ],
    guards: [
      [{ x: 200, y: 170 }, { x: 1000, y: 170 }],
      [{ x: 1090, y: 320 }, { x: 1090, y: 460 }],
      [{ x: 380, y: 440 }, { x: 540, y: 440 }],
      [{ x: 700, y: 440 }, { x: 950, y: 440 }],
      [{ x: 240, y: 655 }, { x: 1020, y: 655 }],
    ],
  },
  {
    name: 'Floor 3 — The Vault',
    objectiveName: 'vault core',
    start: { x: 108, y: 618 },
    objective: { x: 640, y: 150 },
    exit: { x: 613, y: 644 },
    walls: [
      { x: 470, y: 80, w: 20, h: 220 },
      { x: 790, y: 80, w: 20, h: 220 },
      { x: 470, y: 290, w: 130, h: 20 },
      { x: 680, y: 290, w: 130, h: 20 },
      { x: 470, y: 310, w: 20, h: 240 },
      { x: 790, y: 310, w: 20, h: 240 },
      { x: 80, y: 550, w: 400, h: 20 },
      { x: 800, y: 550, w: 400, h: 20 },
      { x: 120, y: 430, w: 300, h: 20 },
      { x: 860, y: 430, w: 300, h: 20 },
    ],
    crates: [
      { x: 210, y: 120, w: 44, h: 44 },
      { x: 1026, y: 120, w: 44, h: 44 },
      { x: 180, y: 600, w: 44, h: 44 },
      { x: 1056, y: 600, w: 44, h: 44 },
    ],
    guards: [
      [{ x: 540, y: 180 }, { x: 740, y: 180 }],
      [{ x: 640, y: 385 }],
      [{ x: 150, y: 500 }, { x: 400, y: 500 }],
      [{ x: 880, y: 500 }, { x: 1130, y: 500 }],
      [{ x: 200, y: 655 }, { x: 1080, y: 655 }],
      [{ x: 140, y: 180 }, { x: 380, y: 180 }],
    ],
  },
];

export const LEVEL_COUNT = LEVELS.length;

// --- geometry helpers -------------------------------------------------------

function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}

/** Shortest signed turn from angle a to angle b, in (-PI, PI]. */
function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

/** Does the segment (x1,y1)-(x2,y2) touch or cross this solid rectangle? */
function segmentHitsRect(x1, y1, x2, y2, r) {
  if (x1 >= r.x && x1 <= r.x + r.w && y1 >= r.y && y1 <= r.y + r.h) return true;
  if (x2 >= r.x && x2 <= r.x + r.w && y2 >= r.y && y2 <= r.y + r.h) return true;
  const right = r.x + r.w;
  const bottom = r.y + r.h;
  return (
    segmentsCross(x1, y1, x2, y2, r.x, r.y, right, r.y) ||
    segmentsCross(x1, y1, x2, y2, right, r.y, right, bottom) ||
    segmentsCross(x1, y1, x2, y2, right, bottom, r.x, bottom) ||
    segmentsCross(x1, y1, x2, y2, r.x, bottom, r.x, r.y)
  );
}

/** Push a circle out of every solid it overlaps; returns the moved position. */
function resolveCircle(x, y, radius, solids) {
  for (const s of solids) {
    const nearX = clamp(x, s.x, s.x + s.w);
    const nearY = clamp(y, s.y, s.y + s.h);
    let dx = x - nearX;
    let dy = y - nearY;
    const distSq = dx * dx + dy * dy;
    if (distSq >= radius * radius) continue;
    if (distSq === 0) {
      // Centre inside the rect: leave by the shallowest side.
      const left = x - s.x;
      const right = s.x + s.w - x;
      const top = y - s.y;
      const bottom = s.y + s.h - y;
      const min = Math.min(left, right, top, bottom);
      if (min === left) x = s.x - radius;
      else if (min === right) x = s.x + s.w + radius;
      else if (min === top) y = s.y - radius;
      else y = s.y + s.h + radius;
      continue;
    }
    const dist = Math.sqrt(distSq);
    x = nearX + (dx / dist) * radius;
    y = nearY + (dy / dist) * radius;
  }
  return { x, y };
}

// --- the world ---------------------------------------------------------------

export function createWorld(random) {
  const player = { x: 0, y: 0, angle: -Math.PI / 2, sneaking: false, moving: false };
  const state = {
    player,
    levelIndex: 0,
    levelName: '',
    objectiveName: '',
    walls: [],
    crates: [],
    solids: [],
    guards: [],
    objective: { x: 0, y: 0, taken: false },
    exit: { x: 0, y: 0, w: EXIT.width, h: EXIT.height },
    detection: 0,
    spotted: false, // at least one guard has eyes on the player right now
    time: 0,
    flicker: 0, // cosmetic, from the seeded random
  };

  function makeGuard(route) {
    const first = route[0];
    return {
      x: first.x,
      y: first.y,
      angle: route.length > 1 ? Math.atan2(route[1].y - first.y, route[1].x - first.x) : 0,
      route,
      target: route.length > 1 ? 1 : 0,
      direction: 1,
      pauseT: 0,
      scanPhase: random() * Math.PI * 2,
      mode: GUARD_PATROL,
      sees: false,
      lastSeen: null,
      loseT: 0,
    };
  }

  function loadLevel(index) {
    const level = LEVELS[index];
    state.levelIndex = index;
    state.levelName = level.name;
    state.objectiveName = level.objectiveName;
    const border = [
      { x: 0, y: FIELD.hudHeight, w: FIELD.width, h: 24 },
      { x: 0, y: FIELD.height - 24, w: FIELD.width, h: 24 },
      { x: 0, y: FIELD.hudHeight, w: 24, h: FIELD.height - FIELD.hudHeight },
      { x: FIELD.width - 24, y: FIELD.hudHeight, w: 24, h: FIELD.height - FIELD.hudHeight },
    ];
    state.walls = border.concat(level.walls);
    state.crates = level.crates.slice();
    state.solids = state.walls.concat(state.crates);
    state.guards = level.guards.map(makeGuard);
    state.objective = { x: level.objective.x, y: level.objective.y, taken: false };
    state.exit = { x: level.exit.x, y: level.exit.y, w: EXIT.width, h: EXIT.height };
    player.x = level.start.x;
    player.y = level.start.y;
    player.angle = -Math.PI / 2;
    state.detection = 0;
    state.spotted = false;
    state.time = 0;
  }

  /** True when nothing solid stands between the two points. */
  function lineOfSight(x1, y1, x2, y2) {
    for (const s of state.solids) {
      if (segmentHitsRect(x1, y1, x2, y2, s)) return false;
    }
    return true;
  }

  /** Can this guard see the player this step? Cone, range and line of sight. */
  function guardSees(guard) {
    const dx = player.x - guard.x;
    const dy = player.y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist > GUARD.visionRange) return false;
    if (dist > 1) {
      const facing = Math.atan2(dy, dx);
      if (Math.abs(angleDelta(guard.angle, facing)) > GUARD.visionHalfAngle) return false;
    }
    return lineOfSight(guard.x, guard.y, player.x, player.y);
  }

  function turnToward(guard, targetAngle, dt) {
    const delta = angleDelta(guard.angle, targetAngle);
    const maxTurn = GUARD.turnRate * dt;
    guard.angle += clamp(delta, -maxTurn, maxTurn);
  }

  function moveGuard(guard, tx, ty, speed, dt) {
    const dx = tx - guard.x;
    const dy = ty - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return true;
    turnToward(guard, Math.atan2(dy, dx), dt);
    const stepLen = Math.min(dist, speed * dt);
    const moved = resolveCircle(
      guard.x + (dx / dist) * stepLen,
      guard.y + (dy / dist) * stepLen,
      GUARD.radius,
      state.solids,
    );
    guard.x = moved.x;
    guard.y = moved.y;
    return dist <= stepLen + 1;
  }

  function patrol(guard, dt) {
    if (guard.route.length === 1) {
      // A posted guard: stand still and sweep its gaze back and forth.
      guard.scanPhase += dt * 0.7;
      guard.angle = Math.sin(guard.scanPhase) * 1.9;
      return;
    }
    if (guard.pauseT > 0) {
      guard.pauseT -= dt;
      return;
    }
    const target = guard.route[guard.target];
    if (moveGuard(guard, target.x, target.y, GUARD.patrolSpeed, dt)) {
      guard.pauseT = GUARD.pauseAtWaypoint;
      guard.target += guard.direction;
      if (guard.target >= guard.route.length || guard.target < 0) {
        guard.direction *= -1;
        guard.target += guard.direction * 2;
      }
    }
  }

  function stepGuard(guard, dt) {
    if (guard.sees) {
      guard.lastSeen = { x: player.x, y: player.y };
      guard.loseT = 0;
      if (state.detection >= DETECTION.alertAt) {
        guard.mode = GUARD_CHASE;
        moveGuard(guard, player.x, player.y, GUARD.chaseSpeed, dt);
      } else {
        guard.mode = GUARD_SUSPICIOUS;
        turnToward(guard, Math.atan2(player.y - guard.y, player.x - guard.x), dt);
      }
      return;
    }
    if (guard.mode === GUARD_CHASE && guard.lastSeen) {
      // Lost sight mid-chase: run to the last known spot, look, then give up.
      if (moveGuard(guard, guard.lastSeen.x, guard.lastSeen.y, GUARD.chaseSpeed, dt)) {
        guard.loseT += dt;
        guard.angle += dt * 2.2;
        if (guard.loseT > 1.6) {
          guard.mode = GUARD_PATROL;
          guard.lastSeen = null;
        }
      }
      return;
    }
    if (guard.mode !== GUARD_PATROL && state.detection < DETECTION.suspiciousAt) {
      guard.mode = GUARD_PATROL;
    }
    if (guard.mode === GUARD_SUSPICIOUS) {
      guard.angle += dt * 1.4; // scanning for whatever it half-saw
      return;
    }
    patrol(guard, dt);
  }

  /**
   * One fixed step. `move` is the input axis {x, y} (components -1, 0 or 1);
   * `sneak` is the Shift flag. Returns EVENT_* flags for what happened.
   */
  function step(dt, move, sneak) {
    let events = 0;
    state.time += dt;
    state.flicker = random();

    // Player movement, axis by axis so walls slide instead of sticking.
    const length = Math.hypot(move.x, move.y);
    player.moving = length > 0;
    player.sneaking = sneak;
    if (player.moving) {
      const speed = sneak ? PLAYER.sneakSpeed : PLAYER.speed;
      const nx = (move.x / length) * speed * dt;
      const ny = (move.y / length) * speed * dt;
      let moved = resolveCircle(player.x + nx, player.y, PLAYER.radius, state.solids);
      player.x = moved.x;
      player.y = moved.y;
      moved = resolveCircle(player.x, player.y + ny, PLAYER.radius, state.solids);
      player.x = moved.x;
      player.y = moved.y;
      player.angle = Math.atan2(move.y, move.x);
    }
    player.x = clamp(player.x, PLAYER.radius, FIELD.width - PLAYER.radius);
    player.y = clamp(player.y, FIELD.hudHeight + PLAYER.radius, FIELD.height - PLAYER.radius);

    // Who can see the player, and what that does to the meter.
    state.spotted = false;
    let nearestSeeing = Infinity;
    for (const guard of state.guards) {
      guard.sees = guardSees(guard);
      if (guard.sees) {
        state.spotted = true;
        nearestSeeing = Math.min(nearestSeeing, Math.hypot(player.x - guard.x, player.y - guard.y));
      }
    }
    if (state.spotted) {
      const closeness = 1 - nearestSeeing / GUARD.visionRange; // 0 far, 1 point-blank
      let rate = DETECTION.fillFar + (DETECTION.fillNear - DETECTION.fillFar) * closeness;
      if (sneak) rate *= PLAYER.sneakDetectScale;
      state.detection = Math.min(1, state.detection + rate * dt);
    } else {
      state.detection = Math.max(0, state.detection - DETECTION.decay * dt);
    }

    for (const guard of state.guards) stepGuard(guard, dt);

    // A guard close enough to grab the player ends it, seen or not.
    for (const guard of state.guards) {
      if (Math.hypot(player.x - guard.x, player.y - guard.y) < PLAYER.radius + GUARD.radius - 3) {
        state.detection = 1;
      }
    }
    if (state.detection >= DETECTION.caughtAt) events |= EVENT_CAUGHT;

    // The objective: walk over the core to steal it.
    if (!state.objective.taken) {
      const dist = Math.hypot(player.x - state.objective.x, player.y - state.objective.y);
      if (dist < OBJECTIVE.pickupDistance) {
        state.objective.taken = true;
        events |= EVENT_OBJECTIVE;
      }
    }

    // The exit only opens its doors to a thief carrying the core.
    if (state.objective.taken) {
      const e = state.exit;
      if (player.x > e.x && player.x < e.x + e.w && player.y > e.y && player.y < e.y + e.h) {
        events |= EVENT_CLEAR;
      }
    }
    return events;
  }

  loadLevel(0);
  return { state, loadLevel, step, lineOfSight, LEVEL_COUNT };
}
