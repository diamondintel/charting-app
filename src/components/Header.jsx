import styles from './Header.module.css'

export default function Header({ ourName, oppName, ourRuns, oppRuns, inning, topBottom, onScoreChange, onInningChange, pitcherName, pitchers, onPitcherChange, pitchCount }) {
  // Format pitcher as "A. Groover"
  const pitcherShort = pitcherName ? (() => {
    const parts = pitcherName.trim().split(' ')
    if (parts.length === 1) return parts[0]
    return parts[0][0] + '. ' + parts.slice(1).join(' ')
  })() : null
  return (
    <header className={styles.header}>
      {/* Logo */}
      <div className={styles.logoMark}>
        <div className={styles.logoRing} />
        <div className={styles.logoRing2} />
        <div className={styles.logoInner}>PI</div>
      </div>

      {/* Title */}
      <div className={styles.titleGroup}>
        <div className={styles.eyebrow}>SOFTBALL · COACHING SYSTEM</div>
        <div className={styles.title}>Pitch Intelligence Command Center</div>
      </div>

      {/* Pitcher — desktop full, mobile compact */}
      {pitcherName && (
        <div className={styles.pitcherWrap}>
          {pitchers?.length > 1 ? (
            <select
              className={styles.pitcherDropdown}
              value={pitchers.find(p => p.name === pitcherName)?.player_id || ''}
              onChange={e => onPitcherChange?.(e.target.value)}
            >
              {pitchers.map(p => (
                <option key={p.player_id} value={p.player_id}>⚾ #{p.jersey} {p.name}</option>
              ))}
            </select>
          ) : (
            <div className={styles.pitcherBadge}>
              <span className={styles.pitcherIcon}>⚾</span>
              <span className={styles.pitcherNameText}>
                <span className={styles.pitcherNameFull}>{pitcherName}</span>
                <span className={styles.pitcherNameShort}>{pitcherShort}</span>
              </span>
              {pitchCount > 0 && (
                <span className={styles.pitchCountBadge}>{pitchCount}P</span>
              )}
            </div>
          )}
        </div>
      )}

      <div className={styles.spacer} />

      {/* Scoreboard */}
      <div className={styles.scoreboard}>
        <div className={styles.teamScore}>
          <div className={styles.teamName}>{(ourName || 'US').slice(0, 10)}</div>
          <div className={`${styles.scoreNum} ${styles.our}`}>{ourRuns}</div>
          <div className={styles.scoreControls}>
            <button onClick={() => onScoreChange('our', -1)}>−</button>
            <button onClick={() => onScoreChange('our', +1)}>+</button>
          </div>
        </div>
        <div className={styles.scoreDivider}>—</div>
        <div className={styles.teamScore}>
          <div className={styles.teamName}>{(oppName || 'OPP').slice(0, 10)}</div>
          <div className={`${styles.scoreNum} ${styles.opp}`}>{oppRuns}</div>
          <div className={styles.scoreControls}>
            <button onClick={() => onScoreChange('opp', -1)}>−</button>
            <button onClick={() => onScoreChange('opp', +1)}>+</button>
          </div>
        </div>
        <div className={styles.inningBadge} onClick={onInningChange} title="Click to change inning/half" style={{cursor:'pointer'}}>
          <div className={styles.inningArrow} style={{ borderBottomColor: topBottom === 'top' ? '#00E5A0' : '#F5A623' }} />
          <div className={styles.inningNum}>{inning}</div>
          <div className={styles.inningLabel}>{topBottom === 'top' ? 'TOP' : 'BOT'}</div>
        </div>
      </div>

      {/* Live pill */}
      <div className={styles.livePill}>
        <div className={styles.liveDot} />
        LIVE
      </div>

      {/* Animated separator */}
      <div className={styles.separator} />
    </header>
  )
}
