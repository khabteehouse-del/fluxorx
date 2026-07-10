'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AppShell from '@/components/app-shell'
import { createClient } from '@/lib/supabase/client'
import { auditLog } from '@/lib/audit'

type Priority = 'critical' | 'warning' | 'info'

type EmailJob = {
  id: string
  title: string
  summary: string
  meta: string
  priority: Priority
  rows: Record<string, string>[]
  headers: string[]
  status: 'ready' | 'sending' | 'sent' | 'error'
  sentAt?: string
  error?: string
}

const PRIORITY_COLOR: Record<Priority, string> = {
  critical: '#FF6B6B',
  warning:  '#FFB347',
  info:     '#6FB7FF',
}

function num(v: unknown): number {
  const s = String(v ?? '').replace(/[, ]/g, '').trim()
  const n = Number(s)
  return Number.isNaN(n) ? 0 : Math.max(0, n)
}
function pkr(n: number) {
  if (n >= 1_000_000) return `₨${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `₨${(n / 1_000).toFixed(0)}K`
  return `₨${n}`
}

export default function LiveEmailPage() {
  const [jobs, setJobs] = useState<EmailJob[]>([])
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<string | null>(null)

  const buildJobs = useCallback(async () => {
    const supabase = createClient()
    const emailJobs: EmailJob[] = []

    const { data: upload } = await supabase
      .from('raw_uploads').select('id, file_name')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()

    if (!upload) { setLoading(false); return }

    const { data: tbl } = await supabase
      .from('raw_tables').select('id, column_headers')
      .eq('raw_upload_id', upload.id).limit(1).maybeSingle()

    const headers = tbl ? (tbl.column_headers as string[]) : []
    const allRows: Record<string, string>[] = []

    if (tbl) {
      const { data: recs } = await supabase
        .from('raw_records').select('data')
        .eq('raw_table_id', tbl.id).order('row_index').range(0, 4999)
      allRows.push(...(recs ?? []).map(r => (r.data ?? {}) as Record<string, string>))
    }

    const overdue = allRows.filter(r => String(r['Invoice Status'] ?? '').trim().toLowerCase() === 'overdue')
    const delayed = allRows.filter(r => String(r['Stage'] ?? '').trim().toLowerCase() === 'delayed')
    const overdueValue = overdue.reduce((s, r) => s + num(r['Contract Value (PKR)']) - num(r['Amount Paid (PKR)']), 0)

    if (overdue.length > 0) {
      emailJobs.push({
        id: 'overdue',
        title: 'Overdue Invoice Reminder',
        summary: `FluxorX has identified ${overdue.length} projects with overdue invoices in your pipeline. The total outstanding balance across these accounts is ${pkr(overdueValue)}. Immediate follow-up is recommended to maintain cash flow targets. The affected customers and their outstanding amounts are listed below for your reference.`,
        meta: `${overdue.length} invoices · ${pkr(overdueValue)} outstanding`,
        priority: 'critical',
        rows: overdue,
        headers: ['Customer Name', 'City', 'Contract Value (PKR)', 'Amount Paid (PKR)', 'Invoice Status', 'Salesperson'].filter(h => headers.includes(h)),
        status: 'ready',
      })
    }

    if (delayed.length > 0) {
      emailJobs.push({
        id: 'delayed',
        title: 'Delayed Project Status Alert',
        summary: `${delayed.length} projects in your pipeline are currently marked as Delayed and may be at risk of further timeline slippage. A combined contract value of ${pkr(delayed.reduce((s, r) => s + num(r['Contract Value (PKR)']), 0))} is tied to these installations. We recommend reviewing each case for recovery actions. Full details are included below.`,
        meta: `${delayed.length} projects delayed`,
        priority: 'warning',
        rows: delayed,
        headers: ['Project ID', 'Customer Name', 'City', 'System Size (kW)', 'Stage', 'Install Date', 'Salesperson'].filter(h => headers.includes(h)),
        status: 'ready',
      })
    }

    const { data: vr } = await supabase
      .from('validation_reports').select('readiness_score, critical_errors, warnings, total_records, valid_records')
      .eq('raw_upload_id', upload.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()

    if (vr && vr.critical_errors > 0) {
      emailJobs.push({
        id: 'dataquality',
        title: 'Critical Data Quality Report',
        summary: `Automated validation of ${upload.file_name} has returned a data readiness score of ${vr.readiness_score}/100. Out of ${vr.total_records} records, ${vr.valid_records} passed all checks. ${vr.critical_errors} critical errors and ${vr.warnings} warnings were identified that may affect the accuracy of your reports and KPI calculations. Remediation is recommended before the next reporting cycle.`,
        meta: `Score ${vr.readiness_score}/100 · ${vr.critical_errors} critical errors`,
        priority: 'critical',
        rows: [],
        headers: [],
        status: 'ready',
      })
    }

    setJobs(emailJobs)
    setLoading(false)
  }, [])

  useEffect(() => { buildJobs() }, [buildJobs])

  async function send(id: string) {
    const job = jobs.find(j => j.id === id)
    if (!job) return

    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'sending' } : j))

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:    job.title,
          summary:  job.summary,
          meta:     job.meta,
          priority: job.priority,
          rows:     job.rows,
          headers:  job.headers,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Send failed')
      setJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'sent', sentAt: data.sentAt } : j))
      const supabase = createClient()
      await auditLog(supabase, 'email_sent', {
        entity: 'email_job',
        entityId: id,
        metadata: { title: job.title, priority: job.priority, sentAt: data.sentAt },
      })
    } catch (err) {
      setJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'error', error: String(err) } : j))
    }
  }

  const sentCount = jobs.filter(j => j.status === 'sent').length

  return (
    <AppShell title="Live email">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">Live email</h2>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[#9AA4B4]">
              Review each alert before it goes out. FluxorX composes a branded executive email with your real data. One tap sends it.
            </p>
          </div>
          {sentCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-[#3FB984]/30 bg-[#3FB984]/[0.07] px-4 py-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3FB984" strokeWidth="2.2">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-mono text-[11px] tracking-wider text-[#3FB984]">
                {sentCount} EMAIL{sentCount > 1 ? 'S' : ''} SENT
              </span>
            </div>
          )}
        </div>

        {loading && (
          <div className="space-y-4">
            {[1, 2].map(i => <div key={i} className="h-48 animate-pulse rounded-2xl border border-white/12 bg-white/[0.03]" />)}
          </div>
        )}

        {!loading && jobs.length === 0 && (
          <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-10 text-center">
            <div className="font-display text-lg font-semibold">Nothing to send</div>
            <p className="mt-1.5 text-sm text-[#9AA4B4]">Upload data and run validation to generate email alerts.</p>
          </div>
        )}

        <div className="space-y-5">
          {jobs.map(job => (
            <motion.div
              key={job.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="overflow-hidden rounded-2xl border border-white/12 bg-white/[0.04]"
            >
              {/* Priority bar */}
              <div className="h-0.5 w-full" style={{ backgroundColor: PRIORITY_COLOR[job.priority] }} />

              <div className="p-5">
                {/* Header row */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: PRIORITY_COLOR[job.priority] }} />
                      <span className="font-display text-base font-semibold text-[#EDF1F6]">{job.title}</span>
                      <span
                        className="rounded-full px-2 py-0.5 font-mono text-[9px] tracking-wider"
                        style={{ backgroundColor: `${PRIORITY_COLOR[job.priority]}1F`, color: PRIORITY_COLOR[job.priority] }}
                      >
                        {job.priority.toUpperCase()}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-[#9AA4B4]">{job.summary}</p>
                    <div className="mt-2 font-mono text-[10px] tracking-wider text-[#3A4555]">
                      TO: khabteehouse@gmail.com · {job.meta}
                    </div>
                  </div>

                  {/* Action area */}
                  <div className="flex flex-col items-end gap-2">
                    {job.status === 'ready' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPreview(preview === job.id ? null : job.id)}
                          className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-xs text-[#9AA4B4] transition hover:bg-white/[0.07]"
                        >
                          {preview === job.id ? 'Hide preview' : 'Preview'}
                        </button>
                        <button
                          onClick={() => send(job.id)}
                          style={{ backgroundImage: 'linear-gradient(to right, #FFB347, #FF7A3D)' }}
                          className="rounded-xl px-4 py-2 text-xs font-semibold text-[#1A0E03] shadow-[0_4px_16px_rgba(255,130,60,0.3)] transition hover:brightness-105"
                        >
                          Send email
                        </button>
                      </div>
                    )}

                    {job.status === 'sending' && (
                      <div className="flex items-center gap-2 rounded-xl border border-[#36D1FF]/30 bg-[#36D1FF]/[0.07] px-4 py-2">
                        <motion.span
                          className="h-1.5 w-1.5 rounded-full bg-[#36D1FF]"
                          animate={{ scale: [1, 1.5, 1], opacity: [1, 0.3, 1] }}
                          transition={{ duration: 0.7, repeat: Infinity }}
                        />
                        <span className="font-mono text-[11px] tracking-wider text-[#36D1FF]">SENDING...</span>
                      </div>
                    )}

                    {job.status === 'sent' && (
                      <div className="text-right">
                        <div className="flex items-center gap-2 rounded-xl border border-[#3FB984]/30 bg-[#3FB984]/[0.07] px-4 py-2">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3FB984" strokeWidth="2.5">
                            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span className="font-mono text-[11px] tracking-wider text-[#3FB984]">DELIVERED</span>
                        </div>
                        {job.sentAt && (
                          <div className="mt-1 font-mono text-[10px] text-[#3A4555]">{job.sentAt}</div>
                        )}
                      </div>
                    )}

                    {job.status === 'error' && (
                      <div className="rounded-xl border border-[#FF6B6B]/30 bg-[#FF6B6B]/[0.07] px-4 py-2">
                        <div className="font-mono text-[11px] tracking-wider text-[#FF6B6B]">SEND FAILED</div>
                        <div className="mt-0.5 text-[11px] text-[#FF9A9A]">{job.error}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Preview panel */}
                <AnimatePresence>
                  {preview === job.id && job.rows.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 overflow-hidden"
                    >
                      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#080C12]">
                        <div className="border-b border-white/[0.06] px-4 py-2 font-mono text-[10px] tracking-widest text-[#3A4555]">
                          DATA TABLE PREVIEW · FIRST {Math.min(5, job.rows.length)} ROWS
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-left">
                            <thead>
                              <tr>
                                {job.headers.map(h => (
                                  <th key={h} className="whitespace-nowrap border-b border-white/[0.06] px-3 py-2 font-mono text-[9px] tracking-wider text-[#566174]">
                                    {h.toUpperCase()}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {job.rows.slice(0, 5).map((row, i) => (
                                <tr key={i} className="odd:bg-white/[0.015]">
                                  {job.headers.map(h => (
                                    <td key={h} className="whitespace-nowrap border-b border-white/[0.04] px-3 py-2 text-xs text-[#9AA4B4]">
                                      {row[h] || <span className="text-[#3A4555]">—</span>}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer note */}
        {jobs.length > 0 && (
          <div className="mt-6 text-center font-mono text-[10px] tracking-widest text-[#1E2A38]">
            EMAILS SENT VIA RESEND · FLUXORX AUTOMATED ALERTS · KARACHI NODE
          </div>
        )}
      </div>
    </AppShell>
  )
}
