/* Small helpers over the adapter contract, shared by the runner and the bots. */

import { cloneState } from './clone.mjs';

export function isDecisionPoint(adapter, session, tick) {
  if (adapter.awaitingDecision) return adapter.awaitingDecision(session);
  return tick % adapter.ticksPerDecision === 0;
}

export function cloneSession(adapter, session) {
  return adapter.clone ? adapter.clone(session) : cloneState(session);
}

export function drainShared(adapter, session) {
  const out = [];
  for (const raw of adapter.drainEvents(session)) {
    const ev = adapter.mapEvent(raw);
    if (ev) out.push(ev);
  }
  return out;
}
