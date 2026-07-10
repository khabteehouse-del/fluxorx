'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import AppShell from '@/components/app-shell'
import { createClient } from '@/lib/supabase/client'

type Batch = {
  id: string
  file_name: string
  row_count: number
  created_at: string
}

type Severity = 'critical' | 'warning' | 'info'

type Issue = {
  rule: string
  severity: Severity
  message: string
  rowIndex: number
  ref: string
}

type Group = {
  rule: string
  title: string
  severity: Severity
  description: string
  issues: Issue[]
}

type Result = {
  total: number
  valid: number
  warnings: number
  critical: number
  infos: number
  score: number
  groups: Group[]
}

const RULE_META: Record<string, { title: string; description: string }> = {
  negative_contract: { title: 'Negative contract value', description: 'A contract value below zero is not possible and points to a data-entry error.' },
  overpayment: { title: 'Payment exceeds contract', description: 'The amount paid is greater than the contract value, which should not happen.' },
  missing_customer: { title: 'Missing customer name', description: 'These rows have no customer, so they cannot be attributed.' },
  missing_city: { title: 'Missing city', description: 'Location is blank, which weakens any city-level reporting.' },
  duplicate_id: { title: 'Duplicate project ID', description: 'The same project ID appears more than once, risking double counting.' },
  city_misspelling: { title: 'Possible city misspelling', description: 'A city looks like a misspelled version of a known city.' },
  completed_no_date: { title: 'Completed without install date', description: 'Marked completed but missing an install date.' },
  city_casing: { title: 'Inconsistent city spelling', description: 'The same city is written with different casing across rows.' },
  missing_paid: { title: 'Missing amount paid', description: 'Payment amount is blank.' },
}

const ORDER: Severity[] = ['critical', 'warning', 'info']

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const s = String(v).replace(/[, ]/g, '').trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isNaN(n) ? null : n
}

function lev(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) d[i][0] = i
  for (let j = 0; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c)
    }
  return d[m][n]
}

