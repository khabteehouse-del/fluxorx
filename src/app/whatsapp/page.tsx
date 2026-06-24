'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AppShell from '@/components/app-shell'
import { createClient } from '@/lib/supabase/client'
import { auditLog } from '@/lib/audit'

const TEMPLATES = [
  {
    id: 'overdue',
    label: 'Overdue Invoice Alert',
    body: `*BeyondIQ Alert* 🔴\n\nOverdue Invoices Detected\n\n12 invoices are overdue with a total outstanding balance of ₨13.2M.\n\nTop accounts:\n• Hubco Energy — ₨4.2M\n• Pak Suzuki Motors — ₨4.1M\n• PSO Islamabad — ₨4.9M\n\nReview and take action in BeyondIQ.\n\n_Sent by BeyondIQ Automated Alerts_`,
  },
  {
    id: 'summary',
    label: 'Daily CEO Summary',
    body: `*BeyondIQ — Daily Executive Summary* 📊\n\nGood morning.\n\n*Pipeline Overview*\nTotal Contract Value: ₨2.3B\nCollected: ₨1.1B (48%)\nActive Projects: 8\n\n*Alerts*\n🔴 3 projects delayed\n🟡 12 overdue invoices\n\n*Top Salesperson*\nSana Khan — ₨412M\n\nFull dashboard: beyondiq.app\n\n_BeyondIQ · 09:00 PKT_`,
  },
  {
    id: 'delayed',
    label: 'Delayed Projects Alert',
    body: `*BeyondIQ Alert* 🟡\n\nDelayed Projects Update\n\n3 projects require attention:\n\n1. Hubco Energy (Karachi) — 45 days delayed\n2. Pak Suzuki Motors (Karachi) — 32 days delayed\n3. PSO Islamabad — 18 days delayed\n\nCombined value at risk: ₨52.2M\n\n_Sent by BeyondIQ Automated Alerts_`,
  },
]

