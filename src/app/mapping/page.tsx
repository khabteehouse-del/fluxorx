'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import AppShell from '@/components/app-shell'
import { createClient } from '@/lib/supabase/client'
import { auditLog } from '@/lib/audit'

const SCHEMA_FIELDS: Record<string, { label: string; required: boolean }> = {
  'Project ID':            { label: 'Project identifier',    required: true  },
  'Customer Name':         { label: 'Customer / client name', required: true  },
  'City':                  { label: 'Project city',           required: false },
  'System Size (kW)':      { label: 'System capacity in kW',  required: true  },
  'Contract Value (PKR)':  { label: 'Total contract value',   required: true  },
  'Amount Paid (PKR)':     { label: 'Amount collected',       required: true  },
  'Stage':                 { label: 'Pipeline stage',         required: true  },
  'Install Date':          { label: 'Installation date',      required: false },
  'Invoice Status':        { label: 'Invoice payment status', required: true  },
  'Salesperson':           { label: 'Assigned salesperson',   required: false },
}

type ColStatus = 'matched' | 'unrecognized' | 'missing'

type ColRow = {
  uploaded: string
  mapped: string
  label: string
  status: ColStatus
}

export default function MappingPage() {
  const router = useRouter()
  const [cols, setCols] = useState<ColRow[]>([])
  const [fileName, setFileName] = useState('')
  const [rowCount, setRowCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: upload } = await supabase
      .from('raw_uploads')
      .select('id, file_name, row_count')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!upload) { setLoading(false); return }

    setFileName(upload.file_name)
    setRowCount(upload.row_count)

    const { data: tbl } = await supabase
      .from('raw_tables')
      .select('column_headers')
      .eq('raw_upload_id', upload.id)
      .limit(1)
      .maybeSingle()

    const uploaded: string[] = (tbl?.column_headers ?? []) as string[]
    const rows: ColRow[] = []

    // Map uploaded columns to schema fields
    uploaded.forEach(col => {
      const col_lower = col.toLowerCase().trim()
      const schemaKey = Object.keys(SCHEMA_FIELDS).find(k =>
        k.toLowerCase() === col_lower ||
        k.toLowerCase().replace(/[^a-z]/g, '') === col_lower.replace(/[^a-z]/g, '')
      )
      if (schemaKey) {
        rows.push({ uploaded: col, mapped: schemaKey, label: SCHEMA_FIELDS[schemaKey].label, status: 'matched' })
      } else {
        rows.push({ uploaded: col, mapped: '', label: '', status: 'unrecognized' })
      }
    })

    // Check for required fields missing from upload
    Object.entries(SCHEMA_FIELDS).forEach(([key, meta]) => {
      if (meta.required && !uploaded.some(c => c.toLowerCase().trim() === key.toLowerCase())) {
        rows.push({ uploaded: '', mapped: key, label: meta.label, status: 'missing' })
      }
    })

    setCols(rows)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function approveMapping() {
    setApproving(true)
    const supabase = createClient()
    await auditLog(supabase, 'mapping_approved', {
      metadata: { fileName, rowCount, matchedCols: cols.filter(c => c.status === 'matched').length },
    })
    await new Promise(r => setTimeout(r, 800))
    router.push('/validation')
  }

  const matched     = cols.filter(c => c.status === 'matched')
  const unrecognized = cols.filter(c => c.status === 'unrecognized')
  const missing     = cols.filter(c => c.status === 'missing')
  const canApprove  = missing.length === 0 || missing.every(c => !SCHEMA_FIELDS[c.mapped]?.required)

  return (
    <AppShell title="Column mapping">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Column mapping
          </h2>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[#9AA4B4]">
            BeyondIQ has analyzed your file and detected how each column maps to the internal schema. Review and confirm before proceeding to validation.
          </p>
        </div>

        {loading ? (
          <div className="h-48 animate-pulse rounded-2xl border border-white/12 bg-white/[0.03]" />
        ) : cols.length === 0 ? (
          <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-10 text-center">
            <div className="font-display text-lg font-semibold">No data uploaded yet</div>
            <p className="mt-1.5 text-sm text-[#9AA4B4]">Upload a spreadsheet first.</p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

            {/* Summary tiles */}
            <div className="mb-5 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-[#3FB984]/30 bg-[#3FB984]/[0.06] p-4 text-center">
                <div className="font-display text-2xl font-semibold text-[#3FB984]">{matched.length}</div>
                <div className="font-mono text-[10px] tracking-wider text-[#3FB984]">MATCHED</div>
              </div>
              <div className={`rounded-xl border p-4 text-center ${unrecognized.length > 0 ? 'border-[#FFB347]/30 bg-[#FFB347]/[0.06]' : 'border-white/10 bg-white/[0.03]'}`}>
                <div className={`font-display text-2xl font-semibold ${unrecognized.length > 0 ? 'text-[#FFB347]' : 'text-[#566174]'}`}>{unrecognized.length}</div>
                <div className={`font-mono text-[10px] tracking-wider ${unrecognized.length > 0 ? 'text-[#FFB347]' : 'text-[#566174]'}`}>UNRECOGNIZED</div>
              </div>
              <div className={`rounded-xl border p-4 text-center ${missing.length > 0 ? 'border-[#FF6B6B]/30 bg-[#FF6B6B]/[0.06]' : 'border-white/10 bg-white/[0.03]'}`}>
                <div className={`font-display text-2xl font-semibold ${missing.length > 0 ? 'text-[#FF6B6B]' : 'text-[#566174]'}`}>{missing.length}</div>
                <div className={`font-mono text-[10px] tracking-wider ${missing.length > 0 ? 'text-[#FF6B6B]' : 'text-[#566174]'}`}>MISSING</div>
              </div>
            </div>

            {/* File info */}
            <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-mono text-[11px] tracking-wider text-[#566174]">
              {fileName} · {rowCount} rows · {matched.length} of {Object.keys(SCHEMA_FIELDS).length} schema fields detected
            </div>

            {/* Mapping table */}
            <div className="overflow-hidden rounded-2xl border border-white/12 bg-white/[0.03]">
              <div className="grid grid-cols-3 border-b border-white/10 bg-white/[0.03] px-4 py-2.5">
                <div className="font-mono text-[10px] tracking-widest text-[#566174]">YOUR COLUMN</div>
                <div className="font-mono text-[10px] tracking-widest text-[#566174]">MAPS TO</div>
                <div className="font-mono text-[10px] tracking-widest text-[#566174]">STATUS</div>
              </div>

              {cols.map((col, i) => (
                <div key={i} className="grid grid-cols-3 items-center border-b border-white/[0.06] px-4 py-3 last:border-0 odd:bg-white/[0.015]">
                  <div className="text-sm text-[#C2CAD8]">
                    {col.uploaded || <span className="italic text-[#3A4555]">not provided</span>}
                  </div>
                  <div className="text-sm">
                    {col.status === 'matched' && <span className="text-[#EDF1F6]">{col.label}</span>}
                    {col.status === 'unrecognized' && <span className="text-[#566174] italic">no match found</span>}
                    {col.status === 'missing' && <span className="text-[#FF6B6B]">{col.label}</span>}
                  </div>
                  <div>
                    {col.status === 'matched' && (
                      <span className="flex items-center gap-1.5 font-mono text-[10px] text-[#3FB984]">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3FB984" strokeWidth="2.5">
                          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        MATCHED
                      </span>
                    )}
                    {col.status === 'unrecognized' && (
                      <span className="font-mono text-[10px] text-[#FFB347]">WILL BE IGNORED</span>
                    )}
                    {col.status === 'missing' && (
                      <span className="font-mono text-[10px] text-[#FF6B6B]">
                        {SCHEMA_FIELDS[col.mapped]?.required ? 'REQUIRED · MISSING' : 'OPTIONAL · MISSING'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Note about extension */}
            <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-xs text-[#566174]">
              In production, unrecognized columns can be manually mapped to schema fields and custom field definitions can be added. This is planned for Milestone 2.
            </div>

            {/* Actions */}
            <div className="mt-5 flex gap-3">
              <button
                onClick={approveMapping}
                disabled={approving}
                style={{ backgroundImage: 'linear-gradient(to right, #FFB347, #FF7A3D)' }}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-[#1A0E03] shadow-[0_8px_30px_rgba(255,130,60,0.3)] transition hover:brightness-105 disabled:opacity-60"
              >
                {approving ? 'Approving...' : 'Approve mapping and proceed to validation'}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </AppShell>
  )
}
