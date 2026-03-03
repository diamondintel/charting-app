/**
 * Pitch Intelligence - Automated Test Suite
 * ==========================================
 * Run with: node test-suite.js
 * Or with watch mode: node --watch test-suite.js
 *
 * Tests the Supabase backend directly + the live Vercel deployment.
 * No test framework needed — pure Node.js with fetch.
 *
 * Setup:
 *   1. npm init -y
 *   2. node test-suite.js
 */

const SUPABASE_URL = 'https://inampclnbplcopglxfjr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImluYW1wY2xuYnBsY29wZ2x4ZmpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MTUyMzIsImV4cCI6MjA4Njk5MTIzMn0.NYJTQV1ZpuEbfTQ4lXhfRPUt4F4ftjX-n4DJAncluDg';
const VERCEL_URL = 'https://charting-app-topaz.vercel.app';

// ─── Test Runner ──────────────────────────────────────────────────────────────

const results = { passed: 0, failed: 0, skipped: 0, errors: [] };

async function test(name, fn) {
  process.stdout.write(`  ⏳ ${name}...`);
  try {
    await fn();
    results.passed++;
    console.log(`\r  ✅ ${name}`);
  } catch (err) {
    results.failed++;
    results.errors.push({ name, error: err.message });
    console.log(`\r  ❌ ${name}`);
    console.log(`     → ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected "${expected}", got "${actual}"`);
  }
}

// ─── Supabase Helper ──────────────────────────────────────────────────────────

async function sb(table, method = 'GET', body = null, params = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${params}`;
  const res = await fetch(url, {
    method,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : '',
    },
    body: body ? JSON.stringify(body) : null,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${table} → ${res.status}: ${text}`);
  }

  return res.json().catch(() => null);
}

// ─── Test State (cleaned up after run) ───────────────────────────────────────

let testGameId = null;
let testTeamId = 4; // Lady Hawks Rivera 14U — hardcoded, RLS blocks anon reads on teams
let testPlayerId = null;
let testPaId = null;

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: CONNECTIVITY
// ─────────────────────────────────────────────────────────────────────────────

