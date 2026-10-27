/* Turn-based profile: games decided one move at a time — pool, cards,
   tactics. Picked by adapters that set `profile: 'turn'`.

   Two shapes:
     seats: 2  both sides are bots; every rung plays every rung, in both seats
     seats: 1  the bot plays against the game's own AI; `variants` (e.g.
               difficulty levels, easiest first) are each played separately

   As with arcade, every check compares rungs of the ladder or a rung
   against the brief, and nothing here knows which game it is. */

import { eventRule, invariantsCheck } from '../lib/rules.mjs';

export const name = 'turn';

/** No idle rung: "pass" is rarely a move. humanish = one move of lookahead
    plus mistakes; searcher = a few moves, both sides, more rollouts. */
export const ladder = {
  random: { type: 'random' },
  humanish: { type: 'search', horizon: 1, rollouts: 1, noise: 0.15 },
  searcher: { type: 'search', horizon: 3, rollouts: 4 },
};

const RUNGS = Object.keys(ladder);

export function matchups(adapter) {
  if ((adapter.seats || 1) > 1) {
    return RUNGS.flatMap((a) => RUNGS.map((b) => ({ key: `${a} vs ${b}`, players: [a, b] })));
  }
  const variants = adapter.variants || [undefined];
  return RUNGS.flatMap((name) =>
    variants.map((variant) => ({ key: variant ? `${name} @ ${variant}` : name, players: [name], variant }))
  );
}

export function replayKeys(adapter) {
  if ((adapter.seats || 1) > 1) return { moments: 'humanish vs humanish', long: 'searcher vs searcher' };
  const v = adapter.variants?.[0];
  return { moments: v ? `humanish @ ${v}` : 'humanish', long: v ? `searcher @ ${v}` : 'searcher' };
}

export function limits({ expect }) {
  return { maxSeconds: expect.maxSeconds ?? 3600, maxDecisions: expect.maxTurns ?? 300 };
}

