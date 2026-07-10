'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AppShell from '@/components/app-shell'
import { createClient } from '@/lib/supabase/client'
import { auditLog } from '@/lib/audit'

type Status = 'pending' | 'queued' | 'sending' | 'sent' | 'dismissed'
type Priority = 'critical' | 'warning' | 'info'

type Automation = {
  id: string
  title: string
  description: string
  action: string
  priority: Priority
  source: 'validation' | 'business'
  status: Status
  sentAt?: string
  meta?: string
}

const PRIORITY_COLOR: Record<Priority, string> = {
  critical: '#FF6B6B',
  warning: '#FFB347',
  info: '#6FB7FF',
}

const STATUS_CONFIG: Record<Status, { label: string; color: string }> = {
  pending:   { label: 'PENDING REVIEW', color: '#566174' },
  queued:    { label: 'QUEUED',         color: '#FFB347' },
  sending:   { label: 'SENDING...',     color: '#36D1FF' },
  sent:      { label: 'SENT',           color: '#3FB984' },
  dismissed: { label: 'DISMISSED',      color: '#3A4555' },
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

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>('viewer')

  type ScheduleDraft = { id: string; title: string; channel: string; freq: string; time: string; createdAt: string }
  const [scheduleDrafts, setScheduleDrafts] = useState<ScheduleDraft[]>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('fluxorx_schedule_drafts') : null
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })

  function deleteSchedule(id: string) {
    setScheduleDrafts(prev => {
      const updated = prev.filter(s => s.id !== id)
      try { localStorage.setItem('fluxorx_schedule_drafts', JSON.stringify(updated)) } catch {}
      return updated
    })
  }

  const buildSuggestions = useCallback(async () => {
    const supabase = createClient()
    const suggestions: Omit<Automation, 'id' | 'status'>[] = []

    const { data: upload } = await supabase
      .from('raw_uploads').select('id, file_name')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()

    if (!upload) { setLoading(false); return }

    // Business events from raw data
    const { data: tbl } = await supabase
      .from('raw_tables').select('id')
      .eq('raw_upload_id', upload.id).limit(1).maybeSingle()

    if (tbl) {
      const { data: recs } = await supabase
        .from('raw_records').select('data')
        .eq('raw_table_id', tbl.id).order('row_index').range(0, 4999)

      const rows = (recs ?? []).map(r => (r.data ?? {}) as Record<string, unknown>)

      const overdue = rows.filter(r => String(r['Invoice Status'] ?? '').trim().toLowerCase() === 'overdue')
      const delayed = rows.filter(r => String(r['Stage'] ?? '').trim().toLowerCase() === 'delayed')
      const unpaid  = rows.filter(r => String(r['Invoice Status'] ?? '').trim().toLowerCase() === 'unpaid')
      const overdueValue = overdue.reduce((s, r) => s + num(r['Contract Value (PKR)']) - num(r['Amount Paid (PKR)']), 0)

      if (overdue.length > 0) {
        suggestions.push({
          title: 'Overdue invoice reminder',
          description: `${overdue.length} projects have overdue invoices totalling ${pkr(overdueValue)} in outstanding payments.`,
          action: `Send payment reminder email for ${overdue.length} overdue invoices`,
          priority: 'critical',
          source: 'business',
          meta: `${overdue.length} invoices · ${pkr(overdueValue)} outstanding`,
        })
      }

      if (delayed.length > 0) {
        suggestions.push({
          title: 'Delayed project status alert',
          description: `${delayed.length} projects are marked Delayed and may need management attention.`,
          action: `Send delay notification for ${delayed.length} projects`,
          priority: 'warning',
          source: 'business',
          meta: `${delayed.length} projects delayed`,
        })
      }

      if (unpaid.length > 0) {
        const unpaidValue = unpaid.reduce((s, r) => s + num(r['Contract Value (PKR)']), 0)
        suggestions.push({
          title: 'Unpaid invoice follow-up',
          description: `${unpaid.length} invoices are marked unpaid with a combined value of ${pkr(unpaidValue)}.`,
          action: `Send follow-up email for ${unpaid.length} unpaid invoices`,
          priority: 'warning',
          source: 'business',
          meta: `${unpaid.length} invoices · ${pkr(unpaidValue)}`,
        })
      }
    }

    // Validation issues
    const { data: vr } = await supabase
      .from('validation_reports').select('id, readiness_score, critical_errors, warnings')
      .eq('raw_upload_id', upload.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()

    if (vr) {
      if (vr.critical_errors > 0) {
        suggestions.push({
          title: 'Critical data quality alert',
          description: `${vr.critical_errors} critical data errors detected in ${upload.file_name}. Readiness score: ${vr.readiness_score}/100.`,
          action: 'Send data quality report to team',
          priority: 'critical',
          source: 'validation',
          meta: `Score ${vr.readiness_score}/100 · ${vr.critical_errors} critical`,
        })
      }

      if (vr.warnings > 0) {
        suggestions.push({
          title: 'Data validation warnings',
          description: `${vr.warnings} warnings found during validation that may affect reporting accuracy.`,
          action: 'Send validation warning summary to team',
          priority: 'warning',
          source: 'validation',
          meta: `${vr.warnings} warnings`,
        })
      }

      if (vr.readiness_score >= 85) {
        suggestions.push({
          title: 'Data quality report — healthy',
          description: `Data health score is ${vr.readiness_score}/100. Send a positive status update to stakeholders.`,
          action: 'Send data health summary to stakeholders',
          priority: 'info',
          source: 'validation',
          meta: `Score ${vr.readiness_score}/100`,
        })
      }
    }

    setAutomations(suggestions.map((s, i) => ({
      ...s,
      id: `auto-${i}-${Date.now()}`,
      status: 'pending',
    })))
    setLoading(false)
  }, [])

  useEffect(() => {
    buildSuggestions()
    const supabase = createClient()
    supabase.from('profiles').select('role').single().then(({ data }) => {
      if (data?.role) setUserRole(data.role)
    })
  }, [buildSuggestions])

  async function approve(id: string) {
    if (userRole !== 'admin') return
    const auto = automations.find(a => a.id === id)
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, status: 'queued' } : a))
    await new Promise(r => setTimeout(r, 700))
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, status: 'sending' } : a))
    await new Promise(r => setTimeout(r, 1400))
    setAutomations(prev => prev.map(a =>
      a.id === id ? { ...a, status: 'sent', sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } : a
    ))
    const supabase = createClient()
    await auditLog(supabase, 'automation_approved', {
      entity: 'automation',
      entityId: id,
      metadata: { title: auto?.title, priority: auto?.priority },
    })
  }

  function dismiss(id: string) {
    const auto = automations.find(a => a.id === id)
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, status: 'dismissed' } : a))
    const supabase = createClient()
    auditLog(supabase, 'automation_dismissed', {
      entity: 'automation',
      entityId: id,
      metadata: { title: auto?.title },
    })
  }

  const pending   = automations.filter(a => a.status === 'pending')
  const active    = automations.filter(a => ['queued', 'sending', 'sent'].includes(a.status))
  const dismissed = automations.filter(a => a.status === 'dismissed')

  return (
    <AppShell title="Automations">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Automation approval
          </h2>
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] tracking-widest ${userRole === 'admin' ? 'bg-[#FFB347]/[0.12] text-[#FFB347]' : 'bg-white/[0.04] text-[#566174]'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${userRole === 'admin' ? 'bg-[#FFB347]' : 'bg-[#566174]'}`} />
              {userRole === 'admin' ? 'ADMIN · CAN APPROVE' : 'VIEWER · READ ONLY'}
            </span>
          </div>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#9AA4B4]">
            FluxorX has scanned your data and flagged actions that need your sign-off before anything is sent.
          </p>
        </div>

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 animate-pulse rounded-2xl border border-white/12 bg-white/[0.03]" />
            ))}
          </div>
        )}

        {!loading && automations.length === 0 && (
          <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-10 text-center">
            <div className="font-display text-lg font-semibold">No automations suggested</div>
            <p className="mt-1.5 text-sm text-[#9AA4B4]">Upload data and run validation to generate suggestions.</p>
          </div>
        )}

        {/* Pending approvals */}
        {pending.length > 0 && (
          <div className="mb-6">
            <div className="mb-3 font-mono text-[11px] tracking-widest text-[#79839A]">
              AWAITING YOUR APPROVAL · {pending.length}
            </div>
            <div className="space-y-3">
              {pending.map(auto => (
                <motion.div
                  key={auto.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="overflow-hidden rounded-2xl border border-white/12 bg-white/[0.04]"
                >
                  <div className="h-0.5 w-full" style={{ backgroundColor: PRIORITY_COLOR[auto.priority] }} />
                  <div className="p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: PRIORITY_COLOR[auto.priority] }} />
                          <span className="font-display text-sm font-semibold text-[#EDF1F6]">{auto.title}</span>
                          <span
                            className="rounded-full px-2 py-0.5 font-mono text-[9px] tracking-wider"
                            style={{ backgroundColor: `${PRIORITY_COLOR[auto.priority]}1F`, color: PRIORITY_COLOR[auto.priority] }}
                          >
                            {auto.priority.toUpperCase()}
                          </span>
                          <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[9px] tracking-wider text-[#566174]">
                            {auto.source === 'business' ? 'BUSINESS EVENT' : 'DATA QUALITY'}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-[#9AA4B4]">{auto.description}</p>
                        <div className="mt-2 font-mono text-[11px] text-[#566174]">
                          Action: <span className="text-[#79839A]">{auto.action}</span>
                        </div>
                        {auto.meta && (
                          <div className="mt-1 font-mono text-[10px] tracking-wider text-[#3A4555]">{auto.meta}</div>
                        )}
                      </div>
                      <div className="flex flex-row gap-2 sm:flex-col">
                        {userRole === 'admin' ? (
                          <button
                            onClick={() => approve(auto.id)}
                            style={{ backgroundImage: 'linear-gradient(to right, #FFB347, #FF7A3D)' }}
                            className="rounded-xl px-4 py-2 text-xs font-semibold text-[#1A0E03] shadow-[0_4px_16px_rgba(255,130,60,0.3)] transition hover:brightness-105"
                          >
                            Approve
                          </button>
                        ) : (
                          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-center text-xs text-[#3A4555]" title="Admin role required">
                            🔒 Admin only
                          </div>
                        )}
                        <button
                          onClick={() => dismiss(auto.id)}
                          className="rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2 text-xs font-medium text-[#79839A] transition hover:bg-white/[0.07]"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Active / sent */}
        {active.length > 0 && (
          <div className="mb-6">
            <div className="mb-3 font-mono text-[11px] tracking-widest text-[#79839A]">
              IN PROGRESS & COMPLETED · {active.length}
            </div>
            <div className="space-y-3">
              <AnimatePresence>
                {active.map(auto => {
                  const sc = STATUS_CONFIG[auto.status]
                  return (
                    <motion.div
                      key={auto.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                    >
                      <div
                        className="h-0.5 w-full transition-all duration-700"
                        style={{ backgroundColor: sc.color }}
                      />
                      <div className="flex items-center justify-between px-5 py-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {auto.status === 'sending' && (
                              <motion.span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: sc.color }}
                                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.3, 1] }}
                                transition={{ duration: 0.7, repeat: Infinity }}
                              />
                            )}
                            {auto.status === 'sent' && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3FB984" strokeWidth="2.5">
                                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                            <span className="font-display text-sm font-medium text-[#C2CAD8]">{auto.title}</span>
                          </div>
                          <div className="mt-1 text-xs text-[#566174]">{auto.action}</div>
                        </div>
                        <div className="ml-4 text-right">
                          <div className="font-mono text-[10px] tracking-widest" style={{ color: sc.color }}>
                            {sc.label}
                          </div>
                          {auto.sentAt && (
                            <div className="mt-0.5 font-mono text-[10px] text-[#3A4555]">{auto.sentAt}</div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Dismissed */}
        {dismissed.length > 0 && (
          <div>
            <div className="mb-3 font-mono text-[11px] tracking-widest text-[#3A4555]">
              DISMISSED · {dismissed.length}
            </div>
            <div className="space-y-2">
              {dismissed.map(auto => (
                <div
                  key={auto.id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 opacity-40"
                >
                  <span className="text-sm text-[#566174]">{auto.title}</span>
                  <span className="font-mono text-[10px] tracking-wider text-[#3A4555]">DISMISSED</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Schedule drafts created from AI agent */}
        {scheduleDrafts.length > 0 && (
          <div className="mt-6">
            <div className="mb-3 font-mono text-[11px] tracking-widest text-[#79839A]">
              SCHEDULED AUTOMATIONS · {scheduleDrafts.length}
            </div>
            <div className="space-y-3">
              {scheduleDrafts.map(s => (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="overflow-hidden rounded-2xl border border-[#6FB7FF]/20 bg-white/[0.03]"
                >
                  <div className="h-0.5 w-full bg-[#6FB7FF]" />
                  <div className="flex items-center justify-between px-5 py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-semibold text-[#EDF1F6]">{s.title}</span>
                        <span className="rounded-full bg-[#6FB7FF]/10 px-2 py-0.5 font-mono text-[9px] tracking-wider text-[#6FB7FF]">
                          SCHEDULED
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-[#566174]">
                        {s.freq} · {s.channel} · {s.time} PKT · Created {s.createdAt}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteSchedule(s.id)}
                      className="ml-4 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-[#FF6B6B] transition hover:bg-[#FF6B6B]/[0.08]"
                    >
                      Delete
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
