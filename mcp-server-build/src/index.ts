#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_KEY)
}

function num(v: unknown): number {
  const s = String(v ?? '').replace(/[, ]/g, '').trim()
  const n = Number(s)
  return Number.isNaN(n) ? 0 : Math.max(0, n)
}

function pkr(n: number): string {
  if (n >= 1_000_000_000) return `Rs${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `Rs${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `Rs${(n / 1_000).toFixed(0)}K`
  return `Rs${n}`
}

type Row = Record<string, unknown>

async function getLatestUpload() {
  const sb = getSupabase()
  const { data } = await sb
    .from('raw_uploads')
    .select('id, file_name, row_count')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

async function getRows(uploadId: string): Promise<Row[]> {
  const sb = getSupabase()
  const { data: tbl } = await sb
    .from('raw_tables')
    .select('id')
    .eq('raw_upload_id', uploadId)
    .limit(1)
    .maybeSingle()
  if (!tbl) return []
  const { data: recs } = await sb
    .from('raw_records')
    .select('data')
    .eq('raw_table_id', tbl.id)
    .order('row_index')
    .range(0, 4999)
  return (recs ?? []).map(r => (r.data ?? {}) as Row)
}

// Tool handlers

async function getOverdueInvoices() {
  const upload = await getLatestUpload()
  if (!upload) return 'No data uploaded yet.'
  const rows = await getRows(upload.id)
  const overdue = rows.filter(r => String(r['Invoice Status'] ?? '').toLowerCase() === 'overdue')
  const unpaid = rows.filter(r => String(r['Invoice Status'] ?? '').toLowerCase() === 'unpaid')
  const totalOwed = overdue.reduce((s, r) => s + num(r['Contract Value (PKR)']) - num(r['Amount Paid (PKR)']), 0)
  const names = overdue.slice(0, 5).map(r => String(r['Customer Name'] ?? 'Unknown')).join(', ')
  return `Overdue: ${overdue.length} invoices, ${unpaid.length} unpaid. Total outstanding: ${pkr(totalOwed)}. Customers: ${names}${overdue.length > 5 ? ` and ${overdue.length - 5} more` : ''}.`
}

async function getTopSalesperson() {
  const upload = await getLatestUpload()
  if (!upload) return 'No data uploaded yet.'
  const rows = await getRows(upload.id)
  const map: Record<string, number> = {}
  rows.forEach(r => {
    const s = String(r['Salesperson'] ?? '').trim()
    if (s) map[s] = (map[s] || 0) + num(r['Contract Value (PKR)'])
  })
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1])
  if (!sorted.length) return 'No salesperson data found.'
  const top3 = sorted.slice(0, 3).map(([n, v], i) => `${i + 1}. ${n} - ${pkr(v)}`).join(', ')
  const count = rows.filter(r => String(r['Salesperson'] ?? '').trim() === sorted[0][0]).length
  return `Top salesperson: ${sorted[0][0]} with ${pkr(sorted[0][1])} across ${count} projects. Top 3: ${top3}.`
}

async function getCityBreakdown() {
  const upload = await getLatestUpload()
  if (!upload) return 'No data uploaded yet.'
  const rows = await getRows(upload.id)
  const map: Record<string, { count: number; value: number }> = {}
  rows.forEach(r => {
    const c = String(r['City'] ?? '').trim()
    if (!c) return
    map[c] = map[c] ?? { count: 0, value: 0 }
    map[c].count++
    map[c].value += num(r['Contract Value (PKR)'])
  })
  const sorted = Object.entries(map).sort((a, b) => b[1].value - a[1].value)
  const top = sorted.slice(0, 3).map(([c, v]) => `${c} (${v.count} projects, ${pkr(v.value)})`).join(', ')
  return `Top cities by contract value: ${top}.`
}

async function getDelayedProjects() {
  const upload = await getLatestUpload()
  if (!upload) return 'No data uploaded yet.'
  const rows = await getRows(upload.id)
  const delayed = rows.filter(r => String(r['Stage'] ?? '').toLowerCase() === 'delayed')
  const totalValue = delayed.reduce((s, r) => s + num(r['Contract Value (PKR)']), 0)
  const names = delayed.slice(0, 5).map(r => `${String(r['Customer Name'] ?? 'Unknown')} (${String(r['City'] ?? '')})`).join(', ')
  return `Delayed projects: ${delayed.length}, combined value: ${pkr(totalValue)}. Projects: ${names}${delayed.length > 5 ? ` and ${delayed.length - 5} more` : ''}.`
}

