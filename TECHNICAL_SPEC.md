# Pitch Intelligence Command Center
## Complete Technical Specification — v0.1.0 POC
**Last Updated:** February 2026  
**Live URL:** https://charting-app-topaz.vercel.app  
**Repo:** github.com/diamondintel/charting-app  
**Team:** Lady Hawks Rivera 14U

---

## HOW TO USE THIS DOCUMENT

Paste this entire document at the start of any new Claude chat with:

> "I am continuing development of Pitch Intelligence. Here is the full technical spec: [paste]. Current task: [describe what you need]."

Claude will have full context of the architecture, state model, database schema, and AI engine without needing to read existing files.

---

## 1. TECH STACK

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Frontend | React | 18.2.0 | Functional components, hooks only |
| Build | Vite | 5.0.0 | ESM modules |
| Backend/DB | Supabase | 2.39.0 | Postgres + realtime |
| Hosting | Vercel | — | Auto-deploy from GitHub main |
| Styling | CSS Modules + inline styles | — | No Tailwind, no styled-components |
| State | React useState/useEffect | — | No Redux, no Zustand |
| Auth | None (POC) | — | Anon key, no RLS yet |

**Environment Variables (Vercel + local .env):**
```
VITE_SUPABASE_URL=https://[project].supabase.co
VITE_SUPABASE_ANON_KEY=[anon-key]
```

---

## 2. FILE STRUCTURE

```
charting_app/
├── src/
│   ├── App.jsx                    # Root component, all game state, 888 lines
│   ├── main.jsx                   # React DOM entry
│   ├── index.css                  # CSS variables + global resets
│   ├── lib/
│   │   ├── supabase.js            # Supabase client init
│   │   ├── db.js                  # All DB functions (255 lines)
│   │   └── analytics.js           # 5-layer AI engine (455 lines)
│   └── components/
│       ├── Header.jsx             # Top bar: logo, score, inning, pitcher (93 lines)
│       ├── Header.module.css
│       ├── LeftPanel.jsx          # Desktop: AI signals + recommendations (163 lines)
│       ├── LeftPanel.module.css
│       ├── CenterPanel.jsx        # Desktop: zone grid + pitch controls (228 lines)
│       ├── CenterPanel.module.css
│       ├── RightPanel.jsx         # Desktop: game state + batter (122 lines)
│       ├── RightPanel.module.css
│       ├── BottomConsole.jsx      # Desktop: bottom stats bar (152 lines)
│       ├── BottomConsole.module.css
│       ├── MobileLayout.jsx       # Mobile/tablet: 4-tab layout (734 lines)
│       ├── RosterTab.jsx          # Roster management UI (566 lines)
│       ├── RosterTab.module.css
│       ├── Scorebook.jsx          # Pitch-by-pitch scorebook (464 lines)
│       └── Scorebook.module.css
├── index.html                     # viewport-fit=cover for iOS safe area
├── package.json
└── vite.config.js
```

---

## 3. CSS DESIGN SYSTEM

All colors defined as CSS custom properties in `index.css`:

```css
:root {
  --void:           #050C14;   /* page background */
  --panel:          #0C1C2E;   /* card/panel background */
  --border:         #1A3550;   /* borders */
  --gold:           #F5A623;   /* primary accent, CTAs */
  --gold-dim:       rgba(245,166,35,0.2);
  --gold-glow:      rgba(245,166,35,0.4);
  --cyan:           #00D4FF;   /* info, secondary accent */
  --cyan-dim:       rgba(0,212,255,0.12);
  --green:          #00E5A0;   /* success, pitcher */
  --green-dim:      rgba(0,229,160,0.15);
  --red:            #FF4D6A;   /* danger, strikeouts */
  --red-dim:        rgba(255,77,106,0.12);
  --amber:          #FFB347;   /* warning */
  --amber-dim:      rgba(255,179,71,0.12);
  --purple:         #a78bfa;   /* AI/special signals */
  --text-primary:   #E8F4FF;
  --text-secondary: #7BACC8;
  --text-dim:       #3D6080;
}
```

