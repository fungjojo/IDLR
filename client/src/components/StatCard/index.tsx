import type { CSSProperties } from 'react'
import styles from './StatCard.module.css'

interface StatCardProps {
  label: string
  value: string
  accentColor?: string
}

export default function StatCard({ label, value, accentColor }: StatCardProps) {
  const style = accentColor ? ({ '--accent': accentColor } as CSSProperties) : undefined

  return (
    <div className={styles.card} style={style}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </div>
  )
}