function validate(headers: string[], rows: Record<string, unknown>[]): Result {
  const has = (h: string) => headers.includes(h)
  const issues: Issue[] = []
  const pidOf = (r: Record<string, unknown>) =>
    has('Project ID') ? String(r['Project ID'] ?? '').trim() : ''
  const add = (rule: string, severity: Severity, message: string, i: number, r: Record<string, unknown>) => {
    const pid = pidOf(r)
    issues.push({ rule, severity, message, rowIndex: i, ref: pid ? `Row ${i + 1} · ${pid}` : `Row ${i + 1}` })
  }

  if (has('Customer Name'))
    rows.forEach((r, i) => {
      if (String(r['Customer Name'] ?? '').trim() === '')
        add('missing_customer', 'warning', 'Customer name is blank', i, r)
    })

  if (has('Contract Value (PKR)'))
    rows.forEach((r, i) => {
      const cv = num(r['Contract Value (PKR)'])
      if (cv !== null && cv < 0)
        add('negative_contract', 'critical', `Contract value is negative (${cv})`, i, r)
    })

  if (has('Contract Value (PKR)') && has('Amount Paid (PKR)'))
    rows.forEach((r, i) => {
      const cv = num(r['Contract Value (PKR)'])
      const ap = num(r['Amount Paid (PKR)'])
      if (cv !== null && ap !== null && cv >= 0 && ap > cv)
        add('overpayment', 'warning', `Amount paid (${ap}) exceeds contract value (${cv})`, i, r)
    })

  if (has('Project ID')) {
    const map: Record<string, number[]> = {}
    rows.forEach((r, i) => {
      const id = String(r['Project ID'] ?? '').trim()
      if (id === '') return
      ;(map[id] = map[id] || []).push(i)
    })
    Object.entries(map).forEach(([id, idxs]) => {
      if (idxs.length > 1)
        idxs.forEach((i) => add('duplicate_id', 'warning', `Project ID "${id}" is used ${idxs.length} times`, i, rows[i]))
    })
  }

  if (has('Stage') && has('Install Date'))
    rows.forEach((r, i) => {
      const st = String(r['Stage'] ?? '').trim().toLowerCase()
      const d = String(r['Install Date'] ?? '').trim()
      if (st === 'completed' && d === '')
        add('completed_no_date', 'warning', 'Marked Completed but has no install date', i, r)
    })

  if (has('Amount Paid (PKR)'))
    rows.forEach((r, i) => {
      if (String(r['Amount Paid (PKR)'] ?? '').trim() === '')
        add('missing_paid', 'info', 'Amount paid is blank', i, r)
    })

  if (has('City')) {
    const cells = rows.map((r, i) => ({ i, raw: String(r['City'] ?? '').trim() }))
    cells.forEach(({ i, raw }) => {
      if (raw === '') add('missing_city', 'warning', 'City is blank', i, rows[i])
    })
    const nonEmpty = cells.filter((c) => c.raw !== '')
    const lowerFreq: Record<string, number> = {}
    const origFreq: Record<string, number> = {}
    nonEmpty.forEach((c) => {
      const k = c.raw.toLowerCase()
      lowerFreq[k] = (lowerFreq[k] || 0) + 1
      origFreq[c.raw] = (origFreq[c.raw] || 0) + 1
    })
    const canonical: Record<string, string> = {}
    Object.keys(lowerFreq).forEach((lk) => {
      let best = ''
      let bestF = -1
      nonEmpty.forEach((c) => {
        if (c.raw.toLowerCase() === lk && origFreq[c.raw] > bestF) {
          bestF = origFreq[c.raw]
          best = c.raw
        }
      })
      canonical[lk] = best
    })
    const frequent = Object.keys(lowerFreq).filter((k) => lowerFreq[k] >= 2)
    nonEmpty.forEach(({ i, raw }) => {
      const lk = raw.toLowerCase()
      const canon = canonical[lk]
      if (canon && raw !== canon) {
        add('city_casing', 'info', `"${raw}" should likely be "${canon}"`, i, rows[i])
      }
      if (!frequent.includes(lk)) {
        let match = ''
        for (const fl of frequent) {
          if (Math.abs(fl.length - lk.length) <= 2 && lev(fl, lk) <= 2) {
            match = fl
            break
          }
        }
        if (match) add('city_misspelling', 'warning', `"${raw}" may be a misspelling of "${canonical[match]}"`, i, rows[i])
      }
    })
  }

  const affected = new Set(issues.map((x) => x.rowIndex))
  const total = rows.length
  const valid = total - affected.size
  const critical = issues.filter((x) => x.severity === 'critical').length
  const warnings = issues.filter((x) => x.severity === 'warning').length
  const infos = issues.filter((x) => x.severity === 'info').length
  const score = Math.max(
    0,
    Math.round((total === 0 ? 1 : valid / total) * 100) - critical * 5
  )

  const byRule: Record<string, Issue[]> = {}
  issues.forEach((is) => (byRule[is.rule] = byRule[is.rule] || []).push(is))
  const groups: Group[] = Object.entries(byRule)
    .map(([rule, list]) => ({
      rule,
      title: RULE_META[rule]?.title ?? rule,
      description: RULE_META[rule]?.description ?? '',
      severity: list[0].severity,
      issues: list,
    }))
    .sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity))

  return { total, valid, warnings, critical, infos, score, groups }
}

const SEV_COLOR: Record<Severity, string> = {
  critical: '#FF6B6B',
  warning: '#FFB347',
  info: '#6FB7FF',
}

function scoreBand(score: number) {
  if (score >= 85) return { label: 'Good', color: '#3FB984' }
  if (score >= 60) return { label: 'Fair', color: '#FFB347' }
  return { label: 'Needs attention', color: '#FF6B6B' }
}

