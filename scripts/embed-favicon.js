const fs = require('fs');
const path = require('path');

const pngPath = path.join(__dirname, '..', 'public', 'logo', 'remix_logo_1.png');
const svgPath = path.join(__dirname, '..', 'public', 'logo', 'favicon.svg');

const buf = fs.readFileSync(pngPath);
const b64 = buf.toString('base64');
const dataUri = 'data:image/png;base64,' + b64;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <clipPath id="c"><circle cx="16" cy="16" r="16"/></clipPath>
  </defs>
  <image href="${dataUri}" x="0" y="0" width="32" height="32" clip-path="url(#c)" preserveAspectRatio="xMidYMid slice"/>
</svg>`;

fs.writeFileSync(svgPath, svg);
console.log('Favicon SVG written with embedded remix logo.');
