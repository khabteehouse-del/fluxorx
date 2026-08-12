import { SupabaseClient } from '@supabase/supabase-js'

export type LogLine = { text: string; color: string }
export type AgentTier = 'deterministic' | 'claude'

type Row = Record<string, unknown>

function num(v: unknown): number {
  const s = String(v ?? '').replace(/[, ]/g, '').trim()
  const n = Number(s)
  return Number.isNaN(n) ? 0 : Math.max(0, n)
}

function pkr(n: number) {
  if (n >= 1_000_000_000) return `\u20b9${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `\u20b9${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `\u20b9${(n / 1_000).toFixed(0)}K`
  return `\u20b9${n}`
}

function contains(q: string, ...terms: string[]) {
  return terms.some(t => q.includes(t))
}

async function getRows(supabase: SupabaseClient, uploadId: string): Promise<Row[]> {
  const { data: tbl } = await supabase
    .from('raw_tables').select('id')
    .eq('raw_upload_id', uploadId).limit(1).maybeSingle()
  if (!tbl) return []
  const { data: recs } = await supabase
    .from('raw_records').select('data')
    .eq('raw_table_id', tbl.id).order('row_index').range(0, 4999)
  return (recs ?? []).map(r => (r.data ?? {}) as Row)
}

async function logTrace(intent: string, question: string, answer: string, tier: AgentTier, latencyMs: number) {
  try {
    await fetch('/api/agent-claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, intent, question, answer, latencyMs }),
    })
  } catch (_) {}
}