export default function WhatsAppPage() {
  const [phoneNumber, setPhoneNumber] = useState('+92 300 0000000')
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].id)
  const [schedule, setSchedule] = useState('09:00')
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [saved, setSaved] = useState(false)

  const template = TEMPLATES.find(t => t.id === selectedTemplate) ?? TEMPLATES[0]

  async function saveSettings() {
    setSaved(true)
    const supabase = createClient()
    await auditLog(supabase, 'whatsapp_preview', {
      metadata: { template: selectedTemplate, scheduleEnabled, schedule },
    })
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <AppShell title="WhatsApp">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            WhatsApp notifications
          </h2>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[#9AA4B4]">
            Configure automated WhatsApp alerts for your team. Preview the message before activating.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">

          {/* Settings panel */}
          <div className="space-y-5">

            {/* Connection status */}
            <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="font-display text-sm font-semibold">WhatsApp Business API</div>
                <span className="rounded-full border border-[#FFB347]/30 bg-[#FFB347]/[0.08] px-3 py-1 font-mono text-[10px] tracking-widest text-[#FFB347]">
                  DEMO MODE
                </span>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-[#080C12] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: '#25D366' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[#EDF1F6]">WhatsApp Business</div>
                    <div className="font-mono text-[10px] tracking-wider text-[#566174]">PREVIEW MODE · CONNECT API KEY TO ACTIVATE</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recipient */}
            <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-5">
              <div className="mb-3 font-display text-sm font-semibold">Recipient</div>
              <label className="mb-1.5 block font-mono text-[10px] tracking-widest text-[#79839A]">
                PHONE NUMBER (WITH COUNTRY CODE)
              </label>
              <input
                type="text"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                suppressHydrationWarning
                className="w-full rounded-lg border border-white/10 bg-[#0B0F15] px-3.5 py-2.5 text-sm text-[#EDF1F6] outline-none transition focus:border-[#FFB347]/50"
              />
              <p className="mt-1.5 text-xs text-[#566174]">
                In production, multiple recipients can be added per automation.
              </p>
            </div>

            {/* Template */}
            <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-5">
              <div className="mb-3 font-display text-sm font-semibold">Message template</div>
              <div className="space-y-2">
                {TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplate(t.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                      selectedTemplate === t.id
                        ? 'border-[#FFB347]/40 bg-[#FFB347]/[0.07] text-[#EDF1F6]'
                        : 'border-white/[0.08] bg-white/[0.02] text-[#9AA4B4] hover:bg-white/[0.04]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Schedule */}
            <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="font-display text-sm font-semibold">Scheduled delivery</div>
                <button
                  onClick={() => setScheduleEnabled(v => !v)}
                  className={`relative h-6 w-10 rounded-full transition-colors ${scheduleEnabled ? 'bg-[#FFB347]' : 'bg-white/[0.1]'}`}
                >
                  <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${scheduleEnabled ? 'left-5' : 'left-1'}`} />
                </button>
              </div>
              {scheduleEnabled && (
                <div className="mt-3">
                  <label className="mb-1.5 block font-mono text-[10px] tracking-widest text-[#79839A]">
                    SEND TIME (PKT)
                  </label>
                  <input
                    type="time"
                    value={schedule}
                    onChange={e => setSchedule(e.target.value)}
                    suppressHydrationWarning
                    className="rounded-lg border border-white/10 bg-[#0B0F15] px-3.5 py-2.5 text-sm text-[#EDF1F6] outline-none focus:border-[#FFB347]/50"
                  />
                  <p className="mt-1.5 text-xs text-[#566174]">
                    Will send daily at {schedule} PKT when activated.
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setPreviewOpen(true)}
                className="rounded-xl border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-[#C2CAD8] transition hover:bg-white/[0.07]"
              >
                Preview message
              </button>
              <button
                onClick={saveSettings}
                style={{ backgroundImage: 'linear-gradient(to right, #FFB347, #FF7A3D)' }}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-[#1A0E03] shadow-[0_4px_16px_rgba(255,130,60,0.25)] transition hover:brightness-105"
              >
                {saved ? 'Saved' : 'Save settings'}
              </button>
            </div>
          </div>

          {/* Phone preview */}
          <div className="flex justify-center lg:justify-start">
            <div className="relative w-[260px]">
              <div className="rounded-[2.5rem] border-4 border-[#1A2030] bg-[#111827] p-3 shadow-2xl">
                {/* Phone top bar */}
                <div className="mb-2 flex items-center gap-2 rounded-2xl bg-[#1F2937] px-3 py-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: '#25D366' }}>
                    <span className="text-[10px] font-bold text-white">B</span>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-white">BeyondIQ Alerts</div>
                    <div className="text-[9px] text-[#6B7280]">Business Account</div>
                  </div>
                </div>

                {/* Chat area */}
                <div className="min-h-64 rounded-xl bg-[#0B1120] p-2" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,179,71,0.03) 0%, transparent 70%)' }}>
                  <div className="mb-2 text-center font-mono text-[9px] text-[#374151]">TODAY</div>
                  <div className="rounded-xl rounded-tl-sm bg-[#1F2D20] p-3 text-left">
                    {template.body.split('\n').map((line, i) => {
                      const bold = line.startsWith('*') && line.endsWith('*')
                      const text = bold ? line.slice(1, -1) : line.replace(/\*/g, '')
                      return (
                        <div key={i} className={`text-[10px] leading-relaxed ${bold ? 'font-bold text-white' : 'text-[#D1FAE5]'} ${line === '' ? 'h-2' : ''}`}>
                          {line.startsWith('_') && line.endsWith('_')
                            ? <span className="italic text-[#6B7280]">{line.slice(1, -1)}</span>
                            : text}
                        </div>
                      )
                    })}
                    <div className="mt-1.5 text-right font-mono text-[8px] text-[#6B7280]">
                      {schedule} ✓✓
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 text-center font-mono text-[10px] tracking-wider text-[#3A4555]">
                WHATSAPP PREVIEW
              </div>
            </div>
          </div>
        </div>

        {/* Full preview modal */}
        <AnimatePresence>
          {previewOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
              onClick={() => setPreviewOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-md overflow-hidden rounded-2xl border border-white/12 bg-[#0D1117]"
              >
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                  <div className="font-display text-sm font-semibold">Message preview</div>
                  <button onClick={() => setPreviewOpen(false)} className="text-[#566174] hover:text-[#EDF1F6]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <div className="p-5">
                  <div className="mb-3 font-mono text-[10px] tracking-widest text-[#566174]">
                    TO: {phoneNumber}
                  </div>
                  <div className="whitespace-pre-wrap rounded-xl bg-[#1F2D20] p-4 font-mono text-xs leading-relaxed text-[#D1FAE5]">
                    {template.body}
                  </div>
                  <p className="mt-3 text-xs text-[#566174]">
                    In production this message is sent via the WhatsApp Business API. Connect your API key to activate real delivery.
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  )
}
