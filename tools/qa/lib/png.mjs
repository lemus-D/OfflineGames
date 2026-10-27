/* Just enough PNG to read Playwright screenshots (8-bit, non-interlaced)
   and write composites, plus the image statistics the probes need. */

import { crc32, deflateSync, inflateSync } from 'node:zlib';

const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

export function decodePng(buf) {
  let pos = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      channels = CHANNELS[data[9]];
      if (data[8] !== 8 || data[12] !== 0 || !channels) throw new Error('unsupported PNG format');
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[y * stride + x - channels] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0;
      let v = raw[line + x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      out[y * stride + x] = v & 255;
    }
  }
  return { width, height, channels, data: out };
}

const COLOUR_TYPE = { 1: 0, 2: 4, 3: 2, 4: 6 };

export function encodePng({ width, height, channels, data }) {
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = COLOUR_TYPE[channels];
  const chunk = (type, body) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed));
    return Buffer.concat([len, typed, crc]);
  };
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Luminance spread, distinct colours and near-black share, on ~10k samples. */
export function imageStats(img) {
  const { width, height, channels, data } = img;
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 10000)));
  const colours = new Set();
  let n = 0;
  let sum = 0;
  let sumSq = 0;
  let black = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = channels >= 3 ? data[i + 1] : r;
      const b = channels >= 3 ? data[i + 2] : r;
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      sum += lum;
      sumSq += lum * lum;
      if (lum < 0.04) black += 1;
      colours.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
      n += 1;
    }
  }
  const mean = sum / n;
  return {
    meanLum: round(mean),
    lumStd: round(Math.sqrt(Math.max(0, sumSq / n - mean * mean))),
    distinctColours: colours.size,
    nearBlack: round(black / n),
  };
}

function round(x) {
  return Math.round(x * 1000) / 1000;
}
