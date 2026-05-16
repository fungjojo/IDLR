import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import styles from './HRChart.module.css'

interface HRChartProps {
  hrStream: number[]
  durationSeconds: number
}

export default function HRChart({ hrStream, durationSeconds }: HRChartProps) {
  const data = hrStream.map((bpm, i) => ({
    t: Math.round((i / Math.max(hrStream.length - 1, 1)) * (durationSeconds / 60) * 10) / 10,
    bpm,
  }))

  return (
    <div className={styles.container}>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="t"
            unit=" min"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={['auto', 'auto']}
            unit=" bpm"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip
            contentStyle={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              fontSize: 12,
            }}
            formatter={(v) => [`${v as number} bpm`, 'HR']}
            labelFormatter={(l) => `${l as number} min`}
          />
          <Line
            type="monotone"
            dataKey="bpm"
            stroke="#dc2626"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#dc2626' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
