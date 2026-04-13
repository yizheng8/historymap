const fs = require('fs');
const sharp = require('sharp');

function createSvgIcon(size) {
  const fontSize = Math.round(size * 0.25);
  const subFontSize = Math.round(size * 0.12);
  const rx = Math.round(size * 0.15);
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '">',
    '  <rect width="' + size + '" height="' + size + '" rx="' + rx + '" fill="#1976d2"/>',
    '  <text x="50%" y="42%" font-family="sans-serif" font-size="' + fontSize + '" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">历史</text>',
    '  <text x="50%" y="68%" font-family="sans-serif" font-size="' + subFontSize + '" fill="rgba(255,255,255,0.9)" text-anchor="middle" dominant-baseline="middle">学习地图</text>',
    '</svg>'
  ].join('\n');
}

async function main() {
  for (const size of [192, 512]) {
    const svg = Buffer.from(createSvgIcon(size));
    await sharp(svg).png().toFile('public/pwa-' + size + 'x' + size + '.png');
    console.log('Created pwa-' + size + 'x' + size + '.png');
  }
}

main();
