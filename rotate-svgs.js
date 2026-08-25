const fs = require('fs');
const path = require('path');

// Get all SVG files that are single uppercase letters
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const files = letters.map(l => `${l}.svg`).filter(f => fs.existsSync(f));

console.log(`Found ${files.length} letter SVG files to transform`);

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Parse the original dimensions
  const widthMatch = content.match(/width="(\d+)"/);
  const heightMatch = content.match(/height="(\d+)"/);
  const viewBoxMatch = content.match(/viewBox="([^"]+)"/);
  
  if (!widthMatch || !heightMatch || !viewBoxMatch) {
    console.log(`Skipping ${file} - couldn't parse dimensions`);
    return;
  }
  
  const originalWidth = parseInt(widthMatch[1]);
  const originalHeight = parseInt(heightMatch[1]);
  const viewBox = viewBoxMatch[1];
  
  // Assume we want to make it square using the width
  const newSize = originalWidth;
  const newViewBox = `0 0 ${newSize} ${newSize}`;
  
  // Calculate center points
  const centerX = newSize / 2;
  const centerY = newSize / 2;
  
  // Original content center
  const origCenterX = originalWidth / 2;
  const origCenterY = originalHeight / 2;
  
  // Offset to center the original content in the new square canvas
  const offsetY = (newSize - originalHeight) / 2;
  
  // Extract the content between the opening svg tag and closing svg tag
  const svgOpenMatch = content.match(/<svg[^>]*>/);
  const svgCloseMatch = content.match(/<\/svg>/);
  
  if (!svgOpenMatch || !svgCloseMatch) {
    console.log(`Skipping ${file} - couldn't parse SVG structure`);
    return;
  }
  
  const innerContent = content.substring(
    content.indexOf(svgOpenMatch[0]) + svgOpenMatch[0].length,
    content.indexOf(svgCloseMatch[0])
  );
  
  // Build new SVG with rotated content
  const newSvg = `<svg width="${newSize}" height="${newSize}" viewBox="${newViewBox}" fill="none" xmlns="http://www.w3.org/2000/svg">
<g transform="translate(${centerX},${centerY}) rotate(-45) translate(${-origCenterX},${-origCenterY + offsetY})">
${innerContent}
</g>
</svg>`;
  
  // Write to new file
  const outputFile = file.replace('.svg', ' PreRotated.svg');
  fs.writeFileSync(outputFile, newSvg);
  console.log(`✓ Created ${outputFile}`);
});

console.log('Done!');
