/**
 * wristbandLookup.js
 * Pitch Intelligence — Shared Wristband Code Utility
 *
 * Decodes a 3-digit wristband code into:
 *   pitch_type  — matches pitch_type column in pitches table
 *   zone_row    — 1=high, 2=mid, 3=low
 *   zone_col    — 1=inside, 2=middle, 3=outside
 *   zone        — "row-col" string e.g. "2-3" (matches zone column in pitches table)
 *   locationKey — 'IN' | 'INB' | 'OUT' | 'OB'
 *   label       — human-readable e.g. "Fastball — Outside"
 *   color       — hex matching --inside/--inball/--outside/--oball CSS variables
 *   sequence    — 'odd' | 'even' (wristband sequence set)
 *
 * Codes extracted directly from the Rapid Fire prototype numpad.
 * Odd = primary sequence. Even = alternate to prevent sign-stealing.
 *
 * Used by:
 *   RF-002 — RapidFire numpad buttons
 *   RF-004 — Intel scorebook grid pitch tiles
 *   RF-005 — AI card wristband code display
 *   RF-007 — Voice activation number normalizer
 */

// ── Location metadata ────────────────────────────────────────────────────────
const LOC = {
  IN:  { zone_col: 1, label: 'Inside',       color: '#e8c440' },
  INB: { zone_col: 1, label: 'Inside Ball',  color: '#e74c3c' },
  OUT: { zone_col: 3, label: 'Outside',      color: '#2ecc71' },
  OB:  { zone_col: 3, label: 'Outside Ball', color: '#3498db' },
}

// ── Zone row by pitch type ───────────────────────────────────────────────────
const ZONE_ROW = {
  Fastball:  2,
  Changeup:  2,
  Curveball: 3,
  Drop:      3,
  Rise:      1,
}

// ── Code table [code, pitch_type, locationKey, sequence] ─────────────────────
const CODE_TABLE = [
  // ODD SEQUENCE
  ['113', 'Fastball',  'IN',  'odd'],
  ['255', 'Fastball',  'INB', 'odd'],
  ['395', 'Fastball',  'OUT', 'odd'],
  ['533', 'Fastball',  'OB',  'odd'],
  ['133', 'Changeup',  'IN',  'odd'],
  ['275', 'Changeup',  'INB', 'odd'],
  ['415', 'Changeup',  'OUT', 'odd'],
  ['553', 'Changeup',  'OB',  'odd'],
  ['153', 'Curveball', 'IN',  'odd'],
  ['295', 'Curveball', 'INB', 'odd'],
  ['435', 'Curveball', 'OUT', 'odd'],
  ['573', 'Curveball', 'OB',  'odd'],
  ['193', 'Drop',      'IN',  'odd'],
  ['335', 'Drop',      'INB', 'odd'],
  ['475', 'Drop',      'OUT', 'odd'],
  ['613', 'Drop',      'OB',  'odd'],
  ['213', 'Rise',      'IN',  'odd'],
  ['355', 'Rise',      'INB', 'odd'],
  ['495', 'Rise',      'OUT', 'odd'],
  ['633', 'Rise',      'OB',  'odd'],
  // EVEN SEQUENCE
  ['103', 'Fastball',  'IN',  'even'],
  ['245', 'Fastball',  'INB', 'even'],
  ['385', 'Fastball',  'OUT', 'even'],
  ['523', 'Fastball',  'OB',  'even'],
  ['123', 'Changeup',  'IN',  'even'],
  ['265', 'Changeup',  'INB', 'even'],
  ['405', 'Changeup',  'OUT', 'even'],
  ['543', 'Changeup',  'OB',  'even'],
]

// ── Build lookup map ─────────────────────────────────────────────────────────
const WRISTBAND_MAP = {}

for (const [code, pitchType, locationKey, sequence] of CODE_TABLE) {
  const loc = LOC[locationKey]
  const zone_row = ZONE_ROW[pitchType] ?? 2
  WRISTBAND_MAP[code] = {
    code,
    pitch_type:  pitchType,
    zone_row,
    zone_col:    loc.zone_col,
    zone:        `${zone_row}-${loc.zone_col}`,
    locationKey,
    label:       `${pitchType} — ${loc.label}`,
    color:       loc.color,
    sequence,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Decode a wristband code.
 * @param {string|number} code  e.g. "395" or 395
 * @returns {object | null}
 */
export function decodeWristband(code) {
  return WRISTBAND_MAP[String(code)] ?? null
}

/**
 * All valid code strings — used to build voice recognition grammar.
 * @returns {string[]}
 */
export function getAllCodes() {
  return Object.keys(WRISTBAND_MAP)
}

/**
 * Group codes by pitch_type for a given sequence — builds numpad row layout.
 * Returns { Fastball: [IN, INB, OUT, OB], Changeup: [...], ... }
 * @param {'odd'|'even'} sequence
 * @returns {Record<string, object[]>}
 */
export function getNumpadRows(sequence = 'odd') {
  const order = ['IN', 'INB', 'OUT', 'OB']
  const rows = {}
  for (const entry of Object.values(WRISTBAND_MAP)) {
    if (entry.sequence !== sequence) continue
    if (!rows[entry.pitch_type]) rows[entry.pitch_type] = []
    rows[entry.pitch_type].push(entry)
  }
  for (const pt of Object.keys(rows)) {
    rows[pt].sort((a, b) => order.indexOf(a.locationKey) - order.indexOf(b.locationKey))
  }
  return rows
}

/**
 * Build a partial pitch record ready for insertPitch().
 * Caller must add: game_id, pa_id, pitcher_name, batter_name,
 *                  balls_before, strikes_before, inning, outs,
 *                  outcome_inplay, runs_scored, rbi.
 *
 * @param {string} code     Wristband code e.g. "395"
 * @param {string} outcome  B|CK|SK|DK|F|IP|HBP|WP|PB
 * @returns {object | null}
 */
export function buildPitchRecord(code, outcome) {
  const d = decodeWristband(code)
  if (!d) return null
  return {
    pitch_type:    d.pitch_type,
    zone_row:      d.zone_row,
    zone_col:      d.zone_col,
    zone:          d.zone,
    outcome_basic: outcome,
  }
}

export { WRISTBAND_MAP, LOC as LOCATION_META, ZONE_ROW }