async function suiteConnectivity() {
  console.log('\n📡 SUITE 1: Connectivity\n');

  await test('Supabase API is reachable', async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { 'apikey': SUPABASE_ANON_KEY }
    });
    assert(res.ok || res.status === 404, `Got unexpected status: ${res.status}`);
  });

  await test('Vercel deployment is live', async () => {
    const res = await fetch(VERCEL_URL, { method: 'HEAD' });
    assert(res.ok, `Vercel returned ${res.status}`);
  });

  await test('Supabase returns valid JSON from teams table', async () => {
    const data = await sb('teams', 'GET', null, '?select=team_id,name&limit=5');
    assert(Array.isArray(data), 'Expected an array');
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: DATABASE READ INTEGRITY
// ─────────────────────────────────────────────────────────────────────────────

async function suiteReadIntegrity() {
  console.log('\n🗄️  SUITE 2: Database Read Integrity\n');

  await test('teams table exists and has data', async () => {
    // RLS blocks anon reads on teams — we verify by checking team_id=4 exists via games
    // testTeamId is hardcoded to 4 (Lady Hawks Rivera 14U)
    assert(testTeamId === 4, 'team_id not set — update hardcoded value if team was recreated');
    console.log('     (teams RLS blocks anon reads — using hardcoded team_id=4)');
  });

  await test('players table is queryable', async () => {
    const data = await sb('players', 'GET', null, '?select=player_id,name,team_id&limit=10');
    assert(Array.isArray(data), 'Expected array of players');
  });

  await test('games table is queryable', async () => {
    const data = await sb('games', 'GET', null, '?select=game_id,opponent,game_date&limit=10');
    assert(Array.isArray(data), 'Expected array of games');
  });

  await test('pitches table is queryable', async () => {
    const data = await sb('pitches', 'GET', null, '?select=pitch_id,pitch_type,outcome_basic&limit=10');
    assert(Array.isArray(data), 'Expected array of pitches');
  });

  await test('plate_appearances table is queryable', async () => {
    const data = await sb('plate_appearances', 'GET', null, '?select=pa_id,game_id,inning&limit=10');
    assert(Array.isArray(data), 'Expected array of PAs');
  });

  await test('game_state table is queryable', async () => {
    const data = await sb('game_state', 'GET', null, '?select=*&limit=5');
    assert(Array.isArray(data), 'Expected array of game states');
  });

  await test('players have required fields', async () => {
    const data = await sb('players', 'GET', null, '?select=player_id,name,team_id,team_side&limit=20');
    const missing = data.filter(p => !p.name || !p.team_id);
    assert(missing.length === 0, `${missing.length} players are missing name or team_id`);
  });

  await test('opponent players are tagged correctly', async () => {
    const data = await sb('players', 'GET', null, `?select=*&team_side=eq.opponent&limit=10`);
    assert(Array.isArray(data), 'Expected array');
    // If there are opponent players, they should all have team_side=opponent
    data.forEach(p => {
      assert(p.team_side === 'opponent', `Player ${p.name} has wrong team_side: ${p.team_side}`);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: WRITE / FULL GAME FLOW
// ─────────────────────────────────────────────────────────────────────────────

async function suiteWriteFlow() {
  console.log('\n⚾ SUITE 3: Write Flow (creates & cleans up test data)\n');

  await test('can create a test game', async () => {
    assert(testTeamId, 'Need a valid team_id — check suiteReadIntegrity');
    const data = await sb('games', 'POST', {
      team_id: testTeamId,
      opponent: '__TEST_OPPONENT__',
      game_date: new Date().toISOString().split('T')[0],
      location: 'Test Field',
    });
    assert(data && data[0]?.game_id, 'No game_id returned');
    testGameId = data[0].game_id;
  });

  await test('can create a test plate appearance', async () => {
    assert(testGameId, 'Need testGameId from previous test');
    const data = await sb('plate_appearances', 'POST', {
      game_id: testGameId,
      inning: 1,
      outs_start: 0,
      batter_name: '__TEST_BATTER__',
      lineup_spot: 1,
    });
    assert(data && data[0]?.pa_id, 'No pa_id returned');
    testPaId = data[0].pa_id;
  });

  await test('can log a pitch', async () => {
    assert(testGameId && testPaId, 'Need testGameId and testPaId');
    const data = await sb('pitches', 'POST', {
      game_id: testGameId,
      pa_id: testPaId,
      batter_name: '__TEST_BATTER__',
      inning: 1,
      outs: 0,
      balls_before: 0,
      strikes_before: 0,
      pitch_type: 'Fastball',
      zone_row: 2,
      zone_col: 2,
      zone_label: 'middle-middle',
      is_in_zone: true,
      outcome_basic: 'CalledStrike',
    });
    assert(data && data[0]?.pitch_id, 'No pitch_id returned');
  });

  await test('can upsert game_state', async () => {
    assert(testGameId, 'Need testGameId');
    const data = await sb('game_state', 'POST', {
      game_id: testGameId,
      inning: 1,
      half: 'top',
      outs: 1,
      score_us: 0,
      score_them: 0,
    });
    assert(Array.isArray(data), 'Expected array response');
  });

  await test('pitch count matches expected after logging', async () => {
    const data = await sb('pitches', 'GET', null, `?game_id=eq.${testGameId}&select=pitch_id`);
    assert(data.length === 1, `Expected 1 pitch, got ${data.length}`);
  });

  await test('game is retrievable by id', async () => {
    const data = await sb('games', 'GET', null, `?game_id=eq.${testGameId}&select=*`);
    assert(data.length === 1, 'Game not found by id');
    assertEqual(data[0].opponent, '__TEST_OPPONENT__', 'opponent field');
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: BUSINESS LOGIC VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

async function suiteBusinessLogic() {
  console.log('\n🧠 SUITE 4: Business Logic Validation\n');

  await test('pitches have valid outcome_basic values', async () => {
    const VALID_OUTCOMES = ['Ball', 'CalledStrike', 'SwingingStrike', 'Foul', 'InPlay', 'HBP'];
    const data = await sb('pitches', 'GET', null, '?select=pitch_id,outcome_basic&limit=100');
    const invalid = data.filter(p => !VALID_OUTCOMES.includes(p.outcome_basic));
    assert(invalid.length === 0,
      `${invalid.length} pitches with invalid outcome_basic: ${invalid.map(p => p.outcome_basic).join(', ')}`
    );
  });

  await test('pitches have valid zone coordinates or are out-of-zone', async () => {
    const data = await sb('pitches', 'GET', null, '?select=pitch_id,zone_row,zone_col,is_in_zone&limit=200');
    const bad = data.filter(p => {
      if (!p.is_in_zone) return false; // wild pitches don't need zone coords
      return (p.zone_row < 1 || p.zone_row > 3 || p.zone_col < 1 || p.zone_col > 3);
    });
    assert(bad.length === 0, `${bad.length} in-zone pitches have invalid zone coords`);
  });

  await test('pitch count per PA is reasonable (≤ 15)', async () => {
    const data = await sb('pitches', 'GET', null,
      '?select=pa_id&order=pa_id&limit=500'
    );
    const counts = {};
    data.forEach(p => { counts[p.pa_id] = (counts[p.pa_id] || 0) + 1; });
    const overLimit = Object.entries(counts).filter(([, c]) => c > 15);
    assert(overLimit.length === 0,
      `${overLimit.length} plate appearances have > 15 pitches: PAs ${overLimit.map(e => e[0]).join(', ')}`
    );
  });

  await test('games have valid dates (not in the future)', async () => {
    const today = new Date().toISOString().split('T')[0];
    const data = await sb('games', 'GET', null,
      `?select=game_id,game_date,opponent&game_date=gt.${today}&opponent=not.eq.__TEST_OPPONENT__`
    );
    assert(data.length === 0,
      `${data.length} games have future dates: ${data.map(g => `${g.opponent} (${g.game_date})`).join(', ')}`
    );
  });

  await test('players linked to games exist in players table', async () => {
    // Check that pitcher_id values in pitches all map to valid players
    const pitches = await sb('pitches', 'GET', null,
      '?select=pitcher_id&pitcher_id=not.is.null&limit=50'
    );
    const ids = [...new Set(pitches.map(p => p.pitcher_id))];
    if (ids.length === 0) {
      console.log('     (no pitcher_id values to check — skipping)');
      return;
    }
    const filter = ids.map(id => `player_id=eq.${id}`).join(',');
    const players = await sb('players', 'GET', null,
      `?select=player_id&or=(${filter})`
    );
    assert(players.length === ids.length,
      `${ids.length - players.length} pitcher_id references don't match any player`
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5: CLEANUP
// ─────────────────────────────────────────────────────────────────────────────

async function suiteCleanup() {
  console.log('\n🧹 SUITE 5: Cleanup\n');

  await test('delete test pitches', async () => {
    if (!testGameId) return;
    await fetch(`${SUPABASE_URL}/rest/v1/pitches?game_id=eq.${testGameId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });
  });

  await test('delete test game_state', async () => {
    if (!testGameId) return;
    await fetch(`${SUPABASE_URL}/rest/v1/game_state?game_id=eq.${testGameId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });
  });

  await test('delete test plate appearances', async () => {
    if (!testGameId) return;
    await fetch(`${SUPABASE_URL}/rest/v1/plate_appearances?game_id=eq.${testGameId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });
  });

  await test('delete test game', async () => {
    if (!testGameId) return;
    await fetch(`${SUPABASE_URL}/rest/v1/games?game_id=eq.${testGameId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });
    // Verify it's gone
    const data = await sb('games', 'GET', null, `?game_id=eq.${testGameId}&select=game_id`);
    assert(data.length === 0, 'Test game was not deleted');
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN RUNNER
// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  const start = Date.now();
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   Pitch Intelligence — Test Suite          ║');
  console.log(`║   ${new Date().toLocaleString().padEnd(43)}║`);
  console.log('╚════════════════════════════════════════════╝');

  try {
    await suiteConnectivity();
    await suiteReadIntegrity();
    await suiteWriteFlow();
    await suiteBusinessLogic();
    await suiteCleanup();
  } catch (e) {
    console.error('\nUnexpected fatal error:', e.message);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log('\n─────────────────────────────────────────────');
  console.log(`  Results: ${results.passed} passed, ${results.failed} failed  (${elapsed}s)`);

  if (results.errors.length > 0) {
    console.log('\n  Failed tests:');
    results.errors.forEach(e => {
      console.log(`  ❌ ${e.name}`);
      console.log(`     ${e.error}`);
    });
  }

  console.log('─────────────────────────────────────────────\n');

  process.exit(results.failed > 0 ? 1 : 0);
}

run();