export function checks(m, { adapter, runBand, expect }) {
  const out = [];
  const add = (id, status, detail, why) => out.push({ id, status, detail, why });
  const pct = (x) => `${Math.round(x * 100)}%`;
  const twoSeat = (adapter.seats || 1) > 1;

  // Every game has to end.
  const capped = Object.entries(m).filter(([, b]) => b.ends.capped);
  add(
    'games-finish',
    capped.length ? 'fail' : 'pass',
    capped.length
      ? capped.map(([k, b]) => `${k}: ${b.ends.capped}/${b.runs} hit the turn cap`).join('; ')
      : `every game ended within ${expect.maxTurns ?? 300} turns`,
    'A game that can go on forever has a stalemate or a softlock in it.'
  );

  if (twoSeat) {
    // Win rate of rung `a` against rung `b`, averaged over both seatings.
    const beats = (a, b) => {
      const first = m[`${a} vs ${b}`];
      const second = m[`${b} vs ${a}`];
      return ((first.winners[0] || 0) + (second.winners[1] || 0)) / (first.runs + second.runs);
    };

    const skill = beats('searcher', 'random');
    const need = expect.skillWinRate ?? 0.7;
    add(
      'skill-matters',
      skill >= need ? 'pass' : 'fail',
      `searcher beats random ${pct(skill)} of games (needs ${pct(need)})`,
      'If random moves win as often as considered ones, there is no strategy to learn.'
    );

    const steps = [beats('humanish', 'random'), beats('searcher', 'humanish')];
    add(
      'ladder-ordered',
      steps.every((x) => x >= 0.5) ? 'pass' : 'fail',
      `humanish beats random ${pct(steps[0])}, searcher beats humanish ${pct(steps[1])}`,
      'Thinking further ahead should win more. If not, deeper play is not rewarded.'
    );

    const mirror = m['searcher vs searcher'];
    const firstSeat = (mirror.winners[0] || 0) / mirror.runs;
    const tol = expect.seatTolerance ?? 0.2;
    add(
      'seat-balance',
      Math.abs(firstSeat - 0.5) <= tol ? 'pass' : 'warn',
      `searcher mirror: first seat wins ${pct(firstSeat)} (fair is 50% ± ${pct(tol)})`,
      'A big first-move advantage decides games before anyone plays.'
    );

    const draws = (mirror.winners.draw || 0) / mirror.runs;
    if (draws > (expect.maxDrawRate ?? 0.5)) {
      add('draws', 'warn', `searcher mirror: ${pct(draws)} draws`, 'Strong play that mostly draws feels pointless.');
    }
  } else {
    const variants = adapter.variants || [undefined];
    const at = (rung, v) => m[v ? `${rung} @ ${v}` : rung];
    const avg = (rung) => variants.reduce((sum, v) => sum + at(rung, v).winRate, 0) / variants.length;

    const gap = avg('searcher') - avg('random');
    const need = expect.skillGap ?? 0.3;
    add(
      'skill-matters',
      gap >= need ? 'pass' : 'fail',
      `win rate vs the game's AI: searcher ${pct(avg('searcher'))}, random ${pct(avg('random'))} (gap needs ${pct(need)})`,
      'If random moves do as well as considered ones, there is no strategy to learn.'
    );

    const slack = 0.05;
    const ordered = avg('searcher') + slack >= avg('humanish') && avg('humanish') + slack >= avg('random');
    add(
      'ladder-ordered',
      ordered ? 'pass' : 'fail',
      `searcher ${pct(avg('searcher'))} ≥ humanish ${pct(avg('humanish'))} ≥ random ${pct(avg('random'))}`,
      'Thinking further ahead should win more. If not, deeper play is not rewarded.'
    );

    if (variants.length > 1) {
      const rates = variants.map((v) => at('searcher', v).winRate);
      const monotonic = rates.every((r, i) => i === 0 || r <= rates[i - 1] + slack);
      add(
        'variants-ordered',
        monotonic ? 'pass' : 'fail',
        `searcher win rate by variant: ${variants.map((v, i) => `${v} ${pct(rates[i])}`).join(', ')}`,
        'Each harder setting should actually be harder (Break needed this for its AI tiers).'
      );
      const hardest = rates[rates.length - 1];
      add(
        'hardest-beatable',
        hardest > 0 ? 'pass' : 'warn',
        `searcher wins ${pct(hardest)} on ${variants[variants.length - 1]}`,
        'A top difficulty nobody can beat reads as broken, not hard.'
      );
    }
  }

  // Length: in turns if the plan says so; in minutes only if we know a turn's real duration.
  const typical = m[replayKeys(adapter).moments];
  if (expect.turns) {
    const [lo, hi] = expect.turns;
    const p50 = typical.decisions.p50;
    add(
      'game-length',
      p50 >= lo && p50 <= hi ? 'pass' : 'fail',
      `typical game ${p50} turns (expect ${lo}–${hi})`,
      'Games much shorter or longer than planned change what the game is.'
    );
  } else if (runBand && expect.secondsPerTurn) {
    const est = typical.decisions.p50 * expect.secondsPerTurn;
    add(
      'game-length',
      est >= runBand[0] && est <= runBand[1] ? 'pass' : 'fail',
      `typical game ${typical.decisions.p50} turns × ${expect.secondsPerTurn} s ≈ ${Math.round(est)} s; run_band ${runBand[0]}–${runBand[1]} s`,
      'A game should fit the session length the brief promises.'
    );
  } else {
    add(
      'game-length',
      'skip',
      `typical game ${typical.decisions.p50} turns; set expect.turns or expect.secondsPerTurn to check it`,
      'Real time per turn depends on thinking time, which bots cannot measure.'
    );
  }

  for (const rule of expect.events || []) out.push(eventRule(m, rule, replayKeys(adapter).moments));
  out.push(invariantsCheck(m));
  return out;
}
