// A small seeded random number generator (mulberry32). Shadow Circuit's
// levels are fixed data, so randomness is only used for cosmetic flicker and
// guard idle glances — but keeping it seeded means a given seed always
// produces the same frame, which is what makes the screenshot scenes exact.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random float in [min, max) drawn from a generator made by createRandom. */
export function range(random, min, max) {
  return min + random() * (max - min);
}
