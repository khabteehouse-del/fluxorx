'use client'

import { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import AppShell from '@/components/app-shell'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'

// Recharts only loads when this page is actually opened
const TrendChart = dynamic(() => import('./charts').then(m => ({ default: m.TrendChart })), { ssr: false, loading: () => <ChartSkeleton /> })
const StageChart = dynamic(() => import('./charts').then(m => ({ default: m.StageChart })), { ssr: false, loading: () => <ChartSkeleton /> })

const GLOW_AMBER = '#FFB347'
const GLOW_CYAN = '#36D1FF'
const STAGE_ORDER = ['Lead', 'Quoted', 'In Progress', 'Delayed', 'Completed']

function pkr(n: number) {
  if (n >= 1_000_000_000) return `₨${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `₨${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `₨${(n / 1_000).toFixed(0)}K`
  return `₨${n}`
}
function num(v: unknown): number {
  const s = String(v ?? '').replace(/[, ]/g, '').trim()
  const n = Number(s)
  return Number.isNaN(n) ? 0 : Math.max(0, n)
}

function ChartSkeleton() {
  return <div className="h-[298px] animate-pulse rounded-2xl border border-white/12 bg-white/[0.03]" />
}

type RawRow = Record<string, unknown>

export default function SolarDashboard() {
  const [rows, setRows] = useState<RawRow[]>([])
  const [healthScore, setHealthScore] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    async function load() {
      const { data: upload } = await supabase
        .from('raw_uploads')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!upload || cancelled) { setLoading(false); return }

      const [tblRes, vrRes] = await Promise.all([
        supabase.from('raw_tables').select('id').eq('raw_upload_id', upload.id).limit(1).maybeSingle(),
        supabase.from('validation_reports').select('readiness_score').eq('raw_upload_id', upload.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      if (!tblRes.data || cancelled) { setLoading(false); return }

      const { data: recs } = await supabase
        .from('raw_records').select('data')
        .eq('raw_table_id', tblRes.data.id)
        .order('row_index').range(0, 4999)

      if (cancelled) return
      setRows((recs ?? []).map(r => (r.data ?? {}) as RawRow))
      if (vrRes.data?.readiness_score != null) setHealthScore(Number(vrRes.data.readiness_score))
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  // All heavy transforms memoized — only recompute when rows change
  const { kpis, stageData, trendData, salesData } = useMemo(() => {
    if (!rows.length) return { kpis: null, stageData: [], trendData: [], salesData: [] }

    const totalContract = rows.reduce((s, r) => s + num(r['Contract Value (PKR)']), 0)
    const totalPaid = rows.reduce((s, r) => s + num(r['Amount Paid (PKR)']), 0)
    const collectionRate = totalContract > 0 ? Math.round((totalPaid / totalContract) * 100) : 0
    const activeProjects = rows.filter(r => ['In Progress', 'Delayed'].includes(String(r['Stage'] ?? '').trim())).length
    const totalKw = rows.reduce((s, r) => s + num(r['System Size (kW)']), 0)

    const stageMap: Record<string, { value: number; count: number; paid: number }> = {}
    const salesMap: Record<string, { value: number; count: number }> = {}
    rows.forEach(r => {
      const stage = String(r['Stage'] ?? '').trim()
      const salesperson = String(r['Salesperson'] ?? '').trim()
      const contract = num(r['Contract Value (PKR)'])
      const paid = num(r['Amount Paid (PKR)'])
      if (stage) {
        stageMap[stage] = stageMap[stage] ?? { value: 0, count: 0, paid: 0 }
        stageMap[stage].value += contract
        stageMap[stage].count++
        stageMap[stage].paid += paid
      }
      if (salesperson) {
        salesMap[salesperson] = salesMap[salesperson] ?? { value: 0, count: 0 }
        salesMap[salesperson].value += contract
        salesMap[salesperson].count++
      }
    })

    return {
      kpis: { totalContract, totalPaid, collectionRate, activeProjects, totalProjects: rows.length, totalKw },
      stageData: STAGE_ORDER.filter(s => stageMap[s]).map(s => ({ stage: s, value: stageMap[s].value, count: stageMap[s].count })),
      trendData: STAGE_ORDER.filter(s => stageMap[s]).map(s => ({ label: s, contract: stageMap[s].value, paid: stageMap[s].paid })),
      salesData: Object.entries(salesMap).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.value - a.value).slice(0, 5),
    }
  }, [rows])

  const healthColor = healthScore == null ? '#79839A' : healthScore >= 85 ? '#3FB984' : healthScore >= 60 ? '#FFB347' : '#FF6B6B'

  if (loading) {
    return (
      <AppShell title="Dashboard">
        <div className="mx-auto max-w-6xl space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl border border-white/12 bg-white/[0.04]" />
            ))}
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartSkeleton /><ChartSkeleton />
          </div>
        </div>
      </AppShell>
    )
  }

  if (!kpis) {
    return (
      <AppShell title="Dashboard">
        <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-10 text-center">
          <div className="font-display text-lg font-semibold">No data yet</div>
          <p className="mt-1.5 text-sm text-[#9AA4B4]">Upload a spreadsheet to power the dashboard.</p>
        </div>
      </AppShell>
    )
  }

  const tiles = [
    { label: 'Total Contract', value: pkr(kpis.totalContract), sub: `${kpis.totalProjects} projects` },
    { label: 'Collected', value: pkr(kpis.totalPaid) },
    { label: 'Collection Rate', value: `${kpis.collectionRate}%`, color: kpis.collectionRate >= 70 ? '#3FB984' : '#FFB347' },
    { label: 'Active Projects', value: String(kpis.activeProjects), sub: 'in progress / delayed' },
    { label: 'Total Capacity', value: `${kpis.totalKw.toLocaleString()} kW` },
    { label: 'Data Health', value: healthScore != null ? `${healthScore}/100` : '—', color: healthColor },
  ]

  return (
    <AppShell title="Dashboard">
      <div className="mx-auto max-w-6xl space-y-5">

        {/* KPI tiles */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {tiles.map((tile, i) => (
            <motion.div
              key={tile.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.05, ease: 'easeOut' }}
              className="rounded-2xl border border-white/12 bg-white/[0.04] p-4"
            >
              <div className="font-mono text-[9px] tracking-widest text-[#79839A]">{tile.label.toUpperCase()}</div>
              <div className="mt-1.5 font-display text-xl font-semibold leading-none" style={{ color: tile.color ?? '#EDF1F6' }}>
                {tile.value}
              </div>
              {tile.sub && <div className="mt-1 text-[11px] text-[#566174]">{tile.sub}</div>}
            </motion.div>
          ))}
        </div>

        {/* Charts — loaded lazily, Recharts bundle only hits here */}
        <div className="grid gap-5 lg:grid-cols-2">
          <TrendChart data={trendData} />
          <StageChart data={stageData} />
        </div>

        {/* Salesperson leaderboard */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="rounded-2xl border border-white/12 bg-white/[0.03] p-5"
        >
          <div className="mb-1 font-display text-sm font-semibold">Salesperson Leaderboard</div>
          <div className="mb-5 font-mono text-[10px] tracking-wider text-[#79839A]">TOP 5 BY CONTRACT VALUE</div>
          <div className="space-y-3">
            {salesData.map((s, i) => {
              const pct = salesData[0]?.value > 0 ? (s.value / salesData[0].value) * 100 : 0
              return (
                <div key={s.name} className="flex items-center gap-4">
                  <div className="w-4 font-mono text-[11px] text-[#566174]">{i + 1}</div>
                  <div className="w-32 truncate text-sm font-medium text-[#C2CAD8]">{s.name}</div>
                  <div className="flex-1">
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundImage: `linear-gradient(to right, ${GLOW_AMBER}, ${GLOW_CYAN})`, boxShadow: `0 0 8px ${GLOW_AMBER}66` }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: 0.4 + i * 0.07, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                  <div className="w-20 text-right font-mono text-xs text-[#9AA4B4]">{pkr(s.value)}</div>
                  <div className="w-10 text-right font-mono text-[11px] text-[#566174]">{s.count}p</div>
                </div>
              )
            })}
          </div>
        </motion.div>

      </div>
    </AppShell>
  )
}
