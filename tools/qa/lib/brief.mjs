/* Read a game's QC brief and qa/expect.json — the thresholds the checks use. */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/** Parse the `## QC brief` table of <Game>/<GAME>PLAN.md into { field: value }. */
export function readBrief(gameDir) {
  const plan = readdirSync(gameDir).find((f) => /PLAN\.md$/i.test(f) && f !== 'PLAYTEST.md');
  if (!plan) return {};
  const text = readFileSync(path.join(gameDir, plan), 'utf8');
  const section = text.split(/^## /m).find((s) => /^QC brief/i.test(s));
  if (!section) return {};

  const brief = {};
  for (const line of section.split('\n')) {
    const cells = line.split('|').map((c) => c.trim().replace(/[*`]/g, ''));
    if (cells.length < 4) continue;
    const [, field, value] = cells;
    if (!field || /^-+$/.test(field) || /^field$/i.test(field)) continue;
    brief[field.toLowerCase()] = value;
  }
  return brief;
}

/** "45 s – 4 min" → [45, 240]. A single duration gives [d, d]. */
export function parseDurations(text) {
  if (!text) return null;
  const units = { s: 1, sec: 1, secs: 1, second: 1, seconds: 1, m: 60, min: 60, mins: 60, minute: 60, minutes: 60 };
  const found = [];
  const re = /(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m)\b/gi;
  let m;
  while ((m = re.exec(text))) found.push(Number(m[1]) * units[m[2].toLowerCase()]);
  if (!found.length) return null;
  return [Math.min(...found), Math.max(...found)];
}

export function readExpect(gameDir) {
  const file = path.join(gameDir, 'qa', 'expect.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
}

/** Which input families the brief requires: { keyboard, touch }. */
export function requiredInputs(brief) {
  const v = (brief.inputs || '').toLowerCase();
  return {
    keyboard: v === 'both' || /key|mouse|desktop/.test(v),
    touch: v === 'both' || /touch|mobile|tap|swipe/.test(v),
  };
}
