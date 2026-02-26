import { supabase } from './supabase'

// ─── Teams ────────────────────────────────────────────────────────────────────

export async function getTeams() {
  const { data, error } = await supabase.from('teams').select('*').order('name')
  if (error) throw error
  return data || []
}

export async function getOrCreateTeam(name) {
  const { data: existing } = await supabase.from('teams').select('*').eq('name', name).single()
  if (existing) return existing
  const { data, error } = await supabase.from('teams').insert({ name }).select().single()
  if (error) throw error
  return data
}

// ─── Games ────────────────────────────────────────────────────────────────────

export async function getGames(teamId, limit = 20) {
  // Join game_state so we can surface active/recently-saved games at the top
  let q = supabase
    .from('games')
    .select('*, game_state(inning, top_bottom, our_runs, opp_runs, saved_at, lineup_mode)')
    .order('game_date', { ascending: false })
    .limit(limit)
  if (teamId) q = q.eq('team_id', teamId)
  const { data, error } = await q
  if (error) throw error

  const rows = data || []
  // Sort: games with recent save data first (by saved_at desc), then unsaved by game_date desc
  rows.sort((a, b) => {
    const aSaved = a.game_state?.saved_at ? new Date(a.game_state.saved_at) : null
    const bSaved = b.game_state?.saved_at ? new Date(b.game_state.saved_at) : null
    if (aSaved && bSaved) return bSaved - aSaved
    if (aSaved) return -1
    if (bSaved) return 1
    return new Date(b.game_date) - new Date(a.game_date)
  })
  return rows
}

export async function deleteGame(gameId) {
  const { error } = await supabase.from('games').delete().eq('game_id', gameId)
  if (error) throw error
}

export async function createGame(teamId, opponent, gameDate, location = '') {
  const { data, error } = await supabase
    .from('games')
    .insert({ team_id: teamId, opponent, game_date: gameDate, location })
    .select().single()
  if (error) throw error
  return data
}

// ─── Players ──────────────────────────────────────────────────────────────────

export async function getPlayers(teamId) {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('team_id', teamId)
    .eq('team_side', 'ours')
    .order('lineup_order')
    .order('name')
  if (error) throw error
  return data || []
}

export async function getPitchers(teamId) {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('team_id', teamId)
    .eq('team_side', 'ours')
    .eq('is_pitcher', true)
    .order('name')
  if (error) throw error
  return data || []
}

export async function getOpponentLineup(teamId, opponentName) {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('team_id', teamId)
    .eq('team_side', 'opponent')
    .eq('opponent_name', opponentName)
    .order('lineup_order')
  if (error) throw error
  return data || []
}

// ─── Plate Appearances ────────────────────────────────────────────────────────

export async function createPA(gameId, inning, outsStart, batterName, pitcherName, lineupSpot) {
  const { data, error } = await supabase
    .from('plate_appearances')
    .insert({
      game_id: gameId,
      inning,
      outs_start: outsStart,
      batter_name: batterName,
      pitcher_name: pitcherName,
      lineup_spot: lineupSpot,
    })
    .select().single()
  if (error) throw error
  return data
}

export async function updatePAResult(paId, paResult) {
  const { error } = await supabase
    .from('plate_appearances')
    .update({ pa_result: paResult })
    .eq('pa_id', paId)
  if (error) throw error
}

export async function getPAsForGame(gameId) {
  const { data, error } = await supabase
    .from('plate_appearances')
    .select('*')
    .eq('game_id', gameId)
    .order('created_at')
  if (error) throw error
  return data || []
}

// ─── Pitches ──────────────────────────────────────────────────────────────────

export async function insertPitch(pitch) {
  const { data, error } = await supabase
    .from('pitches')
    .insert(pitch)
    .select().single()
  if (error) throw error
  return data
}

export async function deletePitch(pitchId) {
  const { error } = await supabase.from('pitches').delete().eq('pitch_id', pitchId)
  if (error) throw error
}

export async function getPitchesForGame(gameId) {
  const { data, error } = await supabase
    .from('pitches')
    .select('*')
    .eq('game_id', gameId)
    .order('pitch_ts')
  if (error) throw error
  return data || []
}

export async function getPitchesForPA(paId) {
  const { data, error } = await supabase
    .from('pitches')
    .select('*')
    .eq('pa_id', paId)
    .order('pitch_ts')
  if (error) throw error
  return data || []
}

