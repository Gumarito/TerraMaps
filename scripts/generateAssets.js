const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// 1x1 pixel dark PNG (#0b0f19)
const darkPixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/+pVPQAJOANqg8e46gAAAABJRU5ErkJggg==',
  'base64'
);

const files = ['icon.png', 'splash-icon.png', 'adaptive-icon.png', 'favicon.png'];
for (const file of files) {
  const filePath = path.join(assetsDir, file);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, darkPixelPng);
    console.log(`Created asset: ${file}`);
  }
}
