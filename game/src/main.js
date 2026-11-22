// Shadow Circuit — boot and the one loop: input is read every frame, the
// world advances in fixed 1/60 s steps (several in a slow frame, none in a
// fast one), and the renderer paints what is there. The game moves between
// six screens: title, play, paused, caught, floor clear and victory.
//
// ?seed=N fixes the cosmetic random seed. ?shot=start|play|play2|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CAUGHT, EVENT_CLEAR, EVENT_OBJECTIVE } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RETRY, createInput } from './input.js';
import {
  createRenderer,
  MENU_BUTTON,
  SCREEN_CAUGHT,
  SCREEN_CLEAR,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_VICTORY,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startRun() {
    world.loadLevel(0);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${world.state.levelName}. Steal the ${world.state.objectiveName}, then reach the exit.`);
  }

  function retryLevel() {
    world.loadLevel(world.state.levelIndex);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Retrying. ${world.state.levelName}.`);
  }

  function onClear() {
    const cleared = world.state.levelIndex + 1;
    if (cleared > best) {
      best = cleared;
      saveBest(best);
    }
    if (cleared >= world.LEVEL_COUNT) {
      screen = SCREEN_VICTORY;
      announce('Circuit complete. All three floors cleared.');
    } else {
      screen = SCREEN_CLEAR;
      announce(`${world.state.levelName} clear. Press Space for the next floor.`);
    }
  }

  function onCaught() {
    screen = SCREEN_CAUGHT;
    announce(`Caught on ${world.state.levelName}. Press R or Space to try again.`);
  }

  /** The shared confirm action: button click or Space/Enter, per screen. */
  function confirm() {
    if (screen === SCREEN_TITLE || screen === SCREEN_VICTORY) startRun();
    else if (screen === SCREEN_CAUGHT) retryLevel();
    else if (screen === SCREEN_CLEAR) {
      world.loadLevel(world.state.levelIndex + 1);
      accumulator = 0;
      screen = SCREEN_PLAY;
      announce(`Playing. ${world.state.levelName}.`);
    } else if (screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    // Clicks only count on menu screens, and only on the button itself.
    let clickedButton = false;
    for (const click of input.takeClicks()) {
      if (screen === SCREEN_PLAY) continue;
      const point = renderer.toLogical(click.x, click.y);
      if (
        point.x >= MENU_BUTTON.x && point.x <= MENU_BUTTON.x + MENU_BUTTON.w &&
        point.y >= MENU_BUTTON.y && point.y <= MENU_BUTTON.y + MENU_BUTTON.h
      ) clickedButton = true;
    }
    if (clickedButton) {
      confirm();
      return;
    }
    if (actions & ACTION_RETRY && (screen === SCREEN_PLAY || screen === SCREEN_CAUGHT || screen === SCREEN_PAUSED)) {
      retryLevel();
      return;
    }
    if (actions & ACTION_CONFIRM && screen !== SCREEN_PLAY) confirm();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE || screen === SCREEN_VICTORY) {
      world.step(STEP, { x: 0, y: 0 }, false); // patrols keep walking behind the panel
      return;
    }
    const events = world.step(STEP, input.axis(), input.sneaking());
    if (events & EVENT_CAUGHT) onCaught();
    else if (events & EVENT_CLEAR) onClear();
    else if (events & EVENT_OBJECTIVE) announce('Core stolen. Reach the exit.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY || screen === SCREEN_VICTORY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY || screen === SCREEN_VICTORY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting patrols run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Shadow Circuit. Press Space or click Infiltrate to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
