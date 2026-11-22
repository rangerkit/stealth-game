// The screenshot scenes behind ?shot=start|play|play2|end. Each one loads a
// real level, lets the patrols run for a fixed number of steps so the guards
// are mid-route, then stages the player (and, for one scene, a guard) at an
// exact spot and steps the real rules a few more times. The same seed always
// gives the same frame: nothing here reads the clock or Math.random.
import { STEP } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_VICTORY } from './render.js';

const IDLE = { x: 0, y: 0 };

function runSteps(world, steps) {
  for (let i = 0; i < steps; i += 1) world.step(STEP, IDLE, false);
}

/** Title: Floor 1 ticking over behind the panel, patrols mid-route. */
function stageStart(world) {
  world.loadLevel(0);
  runSteps(world, 150);
  return { screen: SCREEN_TITLE, best: 0 };
}

/**
 * Play: Floor 1, the top-corridor guard has just picked the player up in its
 * cone — it has stopped, suspicious, and the detection meter is part full.
 * The guard is placed exactly so the frame never depends on patrol timing.
 */
function stagePlay(world) {
  world.loadLevel(0);
  runSteps(world, 120);
  const guard = world.state.guards[0];
  guard.x = 520;
  guard.y = 160;
  guard.angle = 0;
  guard.pauseT = 0;
  world.state.player.x = 648;
  world.state.player.y = 166;
  runSteps(world, 26);
  return { screen: SCREEN_PLAY, best: 0 };
}

/**
 * Play, later: Floor 3, the vault core already stolen (note the gold square
 * on the player's back and the lit exit pad), the player crossing the
 * central chamber under the scanning guard, heading down to the exit.
 */
function stagePlay2(world) {
  world.loadLevel(2);
  runSteps(world, 40);
  world.state.objective.taken = true;
  world.state.player.x = 640;
  world.state.player.y = 472;
  runSteps(world, 1);
  world.state.player.angle = Math.PI / 2;
  return { screen: SCREEN_PLAY, best: 0 };
}

/** End: the campaign won — the victory panel over Floor 3. */
function stageEnd(world) {
  world.loadLevel(2);
  runSteps(world, 60);
  world.state.objective.taken = true;
  return { screen: SCREEN_VICTORY, best: 3 };
}

const SCENES = { start: stageStart, play: stagePlay, play2: stagePlay2, end: stageEnd };

/** Stage one named scene on the world; unknown names fall back to the title. */
export function stageShot(name, world) {
  const stage = SCENES[name] ?? stageStart;
  return stage(world);
}
