const CHAR_ENCODING = {
  'A': 'VHH',
  'B': 'HVC',
  'C': 'VCV',
  'D': 'HCH',
  'E': 'CCC',
  'F': 'CVH',
  'G': 'HCC',
  'H': 'VVH',
  'I': 'HHV',
  'J': 'VCC',
  'K': 'CHC',
  'L': 'HHC',
  'M': 'VVC',
  'N': 'HVV',
  'O': 'HVH',
  'P': 'HHH',
  'Q': 'CCH',
  'R': 'CHH',
  'S': 'VHV',
  'T': 'VVV',
  'U': 'CVV',
  'V': 'VCH',
  'W': 'HCV',
  'X': 'CVC',
  'Y': 'VHC',
  'Z': 'CCV',
  ' ': 'BBB'
};

// Generate all possible B-variants for each uppercase letter
function generateVariants(code) {
  const variants = [];
  for (let i = 0; i < 3; i++) {
    variants.push(code.substring(0, i) + 'B' + code.substring(i + 1));
  }
  return variants;
}

// Backtracking algorithm to find valid assignment
function findAssignment(letters, index, used, assignment) {
  // Base case: all letters assigned
  if (index === letters.length) {
    return true;
  }
  
  const letter = letters[index];
  const code = CHAR_ENCODING[letter];
  const variants = generateVariants(code);
  
  // Try each variant for this letter
  for (const variant of variants) {
    if (!used.has(variant)) {
      // Try this assignment
      used.add(variant);
      assignment[letter.toLowerCase()] = variant;
      
      // Recurse
      if (findAssignment(letters, index + 1, used, assignment)) {
        return true;
      }
      
      // Backtrack
      used.delete(variant);
      delete assignment[letter.toLowerCase()];
    }
  }
  
  return false;
}

// Main function
function findLowercaseAssignments() {
  const uppercaseLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const used = new Set(['BBB']); // Space is reserved
  const assignment = {};
  
  if (findAssignment(uppercaseLetters, 0, used, assignment)) {
    return assignment;
  } else {
    return null;
  }
}

// Analyze collisions first
console.log("=== COLLISION ANALYSIS ===\n");
const uppercaseLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const variantMap = new Map(); // maps variant -> list of letters that can produce it

for (const letter of uppercaseLetters) {
  const variants = generateVariants(CHAR_ENCODING[letter]);
  variants.forEach((variant, idx) => {
    if (!variantMap.has(variant)) {
      variantMap.set(variant, []);
    }
    variantMap.get(variant).push({letter, position: idx});
  });
}

// Show collisions
let collisionCount = 0;
for (const [variant, sources] of variantMap.entries()) {
  if (sources.length > 1) {
    console.log(`Collision: ${variant} can be made from: ${sources.map(s => `${s.letter}[pos${s.position}]`).join(', ')}`);
    collisionCount++;
  }
}
console.log(`\nTotal collisions: ${collisionCount}\n`);

// Find the assignment
console.log("=== FINDING ASSIGNMENT ===\n");
const result = findLowercaseAssignments();

if (result) {
  console.log("✓ SUCCESS! Valid assignment found:\n");
  
  // Display results in order
  for (let i = 0; i < 26; i++) {
    const upper = String.fromCharCode(65 + i);
    const lower = String.fromCharCode(97 + i);
    const upperCode = CHAR_ENCODING[upper];
    const lowerCode = result[lower];
    
    // Find which position was replaced
    let pos = -1;
    for (let j = 0; j < 3; j++) {
      if (upperCode[j] !== lowerCode[j]) {
        pos = j;
        break;
      }
    }
    
    console.log(`  '${lower}': '${lowerCode}',  // ${upper} (${upperCode}) with position ${pos} replaced`);
  }
  
  // Generate complete CHAR_ENCODING object
  console.log("\n\n=== COMPLETE CHAR_ENCODING FOR COPY-PASTE ===\n");
  console.log("const CHAR_ENCODING = {");
  
  // Uppercase
  for (let i = 0; i < 26; i++) {
    const upper = String.fromCharCode(65 + i);
    console.log(`  '${upper}': '${CHAR_ENCODING[upper]}',`);
  }
  console.log(`  ' ': 'BBB',`);
  
  // Lowercase
  for (let i = 0; i < 26; i++) {
    const lower = String.fromCharCode(97 + i);
    const lowerCode = result[lower];
    console.log(`  '${lower}': '${lowerCode}',`);
  }
  console.log("};");
  
} else {
  console.log("✗ FAILED: No valid assignment exists with this encoding.");
}