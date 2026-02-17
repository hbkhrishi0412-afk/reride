const fs = require('fs');

const file = 'api/main.ts';
let content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

// Fix lines 2391-2392 (POST endpoint - first two console.log statements)
if (lines[2390] && lines[2390].includes('📥 POST /vehicles') && 
    lines[2391] && lines[2391].includes('📸 Images in request body')) {
  // Replace the first console.log with if statement opening
  lines[2390] = '    if (process.env.NODE_ENV !== \'production\') {';
  // Indent the existing console.log statements
  lines[2391] = '      ' + lines[2391].trim();
  // Insert closing brace after the second console.log
  lines.splice(2392, 0, '    }');
}

// Fix line 2417 (POST endpoint - normalized images console.log)
if (lines[2416] && lines[2416].includes('📸 Vehicle images being saved')) {
  const originalLine = lines[2416];
  lines[2416] = '    if (process.env.NODE_ENV !== \'production\') {';
  lines.splice(2417, 0, '      ' + originalLine.trim());
  lines.splice(2418, 0, '    }');
}

// Fix line 2446 (PUT endpoint - images in request body)
// Need to check - line numbers may have shifted after previous edits
let putImagesLine = -1;
for (let i = 2440; i < 2450; i++) {
  if (lines[i] && lines[i].includes('📸 Images in request body') && 
      lines[i].includes('PUT') === false) { // Make sure it's in PUT context
    putImagesLine = i;
    break;
  }
}

if (putImagesLine >= 0) {
  const originalLine = lines[putImagesLine];
  lines[putImagesLine] = '      if (process.env.NODE_ENV !== \'production\') {';
  lines.splice(putImagesLine + 1, 0, '        ' + originalLine.trim());
  lines.splice(putImagesLine + 2, 0, '      }');
}

// Fix line 2475 (PUT endpoint - normalized images console.log)
let putNormalizedLine = -1;
for (let i = 2470; i < 2480; i++) {
  if (lines[i] && lines[i].includes('📸 Vehicle images being updated')) {
    putNormalizedLine = i;
    break;
  }
}

if (putNormalizedLine >= 0) {
  const originalLine = lines[putNormalizedLine];
  lines[putNormalizedLine] = '      if (process.env.NODE_ENV !== \'production\') {';
  lines.splice(putNormalizedLine + 1, 0, '        ' + originalLine.trim());
  lines.splice(putNormalizedLine + 2, 0, '      }');
}

// Write back to file
content = lines.join('\n');
fs.writeFileSync(file, content, 'utf8');
console.log('Fixed all console.log statements with NODE_ENV checks');

































