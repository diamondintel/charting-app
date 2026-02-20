import styles from './RightPanel.module.css'

const REC_COLORS = ['var(--gold)', 'var(--cyan)', 'var(--text-secondary)']

export default function RightPanel({ recommendations, effectiveness, signals, pci, reverseSwitch, onApplyRec }) {
  const hasWarn = signals.some(s => s.type === 'warn')
  const topWarn = signals.find(s => s.type === 'warn')

  return (
    <div className={styles.panel}>

      {/* PCI Bar */}
      {pci && (
        <div className={styles.pciBar} data-band={pci.band}>
          <div className={styles.pciLeft}>
            <span className={styles.pciLabel}>PCI</span>
            <span className={styles.pciScore}>{pci.score}</span>
          </div>
          <div className={styles.pciRight}>
            <div className={styles.pciTrack}>
              <div className={styles.pciScoreFill} style={{ width: `${pci.score}%` }} />
            </div>
            <div className={styles.pciLabel2}>{pci.label}</div>
          </div>
        </div>
      )}

      {/* Reverse Switch Alert */}
      {reverseSwitch?.active && (
        <div className={`${styles.reverseAlert} ${reverseSwitch.type === 'reverse' ? styles.reverseHot : styles.reverseStd}`}>
          <div className={styles.reverseIcon}>{reverseSwitch.type === 'reverse' ? '⟲' : '→'}</div>
          <div>
            <div className={styles.reverseTitle}>
              {reverseSwitch.type === 'reverse' ? 'REVERSE SWITCH' : 'COUNT STRATEGY'}
            </div>
            <div className={styles.reverseText}>{reverseSwitch.rationale}</div>
            {reverseSwitch.avoid?.length > 0 && (
              <div className={styles.reverseAvoid}>AVOID: {reverseSwitch.avoid.join(' · ')}</div>
            )}
          </div>
        </div>
      )}

      {/* Top signal */}
      {hasWarn && !reverseSwitch?.active && (
        <div className={styles.predWarning}>
          <div className={styles.predIcon}>⚠</div>
          <div>
            <div className={styles.predTitle}>SITUATION ALERT</div>
            <div className={styles.predText}>{topWarn.text}</div>
          </div>
        </div>
      )}

      {/* AI Recommendations */}
      <div className={styles.aiSection}>
        <div className="section-label">AI RECOMMENDATION ENGINE</div>

        {recommendations.length === 0 && (
          <div className={styles.noRecs}>
            Record pitches to generate recommendations
          </div>
        )}

        {recommendations.map((rec, i) => {
          const color = REC_COLORS[i] || 'var(--text-dim)'
          return (
            <div
              key={i}
              className={`${styles.recCard} ${i === 0 ? styles.rank1 : ''}`}
              style={{ '--rec-color': color, '--rec-pct': `${rec.confidence}%` }}
              onClick={() => onApplyRec?.(rec)}
            >
              <div className={styles.recHeader}>
                <div className={styles.recRank}>0{i + 1}</div>
                <div className={styles.recInfo}>
                  <div className={styles.recPitch}>{rec.pitch}</div>
                  <div className={styles.recZone}>{rec.zoneName} ZONE {rec.zone?.replace('-','•')}</div>
                </div>
                <div className={styles.recConfWrap}>
                  <div className={styles.recConfPct} style={{ color }}>{rec.confidence}%</div>
                  <div className={styles.recConfLabel}>CONFIDENCE</div>
                </div>
              </div>
              <div className={styles.recBar}>
                <div className={styles.recBarFill} />
              </div>
              <div className={styles.recReasons}>
                {(rec.reasons || []).map((r, j) => (
                  <div key={j} className={styles.recReason}>{r}</div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Effectiveness gauges */}
      {effectiveness.length > 0 && (
        <div className={styles.effSection}>
          <div className="section-label">PITCH EFFECTIVENESS · THIS GAME</div>
          <div className={styles.effGauges}>
            {effectiveness.slice(0, 4).map((e, i) => {
              const colors = ['var(--cyan)', 'var(--gold)', 'var(--green)', 'var(--amber)']
              const color = colors[i] || 'var(--text-secondary)'
              return (
                <div key={e.type} className={styles.effGauge} style={{ '--eff-color': color, '--eff-pct': `${e.pct}%` }}>
                  <div className={styles.effName}>{e.type.slice(0,8).toUpperCase()}</div>
                  <div className={styles.effBarWrap}>
                    <div className={styles.effBarFill} />
                  </div>
                  <div className={styles.effPct}>{e.pct}%</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
