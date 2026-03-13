// Node script to generate PNG icons from SVG
// Run: node generate-icons.js
// Requires: npm install sharp (or use the SVG fallback below)

const fs = require('fs');
const path = require('path');

// Inline SVG for the icon
const svgTemplate = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#6366f1"/>
  <rect x="80" y="120" width="160" height="24" rx="12" fill="white" opacity="0.9"/>
  <rect x="80" y="164" width="120" height="24" rx="12" fill="white" opacity="0.55"/>
  <rect x="80" y="208" width="140" height="24" rx="12" fill="white" opacity="0.55"/>
  <rect x="272" y="120" width="160" height="24" rx="12" fill="#fbbf24" opacity="0.9"/>
  <rect x="272" y="164" width="110" height="24" rx="12" fill="#fbbf24" opacity="0.55"/>
  <rect x="80" y="300" width="352" height="2" rx="1" fill="white" opacity="0.15"/>
  <text x="256" y="430" text-anchor="middle" font-family="-apple-system,sans-serif" font-weight="700" font-size="72" fill="white" opacity="0.95">MyDay</text>
</svg>`;

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

sizes.forEach(size => {
  const svg = svgTemplate(size);
  fs.writeFileSync(path.join(__dirname, 'icons', `icon-${size}.svg`), svg);
});

console.log('SVG icons generated. To convert to PNG, use:');
console.log('  npm install sharp && node convert-icons.js');
console.log('Or use any SVG→PNG converter online.');
