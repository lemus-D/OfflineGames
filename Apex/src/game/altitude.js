/* Real-ish altitude: atmosphere layers + solar-system flybys.
   Game Y is compressed so atmosphere plays out early; deep space
   stretches so the outer planets are ambitious Easter eggs. */

import { clamp, lerp } from '../core/rng.js';

/** Game units spanning ~0–100 km (through lower thermosphere / Kármán). */
export const ATM_GAME_UNITS = 2500;
export const ATM_KM = 100;

/**
 * NASA / NOAA-style layer tops (km). Colors are 8-bit sky tones that
 * lerp smoothly — one screen fill, no stacked bands.
 */
export const ATMO_LAYERS = [
  {
    id: 'troposphere',
    name: 'Troposphere',
    km0: 0,
    km1: 12,
    color: [90, 150, 220],
  },
  {
    id: 'stratosphere',
    name: 'Stratosphere',
    km0: 12,
    km1: 50,
    color: [50, 90, 160],
  },
  {
    id: 'mesosphere',
    name: 'Mesosphere',
    km0: 50,
    km1: 85,
    color: [28, 40, 78],
  },
  {
    id: 'thermosphere',
    name: 'Thermosphere',
    km0: 85,
    km1: 600,
    color: [14, 18, 36],
  },
  {
    id: 'exosphere',
    name: 'Exosphere',
    km0: 600,
    km1: 10000,
    color: [8, 10, 18],
  },
  {
    id: 'cislunar',
    name: 'Cislunar space',
    km0: 10000,
    km1: 384400,
    color: [6, 8, 14],
  },
  {
    id: 'inner_system',
    name: 'Inner system',
    km0: 384400,
    km1: 250000000,
    color: [5, 6, 12],
  },
  {
    id: 'outer_system',
    name: 'Outer system',
    km0: 250000000,
    km1: 6000000000,
    color: [3, 4, 8],
  },
];

/**
 * Easter-egg bodies ordered by climb altitude (gameY ↑).
 * realKm ≈ typical / closest-approach distance from Earth.
 * radiusKm ≈ mean planetary radius (for relative on-screen scale).
 * `art` selects the procedural sprite in draw.js.
 */
export const CELESTIAL = [
  {
    id: 'moon',
    name: 'Moon',
    art: 'moon',
    realKm: 384400,
    radiusKm: 1737,
    gameY: 14000,
    x: 140,
    label: 'MOON FLYBY',
  },
  {
    id: 'venus',
    name: 'Venus',
    art: 'venus',
    realKm: 38000000,
    radiusKm: 6052,
    gameY: 28000,
    x: -150,
    label: 'VENUS FLYBY',
  },
  {
    id: 'mars',
    name: 'Mars',
    art: 'mars',
    realKm: 54600000, // closest approach ~54.6M km
    radiusKm: 3390,
    gameY: 42000,
    x: 155,
    label: 'MARS FLYBY',
  },
  {
    id: 'mercury',
    name: 'Mercury',
    art: 'mercury',
    // Closest approach ~77M km — farther than Venus/Mars at their closest.
    realKm: 77000000,
    radiusKm: 2440,
    gameY: 52000,
    x: -120,
    label: 'MERCURY FLYBY',
  },
  {
    id: 'sun',
    name: 'Sun',
    art: 'sun',
    realKm: 149600000, // 1 AU
    radiusKm: 696340,
    gameY: 68000,
    x: -40,
    label: 'SOLAR APPROACH',
  },
  {
    id: 'belt',
    name: 'Asteroid Belt',
    art: 'belt',
    realKm: 250000000,
    radiusKm: 500,
    gameY: 90000,
    x: 0,
    label: 'ASTEROID BELT',
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    art: 'jupiter',
    realKm: 588000000,
    radiusKm: 69911,
    gameY: 120000,
    x: 170,
    label: 'JUPITER FLYBY',
  },
  {
    id: 'saturn',
    name: 'Saturn',
    art: 'saturn',
    realKm: 1200000000,
    radiusKm: 58232,
    gameY: 155000,
    x: -175,
    label: 'SATURN FLYBY',
  },
  {
    id: 'uranus',
    name: 'Uranus',
    art: 'uranus',
    realKm: 2600000000,
    radiusKm: 25362,
    gameY: 195000,
    x: 130,
    label: 'URANUS FLYBY',
  },
  {
    id: 'neptune',
    name: 'Neptune',
    art: 'neptune',
    realKm: 4300000000,
    radiusKm: 24622,
    gameY: 240000,
    x: -140,
    label: 'NEPTUNE FLYBY',
  },
  {
    id: 'pluto',
    name: 'Pluto',
    art: 'pluto',
    realKm: 5000000000,
    radiusKm: 1188,
    gameY: 290000,
    x: 90,
    label: 'PLUTO FLYBY',
  },
];

