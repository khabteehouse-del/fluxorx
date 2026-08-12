import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Langfuse } from 'langfuse'

const FLUXORX_SYSTEM_PROMPT = `You are FluxorX, an enterprise AI command center for business operations. You answer questions about business data in a confident, precise, executive tone. Keep answers concise and data-focused. Never mention that you are Claude or that you are an AI assistant. Never say "I think" or "I believe". Always speak as if you have direct access to the business data. If you do not have enough data to answer, say so directly without apology. Format numbers clearly. Use PKR currency formatting where relevant and prefix amounts with the rupee symbol.`

function getLangfuse() {
  try {
    const secretKey = process.env.LANGFUSE_SECRET_KEY ?? ''
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY ?? ''
    if (!secretKey || !publicKey) return null
    return new Langfuse({
      secretKey,
      publicKey,
      baseUrl: process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
    })
  } catch (_) {
    return null
  }
}

export async function POST(req: NextRequest) {
  const langfuse = getLangfuse()
  const body = await req.json()
  const { question, contextSummary, tier, intent } = body

  const trace = langfuse?.trace({
    name: 'fluxorx-agent',
    input: { question },
    metadata: { tier: tier ?? 'deterministic', intent: intent ?? 'unknown', timestamp: new Date().toISOString() },
  })

  // Deterministic tier logging only
  if (tier === 'deterministic') {
    trace?.update({
      output: body.answer ?? '',
      metadata: { tier: 'deterministic', intent, latencyMs: body.latencyMs ?? 0 },
    })
    await langfuse?.shutdownAsync()
    return NextResponse.json({ ok: true })
  }

  // Claude tier
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY ?? ''
    console.log('[agent-claude] key present:', apiKey.length > 10, 'question:', question)

    const anthropic = new Anthropic({ apiKey })
    const startTime = Date.now()

    const claudeSpan = trace?.span({
      name: 'claude-generation',
      input: { question, contextSummary },
    })

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: FLUXORX_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Here is the current business dataset summary:\n${JSON.stringify(contextSummary, null, 2)}\n\nUser question: ${question}\n\nAnswer using only the data provided above. Be concise and executive in tone.`,
      }],
    })

    const latencyMs = Date.now() - startTime
    const answer = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    const inputTokens = response.usage?.input_tokens ?? 0
    const outputTokens = response.usage?.output_tokens ?? 0

    claudeSpan?.end({
      output: { answer },
      metadata: { model: 'claude-haiku-4-5-20251001', inputTokens, outputTokens, latencyMs },
    })

    trace?.update({
      output: answer,
      metadata: { tier: 'claude', inputTokens, outputTokens, latencyMs },
    })

    console.log('[agent-claude] success, tokens:', inputTokens, '+', outputTokens)
    await langfuse?.shutdownAsync()

    return NextResponse.json({ answer, inputTokens, outputTokens, latencyMs })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[agent-claude] ERROR:', message)
    trace?.update({ output: message, metadata: { tier: 'claude', error: true } })
    await langfuse?.shutdownAsync()
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
