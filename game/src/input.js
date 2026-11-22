// Keyboard and pointer input for Shadow Circuit.
// Held keys give a movement axis (WASD or the arrow keys) and a sneak flag
// (Shift). One-shot presses — confirm, pause, retry — are queued as bit flags
// and taken once by the loop, so a press between two frames is never lost and
// never counted twice. Pointer clicks are queued with their position so the
// menu screens can offer real buttons; the loop converts them to field
// coordinates through the renderer.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RETRY = 4;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const RETRY = new Set(['KeyR']);

export function createInput(target) {
  const held = { left: false, right: false, up: false, down: false, sneak: false };
  let actions = 0;
  const clicks = [];

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.sneak = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (RETRY.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RETRY;
    } else return;
    event.preventDefault();
  });

  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.sneak = false;
  });

  // A key released while the tab is hidden never sends keyup: let go of
  // everything on blur so the player never runs on unattended.
  window.addEventListener('blur', () => {
    held.left = false;
    held.right = false;
    held.up = false;
    held.down = false;
    held.sneak = false;
  });

  target.addEventListener('pointerdown', (event) => {
    actions |= ACTION_CONFIRM;
    clicks.push({ x: event.clientX, y: event.clientY });
  });

  return {
    /** Movement axis: each component is -1, 0 or 1 (both keys held cancels out). */
    axis() {
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        y: (held.down ? 1 : 0) - (held.up ? 1 : 0),
      };
    },
    /** True while Shift is held: move slowly and stay harder to detect. */
    sneaking() {
      return held.sneak;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Queued clicks in client pixels since the last call (usually zero or one). */
    takeClicks() {
      const taken = clicks.slice();
      clicks.length = 0;
      return taken;
    },
  };
}