/** Moon-relative visual scale; compressed so the Sun still fits the frame. */
export function bodyVisualScale(radiusKm) {
  const ref = 1737;
  const r = Math.max(200, radiusKm || ref);
  return Math.pow(r / ref, 0.34);
}

export const CELESTIAL_IDS = CELESTIAL.map((c) => c.id);

const KM_POINTS = [
  { g: 0, km: 0.001 },
  { g: ATM_GAME_UNITS, km: ATM_KM },
  ...CELESTIAL.map((c) => ({ g: c.gameY, km: c.realKm })),
];

/** Map game altitude → story kilometers (piecewise log beyond atmosphere). */
export function gameToKm(y) {
  y = Math.max(0, y);
  if (y <= ATM_GAME_UNITS) return (y / ATM_GAME_UNITS) * ATM_KM;

  for (let i = 1; i < KM_POINTS.length - 1; i++) {
    const a = KM_POINTS[i];
    const b = KM_POINTS[i + 1];
    if (y <= b.g) {
      const t = (y - a.g) / (b.g - a.g);
      return Math.exp(lerp(Math.log(a.km), Math.log(b.km), t));
    }
  }
  const a = KM_POINTS[KM_POINTS.length - 2];
  const b = KM_POINTS[KM_POINTS.length - 1];
  const t = (y - a.g) / (b.g - a.g);
  return Math.exp(lerp(Math.log(a.km), Math.log(b.km), Math.max(0, t)));
}

export function formatAltitudeKm(km) {
  if (km < 1) return `${(km * 1000).toFixed(0)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  if (km < 10000) return `${Math.round(km)} km`;
  if (km < 1e6) return `${(km / 1000).toFixed(1)}k km`;
  return `${(km / 1e6).toFixed(2)}M km`;
}

export function layerAtKm(km) {
  for (let i = 0; i < ATMO_LAYERS.length; i++) {
    const L = ATMO_LAYERS[i];
    if (km < L.km1 || i === ATMO_LAYERS.length - 1) return L;
  }
  return ATMO_LAYERS[ATMO_LAYERS.length - 1];
}

/** Smooth sky RGB for a given story-km altitude (one fill, gradual mix). */
export function skyColorAtKm(km) {
  km = Math.max(0, km);
  const stops = ATMO_LAYERS.map((L) => ({ km: L.km0, color: L.color }));
  const last = ATMO_LAYERS[ATMO_LAYERS.length - 1];
  stops.push({ km: last.km1, color: last.color });

  if (km <= stops[0].km) return stops[0].color.slice();
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (km <= b.km) {
      const t = clamp((km - a.km) / Math.max(1e-6, b.km - a.km), 0, 1);
      return [
        Math.round(lerp(a.color[0], b.color[0], t)),
        Math.round(lerp(a.color[1], b.color[1], t)),
        Math.round(lerp(a.color[2], b.color[2], t)),
      ];
    }
  }
  return stops[stops.length - 1].color.slice();
}

export function bodiesNear(camY, margin = 1400) {
  return CELESTIAL.filter((b) => Math.abs(b.gameY - camY) < margin);
}

/**
 * Next body still above the rocket, with story-km remaining and climb progress
 * from the previous waypoint (ground / last body).
 */
export function nextCelestial(gameY) {
  gameY = Math.max(0, gameY);
  let prevG = 0;
  let prevKm = 0;
  for (const body of CELESTIAL) {
    if (gameY < body.gameY) {
      const kmHere = gameToKm(gameY);
      const remainKm = Math.max(0, body.realKm - kmHere);
      const span = Math.max(1, body.gameY - prevG);
      const t = clamp((gameY - prevG) / span, 0, 1);
      return {
        body,
        remainKm,
        remainGame: body.gameY - gameY,
        progress: t,
        prevKm,
      };
    }
    prevG = body.gameY;
    prevKm = body.realKm;
  }
  return { body: null, remainKm: 0, remainGame: 0, progress: 1, prevKm };
}

/** Normalize persisted flyby flags; fold legacy passedMoon / passedMars. */
export function normalizeFlybys(raw, legacy = {}) {
  const out = {};
  if (raw && typeof raw === 'object') {
    for (const id of CELESTIAL_IDS) {
      if (raw[id]) out[id] = true;
    }
  }
  if (legacy.passedMoon) out.moon = true;
  if (legacy.passedMars) out.mars = true;
  return out;
}
