# Pitch Intelligence — Version Control Strategy
## Git Branching, Versioning & Release Process

---

## VERSIONING SCHEME

Uses Semantic Versioning: `MAJOR.MINOR.PATCH`

| Part | When to increment | Example |
|------|-------------------|---------|
| MAJOR | Breaking change to DB schema, complete redesign | 1.0.0 → 2.0.0 |
| MINOR | New feature added, new tab, new AI layer | 0.1.0 → 0.2.0 |
| PATCH | Bug fix, UI tweak, text change | 0.1.0 → 0.1.1 |

**Current version: 0.1.0 (POC)**

---

## BRANCH STRATEGY

```
main ─────────────────────────────────────────── (always deployable, auto-deploys to Vercel)
  │
  ├── dev ──────────────────────────────────────  (integration branch, tested before merging main)
  │     │
  │     ├── feature/game-save-resume             (F-01)
  │     ├── feature/live-lineup-loading          (F-02)
  │     ├── feature/hitter-notes                 (F-03)
  │     ├── fix/lineup-cycling-bug               (B-01)
  │     └── fix/schema-v4-migration              (T-01)
  │
  └── release/v0.2.0 ────────────────────────────(release candidate, goes to main when ready)
```

**Rules:**
- `main` is always live — never commit broken code directly
- Every feature gets its own branch
- Merge `feature/*` → `dev` → `main`
- Never force push to `main`

---

## DAILY GIT WORKFLOW

```bash
# Start a new feature
git checkout dev
git pull origin dev
git checkout -b feature/your-feature-name

# Work on it, commit often
git add .
git commit -m "type(scope): description"

# Push your branch
git push origin feature/your-feature-name

# When done — merge to dev
git checkout dev
git merge feature/your-feature-name
git push origin dev

# When dev is stable — merge to main (deploys automatically)
git checkout main
git merge dev
git push origin main
```

---

## COMMIT MESSAGE FORMAT

```
type(scope): short description

Examples:
fix(lineup): correct cycling bug past 6th batter
feat(mobile): add hitter notes quick-tap tags
feat(ai): integrate Claude API live recommendations
fix(baserunners): capture stale state before advancement
chore(schema): run v4 migration, add command_quality column
style(mobile): tighten phone hitter card layout
docs(spec): update technical spec to v0.2.0
```

**Types:** `feat` | `fix` | `style` | `chore` | `docs` | `refactor` | `test`  
**Scopes:** `mobile` | `desktop` | `ai` | `db` | `lineup` | `baserunners` | `header` | `scorebook`

---

## TAGGING RELEASES

When a version is stable and deployed:

```bash
git tag -a v0.1.0 -m "POC: Mobile layout, AI engine, 5-layer recommendations"
git push origin v0.1.0
```

This creates a permanent snapshot you can always restore.

---

## MOVING TO A NEW CHAT / VERSION

### Option A — Use the Technical Spec (recommended for Claude)
1. Open `TECHNICAL_SPEC.md` from this repo
2. Paste it at the start of the new chat
3. Claude has full context — no file reading needed

### Option B — Reference the repo directly
Tell Claude:
> "The repo is github.com/diamondintel/charting-app. Current version is v0.1.0.
> Check the TECHNICAL_SPEC.md and CHANGELOG.md files for full context."

### Option C — Export current file state
Run this script to get a snapshot of all source files concatenated:
```bash
cd C:\projects\charting_app
python export_snapshot.py > snapshot_v010.txt
```

---

## CHANGELOG

---

### v0.1.0 — POC RELEASE (February 2026)
**Status:** Live at charting-app-topaz.vercel.app

#### Features Shipped
- **5-Layer AI Engine**
  - Layer 1: First-pitch brief (pitcher style + historical matchup)
  - Layer 2: Same-game batter history analysis
  - Layer 3: Leverage Multiplier (1.0–1.6 based on situation)
  - Layer 4: Pitcher Confidence Index (PCI, 10–100 scale)
  - Layer 5: Reverse Switch (psychological count reversal)
  - Pattern Reveal Risk (PRR, 0–100)
- **Zone Grid:** 3×3 grid (row: high/mid/low, col: inside/mid/outside)
- **Pitch Arsenal:** Fastball, Drop, Changeup, Rise, Curve, Screw, Drop-Curve
- **Outcome Tracking:** B, CK, SK, F, IP, HBP with in-play detail
- **Scorebook View:** Full pitch-by-pitch grid, inning columns, pitch dots
- **Roster Management:** Players, pitchers, opponent lineup management
- **Desktop Layout:** 3-column grid (AI | Zone | Game State)
- **Mobile Layout:** 4-tab bottom navigation (Pitch | AI | Game | Book)
- **Responsive Breakpoint:** 1280px tablet/desktop split
- **Hitter Card:** Jersey, name, type, stat line (H-AB, K, BB), AI rec, count
- **Header:** Compact mobile (logo + score + pitcher abbreviated + pitch count)
- **Baserunner Logic:** Full advancement for Single/Double/Triple/HR/Walk/HBP

#### Bug Fixes
- Baserunner stale state — `was1b/was2b/was3b` capture pattern
- Tab bar iPhone safe area — `env(safe-area-inset-bottom)`
- iPad breakpoint — raised from 1024px to 1280px

#### Known Issues (Next Sprint)
- B-01: Lineup resets after 5–6 batters instead of full 9–12 order
- No game save/resume (state lost on page refresh)
- No Row Level Security (all teams share same anon key)
- No offline support

---

### v0.2.0 — PLANNED (Sprint 2, ~4 weeks)

#### Planned
- [ ] B-01: Fix full lineup cycling (9–12 batters)
- [ ] F-01: Game save/resume — persist game state to Supabase
- [ ] F-02: Live lineup quick-add (manual entry during game)
- [ ] F-03: In-game hitter notes (quick-tap tags + free text)
- [ ] T-01: Run schema_update_v4.sql in production
- [ ] T-02: Supabase Row Level Security policies

---

### v0.3.0 — PLANNED (Sprint 3)

#### Planned
- [ ] F-05a: Claude API live AI recommendations
- [ ] Post-game summary PDF report
- [ ] Opponent scouting database
- [ ] PWA (Progressive Web App) — Add to Home Screen

---

### v1.0.0 — PLANNED (Month 8–9)

#### Planned
- [ ] Capacitor iOS wrapper → App Store submission
- [ ] Stripe/RevenueCat subscription management
- [ ] Apple Sign In
- [ ] Full offline support (IndexedDB sync queue)
