'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import AppShell from '@/components/app-shell'
import { createClient } from '@/lib/supabase/client'
import { auditLog } from '@/lib/audit'

type Phase = 'idle' | 'parsing' | 'preview' | 'landing' | 'done' | 'error'

type Parsed = {
  fileName: string
  fileSize: number
  sheetName: string
  headers: string[]
  rows: Record<string, string>[]
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export default function UploadPage() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [progress, setProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      const { data: prof } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', data.user.id)
        .single()
      if (prof?.organization_id) setOrgId(prof.organization_id)
      else setSetupNeeded(true)
    })
  }, [])

  function loadDemoData() {
    const headers = ['Project ID','Customer Name','City','System Size (kW)','Contract Value (PKR)','Amount Paid (PKR)','Stage','Install Date','Invoice Status','Salesperson']
    const demoRows: Record<string, string>[] = [
      {'Project ID':'SOL-2001','Customer Name':'Greaves Solar Ltd','City':'Karachi','System Size (kW)':'100','Contract Value (PKR)':'18500000','Amount Paid (PKR)':'18500000','Stage':'Completed','Install Date':'2026-01-15','Invoice Status':'Paid','Salesperson':'Bilal Ahmed'},
      {'Project ID':'SOL-2002','Customer Name':'Atlas Power Co','City':'Lahore','System Size (kW)':'50','Contract Value (PKR)':'9250000','Amount Paid (PKR)':'4625000','Stage':'In Progress','Install Date':'2026-03-10','Invoice Status':'Partial','Salesperson':'Sana Khan'},
      {'Project ID':'SOL-2003','Customer Name':'Engro Industries','City':'Karachi','System Size (kW)':'200','Contract Value (PKR)':'37000000','Amount Paid (PKR)':'0','Stage':'Quoted','Install Date':'','Invoice Status':'Unpaid','Salesperson':'Faisal Iqbal'},
      {'Project ID':'SOL-2004','Customer Name':'Lucky Cement','City':'Islamabad','System Size (kW)':'150','Contract Value (PKR)':'27750000','Amount Paid (PKR)':'27750000','Stage':'Completed','Install Date':'2026-02-20','Invoice Status':'Paid','Salesperson':'Ayesha Malik'},
      {'Project ID':'SOL-2005','Customer Name':'Hubco Energy','City':'Karachi','System Size (kW)':'75','Contract Value (PKR)':'13875000','Amount Paid (PKR)':'0','Stage':'Delayed','Install Date':'2026-01-05','Invoice Status':'Overdue','Salesperson':'Usman Tariq'},
      {'Project ID':'SOL-2006','Customer Name':'Fauji Fertilizer','City':'Rawalpindi','System Size (kW)':'120','Contract Value (PKR)':'22200000','Amount Paid (PKR)':'11100000','Stage':'In Progress','Install Date':'2026-04-01','Invoice Status':'Partial','Salesperson':'Hina Raza'},
      {'Project ID':'SOL-2007','Customer Name':'Pak Suzuki Motors','City':'Karachi','System Size (kW)':'80','Contract Value (PKR)':'14800000','Amount Paid (PKR)':'0','Stage':'Delayed','Install Date':'2026-02-14','Invoice Status':'Overdue','Salesperson':'Bilal Ahmed'},
      {'Project ID':'SOL-2008','Customer Name':'Nishat Mills','City':'Lahore','System Size (kW)':'60','Contract Value (PKR)':'11100000','Amount Paid (PKR)':'11100000','Stage':'Completed','Install Date':'2026-01-28','Invoice Status':'Paid','Salesperson':'Sana Khan'},
      {'Project ID':'SOL-2009','Customer Name':'MCB Bank','City':'Lahore','System Size (kW)':'40','Contract Value (PKR)':'7400000','Amount Paid (PKR)':'0','Stage':'Lead','Install Date':'','Invoice Status':'Unpaid','Salesperson':'Faisal Iqbal'},
      {'Project ID':'SOL-2010','Customer Name':'Packages Ltd','City':'Lahore','System Size (kW)':'90','Contract Value (PKR)':'16650000','Amount Paid (PKR)':'8325000','Stage':'In Progress','Install Date':'2026-05-01','Invoice Status':'Partial','Salesperson':'Ayesha Malik'},
      {'Project ID':'SOL-2011','Customer Name':'TPL Properties','City':'Karachi','System Size (kW)':'110','Contract Value (PKR)':'20350000','Amount Paid (PKR)':'0','Stage':'Quoted','Install Date':'','Invoice Status':'Unpaid','Salesperson':'Usman Tariq'},
      {'Project ID':'SOL-2012','Customer Name':'Arif Habib Corp','City':'Karachi','System Size (kW)':'55','Contract Value (PKR)':'10175000','Amount Paid (PKR)':'10175000','Stage':'Completed','Install Date':'2026-03-05','Invoice Status':'Paid','Salesperson':'Hina Raza'},
      {'Project ID':'SOL-2013','Customer Name':'PSO (Islamabad)','City':'Islamabad','System Size (kW)':'130','Contract Value (PKR)':'24050000','Amount Paid (PKR)':'0','Stage':'Delayed','Install Date':'2026-02-01','Invoice Status':'Overdue','Salesperson':'Bilal Ahmed'},
      {'Project ID':'SOL-2014','Customer Name':'Sui Northern Gas','City':'Lahore','System Size (kW)':'95','Contract Value (PKR)':'17575000','Amount Paid (PKR)':'17575000','Stage':'Completed','Install Date':'2026-01-10','Invoice Status':'Paid','Salesperson':'Sana Khan'},
      {'Project ID':'SOL-2015','Customer Name':'Millat Tractors','City':'Lahore','System Size (kW)':'70','Contract Value (PKR)':'12950000','Amount Paid (PKR)':'6475000','Stage':'In Progress','Install Date':'2026-04-15','Invoice Status':'Partial','Salesperson':'Faisal Iqbal'},
    ]
    setParsed({
      fileName: 'SAP_B1_Greaves_Solar_Demo.xlsx',
      fileSize: 0,
      sheetName: 'Projects',
      headers,
      rows: demoRows,
    })
    setPhase('preview')
  }

  async function handleFile(file: File) {
    setError(null)
    setPhase('parsing')
    try {
      const mod = await import('xlsx')
      const XLSX = (mod as unknown as { default?: typeof mod }).default ?? mod
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheetName = wb.SheetNames[0]
      const sheet = wb.Sheets[sheetName]
      const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        raw: false,
        defval: '',
        blankrows: false,
      })
      if (!matrix.length) throw new Error('That file looks empty.')

      const headers = (matrix[0] || []).map((h) => String(h ?? '').trim())
      if (!headers.some((h) => h.length)) throw new Error('No column headers found in the first row.')

      const rows: Record<string, string>[] = []
      for (let i = 1; i < matrix.length; i++) {
        const r = matrix[i] || []
        const empty = r.every((c) => String(c ?? '').trim() === '')
        if (empty) continue
        const obj: Record<string, string> = {}
        headers.forEach((h, idx) => {
          obj[h || `column_${idx + 1}`] = r[idx] != null ? String(r[idx]) : ''
        })
        rows.push(obj)
      }
      if (!rows.length) throw new Error('No data rows found under the headers.')

      setParsed({
        fileName: file.name,
        fileSize: file.size,
        sheetName,
        headers: headers.map((h, i) => h || `column_${i + 1}`),
        rows,
      })
      setPhase('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.')
      setPhase('error')
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  async function land() {
    if (!parsed || !orgId || !userId) return
    setError(null)
    setPhase('landing')
    setProgress(0)
    const supabase = createClient()

    try {
      const { data: up, error: upErr } = await supabase
        .from('raw_uploads')
        .insert({
          organization_id: orgId,
          uploaded_by: userId,
          file_name: parsed.fileName,
          file_size: parsed.fileSize,
          status: 'running',
          row_count: parsed.rows.length,
        })
        .select('id')
        .single()
      if (upErr) throw upErr

      const { data: tbl, error: tblErr } = await supabase
        .from('raw_tables')
        .insert({
          organization_id: orgId,
          raw_upload_id: up.id,
          table_name: parsed.sheetName,
          column_headers: parsed.headers,
          row_count: parsed.rows.length,
        })
        .select('id')
        .single()
      if (tblErr) throw tblErr

      const CHUNK = 500
      for (let i = 0; i < parsed.rows.length; i += CHUNK) {
        const slice = parsed.rows.slice(i, i + CHUNK).map((data, j) => ({
          organization_id: orgId,
          raw_table_id: tbl.id,
          row_index: i + j,
          data,
        }))
        const { error: recErr } = await supabase.from('raw_records').insert(slice)
        if (recErr) throw recErr
        setProgress(Math.min(100, Math.round(((i + slice.length) / parsed.rows.length) * 100)))
      }

      await supabase.from('raw_uploads').update({ status: 'success' }).eq('id', up.id)
      await auditLog(supabase, 'upload', {
        entity: 'raw_upload',
        entityId: up.id,
        metadata: { fileName: parsed.fileName, rowCount: parsed.rows.length },
      })
      setPhase('done')
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: unknown }).message)
          : 'The upload could not be saved.'
      setError(msg)
      setPhase('error')
    }
  }

  function reset() {
    setParsed(null)
    setError(null)
    setProgress(0)
    setPhase('idle')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <AppShell title="Data upload">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Bring in your data
          </h2>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[#9AA4B4]">
            Upload a spreadsheet. BeyondIQ reads it exactly as received and lands it
            into raw storage, ready for validation.
          </p>
        </div>

        {setupNeeded && (
          <div className="mb-5 rounded-xl border border-[#FFB347]/40 bg-[#FFB347]/[0.08] p-4 text-sm text-[#FFD9A8]">
            Your account is not linked to an organization yet. Run the one-time setup
            step in Supabase, then refresh this page.
          </div>
        )}

        {/* Dropzone */}
        {(phase === 'idle' || phase === 'parsing' || phase === 'error') && (
          <div>
            <label
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const file = e.dataTransfer.files?.[0]
                if (file) handleFile(file)
              }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition sm:p-14 ${
                dragOver
                  ? 'border-[#FFB347]/60 bg-[#FFB347]/[0.06]'
                  : 'border-white/15 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.05]'
              }`}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/15 bg-white/[0.05]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFB347" strokeWidth="1.8">
                  <path d="M12 16V4M12 4l-4 4M12 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="mt-4 font-display text-base font-semibold">
                {phase === 'parsing' ? 'Reading your file...' : 'Drop your spreadsheet here'}
              </div>
              <div className="mt-1 text-xs text-[#79839A]">
                or tap to browse. Excel (.xlsx) or CSV.
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={onInputChange}
                className="hidden"
              />
            </label>

            {/* Demo data one-click loader */}
            <div className="mt-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/[0.06]" />
              <span className="font-mono text-[10px] tracking-widest text-[#3A4555]">OR</span>
              <div className="h-px flex-1 bg-white/[0.06]" />
            </div>
            <button
              onClick={loadDemoData}
              disabled={phase === 'parsing'}
              className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-[#9AA4B4] transition hover:border-[#FFB347]/30 hover:bg-[#FFB347]/[0.04] hover:text-[#FFD9A8] disabled:opacity-40"
            >
              <span className="mr-2 font-mono text-[10px] tracking-widest text-[#566174]">DEMO</span>
              Load sample SAP B1-style solar data
            </button>

            {phase === 'error' && error && (
              <div className="mt-4 rounded-xl border border-[#FF6B6B]/40 bg-[#FF6B6B]/[0.08] p-4 text-sm text-[#FFB4B4]">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Preview */}
        {phase === 'preview' && parsed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="File" value={parsed.fileName} mono />
              <Stat label="Sheet" value={parsed.sheetName} />
              <Stat label="Rows" value={String(parsed.rows.length)} />
              <Stat label="Columns" value={String(parsed.headers.length)} />
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-white/12 bg-white/[0.03]">
              <div className="border-b border-white/10 px-4 py-3 font-mono text-[11px] tracking-widest text-[#79839A]">
                PREVIEW · FIRST {Math.min(8, parsed.rows.length)} ROWS
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-white/[0.03]">
                      {parsed.headers.map((h) => (
                        <th
                          key={h}
                          className="whitespace-nowrap border-b border-white/10 px-3 py-2.5 font-semibold text-[#C2CAD8]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 8).map((row, i) => (
                      <tr key={i} className="odd:bg-white/[0.015]">
                        {parsed.headers.map((h) => (
                          <td
                            key={h}
                            className="whitespace-nowrap border-b border-white/[0.06] px-3 py-2 text-[#AEB7C6]"
                          >
                            {row[h] === '' ? (
                              <span className="text-[#5A6678]">—</span>
                            ) : (
                              row[h]
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={land}
                disabled={!orgId}
                style={{ backgroundImage: 'linear-gradient(to right, #FFB347, #FF7A3D)' }}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-[#1A0E03] shadow-[0_8px_30px_rgba(255,130,60,0.35)] transition hover:brightness-105 disabled:opacity-50"
              >
                Land into BeyondIQ
              </button>
              <button
                onClick={reset}
                className="rounded-xl border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-[#C2CAD8] transition hover:bg-white/[0.07]"
              >
                Choose a different file
              </button>
            </div>
            {!orgId && (
              <p className="mt-3 text-xs text-[#FFB47A]">
                Run the account setup step first so the data can be saved.
              </p>
            )}
          </motion.div>
        )}

        {/* Landing progress */}
        {phase === 'landing' && (
          <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-8">
            <div className="font-display text-base font-semibold">
              Landing your data...
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progress}%`,
                  backgroundImage: 'linear-gradient(to right, #FFB347, #FF7A3D)',
                }}
              />
            </div>
            <div className="mt-2 font-mono text-xs text-[#79839A]">{progress}%</div>
          </div>
        )}

        {/* Done */}
        {phase === 'done' && parsed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-2xl border border-[#3FB984]/35 bg-[#3FB984]/[0.07] p-8"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3FB984]/20">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3FB984" strokeWidth="2.2">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div className="font-display text-lg font-semibold">Data landed</div>
                <div className="text-sm text-[#9AA4B4]">
                  {parsed.rows.length} rows from {parsed.fileName} are now in raw
                  storage.
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/mapping"
                style={{ backgroundImage: 'linear-gradient(to right, #FFB347, #FF7A3D)' }}
                className="rounded-xl px-5 py-2.5 text-center text-sm font-semibold text-[#1A0E03] shadow-[0_8px_30px_rgba(255,130,60,0.35)] transition hover:brightness-105"
              >
                View mapping and validate
              </Link>
              <button
                onClick={reset}
                className="rounded-xl border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-[#C2CAD8] transition hover:bg-white/[0.07]"
              >
                Upload another file
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </AppShell>
  )
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-white/12 bg-white/[0.04] p-4">
      <div className="font-mono text-[10px] tracking-widest text-[#79839A]">
        {label.toUpperCase()}
      </div>
      <div
        className={`mt-1.5 truncate text-sm font-semibold text-[#EDF1F6] ${
          mono ? 'font-mono text-xs' : ''
        }`}
        title={value}
      >
        {value}
      </div>
    </div>
  )
}