**Fonts (Google Fonts, loaded in index.html):**
- `Rajdhani` — headings, titles
- `Share Tech Mono` — labels, mono data
- `Bebas Neue` — large numbers (scores, counts)
- `DM Sans` — body text, default

**MobileLayout inline style constants (defined at top of MobileLayout.jsx):**
```js
const C = {
  void: '#050C14', panel: '#0C1C2E', border: '#1A3550',
  gold: '#F5A623', cyan: '#00D4FF', green: '#00E5A0',
  red: '#FF4D6A', sec: '#7BACC8', dim: '#3D6080', pri: '#E8F4FF',
}
const bebas = "'Bebas Neue', sans-serif"
const mono  = "'Share Tech Mono', monospace"
```

**Body effects:**
- Scanline overlay: `body::before` repeating gradient
- Grid texture: `body::after` cyan grid lines at 32px

---

## 4. RESPONSIVE LAYOUT STRATEGY

**Breakpoint:** `windowWidth < 1280px` → MobileLayout  
**Hook in App.jsx:**
```js
function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth)
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return width
}
const isMobile = windowWidth < 1280
```

**Phone sub-breakpoint:** `window.innerWidth < 500` used inline in MobileLayout for compact vs full hitter card.

**Desktop layout:** 3-column CSS Grid  
`LeftPanel (AI) | CenterPanel (zone) | RightPanel (game state)`  
`BottomConsole` spans full width below.

**Mobile layout:** Single panel + bottom tab navigation  
4 tabs: ⚾ PITCH | 🤖 AI | 📊 GAME | ≡ BOOK

**Tab bar specs:**
```js
background: '#0A1929'
borderTop: '3px solid #F5A623'
boxShadow: '0 -6px 24px rgba(0,0,0,0.8)'
minHeight: 76px
paddingBottom: 'max(env(safe-area-inset-bottom, 12px), 12px)'  // iOS safe area
```

---

## 5. DATABASE SCHEMA (Supabase / Postgres)

### Table: `teams`
```sql
team_id    SERIAL PRIMARY KEY
name       TEXT NOT NULL UNIQUE
created_at TIMESTAMPTZ DEFAULT now()
```

### Table: `games`
```sql
game_id    SERIAL PRIMARY KEY
team_id    INT REFERENCES teams(team_id)
opponent   TEXT NOT NULL
game_date  DATE NOT NULL
location   TEXT DEFAULT ''
created_at TIMESTAMPTZ DEFAULT now()
```

### Table: `players`
```sql
player_id       SERIAL PRIMARY KEY
team_id         INT REFERENCES teams(team_id)
name            TEXT NOT NULL
jersey          TEXT
team_side       TEXT    -- 'ours' | 'opponent'
is_pitcher      BOOLEAN DEFAULT false
batter_type     TEXT    -- 'power' | 'contact' | 'slapper' | 'unknown'
lineup_order    INT DEFAULT 0
opponent_name   TEXT    -- set when team_side = 'opponent'
pitcher_arsenal TEXT[]  -- e.g. ['Fastball','Drop','Changeup']
pitching_style  TEXT    -- 'power' | 'movement' | 'finesse'
pitcher_notes   TEXT
pitch_speeds    JSONB   -- e.g. {"Fastball": "58-62", "Drop": "54-57"}
throws          TEXT DEFAULT 'R'
UNIQUE(team_id, name)
```

### Table: `plate_appearances`
```sql
pa_id        SERIAL PRIMARY KEY
game_id      INT REFERENCES games(game_id)
inning       INT NOT NULL
outs_start   INT DEFAULT 0
batter_name  TEXT NOT NULL
pitcher_name TEXT
lineup_spot  INT
pa_result    TEXT    -- 'B' | 'CK' | 'SK' | 'IP' | 'HBP' | null
created_at   TIMESTAMPTZ DEFAULT now()
```

