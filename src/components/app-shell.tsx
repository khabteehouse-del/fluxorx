'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import AmbientBackground from '@/components/ambient-background'

const NAV = [
  {
    group: 'Pipeline',
    items: [
      { label: 'Overview', href: '/dashboard', ready: true },
      { label: 'Connectors', href: '/connectors', ready: true },
      { label: 'Data upload', href: '/upload', ready: true },
      { label: 'Raw data', href: '/raw', ready: true },
      { label: 'Column mapping', href: '/mapping', ready: true },
      { label: 'Validation', href: '/validation', ready: true },
      { label: 'Dashboard', href: '/operations', ready: true },
    ],
  },
  {
    group: 'Intelligence',
    items: [
      { label: 'AI agent', href: '/agent', ready: true },
      { label: 'Automations', href: '/automations', ready: true },
      { label: 'Live email', href: '/email', ready: true },
      { label: 'WhatsApp', href: '/whatsapp', ready: true },
    ],
  },
]

export default function AppShell({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [email, setEmail] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/login')
        return
      }
      setEmail(data.user.email ?? null)
      setChecking(false)
    })
  }, [router])

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#06080D] text-[#566174]">
        <span className="font-mono text-xs tracking-widest">
          LOADING COMMAND CENTER
        </span>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06080D] text-[#EDF1F6]">
      {/* App-wide ambient background */}
      <AmbientBackground />

      <div className="relative z-10 flex min-h-screen">
        {/* Mobile backdrop (same layer group as the drawer, sits below it) */}
        {menuOpen && (
          <div
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-30 bg-black/55 lg:hidden"
          />
        )}
        {/* Sidebar (drawer on mobile, static on desktop) */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/[0.1] bg-[#0C1119] p-6 transition-transform duration-300 ease-out lg:static lg:z-10 lg:translate-x-0 lg:bg-white/[0.03] lg:backdrop-blur-xl ${
            menuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="mb-10 px-2 font-display text-lg font-semibold tracking-tight">
            Beyond<span className="text-[#FFB347]">IQ</span>
          </div>

          <nav className="flex flex-1 flex-col gap-8">
            {NAV.map((section) => (
              <div key={section.group}>
                <div className="px-2 pb-3 font-mono text-[10px] tracking-[0.2em] text-[#5A6678]">
                  {section.group.toUpperCase()}
                </div>
                <div className="flex flex-col gap-1">
                  {section.items.map((item) => {
                    const active = pathname === item.href
                    if (!item.ready) {
                      return (
                        <div
                          key={item.href}
                          className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-[#737E90]"
                        >
                          <span>{item.label}</span>
                          <span className="font-mono text-[9px] tracking-wider text-[#5A6678]">
                            SOON
                          </span>
                        </div>
                      )
                    }
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`relative rounded-lg px-3 py-2 text-sm transition ${
                          active
                            ? 'bg-white/[0.06] font-medium text-white'
                            : 'text-[#C2CAD8] hover:bg-white/[0.03] hover:text-white'
                        }`}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-[#FFB347] to-[#FF7A3D]" />
                        )}
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-6 flex items-center gap-2 px-2 font-mono text-[10px] tracking-widest text-[#566174]">
            <span className="text-[#3FB984]">●</span> MUMBAI NODE · LIVE
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-white/[0.1] bg-white/[0.03] px-5 py-4 backdrop-blur-xl sm:px-8 sm:py-5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                className="rounded-lg border border-white/10 bg-white/[0.04] p-2 transition hover:bg-white/[0.08] lg:hidden"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M2 4h12M2 8h12M2 12h12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <h1 className="font-display text-lg font-semibold tracking-tight sm:text-xl">
                {title}
              </h1>
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              <span className="hidden text-xs text-[#79839A] sm:block">{email}</span>
              <button
                onClick={signOut}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs transition hover:bg-white/[0.08]"
              >
                Sign out
              </button>
            </div>
          </header>

          <motion.main
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="flex-1 p-5 sm:p-8 lg:p-10"
          >
            {children}
          </motion.main>
        </div>
      </div>
    </div>
  )
}
