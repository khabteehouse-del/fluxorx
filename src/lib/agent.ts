import { SupabaseClient } from '@supabase/supabase-js'

export type LogLine = { text: string; color: string }

export type AgentResult = {
  answer: string
  logs: LogLine[]
}

type Row = Record<string, unknown>

function num(v: unknown): number {
  const s = String(v ?? '').replace(/[, ]/g, '').trim()
  const n = Number(s)
  return Number.isNaN(n) ? 0 : Math.max(0, n)
}

function pkr(n: number) {
  if (n >= 1_000_000_000) return `₨${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `₨${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `₨${(n / 1_000).toFixed(0)}K`
  return `₨${n}`
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

export async function runAgent(
  question: string,
  supabase: SupabaseClient,
  onLog: (line: LogLine) => void
): Promise<string> {
  const q = question.toLowerCase().trim()
  const log = (text: string, color = '#6FB7FF') => onLog({ text, color })

  log('▸ INTENT PARSED · analyzing your question', '#9AA4B4')
  await delay(420)

  // Get latest upload
  log('▸ LOCATING · finding latest dataset', '#9AA4B4')
  const { data: upload } = await supabase
    .from('raw_uploads').select('id, file_name, row_count')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()

  if (!upload) {
    log('▸ ERROR · no data uploaded yet', '#FF6B6B')
    return 'No data has been uploaded yet. Please upload a spreadsheet first.'
  }

  log(`▸ DATASET · ${upload.file_name} · ${upload.row_count} rows`, '#566174')
  await delay(300)

  // ----- OVERDUE / INVOICE -----
  if (contains(q, 'overdue', 'unpaid', 'outstanding', 'invoice', 'payment due')) {
    log('▸ QUERYING · scanning invoice_status column', '#6FB7FF')
    const rows = await getRows(supabase, upload.id)
    await delay(350)
    const overdue = rows.filter(r => String(r['Invoice Status'] ?? '').trim().toLowerCase() === 'overdue')
    const unpaid  = rows.filter(r => String(r['Invoice Status'] ?? '').trim().toLowerCase() === 'unpaid')
    log(`▸ MATCHING · ${overdue.length} overdue, ${unpaid.length} unpaid found`, '#FFB347')
    await delay(280)
    const totalOwed = overdue.reduce((s, r) => s + num(r['Contract Value (PKR)']) - num(r['Amount Paid (PKR)']), 0)
    log('▸ AGGREGATING · computing outstanding amounts', '#6FB7FF')
    await delay(300)
    log('▸ COMPOSING ANSWER · ready', '#3FB984')
    return `There are ${overdue.length} overdue invoices and ${unpaid.length} unpaid invoices in your dataset. The total outstanding amount on overdue invoices is ${pkr(totalOwed)}. The projects with overdue invoices are: ${overdue.slice(0, 5).map(r => String(r['Customer Name'] ?? 'Unknown')).join(', ')}${overdue.length > 5 ? ` and ${overdue.length - 5} more` : ''}.`
  }

  // ----- TOP SALESPERSON -----
  if (contains(q, 'salesperson', 'sales', 'top performer', 'best performer', 'who sold', 'highest sales')) {
    log('▸ QUERYING · reading salesperson column', '#6FB7FF')
    const rows = await getRows(supabase, upload.id)
    await delay(350)
    const map: Record<string, number> = {}
    rows.forEach(r => {
      const s = String(r['Salesperson'] ?? '').trim()
      if (s) map[s] = (map[s] || 0) + num(r['Contract Value (PKR)'])
    })
    log('▸ RANKING · sorting by contract value', '#FFB347')
    await delay(300)
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1])
    log('▸ COMPOSING ANSWER · ready', '#3FB984')
    const top3 = sorted.slice(0, 3).map(([n, v], i) => `${i + 1}. ${n} — ${pkr(v)}`).join(', ')
    return `The top salesperson by contract value is ${sorted[0][0]} with ${pkr(sorted[0][1])} across ${rows.filter(r => String(r['Salesperson'] ?? '').trim() === sorted[0][0]).length} projects. Top 3: ${top3}.`
  }

  // ----- CITY -----
  if (contains(q, 'city', 'cities', 'location', 'where', 'region', 'karachi', 'lahore', 'islamabad')) {
    log('▸ QUERYING · reading city distribution', '#6FB7FF')
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
    log('▸ AGGREGATING · grouping by city', '#FFB347')
    await delay(300)
    const sorted = Object.entries(map).sort((a, b) => b[1].value - a[1].value)
    log('▸ COMPOSING ANSWER · ready', '#3FB984')
    const top = sorted.slice(0, 3).map(([c, v]) => `${c} (${v.count} projects, ${pkr(v.value)})`).join(', ')
    return `Your top cities by contract value are: ${top}. ${sorted[0][0]} leads with ${sorted[0][1].count} projects worth ${pkr(sorted[0][1].value)}.`
  }

  // ----- DELAYED / STUCK -----
  if (contains(q, 'delayed', 'stuck', 'behind', 'late', 'problem project', 'at risk')) {
    log('▸ QUERYING · filtering Stage = Delayed', '#6FB7FF')
    const rows = await getRows(supabase, upload.id)
    await delay(350)
    const delayed = rows.filter(r => String(r['Stage'] ?? '').trim().toLowerCase() === 'delayed')
    log(`▸ MATCHING · ${delayed.length} delayed projects found`, '#FFB347')
    await delay(300)
    log('▸ COMPOSING ANSWER · ready', '#3FB984')
    const names = delayed.slice(0, 5).map(r => `${String(r['Customer Name'] ?? 'Unknown')} (${String(r['City'] ?? '')})`).join(', ')
    const totalValue = delayed.reduce((s, r) => s + num(r['Contract Value (PKR)']), 0)
    return `There are ${delayed.length} delayed projects with a combined contract value of ${pkr(totalValue)}. They include: ${names}${delayed.length > 5 ? ` and ${delayed.length - 5} more` : ''}. These should be reviewed for timeline recovery.`
  }

  // ----- COLLECTION / REVENUE -----
  if (contains(q, 'collect', 'revenue', 'received', 'paid', 'total contract', 'total value', 'how much')) {
    log('▸ QUERYING · reading contract and payment columns', '#6FB7FF')
    const rows = await getRows(supabase, upload.id)
    await delay(350)
    const totalContract = rows.reduce((s, r) => s + num(r['Contract Value (PKR)']), 0)
    const totalPaid = rows.reduce((s, r) => s + num(r['Amount Paid (PKR)']), 0)
    const rate = totalContract > 0 ? Math.round((totalPaid / totalContract) * 100) : 0
    log(`▸ AGGREGATING · contract ${pkr(totalContract)}, collected ${pkr(totalPaid)}`, '#FFB347')
    await delay(300)
    log('▸ COMPOSING ANSWER · ready', '#3FB984')
    return `Total contract value across all ${rows.length} projects is ${pkr(totalContract)}. Amount collected so far is ${pkr(totalPaid)}, giving a collection rate of ${rate}%. Outstanding balance is ${pkr(totalContract - totalPaid)}.`
  }

  // ----- COMPLETED -----
  if (contains(q, 'completed', 'finished', 'done', 'installed')) {
    log('▸ QUERYING · filtering Stage = Completed', '#6FB7FF')
    const rows = await getRows(supabase, upload.id)
    await delay(350)
    const completed = rows.filter(r => String(r['Stage'] ?? '').trim().toLowerCase() === 'completed')
    const totalKw = completed.reduce((s, r) => s + num(r['System Size (kW)']), 0)
    log(`▸ MATCHING · ${completed.length} completed projects`, '#FFB347')
    await delay(280)
    log('▸ COMPOSING ANSWER · ready', '#3FB984')
    return `${completed.length} projects have been completed, with a total installed capacity of ${totalKw.toLocaleString()} kW. Their combined contract value is ${pkr(completed.reduce((s, r) => s + num(r['Contract Value (PKR)']), 0))}.`
  }

  // ----- CAPACITY / KW -----
  if (contains(q, 'capacity', 'kw', 'kilowatt', 'system size', 'largest', 'biggest system')) {
    log('▸ QUERYING · reading system size column', '#6FB7FF')
    const rows = await getRows(supabase, upload.id)
    await delay(350)
    const sorted = [...rows].sort((a, b) => num(b['System Size (kW)']) - num(a['System Size (kW)']))
    const totalKw = rows.reduce((s, r) => s + num(r['System Size (kW)']), 0)
    log(`▸ AGGREGATING · total ${totalKw.toLocaleString()} kW across ${rows.length} projects`, '#FFB347')
    await delay(280)
    log('▸ COMPOSING ANSWER · ready', '#3FB984')
    const top = sorted[0]
    return `Total installed and contracted capacity is ${totalKw.toLocaleString()} kW. The largest single system is ${num(top['System Size (kW)'])} kW for ${String(top['Customer Name'] ?? 'Unknown')} in ${String(top['City'] ?? '')}. Average system size is ${(totalKw / rows.length).toFixed(1)} kW.`
  }

  // ----- DATA HEALTH -----
  if (contains(q, 'data quality', 'health', 'issues', 'errors', 'problems', 'validation', 'clean')) {
    log('▸ QUERYING · reading validation_reports table', '#6FB7FF')
    await delay(350)
    const { data: vr } = await supabase
      .from('validation_reports').select('readiness_score, total_records, valid_records, warnings, critical_errors')
      .eq('raw_upload_id', upload.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    log('▸ COMPOSING ANSWER · ready', '#3FB984')
    if (!vr) return 'No validation has been run yet. Go to the Validation page to scan your data.'
    return `Your data health score is ${vr.readiness_score}/100. Out of ${vr.total_records} records, ${vr.valid_records} are clean. There are ${vr.warnings} warnings and ${vr.critical_errors} critical errors. ${vr.readiness_score >= 85 ? 'Data quality is good.' : vr.readiness_score >= 60 ? 'Some issues need attention before reporting.' : 'Significant data quality issues detected. Review the Validation page.'}`
  }

  // ----- SUMMARY -----
  if (contains(q, 'summary', 'overview', 'tell me about', 'what do we have', 'status', 'report')) {
    log('▸ QUERYING · running full dataset summary', '#6FB7FF')
    const rows = await getRows(supabase, upload.id)
    await delay(400)
    const stages: Record<string, number> = {}
    rows.forEach(r => {
      const s = String(r['Stage'] ?? '').trim()
      if (s) stages[s] = (stages[s] || 0) + 1
    })
    const totalContract = rows.reduce((s, r) => s + num(r['Contract Value (PKR)']), 0)
    const totalPaid = rows.reduce((s, r) => s + num(r['Amount Paid (PKR)']), 0)
    log('▸ AGGREGATING · computing pipeline summary', '#FFB347')
    await delay(350)
    log('▸ COMPOSING ANSWER · ready', '#3FB984')
    const stageStr = Object.entries(stages).map(([s, c]) => `${c} ${s}`).join(', ')
    return `Here is your pipeline summary: ${rows.length} total projects worth ${pkr(totalContract)}. Collection rate is ${Math.round((totalPaid / totalContract) * 100)}%. Stage breakdown: ${stageStr}. Upload: ${upload.file_name}.`
  }

  // ----- FALLBACK -----
  log('▸ INTENT · query pattern not matched', '#FF6B6B')
  await delay(300)
  log('▸ COMPOSING ANSWER · suggesting alternatives', '#9AA4B4')
  return `I understood your question but could not match it to a known query pattern. Try asking about: overdue invoices, top salesperson, city breakdown, delayed projects, collection rates, completed installs, system capacity, data health, or a general summary.`
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
