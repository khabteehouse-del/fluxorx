'use client'

import { motion } from 'framer-motion'
import AppShell from '@/components/app-shell'

type Status = 'ready' | 'enterprise' | 'soon'
type Connector = { name: string; desc: string; status: Status }

const CONNECTORS: Connector[] = [
  { name: 'File Upload', desc: 'Excel or CSV. The fastest way to load your data.', status: 'ready' },
  { name: 'Google Sheets', desc: 'Sync directly from a shared sheet.', status: 'soon' },
  { name: 'SAP', desc: 'Enterprise ERP connection.', status: 'enterprise' },
  { name: 'Oracle NetSuite', desc: 'Financials and operations data.', status: 'enterprise' },
  { name: 'Microsoft Dynamics 365', desc: 'ERP and CRM records.', status: 'enterprise' },
  { name: 'Power BI', desc: 'Pull from existing BI datasets.', status: 'enterprise' },
  { name: 'QuickBooks', desc: 'Accounting, invoices, and payments.', status: 'soon' },
  { name: 'Salesforce', desc: 'Sales pipeline and accounts.', status: 'soon' },
]

const BADGE: Record<Status, { label: string; cls: string }> = {
  ready: { label: 'Ready', cls: 'border-[#3FB984]/40 text-[#5FE0A8] bg-[#3FB984]/15' },
  enterprise: {
    label: 'Enterprise setup',
    cls: 'border-white/15 text-[#AAB6C6] bg-white/[0.06]',
  },
  soon: { label: 'Coming soon', cls: 'border-white/12 text-[#7C879A] bg-white/[0.04]' },
}

export default function ConnectorsPage() {
  return (
    <AppShell title="Connectors">
      <div className="mx-auto max-w-6xl">
        <p className="max-w-2xl text-sm leading-relaxed text-[#8A93A4]">
          Choose where your data comes from. Start with a file upload now. Enterprise
          systems are connected during onboarding.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CONNECTORS.map((c, i) => {
            const b = BADGE[c.status]
            const ready = c.status === 'ready'
            return (
              <motion.div
                key={c.name}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.05, ease: 'easeOut' }}
                className={`relative overflow-hidden rounded-2xl border p-5 transition hover:-translate-y-0.5 ${
                  ready
                    ? 'border-[#FFB347]/45 bg-white/[0.08] hover:bg-white/[0.11]'
                    : 'border-white/[0.12] bg-white/[0.05] hover:border-white/20 hover:bg-white/[0.07]'
                }`}
              >
                {ready && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full"
                    style={{
                      background:
                        'radial-gradient(circle, rgba(255,150,70,0.28) 0%, rgba(6,8,13,0) 70%)',
                    }}
                  />
                )}
                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`font-display text-base font-semibold ${
                        ready ? 'text-white' : 'text-[#C2CBD8]'
                      }`}
                    >
                      {c.name}
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${b.cls}`}
                    >
                      {b.label}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[#8A93A4]">
                    {c.desc}
                  </p>
                  {ready && (
                    <div className="mt-4 flex items-center gap-1.5 text-[11px] font-medium text-[#5FE0A8]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#5FE0A8]" />
                      Ready to use
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </AppShell>
  )
}