export default function ValidationPage() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [batches, setBatches] = useState<Batch[]>([])
  const [selected, setSelected] = useState<Batch | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [headers, setHeaders] = useState<string[]>([])
  const [allRows, setAllRows] = useState<Record<string, unknown>[]>([])
  const [hoveredRef, setHoveredRef] = useState<string | null>(null)

  const persist = useCallback(
    async (batch: Batch, res: Result) => {
      if (!orgId) return
      const supabase = createClient()
      try {
        await supabase.from('validation_reports').delete().eq('raw_upload_id', batch.id)
        const { data: rep } = await supabase
          .from('validation_reports')
          .insert({
            organization_id: orgId,
            raw_upload_id: batch.id,
            total_records: res.total,
            valid_records: res.valid,
            warnings: res.warnings,
            critical_errors: res.critical,
            readiness_score: res.score,
          })
          .select('id')
          .single()
        if (rep) {
          const rowsToInsert = res.groups.flatMap((g) =>
            g.issues.map((is) => ({
              organization_id: orgId,
              validation_report_id: rep.id,
              severity: is.severity,
              rule: is.rule,
              message: is.message,
              record_ref: is.ref,
            }))
          )
          if (rowsToInsert.length) await supabase.from('validation_issues').insert(rowsToInsert)
        }
      } catch {
        /* persistence is best-effort; the report still shows */
      }
    },
    [orgId]
  )

  const runFor = useCallback(
    async (batch: Batch) => {
      setSelected(batch)
      setBusy(true)
      setResult(null)
      setOpen({})
      setHoveredRef(null)
      setHeaders([])
      setAllRows([])
      const supabase = createClient()
      const { data: tbl } = await supabase
        .from('raw_tables')
        .select('id, column_headers')
        .eq('raw_upload_id', batch.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (!tbl) {
        setResult({ total: 0, valid: 0, warnings: 0, critical: 0, infos: 0, score: 0, groups: [] })
        setBusy(false)
        return
      }
      const hdrs = (tbl.column_headers ?? []) as string[]
      const { data: recs } = await supabase
        .from('raw_records')
        .select('data')
        .eq('raw_table_id', tbl.id)
        .order('row_index')
        .range(0, 4999)
      const rows = (recs ?? []).map((r) => (r.data ?? {}) as Record<string, unknown>)
      setHeaders(hdrs)
      setAllRows(rows)
      const res = validate(hdrs, rows)
      setResult(res)
      setBusy(false)
      persist(batch, res)
    },
    [persist]
  )

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', data.user.id)
          .single()
        if (prof?.organization_id) setOrgId(prof.organization_id)
      }
      const { data: ups } = await supabase
        .from('raw_uploads')
        .select('id, file_name, row_count, created_at')
        .order('created_at', { ascending: false })
      const list = (ups ?? []) as Batch[]
      setBatches(list)
      if (list.length) await runFor(list[0])
      setReady(true)
    })
  }, [runFor])

  const band = result ? scoreBand(result.score) : null

  return (
    <AppShell title="Validation">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              Data validation
            </h2>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[#9AA4B4]">
              FluxorX scans every row and reports what needs attention, in plain
              language.
            </p>
          </div>
          {batches.length > 0 && (
            <select
              value={selected?.id ?? ''}
              onChange={(e) => {
                const b = batches.find((x) => x.id === e.target.value)
                if (b) runFor(b)
              }}
              className="rounded-lg border border-white/12 bg-[#0B0F15] px-3 py-2 text-sm text-[#C2CAD8] outline-none focus:border-[#FFB347]/50"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.file_name}
                </option>
              ))}
            </select>
          )}
        </div>

        {ready && batches.length === 0 && (
          <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-10 text-center">
            <div className="font-display text-lg font-semibold">Nothing to validate yet</div>
            <p className="mt-1.5 text-sm text-[#9AA4B4]">Upload a spreadsheet first.</p>
            <Link
              href="/upload"
              style={{ backgroundImage: 'linear-gradient(to right, #FFB347, #FF7A3D)' }}
              className="mt-5 inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold text-[#1A0E03]"
            >
              Go to Data upload
            </Link>
          </div>
        )}

        {busy && (
          <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-12 text-center font-mono text-xs tracking-widest text-[#566174]">
            SCANNING ROWS...
          </div>
        )}

        {!busy && result && band && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            {/* Score card */}
            <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
              <div
                className="flex h-32 w-32 flex-col items-center justify-center rounded-2xl border"
                style={{ borderColor: `${band.color}55`, backgroundColor: `${band.color}12` }}
              >
                <div className="font-display text-4xl font-semibold" style={{ color: band.color }}>
                  {result.score}
                </div>
                <div className="font-mono text-[10px] tracking-widest text-[#9AA4B4]">/ 100</div>
                <div className="mt-1 text-xs font-medium" style={{ color: band.color }}>
                  {band.label}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Rows" value={result.total} />
                <Metric label="Clean" value={result.valid} color="#3FB984" />
                <Metric label="Warnings" value={result.warnings} color="#FFB347" />
                <Metric label="Critical" value={result.critical} color="#FF6B6B" />
              </div>
            </div>

            {/* Issues */}
            {result.groups.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-[#3FB984]/35 bg-[#3FB984]/[0.07] p-6 text-sm text-[#BFE9D4]">
                No issues found. This data is clean and ready.
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                <div className="font-mono text-[11px] tracking-widest text-[#79839A]">
                  {result.groups.length} ISSUE TYPES FOUND
                </div>
                {result.groups.map((g) => {
                  const isOpen = open[g.rule]
                  const color = SEV_COLOR[g.severity]
                  return (
                    <div key={g.rule} className="overflow-hidden rounded-2xl border border-white/12 bg-white/[0.03]">
                      <button
                        onClick={() => setOpen((s) => ({ ...s, [g.rule]: !s[g.rule] }))}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.03]"
                      >
                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-display text-sm font-semibold text-[#EDF1F6]">{g.title}</span>
                            <span
                              className="rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wider"
                              style={{ backgroundColor: `${color}1F`, color }}
                            >
                              {g.issues.length} {g.issues.length === 1 ? 'ROW' : 'ROWS'}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate text-xs text-[#79839A]">{g.description}</div>
                        </div>
                        <span className={`text-[#566174] transition ${isOpen ? 'rotate-180' : ''}`}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </button>
                      {isOpen && (
                        <div className="border-t border-white/[0.08] px-4 py-2">
                          {g.issues.map((is, k) => {
                            const isHovered = hoveredRef === `${g.rule}-${k}`
                            const rowData = allRows[is.rowIndex]
                            return (
                              <motion.div
                                key={k}
                                initial={{ opacity: 0, scale: 0.92, y: -6 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{
                                  type: 'spring',
                                  stiffness: 420,
                                  damping: 18,
                                  mass: 0.7,
                                  delay: k * 0.045,
                                }}
                                className="border-b border-white/[0.05] last:border-0"
                              >
                                {/* Row reference label */}
                                <div
                                  className="flex cursor-pointer flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between"
                                  onMouseEnter={() => setHoveredRef(`${g.rule}-${k}`)}
                                  onMouseLeave={() => setHoveredRef(null)}
                                  onTouchStart={() =>
                                    setHoveredRef((prev) =>
                                      prev === `${g.rule}-${k}` ? null : `${g.rule}-${k}`
                                    )
                                  }
                                >
                                  <span className="font-mono text-[11px] tracking-wider text-[#8B95A6] underline decoration-dotted underline-offset-2">
                                    {is.ref}
                                  </span>
                                  <span className="text-xs text-[#AEB7C6]">{is.message}</span>
                                </div>

                                {/* Inline breathing record card */}
                                {isHovered && rowData && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                                    transition={{ type: 'spring', stiffness: 380, damping: 22, mass: 0.6 }}
                                    className="relative mb-3 overflow-hidden rounded-xl border border-white/15 bg-[#0A0F18]"
                                  >
                                    {/* Ambient breathing glow */}
                                    <motion.div
                                      aria-hidden
                                      className="pointer-events-none absolute inset-0 rounded-xl"
                                      style={{
                                        background: `radial-gradient(ellipse at 50% 0%, ${SEV_COLOR[is.severity]}28 0%, transparent 68%)`,
                                      }}
                                      animate={{ opacity: [0.5, 1, 0.5] }}
                                      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                                    />
                                    {/* Top severity bar */}
                                    <div
                                      className="h-0.5 w-full"
                                      style={{ backgroundColor: SEV_COLOR[is.severity] }}
                                    />
                                    <div className="relative px-4 py-3">
                                      <div className="mb-2.5 flex items-center gap-2">
                                        <span
                                          className="h-1.5 w-1.5 rounded-full"
                                          style={{ backgroundColor: SEV_COLOR[is.severity] }}
                                        />
                                        <span className="font-mono text-[10px] tracking-widest" style={{ color: SEV_COLOR[is.severity] }}>
                                          {is.severity.toUpperCase()} · {is.ref}
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
                                        {headers.map((h) => {
                                          const val = rowData[h]
                                          const txt = val === null || val === undefined || val === '' ? '' : String(val)
                                          const isProblematic =
                                            txt === '' ||
                                            (h === 'Contract Value (PKR)' && Number(txt.replace(/,/g, '')) < 0) ||
                                            (h === 'City' && (txt.toLowerCase() !== txt.toLowerCase().trim() || txt === ''))
                                          return (
                                            <div key={h} className="min-w-0">
                                              <div className="font-mono text-[9px] tracking-wider text-[#566174]">{h.toUpperCase()}</div>
                                              <div
                                                className={`mt-0.5 truncate text-xs font-medium ${
                                                  isProblematic && txt === ''
                                                    ? 'italic text-[#5A6678]'
                                                    : isProblematic
                                                    ? 'text-[#FFB347]'
                                                    : 'text-[#C2CAD8]'
                                                }`}
                                                title={txt}
                                              >
                                                {txt === '' ? 'empty' : txt}
                                              </div>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </motion.div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/raw"
                className="rounded-xl border border-white/12 bg-white/[0.04] px-5 py-2.5 text-center text-sm font-medium text-[#C2CAD8] transition hover:bg-white/[0.07]"
              >
                Back to raw data
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </AppShell>
  )
}

function Metric({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border border-white/12 bg-white/[0.04] p-4">
      <div className="font-mono text-[10px] tracking-widest text-[#79839A]">{label.toUpperCase()}</div>
      <div className="mt-1 font-display text-2xl font-semibold" style={{ color: color ?? '#EDF1F6' }}>
        {value}
      </div>
    </div>
  )
}