async function getCollectionRate() {
  const upload = await getLatestUpload()
  if (!upload) return 'No data uploaded yet.'
  const rows = await getRows(upload.id)
  const totalContract = rows.reduce((s, r) => s + num(r['Contract Value (PKR)']), 0)
  const totalPaid = rows.reduce((s, r) => s + num(r['Amount Paid (PKR)']), 0)
  const rate = totalContract > 0 ? Math.round((totalPaid / totalContract) * 100) : 0
  return `Total contract value: ${pkr(totalContract)}. Collected: ${pkr(totalPaid)}. Collection rate: ${rate}%. Outstanding: ${pkr(totalContract - totalPaid)}.`
}

async function getCompletedInstallations() {
  const upload = await getLatestUpload()
  if (!upload) return 'No data uploaded yet.'
  const rows = await getRows(upload.id)
  const completed = rows.filter(r => String(r['Stage'] ?? '').toLowerCase() === 'completed')
  const totalKw = completed.reduce((s, r) => s + num(r['System Size (kW)']), 0)
  const totalValue = completed.reduce((s, r) => s + num(r['Contract Value (PKR)']), 0)
  return `Completed installations: ${completed.length}, total capacity: ${totalKw.toLocaleString()} kW, combined value: ${pkr(totalValue)}.`
}

async function getSystemCapacity() {
  const upload = await getLatestUpload()
  if (!upload) return 'No data uploaded yet.'
  const rows = await getRows(upload.id)
  const sorted = [...rows].sort((a, b) => num(b['System Size (kW)']) - num(a['System Size (kW)']))
  const totalKw = rows.reduce((s, r) => s + num(r['System Size (kW)']), 0)
  const top = sorted[0]
  return `Total capacity: ${totalKw.toLocaleString()} kW across ${rows.length} projects. Largest: ${num(top['System Size (kW)'])} kW for ${String(top['Customer Name'] ?? 'Unknown')} in ${String(top['City'] ?? '')}. Average: ${(totalKw / rows.length).toFixed(1)} kW.`
}

async function getPipelineSummary() {
  const upload = await getLatestUpload()
  if (!upload) return 'No data uploaded yet.'
  const rows = await getRows(upload.id)
  const stages: Record<string, number> = {}
  rows.forEach(r => {
    const s = String(r['Stage'] ?? '').trim()
    if (s) stages[s] = (stages[s] || 0) + 1
  })
  const totalContract = rows.reduce((s, r) => s + num(r['Contract Value (PKR)']), 0)
  const totalPaid = rows.reduce((s, r) => s + num(r['Amount Paid (PKR)']), 0)
  const rate = Math.round((totalPaid / totalContract) * 100)
  const stageStr = Object.entries(stages).map(([s, c]) => `${c} ${s}`).join(', ')
  return `Pipeline: ${rows.length} projects worth ${pkr(totalContract)}. Collection rate: ${rate}%. Stages: ${stageStr}. File: ${upload.file_name}.`
}

// Tool definitions
const TOOLS = [
  {
    name: 'get_overdue_invoices',
    description: 'Returns all overdue and unpaid invoices from the FluxorX database with total outstanding amount and customer names.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_top_salesperson',
    description: 'Returns the top salesperson by contract value with rankings for top 3.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_city_breakdown',
    description: 'Returns project distribution and contract value by city.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_delayed_projects',
    description: 'Returns all delayed projects with combined contract value and customer names.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_collection_rate',
    description: 'Returns total contract value, amount collected, collection rate percentage, and outstanding balance.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_completed_installations',
    description: 'Returns count of completed installations, total installed capacity in kW, and combined contract value.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_system_capacity',
    description: 'Returns total system capacity in kW, the largest single installation, and average system size.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_pipeline_summary',
    description: 'Returns a full pipeline summary including total projects, contract value, collection rate, and stage breakdown.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
]

// Server setup
const server = new Server(
  { name: 'fluxorx-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params

  try {
    let result = ''

    if (name === 'get_overdue_invoices') result = await getOverdueInvoices()
    else if (name === 'get_top_salesperson') result = await getTopSalesperson()
    else if (name === 'get_city_breakdown') result = await getCityBreakdown()
    else if (name === 'get_delayed_projects') result = await getDelayedProjects()
    else if (name === 'get_collection_rate') result = await getCollectionRate()
    else if (name === 'get_completed_installations') result = await getCompletedInstallations()
    else if (name === 'get_system_capacity') result = await getSystemCapacity()
    else if (name === 'get_pipeline_summary') result = await getPipelineSummary()
    else throw new Error(`Unknown tool: ${name}`)

    return {
      content: [{ type: 'text', text: result }],
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Tool execution failed'
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    }
  }
})

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables')
    process.exit(1)
  }
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('FluxorX MCP server running on stdio')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
