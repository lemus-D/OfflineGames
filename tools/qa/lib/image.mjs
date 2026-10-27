/* Image composites for agents: A|B pairs and filmstrip grids. Works on the
   { width, height, channels, data } images png.mjs decodes. */

import { readFileSync } from 'node:fs';
import { decodePng } from './png.mjs';

const GAP = 12;
const BACKDROP = [24, 24, 28];

export function readPng(file) {
  return toRGB(decodePng(readFileSync(file)));
}

function toRGB(img) {
  if (img.channels === 3) return img;
  const data = Buffer.alloc(img.width * img.height * 3);
  for (let i = 0, j = 0; i < img.width * img.height; i++, j += 3) {
    const k = i * img.channels;
    const grey = img.channels <= 2;
    data[j] = img.data[k];
    data[j + 1] = grey ? img.data[k] : img.data[k + 1];
    data[j + 2] = grey ? img.data[k] : img.data[k + 2];
  }
  return { width: img.width, height: img.height, channels: 3, data };
}

/** Shrink by an integer factor, averaging each block. */
export function shrink(img, factor) {
  if (factor <= 1) return img;
  const width = Math.floor(img.width / factor);
  const height = Math.floor(img.height / factor);
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let dy = 0; dy < factor; dy++) {
          for (let dx = 0; dx < factor; dx++) {
            sum += img.data[((y * factor + dy) * img.width + x * factor + dx) * 3 + c];
          }
        }
        data[(y * width + x) * 3 + c] = Math.round(sum / (factor * factor));
      }
    }
  }
  return { width, height, channels: 3, data };
}

/** Tile images left-to-right, top-to-bottom, `cols` per row. */
export function grid(images, cols) {
  const cellW = Math.max(...images.map((i) => i.width));
  const cellH = Math.max(...images.map((i) => i.height));
  const rows = Math.ceil(images.length / cols);
  const width = cols * cellW + (cols + 1) * GAP;
  const height = rows * cellH + (rows + 1) * GAP;
  const data = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) data.set(BACKDROP, i * 3);
  images.forEach((img, n) => {
    const ox = GAP + (n % cols) * (cellW + GAP);
    const oy = GAP + Math.floor(n / cols) * (cellH + GAP);
    for (let y = 0; y < img.height; y++) {
      img.data.copy(data, ((oy + y) * width + ox) * 3, y * img.width * 3, (y + 1) * img.width * 3);
    }
  });
  return { width, height, channels: 3, data };
}

export function sideBySide(a, b) {
  return grid([a, b], 2);
}
