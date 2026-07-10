'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import AppShell from '@/components/app-shell'
import { createClient } from '@/lib/supabase/client'
import { runAgent, type LogLine } from '@/lib/agent'
import { auditLog } from '@/lib/audit'

const AIReactor = dynamic(() => import('@/components/ai-reactor'), { ssr: false })

type Mode = 'idle' | 'thinking' | 'answer'

type Message = {
  id: string
  role: 'user' | 'agent'
  text: string
  logs?: LogLine[]
  scheduleDraft?: { title: string; channel: string; freq: string; time: string }
}

const SUGGESTIONS = [
  'Give me a full summary',
  'Show me overdue invoices',
  'Who is the top salesperson?',
  'Which city has the most projects?',
  'How many projects are delayed?',
  'What is our collection rate?',
  'Create schedule: CEO daily summary at 9 AM by email',
]

const FAQ = [
  {
    category: 'Invoices & Payments',
    icon: '₨',
    questions: [
      'Show me overdue invoices',
      'What is our collection rate?',
      'How much is still outstanding?',
      'Which invoices are unpaid?',
    ],
  },
  {
    category: 'Pipeline & Projects',
    icon: '⚡',
    questions: [
      'How many projects are delayed?',
      'Show me completed installations',
      'Which projects are in progress?',
      'What is the total contract value?',
    ],
  },
  {
    category: 'Team Performance',
    icon: '👤',
    questions: [
      'Who is the top salesperson?',
      'Show me sales by salesperson',
      'Who has the most projects?',
    ],
  },
  {
    category: 'Geography',
    icon: '📍',
    questions: [
      'Which city has the most projects?',
      'Show me projects by city',
      'Where is our highest revenue?',
    ],
  },
  {
    category: 'Capacity & Systems',
    icon: '🔆',
    questions: [
      'What is our total installed capacity?',
      'What is the average system size?',
      'Which is the largest installation?',
    ],
  },
  {
    category: 'Data Quality',
    icon: '✓',
    questions: [
      'What is our data health score?',
      'Are there any data issues?',
      'How clean is our data?',
    ],
  },
]

const modeLabel: Record<Mode, string> = {
  idle: 'STANDING BY',
  thinking: 'PROCESSING',
  answer: 'RESPONSE READY',
}
const modeColor: Record<Mode, string> = {
  idle: '#3A4F6A',
  thinking: '#36D1FF',
  answer: '#3FB984',
}

