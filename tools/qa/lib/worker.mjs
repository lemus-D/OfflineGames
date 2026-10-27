/* One bot-runner thread. Loads the game's adapter once, then runs episodes. */

import { parentPort, workerData } from 'node:worker_threads';
import { runEpisode } from './episode.mjs';

const adapter = (await import(workerData.adapterUrl)).default;

parentPort.on('message', (job) => {
  parentPort.postMessage(runEpisode(adapter, job));
});