export async function runAgent(
  question: string,
  supabase: SupabaseClient,
  onLog: (line: LogLine) => void
): Promise<{ answer: string; tier: AgentTier }> {
  const q = question.toLowerCase().trim()
  const log = (text: string, color = '#6FB7FF') => onLog({ text, color })

  log('\u25b8 INTENT PARSED \u00b7 analyzing your question', '#9AA4B4')
  await delay(420)

  log('\u25b8 LOCATING \u00b7 finding latest dataset', '#9AA4B4')
  const { data: upload } = await supabase
    .from('raw_uploads').select('id, file_name, row_count')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()

  if (!upload) {
    log('\u25b8 ERROR \u00b7 no data uploaded yet', '#FF6B6B')
    return { answer: 'No data has been uploaded yet. Please upload a spreadsheet first.', tier: 'deterministic' }
  }

  log(`\u25b8 DATASET \u00b7 ${upload.file_name} \u00b7 ${upload.row_count} rows`, '#566174')
  await delay(300)

  const t0 = Date.now()

  // ----- OVERDUE / INVOICE -----
  if (contains(q, 'overdue', 'unpaid', 'outstanding', 'invoice', 'payment due') && !contains(q, 'write', 'draft', 'compose', 'send email', 'professional email')) {
    log('\u25b8 QUERYING \u00b7 scanning invoice_status column', '#6FB7FF')
    const rows = await getRows(supabase, upload.id)
    await delay(350)
    const overdue = rows.filter(r => String(r['Invoice Status'] ?? '').trim().toLowerCase() === 'overdue')
    const unpaid  = rows.filter(r => String(r['Invoice Status'] ?? '').trim().toLowerCase() === 'unpaid')
    log(`\u25b8 MATCHING \u00b7 ${overdue.length} overdue, ${unpaid.length} unpaid found`, '#FFB347')
    await delay(280)
    const totalOwed = overdue.reduce((s, r) => s + num(r['Contract Value (PKR)']) - num(r['Amount Paid (PKR)']), 0)
    log('\u25b8 AGGREGATING \u00b7 computing outstanding amounts', '#6FB7FF')
    await delay(300)
    log('\u25b8 COMPOSING ANSWER \u00b7 ready', '#3FB984')
    const answer = `There are ${overdue.length} overdue invoices and ${unpaid.length} unpaid invoices in your dataset. The total outstanding amount on overdue invoices is ${pkr(totalOwed)}. The projects with overdue invoices are: ${overdue.slice(0, 5).map(r => String(r['Customer Name'] ?? 'Unknown')).join(', ')}${overdue.length > 5 ? ` and ${overdue.length - 5} more` : ''}.`
    logTrace('overdue', question, answer, 'deterministic', Date.now() - t0)
    return { answer, tier: 'deterministic' }
  }

  // ----- TOP SALESPERSON -----
  if (contains(q, 'salesperson', 'sales', 'top performer', 'best performer', 'who sold', 'highest sales')) {
    log('\u25b8 QUERYING \u00b7 reading salesperson column', '#6FB7FF')
    const rows = await getRows(supabase, upload.id)
    await delay(350)
    const map: Record<string, number> = {}
    rows.forEach(r => {
      const s = String(r['Salesperson'] ?? '').trim()
      if (s) map[s] = (map[s] || 0) + num(r['Contract Value (PKR)'])
    })
    log('\u25b8 RANKING \u00b7 sorting by contract value', '#FFB347')
    await delay(300)
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1])
    log('\u25b8 COMPOSING ANSWER \u00b7 ready', '#3FB984')
    const top3 = sorted.slice(0, 3).map(([n, v], i) => `${i + 1}. ${n} \u2014 ${pkr(v)}`).join(', ')
    const answer = `The top salesperson by contract value is ${sorted[0][0]} with ${pkr(sorted[0][1])} across ${rows.filter(r => String(r['Salesperson'] ?? '').trim() === sorted[0][0]).length} projects. Top 3: ${top3}.`
    logTrace('salesperson', question, answer, 'deterministic', Date.now() - t0)
    return { answer, tier: 'deterministic' }
  }

  // ----- CITY -----
  if (contains(q, 'city', 'cities', 'location', 'where', 'region', 'karachi', 'lahore', 'islamabad')) {
    log('\u25b8 QUERYING \u00b7 reading city distribution', '#6FB7FF')
    const rows = await getRows(supabase, upload.id)
    await delay(350)
    const map: Record<string, { count: number; value: number }> = {}
    rows.forEach(r => {
      const c = String(r['City'] ?? '').trim()
      if (!c) return
      map[c] = map[c] ?? { count: 0, value: 0 }
      map[c].count++
      map[c].value += num(r['Contract Value (PKR)'])
    })
    log('\u25b8 AGGREGATING \u00b7 grouping by city', '#FFB347')
    await delay(300)
    const sorted = Object.entries(map).sort((a, b) => b[1].value - a[1].value)
    log('\u25b8 COMPOSING ANSWER \u00b7 ready', '#3FB984')
    const top = sorted.slice(0, 3).map(([c, v]) => `${c} (${v.count} projects, ${pkr(v.value)})`).join(', ')
    const answer = `Your top cities by contract value are: ${top}. ${sorted[0][0]} leads with ${sorted[0][1].count} projects worth ${pkr(sorted[0][1].value)}.`
    logTrace('city', question, answer, 'deterministic', Date.now() - t0)
    return { answer, tier: 'deterministic' }
  }

  // ----- DELAYED -----
  if (contains(q, 'delayed', 'stuck', 'behind', 'late', 'problem project', 'at risk')) {
    log('\u25b8 QUERYING \u00b7 filtering Stage = Delayed', '#6FB7FF')
    const rows = await getRows(supabase, upload.id)
    await delay(350)
    const delayed = rows.filter(r => String(r['Stage'] ?? '').trim().toLowerCase() === 'delayed')
    log(`\u25b8 MATCHING \u00b7 ${delayed.length} delayed projects found`, '#FFB347')
    await delay(300)
    log('\u25b8 COMPOSING ANSWER \u00b7 ready', '#3FB984')
    const names = delayed.slice(0, 5).map(r => `${String(r['Customer Name'] ?? 'Unknown')} (${String(r['City'] ?? '')})`).join(', ')
    const totalValue = delayed.reduce((s, r) => s + num(r['Contract Value (PKR)']), 0)
    const answer = `There are ${delayed.length} delayed projects with a combined contract value of ${pkr(totalValue)}. They include: ${names}${delayed.length > 5 ? ` and ${delayed.length - 5} more` : ''}. These should be reviewed for timeline recovery.`
    logTrace('delayed', question, answer, 'deterministic', Date.now() - t0)
    return { answer, tier: 'deterministic' }
  }

  // ----- COLLECTION / REVENUE -----
  if (contains(q, 'collect', 'revenue', 'received', 'paid', 'total contract', 'total value', 'how much')) {
    log('\u25b8 QUERYING \u00b7 reading contract and payment columns', '#6FB7FF')
    const rows = await getRows(supabase, upload.id)
    await delay(350)
    const totalContract = rows.reduce((s, r) => s + num(r['Contract Value (PKR)']), 0)
    const totalPaid = rows.reduce((s, r) => s + num(r['Amount Paid (PKR)']), 0)
    const rate = totalContract > 0 ? Math.round((totalPaid / totalContract) * 100) : 0
    log(`\u25b8 AGGREGATING \u00b7 contract ${pkr(totalContract)}, collected ${pkr(totalPaid)}`, '#FFB347')
    await delay(300)
    log('\u25b8 COMPOSING ANSWER \u00b7 ready', '#3FB984')
    const answer = `Total contract value across all ${rows.length} projects is ${pkr(totalContract)}. Amount collected so far is ${pkr(totalPaid)}, giving a collection rate of ${rate}%. Outstanding balance is ${pkr(totalContract - totalPaid)}.`
    logTrace('collection', question, answer, 'deterministic', Date.now() - t0)
    return { answer, tier: 'deterministic' }
  }

  // ----- COMPLETED -----
  if (contains(q, 'completed', 'finished', 'done', 'installed')) {
    log('\u25b8 QUERYING \u00b7 filtering Stage = Completed', '#6FB7FF')
    const rows = await getRows(supabase, upload.id)
    await delay(350)
    const completed = rows.filter(r => String(r['Stage'] ?? '').trim().toLowerCase() === 'completed')
    const totalKw = completed.reduce((s, r) => s + num(r['System Size (kW)']), 0)
    log(`\u25b8 MATCHING \u00b7 ${completed.length} completed projects`, '#FFB347')
    await delay(280)
    log('\u25b8 COMPOSING ANSWER \u00b7 ready', '#3FB984')
    const answer = `${completed.length} projects have been completed, with a total installed capacity of ${totalKw.toLocaleString()} kW. Their combined contract value is ${pkr(completed.reduce((s, r) => s + num(r['Contract Value (PKR)']), 0))}.`
    logTrace('completed', question, answer, 'deterministic', Date.now() - t0)
    return { answer, tier: 'deterministic' }
  }

  // ----- CAPACITY -----
  if (contains(q, 'capacity', 'kw', 'kilowatt', 'system size', 'largest', 'biggest system')) {
    log('\u25b8 QUERYING \u00b7 reading system size column', '#6FB7FF')
    const rows = await getRows(supabase, upload.id)
    await delay(350)
    const sorted = [...rows].sort((a, b) => num(b['System Size (kW)']) - num(a['System Size (kW)']))
    const totalKw = rows.reduce((s, r) => s + num(r['System Size (kW)']), 0)
    log(`\u25b8 AGGREGATING \u00b7 total ${totalKw.toLocaleString()} kW across ${rows.length} projects`, '#FFB347')
    await delay(280)
    log('\u25b8 COMPOSING ANSWER \u00b7 ready', '#3FB984')
    const top = sorted[0]
    const answer = `Total installed and contracted capacity is ${totalKw.toLocaleString()} kW. The largest single system is ${num(top['System Size (kW)'])} kW for ${String(top['Customer Name'] ?? 'Unknown')} in ${String(top['City'] ?? '')}. Average system size is ${(totalKw / rows.length).toFixed(1)} kW.`
    logTrace('capacity', question, answer, 'deterministic', Date.now() - t0)
    return { answer, tier: 'deterministic' }
  }

  // ----- DATA HEALTH -----
  if (contains(q, 'data quality', 'health', 'issues', 'errors', 'problems', 'validation', 'clean')) {
    log('\u25b8 QUERYING \u00b7 reading validation_reports table', '#6FB7FF')
    await delay(350)
    const { data: vr } = await supabase
      .from('validation_reports').select('readiness_score, total_records, valid_records, warnings, critical_errors')
      .eq('raw_upload_id', upload.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    log('\u25b8 COMPOSING ANSWER \u00b7 ready', '#3FB984')
    if (!vr) return { answer: 'No validation has been run yet. Go to the Validation page to scan your data.', tier: 'deterministic' }
    const answer = `Your data health score is ${vr.readiness_score}/100. Out of ${vr.total_records} records, ${vr.valid_records} are clean. There are ${vr.warnings} warnings and ${vr.critical_errors} critical errors. ${vr.readiness_score >= 85 ? 'Data quality is good.' : vr.readiness_score >= 60 ? 'Some issues need attention before reporting.' : 'Significant data quality issues detected. Review the Validation page.'}`
    logTrace('datahealth', question, answer, 'deterministic', Date.now() - t0)
    return { answer, tier: 'deterministic' }
  }

  // ----- SUMMARY -----
  if (contains(q, 'summary', 'overview', 'tell me about', 'what do we have', 'status', 'report')) {
    log('\u25b8 QUERYING \u00b7 running full dataset summary', '#6FB7FF')
    const rows = await getRows(supabase, upload.id)
    await delay(400)
    const stages: Record<string, number> = {}
    rows.forEach(r => {
      const s = String(r['Stage'] ?? '').trim()
      if (s) stages[s] = (stages[s] || 0) + 1
    })
    const totalContract = rows.reduce((s, r) => s + num(r['Contract Value (PKR)']), 0)
    const totalPaid = rows.reduce((s, r) => s + num(r['Amount Paid (PKR)']), 0)
    log('\u25b8 AGGREGATING \u00b7 computing pipeline summary', '#FFB347')
    await delay(350)
    log('\u25b8 COMPOSING ANSWER \u00b7 ready', '#3FB984')
    const stageStr = Object.entries(stages).map(([s, c]) => `${c} ${s}`).join(', ')
    const answer = `Here is your pipeline summary: ${rows.length} total projects worth ${pkr(totalContract)}. Collection rate is ${Math.round((totalPaid / totalContract) * 100)}%. Stage breakdown: ${stageStr}. Upload: ${upload.file_name}.`
    logTrace('summary', question, answer, 'deterministic', Date.now() - t0)
    return { answer, tier: 'deterministic' }
  }

  // ----- CLAUDE FALLBACK TIER -----
  log('\u25b8 INTENT \u00b7 routing to Claude intelligence tier', '#9B8FFF')
  await delay(300)
  log('\u25b8 CONTEXT \u00b7 loading dataset for Claude', '#9B8FFF')

  const rows = await getRows(supabase, upload.id)
  await delay(300)

  const contextSummary = {
    totalProjects: rows.length,
    totalContractValue: rows.reduce((s, r) => s + num(r['Contract Value (PKR)']), 0),
    totalPaid: rows.reduce((s, r) => s + num(r['Amount Paid (PKR)']), 0),
    stages: rows.reduce((acc: Record<string, number>, r) => {
      const s = String(r['Stage'] ?? '').trim()
      if (s) acc[s] = (acc[s] || 0) + 1
      return acc
    }, {}),
    overdueCount: rows.filter(r => String(r['Invoice Status'] ?? '').toLowerCase() === 'overdue').length,
    delayedCount: rows.filter(r => String(r['Stage'] ?? '').toLowerCase() === 'delayed').length,
    sampleRecords: rows.slice(0, 10).map(r => ({
      customer: r['Customer Name'],
      city: r['City'],
      stage: r['Stage'],
      contractValue: r['Contract Value (PKR)'],
      amountPaid: r['Amount Paid (PKR)'],
      invoiceStatus: r['Invoice Status'],
      salesperson: r['Salesperson'],
      systemSize: r['System Size (kW)'],
    })),
  }

  log('\u25b8 CLAUDE \u00b7 composing grounded response', '#9B8FFF')
  await delay(400)

  try {
    const res = await fetch('/api/agent-claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, contextSummary, tier: 'claude' }),
    })

    if (!res.ok) throw new Error(`API error ${res.status}`)
    const data = await res.json()
    if (data.error) throw new Error(data.error)

    log('\u25b8 CLAUDE \u00b7 response ready', '#3FB984')
    return { answer: data.answer, tier: 'claude' }

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Claude API error'
    log('\u25b8 ERROR \u00b7 Claude tier failed', '#FF6B6B')
    return {
      answer: 'I could not process this question at the moment. Please try rephrasing or ask about overdue invoices, salesperson performance, city breakdown, delayed projects, collection rates, completed installs, system capacity, data health, or a general summary.',
      tier: 'deterministic',
    }
  }
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
