// PDF export using pdf-lib (loaded via CDN in browser)
// Generates a game summary PDF matching the dark theme aesthetic

export async function exportGameSummaryPDF({ session, gamePitches, allPAs, pitcherName, oppLineup, ourRuns, oppRuns, inning }) {
  // Dynamically import pdf-lib from CDN
  const { PDFDocument, rgb, StandardFonts } = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.esm.min.js')

  const doc   = await PDFDocument.create()
  const font  = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontR = await doc.embedFont(StandardFonts.Helvetica)

  const W = 612, H = 792 // Letter
  const page = doc.addPage([W, H])
  const { width, height } = page.getSize()

  // ── Colors ──
  const navy   = rgb(0.02, 0.047, 0.078)   // #050C14
  const panel  = rgb(0.047, 0.11, 0.18)    // #0C1C2E
  const gold   = rgb(0.96, 0.65, 0.137)    // #F5A623
  const cyan   = rgb(0, 0.831, 1)          // #00D4FF
  const green  = rgb(0, 0.898, 0.627)      // #00E5A0
  const red    = rgb(1, 0.314, 0.314)      // #FF5050
  const white  = rgb(0.91, 0.957, 0.973)   // #E8F4F8
  const dimC   = rgb(0.239, 0.376, 0.502)  // #3D6080
  const secC   = rgb(0.482, 0.675, 0.784)  // #7BACC8

  // Fill background
  page.drawRectangle({ x:0, y:0, width:W, height:H, color:navy })

  let y = height - 40

  // ── Header ──
  const opponent = session?.game?.opponent || 'Opponent'
  const teamName = session?.team?.name || 'Lady Hawks'
  const date = session?.game?.game_date
    ? new Date(session.game.game_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
    : new Date().toLocaleDateString()
  const weWon = ourRuns > oppRuns
  const tied  = ourRuns === oppRuns
  const result = tied ? 'TIE' : weWon ? 'WIN' : 'LOSS'
  const resultColor = tied ? gold : weWon ? green : red

  page.drawText('PITCH INTELLIGENCE', { x:40, y, font, size:22, color:gold })
  page.drawText('GAME SUMMARY', { x:40, y:y-18, font, size:12, color:secC })
  page.drawText(date, { x:W-100, y, font:fontR, size:10, color:dimC })
  y -= 50

  // ── Score banner ──
  page.drawRectangle({ x:40, y:y-50, width:W-80, height:55, color:panel, borderColor:resultColor, borderWidth:1.5, borderRadius:4 })
  page.drawText(teamName.toUpperCase(), { x:60, y:y-20, font:fontR, size:8, color:dimC })
  page.drawText(String(ourRuns), { x:60, y:y-44, font, size:32, color:white })
  page.drawText(result, { x:W/2-20, y:y-28, font, size:22, color:resultColor })
  page.drawText(`FINAL · INN ${inning}`, { x:W/2-28, y:y-42, font:fontR, size:8, color:dimC })
  page.drawText(opponent.toUpperCase(), { x:W-120, y:y-20, font:fontR, size:8, color:dimC })
  page.drawText(String(oppRuns), { x:W-110, y:y-44, font, size:32, color:white })
  y -= 75

  // ── Pitcher stats ──
  const pitches     = gamePitches.filter(p => p.pitcher_name === pitcherName)
  const total       = pitches.length
  const strikes     = pitches.filter(p => ['CK','SK','F','IP'].includes(p.outcome_basic)).length
  const ks          = allPAs.filter(p => ['CK','SK'].includes(p.pa_result)).length
  const strikeRate  = total > 0 ? Math.round(strikes/total*100) : 0

  page.drawText('PITCHER STATS', { x:40, y, font, size:10, color:cyan })
  page.drawLine({ start:{x:40,y:y-6}, end:{x:W-40,y:y-6}, color:dimC, thickness:0.5 })
  y -= 24

  const statCols = [
    ['PITCHER', pitcherName],
    ['PITCHES', String(total)],
    ['STRIKES', String(strikes)],
    ['STR %', `${strikeRate}%`],
    ["K'S", String(ks)],
  ]
  statCols.forEach(([label, val], i) => {
    const x = 40 + i * 108
    page.drawText(label, { x, y, font:fontR, size:7, color:dimC })
    page.drawText(val, { x, y:y-14, font, size:14, color:gold })
  })
  y -= 44

  // Pitch type breakdown
  const byType = {}
  pitches.forEach(p => {
    const t = p.pitch_type || 'Unknown'
    if (!byType[t]) byType[t] = { total:0, strikes:0 }
    byType[t].total++
    if (['CK','SK','F','IP'].includes(p.outcome_basic)) byType[t].strikes++
  })

  page.drawText('PITCH ARSENAL', { x:40, y, font, size:9, color:secC })
  y -= 16
  Object.entries(byType).sort((a,b)=>b[1].total-a[1].total).forEach(([type, data]) => {
    const pct = total > 0 ? Math.round(data.total/total*100) : 0
    const strPct = data.total > 0 ? Math.round(data.strikes/data.total*100) : 0
    page.drawText(`${type}`, { x:40, y, font:fontR, size:9, color:white })
    page.drawText(`${data.total} pitches · ${pct}% usage · ${strPct}% strikes`, { x:140, y, font:fontR, size:9, color:dimC })
    // Bar
    page.drawRectangle({ x:40, y:y-12, width:200, height:4, color:panel })
    page.drawRectangle({ x:40, y:y-12, width:pct*2, height:4, color:cyan })
    y -= 22
  })
  y -= 10

  // ── Batter breakdown ──
  page.drawText('BATTER BREAKDOWN', { x:40, y, font, size:10, color:cyan })
  page.drawLine({ start:{x:40,y:y-6}, end:{x:W-40,y:y-6}, color:dimC, thickness:0.5 })
  y -= 20

  // Column headers
  const cols = [[40,'BATTER'],[240,'PA'],[280,'K'],[320,'H'],[360,'OUT'],[400,'PITCHES']]
  cols.forEach(([x,h]) => page.drawText(h, { x, y, font:fontR, size:7, color:dimC }))
  y -= 14

  const batters = {}
  allPAs.forEach(pa => {
    if (!batters[pa.batter_name]) batters[pa.batter_name] = { pa:0, k:0, hit:0, out:0, pitches:0 }
    batters[pa.batter_name].pa++
    if (['CK','SK'].includes(pa.pa_result)) batters[pa.batter_name].k++
    else if (pa.pa_result === 'IP') {
      const ip = pa.outcome_inplay || ''
      if (['Single','Double','Triple','Home Run','Sac Fly'].includes(ip)) batters[pa.batter_name].hit++
      else batters[pa.batter_name].out++
    }
  })
  gamePitches.forEach(p => { if (batters[p.batter_name]) batters[p.batter_name].pitches++ })

  const batterList = Object.entries(batters).map(([name,s]) => {
    const player = oppLineup.find(p => p.name === name)
    return { name, ...s, order: player?.lineup_order ?? 99 }
  }).sort((a,b)=>a.order-b.order)

  batterList.forEach(b => {
    if (y < 80) return // don't overflow
    page.drawText(b.name.substring(0,22), { x:40, y, font:fontR, size:9, color:white })
    page.drawText(String(b.pa),      { x:240, y, font, size:9, color:gold })
    page.drawText(String(b.k),       { x:280, y, font, size:9, color:b.k>0?cyan:dimC })
    page.drawText(String(b.hit),     { x:320, y, font, size:9, color:b.hit>0?green:dimC })
    page.drawText(String(b.out),     { x:360, y, font, size:9, color:secC })
    page.drawText(String(b.pitches), { x:400, y, font, size:9, color:b.pitches>=8?red:dimC })
    y -= 16
  })
  y -= 10

  // ── Add second page for coaching takeaways ──
  if (y < 180) {
    const page2 = doc.addPage([W, H])
    page2.drawRectangle({ x:0, y:0, width:W, height:H, color:navy })

    let y2 = H - 50
    page2.drawText('COACHING TAKEAWAYS', { x:40, y:y2, font, size:14, color:cyan })
    page2.drawLine({ start:{x:40,y:y2-8}, end:{x:W-40,y:y2-8}, color:dimC, thickness:0.5 })
    y2 -= 30

    // Compute takeaways
    const zoneMap = {}
    for (let r=1;r<=3;r++) for (let c=1;c<=3;c++) zoneMap[`${r}-${c}`]={count:0,strikes:0}
    pitches.forEach(p => {
      if (p.pitch_zone && zoneMap[p.pitch_zone]) {
        zoneMap[p.pitch_zone].count++
        if (['CK','SK','F','IP'].includes(p.outcome_basic)) zoneMap[p.pitch_zone].strikes++
      }
    })
    const fps = 0 // simplified for PDF
    const takeaways = []
    if (strikeRate >= 65) takeaways.push(`Excellent command — ${strikeRate}% strike rate. Pitcher was consistently ahead in counts.`)
    else if (strikeRate >= 55) takeaways.push(`Solid control at ${strikeRate}% strikes. Sustain first-pitch strikes to reduce deep counts.`)
    else takeaways.push(`Strike rate was ${strikeRate}% — below target. Work on first-pitch strikes.`)

    const sorted = Object.entries(byType).sort((a,b)=>b[1].total-a[1].total)
    if (sorted.length > 0) {
      const [topType, topData] = sorted[0]
      const topStr = Math.round(topData.strikes/topData.total*100)
      takeaways.push(`${topType} was primary pitch (${topData.total} thrown, ${topStr}% strikes). ` +
        (topStr>=65 ? 'Very effective — lean on it in high-leverage counts.' : 'Mix secondary pitches to keep hitters off-balance.'))
    }

    const mostPitches = [...batterList].sort((a,b)=>b.pitches-a.pitches)[0]
    if (mostPitches && mostPitches.pitches >= 5) {
      takeaways.push(`${mostPitches.name} saw ${mostPitches.pitches} pitches — most of any batter. Plan a quicker approach next matchup.`)
    }

    takeaways.slice(0,3).forEach((tip, i) => {
      page2.drawRectangle({ x:40, y:y2-44, width:W-80, height:48, color:panel, borderColor:i===0?cyan:dimC, borderWidth:1 })
      page2.drawText(`0${i+1}`, { x:56, y:y2-22, font, size:18, color:i===0?cyan:dimC })
      // Word wrap simplified
      const words = tip.split(' ')
      let line = '', lineY = y2-18, lineX = 90
      words.forEach(word => {
        const test = line + word + ' '
        if (fontR.widthOfTextAtSize(test, 10) > W - 160) {
          page2.drawText(line.trim(), { x:lineX, y:lineY, font:fontR, size:10, color:white })
          line = word + ' '
          lineY -= 14
        } else {
          line = test
        }
      })
      if (line.trim()) page2.drawText(line.trim(), { x:lineX, y:lineY, font:fontR, size:10, color:white })
      y2 -= 60
    })

    // Footer
    page2.drawText(`Generated by Pitch Intelligence · ${date}`, { x:40, y:30, font:fontR, size:8, color:dimC })
  }

  // Footer on page 1
  page.drawText(`Generated by Pitch Intelligence · ${date}`, { x:40, y:30, font:fontR, size:8, color:dimC })

  // ── Download ──
  const pdfBytes = await doc.save()
  const blob = new Blob([pdfBytes], { type:'application/pdf' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `game-summary-${opponent.replace(/\s+/g,'-')}-${date.replace(/\s+/g,'-')}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