export default function AgentPage() {
  const [mode, setMode]       = useState<Mode>('idle')
  const [messages, setMessages] = useState<Message[]>([])
  const [logs, setLogs]       = useState<LogLine[]>([])
  const [input, setInput]     = useState('')
  const [busy, setBusy]       = useState(false)
  const [faqOpen, setFaqOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, logs])

  async function ask(question: string) {
    if (!question.trim() || busy) return
    setBusy(true)
    setMode('thinking')
    setLogs([])
    setFaqOpen(false)

    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', text: question }])
    setInput('')

    const collectedLogs: LogLine[] = []
    const supabase = createClient()

    // Detect "create schedule" intent before running the normal agent
    const isSchedule = question.toLowerCase().startsWith('create schedule')
    if (isSchedule) {
      const log = (text: string, color = '#6FB7FF') => {
        collectedLogs.push({ text, color })
        setLogs([...collectedLogs])
      }
      log('▸ INTENT PARSED · schedule creation request detected', '#9AA4B4')
      await new Promise(r => setTimeout(r, 400))
      log('▸ EXTRACTING · parsing schedule parameters from query', '#6FB7FF')
      await new Promise(r => setTimeout(r, 500))

      // Parse time if mentioned, default to 09:00
      const timeMatch = question.match(/(\d{1,2})\s*(am|pm|AM|PM)/) ||
                        question.match(/(\d{1,2}:\d{2})/)
      let timeStr = '09:00'
      if (timeMatch) {
        const raw = timeMatch[0].toLowerCase().replace(' ', '')
        if (raw.includes('am') || raw.includes('pm')) {
          const hour = parseInt(raw)
          const isPm = raw.includes('pm') && hour !== 12
          timeStr = `${String(isPm ? hour + 12 : hour).padStart(2, '0')}:00`
        } else {
          timeStr = timeMatch[1]
        }
      }

      // Determine type
      const q = question.toLowerCase()
      const isCeo = q.includes('ceo') || q.includes('executive') || q.includes('summary')
      const isOverdue = q.includes('overdue') || q.includes('invoice')
      const isDelayed = q.includes('delayed') || q.includes('delay')

      const title = isCeo
        ? 'CEO Daily Executive Summary'
        : isOverdue
        ? 'Overdue Invoice Alert'
        : isDelayed
        ? 'Delayed Project Alert'
        : 'Scheduled Automation'

      const channel = q.includes('whatsapp') ? 'WhatsApp' : 'Email'
      const freq = q.includes('weekly') ? 'Weekly' : q.includes('hourly') ? 'Hourly' : 'Daily'

      log(`▸ DRAFT CREATED · ${freq} ${channel} · ${timeStr} PKT`, '#FFB347')
      await new Promise(r => setTimeout(r, 400))
      log('▸ COMPOSING ANSWER · automation draft ready', '#3FB984')

      // Persist to localStorage so Automations page picks it up
      try {
        const existing = JSON.parse(localStorage.getItem('fluxorx_schedule_drafts') || '[]')
        existing.push({
          id: crypto.randomUUID(),
          title,
          channel,
          freq,
          time: timeStr,
          createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        })
        localStorage.setItem('fluxorx_schedule_drafts', JSON.stringify(existing))
      } catch {}

      setMode('answer')
      await auditLog(supabase, 'ai_question', {
        entity: 'agent_chat',
        metadata: { question, type: 'schedule_creation' },
      })
      await new Promise(r => setTimeout(r, 600))

      const scheduleAnswer = `Schedule created. I have added a "${title}" automation draft to your Automations page.\n\nDetails:\n• Type: ${freq} ${channel}\n• Time: ${timeStr} PKT\n• Status: Pending your approval\n\nGo to Automations to review and activate it. You can delete it at any time.`

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'agent',
        text: scheduleAnswer,
        logs: [...collectedLogs],
        scheduleDraft: { title, channel, freq, time: timeStr },
      }])
      setLogs([])
      await new Promise(r => setTimeout(r, 2200))
      setMode('idle')
      setBusy(false)
      inputRef.current?.focus()
      return
    }

    const answer = await runAgent(question, supabase, (line) => {
      collectedLogs.push(line)
      setLogs([...collectedLogs])
    })

    setMode('answer')
    await auditLog(supabase, 'ai_question', {
      entity: 'agent_chat',
      metadata: { question, answerLength: answer.length },
    })
    await new Promise(r => setTimeout(r, 600))

    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: 'agent',
      text: answer,
      logs: [...collectedLogs],
    }])
    setLogs([])

    await new Promise(r => setTimeout(r, 2200))
    setMode('idle')
    setBusy(false)
    inputRef.current?.focus()
  }

  return (
    <AppShell title="AI Agent">
      <div className="mx-auto flex max-w-4xl flex-col" style={{ height: 'calc(100vh - 80px)' }}>

        {/* Reactor */}
        <div className="relative flex flex-col items-center py-2" style={{ zIndex: 1, overflow: 'hidden' }}>
          <div style={{ width: 220, height: 220, position: 'relative', zIndex: 1, overflow: 'visible' }}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', width: 300, height: 300, transform: 'translate(-50%, -50%)', overflow: 'visible' }}>
              <AIReactor mode={mode} />
            </div>
          </div>
          <motion.div
            className="mt-6 flex items-center gap-2 font-mono text-[11px] tracking-widest"
            animate={{ color: modeColor[mode] }}
            transition={{ duration: 0.5 }}
          >
            <motion.span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: modeColor[mode] }}
              animate={mode === 'thinking'
                ? { scale: [1, 1.6, 1], opacity: [1, 0.3, 1] }
                : { scale: 1, opacity: 1 }}
              transition={{ duration: 0.75, repeat: mode === 'thinking' ? Infinity : 0 }}
            />
            {modeLabel[mode]}
          </motion.div>
        </div>

        {/* Live system log */}
        <AnimatePresence>
          {logs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mx-2 mb-3 overflow-hidden rounded-xl border border-white/10 bg-[#080C12] px-4 py-3"
            >
              <div className="mb-1.5 font-mono text-[9px] tracking-widest text-[#2A3444]">SYSTEM LOG</div>
              {logs.map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="font-mono text-[11px] leading-relaxed tracking-wide"
                  style={{ color: line.color }}
                >
                  {line.text}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat thread */}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="font-display text-lg font-semibold text-[#EDF1F6]">
                Ask FluxorX anything about your data
              </div>
              <p className="mt-2 max-w-sm text-sm text-[#566174]">
                Real answers from your actual database. No guessing.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-1.5 text-xs text-[#9AA4B4] transition hover:border-[#FFB347]/40 hover:bg-[#FFB347]/[0.06] hover:text-[#FFD9A8]"
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* FAQ toggle */}
              <button
                onClick={() => setFaqOpen(v => !v)}
                className="mt-5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-[#79839A] transition hover:border-white/20 hover:text-[#C2CAD8]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" strokeLinecap="round" /><circle cx="12" cy="17" r=".5" fill="currentColor" />
                </svg>
                {faqOpen ? 'Hide' : 'Show'} everything I can ask
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ transform: faqOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <AnimatePresence>
                {faqOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 w-full max-w-2xl overflow-hidden"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      {FAQ.map(group => (
                        <div
                          key={group.category}
                          className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left"
                        >
                          <div className="mb-2.5 flex items-center gap-2">
                            <span className="text-base">{group.icon}</span>
                            <span className="font-mono text-[10px] tracking-widest text-[#79839A]">
                              {group.category.toUpperCase()}
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {group.questions.map(q => (
                              <button
                                key={q}
                                onClick={() => ask(q)}
                                className="block w-full rounded-lg px-3 py-1.5 text-left text-xs text-[#9AA4B4] transition hover:bg-white/[0.05] hover:text-[#EDF1F6]"
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28 }}
              className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'user' ? (
                <div className="max-w-[78%] rounded-2xl rounded-tr-sm border border-[#FFB347]/25 bg-[#FFB347]/[0.08] px-4 py-2.5 text-sm text-[#EDF1F6]">
                  {msg.text}
                </div>
              ) : (
                <div className="max-w-[88%]">
                  {msg.logs && msg.logs.length > 0 && (
                    <div className="mb-2 rounded-xl border border-white/[0.07] bg-[#080C12] px-3 py-2">
                      {msg.logs.map((l, i) => (
                        <div key={i} className="font-mono text-[10px] leading-relaxed" style={{ color: l.color }}>
                          {l.text}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="rounded-2xl rounded-tl-sm border border-white/12 bg-white/[0.05] px-4 py-3 text-sm leading-relaxed text-[#C2CAD8]">
                    {msg.text}
                  </div>
                  {msg.scheduleDraft && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: 0.2 }}
                      className="mt-2 overflow-hidden rounded-2xl border border-[#FFB347]/30 bg-[#FFB347]/[0.06]"
                    >
                      <div className="h-0.5 w-full" style={{ backgroundImage: 'linear-gradient(to right, #FFB347, #FF7A3D)' }} />
                      <div className="p-4">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="font-mono text-[9px] tracking-widest text-[#FFB347]">AUTOMATION DRAFT</span>
                        </div>
                        <div className="font-display text-sm font-semibold text-[#EDF1F6]">{msg.scheduleDraft.title}</div>
                        <div className="mt-1 font-mono text-[11px] text-[#79839A]">
                          {msg.scheduleDraft.freq} · {msg.scheduleDraft.channel} · {msg.scheduleDraft.time} PKT
                        </div>
                        <div className="mt-3 flex gap-2">
                          <a
                            href="/automations"
                            style={{ backgroundImage: 'linear-gradient(to right, #FFB347, #FF7A3D)' }}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#1A0E03] transition hover:brightness-105"
                          >
                            Review in Automations
                          </a>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-white/[0.08] px-2 pb-3 pt-3">
          {messages.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5 px-1">
              {SUGGESTIONS.slice(0, 3).map(s => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  disabled={busy}
                  className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] text-[#566174] transition hover:border-[#FFB347]/30 hover:text-[#9AA4B4] disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.04] px-5 py-4 focus-within:border-[#FFB347]/40">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input) } }}
              placeholder="Ask about your data..."
              disabled={busy}
              suppressHydrationWarning
              className="flex-1 bg-transparent text-base text-[#EDF1F6] placeholder-[#3A4555] outline-none disabled:opacity-50"
            />
            <button
              onClick={() => ask(input)}
              disabled={busy || !input.trim()}
              style={!busy && input.trim() ? { backgroundImage: 'linear-gradient(to right, #FFB347, #FF7A3D)' } : {}}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.06] transition disabled:opacity-40"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={!busy && input.trim() ? '#1A0E03' : '#566174'} strokeWidth="2.2">
                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div className="mt-2 text-center font-mono text-[9px] tracking-widest text-[#1E2A38]">
            FLUXORX DETERMINISTIC AI · ZERO HALLUCINATION · REAL DATABASE QUERIES
          </div>
        </div>

      </div>
    </AppShell>
  )
}
