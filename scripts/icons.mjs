// Generates simple purple rounded-square padlock PNG icons for the extension.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const cov = (d) => clamp01(0.5 - d);

function sdRoundRect(x, y, cx, cy, hw, hh, r) {
  const qx = Math.abs(x - cx) - hw + r;
  const qy = Math.abs(y - cy) - hh + r;
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
}
const sdCircle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r;

function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const BG = [99, 102, 241]; // indigo
  const FG = [255, 255, 255];
  for (let yy = 0; yy < size; yy++) {
    for (let xx = 0; xx < size; xx++) {
      const x = xx + 0.5;
      const y = yy + 0.5;
      const s = size;
      const bgD = sdRoundRect(x, y, s / 2, s / 2, s / 2 - s * 0.02, s / 2 - s * 0.02, s * 0.22);
      const b = cov(bgD);
      if (b <= 0) continue;
      // shackle ring
      const ring = Math.abs(sdCircle(x, y, s / 2, s * 0.44, s * 0.155)) - s * 0.045;
      // body
      const body = sdRoundRect(x, y, s / 2, s * 0.63, s * 0.205, s * 0.155, s * 0.07);
      const lockD = Math.min(ring, body);
      const l = cov(lockD);
      // keyhole punched in body color
      const hole = sdCircle(x, y, s / 2, s * 0.60, s * 0.055);
      const h = cov(hole);
      let [r, g, bl] = BG;
      if (l > 0) {
        r = r * (1 - l) + FG[0] * l;
        g = g * (1 - l) + FG[1] * l;
        bl = bl * (1 - l) + FG[2] * l;
      }
      if (h > 0) {
        r = r * (1 - h) + BG[0] * h;
        g = g * (1 - h) + BG[1] * h;
        bl = bl * (1 - h) + BG[2] * h;
      }
      const i = (yy * size + xx) * 4;
      px[i] = Math.round(r);
      px[i + 1] = Math.round(g);
      px[i + 2] = Math.round(bl);
      px[i + 3] = Math.round(b * 255);
    }
  }
  return encodePng(size, px);
}

mkdirSync(join(root, "src", "assets"), { recursive: true });
for (const size of [16, 48, 128]) {
  writeFileSync(join(root, "src", "assets", `icon${size}.png`), render(size));
  console.log(`icon${size}.png written`);
}
