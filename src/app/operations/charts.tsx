'use client'

import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from 'recharts'

type StageData = { stage: string; value: number; count: number }
type TrendData = { label: string; contract: number; paid: number }

const GLOW_AMBER = '#FFB347'
const GLOW_CYAN = '#36D1FF'

const STAGE_COLOR: Record<string, string> = {
  Lead: '#6FB7FF', Quoted: '#A78BFA',
  'In Progress': '#FFB347', Delayed: '#FF6B6B', Completed: '#3FB984',
}

function pkr(n: number) {
  if (n >= 1_000_000_000) return `₨${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `₨${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `₨${(n / 1_000).toFixed(0)}K`
  return `₨${n}`
}

const GlowDefs = () => (
  <defs>
    <filter id="glow-amber" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feFlood floodColor={GLOW_AMBER} floodOpacity="0.6" result="color" />
      <feComposite in="color" in2="blur" operator="in" result="glow" />
      <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
    <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feFlood floodColor={GLOW_CYAN} floodOpacity="0.5" result="color" />
      <feComposite in="color" in2="blur" operator="in" result="glow" />
      <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
    <linearGradient id="grad-amber" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={GLOW_AMBER} stopOpacity="0.35" />
      <stop offset="100%" stopColor={GLOW_AMBER} stopOpacity="0.02" />
    </linearGradient>
    <linearGradient id="grad-cyan" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={GLOW_CYAN} stopOpacity="0.28" />
      <stop offset="100%" stopColor={GLOW_CYAN} stopOpacity="0.02" />
    </linearGradient>
  </defs>
)

const Tip = ({ active, payload, label, fmt }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
  fmt?: (n: number) => string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/15 bg-[#0D1117] px-3 py-2 shadow-xl">
      <div className="mb-1 font-mono text-[10px] tracking-wider text-[#79839A]">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-[#9AA4B4]">{p.name}:</span>
          <span className="font-semibold text-[#EDF1F6]">{fmt ? fmt(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

export function TrendChart({ data }: { data: TrendData[] }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-5">
      <div className="mb-1 font-display text-sm font-semibold">Contract vs Collected</div>
      <div className="mb-4 font-mono text-[10px] tracking-wider text-[#79839A]">BY PIPELINE STAGE · PKR</div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <GlowDefs />
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="label" tick={{ fill: '#566174', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={pkr} tick={{ fill: '#566174', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={52} />
          <Tooltip content={<Tip fmt={pkr} />} />
          <Area type="monotone" dataKey="contract" name="Contract" stroke={GLOW_AMBER} strokeWidth={2.5}
            fill="url(#grad-amber)" dot={{ fill: GLOW_AMBER, r: 3, filter: 'url(#glow-amber)' }}
            activeDot={{ r: 5, filter: 'url(#glow-amber)' }} filter="url(#glow-amber)" />
          <Area type="monotone" dataKey="paid" name="Collected" stroke={GLOW_CYAN} strokeWidth={2.5}
            fill="url(#grad-cyan)" dot={{ fill: GLOW_CYAN, r: 3, filter: 'url(#glow-cyan)' }}
            activeDot={{ r: 5, filter: 'url(#glow-cyan)' }} filter="url(#glow-cyan)" />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-3 flex gap-5">
        {[['Contract value', GLOW_AMBER], ['Amount collected', GLOW_CYAN]].map(([label, color]) => (
          <div key={label} className="flex items-center gap-1.5 text-[11px] text-[#9AA4B4]">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}

export function StageChart({ data }: { data: StageData[] }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-5">
      <div className="mb-1 font-display text-sm font-semibold">Projects by Stage</div>
      <div className="mb-4 font-mono text-[10px] tracking-wider text-[#79839A]">CONTRACT VALUE · PKR</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barSize={28}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="stage" tick={{ fill: '#566174', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={pkr} tick={{ fill: '#566174', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={52} />
          <Tooltip content={({ active, payload, label }) =>
            active && payload?.length ? (
              <div className="rounded-xl border border-white/15 bg-[#0D1117] px-3 py-2 shadow-xl">
                <div className="mb-1 font-mono text-[10px] tracking-wider text-[#79839A]">{label}</div>
                <div className="text-xs text-[#9AA4B4]">Value: <span className="font-semibold text-[#EDF1F6]">{pkr(payload[0].value as number)}</span></div>
                <div className="text-xs text-[#9AA4B4]">Projects: <span className="font-semibold text-[#EDF1F6]">{data.find(s => s.stage === label)?.count}</span></div>
              </div>
            ) : null
          } />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.stage} fill={STAGE_COLOR[entry.stage] ?? '#6FB7FF'} opacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap gap-3">
        {data.map((s) => (
          <div key={s.stage} className="flex items-center gap-1.5 text-[11px] text-[#9AA4B4]">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STAGE_COLOR[s.stage] ?? '#6FB7FF' }} />
            {s.stage} ({s.count})
          </div>
        ))}
      </div>
    </div>
  )
}