### Table: `pitches`
```sql
pitch_id        SERIAL PRIMARY KEY
game_id         INT REFERENCES games(game_id)
pa_id           INT REFERENCES plate_appearances(pa_id)
pitcher_name    TEXT
batter_name     TEXT
pitch_type      TEXT NOT NULL   -- 'Fastball' | 'Drop' | 'Changeup' | 'Rise' | 'Curve' | 'Screw' | 'Drop-Curve'
zone_row        INT             -- 1=high, 2=mid, 3=low
zone_col        INT             -- 1=inside, 2=middle, 3=outside
outcome_basic   TEXT NOT NULL   -- 'B' | 'CK' | 'SK' | 'F' | 'IP' | 'HBP'
outcome_inplay  TEXT            -- 'Single' | 'Double' | 'Triple' | 'Home Run' | 'Groundout' | 'Popout' | 'Lineout' | 'Flyout' | 'Sac Fly' | 'Fielder Choice' | 'Error'
result_detail   TEXT            -- "{fielder} - {location}"
balls_before    INT DEFAULT 0
strikes_before  INT DEFAULT 0
runs_scored     INT DEFAULT 0
rbi             INT DEFAULT 0
hard_contact    BOOLEAN DEFAULT false
command_quality TEXT            -- 'executed' | 'missed-arm' | 'missed-glove'
pitch_ts        TIMESTAMPTZ DEFAULT now()
```

**Zone Grid Mapping:**
```
         IN    MID    OUT
HIGH  [1-1]  [1-2]  [1-3]
MID   [2-1]  [2-2]  [2-3]   2-2 = heart (❤️ icon)
LOW   [3-1]  [3-2]  [3-3]   3-2 = AI sweet spot (★ icon)
```

---

## 6. APP STATE (App.jsx — main game component)

All state lives in the `App` function. No external state management.

```js
// Session
const [session, setSession]               // { team: {}, game: {} } | null
const [showRoster, setShowRoster]         // boolean — roster management overlay
const [showHalfInningModal, ...]          // { inning, nextHalf, nextInning? } | null

// Count & game state
const [balls, setBalls]                   // 0-3
const [strikes, setStrikes]               // 0-2
const [outs, setOuts]                     // 0-2
const [inning, setInning]                 // 1-7+
const [topBottom, setTopBottom]           // 'top' | 'bottom'
const [ourRuns, setOurRuns]               // integer
const [oppRuns, setOppRuns]               // integer

// Baserunners
const [on1b, setOn1b]                     // boolean
const [on2b, setOn2b]                     // boolean
const [on3b, setOn3b]                     // boolean

// Lineup management
const [lineup, setLineup]                 // active lineup array (opponent batters)
const [ourLineup, setOurLineup]           // Lady Hawks roster
const [oppLineup, setOppLineup]           // opponent roster
const [lineupPos, setLineupPos]           // current index into lineup
const [manualBatterName, setManualBatterName]

// Pitcher
const [pitchers, setPitchers]             // array of pitcher player objects
const [arsenal, setArsenal]               // ['Fastball','Drop','Changeup']
const [pitcherName, setPitcherName]       // string

// Pitch charting (current PA)
const [activePA, setActivePA]             // plate_appearance row | null
const [selectedZone, setSelectedZone]     // { row, col } | null
const [selectedPitch, setSelectedPitch]   // pitch type string | null
const [selectedOutcome, setSelectedOutcome] // outcome code | null
const [inPlayDetail, setInPlayDetail]     // { outcome_inplay, fielder, location, runs_scored, rbi }

// Data
const [gamePitches, setGamePitches]       // all pitches this game
const [paPitches, setPAPitches]           // pitches this PA only
const [allPAs, setAllPAs]                 // all PAs this game
```

---

## 7. KEY COMPUTED VALUES (derived in App.jsx render)

