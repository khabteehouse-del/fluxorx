'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import AppShell from '@/components/app-shell'
import { createClient } from '@/lib/supabase/client'

type Batch = {
  id: string
  file_name: string
  row_count: number
  status: string
  created_at: string
}

type RawTable = {
  id: string
  table_name: string
  column_headers: string[]
}

const PAGE = 25

function formatWhen(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function RawPage() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [selected, setSelected] = useState<Batch | null>(null)
  const [table, setTable] = useState<RawTable | null>(null)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loadingRows, setLoadingRows] = useState(false)
  const [ready, setReady] = useState(false)

  const loadRecords = useCallback(async (tableId: string, p: number) => {
    setLoadingRows(true)
    const supabase = createClient()
    const from = p * PAGE
    const to = from + PAGE - 1
    const { data, count } = await supabase
      .from('raw_records')
      .select('row_index, data', { count: 'exact' })
      .eq('raw_table_id', tableId)
      .order('row_index')
      .range(from, to)
    setRows((data ?? []).map((r) => (r.data ?? {}) as Record<string, unknown>))
    if (typeof count === 'number') setTotal(count)
    setLoadingRows(false)
  }, [])

  const selectBatch = useCallback(
    async (batch: Batch) => {
      setSelected(batch)
      setPage(0)
      const supabase = createClient()
      const { data: tbl } = await supabase
        .from('raw_tables')
        .select('id, table_name, column_headers')
        .eq('raw_upload_id', batch.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (tbl) {
        const t = {
          id: tbl.id as string,
          table_name: tbl.table_name as string,
          column_headers: (tbl.column_headers ?? []) as string[],
        }
        setTable(t)
        await loadRecords(t.id, 0)
      } else {
        setTable(null)
        setRows([])
        setTotal(0)
      }
    },
    [loadRecords]
  )

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('raw_uploads')
      .select('id, file_name, row_count, status, created_at')
      .order('created_at', { ascending: false })
      .then(async ({ data }) => {
        const list = (data ?? []) as Batch[]
        setBatches(list)
        if (list.length) await selectBatch(list[0])
        setReady(true)
      })
  }, [selectBatch])

  function changePage(next: number) {
    if (!table) return
    const max = Math.max(0, Math.ceil(total / PAGE) - 1)
    const p = Math.min(Math.max(0, next), max)
    setPage(p)
    loadRecords(table.id, p)
  }

  const headers = table?.column_headers ?? []
  const from = total === 0 ? 0 : page * PAGE + 1
  const to = Math.min(total, (page + 1) * PAGE)
  const maxPage = Math.max(0, Math.ceil(total / PAGE) - 1)

  return (
    <AppShell title="Raw data">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Raw landing
          </h2>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[#9AA4B4]">
            Your data exactly as received, read back from storage. Nothing changed
            yet, that happens at validation.
          </p>
        </div>

        {ready && batches.length === 0 && (
          <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-10 text-center">
            <div className="font-display text-lg font-semibold">No data yet</div>
            <p className="mt-1.5 text-sm text-[#9AA4B4]">
              Upload a spreadsheet to see it land here.
            </p>
            <Link
              href="/upload"
              style={{ backgroundImage: 'linear-gradient(to right, #FFB347, #FF7A3D)' }}
              className="mt-5 inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold text-[#1A0E03]"
            >
              Go to Data upload
            </Link>
          </div>
        )}

        {batches.length > 0 && (
          <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
            {/* Main: rows */}
            <div className="order-2 lg:order-1">
              {/* Toolbar */}
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="truncate font-display text-base font-semibold">
                    {selected?.file_name}
                  </div>
                  <div className="font-mono text-[11px] tracking-wider text-[#79839A]">
                    {table?.table_name?.toUpperCase()} · {total} ROWS ·{' '}
                    {headers.length} COLUMNS
                  </div>
                </div>

                {/* Batch switcher (works on every screen size) */}
                <select
                  value={selected?.id ?? ''}
                  onChange={(e) => {
                    const b = batches.find((x) => x.id === e.target.value)
                    if (b) selectBatch(b)
                  }}
                  className="rounded-lg border border-white/12 bg-[#0B0F15] px-3 py-2 text-sm text-[#C2CAD8] outline-none focus:border-[#FFB347]/50 lg:hidden"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.file_name} · {formatWhen(b.created_at)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/12 bg-white/[0.03]">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-white/[0.04]">
                        <th className="whitespace-nowrap border-b border-white/10 px-3 py-2.5 font-mono text-[10px] tracking-wider text-[#79839A]">
                          #
                        </th>
                        {headers.map((h) => (
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
                      {loadingRows ? (
                        <tr>
                          <td
                            colSpan={headers.length + 1}
                            className="px-3 py-10 text-center font-mono text-xs text-[#566174]"
                          >
                            LOADING ROWS...
                          </td>
                        </tr>
                      ) : (
                        rows.map((row, i) => (
                          <tr key={i} className="odd:bg-white/[0.015]">
                            <td className="whitespace-nowrap border-b border-white/[0.06] px-3 py-2 font-mono text-[11px] text-[#566174]">
                              {page * PAGE + i + 1}
                            </td>
                            {headers.map((h) => {
                              const v = row[h]
                              const text =
                                v === null || v === undefined || v === ''
                                  ? ''
                                  : String(v)
                              return (
                                <td
                                  key={h}
                                  className="whitespace-nowrap border-b border-white/[0.06] px-3 py-2 text-[#AEB7C6]"
                                >
                                  {text === '' ? (
                                    <span className="text-[#5A6678]">—</span>
                                  ) : (
                                    text
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
                  <div className="font-mono text-[11px] tracking-wider text-[#79839A]">
                    {from}–{to} OF {total}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => changePage(page - 1)}
                      disabled={page === 0 || loadingRows}
                      className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs text-[#C2CAD8] transition hover:bg-white/[0.07] disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => changePage(page + 1)}
                      disabled={page >= maxPage || loadingRows}
                      className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs text-[#C2CAD8] transition hover:bg-white/[0.07] disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Side panel: batch list (desktop) */}
            <div className="order-1 hidden lg:order-2 lg:block">
              <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-3">
                <div className="px-2 pb-2 pt-1 font-mono text-[10px] tracking-widest text-[#79839A]">
                  UPLOAD BATCHES
                </div>
                <div className="flex flex-col gap-1">
                  {batches.map((b) => {
                    const active = b.id === selected?.id
                    return (
                      <button
                        key={b.id}
                        onClick={() => selectBatch(b)}
                        className={`rounded-lg border px-3 py-2.5 text-left transition ${
                          active
                            ? 'border-[#FFB347]/40 bg-[#FFB347]/[0.08]'
                            : 'border-transparent hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="truncate text-sm font-medium text-[#EDF1F6]">
                          {b.file_name}
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] tracking-wider text-[#79839A]">
                          {b.row_count} ROWS · {formatWhen(b.created_at)}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
