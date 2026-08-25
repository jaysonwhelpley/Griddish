/* PreRotated Character Renderer for index.html
 * Uses pre-rotated SVG assets from PreRotatedExports/
 * Supports: smooth corners, T-junctions, 4-way intersections, stroke width, 
 * tapered ends, colorization, and alignment
 */

(function() {
  'use strict';

  // Character mapping to SVG filenames
  const CHAR_MAP = {
    'A': 'A_upper.svg', 'B': 'B_upper.svg', 'C': 'C_upper.svg', 'D': 'D_upper.svg',
    'E': 'E_upper.svg', 'F': 'F_upper.svg', 'G': 'G_upper.svg', 'H': 'H_upper.svg',
    'I': 'I_upper.svg', 'J': 'J_upper.svg', 'K': 'K_upper.svg', 'L': 'L_upper.svg',
    'M': 'M_upper.svg', 'N': 'N_upper.svg', 'O': 'O_upper.svg', 'P': 'P_upper.svg',
    'Q': 'Q_upper.svg', 'R': 'R_upper.svg', 'S': 'S_upper.svg', 'T': 'T_upper.svg',
    'U': 'U_upper.svg', 'V': 'V_upper.svg', 'W': 'W_upper.svg', 'X': 'X_upper.svg',
    'Y': 'Y_upper.svg', 'Z': 'Z_upper.svg',
    'a': 'a_lower.svg', 'b': 'b_lower.svg', 'c': 'c_lower.svg', 'd': 'd_lower.svg',
    'e': 'e_lower.svg', 'f': 'f_lower.svg', 'g': 'g_lower.svg', 'h': 'h_lower.svg',
    'i': 'i_lower.svg', 'j': 'j_lower.svg', 'k': 'k_lower.svg', 'l': 'l_lower.svg',
    'm': 'm_lower.svg', 'n': 'n_lower.svg', 'o': 'o_lower.svg', 'p': 'p_lower.svg',
    'q': 'q_lower.svg', 'r': 'r_lower.svg', 's': 's_lower.svg', 't': 't_lower.svg',
    'u': 'u_lower.svg', 'v': 'v_lower.svg', 'w': 'w_lower.svg', 'x': 'x_lower.svg',
    'y': 'y_lower.svg', 'z': 'z_lower.svg',
    '0': '0.svg', '1': '1.svg', '2': '2.svg', '3': '3.svg', '4': '4.svg',
    '5': '5.svg', '6': '6.svg', '7': '7.svg', '8': '8.svg', '9': '9.svg',
    // Punctuation
    '.': 'Period.svg', ',': 'Comma.svg', '!': 'Bang.svg', '?': 'Question.svg',
    ';': 'SemiColon.svg', ':': 'Colon.svg',
    // Quotes (map all varieties to the same asset)
    '"': 'Quote.svg', "'": 'Quote.svg',
    '‘': 'Quote.svg', '’': 'Quote.svg', '“': 'Quote.svg', '”': 'Quote.svg'
  };

  // Color palette for letter colorization
  const LETTER_COLORS = [
  '#000000', '#d7263d', '#1b998b', '#a0c4ff', '#ffd23f', '#ff6f59', '#3a86ff',
  '#8338ec', '#ffbe0b', '#06d6a0', '#f72585', '#43aa8b', '#f9c74f', '#577590',
  '#ff006e', '#00b4d8', '#9d4edd', '#ffb4a2', '#b5179e', '#0077b6'
  ];

  // Cache for loaded SVG character data
  const charCache = new Map();
  
  // Standard character size (from the pre-rotated SVGs)
  const CHAR_SIZE = 281; // width/height of each character SVG

  // DOM elements
  const inputEl = document.getElementById('textInput');
  const canvasSvgEl = document.getElementById('canvasSvg');
  const canvasContentEl = document.getElementById('canvasContent');
  const fontSizeEl = document.getElementById('fontSize');
  const fontSizeValueEl = document.getElementById('fontSizeValue');
  const alignmentEl = document.getElementById('alignment');
  const strokeWidthEl = document.getElementById('strokeWidth');
  const strokeWidthValueEl = document.getElementById('strokeWidthValue');
  const charSpacingEl = document.getElementById('charSpacing');
  const charSpacingValueEl = document.getElementById('charSpacingValue');
  const enableCurvesEl = document.getElementById('enableCurves');
  const curveAtCrossesEl = document.getElementById('curveAtCrosses');
  const curveAtTEl = document.getElementById('curveAtT');
  const taperedEndsEl = document.getElementById('taperedEnds');
  const colorizeLettersEl = document.getElementById('colorizeLetters');
  const maxCharsPerLineEl = document.getElementById('maxCharsPerLine');
  const maxCharsPerLineValueEl = document.getElementById('maxCharsPerLineValue');
  const exportSvgBtn = document.getElementById('exportSvgBtn');
  const exportPngBtn = document.getElementById('exportPngBtn');
  const clearBtn = document.getElementById('clearBtn');

  // Enforce a maximum stroke width of 10 (slider units)
  if (strokeWidthEl) {
    strokeWidthEl.setAttribute('max', '10');
  }

  // Fixed line spacing
  const LINE_SPACING = 186.4;
  // Debug logging for curve generation
  const DEBUG_CURVES = true;

  /**
   * Word-wrap text to maxCharsPerLine
   */
  function wrapText(text, maxChars) {
    if (!maxChars || maxChars <= 0) return text;
    
    const lines = text.split('\n');
    const wrappedLines = [];
    
    for (const line of lines) {
      if (line.length <= maxChars) {
        wrappedLines.push(line);
        continue;
      }
      
      // Line needs wrapping
      let remaining = line;
      while (remaining.length > maxChars) {
        // Try to break at a space within the limit
        let breakPoint = maxChars;
        const lastSpace = remaining.lastIndexOf(' ', maxChars);
        
        if (lastSpace > 0) {
          // Break at the last space before the limit
          breakPoint = lastSpace;
        }
        
        wrappedLines.push(remaining.substring(0, breakPoint).trim());
        remaining = remaining.substring(breakPoint).trim();
      }
      
      // Add any remaining text
      if (remaining.length > 0) {
        wrappedLines.push(remaining);
      }
    }
    
    return wrappedLines.join('\n');
  }

  /**
   * Parse a single path's segments (supports only absolute M/L)
   */
  function parsePathSegments(pathD) {
    const segments = [];
    const commands = pathD.match(/[ML][^ML]*/g);
    if (!commands) return segments;

    let currentX = 0, currentY = 0;
    for (const cmd of commands) {
      const type = cmd[0];
      const nums = cmd.slice(1).trim().split(/[\s,]+/).map(parseFloat);
      if (type === 'M') {
        currentX = nums[0];
        currentY = nums[1];
      } else if (type === 'L') {
        const x2 = nums[0], y2 = nums[1];
        segments.push({ x1: currentX, y1: currentY, x2, y2 });
        currentX = x2; currentY = y2;
      }
    }
    return segments;
  }

  /** Gather segments from all paths in a character */
  function parseAllSegments(paths) {
    const segments = [];
    paths.forEach((d, pathIdx) => {
      const segs = parsePathSegments(d);
      segs.forEach((s, localIdx) => segments.push({ ...s, pathIdx, localIdx }));
    });
    return segments;
  }

  /**
   * Cluster endpoints into junctions using Euclidean tolerance (no rounding issues)
   * Returns an array of clusters: { x, y, incidents: [{segmentIdx,end,x,y}] }
   */
  function findJunctions(allSegments, epsilon = 1.2) {
    const clusters = [];

    function addPoint(entry) {
      for (const c of clusters) {
        const dx = entry.x - c.x;
        const dy = entry.y - c.y;
        if (dx * dx + dy * dy <= epsilon * epsilon) {
          c.incidents.push(entry);
          // Optionally refine centroid slightly
          // c.x = (c.x * (c.incidents.length - 1) + entry.x) / c.incidents.length;
          // c.y = (c.y * (c.incidents.length - 1) + entry.y) / c.incidents.length;
          return;
        }
      }
      clusters.push({ x: entry.x, y: entry.y, incidents: [entry] });
    }

    allSegments.forEach((s, idx) => {
      addPoint({ segmentIdx: idx, end: 'start', x: s.x1, y: s.y1 });
      addPoint({ segmentIdx: idx, end: 'end',   x: s.x2, y: s.y2 });
    });

    return clusters;
  }

  function segmentLength(s) {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    return Math.hypot(dx, dy);
  }

  function unitVector(fromX, fromY, toX, toY) {
    const dx = toX - fromX, dy = toY - fromY;
    const len = Math.hypot(dx, dy) || 1;
    return { ux: dx / len, uy: dy / len };
  }

  function angleBetween(v1, v2) {
    const dot = v1.ux * v2.ux + v1.uy * v2.uy;
    const clamped = Math.max(-1, Math.min(1, dot));
    return Math.acos(clamped) * (180 / Math.PI);
  }

  // stray experimental helper removed

  // Load SVG character data from PreRotatedExports/
  var loadCharacter = async function(char) {
    if (charCache.has(char)) {
      return charCache.get(char);
    }

    let filename = CHAR_MAP[char];
    // Fallback: for any other punctuation/special char, use Rest.svg if available
    if (!filename) {
      const isWhitespace = /\s/.test(char);
      const isAlnum = /[A-Za-z0-9]/.test(char);
      if (!isWhitespace && !isAlnum) {
        filename = 'Rest.svg';
      }
    }
    if (!filename) {
      console.warn(`No SVG file mapped for character: ${char}`);
      return null;
    }

    try {
      const response = await fetch(`PreRotatedExports/${filename}`);
      const svgText = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, 'image/svg+xml');
      const svg = doc.documentElement;
      // Extract paths
      const paths = Array.from(svg.querySelectorAll('path')).map(p => p.getAttribute('d'));
      const charData = {
        paths,
        width: parseInt(svg.getAttribute('width')) || CHAR_SIZE,
        height: parseInt(svg.getAttribute('height')) || CHAR_SIZE
      };
      charCache.set(char, charData);
      return charData;
    } catch (err) {
      console.error(`Failed to load character ${char}:`, err);
      return null;
    }
  }

  /**
   * Render text using pre-rotated characters
   */
  async function render(text) {
    // Clear canvas
    while (canvasContentEl.firstChild) {
      canvasContentEl.removeChild(canvasContentEl.firstChild);
    }

    // Clear previous gradients/defs
    const oldDefs = canvasSvgEl.querySelector('defs');
    if (oldDefs) oldDefs.remove();

    if (!text) {
      canvasSvgEl.setAttribute('viewBox', '0 0 800 600');
      return;
    }

    const fontSize = parseFloat(fontSizeEl.value) || 100;
    const scale = fontSize / CHAR_SIZE;
  // Clamp stroke width slider value to [0, 10] in slider units, then scale to canvas units
  const rawStroke = Math.max(0, Math.min(10, parseFloat(strokeWidthEl.value) || 6));
  const strokeWidth = rawStroke * scale;
    const charAdvance = 62.22;
    const alignment = alignmentEl ? alignmentEl.value : 'left';
    const colorize = colorizeLettersEl && colorizeLettersEl.checked;
    const allCaps = document.getElementById('allCaps')?.checked;
    const taperedEnds = document.getElementById('taperedEnds')?.checked;
    const maxCharsPerLine = maxCharsPerLineEl ? parseInt(maxCharsPerLineEl.value) || 40 : 0;

  // Apply ALL CAPS if enabled
  if (allCaps) text = text.toUpperCase();
  
  // Apply word-wrapping
  text = wrapText(text, maxCharsPerLine);
  
  const lines = text.split('\n');
    
    // Calculate canvas size
    let maxLineWidth = 0;
    for (const line of lines) {
      const charArray = Array.from(line);
      // Each character advances charAdvance, but we need to add CHAR_SIZE for the last character's full extent
      const lineWidth = charArray.length > 0 
        ? (charArray.length * charAdvance * scale) + (CHAR_SIZE - charAdvance) * scale
        : 0;
      if (lineWidth > maxLineWidth) maxLineWidth = lineWidth;
    }
    
    const canvasWidth = Math.max(800, maxLineWidth);
    const canvasHeight = Math.max(600, lines.length * LINE_SPACING * scale);
    
    canvasSvgEl.setAttribute('viewBox', `0 0 ${canvasWidth} ${canvasHeight}`);
    
    let yOffset = 0;

    // Collect ALL segments from ALL lines first
    const allSegments = []; // {x1, y1, x2, y2, color}
    const lineSegments = []; // Track which segments belong to which line for organization

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const charArray = Array.from(line);
      const lineWidth = charArray.length > 0 
        ? (charArray.length * charAdvance * scale) + (CHAR_SIZE - charAdvance) * scale
        : 0;
      
      let xOffset = 0;
      if (alignment === 'center') {
        // Sticky center for even counts: center as if the line had (n-1) chars,
        // so the left-of-center anchor stays fixed and the extra char is added to the right.
        const n = charArray.length;
        const oddN = (n % 2 === 1) ? n : (n > 0 ? n - 1 : 0);
        const oddLineWidth = oddN > 0 
          ? (oddN * charAdvance * scale) + (CHAR_SIZE - charAdvance) * scale
          : 0;
        xOffset = (canvasWidth - oddLineWidth) / 2;
      } else if (alignment === 'right') {
        xOffset = canvasWidth - lineWidth;
      }

      const lineStartIndex = allSegments.length;
      let wordLetterIndex = 0;

      for (const char of charArray) {
        if (/\s/.test(char)) {
          xOffset += charAdvance * scale;
          wordLetterIndex = 0;
          continue;
        }

        // Determine color for this char
        let color = 'black';
        if (colorize) {
          if (!/[a-zA-Z0-9]/.test(char)) {
            color = '#aaaaaa';
          } else {
            if (wordLetterIndex === 0) {
              color = '#000000';
            } else {
              color = LETTER_COLORS[1 + ((wordLetterIndex - 1) % (LETTER_COLORS.length - 1))];
            }
            wordLetterIndex++;
          }
        }

        const data = await loadCharacter(char);
        if (!data) { xOffset += charAdvance * scale; continue; }

        for (const d of data.paths) {
          const segs = parsePathSegments(d);
          for (const s of segs) {
            const x1 = xOffset + s.x1 * scale;
            const y1 = yOffset + s.y1 * scale;
            const x2 = xOffset + s.x2 * scale;
            const y2 = yOffset + s.y2 * scale;
            allSegments.push({ x1, y1, x2, y2, color });
          }
        }

        xOffset += charAdvance * scale;
      }

      lineSegments.push({ 
        startIndex: lineStartIndex, 
        endIndex: allSegments.length,
        yOffset: yOffset
      });
      yOffset += LINE_SPACING * scale;
    }

    // Now process all segments with global junction detection
    const enableCurves = enableCurvesEl && enableCurvesEl.checked;
    const enableT = curveAtTEl && curveAtTEl.checked;
    const enable4Way = curveAtCrossesEl && curveAtCrossesEl.checked;

    // Add tapered ends if enabled
    if (taperedEnds && allSegments.length > 0) {
      const endpointMap = new Map();
      for (const s of allSegments) {
        const key1 = `${Math.round(s.x1)},${Math.round(s.y1)}`;
        const key2 = `${Math.round(s.x2)},${Math.round(s.y2)}`;
        endpointMap.set(key1, (endpointMap.get(key1) || 0) + 1);
        endpointMap.set(key2, (endpointMap.get(key2) || 0) + 1);
      }
      for (const [key, count] of endpointMap.entries()) {
        if (count === 1) {
          const [x, y] = key.split(',').map(Number);
          const triLen = strokeWidth * 2.5;
          const triPath = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
          let dir = { x: 1, y: 0 };
          for (const s of allSegments) {
            if (Math.round(s.x1) === x && Math.round(s.y1) === y) {
              dir = { x: s.x2 - s.x1, y: s.y2 - s.y1 };
              break;
            }
            if (Math.round(s.x2) === x && Math.round(s.y2) === y) {
              dir = { x: s.x1 - s.x2, y: s.y1 - s.y2 };
              break;
            }
          }
          const len = Math.hypot(dir.x, dir.y) || 1;
          dir.x /= len; dir.y /= len;
          const tip = { x: x, y: y };
          const base1 = { x: x - dir.x * triLen + dir.y * triLen * 0.5, y: y - dir.y * triLen - dir.x * triLen * 0.5 };
          const base2 = { x: x - dir.x * triLen - dir.y * triLen * 0.5, y: y - dir.y * triLen + dir.x * triLen * 0.5 };
          triPath.setAttribute('points', `${tip.x},${tip.y} ${base1.x},${base1.y} ${base2.x},${base2.y}`);
          triPath.setAttribute('fill', 'currentColor');
          triPath.setAttribute('opacity', '0.7');
          canvasContentEl.appendChild(triPath);
        }
      }
    }

    // If no curves, emit straight lines directly
    if (!enableCurves) {
      for (const s of allSegments) {
        if (Math.hypot(s.x2 - s.x1, s.y2 - s.y1) < 0.5) continue;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M${s.x1},${s.y1} L${s.x2},${s.y2}`);
        path.setAttribute('stroke', s.color || 'black');
        path.setAttribute('stroke-width', strokeWidth);
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('fill', 'none');
        canvasContentEl.appendChild(path);
      }
      if (DEBUG_CURVES) console.info('[curves] skipped (disabled), total segments=', allSegments.length);
      return;
    }

    // Global junction detection across ALL segments
    const epsilon = 2.0 * scale;
    const clusters = findJunctions(allSegments, epsilon);
    let lCorners = 0, tJuncs = 0, crossLoops = 0, lArcs = 0, tArcs = 0;

    // Use a FIXED RADIUS for all arcs (like the SVG example with r=120)
    const fixedRadius = strokeWidth * 4.5;

    const trimmed = allSegments.map(s => ({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, color: s.color }));
    const arcs = [];

    function outwardVec(cluster, ref) {
      const s = allSegments[ref.segmentIdx];
      const from = { x: cluster.x, y: cluster.y };
      const to = ref.end === 'start' ? { x: s.x2, y: s.y2 } : { x: s.x1, y: s.y1 };
      return unitVector(from.x, from.y, to.x, to.y);
    }

    // L-corners: degree 2
    for (const cl of clusters) {
      const inc = cl.incidents;
      if (inc.length !== 2) continue;
      const a = inc[0], b = inc[1];
      const sA = allSegments[a.segmentIdx];
      const sB = allSegments[b.segmentIdx];

      const vA = outwardVec(cl, a);
      const vB = outwardVec(cl, b);
      const angDeg = angleBetween(vA, vB);
      if (angDeg < 10 || angDeg > 170) continue;
  const ang = angDeg * Math.PI / 180;

  // Force a quarter-circle fillet for L-corners: trim equals the fixed radius
  const r = fixedRadius;
  const maxTA = Math.hypot(sA.x2 - sA.x1, sA.y2 - sA.y1);
  const maxTB = Math.hypot(sB.x2 - sB.x1, sB.y2 - sB.y1);
  const tA = Math.min(r, maxTA);
  const tB = Math.min(r, maxTB);
      
  if (DEBUG_CURVES) console.debug('L-corner:', { x: cl.x, y: cl.y, maxTA, maxTB, tA, tB, r, angDeg });
      const pA = { x: cl.x + vA.ux * tA, y: cl.y + vA.uy * tA };
      const pB = { x: cl.x + vB.ux * tB, y: cl.y + vB.uy * tB };

      const ta = trimmed[a.segmentIdx];
      if (a.end === 'start') { ta.x1 = pA.x; ta.y1 = pA.y; } else { ta.x2 = pA.x; ta.y2 = pA.y; }
      const tb = trimmed[b.segmentIdx];
      if (b.end === 'start') { tb.x1 = pB.x; tb.y1 = pB.y; } else { tb.x2 = pB.x; tb.y2 = pB.y; }

      const cross = vA.ux * vB.uy - vA.uy * vB.ux;
      const sweep = cross < 0 ? 1 : 0;
      const color1 = sA.color || 'black';
      const color2 = sB.color || 'black';
      const gradient = color1 !== color2;
      arcs.push({ p1: pA, p2: pB, r, sweep, color1, color2, gradient });
      lCorners++; lArcs++;
    }

    // T-junctions: degree 3
    if (enableT) {
      for (const cl of clusters) {
        const inc = cl.incidents;
        if (inc.length !== 3) continue;
        
        // Get all three arms with their outward vectors
        const outs = inc.map(ref => ({ ref, v: outwardVec(cl, ref) }));
        
        // Find the pair with the largest angle - these are the "caps"
        // The third arm is the "stem"
        let bestI = -1, bestJ = -1, best = -1;
        for (let i = 0; i < 3; i++) {
          for (let j = i + 1; j < 3; j++) {
            const a = angleBetween(outs[i].v, outs[j].v);
            if (a > best) { best = a; bestI = i; bestJ = j; }
          }
        }
        
        // Skip if the angle is too shallow (< 120 degrees means not really a T)
        if (best < 120) continue;
        
        const cap1 = outs[bestI];
        const cap2 = outs[bestJ];
        const stem = outs[[0, 1, 2].find(k => k !== bestI && k !== bestJ)];

        const sStem = allSegments[stem.ref.segmentIdx];
        const sCap1 = allSegments[cap1.ref.segmentIdx];
        const sCap2 = allSegments[cap2.ref.segmentIdx];

  const maxStem = Math.hypot(sStem.x2 - sStem.x1, sStem.y2 - sStem.y1);
  const maxCap1 = Math.hypot(sCap1.x2 - sCap1.x1, sCap1.y2 - sCap1.y1);
  const maxCap2 = Math.hypot(sCap2.x2 - sCap2.x1, sCap2.y2 - sCap2.y1);
        
        // Use FIXED RADIUS for all arcs
        const r1 = fixedRadius;
        const r2 = fixedRadius;
        
        // Calculate angles for proper trim distance
        const ang1 = angleBetween(stem.v, cap1.v) * Math.PI / 180;
        const ang2 = angleBetween(stem.v, cap2.v) * Math.PI / 180;
        
        // Calculate the required trim distance for this fixed radius
        // For a T-junction, all three arms should be trimmed by the same distance
        const t1 = r1 / Math.tan(ang1 / 2);
        const t2 = r2 / Math.tan(ang2 / 2);
        const t = Math.min(t1, t2, maxStem, maxCap1, maxCap2);
        
        if (DEBUG_CURVES) console.debug('T-junction:', { x: cl.x, y: cl.y, maxStem, maxCap1, maxCap2, t, t1, t2, best });

        const pStem = { x: cl.x + stem.v.ux * t, y: cl.y + stem.v.uy * t };
        const pCap1 = { x: cl.x + cap1.v.ux * t, y: cl.y + cap1.v.uy * t };
        const pCap2 = { x: cl.x + cap2.v.ux * t, y: cl.y + cap2.v.uy * t };

        const trStem = trimmed[stem.ref.segmentIdx];
        if (stem.ref.end === 'start') { trStem.x1 = pStem.x; trStem.y1 = pStem.y; } 
        else { trStem.x2 = pStem.x; trStem.y2 = pStem.y; }
        const trC1 = trimmed[cap1.ref.segmentIdx];
        if (cap1.ref.end === 'start') { trC1.x1 = pCap1.x; trC1.y1 = pCap1.y; } 
        else { trC1.x2 = pCap1.x; trC1.y2 = pCap1.y; }
        const trC2 = trimmed[cap2.ref.segmentIdx];
        if (cap2.ref.end === 'start') { trC2.x1 = pCap2.x; trC2.y1 = pCap2.y; } 
        else { trC2.x2 = pCap2.x; trC2.y2 = pCap2.y; }

        const sweep1 = (stem.v.ux * cap1.v.uy - stem.v.uy * cap1.v.ux) < 0 ? 1 : 0;
        const sweep2 = (stem.v.ux * cap2.v.uy - stem.v.uy * cap2.v.ux) < 0 ? 1 : 0;
        const colorStem = sStem.color || 'black';
        const colorC1 = sCap1.color || 'black';
        const colorC2 = sCap2.color || 'black';
        arcs.push({ p1: pStem, p2: pCap1, r: r1, sweep: sweep1, color1: colorStem, color2: colorC1, gradient: colorStem !== colorC1 });
        arcs.push({ p1: pStem, p2: pCap2, r: r2, sweep: sweep2, color1: colorStem, color2: colorC2, gradient: colorStem !== colorC2 });
        tJuncs++; 
        tArcs += 2;
      }
    }

    // 4-way crosses
    if (enable4Way) {
      for (const cl of clusters) {
        const inc = cl.incidents;
        if (inc.length !== 4) continue;
        const dirs = { left: null, right: null, up: null, down: null };
        for (const ref of inc) {
          const v = outwardVec(cl, ref);
          const s = allSegments[ref.segmentIdx];
          const info = { ref, v, color: s.color || 'black' };
          if (Math.abs(v.ux) >= Math.abs(v.uy)) {
            if (v.ux >= 0) dirs.right = info; else dirs.left = info;
          } else {
            if (v.uy >= 0) dirs.down = info; else dirs.up = info;
          }
        }
        if (!(dirs.left && dirs.right && dirs.up && dirs.down)) continue;

        const lengths = [dirs.left, dirs.right, dirs.up, dirs.down].map(d => {
          const s = allSegments[d.ref.segmentIdx];
          return Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
        });
        
        // Use fixed radius for 4-way crosses too
        // For perpendicular arms (90° angle), trim = r / tan(45°) = r
        const crossR = fixedRadius;
        const crossTrim = Math.min(crossR, ...lengths);
        
        function applyTrim(d, pt) {
          const t = trimmed[d.ref.segmentIdx];
          const isStart = d.ref.end === 'start';
          if (isStart) { t.x1 = pt.x; t.y1 = pt.y; } else { t.x2 = pt.x; t.y2 = pt.y; }
        }
        const pL = { x: cl.x + dirs.left.v.ux * crossTrim, y: cl.y + dirs.left.v.uy * crossTrim };
        const pR = { x: cl.x + dirs.right.v.ux * crossTrim, y: cl.y + dirs.right.v.uy * crossTrim };
        const pU = { x: cl.x + dirs.up.v.ux * crossTrim, y: cl.y + dirs.up.v.uy * crossTrim };
        const pD = { x: cl.x + dirs.down.v.ux * crossTrim, y: cl.y + dirs.down.v.uy * crossTrim };
        applyTrim(dirs.left, pL);
        applyTrim(dirs.right, pR);
        applyTrim(dirs.up, pU);
        applyTrim(dirs.down, pD);

        const loopColor = dirs.right.color;
        function astroidPoint(cx, cy, R, t) {
          return { x: cx + R * Math.pow(Math.cos(t), 3), y: cy + R * Math.pow(Math.sin(t), 3) };
        }
        function astroidDeriv(R, t) {
          const c = Math.cos(t), s = Math.sin(t);
          return { x: -3 * R * c * c * s, y: 3 * R * s * s * c };
        }
        function pushCubicFromParam(cx, cy, R, t0, t1, color) {
          const p0 = astroidPoint(cx, cy, R, t0);
          const p3 = astroidPoint(cx, cy, R, t1);
          const v0 = astroidDeriv(R, t0);
          const v1 = astroidDeriv(R, t1);
          const dt = t1 - t0;
          const c1 = { x: p0.x + (v0.x * dt) / 3, y: p0.y + (v0.y * dt) / 3 };
          const c2 = { x: p3.x - (v1.x * dt) / 3, y: p3.y - (v1.y * dt) / 3 };
          arcs.push({ cubic: true, p0, c1, c2, p3, color1: color });
        }
        const T = [0, Math.PI/4, Math.PI/2, 3*Math.PI/4, Math.PI, 5*Math.PI/4, 3*Math.PI/2, 7*Math.PI/4, 2*Math.PI];
        for (let i = 0; i < T.length - 1; i++) {
          pushCubicFromParam(cl.x, cl.y, crossTrim, T[i], T[i+1], loopColor);
        }
        crossLoops++;
      }
    }

    // Emit straight segments
    for (const s of trimmed) {
      if (Math.hypot(s.x2 - s.x1, s.y2 - s.y1) < 0.5) continue;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M${s.x1},${s.y1} L${s.x2},${s.y2}`);
      path.setAttribute('stroke', s.color || 'black');
      path.setAttribute('stroke-width', strokeWidth);
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('fill', 'none');
      canvasContentEl.appendChild(path);
    }

    // Emit arcs
    function ensureDefs() {
      let defs = canvasSvgEl.querySelector('defs');
      if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        canvasSvgEl.insertBefore(defs, canvasSvgEl.firstChild);
      }
      return defs;
    }

    for (const c of arcs) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      if (c.cubic) {
        path.setAttribute('d', `M${c.p0.x},${c.p0.y} C${c.c1.x},${c.c1.y} ${c.c2.x},${c.c2.y} ${c.p3.x},${c.p3.y}`);
        path.setAttribute('stroke', c.color1 || 'black');
      } else {
        path.setAttribute('d', `M${c.p1.x},${c.p1.y} A${c.r},${c.r} 0 0 ${c.sweep} ${c.p2.x},${c.p2.y}`);
        if (c.gradient) {
          const defs = ensureDefs();
          const gradId = `grad-${Math.random().toString(36).substr(2, 9)}`;
          const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
          grad.setAttribute('id', gradId);
          grad.setAttribute('x1', c.p1.x); grad.setAttribute('y1', c.p1.y);
          grad.setAttribute('x2', c.p2.x); grad.setAttribute('y2', c.p2.y);
          grad.setAttribute('gradientUnits', 'userSpaceOnUse');
          const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
          const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
          stop1.setAttribute('offset', '0%');
          stop1.setAttribute('stop-color', c.color1);
          stop2.setAttribute('offset', '100%');
          stop2.setAttribute('stop-color', c.color2);
          grad.appendChild(stop1); grad.appendChild(stop2);
          defs.appendChild(grad);
          path.setAttribute('stroke', `url(#${gradId})`);
        } else {
          path.setAttribute('stroke', c.color1 || 'black');
        }
      }
      path.setAttribute('stroke-width', strokeWidth);
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('fill', 'none');
      canvasContentEl.appendChild(path);
    }

    if (DEBUG_CURVES) {
      console.log('[curves] GLOBAL summary:', { 
        totalSegments: allSegments.length, 
        clusters: clusters.length, 
        lCorners, 
        tJuncs, 
        crossLoops, 
        lArcs, 
        tArcs, 
        totalArcs: arcs.length 
      });
    }
  }

  /* BEGIN DUPLICATE/ORPHANED BLOCK (commented out to fix syntax)

  // Debounced render
  let rafId = 0;
  function scheduleRender() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      render(inputEl.value);
    });
  }

  // Event listeners
  inputEl.addEventListener('input', scheduleRender);
  if (fontSizeEl) fontSizeEl.addEventListener('input', () => {
    fontSizeValueEl.textContent = fontSizeEl.value;
    scheduleRender();
  });
  if (alignmentEl) alignmentEl.addEventListener('change', scheduleRender);
  if (strokeWidthEl) strokeWidthEl.addEventListener('input', () => {
    const v = Math.max(0, Math.min(10, parseFloat(strokeWidthEl.value) || 0));
    strokeWidthEl.value = String(v);
    if (strokeWidthValueEl) strokeWidthValueEl.textContent = String(v);
    scheduleRender();
  });
  if (enableCurvesEl) enableCurvesEl.addEventListener('change', scheduleRender);
  if (curveAtCrossesEl) curveAtCrossesEl.addEventListener('change', scheduleRender);
  if (curveAtTEl) curveAtTEl.addEventListener('change', scheduleRender);
  if (taperedEndsEl) taperedEndsEl.addEventListener('change', scheduleRender);
  if (colorizeLettersEl) colorizeLettersEl.addEventListener('change', scheduleRender);
  if (maxCharsPerLineEl) maxCharsPerLineEl.addEventListener('input', () => {
    if (maxCharsPerLineValueEl) maxCharsPerLineValueEl.textContent = maxCharsPerLineEl.value;
    scheduleRender();
  });
  
  // Alignment button interactivity
  const alignBtns = [
    document.getElementById('alignLeftBtn'),
    document.getElementById('alignCenterBtn'),
    document.getElementById('alignRightBtn')
  ];
  alignBtns.forEach(btn => {
    if (!btn) return;
    btn.addEventListener('click', () => {
      alignBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      alignmentEl.value = btn.getAttribute('data-align');
      scheduleRender();
    });
  });
  
  clearBtn.addEventListener('click', () => {
    inputEl.value = '';
    scheduleRender();
  });

  // Initial render
  // Restore settings and text from localStorage
  function restoreSettings() {
              color = LETTER_COLORS[1 + ((wordLetterIndex - 1) % (LETTER_COLORS.length - 1))];
            }
            wordLetterIndex++;
          }
        }

        const data = await loadCharacter(char);
        if (!data) { xOffset += charAdvance * scale; continue; }

        for (const d of data.paths) {
          const segs = parsePathSegments(d);
          for (const s of segs) {
            const x1 = xOffset + s.x1 * scale;
            const y1 = yBase + s.y1 * scale;
            const x2 = xOffset + s.x2 * scale;
            const y2 = yBase + s.y2 * scale;
            collected.push({ x1, y1, x2, y2, color });
          }
        }

        xOffset += charAdvance * scale;
      }

      // Add tapered ends if enabled
      if (taperedEnds && collected.length > 0) {
        // Find endpoints (not shared by any other segment)
        const endpointMap = new Map();
        for (const s of collected) {
          const key1 = `${Math.round(s.x1)},${Math.round(s.y1)}`;
          const key2 = `${Math.round(s.x2)},${Math.round(s.y2)}`;
          endpointMap.set(key1, (endpointMap.get(key1) || 0) + 1);
          endpointMap.set(key2, (endpointMap.get(key2) || 0) + 1);
        }
        for (const [key, count] of endpointMap.entries()) {
          if (count === 1) {
            const [x, y] = key.split(',').map(Number);
            // Draw a small triangle at the endpoint
            const triLen = strokeWidth * 2.5;
            const triPath = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            // Find direction for this endpoint
            let dir = { x: 1, y: 0 };
            for (const s of collected) {
              if (Math.round(s.x1) === x && Math.round(s.y1) === y) {
                dir = { x: s.x2 - s.x1, y: s.y2 - s.y1 };
                break;
              }
              if (Math.round(s.x2) === x && Math.round(s.y2) === y) {
                dir = { x: s.x1 - s.x2, y: s.y1 - s.y2 };
                break;
              }
            }
            // Normalize direction
            const len = Math.hypot(dir.x, dir.y) || 1;
            dir.x /= len; dir.y /= len;
            // Triangle points
            const tip = { x: x, y: y };
            const base1 = { x: x - dir.x * triLen + dir.y * triLen * 0.5, y: y - dir.y * triLen - dir.x * triLen * 0.5 };
            const base2 = { x: x - dir.x * triLen - dir.y * triLen * 0.5, y: y - dir.y * triLen + dir.x * triLen * 0.5 };
            triPath.setAttribute('points', `${tip.x},${tip.y} ${base1.x},${base1.y} ${base2.x},${base2.y}`);
            triPath.setAttribute('fill', 'currentColor');
            triPath.setAttribute('opacity', '0.7');
            canvasContentEl.appendChild(triPath);
          }
        }
      }

      // If no curves, emit straight lines directly
      if (!enableCurves) {
        for (const s of collected) {
          if (Math.hypot(s.x2 - s.x1, s.y2 - s.y1) < 0.5) continue;
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', `M${s.x1},${s.y1} L${s.x2},${s.y2}`);
          path.setAttribute('stroke', s.color || 'black');
          path.setAttribute('stroke-width', strokeWidth);
          path.setAttribute('stroke-linecap', 'round');
          path.setAttribute('stroke-linejoin', 'round');
          path.setAttribute('fill', 'none');
          canvasContentEl.appendChild(path);
        }
        if (DEBUG_CURVES) console.info('[curves] skipped (disabled) for line', lineIndex, 'segments=', collected.length);
        return;
      }

      // Smooth across the whole line using global junctions
  const epsilon = 1.2 * scale; // snap tolerance in canvas space
      const clusters = findJunctions(collected, epsilon);
      let lCorners = 0, tJuncs = 0, lArcs = 0, tArcs = 0;

      // Trim store
      const trimmed = collected.map(s => ({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, color: s.color }));
      const arcs = []; // {p1:{x,y}, p2:{x,y}, r, sweep, color1, color2, gradient}

      function outwardVec(cluster, ref) {
        const s = collected[ref.segmentIdx];
        const from = { x: cluster.x, y: cluster.y };
        const to = ref.end === 'start' ? { x: s.x2, y: s.y2 } : { x: s.x1, y: s.y1 };
        return unitVector(from.x, from.y, to.x, to.y);
      }

      // L-corners: degree 2 — choose the largest quarter-arc that fits both arms
      for (const cl of clusters) {
        const inc = cl.incidents;
        if (inc.length !== 2) continue;
        const a = inc[0], b = inc[1];
        const sA = collected[a.segmentIdx];
        const sB = collected[b.segmentIdx];

        const vA = outwardVec(cl, a);
        const vB = outwardVec(cl, b);
        const angDeg = angleBetween(vA, vB);
        if (angDeg < 10 || angDeg > 170) continue; // nearly straight
        const ang = angDeg * Math.PI / 180;
        // Available trim distance on each arm
        const maxTA = Math.hypot(sA.x2 - sA.x1, sA.y2 - sA.y1) * 0.45;
        const maxTB = Math.hypot(sB.x2 - sB.x1, sB.y2 - sB.y1) * 0.45;
        // Use the same trim along both arms (largest that fits both)
        const t = Math.max(0.01, Math.min(maxTA, maxTB));
        // Compute the radius from trim to ensure a true circular fillet: r = t * tan(theta/2)
        const r = t * Math.tan(ang / 2);
        const tA = t;
        const tB = t;
        const pA = { x: cl.x + vA.ux * tA, y: cl.y + vA.uy * tA };
        const pB = { x: cl.x + vB.ux * tB, y: cl.y + vB.uy * tB };

        const ta = trimmed[a.segmentIdx];
        if (a.end === 'start') { ta.x1 = pA.x; ta.y1 = pA.y; } else { ta.x2 = pA.x; ta.y2 = pA.y; }
        const tb = trimmed[b.segmentIdx];
        if (b.end === 'start') { tb.x1 = pB.x; tb.y1 = pB.y; } else { tb.x2 = pB.x; tb.y2 = pB.y; }

        const cross = vA.ux * vB.uy - vA.uy * vB.ux;
        const sweep = cross < 0 ? 1 : 0;
        const color1 = sA.color || 'black';
        const color2 = sB.color || 'black';
        const gradient = color1 !== color2;
        arcs.push({ p1: pA, p2: pB, r, sweep, color1, color2, gradient });
        lCorners++; lArcs++;
        if (DEBUG_CURVES) console.debug('L-corner line', lineIndex, { cx: cl.x, cy: cl.y, trim:t, r, pA, pB, sweep });
      }

      // T-junctions: degree 3 — symmetric trims; radius derived from trim and angle
      if (enableT) {
        for (const cl of clusters) {
          const inc = cl.incidents;
          if (inc.length !== 3) continue;
          const outs = inc.map(ref => ({ ref, v: outwardVec(cl, ref) }));
          let bestI=-1,bestJ=-1,best= -1;
          for (let i=0;i<3;i++) for (let j=i+1;j<3;j++){
            const a = angleBetween(outs[i].v, outs[j].v);
            if (a>best){best=a;bestI=i;bestJ=j;}
          }
          if (best < 150) continue; // two caps nearly opposite
          const cap1 = outs[bestI];
          const cap2 = outs[bestJ];
          const stem = outs[[0,1,2].find(k=>k!==bestI && k!==bestJ)];

          const sStem = collected[stem.ref.segmentIdx];
          const sCap1 = collected[cap1.ref.segmentIdx];
          const sCap2 = collected[cap2.ref.segmentIdx];

          const maxStem = Math.hypot(sStem.x2 - sStem.x1, sStem.y2 - sStem.y1) * 0.45;
          const maxCap1 = Math.hypot(sCap1.x2 - sCap1.x1, sCap1.y2 - sCap1.y1) * 0.45;
          const maxCap2 = Math.hypot(sCap2.x2 - sCap2.x1, sCap2.y2 - sCap2.y1) * 0.45;
          const t = Math.max(0.01, Math.min(maxStem, maxCap1, maxCap2));
          const dStem = t;
          const dCap = t;

          const pStem = { x: cl.x + stem.v.ux * dStem, y: cl.y + stem.v.uy * dStem };
          const pCap1 = { x: cl.x + cap1.v.ux * dCap, y: cl.y + cap1.v.uy * dCap };
          const pCap2 = { x: cl.x + cap2.v.ux * dCap, y: cl.y + cap2.v.uy * dCap };

          const trStem = trimmed[stem.ref.segmentIdx];
          if (stem.ref.end === 'start') { trStem.x1 = pStem.x; trStem.y1 = pStem.y; } else { trStem.x2 = pStem.x; trStem.y2 = pStem.y; }
          const trC1 = trimmed[cap1.ref.segmentIdx];
          if (cap1.ref.end === 'start') { trC1.x1 = pCap1.x; trC1.y1 = pCap1.y; } else { trC1.x2 = pCap1.x; trC1.y2 = pCap1.y; }
          const trC2 = trimmed[cap2.ref.segmentIdx];
          if (cap2.ref.end === 'start') { trC2.x1 = pCap2.x; trC2.y1 = pCap2.y; } else { trC2.x2 = pCap2.x; trC2.y2 = pCap2.y; }

          const sweep1 = (stem.v.ux * cap1.v.uy - stem.v.uy * cap1.v.ux) < 0 ? 1 : 0;
          const sweep2 = (stem.v.ux * cap2.v.uy - stem.v.uy * cap2.v.ux) < 0 ? 1 : 0;
          const ang1 = angleBetween(stem.v, cap1.v) * Math.PI / 180;
          const ang2 = angleBetween(stem.v, cap2.v) * Math.PI / 180;
          const r1 = t * Math.tan(ang1 / 2);
          const r2 = t * Math.tan(ang2 / 2);
          const colorStem = sStem.color || 'black';
          const colorC1 = sCap1.color || 'black';
          const colorC2 = sCap2.color || 'black';
          arcs.push({ p1: pStem, p2: pCap1, r: r1, sweep: sweep1, color1: colorStem, color2: colorC1, gradient: colorStem!==colorC1 });
          arcs.push({ p1: pStem, p2: pCap2, r: r2, sweep: sweep2, color1: colorStem, color2: colorC2, gradient: colorStem!==colorC2 });
          tJuncs++; tArcs+=2;
          if (DEBUG_CURVES) console.debug('T-junction line', lineIndex, { center:{x:cl.x,y:cl.y}, trim:t, r1, r2, pStem, pCap1, pCap2 });
        }
      }

      // 4-way crosses: create astroid/star-like loop and trim arms
      let crossLoops = 0;
      if (curveAtCrossesEl && curveAtCrossesEl.checked) {
        if (DEBUG_CURVES) {
          const degreeCounts = {};
          for (const c of clusters) {
            const d = c.incidents.length;
            degreeCounts[d] = (degreeCounts[d] || 0) + 1;
          }
          console.debug('Junction degrees for 4-way detection:', degreeCounts);
          console.debug('Total clusters checked:', clusters.length, 'with degree 4:', degreeCounts[4] || 0);
        }
        for (const cl of clusters) {
          const inc = cl.incidents;
          if (DEBUG_CURVES && inc.length === 4) {
            console.debug('Found 4-way junction at', cl.x, cl.y, 'incidents:', inc);
          }
          if (inc.length !== 4) continue;
          // Classify directions
          const dirs = { left: null, right: null, up: null, down: null };
          for (const ref of inc) {
            const v = outwardVec(cl, ref);
            const s = collected[ref.segmentIdx];
            const info = { ref, v, color: s.color || 'black' };
            if (Math.abs(v.ux) >= Math.abs(v.uy)) {
              if (v.ux >= 0) dirs.right = info; else dirs.left = info;
            } else {
              if (v.uy >= 0) dirs.down = info; else dirs.up = info;
            }
          }
          if (!(dirs.left && dirs.right && dirs.up && dirs.down)) continue;

          // Compute available trim on each arm; choose the largest radius that fits all four
          const lengths = [dirs.left, dirs.right, dirs.up, dirs.down].map(d => {
            const s = collected[d.ref.segmentIdx];
            return Math.hypot(s.x2 - s.x1, s.y2 - s.y1) * 0.45;
          });
          const crossR = Math.max(0.01, Math.min(...lengths));
          // Trim each arm by crossR
          function applyTrim(d, pt) {
            const t = trimmed[d.ref.segmentIdx];
            const isStart = d.ref.end === 'start';
            if (isStart) { t.x1 = pt.x; t.y1 = pt.y; } else { t.x2 = pt.x; t.y2 = pt.y; }
          }
          const pL = { x: cl.x + dirs.left.v.ux * crossR, y: cl.y + dirs.left.v.uy * crossR };
          const pR = { x: cl.x + dirs.right.v.ux * crossR, y: cl.y + dirs.right.v.uy * crossR };
          const pU = { x: cl.x + dirs.up.v.ux * crossR, y: cl.y + dirs.up.v.uy * crossR };
          const pD = { x: cl.x + dirs.down.v.ux * crossR, y: cl.y + dirs.down.v.uy * crossR };
          applyTrim(dirs.left, pL);
          applyTrim(dirs.right, pR);
          applyTrim(dirs.up, pU);
          applyTrim(dirs.down, pD);

          // Emit an astroid (hypocycloid) loop centered at node using 8 cubic Bézier segments
          const loopColor = dirs.right.color;
          function astroidPoint(cx, cy, R, t) {
            return { x: cx + R * Math.pow(Math.cos(t), 3), y: cy + R * Math.pow(Math.sin(t), 3) };
          }
          function astroidDeriv(R, t) {
            const c = Math.cos(t), s = Math.sin(t);
            return { x: -3 * R * c * c * s, y: 3 * R * s * s * c };
          }
          function pushCubicFromParam(cx, cy, R, t0, t1, color) {
            const p0 = astroidPoint(cx, cy, R, t0);
            const p3 = astroidPoint(cx, cy, R, t1);
            const v0 = astroidDeriv(R, t0);
            const v1 = astroidDeriv(R, t1);
            const dt = t1 - t0;
            const c1 = { x: p0.x + (v0.x * dt) / 3, y: p0.y + (v0.y * dt) / 3 };
            const c2 = { x: p3.x - (v1.x * dt) / 3, y: p3.y - (v1.y * dt) / 3 };
            arcs.push({ cubic: true, p0, c1, c2, p3, color1: color });
          }
          const T = [0, Math.PI/4, Math.PI/2, 3*Math.PI/4, Math.PI, 5*Math.PI/4, 3*Math.PI/2, 7*Math.PI/4, 2*Math.PI];
          for (let i = 0; i < T.length - 1; i++) {
            pushCubicFromParam(cl.x, cl.y, crossR, T[i], T[i+1], loopColor);
          }
          crossLoops++;
          if (DEBUG_CURVES) console.debug('4-way cross astroid line', lineIndex, { center:{x:cl.x,y:cl.y}, r: crossR });
        }
      }

      // Emit straight segments
      for (const s of trimmed) {
        if (Math.hypot(s.x2 - s.x1, s.y2 - s.y1) < 0.5) continue;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M${s.x1},${s.y1} L${s.x2},${s.y2}`);
        path.setAttribute('stroke', s.color || 'black');
        path.setAttribute('stroke-width', strokeWidth);
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('fill', 'none');
        canvasContentEl.appendChild(path);
      }

      // Emit arcs and cubics, creating gradients as needed
      let gradCounter = 0;
      for (const c of arcs) {
        if (c.cubic) {
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          const dStr = `M ${c.p0.x} ${c.p0.y} C ${c.c1.x} ${c.c1.y}, ${c.c2.x} ${c.c2.y}, ${c.p3.x} ${c.p3.y}`;
          path.setAttribute('d', dStr);
          path.setAttribute('stroke', c.color1 || 'black');
          path.setAttribute('stroke-width', strokeWidth);
          path.setAttribute('stroke-linecap', 'round');
          path.setAttribute('stroke-linejoin', 'round');
          path.setAttribute('fill', 'none');
          canvasContentEl.appendChild(path);
          continue;
        }
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${c.p1.x} ${c.p1.y} A ${c.r} ${c.r} 0 0 ${c.sweep} ${c.p2.x} ${c.p2.y}`);
        if (c.gradient) {
          const defs = ensureDefs();
          const gradId = `lineGrad${lineIndex}_${gradCounter++}`;
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
          const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
          stop2.setAttribute('offset', '100%');
          stop2.setAttribute('stop-color', c.color2);
          grad.appendChild(stop1); grad.appendChild(stop2);
          defs.appendChild(grad);
          path.setAttribute('stroke', `url(#${gradId})`);
        } else {
          path.setAttribute('stroke', c.color1 || 'black');
        }
        path.setAttribute('stroke-width', strokeWidth);
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('fill', 'none');
        canvasContentEl.appendChild(path);
      }
    }
  }
  */

  // Debounced render
  let rafId = 0;
  function scheduleRender() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      render(inputEl.value);
    });
  }

  // Event listeners
  inputEl.addEventListener('input', scheduleRender);
  if (fontSizeEl) fontSizeEl.addEventListener('input', () => {
    fontSizeValueEl.textContent = fontSizeEl.value;
    scheduleRender();
  });
  if (alignmentEl) alignmentEl.addEventListener('change', scheduleRender);
  if (strokeWidthEl) strokeWidthEl.addEventListener('input', () => {
    strokeWidthValueEl.textContent = strokeWidthEl.value;
    scheduleRender();
  });
  if (enableCurvesEl) enableCurvesEl.addEventListener('change', scheduleRender);
  if (curveAtCrossesEl) curveAtCrossesEl.addEventListener('change', scheduleRender);
  if (curveAtTEl) curveAtTEl.addEventListener('change', scheduleRender);
  if (taperedEndsEl) taperedEndsEl.addEventListener('change', scheduleRender);
  if (colorizeLettersEl) colorizeLettersEl.addEventListener('change', scheduleRender);
  if (maxCharsPerLineEl) maxCharsPerLineEl.addEventListener('input', () => {
    if (maxCharsPerLineValueEl) maxCharsPerLineValueEl.textContent = maxCharsPerLineEl.value;
    scheduleRender();
  });
  
  // Alignment button interactivity
  const alignBtns = [
    document.getElementById('alignLeftBtn'),
    document.getElementById('alignCenterBtn'),
    document.getElementById('alignRightBtn')
  ];
  alignBtns.forEach(btn => {
    if (!btn) return;
    btn.addEventListener('click', () => {
      alignBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      alignmentEl.value = btn.getAttribute('data-align');
      scheduleRender();
    });
  });
  
  clearBtn.addEventListener('click', () => {
    inputEl.value = '';
    scheduleRender();
  });

  // Initial render
  // Restore settings and text from localStorage
  function restoreSettings() {
    if (localStorage.getItem('textInput')) inputEl.value = localStorage.getItem('textInput');
    if (localStorage.getItem('fontSize')) fontSizeEl.value = localStorage.getItem('fontSize');
    if (localStorage.getItem('alignment')) alignmentEl.value = localStorage.getItem('alignment');
    if (strokeWidthEl) {
      // Ensure slider max is enforced and stored value is clamped
      strokeWidthEl.setAttribute('max', '10');
      const saved = localStorage.getItem('strokeWidth');
      if (saved !== null) {
        const v = Math.max(0, Math.min(10, parseFloat(saved) || 0));
        strokeWidthEl.value = String(v);
        if (strokeWidthValueEl) strokeWidthValueEl.textContent = String(v);
      }
    }
    if (localStorage.getItem('enableCurves')) enableCurvesEl.checked = localStorage.getItem('enableCurves') === 'true';
    if (localStorage.getItem('curveAtCrosses')) curveAtCrossesEl.checked = localStorage.getItem('curveAtCrosses') === 'true';
    if (localStorage.getItem('curveAtT')) curveAtTEl.checked = localStorage.getItem('curveAtT') === 'true';
    if (localStorage.getItem('allCaps')) document.getElementById('allCaps').checked = localStorage.getItem('allCaps') === 'true';
    if (localStorage.getItem('taperedEnds')) taperedEndsEl.checked = localStorage.getItem('taperedEnds') === 'true';
    if (localStorage.getItem('colorizeLetters')) colorizeLettersEl.checked = localStorage.getItem('colorizeLetters') === 'true';
    if (localStorage.getItem('maxCharsPerLine') && maxCharsPerLineEl) {
      maxCharsPerLineEl.value = localStorage.getItem('maxCharsPerLine');
      if (maxCharsPerLineValueEl) maxCharsPerLineValueEl.textContent = localStorage.getItem('maxCharsPerLine');
    }
  }

  restoreSettings();
  render(inputEl.value);

  // Persist settings and text on change
  inputEl.addEventListener('input', () => localStorage.setItem('textInput', inputEl.value));
  fontSizeEl.addEventListener('input', () => localStorage.setItem('fontSize', fontSizeEl.value));
  alignmentEl.addEventListener('change', () => localStorage.setItem('alignment', alignmentEl.value));
  strokeWidthEl.addEventListener('input', () => {
    const v = Math.max(0, Math.min(10, parseFloat(strokeWidthEl.value) || 0));
    localStorage.setItem('strokeWidth', String(v));
  });
  enableCurvesEl.addEventListener('change', () => localStorage.setItem('enableCurves', enableCurvesEl.checked));
  curveAtCrossesEl.addEventListener('change', () => {
    localStorage.setItem('curveAtCrosses', curveAtCrossesEl.checked);
    scheduleRender();
  });
  curveAtTEl.addEventListener('change', () => localStorage.setItem('curveAtT', curveAtTEl.checked));
  if (maxCharsPerLineEl) {
    maxCharsPerLineEl.addEventListener('input', () => localStorage.setItem('maxCharsPerLine', maxCharsPerLineEl.value));
  }
  const allCapsEl = document.getElementById('allCaps');
  if (allCapsEl) {
    allCapsEl.addEventListener('change', () => {
      localStorage.setItem('allCaps', allCapsEl.checked);
      scheduleRender();
    });
  }
  taperedEndsEl.addEventListener('change', () => localStorage.setItem('taperedEnds', taperedEndsEl.checked));
  colorizeLettersEl.addEventListener('change', () => localStorage.setItem('colorizeLetters', colorizeLettersEl.checked));

  // Export SVG: serialize #canvasContent only
  if (exportSvgBtn) {
    exportSvgBtn.addEventListener('click', () => {
      const content = canvasContentEl.cloneNode(true);
      
      // Helper: compute bounding box padded by stroke width and round caps
      function getPaddedBBox(node) {
        const bbox = node.getBBox();
        let maxStroke = 0;
        node.querySelectorAll('[stroke-width]')
          .forEach(el => {
            const sw = parseFloat(el.getAttribute('stroke-width'));
            if (!isNaN(sw)) maxStroke = Math.max(maxStroke, sw);
          });
  // Add generous padding: half stroke for round caps + 5x stroke size as requested
  const pad = (maxStroke / 2) + (maxStroke * 5);
        return {
          x: bbox.x - pad,
          y: bbox.y - pad,
          width: bbox.width + 2 * pad,
          height: bbox.height + 2 * pad
        };
      }
      
      // Create a temporary SVG wrapper with the correct viewBox and dimensions
      const bbox = getPaddedBBox(canvasContentEl);
      const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      tempSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      tempSvg.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
      tempSvg.setAttribute('width', bbox.width);
      tempSvg.setAttribute('height', bbox.height);
      
      // Copy any defs from parent SVG
      const parentDefs = canvasSvgEl.querySelector('defs');
      if (parentDefs) {
        tempSvg.appendChild(parentDefs.cloneNode(true));
      }
      
      tempSvg.appendChild(content);
      
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(tempSvg);
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'crosshatch-text.svg';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Export PNG: render #canvasContent to canvas, then export
  if (exportPngBtn) {
    exportPngBtn.addEventListener('click', () => {
      const content = canvasContentEl.cloneNode(true);
      
      // Helper: compute bounding box padded by stroke width and round caps
      function getPaddedBBox(node) {
        const bbox = node.getBBox();
        let maxStroke = 0;
        node.querySelectorAll('[stroke-width]')
          .forEach(el => {
            const sw = parseFloat(el.getAttribute('stroke-width'));
            if (!isNaN(sw)) maxStroke = Math.max(maxStroke, sw);
          });
  // Add generous padding: half stroke for round caps + 5x stroke size as requested
  const pad = (maxStroke / 2) + (maxStroke * 5);
        return {
          x: bbox.x - pad,
          y: bbox.y - pad,
          width: bbox.width + 2 * pad,
          height: bbox.height + 2 * pad
        };
      }
      
      // Get bounding box of the content (padded)
      const bbox = getPaddedBBox(canvasContentEl);
      
      // Create a temporary SVG wrapper
      const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      tempSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      tempSvg.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
      tempSvg.setAttribute('width', bbox.width);
      tempSvg.setAttribute('height', bbox.height);
      
      // Copy any defs from parent SVG
      const parentDefs = canvasSvgEl.querySelector('defs');
      if (parentDefs) {
        tempSvg.appendChild(parentDefs.cloneNode(true));
      }
      
      tempSvg.appendChild(content);
      
      // Serialize the SVG to a data URL
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(tempSvg);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      
      // Create an Image element and load the SVG
      const img = new Image();
      img.onload = () => {
        // Create a canvas with the same dimensions
        const canvas = document.createElement('canvas');
        canvas.width = bbox.width;
        canvas.height = bbox.height;
        const ctx = canvas.getContext('2d');
        
        // Draw the SVG image
        ctx.drawImage(img, 0, 0);
        
        // Export as PNG
        canvas.toBlob(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'crosshatch-text.png';
          a.click();
          URL.revokeObjectURL(url);
          URL.revokeObjectURL(svgUrl);
        }, 'image/png');
      };
      img.src = svgUrl;
    });
  }

  console.log('[prerotated-renderer] Initialized with', Object.keys(CHAR_MAP).length, 'characters');
})();