export async function getRecentPitches(gameId, limit = 20) {
  const { data, error } = await supabase
    .from('pitches')
    .select('*')
    .eq('game_id', gameId)
    .order('pitch_ts', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

// ─── Zone label util ──────────────────────────────────────────────────────────

const ZONE_LABELS = {
  '1-1': 'high-inside',  '1-2': 'high-middle',  '1-3': 'high-away',
  '2-1': 'mid-inside',   '2-2': 'heart',         '2-3': 'mid-away',
  '3-1': 'low-inside',   '3-2': 'low-middle',    '3-3': 'low-away',
}

export function zoneLabel(row, col) {
  return ZONE_LABELS[`${row}-${col}`] || 'unknown'
}

// ─── Roster Management ────────────────────────────────────────────────────────

export async function upsertPlayer(player) {
  const { data, error } = await supabase
    .from('players')
    .upsert(player, { onConflict: 'team_id,name' })
    .select().single()
  if (error) throw error
  return data
}

export async function updatePlayer(playerId, updates) {
  const { data, error } = await supabase
    .from('players')
    .update(updates)
    .eq('player_id', playerId)
    .select().single()
  if (error) throw error
  return data
}

export async function upsertPitcher(teamId, pitcher) {
  const { data, error } = await supabase
    .from('players')
    .upsert({
      team_id:         teamId,
      team_side:       'ours',
      is_pitcher:      true,
      name:            pitcher.name,
      jersey:          pitcher.jersey,
      throws:          pitcher.throws || 'R',
      pitcher_arsenal: pitcher.pitcher_arsenal || [],
      pitching_style:  pitcher.pitching_style || '',
      pitcher_notes:   pitcher.pitcher_notes || '',
      pitch_speeds:    pitcher.pitch_speeds || {},
      lineup_order:    pitcher.lineup_order || 0,
    }, { onConflict: 'team_id,name' })
    .select().single()
  if (error) throw error
  return data
}

export async function deletePlayer(playerId) {
  const { error } = await supabase
    .from('players')
    .delete()
    .eq('player_id', playerId)
  if (error) throw error
}

export async function upsertOpponentPlayer(teamId, opponentName, player) {
  // Use insert instead of upsert — clearOpponentLineup always runs first,
  // so there are no existing rows to conflict with. This avoids the
  // team_id,name conflict key colliding across different games vs same opponent.
  const { data, error } = await supabase
    .from('players')
    .insert({
      ...player,
      team_id: teamId,
      team_side: 'opponent',
      opponent_name: opponentName,
    })
    .select().single()
  if (error) throw error
  return data
}

export async function clearOpponentLineup(teamId, opponentName) {
  const { error } = await supabase
    .from('players')
    .delete()
    .eq('team_id', teamId)
    .eq('team_side', 'opponent')
    .eq('opponent_name', opponentName)
  if (error) throw error
}

export async function getPlayersForTeam(teamId) {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('team_id', teamId)
    .eq('team_side', 'ours')
    .order('lineup_order')
    .order('name')
  if (error) throw error
  return data || []
}

// ─── Game State (Save / Resume) ───────────────────────────────────────────────

export async function saveGameState(gameId, state) {
  const { error } = await supabase
    .from('game_state')
    .upsert({
      game_id:      gameId,
      inning:       state.inning,
      top_bottom:   state.topBottom,
      outs:         state.outs,
      our_runs:     state.ourRuns,
      opp_runs:     state.oppRuns,
      on1b:         state.on1b,
      on2b:         state.on2b,
      on3b:         state.on3b,
      lineup_pos:   state.lineupPos,
      pitcher_name: state.pitcherName,
      lineup_mode:  state.lineupMode,
      active_pa_id: state.activePaId || null,
      saved_at:     new Date().toISOString(),
    }, { onConflict: 'game_id' })
  if (error) throw error
}

export async function loadGameState(gameId) {
  const { data, error } = await supabase
    .from('game_state')
    .select('*')
    .eq('game_id', gameId)
    .single()
  if (error) return null   // no saved state yet — that's fine
  return data
}

// ─── Hitter Notes ─────────────────────────────────────────────────────────────

export async function saveHitterNote(teamId, opponentName, batterName, note) {
  const { error } = await supabase
    .from('hitter_notes')
    .upsert({
      team_id:       teamId,
      opponent_name: opponentName,
      batter_name:   batterName,
      note_text:     note.text || '',
      tags:          note.tags || [],
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'team_id,opponent_name,batter_name' })
  if (error) throw error
}

export async function getHitterNotes(teamId, opponentName) {
  const { data, error } = await supabase
    .from('hitter_notes')
    .select('*')
    .eq('team_id', teamId)
    .eq('opponent_name', opponentName)
  if (error) throw error
  return data || []
}

// ─── Pitcher Scouting Report ──────────────────────────────────────────────────

export async function getPitcherScoutingData(teamId, pitcherName) {
  // All games where this pitcher threw
  const { data: games, error: gErr } = await supabase
    .from('games')
    .select('game_id, opponent, game_date')
    .eq('team_id', teamId)
    .order('game_date', { ascending: false })
  if (gErr) throw gErr

  const gameIds = games.map(g => g.game_id)
  if (gameIds.length === 0) return { games: [], pitches: [], pas: [] }

  // All pitches by this pitcher
  const { data: pitches, error: pErr } = await supabase
    .from('pitches')
    .select('*')
    .in('game_id', gameIds)
    .eq('pitcher_name', pitcherName)
  if (pErr) throw pErr

  // All PAs from those games (for results)
  const { data: pas, error: paErr } = await supabase
    .from('plate_appearances')
    .select('*')
    .in('game_id', gameIds)
  if (paErr) throw paErr

  return { games, pitches: pitches || [], pas: pas || [] }
}
