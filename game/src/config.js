// Shadow Circuit — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the real screen size. The top band
// of the field is the HUD strip; guards and the player move below it.

export const FIELD = { width: 1280, height: 720, hudHeight: 56 };

/** The simulation's fixed step, in seconds: 60 updates a second at any refresh rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  speed: 168, // units per second at a normal walk
  sneakSpeed: 92, // holding Shift: slower, but far harder to spot
  sneakDetectScale: 0.45, // detection fills at this rate while sneaking
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 74,
  chaseSpeed: 138,
  turnRate: 3.4, // radians per second a guard can swing its gaze
  visionRange: 218,
  visionHalfAngle: 0.62, // ~35.5 degrees either side of facing
  pauseAtWaypoint: 1.1, // seconds a guard lingers at each end of its route
};

export const DETECTION = {
  // Fill rate per second when the player stands at point-blank range in plain
  // sight; it falls off with distance (see world.js). Decay is what makes
  // breaking line of sight worthwhile.
  fillNear: 1.15,
  fillFar: 0.28,
  decay: 0.38,
  suspiciousAt: 0.34, // guards stop and stare
  alertAt: 0.68, // guards give chase
  caughtAt: 1.0,
};

export const OBJECTIVE = { radius: 15, pickupDistance: 26 };
export const EXIT = { width: 54, height: 40 };

export const PALETTE = {
  backdrop: '#07090d',
  floor: '#141a24',
  floorAlt: '#171e2b',
  gridLine: '#1f2938',
  hudBand: '#0c1119',
  wall: '#2e3d55',
  wallTop: '#46597a',
  wallEdge: '#1a2434',
  crate: '#4a3b26',
  crateTop: '#6b5636',
  player: '#39d0c4',
  playerDark: '#177a72',
  guard: '#e5534b',
  guardDark: '#8e2f2a',
  guardAlert: '#ff7847',
  coneCalm: 'rgba(242, 201, 76, 0.16)',
  coneEdge: 'rgba(242, 201, 76, 0.35)',
  coneHot: 'rgba(229, 83, 75, 0.30)',
  coneHotEdge: 'rgba(229, 83, 75, 0.6)',
  objective: '#f2c94c',
  objectiveGlow: 'rgba(242, 201, 76, 0.25)',
  exit: '#3ddc84',
  exitDim: '#1d5c3a',
  panel: '#10151f',
  panelEdge: '#2b3a52',
  text: '#eef1f5',
  muted: '#8b93a3',
  danger: '#ff5a52',
  meterBack: '#232c3d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the campaign progress is kept between visits (this browser only). */
export const BEST_KEY = 'shadow-circuit.cleared';