```js
// Current batter from lineup
const currentBatter = lineup[lineupPos] || null

// Batter stats for today's game
const batterStats = currentBatter ? {
  paToday:    allPAs.filter(p => p.batter_name === currentBatter.name).length,
  abs:        // PAs minus walks/HBP
  hits:       // pitches where outcome_basic='IP' and outcome_inplay in HIT_SET
  strikeouts: // PAs where pa_result in ['CK','SK']
  walks:      // PAs where pa_result = 'B'
} : null

// 5-layer AI engine outputs
const pci           = computePCI(gamePitches)
const lm            = computeLeverage(inning, outs, on1b, on2b, on3b, ourRuns, oppRuns)
const prr           = computePRR(paPitches, batterPitches)
const signals       = generateSignals(paPitches, balls, strikes, batterType, context)
const recommendations = generateRecommendations(paPitches, balls, strikes, batterType, arsenal, { pci, lm, prr, ... })
const reverseSwitch = checkReverseSwitch(balls, strikes, pci, tendency, arsenal, on3b, lm)
```

---

## 8. AI ENGINE — 5 LAYERS (analytics.js)

Layer execution order on every pitch record:

```
LAYER 1: buildFirstPitchBrief()   — pitcher style + historical matchup data
LAYER 2: analyzeBatterHistory()   — same-game PA history, foul patterns, what got her out
LAYER 3: computeLeverage()        — game situation multiplier (1.0–1.6)
LAYER 4: computePCI()             — Pitcher Confidence Index (10–100)
LAYER 5: checkReverseSwitch()     — psychological count reversal (hitter's counts)
PRR:     computePRR()             — Pattern Reveal Risk (0–100)
```

**PCI scoring formula:**
```js
pci = 50
pci += (strikeRate - 0.55) * 60    // strike rate contribution
pci += (fpsRate - 0.55) * 30       // first pitch strike rate
pci -= missRate * 40                // repeated miss penalty
pci -= hardContactRate * 30         // hard contact penalty
// Clamped: Math.max(10, Math.min(100, pci))
```

**PCI bands:**
- `≥80` → HOT — EXPAND & ATTACK
- `≥55` → ON TARGET — STANDARD SEQ
- `<55` → OFF TODAY — SIMPLIFY

**Recommendation scoring (per pitch type, 0–95):**
```
+ Count fit:        0–30 pts (breaking ball ahead, FB behind)
+ Command fit:      0–25 pts (PCI-based)
+ Hitter tendency:  0–20 pts (power/contact/slapper matchup)
- Safety × LM:      0–30 pts penalized in high leverage
+ Matchup edge:     -10 to +10 (historical outs/fouls vs this batter)
- PRR:              -15 if overused pitch, +10 if pitch not yet thrown
```

**Outcome codes:**
```js
B   = Ball
CK  = Called Strike (strikeout)
SK  = Swing Strike (strikeout)
F   = Foul
IP  = In Play
HBP = Hit By Pitch
```

**In-play results:**
`Single | Double | Triple | Home Run | Groundout | Popout | Lineout | Flyout | Sac Fly | Fielder Choice | Error`

---

## 9. BASERUNNER ADVANCEMENT LOGIC

**Critical:** Must capture base state BEFORE any setState calls (stale closure bug).

```js
const was1b = on1b, was2b = on2b, was3b = on3b  // capture first!

if (result === 'Home Run') {
  runs = 1 + (was1b?1:0) + (was2b?1:0) + (was3b?1:0)
  setOn1b(false); setOn2b(false); setOn3b(false)
} else if (result === 'Triple') {
  runs = (was1b?1:0) + (was2b?1:0) + (was3b?1:0)
  setOn1b(false); setOn2b(false); setOn3b(true)
} else if (result === 'Double') {
  runs = (was2b?1:0) + (was3b?1:0)
  setOn1b(false); setOn2b(true); setOn3b(was1b)   // 1b → 3b
} else if (result === 'Single') {
  runs = (was3b?1:0)
  setOn1b(true); setOn2b(was1b); setOn3b(was2b)   // advance each base
}

// Walk/HBP — force runners
const was1b=on1b, was2b=on2b, was3b=on3b
setOn3b(was1b && was2b ? true : was3b)
setOn2b(was1b ? true : was2b)
setOn1b(true)
```

