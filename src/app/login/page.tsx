'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'

const HeroBurst = dynamic(() => import('@/components/hero-burst'), { ssr: false })

export default function LoginPage() {
  const router = useRouter()
  const reduce = useReducedMotion()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(
        signInError.message.toLowerCase().includes('invalid')
          ? "That email and password don't match. Try again."
          : signInError.message
      )
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="relative flex min-h-screen w-full overflow-hidden bg-[#06080D] text-[#EDF1F6]">
      {/* Full-screen cinematic particle burst */}
      <div className="pointer-events-none absolute inset-0">
        <HeroBurst />
      </div>

      {/* Faint cool base glow at the origin point */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(45% 38% at 50% 100%, rgba(60,150,230,0.12) 0%, rgba(6,8,13,0) 66%)',
        }}
      />

      <div className="relative z-10 flex min-h-screen w-full">
        {/* Left brand column */}
        <div className="hidden w-1/2 flex-col justify-between p-12 lg:flex">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.4, ease: 'easeOut' }}
            className="font-display text-2xl font-semibold tracking-tight"
          >
            Beyond<span className="text-[#FFB347]">IQ</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.6, ease: 'easeOut' }}
            className="max-w-md"
          >
            <h1 className="font-display text-4xl font-semibold leading-[1.12] tracking-tight">
              Operations,
              <br />
              in one command center.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-[#79839A]">
              Every project, invoice, and alert. Read, validated, and explained in
              plain language.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.9 }}
            className="flex gap-6 font-mono text-[11px] tracking-widest text-[#566174]"
          >
            <span>
              <span className="text-[#3FB984]">●</span> MUMBAI NODE · ONLINE
            </span>
            <span>
              <span className="text-[#3FB984]">●</span> DATA PLANE · SECURE
            </span>
          </motion.div>
        </div>

        {/* Right sign-in column */}
        <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
            className="w-full max-w-sm"
          >
            <div className="mb-8 lg:hidden">
              <div className="font-display text-xl font-semibold">
                Beyond<span className="text-[#FFB347]">IQ</span>
              </div>
              <h1 className="mt-6 font-display text-[1.7rem] font-semibold leading-[1.18] tracking-tight">
                Operations, in one command center.
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-[#9AA4B4]">
                Every project, invoice, and alert. Read, validated, and explained
                in plain language.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                Sign in
              </h2>
              <p className="mt-1.5 text-sm text-[#79839A]">
                Access your command center.
              </p>

              <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="block text-xs font-medium tracking-wide text-[#AAB3C2]"
                  >
                    Work email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    suppressHydrationWarning
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full rounded-lg border border-white/10 bg-[#0B0F15] px-3.5 py-2.5 text-sm text-[#EDF1F6] placeholder-[#4D5667] outline-none transition focus:border-[#FFB347]/60 focus:ring-2 focus:ring-[#FFB347]/20"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="password"
                    className="block text-xs font-medium tracking-wide text-[#AAB3C2]"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    suppressHydrationWarning
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-white/10 bg-[#0B0F15] px-3.5 py-2.5 text-sm text-[#EDF1F6] placeholder-[#4D5667] outline-none transition focus:border-[#FFB347]/60 focus:ring-2 focus:ring-[#FFB347]/20"
                  />
                </div>

                {error && (
                  <p
                    role="alert"
                    aria-live="polite"
                    className="text-sm text-[#FF8A6B]"
                  >
                    {error}
                  </p>
                )}

                <motion.button
                  type="submit"
                  disabled={loading}
                  suppressHydrationWarning
                  whileHover={reduce ? undefined : { scale: 1.01 }}
                  whileTap={reduce ? undefined : { scale: 0.99 }}
                  style={{
                    backgroundImage: 'linear-gradient(to right, #FFB347, #FF7A3D)',
                  }}
                  className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-[#1A0E03] shadow-[0_6px_24px_rgba(255,130,60,0.35)] transition disabled:opacity-60"
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </motion.button>
              </form>
            </div>

            <p className="mt-6 text-center font-mono text-[11px] tracking-widest text-[#566174]">
              AUTHORIZED ACCESS ONLY
            </p>
          </motion.div>
        </div>
      </div>
    </main>
  )
}
