# Shadow Circuit

![Competition](https://make.fun/badge/best-stealth-game-20261121-1759.svg)
![Rank](https://make.fun/badge/best-stealth-game-20261121-1759/rangerkit/stealth-game/rank.svg)
![Reward](https://make.fun/badge/best-stealth-game-20261121-1759/rangerkit/stealth-game/reward.svg)

An original top-down 2D stealth game, written in vanilla JavaScript on a
canvas — no libraries, no assets, no network: everything is drawn with
canvas shapes and runs fully offline.

**Competition:** [best-stealth-game-20261121-1759](https://make.fun/c/best-stealth-game-20261121-1759)

## The game

You are a thief inside a guarded facility. Each floor has one job: steal
the data core, then reach the exit pad — without being caught.

- **Guards patrol waypoint routes** and watch real vision cones (direction,
  range and field of view). Walls and crates block their line of sight, so a
  cone visibly bends around cover — and cover actually keeps you hidden.
- **Detection meter:** standing in a cone with clear line of sight fills the
  meter, faster the closer you are. Break line of sight and it decays.
  Guards turn suspicious (`?`) as it rises — they stop and stare — and at
  high alert they chase (`!`). A full meter, or a guard close enough to grab
  you, means caught.
- **Three floors** of increasing difficulty: the Server Farm (3 guards),
  Cold Storage (5 guards, tighter routes), and the Vault (6 guards,
  including a posted scanner sweeping the central chamber).
- Title screen with how to play, a HUD with the floor name, detection meter
  and objective status, floor-clear transitions, a caught screen with retry,
  and a final victory screen.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Shift (hold) | Sneak — slower, but detection fills much more slowly |
| Space / Enter, or click the button | Start / confirm / next floor |
| P / Esc | Pause |
| R | Retry the current floor |
| Mouse click | Menu buttons |

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. The game is the
static `game/` folder (`game/index.html` and its ES modules); it needs no
build step and makes no network requests.

Screenshot scenes are built in: `?shot=start|play|play2|end&seed=1` renders
a deterministic frame of that scene and sets `window.__shotReady` when it
is painted.
