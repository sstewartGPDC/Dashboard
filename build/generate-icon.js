// Generate a simple GPDC-branded icon as a PNG using pure Node.js
// Creates a 1024x1024 PNG with the GPDC logo colors

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// We'll create a simple SVG and convert it using sips
const size = 1024;
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#B85C38;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#E07A5F;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background rounded rect -->
  <rect width="${size}" height="${size}" rx="220" ry="220" fill="url(#bg)" />

  <!-- Dashboard chart icon -->
  <!-- Bar chart bars -->
  <rect x="220" y="520" width="120" height="280" rx="20" fill="url(#accent)" opacity="0.7" />
  <rect x="390" y="380" width="120" height="420" rx="20" fill="url(#accent)" opacity="0.85" />
  <rect x="560" y="280" width="120" height="520" rx="20" fill="url(#accent)" />
  <rect x="730" y="440" width="120" height="360" rx="20" fill="url(#accent)" opacity="0.75" />

  <!-- Trend line -->
  <polyline points="280,480 450,340 620,240 790,400"
    stroke="white" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.9" />

  <!-- Dots on trend line -->
  <circle cx="280" cy="480" r="14" fill="white" />
  <circle cx="450" cy="340" r="14" fill="white" />
  <circle cx="620" cy="240" r="14" fill="white" />
  <circle cx="790" cy="400" r="14" fill="white" />

  <!-- GPDC text -->
  <text x="512" y="200" font-family="Helvetica Neue, Arial, sans-serif" font-size="120" font-weight="700"
    fill="white" text-anchor="middle" letter-spacing="16">GPDC</text>
</svg>`;

const buildDir = path.join(__dirname);
const svgPath = path.join(buildDir, 'icon.svg');
const pngPath = path.join(buildDir, 'icon.png');

// Write SVG
fs.writeFileSync(svgPath, svg);

// Convert SVG to PNG using sips (macOS built-in) — but sips doesn't handle SVG well
// Instead, use the qlmanage or python approach
try {
  // Try using python3 with cairosvg or Pillow
  execSync(`python3 -c "
import subprocess, sys
try:
    import cairosvg
    cairosvg.svg2png(url='${svgPath}', write_to='${pngPath}', output_width=1024, output_height=1024)
except ImportError:
    # Fallback: use rsvg-convert if available
    subprocess.run(['rsvg-convert', '-w', '1024', '-h', '1024', '${svgPath}', '-o', '${pngPath}'], check=True)
"`, { stdio: 'pipe' });
} catch (e) {
  // Last fallback: use qlmanage for conversion
  try {
    execSync(`qlmanage -t -s 1024 -o "${buildDir}" "${svgPath}" 2>/dev/null && mv "${buildDir}/icon.svg.png" "${pngPath}"`, { stdio: 'pipe' });
  } catch (e2) {
    // Final fallback: just write the SVG and we'll handle it manually
    console.log('Could not convert SVG to PNG automatically.');
    console.log('SVG saved to:', svgPath);
    process.exit(0);
  }
}

console.log('PNG icon created at:', pngPath);

// Now create .icns from PNG using iconutil
const iconsetDir = path.join(buildDir, 'icon.iconset');
if (!fs.existsSync(iconsetDir)) fs.mkdirSync(iconsetDir);

const sizes = [
  [16, '16x16', '1x'],
  [32, '16x16', '2x'],
  [32, '32x32', '1x'],
  [64, '32x32', '2x'],
  [128, '128x128', '1x'],
  [256, '128x128', '2x'],
  [256, '256x256', '1x'],
  [512, '256x256', '2x'],
  [512, '512x512', '1x'],
  [1024, '512x512', '2x'],
];

for (const [px, name, scale] of sizes) {
  const suffix = scale === '2x' ? `@2x` : '';
  const outFile = path.join(iconsetDir, `icon_${name}${suffix}.png`);
  execSync(`sips -z ${px} ${px} "${pngPath}" --out "${outFile}" 2>/dev/null`);
}

// Generate .icns
execSync(`iconutil -c icns "${iconsetDir}" -o "${path.join(buildDir, 'icon.icns')}"`);

// Cleanup
fs.rmSync(iconsetDir, { recursive: true, force: true });
fs.unlinkSync(svgPath);

console.log('icon.icns created successfully!');
