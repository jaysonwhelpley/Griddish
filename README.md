# CrossHatch Alphabet

A constructed typeface where every glyph is built from the same three interlocking
stroke primitives, laid out on a grid that gets rotated 45° so letters cascade
diagonally into a woven, crosshatch pattern. This repo contains the design source
(the stroke primitives and per-letter SVG/PNG exports) and several small static-HTML
tools for composing text with it, exporting glyphs, and browsing a specimen sheet.

**[Open the composer](index.html)** (needs a local server — see [Running it locally](#running-it-locally))

## Contents

- [How a letter is formed](#how-a-letter-is-formed)
- [How letters join into words](#how-letters-join-into-words)
- [How the corner/junction curves are calculated](#how-the-cornerjunction-curves-are-calculated)
- [The two rendering pipelines](#the-two-rendering-pipelines)
- [File map](#file-map)
- [Running it locally](#running-it-locally)
- [Known issues](#known-issues)

## How a letter is formed

Every glyph — uppercase, lowercase, digit, or punctuation — is built from **three
stroke tiles** placed side by side, each tile drawn from a small set of primitive
paths:

| Primitive | Meaning | Path (300×300 tile, center at 150,150) |
|---|---|---|
| `H` | full horizontal bar | `M270 150L30 150` |
| `V` | full vertical bar | `M150 30V270` |
| `C` | 4-armed cross (both bars, meeting at center) | `M270 150L150 150M30 150L150 150M150 30V150M150 270V150` |
| `h` / `v` / `c` | gapped variants of the above (a blank stretch in the middle) | e.g. `h` = `M270 150L180 150M30 150L120 150` |
| `B` | blank tile — occupies a slot but draws nothing | *(empty)* |

These correspond to the standalone reference tiles in the repo root
([`VectorHorizontal.svg`](VectorHorizontal.svg), [`VectorVertical.svg`](VectorVertical.svg),
[`VectorCross.svg`](VectorCross.svg), and their `Gap` variants).

A **character is a 3-letter code** over `{H, V, C, h, v, c, B}`, e.g.:

```
A = VHH   B = HVC   C = VCV   ...   space = BBB
```

All 26 uppercase letters use only `H`/`V`/`C` and are guaranteed unique — there
are 3³ = 27 possible combinations for 26 letters + space. Lowercase letters reuse
the same idea but with one of the three slots replaced by a blank (`B`), and
digits/punctuation reuse the gapped primitives (`h`/`v`/`c`) so they remain
distinguishable from the letters. The full table lives in `CHAR_ENCODING` in
[vector-main.js](vector-main.js#L106-L165).

To draw a character, its three stroke tiles are placed at `x`, `x + STROKE_ADVANCE`,
`x + 2·STROKE_ADVANCE`, where tiles overlap by 1/5 of their width
(`STROKE_ADVANCE = 300 × 4⁄5 = 240px`) so adjacent strokes' arms touch and can be
fused into a single glyph shape rather than reading as three separate stamps.

**The diagonal weave** comes from a single global transform, not from anything
per-letter: the entire block of text is composed on an upright grid (one
character every `120px` right and `120px` down — [`GRID_STEP`](vector-main.js#L23)),
then the whole thing is rotated **−45°** in one pass
([`ROTATION_ANGLE`](vector-main.js#L19)). Row spacing is deliberately chosen
so that after rotation, each line still advances straight down rather than
along the diagonal (`ROW_STEP_DX/DY` are picked so the post-rotation line
height matches the chosen font size exactly).

Each letter's finished tile is exported as its own standalone SVG into
[`PreRotatedExports/`](PreRotatedExports) (see [rotate-svgs.js](rotate-svgs.js)
and [export-characters.html](export-characters.html)) — those pre-baked,
already-rotated glyphs are what the live composer actually stitches together at
render time (see [pipelines](#the-two-rendering-pipelines) below).

## How letters join into words

Individual stroke segments would just look like a pile of disconnected bars.
To make them read as one continuous woven line, the renderer treats the whole
line of text as a single graph and finds where strokes should be fused:

1. **Collect every line segment** that makes up the text (each `H`/`V`/`C`
   tile contributes 1–4 straight segments).
2. **Snap and cluster endpoints.** Segment endpoints that land within a small
   tolerance of each other (a couple of px) are merged into one graph node —
   this is what causes strokes from *adjacent letters* to physically connect,
   not just strokes within the same letter.
3. **Classify each node by degree** (how many segments meet there):
   - **Degree 2, non-collinear → L-corner.** Two strokes meeting at an angle
     get trimmed back and joined with a quarter-circle arc fillet instead of
     a sharp elbow.
   - **Degree 3 → T-junction** *(optional, off by default)*. The two arms
     with the widest angle between them are treated as the "cap" of the T and
     the third as the "stem"; the stem gets one trim distance and each cap
     gets its own arc back to the stem.
   - **Degree 4, two horizontal + two vertical → 4-way cross** *(optional,
     off by default)*. All four arms are trimmed back by the same radius and
     replaced by a closed curve around the intersection (see below).
   - **Degree 1 → free/open endpoint.** Nothing to join — these are candidates
     for the tapered-brush-end effect.
4. **Reserve budgets prevent overlapping fillets.** Before trimming, each
   junction "reserves" some length along the arms it touches
   ([`addReserve`](vector-main.js#L823)/[`getReserve`](vector-main.js#L818)),
   so if an L-corner and a nearby cross share a short arm, neither fillet eats
   into the other's space — the smaller of the two available radii wins.
5. **Emit** the trimmed straight segments plus the arcs/curves, deduplicating
   any segment that got fused from two overlapping tiles.

## How the corner/junction curves are calculated

- **L-corners** are simple **circular arc fillets**. Given the two trimmed
  endpoints `p1`/`p2` sitting at radius `r` back from the corner along each
  arm, the corner is replaced by an SVG arc command
  `A r r 0 0 <sweep> p2`. The sweep flag (clockwise vs. counter-clockwise) is
  chosen from the sign of the cross product of the two arms' direction
  vectors, so the arc always curves *into* the inside of the elbow rather
  than bulging outward.
- **T-junctions** are two arcs sharing one trim point on the stem — the trim
  distance is solved from `r = t · tan(angle / 2)` for each stem→cap angle so
  both arcs use a consistent radius even when the two caps meet the stem at
  different angles.
- **4-way crosses** are the interesting case: instead of two straight arcs
  crossing awkwardly in the middle, the four trimmed arm-ends are connected
  by an **astroid (hypocycloid) curve**,
  `x = R·cos³t, y = R·sin³t`, which produces the pinched, woven-fabric look
  where the strands appear to pass over/under each other. The astroid is
  built numerically: it's split into 8 quarter-turn segments (`t` stepping by
  `π/4`), and each segment is converted from its parametric derivative into a
  **cubic Bézier** via a Hermite-to-Bézier conversion
  (`c1 = p0 + v0·Δt/3`, `c2 = p3 − v1·Δt/3`) — see
  [`pushCubicFromParam`](vector-main.js#L914-L923).
- Fillet radius is capped by whatever length is actually available on each
  arm (`Math.min(radius, armLength, reservedBudget)`), so short stroke
  segments near the edge of a glyph fall back to a smaller, proportional
  curve instead of overshooting past the segment's own endpoint.

## The two rendering pipelines

This repo actually contains **two independent implementations** of the join/curve
logic above, at different points in the project's evolution, plus a legacy
raster approach that predates both:

| | Entry point | Renderer | Glyph source | Notes |
|---|---|---|---|---|
| **Live vector composer** | [index.html](index.html) | [prerotated-renderer.js](prerotated-renderer.js) | pre-baked `PreRotatedExports/*.svg` | What you get when you open the app. Parses each letter's exported path data at render time and re-runs junction detection across the whole line. |
| **Procedural generator** | [showcase.html](showcase.html), [specimen.html](specimen.html), [export-characters.html](export-characters.html) | [vector-main.js](vector-main.js) | computed from `CHAR_ENCODING` + stroke primitives directly | The "source of truth" — builds every glyph from scratch from the 3-stroke codes, and is what generates the files in `PreRotatedExports/`. |
| **Legacy raster composer** | [raster.html](raster.html) | [main.js](main.js) | flat `A.png`…`Z.png` image tiles | The original approach this project started from: PNG letter tiles stamped onto a canvas with a fixed diagonal offset. No curve fusion — tiles just visually overlap. Kept for reference. |

Because these are separate implementations, a fix or feature added to one
(e.g. the join/curve math) does not automatically apply to the other.

## File map

```
A.svg, A.png, ...          Original per-letter design source (upright)
A PreRotated.svg, ...      Same letters pre-rotated -45°, generated by rotate-svgs.js
PreRotatedExports/         Per-glyph SVGs (A-Z, a-z, 0-9, punctuation) exported from
                            vector-main.js's procedural generator; consumed by
                            prerotated-renderer.js at runtime
VectorHorizontal.svg,       Standalone reference tiles for the H/V/C stroke primitives
VectorVertical.svg,        and their gapped variants
VectorCross.svg, *Gap.svg
index.html                 Live vector composer (uses prerotated-renderer.js)
vector-main.js              Procedural glyph generator + join/curve engine
prerotated-renderer.js      Runtime renderer used by index.html
raster.html, main.js       Legacy PNG-tile composer
export-characters.html     Tool that runs vector-main.js's generator and exports
                            each glyph as a standalone SVG into PreRotatedExports/
rotate-svgs.js              Node script that pre-rotates the original A-Z SVGs
showcase.html, showcase-row.html, specimen.html, specimen.txt
                            Gallery/specimen pages built on vector-main.js
find_lower_char_encodings.js  Helper used while designing unique lowercase codes
styles.css, vector-styles.css  Stylesheets for the raster and vector UIs
```

## Running it locally

The pages fetch SVG assets via `fetch()`, which browsers block on `file://`
origins — serve the folder over HTTP instead:

```bash
python3 -m http.server 8934
```

then open `http://localhost:8934/index.html`.

## Known issues

- **Tapered brush ends don't render.** Enabling "Tapered brush ends" in the
  live composer ([index.html](index.html)) has no visible effect. Root cause,
  found by reading [prerotated-renderer.js](prerotated-renderer.js#L381-L417):
  the taper triangles are appended to the SVG *before* the straight
  line/arc paths that make up the rest of the glyphs
  ([lines 638–693](prerotated-renderer.js#L638-L693)), and since SVG paints in
  document order, the full-width, untrimmed stroke lines are drawn on top and
  bury the tapers. The taper polygon's own geometry also looks suspect — it
  uses the same `triLen` value (`strokeWidth × 2.5`) for both the taper's
  depth *and* its base width, rather than depth vs. `strokeWidth`, which
  would make it noticeably wider than the stroke it's supposed to cap even if
  the z-order were fixed. The procedural pipeline
  ([vector-main.js](vector-main.js#L1136-L1166)) has a separate, more
  correct-looking implementation (it trims the underlying line back before
  drawing the taper, so the two don't fight for the same pixels) that could
  be a better starting point than patching `prerotated-renderer.js` in place —
  though it has its own bug where, for a stroke that is a free endpoint on
  *both* ends, the second endpoint's taper direction is computed from an
  already-mutated coordinate (`vector-main.js:1044`) instead of the original.
  Logged here, not fixed yet.
