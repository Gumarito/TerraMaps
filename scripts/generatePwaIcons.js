const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPng(width, height, r, g, b) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth 8
  ihdr.writeUInt8(6, 9); // RGBA color type
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(12 + len);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    const crc = crc32(buf.slice(4, 8 + len));
    buf.writeInt32BE(crc, 8 + len);
    return buf;
  }

  // Generate image data with a circular/hexagonal radar gradient
  const rawData = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;
  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.42;

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius) {
        // Inner circle with neon cyan/mint accent (#00f5d4)
        const factor = dist / radius;
        if (dist > radius - 6) {
          // Border glow
          rawData[offset++] = 0x00; // R
          rawData[offset++] = 0xf5; // G
          rawData[offset++] = 0xd4; // B
          rawData[offset++] = 255;
        } else {
          // Tactical dark fill with subtle radial tint
          rawData[offset++] = Math.round(11 + 20 * (1 - factor));
          rawData[offset++] = Math.round(15 + 40 * (1 - factor));
          rawData[offset++] = Math.round(25 + 70 * (1 - factor));
          rawData[offset++] = 255;
        }
      } else {
        // Background #0b0f19
        rawData[offset++] = 0x0b;
        rawData[offset++] = 0x0f;
        rawData[offset++] = 0x19;
        rawData[offset++] = 255;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Simple CRC32 implementation
function crc32(buf) {
  let table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return crc ^ -1;
}

// Target directories
const publicIconsDir = path.join(__dirname, '..', 'public', 'icons');
const assetsDir = path.join(__dirname, '..', 'assets');
[publicIconsDir, assetsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const icon192 = createPng(192, 192, 0, 245, 212);
const icon512 = createPng(512, 512, 0, 245, 212);

fs.writeFileSync(path.join(publicIconsDir, 'icon-192.png'), icon192);
fs.writeFileSync(path.join(publicIconsDir, 'icon-512.png'), icon512);
fs.writeFileSync(path.join(assetsDir, 'icon-192.png'), icon192);
fs.writeFileSync(path.join(assetsDir, 'icon-512.png'), icon512);
fs.writeFileSync(path.join(assetsDir, 'icon.png'), icon512);
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), icon512);
fs.writeFileSync(path.join(assetsDir, 'splash-icon.png'), icon512);
fs.writeFileSync(path.join(assetsDir, 'favicon.png'), icon192);

console.log('Successfully generated 192x192 and 512x512 PWA icons in assets/ and public/icons/');
