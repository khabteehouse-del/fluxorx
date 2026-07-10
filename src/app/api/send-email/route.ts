import { NextRequest, NextResponse } from 'next/server'

const RECIPIENT = 'khabteehouse@gmail.com'
const FROM      = 'FluxorX Alerts <onboarding@resend.dev>'

function buildHtml(payload: {
  title: string
  summary: string
  meta: string
  priority: string
  rows: Record<string, string>[]
  headers: string[]
  sentAt: string
}) {
  const priorityColor =
    payload.priority === 'critical' ? '#FF6B6B'
    : payload.priority === 'warning' ? '#FFB347'
    : '#6FB7FF'

  const tableRows = payload.rows.slice(0, 10).map(row =>
    `<tr>${payload.headers.map(h => `<td style="padding:8px 12px;border-bottom:1px solid #1E2A3A;font-size:12px;color:#9AA4B4;white-space:nowrap;">${row[h] ?? '—'}</td>`).join('')}</tr>`
  ).join('')

  const headerCells = payload.headers.map(h =>
    `<th style="padding:8px 12px;text-align:left;font-size:10px;font-family:monospace;letter-spacing:0.1em;color:#566174;border-bottom:1px solid #2A3A4A;white-space:nowrap;">${h.toUpperCase()}</th>`
  ).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#06080D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#06080D;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="padding-bottom:24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:20px;font-weight:600;color:#EDF1F6;letter-spacing:-0.02em;">
                Fluxor<span style="color:#FFB347;">X</span>
              </td>
              <td align="right" style="font-size:10px;font-family:monospace;color:#566174;letter-spacing:0.1em;">
                AUTOMATED ALERT
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Priority bar -->
        <tr><td style="height:3px;background:${priorityColor};border-radius:2px;margin-bottom:24px;display:block;"></td></tr>
        <tr><td style="padding-top:4px;"></td></tr>

        <!-- Title card -->
        <tr><td style="background:#0D1117;border:1px solid #1E2A3A;border-radius:12px;padding:24px;margin-bottom:20px;">
          <div style="display:inline-block;background:${priorityColor}1F;color:${priorityColor};font-size:10px;font-family:monospace;letter-spacing:0.15em;padding:4px 10px;border-radius:20px;margin-bottom:12px;">
            ${payload.priority.toUpperCase()} · ${payload.meta}
          </div>
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#EDF1F6;letter-spacing:-0.02em;">${payload.title}</h1>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#9AA4B4;">${payload.summary}</p>
        </td></tr>

        <tr><td style="height:16px;"></td></tr>

        <!-- Data table -->
        ${payload.rows.length > 0 ? `
        <tr><td style="background:#0A0F18;border:1px solid #1E2A3A;border-radius:12px;overflow:hidden;">
          <div style="padding:16px 16px 8px;font-size:10px;font-family:monospace;letter-spacing:0.15em;color:#566174;border-bottom:1px solid #1E2A3A;">
            AFFECTED RECORDS · ${payload.rows.length} ROWS${payload.rows.length > 10 ? ' (SHOWING FIRST 10)' : ''}
          </div>
          <div style="overflow-x:auto;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <thead><tr style="background:#060A10;">${headerCells}</tr></thead>
              <tbody>${tableRows}</tbody>
            </table>
          </div>
        </td></tr>
        ` : ''}

        <tr><td style="height:24px;"></td></tr>

        <!-- Footer -->
        <tr><td style="border-top:1px solid #1E2A3A;padding-top:20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:11px;color:#3A4555;">
                Sent by FluxorX · ${payload.sentAt}
              </td>
              <td align="right" style="font-size:10px;font-family:monospace;color:#2A3444;letter-spacing:0.1em;">
                DETERMINISTIC AI · ZERO HALLUCINATION
              </td>
            </tr>
          </table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, summary, meta, priority, rows, headers } = body

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 500 })
    }

    const sentAt = new Date().toLocaleString('en-PK', {
      timeZone: 'Asia/Karachi',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

    const html = buildHtml({ title, summary, meta, priority, rows: rows ?? [], headers: headers ?? [], sentAt })

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [RECIPIENT],
        subject: `FluxorX Alert: ${title}`,
        html,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ error: data.message ?? 'Resend error' }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data.id, sentAt })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
