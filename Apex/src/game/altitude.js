/* Real-ish altitude: atmosphere layers + Moon / Mars flybys.
   Game Y is compressed so atmosphere plays out early; deep space
   stretches so the Moon and Mars are ambitious Easter eggs. */

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
    color: [90, 150, 220], // bright day blue
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
    id: 'interplanetary',
    name: 'Deep space',
    km0: 384400,
    km1: 54600000,
    color: [4, 5, 10],
  },
];

/** Easter-egg bodies. realKm = average Moon / closest Mars approach. */
export const CELESTIAL = [
  {
    id: 'moon',
    name: 'Moon',
    realKm: 384400,
    gameY: 14000,
    x: 140,
    label: 'MOON FLYBY',
  },
  {
    id: 'mars',
    name: 'Mars',
    realKm: 54600000, // closest approach ~54.6M km
    gameY: 52000,
    x: -160,
    label: 'MARS FLYBY',
  },
];

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

export function bodiesNear(camY, margin = 900) {
  return CELESTIAL.filter((b) => Math.abs(b.gameY - camY) < margin);
}
