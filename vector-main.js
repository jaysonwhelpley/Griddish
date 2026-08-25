/* CrossHatch Alphabet - Vector Composer
 - Characters are encoded as three-stroke combinations (H=Horizontal, V=Vertical, C=Cross)
 - Strokes overlap by 1/6 of their width
 - Each stroke is a 300x300 SVG
*/

(function () {
  const STROKE_SIZE = 300; // Base size of each vector stroke
  // Extra overdraw (in px) to ensure butt-capped joints overlap after rotation/scaling
    const JOINT_OVERLAP_PX = 2.0; // fixed overlap for butt-capped joints
    let MAX_CHARS_PER_LINE = 40; // updated from UI each render
  const OVERLAP_FRACTION = 1/5; // Strokes overlap by 1/5 of their width
  const STROKE_ADVANCE = STROKE_SIZE * (1 - OVERLAP_FRACTION); // 240px per stroke (internal spacing within a character)
  const CHAR_WIDTH = STROKE_ADVANCE * 3; // Three strokes per character (720px before rotation)
  // Full, unrotated bounding width across all three 300px tiles (0, 240, 480 offsets)
  const CHAR_FULL_WIDTH = STROKE_SIZE + (2 * STROKE_ADVANCE); // 780px
  
  // We rotate the WHOLE block by 45° CCW once.
  const ROTATION_ANGLE = -45; // degrees, counter-clockwise
  // Pre-rotation layout steps:
  // - Same-row character step: (+120, +120)
  // - Next-row step: (−120, +120) so rows translate straight down after rotation
  const GRID_STEP = 120; // per-character grid advance along both axes
  // Row advance so that after a -45° rotation, lines drop straight down
  // Use (-120, +120) per line to achieve vertical-only motion post-rotation
  const ROW_STEP_DX = -360;
  const ROW_STEP_DY = 360;

  // Vertical spacing: only overlap enough so topmost and bottommost vector endpoints touch.
  // Each stroke endpoint sits 120px from its center along the axis (from SVG y=30 to 270 around center 150).
  // After 45° CCW rotation, the vertical projection of that endpoint offset is 120 / √2.
  // To make the bottommost endpoint of line N meet the topmost of line N+1, we set:
  //   LINE_ADVANCE = 2 * (120 / √2) = 240 / √2 ≈ 169.71px
  const STROKE_ENDPOINT_OFFSET = 120; // distance from center to stroke end (px)
  const LINE_ADVANCE = (2 * STROKE_ENDPOINT_OFFSET) / Math.SQRT2;
  // Small fudge factor to guarantee no visual gap due to antialiasing/subpixel rounding
  const MEET_EPSILON = 1.0; // px

  const inputEl = document.getElementById('textInput');
  const canvasEl = document.getElementById('canvas');
  const canvasSvgEl = document.getElementById('canvasSvg');
  const canvasContentEl = document.getElementById('canvasContent');
  const clearBtn = document.getElementById('clearBtn');
  const navLink = document.getElementById('navToRaster');
  const fontSizeEl = document.getElementById('fontSize');
  const fontSizeValueEl = document.getElementById('fontSizeValue');
  const alignmentEl = document.getElementById('alignment');
  const exportSvgBtn = document.getElementById('exportSvgBtn');
  const exportPngBtn = document.getElementById('exportPngBtn');
  const strokeWidthEl = document.getElementById('strokeWidth');
  const strokeWidthValueEl = document.getElementById('strokeWidthValue');
  const enableCurvesEl = document.getElementById('enableCurves');
  const curveAtCrossesEl = document.getElementById('curveAtCrosses');
  const curveAtTEl = document.getElementById('curveAtT');
  const allCapsEl = document.getElementById('allCaps');
  const taperedEndsEl = document.getElementById('taperedEnds');
    const maxCharsPerLineEl = document.getElementById('maxCharsPerLine');
    const maxCharsPerLineValueEl = document.getElementById('maxCharsPerLineValue');
  const colorizeLettersEl = document.getElementById('colorizeLetters');
  const alignButtons = Array.from(document.querySelectorAll('.align-btn'));

  // Persist settings keys
  const LS_KEYS = {
    text: 'crosshatch_text',
    fontSize: 'crosshatch_fontSize',
    alignment: 'crosshatch_alignment',
    enableCurves: 'crosshatch_enableCurves',
    curveAtCrosses: 'crosshatch_curveAtCrosses',
    curveAtT: 'crosshatch_curveAtT',
    strokeWidth: 'crosshatch_strokeWidth',
    allCaps: 'crosshatch_allCaps',
    taperedEnds: 'crosshatch_taperedEnds',
    maxCharsPerLine: 'crosshatch_maxCharsPerLine',
    colorizeLetters: 'crosshatch_colorizeLetters'
  };

  // Color palette for colorizing letters by position in word
  // First letter is always black, subsequent letters cycle through vibrant colors
  const LETTER_COLORS = [
    '#000000', // 1st: Black
    '#E53935', // 2nd: Red
    '#1E88E5', // 3rd: Blue
    '#43A047', // 4th: Green
    '#FB8C00', // 5th: Orange
    '#8E24AA', // 6th: Purple
    '#00ACC1', // 7th: Cyan
    '#C0CA33', // 8th: Lime
    '#D81B60', // 9th: Pink
    '#F4511E', // 10th: Deep Orange
    '#039BE5', // 11th: Light Blue
    '#7CB342', // 12th: Light Green
    '#FDD835', // 13th: Yellow
    '#AB47BC', // 14th: Purple (lighter)
    '#26A69A', // 15th: Teal
    '#9CCC65', // 16th: Light Lime
    '#EC407A', // 17th: Pink (brighter)
    '#5E35B1', // 18th: Deep Purple
    '#00897B', // 19th: Dark Teal
    '#FFB300'  // 20th: Amber
  ];

  // Alignment anchors to page edges/center; recomputed each render

  // Character encoding: each character maps to three strokes (H, V, C)
  // All 27 combinations are unique for A-Z + space
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
    ' ': 'BBB',
    // Lowercase variants: created by replacing one stroke with B (blank). All are unique.
  'a': 'BHH',
  'b': 'BVC',
  'c': 'BCV',
  'd': 'BCH',
  'e': 'BCC',
  'f': 'BVH',
  'g': 'HBC',
  'h': 'VBH',
  'i': 'BHV',
  'j': 'VBC',
  'k': 'BHC',
  'l': 'HHB',
  'm': 'VVB',
  'n': 'HBV',
  'o': 'HVB',
  'p': 'HBH',
  'q': 'CBH',
  'r': 'CHB',
  's': 'VBV',
  't': 'BVV',
  'u': 'CBV',
  'v': 'VCB',
  'w': 'HCB',
  'x': 'CBC',
  'y': 'VHB',
  'z': 'CCB',
    // Reserve gangs for digits and punctuation with blanks (space holders)
    '0': 'hhh','1': 'hhv','2': 'hhc','3': 'hvh','4': 'hvv','5': 'hvc','6': 'hch','7': 'hcv','8': 'hcc','9': 'vhh',
    '.': 'chh',',': 'chv','!': 'chc','?': 'cvh',':': 'cvh',';': 'cvv','"': 'cch','-': 'ccv','_': 'ccv','/': 'ccv','\\': 'ccv','\'': 'ccv',
    '(': 'ccc',')': 'ccc','[': 'ccc',']': 'ccc','{': 'ccc','}': 'ccc','+': 'ccc','=': 'ccc','&': 'ccc','#': 'ccc','@': 'ccc','*': 'ccc','%': 'ccc','$': 'ccc'
  };

  // SVG path data for each stroke type
  const STROKE_PATHS = {
    'H': 'M270 150L30 150',
    'V': 'M150 30V270',
    'C': 'M270 150L150 150M30 150L150 150M150 30V150M150 270V150',
  // Gap variants
  // h = VectorHorizontalGap: leave a central gap between x=120..180 on y=150
  'h': 'M270 150L180 150M30 150L120 150',
    // v = VectorVerticalGap: leave a central gap between y=120..180 on x=150
    'v': 'M150 30V120M150 270V180',
    // c = VectorCrossGap: both horizontal and vertical gaps
    'c': 'M270 150L180 150M30 150L120 150M150 30V120M150 270V180',
    // B = Blank tile: occupies space like H/V/C but draws nothing
    'B': ''
  };

  function removeAllChildren(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function createStroke(type, x, y, strokeWidth, strokeOpacity, useTapers, strokeColor = 'black') {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${x}, ${y})`);

    // Blank tile: emit nothing inside the group
    if (type === 'B' || !STROKE_PATHS[type]) {
      return g;
    }

    // Base path data
    let pathD = STROKE_PATHS[type];

    // When tapers are enabled with butt caps, extend outer ends slightly to ensure overlap at junctions
    if (useTapers && pathD) {
      const ext = JOINT_OVERLAP_PX;
      if (type === 'H') {
        pathD = `M${270 + ext} 150L${30 - ext} 150`;
      } else if (type === 'V') {
        pathD = `M150 ${30 - ext}V${270 + ext}`;
      } else if (type === 'C') {
        // Extend all four spokes slightly
        pathD = `M${270 + ext} 150L150 150M${30 - ext} 150L150 150M150 ${30 - ext}V150M150 ${270 + ext}V150`;
      } else if (type === 'h') {
        // Horizontal gap: extend only the outer ends; keep inner gap ends fixed
        pathD = `M${270 + ext} 150L180 150M${30 - ext} 150L120 150`;
      } else if (type === 'v') {
        // Vertical gap: extend only the outer ends
        pathD = `M150 ${30 - ext}V120M150 ${270 + ext}V180`;
      } else if (type === 'c') {
        // Cross gap: extend only the outer ends on both axes
        pathD = `M${270 + ext} 150L180 150M${30 - ext} 150L120 150M150 ${30 - ext}V120M150 ${270 + ext}V180`;
      }
    }

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('stroke', strokeColor);
    path.setAttribute('stroke-width', strokeWidth);
    path.setAttribute('stroke-opacity', strokeOpacity);
    // Use butt caps when tapering so lines meet cleanly; otherwise round
    path.setAttribute('stroke-linecap', useTapers ? 'butt' : 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('fill', 'none');
    g.appendChild(path);

    return g;
  }

  // Geometry aggregation for merging and filleting
  const segments = [];
  function addSegment(x1, y1, x2, y2, orient, color = 'black') {
    segments.push({ x1, y1, x2, y2, orient, color });
  }

  function addStrokeSegments(type, baseX, baseY, color = 'black') {
    // Use canonical coordinates to ensure perfect snapping
    if (type === 'H') {
      addSegment(baseX + 30, baseY + 150, baseX + 270, baseY + 150, 'H', color);
    } else if (type === 'V') {
      addSegment(baseX + 150, baseY + 30, baseX + 150, baseY + 270, 'V', color);
    } else if (type === 'C') {
      // Four spokes to center (150,150): two horizontal halves and two vertical halves
      addSegment(baseX + 30, baseY + 150, baseX + 150, baseY + 150, 'H', color);
      addSegment(baseX + 270, baseY + 150, baseX + 150, baseY + 150, 'H', color);
      addSegment(baseX + 150, baseY + 30, baseX + 150, baseY + 150, 'V', color);
      addSegment(baseX + 150, baseY + 270, baseX + 150, baseY + 150, 'V', color);
    } else if (type === 'h') {
      // Horizontal with central gap: (30..120) and (180..270)
      addSegment(baseX + 30, baseY + 150, baseX + 120, baseY + 150, 'H', color);
      addSegment(baseX + 180, baseY + 150, baseX + 270, baseY + 150, 'H', color);
    } else if (type === 'v') {
      // Vertical with central gap: (30..120) and (180..270)
      addSegment(baseX + 150, baseY + 30, baseX + 150, baseY + 120, 'V', color);
      addSegment(baseX + 150, baseY + 180, baseX + 150, baseY + 270, 'V', color);
    } else if (type === 'c') {
      // Cross gap combines both
      addSegment(baseX + 30, baseY + 150, baseX + 120, baseY + 150, 'H', color);
      addSegment(baseX + 180, baseY + 150, baseX + 270, baseY + 150, 'H', color);
      addSegment(baseX + 150, baseY + 30, baseX + 150, baseY + 120, 'V', color);
      addSegment(baseX + 150, baseY + 180, baseX + 150, baseY + 270, 'V', color);
    } else if (type === 'B') {
      // Blank tile: contributes no segments
    }
  }

  function renderCharacter(char, baseX, baseY, strokeWidth, strokeOpacity, strokeColor = 'black') {
    const upper = char.toUpperCase();
    const encoding = CHAR_ENCODING[char] || CHAR_ENCODING[upper];
    
    if (!encoding) return;

    // Add stroke segments to the global list (no DOM yet)
    for (let i = 0; i < 3; i++) {
      const strokeType = encoding[i];
      const x = baseX + (i * STROKE_ADVANCE);
      addStrokeSegments(strokeType, x, baseY, strokeColor);
    }
  }

  function render(text) {
    // Sync max chars per line from UI
    if (maxCharsPerLineEl) {
      const v = parseInt(maxCharsPerLineEl.value || '40', 10);
      if (!Number.isNaN(v) && v > 0) MAX_CHARS_PER_LINE = v;
    }
    removeAllChildren(canvasContentEl);
    
    // Clear any existing defs (gradients from previous render)
    const oldDefs = canvasSvgEl.querySelector('defs');
    if (oldDefs) {
      oldDefs.remove();
    }
    
    if (!text) {
      canvasSvgEl.setAttribute('viewBox', '0 0 800 600');
      return;
    }
    
  const strokeWidth = parseFloat(strokeWidthEl.value);
  const strokeOpacity = 1.0; // opacity control removed; always full opacity
  const fontPx = fontSizeEl ? parseFloat(fontSizeEl.value) : 100;
  // Map fontPx to the actual post-rotation line height exactly.
  // After rotating by -45°, the vertical separation between successive rows equals
  // (ROW_STEP_DY - ROW_STEP_DX) / sqrt(2). Choose scale so scaled separation == fontPx.
  const baseLineHeight = Math.abs((ROW_STEP_DY - ROW_STEP_DX)) / Math.SQRT2 || 1;
  const fontScale = fontPx / baseLineHeight;
  const effectiveDX = ROW_STEP_DX;
  const effectiveDY = ROW_STEP_DY;
  const alignMode = alignmentEl ? alignmentEl.value : 'left';

  // Optional ALL CAPS rendering without mutating text content
  if (allCapsEl && allCapsEl.checked) {
    text = text.toUpperCase();
  }

  // Page metrics early (used for wrapping)
  const pageW = Math.max(1, canvasSvgEl.clientWidth || 1200);
  const pageH = Math.max(1, canvasSvgEl.clientHeight || 900);
  // Fixed 20px margin on all sides
  const pagePadding = 20;
  canvasSvgEl.setAttribute('viewBox', `0 0 ${pageW} ${pageH}`);

  // Greedy word wrap based on rotated line width vs available width
  const availWidth = Math.max(0, pageW - 2 * pagePadding);
  function rotatedLineWidth(n) {
    if (n <= 0) return 0;
    const w = (n - 1) * GRID_STEP + CHAR_FULL_WIDTH; // unrotated width
    const h = STROKE_SIZE; // unrotated height
    const rotWidth = (w + h) / Math.SQRT2; // extent along x' for -45° rotation
    return rotWidth * fontScale;
  }
  // Wrap a paragraph and keep a map from each visible character to its original index
  function wrapParagraphMap(para, startIndex) {
    // Tokenize with indices
    const tokens = [];
    const re = /\S+|\s+/g;
    let m;
    while ((m = re.exec(para)) !== null) {
      const s = m[0];
      const idxs = Array.from({ length: s.length }, (_, j) => startIndex + m.index + j);
      tokens.push({ text: s, indices: idxs });
    }
    if (tokens.length === 0) return { lines: [], maps: [] };
    const outLines = [];
    const outMaps = [];
    let line = '';
    let lineMap = [];
    let n = 0;
    for (const t of tokens) {
      if (n === 0 && /^\s+$/.test(t.text)) continue;
      const tLen = t.text.length;
        if ((rotatedLineWidth(n + tLen) <= availWidth && n + tLen <= MAX_CHARS_PER_LINE) || n === 0) {
        line += t.text;
        lineMap.push(...t.indices);
        n += tLen;
        continue;
      }
      if (n === 0 && tLen > 0) {
        // Hard-break token to fit width
        let i = 0;
        while (i < tLen) {
          let chunk = 1;
            while (i + chunk <= tLen && rotatedLineWidth(chunk) <= availWidth && chunk <= MAX_CHARS_PER_LINE) chunk++;
          chunk = Math.max(1, chunk - 1);
          outLines.push(t.text.slice(i, i + chunk));
          outMaps.push(t.indices.slice(i, i + chunk));
          i += chunk;
        }
        line = '';
        lineMap = [];
        n = 0;
        continue;
      }
      // Emit current line and start a new one
      outLines.push(line);
      outMaps.push(lineMap);
      line = '';
      lineMap = [];
      n = 0;
      if (/^\s+$/.test(t.text)) continue;
        if (rotatedLineWidth(tLen) <= availWidth && tLen <= MAX_CHARS_PER_LINE) {
        line = t.text;
        lineMap = t.indices.slice();
        n = tLen;
      } else {
        // Hard-break token
        let i = 0;
        while (i < tLen) {
          let chunk = 1;
            while (i + chunk <= tLen && rotatedLineWidth(chunk) <= availWidth && chunk <= MAX_CHARS_PER_LINE) chunk++;
          chunk = Math.max(1, chunk - 1);
          outLines.push(t.text.slice(i, i + chunk));
          outMaps.push(t.indices.slice(i, i + chunk));
          i += chunk;
        }
        line = '';
        lineMap = [];
        n = 0;
      }
    }
    if (n > 0 || line.length) { outLines.push(line); outMaps.push(lineMap); }
    return { lines: outLines, maps: outMaps };
  }
    
  // We'll set final translate/scale/rotate at the end after we know bounds for alignment

  // Track pre-rotation bounds
  let minPreX = Infinity, minPreY = Infinity, maxPreX = -Infinity, maxPreY = -Infinity;
  // Per-line shifts for grid alignment by mode
  // Center: align around a central column. Odd n: center char at s=0; even n: right-middle at s=0 (one extra on the right).
  function lineShiftCenter(n) { return (n % 2 === 1) ? -Math.floor(n / 2) : 1 - (n / 2); }
  // Right: right-justify by aligning the rightmost character on the s=0 axis (everything else extends leftwards).
  function lineShiftRight(n) { return -(n - 1); }
    
  // Apply wrapping per paragraph and keep index maps
  const paragraphs = [];
  {
    // Build paragraphs with start indices without losing newline indices
    let start = 0;
    for (let i = 0; i <= text.length; i++) {
      if (i === text.length || text[i] === '\n') {
        paragraphs.push({ text: text.slice(start, i), startIndex: start });
        start = i + 1;
      }
    }
  }
  const lines = [];
  const lineMaps = [];
  for (const para of paragraphs) {
    const { lines: lns, maps } = wrapParagraphMap(para.text, para.startIndex);
    if (lns.length === 0) { lines.push(''); lineMaps.push([]); }
    else { lines.push(...lns); lineMaps.push(...maps); }
  }
    
  const leftMargin = 0, topMargin = 0;
  segments.length = 0; // reset geometry collector
  const filletPoints = []; // for debugging (unused)
  const emitted = new Set(); // de-dup exact same path geometry
  const fmt = (n) => Math.round(n * 1000) / 1000; // quantize to 0.001 to reduce float noise
  const keyPath = (cmd, vals) => `${cmd} ${vals.map(fmt).join(' ')}`;

    // Selection and caret visualization layer (does not affect geometry)
  const selStart = (typeof inputEl.selectionStart === 'number') ? inputEl.selectionStart : 0;
  const selEndRaw = (typeof inputEl.selectionEnd === 'number') ? inputEl.selectionEnd : selStart;
    const selA = Math.min(selStart, selEndRaw);
    const selB = Math.max(selStart, selEndRaw);
  const highlightGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    highlightGroup.setAttribute('data-layer', 'highlights');
    highlightGroup.setAttribute('pointer-events', 'none');
    canvasContentEl.appendChild(highlightGroup);

    function addHighlightRect(x, y) {
      const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('x', x);
      r.setAttribute('y', y);
      r.setAttribute('width', CHAR_FULL_WIDTH);
      r.setAttribute('height', STROKE_SIZE);
      r.setAttribute('fill', '#ffeb3b'); // soft yellow
      r.setAttribute('fill-opacity', '0.35');
      r.setAttribute('rx', '12');
      r.setAttribute('ry', '12');
      highlightGroup.appendChild(r);
    }

    // Track caret position to render in a foreground layer later
    let caretPos = null;

    // Check if colorization is enabled
    const colorizeEnabled = colorizeLettersEl && colorizeLettersEl.checked;

    for (let row = 0; row < lines.length; row++) {
      const line = lines[row];
      const map = lineMaps[row] || [];
  // Row base before rotation: left margin plus r times (effectiveDX, effectiveDY)
  let rowBaseX = leftMargin + row * effectiveDX;
  let rowBaseY = topMargin + row * effectiveDY;
  const shift = (alignMode === 'center') ? lineShiftCenter(line.length) : (alignMode === 'right' ? lineShiftRight(line.length) : 0);

      // Track letter position within current word for colorization
      let wordLetterIndex = 0;

      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
  // Pre-rotation char origin advances by (+GRID_STEP, +GRID_STEP)
  const sIdx = i + shift;
  const preX = rowBaseX + sIdx * GRID_STEP;
  const preY = rowBaseY + sIdx * GRID_STEP;

        // Determine color for this character
        let charColor = 'black';
        if (colorizeEnabled) {
          // Check if this is a space or word boundary
          if (ch === ' ' || ch === '\n' || ch === '\t') {
            // Reset word position on whitespace
            wordLetterIndex = 0;
            charColor = 'black'; // Spaces are always black
          } else if (!/[a-zA-Z0-9]/.test(ch)) {
            // Punctuation is always grey, doesn't reset or increment word position
            charColor = '#aaaaaa';
          } else {
            // Apply color based on position in word
            if (wordLetterIndex === 0) {
              // First letter/number in word is always black
              charColor = '#000000';
            } else {
              // Subsequent positions cycle through colors 2-20 (indices 1-19)
              // Offset by 1 to skip black at index 0
              charColor = LETTER_COLORS[1 + ((wordLetterIndex - 1) % (LETTER_COLORS.length - 1))];
            }
            wordLetterIndex++;
          }
        }

  renderCharacter(ch, preX, preY, strokeWidth, strokeOpacity, charColor);

        // Selection highlight per visible character (skip if original index unknown)
        const origIdx = map[i];
        if (typeof origIdx === 'number' && origIdx >= selA && origIdx < selB) {
          addHighlightRect(preX, preY);
        }

        // Update pre-rotation bounds with full character width and height
        if (preX < minPreX) minPreX = preX;
        if (preY < minPreY) minPreY = preY;
        const right = preX + CHAR_FULL_WIDTH;
        const bottom = preY + STROKE_SIZE;
        if (right > maxPreX) maxPreX = right;
        if (bottom > maxPreY) maxPreY = bottom;
      }
    }

    // Caret (only when focused and selection is a caret, not a range selection)
    const hasFocus = (document.activeElement === inputEl);
  if (hasFocus && selA === selB) {
      // Find last visible char with original index < caret; place caret after it
      let caretRow = 0;
      let caretCol = 0;
      let found = false;
      for (let r = 0; r < lines.length; r++) {
        const map = lineMaps[r] || [];
        for (let c = 0; c < map.length; c++) {
          const idx = map[c];
          if (typeof idx === 'number' && idx < selA) { caretRow = r; caretCol = c + 1; found = true; }
        }
      }
      if (!found) { caretRow = 0; caretCol = 0; }
      caretPos = { row: caretRow, col: caretCol };
    }

    // If curves are disabled, render direct strokes and skip merging
    if (!enableCurvesEl || !enableCurvesEl.checked) {
      const useTapers = (taperedEndsEl && taperedEndsEl.checked);
      const snapTol = 5; // tolerance for endpoint matching
      const colorizeEnabled = colorizeLettersEl && colorizeLettersEl.checked;
      
      // When tapers enabled, first pass to identify all stroke endpoints
      const allStrokeInfo = []; // {type, sx, baseY, baseX, row, col}
      const allEndpoints = new Map(); // key -> count
      
      if (useTapers) {
        for (let row = 0; row < lines.length; row++) {
          const line = lines[row];
          const rowBaseX = leftMargin + row * effectiveDX;
          const rowBaseY = topMargin + row * effectiveDY;
          const shift = (alignMode === 'center') ? lineShiftCenter(line.length) : (alignMode === 'right' ? lineShiftRight(line.length) : 0);
          
          let wordLetterIndex = 0;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            
            // Determine color for this character (same logic as curves path)
            let charColor = 'black';
            if (colorizeEnabled) {
              if (ch === ' ' || ch === '\n' || ch === '\t') {
                wordLetterIndex = 0;
                charColor = 'black';
              } else if (!/[a-zA-Z0-9]/.test(ch)) {
                charColor = '#aaaaaa';
              } else {
                if (wordLetterIndex === 0) {
                  charColor = '#000000';
                } else {
                  charColor = LETTER_COLORS[1 + ((wordLetterIndex - 1) % (LETTER_COLORS.length - 1))];
                }
                wordLetterIndex++;
              }
            }
            
            const upper = ch.toUpperCase();
            const encoding = CHAR_ENCODING[ch] || CHAR_ENCODING[upper];
            if (!encoding) continue;
            const sIdx = i + shift;
            const baseX = rowBaseX + sIdx * GRID_STEP;
            const baseY = rowBaseY + sIdx * GRID_STEP;
            
            for (let s = 0; s < 3; s++) {
              const strokeType = encoding[s];
              const sx = baseX + (s * STROKE_ADVANCE);
              allStrokeInfo.push({type: strokeType, sx, baseY, baseX, row, col: i, color: charColor});
              
              // Count endpoint occurrences
              if (strokeType === 'H') {
                const k1 = `${Math.round(sx + 270)},${Math.round(baseY + 150)}`;
                const k2 = `${Math.round(sx + 30)},${Math.round(baseY + 150)}`;
                allEndpoints.set(k1, (allEndpoints.get(k1) || 0) + 1);
                allEndpoints.set(k2, (allEndpoints.get(k2) || 0) + 1);
              } else if (strokeType === 'V') {
                const k1 = `${Math.round(sx + 150)},${Math.round(baseY + 270)}`;
                const k2 = `${Math.round(sx + 150)},${Math.round(baseY + 30)}`;
                allEndpoints.set(k1, (allEndpoints.get(k1) || 0) + 1);
                allEndpoints.set(k2, (allEndpoints.get(k2) || 0) + 1);
              }
            }
          }
        }
      }
      
      // Helper to check if endpoint is free (only appears once)
      const isFreeEndpoint = (x, y) => {
        const k = `${Math.round(x)},${Math.round(y)}`;
        return (allEndpoints.get(k) || 0) === 1;
      };
      
      // Render all strokes with trimming/overlap and collect true free endpoints for tapers
      const freeEnds = [];
      for (let row = 0; row < lines.length; row++) {
        const line = lines[row];
        const rowBaseX = leftMargin + row * effectiveDX;
        const rowBaseY = topMargin + row * effectiveDY;
        const shift = (alignMode === 'center') ? lineShiftCenter(line.length) : (alignMode === 'right' ? lineShiftRight(line.length) : 0);
        
        let wordLetterIndex = 0;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          
          // Determine color for this character (same logic as curves path)
          let charColor = 'black';
          if (colorizeEnabled) {
            if (ch === ' ' || ch === '\n' || ch === '\t') {
              wordLetterIndex = 0;
              charColor = 'black';
            } else if (!/[a-zA-Z0-9]/.test(ch)) {
              charColor = '#aaaaaa';
            } else {
              if (wordLetterIndex === 0) {
                charColor = '#000000';
              } else {
                charColor = LETTER_COLORS[1 + ((wordLetterIndex - 1) % (LETTER_COLORS.length - 1))];
              }
              wordLetterIndex++;
            }
          }
          
          const upper = ch.toUpperCase();
          const encoding = CHAR_ENCODING[ch] || CHAR_ENCODING[upper];
          if (!encoding) continue;
          const sIdx = i + shift;
          const baseX = rowBaseX + sIdx * GRID_STEP;
          const baseY = rowBaseY + sIdx * GRID_STEP;

          const charGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          for (let s = 0; s < 3; s++) {
            const strokeType = encoding[s];
            const sx = baseX + (s * STROKE_ADVANCE);

            if (useTapers && strokeType !== 'B') {
              const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
              g.setAttribute('transform', `translate(${sx}, ${baseY})`);
              let pathD = '';
              if (strokeType === 'H') {
                const leftFree = isFreeEndpoint(sx + 30, baseY + 150);
                const rightFree = isFreeEndpoint(sx + 270, baseY + 150);
                const trimAmount = strokeWidth / 2;
                const ext = JOINT_OVERLAP_PX;
                const leftX = leftFree ? (30 + trimAmount) : (30 - ext);
                const rightX = rightFree ? (270 - trimAmount) : (270 + ext);
                pathD = `M${rightX} 150L${leftX} 150`;
                if (leftFree) freeEnds.push({x: sx + 30, y: baseY + 150, dx: 1, dy: 0, color: charColor});
                if (rightFree) freeEnds.push({x: sx + 270, y: baseY + 150, dx: -1, dy: 0, color: charColor});
              } else if (strokeType === 'V') {
                const topFree = isFreeEndpoint(sx + 150, baseY + 30);
                const bottomFree = isFreeEndpoint(sx + 150, baseY + 270);
                const trimAmount = strokeWidth / 2;
                const ext = JOINT_OVERLAP_PX;
                const topY = topFree ? (30 + trimAmount) : (30 - ext);
                const bottomY = bottomFree ? (270 - trimAmount) : (270 + ext);
                pathD = `M150 ${topY}V${bottomY}`;
                if (topFree) freeEnds.push({x: sx + 150, y: baseY + 30, dx: 0, dy: 1, color: charColor});
                if (bottomFree) freeEnds.push({x: sx + 150, y: baseY + 270, dx: 0, dy: -1, color: charColor});
              } else if (strokeType === 'C') {
                const ext = JOINT_OVERLAP_PX;
                pathD = `M${270 + ext} 150L150 150M${30 - ext} 150L150 150M150 ${30 - ext}V150M150 ${270 + ext}V150`;
              } else if (strokeType === 'h') {
                const ext = JOINT_OVERLAP_PX;
                pathD = `M${270 + ext} 150L180 150M${30 - ext} 150L120 150`;
              } else if (strokeType === 'v') {
                const ext = JOINT_OVERLAP_PX;
                pathD = `M150 ${30 - ext}V120M150 ${270 + ext}V180`;
              } else if (strokeType === 'c') {
                const ext = JOINT_OVERLAP_PX;
                pathD = `M${270 + ext} 150L180 150M${30 - ext} 150L120 150M150 ${30 - ext}V120M150 ${270 + ext}V180`;
              }

              if (pathD) {
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', pathD);
                path.setAttribute('stroke', charColor);
                path.setAttribute('stroke-width', strokeWidth);
                path.setAttribute('stroke-opacity', strokeOpacity);
                path.setAttribute('stroke-linecap', useTapers ? 'butt' : 'round');
                path.setAttribute('stroke-linejoin', 'round');
                path.setAttribute('fill', 'none');
                g.appendChild(path);
              }
              charGroup.appendChild(g);
            } else {
              const stroke = createStroke(strokeType, sx, baseY, strokeWidth, strokeOpacity, useTapers, charColor);
              charGroup.appendChild(stroke);
            }
          }
          canvasContentEl.appendChild(charGroup);
        }
      }
      
      // Draw taper triangles at free endpoints
      if (useTapers) {
        for (const ep of freeEnds) {
          const ux = ep.dx;
          const uy = ep.dy;
          const px = -uy;
          const py = ux;
          
          // For 45° angle with hypotenuse = strokeWidth:
          // The taper extends strokeWidth/2 back along the line
          // and has full strokeWidth at the base
          const taperDepth = strokeWidth / 2;
          
          // Tip is at the actual endpoint
          const tipX = ep.x;
          const tipY = ep.y;
          
          // Base is at strokeWidth/2 back from the endpoint
          const baseX = ep.x + ux * taperDepth;
          const baseY = ep.y + uy * taperDepth;
          
          // Base has full stroke width perpendicular to the line
          const hw = strokeWidth / 2;
          const p1x = baseX + px * hw;
          const p1y = baseY + py * hw;
          const p2x = baseX - px * hw;
          const p2y = baseY - py * hw;
          
          const taperPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          const taperD = `M ${tipX} ${tipY} L ${p1x} ${p1y} L ${p2x} ${p2y} Z`;
          taperPath.setAttribute('d', taperD);
          taperPath.setAttribute('fill', ep.color || 'black');
          taperPath.setAttribute('fill-opacity', strokeOpacity);
          canvasContentEl.appendChild(taperPath);
        }
      }
      // ViewBox computation continues below
    } else {
      // Build merged paths with filleted L corners (not at crosses)
    // 1) Snap endpoints and build adjacency graph
  const tol = 0.51; // snapping tolerance in px
    const keyOf = (x, y) => `${Math.round(x)}:${Math.round(y)}`; // integer snap (coords are multiples of 30)
    const nodes = new Map(); // key -> { id, x, y, edges: [] }
    const nodeById = []; // id -> node
    function getNode(x, y) {
      const k = keyOf(x, y);
      let n = nodes.get(k);
      if (!n) {
        n = { id: nodeById.length, x: Math.round(x), y: Math.round(y), edges: [] };
        nodeById.push(n);
        nodes.set(k, n);
      }
      return n;
    }
    const edges = []; // {id,a,b,orient,len,visited:false,color}
    for (const s of segments) {
      const a = getNode(s.x1, s.y1);
      const b = getNode(s.x2, s.y2);
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.1) continue; // skip degenerate
      const e = { id: edges.length, a: a.id, b: b.id, orient: Math.abs(dx) > Math.abs(dy) ? 'H' : 'V', len, visited: false, color: s.color || 'black' };
      edges.push(e);
      a.edges.push(e.id);
      b.edges.push(e.id);
    }

    // 2) Non-tracing fillet: compute trims at L-corners globally, then emit lines and curves
    function nodeOrientCounts(node) {
      let h = 0, v = 0;
      for (const eid of node.edges) {
        const e = edges[eid];
        if (!e) continue;
        if (e.orient === 'H') h++;
        else v++;
      }
      return {h, v};
    }
    function unitVec(from, to) {
      const dx = to.x - from.x, dy = to.y - from.y;
      const L = Math.hypot(dx, dy);
      if (L === 0) return {x:0, y:0};
      return { x: dx / L, y: dy / L };
    }

    // Reserve budgets on edge ends so nearby shapes (like crosses) constrain L/T radii
    const reserves = new Map(); // edgeId -> { a?:number, b?:number }
    function getReserve(edge, atA) {
      const r = reserves.get(edge.id);
      if (!r) return 0;
      return atA ? (r.a || 0) : (r.b || 0);
    }
    function addReserve(edge, atA, val) {
      let r = reserves.get(edge.id);
      if (!r) r = {};
      if (atA) r.a = Math.max(r.a || 0, val); else r.b = Math.max(r.b || 0, val);
      reserves.set(edge.id, r);
    }

  // Use a large, design-driven radius equal to the base grid step (120px) so the elbow becomes a quarter-circle
  const filletR = 120;
  const trims = new Map(); // edgeId -> { a?:{x,y}, b?:{x,y} }
  const curves = []; // arc curves: { p1:{x,y}, p2:{x,y}, sweep:0|1, r?:number }
  const cubicCurves = []; // cubic bezier curves for 4-way crosses: { p0:{x,y}, c1:{x,y}, c2:{x,y}, p3:{x,y} }

    function setTrim(edge, atA, pt) {
      let t = trims.get(edge.id);
      if (!t) { t = {}; trims.set(edge.id, t); }
      if (atA) t.a = pt; else t.b = pt;
    }

    // Pre-pass: when cross-curving is enabled, reserve crossR on all four arms so L/T arcs nearby shrink accordingly
    if (curveAtCrossesEl && curveAtCrossesEl.checked) {
      const crossR = filletR / 2; // 60px
      for (const node of nodeById) {
        const {h, v} = nodeOrientCounts(node);
        if (node.edges.length === 4 && h === 2 && v === 2) {
          for (const eid of node.edges) {
            const e = edges[eid];
            addReserve(e, e.a === node.id, crossR);
          }
        }
      }
    }

    // Mark trims for all true L-corners (exactly two edges meeting and orthogonal)
    for (const node of nodeById) {
      const {h, v} = nodeOrientCounts(node);
      if (node.edges.length === 2 && h === 1 && v === 1) {
        const e1 = edges[node.edges[0]];
        const e2 = edges[node.edges[1]];
        const other1 = nodeById[e1.a === node.id ? e1.b : e1.a];
        const other2 = nodeById[e2.a === node.id ? e2.b : e2.a];
        const v1 = unitVec(node, other1);
        const v2 = unitVec(node, other2);
        // Respect far-end reserves (e.g., crosses) when selecting radius
        const e1HereAtA = (e1.a === node.id);
        const e2HereAtA = (e2.a === node.id);
        const avail1 = Math.max(0, e1.len - getReserve(e1, !e1HereAtA) - 0.1);
        const avail2 = Math.max(0, e2.len - getReserve(e2, !e2HereAtA) - 0.1);
        const r = Math.min(filletR, avail1, avail2);
        if (r <= 0.5) continue;
        const p1 = { x: node.x + v1.x * r, y: node.y + v1.y * r };
        const p2 = { x: node.x + v2.x * r, y: node.y + v2.y * r };
        setTrim(e1, e1HereAtA, p1);
        setTrim(e2, e2HereAtA, p2);
        addReserve(e1, e1HereAtA, r);
        addReserve(e2, e2HereAtA, r);
  // Determine sweep direction based on signed area (v1 -> v2)
  const cross = v1.x * v2.y - v1.y * v2.x;
  // In SVG (y increases downward), the intuitive CCW/CW test is inverted vs. math coords
  // Choose sweep so the arc curves into the interior of the elbow
  const sweep = cross < 0 ? 1 : 0;
  // Check if edges have different colors - if so, use both colors for gradient
  const color1 = e1.color || 'black';
  const color2 = e2.color || 'black';
  if (color1 === color2) {
    curves.push({ p1, p2, sweep, r, color: color1 });
  } else {
    // Different colors - store both for gradient rendering
    curves.push({ p1, p2, sweep, r, color1, color2, gradient: true });
  }
        filletPoints.push({x: node.x, y: node.y});
      }
    }

    // 2b) 4-way intersection shaping (optional): add four cubic Béziers around the center and trim all four arms
    if (curveAtCrossesEl && curveAtCrossesEl.checked) {
      const crossR = filletR / 2; // 60px
      // Exact astroid (hypocycloid) approximation using 8 cubic segments via Hermite-to-Bézier
      function astroidPoint(cx, cy, R, t) {
        return {
          x: cx + R * Math.pow(Math.cos(t), 3),
          y: cy + R * Math.pow(Math.sin(t), 3)
        };
      }
      function astroidDeriv(R, t) {
        const c = Math.cos(t), s = Math.sin(t);
        return {
          x: -3 * R * c * c * s,
          y:  3 * R * s * s * c
        };
      }
      function pushCubicFromParam(cx, cy, R, t0, t1, color = 'black') {
        const p0 = astroidPoint(cx, cy, R, t0);
        const p3 = astroidPoint(cx, cy, R, t1);
        const v0 = astroidDeriv(R, t0);
        const v1 = astroidDeriv(R, t1);
        const dt = t1 - t0;
        const c1 = { x: p0.x + (v0.x * dt) / 3, y: p0.y + (v0.y * dt) / 3 };
        const c2 = { x: p3.x - (v1.x * dt) / 3, y: p3.y - (v1.y * dt) / 3 };
        cubicCurves.push({ p0, c1, c2, p3, color });
      }
      for (const node of nodeById) {
        const {h, v} = nodeOrientCounts(node);
        if (node.edges.length === 4 && h === 2 && v === 2) {
          // Classify the 4 directions and compute trim points along the arms
          const dirs = { left: null, right: null, up: null, down: null };
          for (const eid of node.edges) {
            const e = edges[eid];
            const other = nodeById[e.a === node.id ? e.b : e.a];
            const vdir = unitVec(node, other);
            if (e.orient === 'H') {
              if (other.x > node.x) dirs.right = { e, atA: e.a === node.id, p: { x: node.x + vdir.x * crossR, y: node.y } };
              else dirs.left = { e, atA: e.a === node.id, p: { x: node.x + vdir.x * crossR, y: node.y } };
            } else {
              if (other.y > node.y) dirs.down = { e, atA: e.a === node.id, p: { x: node.x, y: node.y + vdir.y * crossR } };
              else dirs.up = { e, atA: e.a === node.id, p: { x: node.x, y: node.y + vdir.y * crossR } };
            }
          }
          if (dirs.left && dirs.right && dirs.up && dirs.down) {
            // Apply trims to all four arms at distance crossR from center
            setTrim(dirs.left.e, dirs.left.atA, dirs.left.p);
            setTrim(dirs.right.e, dirs.right.atA, dirs.right.p);
            setTrim(dirs.up.e, dirs.up.atA, dirs.up.p);
            setTrim(dirs.down.e, dirs.down.atA, dirs.down.p);
            addReserve(dirs.left.e, dirs.left.atA, crossR);
            addReserve(dirs.right.e, dirs.right.atA, crossR);
            addReserve(dirs.up.e, dirs.up.atA, crossR);
            addReserve(dirs.down.e, dirs.down.atA, crossR);

            // Build astroid loop centered at node with 8 cubics (two per quadrant)
            // Use color from any of the edges (they should all be the same character)
            const cx = node.x, cy = node.y, R = crossR;
            const nodeColor = dirs.left.e.color || 'black';
            const T = [0, Math.PI/4, Math.PI/2, 3*Math.PI/4, Math.PI, 5*Math.PI/4, 3*Math.PI/2, 7*Math.PI/4, 2*Math.PI];
            for (let i = 0; i < T.length - 1; i++) {
              pushCubicFromParam(cx, cy, R, T[i], T[i+1], nodeColor);
            }
            filletPoints.push({x: node.x, y: node.y});
          }
        }
      }
    }

    // T-junction curves (optional): at nodes with 3 edges and counts 2+1, make two arcs from stem to each cap
    if (curveAtTEl && curveAtTEl.checked) {
      for (const node of nodeById) {
        const {h, v} = nodeOrientCounts(node);
        if (node.edges.length === 3 && ((h === 2 && v === 1) || (h === 1 && v === 2))) {
          const hEdges = [], vEdges = [];
          for (const eid of node.edges) {
            const e = edges[eid];
            if (e.orient === 'H') hEdges.push(e); else vEdges.push(e);
          }
          const stem = (h === 1) ? hEdges[0] : vEdges[0];
          const caps = (h === 1) ? vEdges : hEdges; // two edges
          const otherStem = nodeById[stem.a === node.id ? stem.b : stem.a];
          const vStem = unitVec(node, otherStem);
          const stemHereAtA = (stem.a === node.id);
          const availStem = Math.max(0, stem.len - getReserve(stem, !stemHereAtA) - 0.1);
          const rStem = Math.min(filletR, availStem);
          if (rStem <= 0.5) continue;
          const pStem = { x: node.x + vStem.x * rStem, y: node.y + vStem.y * rStem };
          setTrim(stem, stemHereAtA, pStem);
          addReserve(stem, stemHereAtA, rStem);
          for (const cap of caps) {
            const otherCap = nodeById[cap.a === node.id ? cap.b : cap.a];
            const vCap = unitVec(node, otherCap);
            const capHereAtA = (cap.a === node.id);
            const availCap = Math.max(0, cap.len - getReserve(cap, !capHereAtA) - 0.1);
            const r = Math.min(filletR, rStem, availCap);
            if (r <= 0.5) continue;
            const pCap = { x: node.x + vCap.x * r, y: node.y + vCap.y * r };
            setTrim(cap, capHereAtA, pCap);
            addReserve(cap, capHereAtA, r);
            const cross = vStem.x * vCap.y - vStem.y * vCap.x;
            const sweep = cross < 0 ? 1 : 0;
            // Check if stem and cap have different colors
            const stemColor = stem.color || 'black';
            const capColor = cap.color || 'black';
            if (stemColor === capColor) {
              curves.push({ p1: pStem, p2: pCap, sweep, r, color: stemColor });
            } else {
              curves.push({ p1: pStem, p2: pCap, sweep, r, color1: stemColor, color2: capColor, gradient: true });
            }
            filletPoints.push({x: node.x, y: node.y});
          }
        }
      }
    }

    // Emit all line segments with trims applied
    const useTapers = (taperedEndsEl && taperedEndsEl.checked);
    const taperDepth = strokeWidth / 2; // 45° taper with hypotenuse = strokeWidth
    const freeEndpoints = []; // collect endpoints for taper drawing
    for (const e of edges) {
      const a = nodeById[e.a];
      const b = nodeById[e.b];
      const tr = trims.get(e.id) || {};
      let sx = tr.a ? tr.a.x : a.x;
      let sy = tr.a ? tr.a.y : a.y;
      let tx = tr.b ? tr.b.x : b.x;
      let ty = tr.b ? tr.b.y : b.y;
      
      // When tapers enabled, trim back the stroke line at free endpoints so taper replaces that portion
      if (useTapers) {
        const lineLen = Math.hypot(tx - sx, ty - sy);
        if (lineLen > 0.1) {
          const ux = (tx - sx) / lineLen;
          const uy = (ty - sy) / lineLen;
          // Trim from start if it's a free endpoint
          if (a.edges.length === 1) {
            const trimDist = Math.min(taperDepth, lineLen * 0.95);
            sx += ux * trimDist;
            sy += uy * trimDist;
            freeEndpoints.push({ x: a.x, y: a.y, dx: tx - a.x, dy: ty - a.y, color: e.color || 'black' });
          }
          // Trim from end if it's a free endpoint
          if (b.edges.length === 1) {
            const trimDist = Math.min(taperDepth, lineLen * 0.95);
            tx -= ux * trimDist;
            ty -= uy * trimDist;
            freeEndpoints.push({ x: b.x, y: b.y, dx: sx - b.x, dy: sy - b.y, color: e.color || 'black' });
          }
        }
      }
      
  // Skip if trimmed to zero or tiny length
  if (Math.hypot(tx - sx, ty - sy) < 0.5) continue;
  const dStr = `M ${sx} ${sy} L ${tx} ${ty}`;
  const k = keyPath('L', [sx, sy, tx, ty]);
  if (emitted.has(k)) continue;
  emitted.add(k);
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', dStr);
      p.setAttribute('stroke', e.color || 'black');
      p.setAttribute('stroke-width', strokeWidth);
      p.setAttribute('stroke-opacity', strokeOpacity);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke-linecap', useTapers ? 'butt' : 'round');
      p.setAttribute('stroke-linejoin', 'round');
      canvasContentEl.appendChild(p);
    }

    // Emit fillet curves as quarter-circle arcs with per-curve radius
    let gradientCounter = 0;
    for (const c of curves) {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const r = c.r != null ? c.r : filletR;
      const dStr = `M ${c.p1.x} ${c.p1.y} A ${r} ${r} 0 0 ${c.sweep} ${c.p2.x} ${c.p2.y}`;
      const k = keyPath('A', [c.p1.x, c.p1.y, r, r, 0, 0, c.sweep, c.p2.x, c.p2.y]);
      if (emitted.has(k)) continue;
      emitted.add(k);
      p.setAttribute('d', dStr);
      
      // Handle gradient for curves connecting different colored edges
      if (c.gradient && c.color1 && c.color2) {
        // Create a linear gradient from p1 to p2
        const gradId = `curveGrad${gradientCounter++}`;
        let defsEl = canvasSvgEl.querySelector('defs');
        if (!defsEl) {
          defsEl = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
          canvasSvgEl.insertBefore(defsEl, canvasSvgEl.firstChild);
        }
        
        const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        grad.setAttribute('id', gradId);
        grad.setAttribute('x1', c.p1.x);
        grad.setAttribute('y1', c.p1.y);
        grad.setAttribute('x2', c.p2.x);
        grad.setAttribute('y2', c.p2.y);
        grad.setAttribute('gradientUnits', 'userSpaceOnUse');
        
        const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop1.setAttribute('offset', '0%');
        stop1.setAttribute('stop-color', c.color1);
        grad.appendChild(stop1);
        
        const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop2.setAttribute('offset', '100%');
        stop2.setAttribute('stop-color', c.color2);
        grad.appendChild(stop2);
        
        defsEl.appendChild(grad);
        p.setAttribute('stroke', `url(#${gradId})`);
      } else {
        p.setAttribute('stroke', c.color || 'black');
      }
      
      p.setAttribute('stroke-width', strokeWidth);
      p.setAttribute('stroke-opacity', strokeOpacity);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      canvasContentEl.appendChild(p);
    }

    // Emit cubic curves for crosses
    for (const cc of cubicCurves) {
      const dStr = `M ${cc.p0.x} ${cc.p0.y} C ${cc.c1.x} ${cc.c1.y}, ${cc.c2.x} ${cc.c2.y}, ${cc.p3.x} ${cc.p3.y}`;
      const k = keyPath('C', [cc.p0.x, cc.p0.y, cc.c1.x, cc.c1.y, cc.c2.x, cc.c2.y, cc.p3.x, cc.p3.y]);
      if (emitted.has(k)) continue;
      emitted.add(k);
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', dStr);
      p.setAttribute('stroke', cc.color || 'black');
      p.setAttribute('stroke-width', strokeWidth);
      p.setAttribute('stroke-opacity', strokeOpacity);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      canvasContentEl.appendChild(p);
    }

    // Draw tapered brush ends at free endpoints
    if (useTapers && freeEndpoints.length > 0) {
      // Taper length already defined above (strokeWidth * 2.5)
      for (const ep of freeEndpoints) {
        const L = Math.hypot(ep.dx, ep.dy);
        if (L < 0.1) continue;
        // Unit vector pointing INTO the line (from endpoint toward the line interior)
        const ux = ep.dx / L;
        const uy = ep.dy / L;
        // Perpendicular vector (rotated 90° CCW)
        const px = -uy;
        const py = ux;
        // 45° taper: tip at endpoint, base at taperDepth back with full width
        const taperDepth = strokeWidth / 2;
        const tipX = ep.x;
        const tipY = ep.y;
        const baseX = ep.x + ux * taperDepth;
        const baseY = ep.y + uy * taperDepth;
        const hw = strokeWidth / 2;
        const p1x = baseX + px * hw;
        const p1y = baseY + py * hw;
        const p2x = baseX - px * hw;
        const p2y = baseY - py * hw;
        const taperPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const taperD = `M ${tipX} ${tipY} L ${p1x} ${p1y} L ${p2x} ${p2y} Z`;
        taperPath.setAttribute('d', taperD);
        taperPath.setAttribute('fill', ep.color || 'black');
        taperPath.setAttribute('fill-opacity', strokeOpacity);
        canvasContentEl.appendChild(taperPath);
      }
    }

    // Curve highlights removed per request
    }

    // Foreground caret layer (rendered above paths so it's visible)
    if (caretPos) {
      const caretGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      caretGroup.setAttribute('data-layer', 'caret');
      caretGroup.setAttribute('pointer-events', 'none');
      canvasContentEl.appendChild(caretGroup);
  const rowBaseXc = 0 + caretPos.row * effectiveDX;
  const rowBaseYc = 0 + caretPos.row * effectiveDY;
  const shiftC = (alignMode === 'center') ? lineShiftCenter(lines[caretPos.row]?.length || 0) : (alignMode === 'right' ? lineShiftRight(lines[caretPos.row]?.length || 0) : 0);
  const sCaret = caretPos.col + shiftC;
  const preXc = rowBaseXc + sCaret * GRID_STEP;
  const preYc = rowBaseYc + sCaret * GRID_STEP;
      const caret = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const caretW = 8;
      caret.setAttribute('x', preXc - caretW / 2);
      caret.setAttribute('y', preYc);
      caret.setAttribute('width', String(caretW));
      caret.setAttribute('height', String(STROKE_SIZE));
      caret.setAttribute('fill', '#000');
      caret.setAttribute('fill-opacity', '0.9');
      caretGroup.appendChild(caret);
    }

    // Compute rotated bounds (no translation) for the content
    const rotX = (x, y) => (x + y) / Math.SQRT2;
    const rotY = (x, y) => (y - x) / Math.SQRT2;
    const corners = [
      [minPreX, minPreY],
      [maxPreX, minPreY],
      [maxPreX, maxPreY],
      [minPreX, maxPreY],
    ];
    const xs = corners.map(([x0, y0]) => rotX(x0, y0));
    const ys = corners.map(([x0, y0]) => rotY(x0, y0));
    let minXr = Math.min(...xs);
    let maxXr = Math.max(...xs);
    let minYr = Math.min(...ys);
    let maxYr = Math.max(...ys);

    // Apply font scale to content bounds
    minXr *= fontScale; maxXr *= fontScale; minYr *= fontScale; maxYr *= fontScale;
    const contentWidth = (maxXr - minXr);
    const contentHeight = (maxYr - minYr);

    // Page size already computed above and viewBox set

    // Compute translation to align within page against anchors
    // The first character is at (0,0) in pre-rotation space
    // First visible content depends on the encoding but typically starts around (30,30) to (270,270)
    // For left align, we want the leftmost actual content point at pagePadding from edges
    // The topmost visible point of the first row is approximately at x=150, y=30 (top of V stroke)
    // After -45° rotation: rotX(150,30) and rotY(150,30)
    const firstContentX = 150; // center of first character tile
    const firstContentY = 30;  // top of vertical strokes
    const topLeftRotX = rotX(firstContentX, firstContentY) * fontScale;
    const topLeftRotY = rotY(firstContentX, firstContentY) * fontScale;
    
    // Vertical offset equals font size
    const verticalOffset = fontPx;
    
    let tx, ty;
    if (alignMode === 'center') {
      // Center around the common central column (s=0) so rows align monospaced.
      const axisXr = ((leftMargin + topMargin) / Math.SQRT2) * fontScale;
      tx = (pageW / 2) - axisXr;
      ty = pagePadding - topLeftRotY + verticalOffset;
    } else if (alignMode === 'right') {
      // Flush right by aligning the content's right edge to the right padding
      tx = (pageW - pagePadding) - maxXr;
      ty = pagePadding - topLeftRotY + verticalOffset;
    } else {
      // Flush left: place the first visible content at pagePadding from edges
      tx = pagePadding - topLeftRotX;
      ty = pagePadding - topLeftRotY + verticalOffset;
    }

  // Translate LAST in screen space: in SVG, transforms apply right-to-left.
  // So we list translate first so it's applied last after scale and rotation.
  canvasContentEl.setAttribute('transform', `translate(${tx} ${ty}) scale(${fontScale}) rotate(${ROTATION_ANGLE} 0 0)`);

  // Keep responsive sizing: don't set fixed CSS pixel sizes; viewBox already set to pageW x pageH above
  // If we want a snug viewBox for on-screen preview in the future, compute it but don't alter CSS size.
  }

  // Debounce rendering
  let rafId = 0;
  function scheduleRender() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      render(inputEl.value);
    });
  }

  inputEl.addEventListener('input', scheduleRender);
  // Update SVG selection/caret on selection changes and navigation
  inputEl.addEventListener('select', scheduleRender);
  inputEl.addEventListener('keyup', scheduleRender);
  inputEl.addEventListener('click', scheduleRender);
  inputEl.addEventListener('focus', scheduleRender);
  inputEl.addEventListener('blur', scheduleRender);
  
  
  if (fontSizeEl) fontSizeEl.addEventListener('input', () => {
    fontSizeValueEl.textContent = fontSizeEl.value;
    try { localStorage.setItem(LS_KEYS.fontSize, String(fontSizeEl.value)); } catch {}
    scheduleRender();
  });
  if (alignmentEl) alignmentEl.addEventListener('change', () => { try { localStorage.setItem(LS_KEYS.alignment, String(alignmentEl.value)); } catch {} scheduleRender(); });
  // Icon buttons for alignment
  for (const btn of alignButtons) {
    btn.addEventListener('click', () => {
      alignButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (alignmentEl) alignmentEl.value = btn.dataset.align || 'left';
      try { localStorage.setItem(LS_KEYS.alignment, alignmentEl.value); } catch {}
      scheduleRender();
    });
  }
  // No opacity slider anymore
  strokeWidthEl.addEventListener('input', () => {
    strokeWidthValueEl.textContent = strokeWidthEl.value;
    try { localStorage.setItem(LS_KEYS.strokeWidth, String(strokeWidthEl.value)); } catch {}
    scheduleRender();
  });
  if (enableCurvesEl) enableCurvesEl.addEventListener('change', () => { try { localStorage.setItem(LS_KEYS.enableCurves, enableCurvesEl.checked ? '1':'0'); } catch {} scheduleRender(); });
  if (curveAtCrossesEl) curveAtCrossesEl.addEventListener('change', () => { try { localStorage.setItem(LS_KEYS.curveAtCrosses, curveAtCrossesEl.checked ? '1':'0'); } catch {} scheduleRender(); });
  if (curveAtTEl) curveAtTEl.addEventListener('change', () => { try { localStorage.setItem(LS_KEYS.curveAtT, curveAtTEl.checked ? '1':'0'); } catch {} scheduleRender(); });
  if (allCapsEl) allCapsEl.addEventListener('change', () => { try { localStorage.setItem(LS_KEYS.allCaps, allCapsEl.checked ? '1':'0'); } catch {} scheduleRender(); });
  if (taperedEndsEl) taperedEndsEl.addEventListener('change', () => { try { localStorage.setItem(LS_KEYS.taperedEnds, taperedEndsEl.checked ? '1':'0'); } catch {} scheduleRender(); });
  if (colorizeLettersEl) colorizeLettersEl.addEventListener('change', () => { try { localStorage.setItem(LS_KEYS.colorizeLetters, colorizeLettersEl.checked ? '1':'0'); } catch {} scheduleRender(); });
    if (maxCharsPerLineEl) maxCharsPerLineEl.addEventListener('input', () => {
      maxCharsPerLineValueEl && (maxCharsPerLineValueEl.textContent = String(maxCharsPerLineEl.value));
      try { localStorage.setItem(LS_KEYS.maxCharsPerLine, String(maxCharsPerLineEl.value)); } catch {}
    scheduleRender();
  });
  
  
  clearBtn.addEventListener('click', () => {
    inputEl.value = '';
    scheduleRender();
    inputEl.focus();
  });

  // Text sharing between pages using localStorage
  function saveText() {
    try { localStorage.setItem(LS_KEYS.text, inputEl.value); } catch {}
  }

  function loadText() {
    const saved = localStorage.getItem(LS_KEYS.text);
    if (saved) {
      inputEl.value = saved;
      scheduleRender();
    }
  }

  inputEl.addEventListener('input', saveText);
  
  navLink.addEventListener('click', (e) => {
    saveText();
  });

  // Export helpers
  function download(filename, blob) {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }

  // Derive base name from first 20 letters of input (A-Za-z); fallback when empty
  function getExportBaseName() {
    const raw = (inputEl.value || '').replace(/[^A-Za-z]+/g, '');
    const trimmed = raw.slice(0, 20);
    return trimmed.length ? trimmed : 'crosshatch';
  }

  function exportCurrentSvgStringContentOnly() {
    // Clone the content WITHOUT any transform to measure raw bbox
    console.log('[export] Starting SVG export from index.html');
    const rawClone = document.createElementNS('http://www.w3.org/2000/svg','g');
    let clonedCount = 0;
    for (let i = 0; i < canvasContentEl.childNodes.length; i++) {
      const node = canvasContentEl.childNodes[i];
      if (node.nodeType === 1 && node.getAttribute) {
        const layer = node.getAttribute('data-layer');
        if (layer === 'highlights' || layer === 'caret') continue;
      }
      rawClone.appendChild(node.cloneNode(true));
      clonedCount++;
    }
    // Measure bbox WITHOUT rotation in a hidden offscreen SVG
    const holder = document.createElement('div');
    holder.style.position = 'absolute';
    holder.style.left = '-99999px';
    holder.style.top = '0';
    holder.style.visibility = 'hidden';
    const probeSvg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    probeSvg.setAttribute('xmlns','http://www.w3.org/2000/svg');
    const probeClone = rawClone.cloneNode(true);
    probeSvg.appendChild(probeClone);
    holder.appendChild(probeSvg);
    document.body.appendChild(holder);
    let rawBB = { x: 0, y: 0, width: 1, height: 1 };
    try {
      if (probeClone.getBBox) rawBB = probeClone.getBBox();
      console.log('[export] Raw unrotated bbox:', JSON.stringify(rawBB));
    } catch (e) {
      console.warn('[export] getBBox failed, using fallback 1x1', e);
    }
    document.body.removeChild(holder);
    
    // Now compute the rotated bounding box dimensions
    // For -45° rotation, the rotated width/height are: (w+h)/sqrt(2)
    const rotW = (rawBB.width + rawBB.height) / Math.SQRT2;
    const rotH = rotW; // square bounding box for 45° rotation
    const padding = 10;
    const width = Math.max(1, Math.ceil(rotW + 2 * padding));
    const height = Math.max(1, Math.ceil(rotH + 2 * padding));
    console.log('[export] Final export dimensions:', width, 'x', height);
    
    // Build final SVG with rotation applied
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('fill', 'none');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const defs = canvasSvgEl.querySelector('defs');
    if (defs) svg.appendChild(defs.cloneNode(true));
    const titleNode = document.createElementNS('http://www.w3.org/2000/svg','title');
    titleNode.textContent = getExportBaseName();
    svg.appendChild(titleNode);
    
    // Wrap with: center the content, rotate -45°, then translate to account for original bbox position
    const wrap = document.createElementNS('http://www.w3.org/2000/svg','g');
    const centerX = width / 2;
    const centerY = height / 2;
    const origCenterX = rawBB.x + rawBB.width / 2;
    const origCenterY = rawBB.y + rawBB.height / 2;
    wrap.setAttribute('transform', `translate(${centerX} ${centerY}) rotate(${ROTATION_ANGLE}) translate(${-origCenterX} ${-origCenterY})`);
    wrap.appendChild(rawClone);
    svg.appendChild(wrap);
    console.log('[export] cloned nodes:', clonedCount, 'raw bbox:', rawBB, 'rotated dims:', rotW.toFixed(1), 'x', rotH.toFixed(1));
    const serializer = new XMLSerializer();
    return `<?xml version="1.0" encoding="UTF-8"?>\n${serializer.serializeToString(svg)}`;
  }

  if (exportSvgBtn) exportSvgBtn.addEventListener('click', () => {
    console.log('[export] SVG export button clicked!');
    const svgStr = exportCurrentSvgStringContentOnly();
    console.log('[export] Generated SVG string length:', svgStr.length);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    download(getExportBaseName() + '.svg', blob);
  });

  if (exportPngBtn) exportPngBtn.addEventListener('click', async () => {
    const svgStr = exportCurrentSvgStringContentOnly();
    // Read size from the generated SVG viewBox
    const temp = new DOMParser().parseFromString(svgStr, 'image/svg+xml');
    const vb = (temp.documentElement && temp.documentElement.getAttribute('viewBox')) || '0 0 800 600';
    const parts = vb.split(/\s+/).map(Number);
    const width = Math.max(1, Math.round(parts[2] || 800));
    const height = Math.max(1, Math.round(parts[3] || 600));
    const scale = 2; // 2x for crisper PNG
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const img = new Image();
    const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
    await new Promise((resolve, reject) => {
      img.onload = resolve; img.onerror = reject; img.src = svgUrl;
    });
    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob((blob) => {
      if (blob) download(getExportBaseName() + '.png', blob);
    }, 'image/png');
  });

  // Load text on page load
  // Load settings, then text so font size/alignment are ready before first render
  try {
  const fs = localStorage.getItem(LS_KEYS.fontSize); if (fs && fontSizeEl) { fontSizeEl.value = fs; fontSizeValueEl.textContent = fs; }
    const al = localStorage.getItem(LS_KEYS.alignment); if (al && alignmentEl) { alignmentEl.value = al; const btn = document.querySelector(`.align-btn[data-align="${al}"]`); if (btn) { document.querySelectorAll('.align-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); } }
    const ec = localStorage.getItem(LS_KEYS.enableCurves); if (ec !== null && enableCurvesEl) enableCurvesEl.checked = ec === '1';
    const cx = localStorage.getItem(LS_KEYS.curveAtCrosses); if (cx !== null && curveAtCrossesEl) curveAtCrossesEl.checked = cx === '1';
    const ct = localStorage.getItem(LS_KEYS.curveAtT); if (ct !== null && curveAtTEl) curveAtTEl.checked = ct === '1';
    const ac = localStorage.getItem(LS_KEYS.allCaps); if (ac !== null && allCapsEl) allCapsEl.checked = ac === '1';
    const te = localStorage.getItem(LS_KEYS.taperedEnds); if (te !== null && taperedEndsEl) taperedEndsEl.checked = te === '1';
    const cl = localStorage.getItem(LS_KEYS.colorizeLetters); if (cl !== null && colorizeLettersEl) colorizeLettersEl.checked = cl === '1';
  const sw = localStorage.getItem(LS_KEYS.strokeWidth); if (sw && strokeWidthEl) { strokeWidthEl.value = sw; strokeWidthValueEl.textContent = sw; }
    const mc = localStorage.getItem(LS_KEYS.maxCharsPerLine); if (mc && maxCharsPerLineEl) { maxCharsPerLineEl.value = mc; if (maxCharsPerLineValueEl) maxCharsPerLineValueEl.textContent = mc; }
  } catch {}
  loadText();
  

  // Initial demo
  if (!inputEl.value) {
    inputEl.value = 'HELLO';
    render(inputEl.value);
  }

  // Keep page-aligned view responsive
  window.addEventListener('resize', () => {
    scheduleRender();
  });
})();
