/* CrossHatch Alphabet Composer
 - Each letter PNG is 310x110 (visually scaled to 25% via CSS)
 - Successive letters step by STEP_OFFSET_X (right) and STEP_OFFSET_Y (down)
 - Single space: reset X to start, Y += 50
 - Double space: reset X to start, Y += 120 (new word)
 - Punctuation is ignored (removed) during preprocessing
 - Numbers are converted: wrapped as syllables ANU ... ANU, with digits mapped 1-9 -> A-I, 0 -> J, chunked into 3-letter syllables
 - Available images: A..Z, with Y.png and Y-1.png (we'll prefer Y.png)
*/

(function () {
  const LETTER_WIDTH = 310;
  const LETTER_HEIGHT = 110;
  // Per-letter diagonal step; split into horizontal and vertical so they can be tuned independently
  const STEP_OFFSET_X = 50; // horizontal step to the right per successive letter
  const STEP_OFFSET_Y = 50; // vertical step down per successive letter
  const SOFT_BREAK_Y = 50; // single space
  const WORD_BREAK_Y = 100; // double space (UI hint reflects 100px)
  const BASE_X = 0; // beginning horizontal spacing (start of first column)
  const COLUMN_GAP_X = 50; // gap between columns (to the right of previous column)
  // Always keep some visual margin between content and the canvas border
  const CONTENT_MARGIN_X = 50; // left/right internal margin in content coords
  const CONTENT_MARGIN_Y = 50; // top/bottom internal margin in content coords
  
  
  // Bounding square for a 45°-rotated 310x110 tile
  const ROT45_BOUNDS = Math.ceil((LETTER_WIDTH + LETTER_HEIGHT) / Math.SQRT2);
  // Allow overlap between adjacent rotated letters (similar to diagonal mode)
  const HORIZ_OVERLAP_X = 226; // pixels of intended overlap along X
  const HORIZ_LETTER_STEP = Math.max(1, ROT45_BOUNDS - HORIZ_OVERLAP_X); // advance per rotated letter
  const HORIZ_ROW_HEIGHT = ROT45_BOUNDS;  // row height per rotated letter
  // Spacing between words in horizontalize mode: ~25% of overlap amount
  const WORD_GAP_X = Math.round(0.3 * HORIZ_OVERLAP_X);
  const LINE_GAP_Y = -86; // negative value creates overlap between lines in horizontalize mode
  const BUCKET = 10; // y-resolution for occupancy checks (px)
  const PACK_COLUMNS_DEFAULT = false; // default unchecked; UI can override
  const PACK_SYLLABLES_DEFAULT = false; // vertical packing off by default
  // Allow the next syllable (after a single space) to overlap the previous by 10px
  // Set negative to permit overlap; increase toward 0 for more separation
  const SYLLABLE_GUTTER_Y = 0;

  const inputEl = document.getElementById('textInput');
  const canvasEl = document.getElementById('canvas');
  const canvasContentEl = document.getElementById('canvasContent');
  const clearBtn = document.getElementById('clearBtn');
  const packToggleEl = document.getElementById('packToggle');
  if (packToggleEl) packToggleEl.checked = PACK_COLUMNS_DEFAULT;
  const packSyllablesToggleEl = document.getElementById('packSyllablesToggle');
  if (packSyllablesToggleEl) packSyllablesToggleEl.checked = PACK_SYLLABLES_DEFAULT;
  const ritualDwarvenToggleEl = document.getElementById('ritualDwarvenToggle');
  if (ritualDwarvenToggleEl) ritualDwarvenToggleEl.checked = false;
  const rotateToggleEl = document.getElementById('rotateToggle');
  if (rotateToggleEl) rotateToggleEl.checked = false;

  // Known available letters (uppercase). Z now present.
  const AVAILABLE = new Set([
    'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'
  ]);

  function pickImageForChar(ch) {
    const upper = ch.toUpperCase();
    if (upper === ' ') return 'SPACE.png';
    if (!AVAILABLE.has(upper)) return null;
    if (upper === 'Y') {
      // Prefer Y.png if present; Y-1.png as fallback if you decide to swap later.
      return 'Y.png';
    }
    return `${upper}.png`;
  }

  function removeAllChildren(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function createTile({ x, y, src, label, w, h, rotateCCW45 }) {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.style.left = `${x}px`;
    tile.style.top = `${y}px`;
    if (w) tile.style.width = `${w}px`;
    if (h) tile.style.height = `${h}px`;

    if (src) {
      const img = document.createElement('img');
      img.alt = label || '';
      img.src = src;
      if (rotateCCW45) img.classList.add('rot-ccw45');
      img.onerror = function () {
        // If the image is missing, swap to placeholder
        tile.classList.add('placeholder');
        tile.textContent = label || '?';
        img.remove();
      };
      tile.appendChild(img);
    } else {
      tile.classList.add('placeholder');
      tile.textContent = label || '?';
    }

    return tile;
  }

  // Occupancy helpers for packed columns
  function makeOcc() { return []; } // array of right edges per bucket; undefined means empty
  function yToBucket(y) { return Math.max(0, Math.floor(y / BUCKET)); }
  function getOccRight(occ, idx) { return occ[idx] === undefined ? -Infinity : occ[idx]; }
  function setOccMax(occ, idx, value) {
    if (occ[idx] === undefined || value > occ[idx]) occ[idx] = value;
  }
  function updateOccForRect(occ, x, y, w, h) {
    const start = yToBucket(y);
    const end = yToBucket(y + h - 1);
    const right = x + w;
    for (let i = start; i <= end; i++) setOccMax(occ, i, right);
  }

  // Build relative tiles for a column (no baseX yet). Optionally pack syllables upward.
  function buildColumnRelTiles(text, packSyllables, ritualDwarven) {
    const tiles = [];

    // Adjust horizontal step based on ritual dwarven mode
    const stepX = ritualDwarven ? 0 : STEP_OFFSET_X;

    // X-occupancy for this column (relative coords): stores bottom Y per X-bucket
    const occX = [];
    const xToBucket = (x) => Math.max(0, Math.floor(x / BUCKET));
    const getOccBottom = (idx) => (occX[idx] === undefined ? -Infinity : occX[idx]);
    const setOccBottomMax = (idx, value) => {
      if (occX[idx] === undefined || value > occX[idx]) occX[idx] = value;
    };
    const updateOccXForRect = (x, y, w, h) => {
      const start = xToBucket(x);
      const end = xToBucket(x + w - 1);
      const bottom = y + h;
      for (let i = start; i <= end; i++) setOccBottomMax(i, bottom);
    };

    const computeStartYForSyllable = (len, gutterY, alignY) => {
      // Find minimal startY so that for each letter j and each x bucket it spans,
      // startY + j*STEP >= occBottom(bucket) + gutterY
      let startY = alignY ? alignY : 0;
      for (let j = 0; j < len; j++) {
        const letterLeft = j * stepX;
        const letterRight = letterLeft + LETTER_WIDTH;
        const b0 = xToBucket(letterLeft);
        const b1 = xToBucket(letterRight - 1);
        for (let b = b0; b <= b1; b++) {
          const need = getOccBottom(b) + gutterY - (j * STEP_OFFSET_Y);
          if (need > startY) startY = need;
        }
      }
      return Math.max(0, startY);
    };

    // State for aligning based on previous syllable
    let prevSyllStartY = null;
    let prevSyllLen = 0;

    // Non-packed flow reference Y (simple baseline)
    let flowRelY = 0;

    // Accumulators
    let currentLetters = [];
    let pendingBreakType = 'start'; // 'start' | 'soft' | 'word'

    const placeSyllable = (letters, breakTypeForThisSyllable) => {
      if (!letters || letters.length === 0) return;
      const len = letters.length;
      const isWordBreak = breakTypeForThisSyllable === 'word' || breakTypeForThisSyllable === 'start';
      // In packed mode, use a tighter gutter between syllables (often 0) to allow the "shorter" look
      const gutterY = isWordBreak
        ? WORD_BREAK_Y
        : (packSyllables ? SYLLABLE_GUTTER_Y : SOFT_BREAK_Y);

      let alignY = null;
      if (packSyllables && breakTypeForThisSyllable === 'soft' && prevSyllStartY !== null && prevSyllLen >= 6) {
        // Align top of next syllable with the 7th letter of previous syllable
        alignY = prevSyllStartY + 6 * STEP_OFFSET_Y;
      }

      const startY = packSyllables
        ? computeStartYForSyllable(len, gutterY, alignY)
        : (flowRelY + gutterY);

      for (let j = 0; j < len; j++) {
        const ch = letters[j];
        let relX = j * stepX;
        if (j > 0) relX -= 0;
        const relY = startY + j * STEP_OFFSET_Y;
        const src = pickImageForChar(ch);
        tiles.push({ relX, relY, label: ch, src });
        updateOccXForRect(relX, relY, LETTER_WIDTH, LETTER_HEIGHT);
      }

      // Update references for next syllable
      flowRelY = startY + len * STEP_OFFSET_Y;
      prevSyllStartY = startY;
      prevSyllLen = len;
    };

    // Iterate and place syllables using pendingBreakType for each syllable
    for (let i = 0; i <= text.length; i++) {
      const ch = text[i];
      if (i === text.length || ch === ' ' || ch === '.') {
        // Place the syllable we just finished using the break that preceded it
        placeSyllable(currentLetters, pendingBreakType);
        currentLetters = [];

        if (i === text.length) break; // no next break to set

        if (ch === ' ') {
          let j = i;
          while (j < text.length && text[j] === ' ') j++;
          const count = j - i;
          pendingBreakType = count >= 2 ? 'word' : 'soft';
          i = j - 1; // advance
          // When word break, reset prev syllable info so alignment doesn't cross words
          if (pendingBreakType === 'word') { prevSyllStartY = null; prevSyllLen = 0; }
        } else if (ch === '.') {
          pendingBreakType = 'word';
          prevSyllStartY = null; prevSyllLen = 0;
        }
      } else {
        // collect letters
        currentLetters.push(ch);
      }
    }

    return tiles;
  }

  function computeBaseXForColumn(relTiles, occ, gutter, pack) {
    if (!pack) return null; // caller will fallback to rightmost + gutter
    let baseX = -Infinity;
    for (const t of relTiles) {
      let req = -Infinity;
      const start = yToBucket(t.relY);
      const end = yToBucket(t.relY + LETTER_HEIGHT - 1);
      for (let i = start; i <= end; i++) {
        const occRight = getOccRight(occ, i);
        // need baseX so that baseX + t.relX >= occRight + gutter
        const need = occRight + gutter - t.relX;
        if (need > req) req = need;
      }
      if (req > baseX) baseX = req;
    }
    if (baseX === -Infinity || !isFinite(baseX)) baseX = 0;
    return Math.max(CONTENT_MARGIN_X, baseX);
  }

  // Build relative tiles for a horizontal row (letters advance only along X)
  function buildRowRelTiles(text) {
    const tiles = [];
    let relX = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      let tileRelX = relX;
      if (i > 0) tileRelX -= 1;
      const src = pickImageForChar(ch);
      tiles.push({ relX: tileRelX, relY: 0, label: ch, src, w: HORIZ_LETTER_STEP, h: HORIZ_ROW_HEIGHT, rotateCCW45: true });
      relX += HORIZ_LETTER_STEP; // horizontal advance sized to rotated bounds
    }
    return tiles;
  }

  function reformatForSquare(text) {
    // Strip all whitespace and punctuation, keep only letters
    const clean = text.replace(/[^A-Za-z]/g, '').toUpperCase();
    if (clean.length === 0) return [];

    // Use the effective visual aspect ratio based on letter width and vertical step
    // Width per column = LETTER_WIDTH, height per row ≈ STEP_OFFSET_Y
    const aspect = LETTER_WIDTH / STEP_OFFSET_Y; // ~6.2 with 310/50

    // Start near square: cols ≈ sqrt(L / aspect)
    let cols = Math.max(1, Math.ceil(Math.sqrt(clean.length / aspect)));
    // Rows should be at least enough to fit and close to aspect*cols
    let rows = Math.max(Math.ceil(clean.length / cols), Math.ceil(aspect * cols));

    // Avoid creating any full padding-only columns: if we have at least one whole
    // column worth of slack, reduce columns until that's no longer true (but keep >=1)
    let cells = cols * rows;
    while (cols > 1 && (cells - clean.length) >= rows) {
      cols -= 1;
      rows = Math.max(Math.ceil(clean.length / cols), Math.ceil(aspect * cols));
      cells = cols * rows;
    }

    // Final pad with the last letter to fill remaining cells in the last column only
    const padChar = clean[clean.length - 1] || 'X';
    const totalCells = cols * rows;
    const padded = clean + padChar.repeat(totalCells - clean.length);

    // Break into 'cols' columns, each with 'rows' letters
    const columns = [];
    for (let i = 0; i < cols; i++) {
      columns.push(padded.substring(i * rows, (i + 1) * rows));
    }
    return columns;
  }

  // Preprocess text:
  // - Uppercase
  // - Convert digit sequences to ANU + mapped letters (A=1..I=9, J=0) + ANU
  //   and split mapped letters into 3-letter syllables separated by single spaces
  // - Remove punctuation (keep only A-Z letters, spaces, and newlines)
  function preprocess(text) {
    if (!text) return '';
    let t = String(text).toUpperCase();

    // Replace digit runs with ANU-wrapped, 3-letter-chunked letter codes
    t = t.replace(/\d+/g, (digits) => {
      const mapped = digits.replace(/./g, (d) => {
        if (d === '0') return 'J';
        const n = d.charCodeAt(0) - 48; // '0' => 0
        if (n >= 1 && n <= 9) return String.fromCharCode('A'.charCodeAt(0) + (n - 1));
        return ''; // shouldn't happen
      });
      // chunk to 3-letter syllables
      const chunks = [];
      for (let i = 0; i < mapped.length; i += 3) {
        chunks.push(mapped.slice(i, i + 3));
      }
      // Surround with ANU syllables and spaces as syllable separators
      return ` ANU ${chunks.join(' ')} ANU `;
    });

    // Remove all characters except A-Z, spaces, and newlines
    t = t.replace(/[^A-Z \n]/g, '');
    return t;
  }

  function render(text) {
    removeAllChildren(canvasContentEl);

    const pack = packToggleEl ? !!packToggleEl.checked : PACK_COLUMNS_DEFAULT;
    const packSyllables = packSyllablesToggleEl ? !!packSyllablesToggleEl.checked : PACK_SYLLABLES_DEFAULT;
    const ritualDwarven = ritualDwarvenToggleEl ? !!ritualDwarvenToggleEl.checked : false;
  const horizontalize = rotateToggleEl ? !!rotateToggleEl.checked : false;
  const occ = makeOcc();

    let maxBottom = 0; // for canvas height
    let maxRight = 0;  // track rightmost edge across all columns

  // Normalize, preprocess (punctuation removal, number handling)
  text = preprocess(String(text ?? ''));
  const columns = ritualDwarven ? reformatForSquare(text) : text.split('\n');

  if (!horizontalize) {
      for (let colIdx = 0; colIdx < columns.length; colIdx++) {
        const colText = columns[colIdx];
        const relTiles = buildColumnRelTiles(colText, packSyllables, ritualDwarven);
        if (relTiles.length === 0) {
          // Empty column: simply advance the nominal baseX by gutter
          maxRight = maxRight + COLUMN_GAP_X;
          continue;
        }

        // Compute baseX
        let baseX = computeBaseXForColumn(relTiles, occ, COLUMN_GAP_X, pack);
        if (baseX === null) {
          baseX = Math.max(maxRight + COLUMN_GAP_X, CONTENT_MARGIN_X); // classic behavior with margin
        }

        // Place tiles and update occupancy/extents
        for (const t of relTiles) {
          const x = baseX + t.relX;
          const y = CONTENT_MARGIN_Y + t.relY;
          const tile = createTile({ x, y, src: t.src, label: t.label });
          canvasContentEl.appendChild(tile);

          const bottom = y + LETTER_HEIGHT;
          if (bottom > maxBottom) maxBottom = bottom;
          const right = x + LETTER_WIDTH;
          if (right > maxRight) maxRight = right;

          updateOccForRect(occ, x, y, LETTER_WIDTH, LETTER_HEIGHT);
        }
      }
    } else {
      // Horizontalize: treat each input line as a row; process every character (including spaces) as a tile
      let yOffset = 0;
      for (let row = 0; row < columns.length; row++) {
        const lineText = columns[row];
        let relX = 0;
        let lineMaxBottom = CONTENT_MARGIN_Y;
        let lineRight = CONTENT_MARGIN_X;
        for (let i = 0; i < lineText.length; i++) {
          const ch = lineText[i];
          let tileRelX = relX;
          if (i > 0) tileRelX -= 1;
          const src = pickImageForChar(ch);
          const tile = createTile({ x: CONTENT_MARGIN_X + tileRelX, y: CONTENT_MARGIN_Y + yOffset, src, label: ch, w: HORIZ_LETTER_STEP, h: HORIZ_ROW_HEIGHT, rotateCCW45: true });
          canvasContentEl.appendChild(tile);
          const bottom = CONTENT_MARGIN_Y + yOffset + HORIZ_ROW_HEIGHT;
          if (bottom > lineMaxBottom) lineMaxBottom = bottom;
          const right = CONTENT_MARGIN_X + tileRelX + HORIZ_LETTER_STEP;
          if (right > lineRight) lineRight = right;
          relX += HORIZ_LETTER_STEP;
        }
        // Update global extents
        if (lineRight > maxRight) maxRight = lineRight;
        if (lineMaxBottom > maxBottom) maxBottom = lineMaxBottom;
        // Advance to next line (add 1px per line after the first)
        yOffset = (lineMaxBottom - CONTENT_MARGIN_Y) + LINE_GAP_Y + row;
      }
    }

  // Ensure canvas fits content (with a little buffer)
  const buffer = 40;
  const neededHeight = Math.max(maxBottom + buffer, 400);
  const neededWidth = Math.max(maxRight + buffer, 400);
    const SCALE = 0.25; // keep in sync with CSS
    // Apply transform class: in horizontalize layout we keep no rotation for true horizontal lines
    const rotated = false;
    canvasContentEl.classList.toggle('scale-only', true);
    canvasContentEl.classList.toggle('scale-rot45', false);

    if (!rotated) {
      canvasEl.style.minHeight = `${neededHeight * SCALE}px`;
      canvasEl.style.minWidth = `${neededWidth * SCALE}px`;
    } else {
      // Bounding box of a rectangle W×H rotated 45deg: both dimensions become (W+H)/√2
      const rotatedDim = (neededWidth + neededHeight) / Math.SQRT2;
      const dim = Math.max(rotatedDim, 400);
      canvasEl.style.minHeight = `${dim * SCALE}px`;
      canvasEl.style.minWidth = `${dim * SCALE}px`;
    }
  }

  // Debounce rendering as the user types
  let rafId = 0;
  function scheduleRender() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      render(inputEl.value);
    });
  }

  inputEl.addEventListener('input', scheduleRender);
  if (packToggleEl) packToggleEl.addEventListener('change', scheduleRender);
  if (packSyllablesToggleEl) packSyllablesToggleEl.addEventListener('change', scheduleRender);
  if (ritualDwarvenToggleEl) ritualDwarvenToggleEl.addEventListener('change', scheduleRender);
  if (rotateToggleEl) rotateToggleEl.addEventListener('change', scheduleRender);
  clearBtn.addEventListener('click', () => {
    inputEl.value = '';
    scheduleRender();
    inputEl.focus();
  });

  // Text sharing between pages using localStorage
  function saveText() {
    localStorage.setItem('crosshatch_text', inputEl.value);
  }

  function loadText() {
    const saved = localStorage.getItem('crosshatch_text');
    if (saved) {
      inputEl.value = saved;
      render(inputEl.value);
    }
  }

  inputEl.addEventListener('input', saveText);
  
  const navLink = document.getElementById('navToVector');
  if (navLink) {
    navLink.addEventListener('click', (e) => {
      saveText();
    });
  }

  // Load text on page load
  loadText();

  // Initial demo text (if nothing loaded)
  if (!inputEl.value) {
    inputEl.value = 'HELLO. WORLD CROSSHATCH\nALPHABET  TEST';
    render(inputEl.value);
  }
})();