---

## 10. KEY FUNCTIONS (App.jsx)

```js
handleRecord()      // Validates zone+pitch+outcome, writes pitch to DB,
                    // advances count, updates runners, rotates lineup,
                    // handles inning changes at 3 outs

handleUndo()        // Deletes last pitch, restores previous count/state

handleNewPA()       // Creates plate_appearance row, resets count

handlePitcherChange(playerId)  // Loads pitcher, sets arsenal, ends PA

handleScoreChange(side, delta) // Increments/decrements ourRuns or oppRuns
```

---

## 11. HEADER COMPONENT (Header.jsx)

Props:
```js
ourName, oppName, ourRuns, oppRuns,
inning, topBottom,
onScoreChange(side, delta),
onInningChange(),
pitcherName,           // full name e.g. "Autumn Groover"
pitchers,              // array — shows dropdown if length > 1
onPitcherChange(id),
pitchCount             // total pitches this game (gamePitches.length)
```

Mobile behavior: Title and pitcher badge hidden on `@media (max-width: 1279px)`.
Pitcher displays as abbreviated: "A. Groover" with pitch count below: "14 PITCHES".

---

## 12. MOBILE PITCH TAB — HITTER CARD STRUCTURE

```
┌─────────────────────────────────────────────────────────┐
│ ▌  #8  Gabriella Flores          [★ AI DROP 3-2 · 85%]  │  0-2  │
│ CON  1-3  [2K]  [1BB]  4PA                              │  B·S  │
└─────────────────────────────────────────────────────────┘
```

- Left color bar: RED=power, CYAN=contact, GREEN=slapper
- Center: jersey + name + stat line (H-AB, K badges, BB badges)
- Middle: AI top recommendation (pitch · zone · confidence%)
- Right: Count box (gold border, always visible)
- Phone (<500px): collapses to single compact row

---

## 13. KNOWN BUGS / ACTIVE ISSUES

| ID | Description | Status |
|----|-------------|--------|
| B-01 | Lineup cycles back after 5-6 hitters instead of full 9-12 | 🔴 Active |
| B-02 | Baserunner stale state bug | ✅ Fixed (was1b capture pattern) |
| B-03 | Hitter card not visible on phone | ✅ Fixed |
| B-04 | Tab bar cut off on iPhone | ✅ Fixed (safe-area-inset) |
| B-05 | iPad showing desktop layout (1024px breakpoint too low) | ✅ Fixed (raised to 1280px) |

---

## 14. ENVIRONMENT & DEPLOYMENT

```bash
# Local dev
npm run dev          # Vite dev server at localhost:5173

# Production
git push             # Auto-deploys to Vercel via GitHub webhook
                     # ~30 second deploy time

# Vercel project settings
Framework: Vite
Build command: npm run build
Output dir: dist
```

**Git workflow:**
```bash
cd C:\projects\charting_app
git add .
git commit -m "description"
git push
```

---

## 15. PENDING SCHEMA CHANGES (schema_update_v4.sql — NOT YET RUN)

These columns need to be added to the `pitches` table in Supabase production:
```sql
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS command_quality TEXT;
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS hard_contact    BOOLEAN DEFAULT false;
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS pitch_num_in_pa INT;
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS batter_tendency TEXT;
```

---

## 16. NEXT SPRINT PRIORITIES (from backlog)

1. **B-01** — Fix lineup cycling for full 9-12 order
2. **F-01** — Game save/resume (persist inning, outs, runners, lineupPos to Supabase)
3. **F-02** — Live lineup quick-add during game
4. **F-03** — In-game hitter notes with quick-tap tags
5. **T-01** — Run schema_update_v4.sql in production
6. **T-02** — Add Supabase Row Level Security policies
