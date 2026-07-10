'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import AppShell from '@/components/app-shell'

export default function OverviewPage() {
  const steps = [
    { n: '01', t: 'Connect', d: 'Upload a spreadsheet or link a system.' },
    { n: '02', t: 'Validate', d: 'We check, clean, and organize the data.' },
    { n: '03', t: 'Decide', d: 'Ask questions and set up automatic alerts.' },
  ]

  return (
    <AppShell title="Overview">
      <div className="mx-auto max-w-6xl">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/[0.05] p-7 sm:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(255,140,60,0.20) 0%, rgba(6,8,13,0) 70%)',
            }}
          />
          <div className="relative">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 font-mono text-[10px] tracking-widest text-[#AAB6C6]">
              <span className="text-[#3FB984]">●</span> SYSTEM ONLINE
            </div>
            <h2 className="max-w-2xl font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Your operations, read and understood in one place.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#8A93A4]">
              Bring in your data, let FluxorX validate and organize it, then ask
              plain-language questions and set up automatic alerts.
            </p>
            <div className="mt-7">
              <Link
                href="/connectors"
                style={{
                  backgroundImage: 'linear-gradient(to right, #FFB347, #FF7A3D)',
                }}
                className="inline-flex items-center rounded-xl px-5 py-2.5 text-sm font-semibold text-[#1A0E03] shadow-[0_8px_30px_rgba(255,130,60,0.35)] transition hover:shadow-[0_8px_40px_rgba(255,130,60,0.5)]"
              >
                Connect your data
              </Link>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.08, ease: 'easeOut' }}
              className="rounded-2xl border border-white/[0.12] bg-white/[0.05] p-6 transition hover:border-white/20 hover:bg-white/[0.07]"
            >
              <div className="font-mono text-xs text-[#FFB347]">{s.n}</div>
              <div className="mt-3 font-display text-lg font-semibold">{s.t}</div>
              <div className="mt-1.5 text-xs leading-relaxed text-[#8A93A4]">
                {s.d}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
