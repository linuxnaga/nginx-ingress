import { useEffect, useMemo, useState } from 'react'
import { Library, Search, Terminal, ArrowDownToLine, ArrowUpFromLine, Workflow } from 'lucide-react'
import { COMPONENT_GROUPS } from '../data/components.js'
import FlowCanvas from './FlowCanvas.jsx'
import { useCluster } from '../lib/useCluster.js'

export default function ReferenceView({ focusId }) {
  const [q, setQ] = useState('')
  const cluster = useCluster()
  const [hl, setHl] = useState(focusId || null)

  useEffect(() => {
    if (!focusId) return
    setHl(focusId)
    const el = document.getElementById(`ref-${focusId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [focusId])

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return COMPONENT_GROUPS
    return COMPONENT_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) => `${i.name} ${i.what} ${i.how}`.toLowerCase().includes(s)),
    })).filter((g) => g.items.length)
  }, [q])

  const jump = (nodeId) => {
    const item = COMPONENT_GROUPS.flatMap((g) => g.items).find((i) => i.node === nodeId || (nodeId === 'w2' && i.node === 'w1') || (nodeId === 'v2' && i.node === 'v1') || (nodeId === 'workers' && i.node === 'w1'))
    if (!item) return
    setQ('')
    setHl(item.id)
    setTimeout(() => document.getElementById(`ref-${item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-edge bg-panel/70 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-k8s bg-k8s/15">
            <Library size={22} color="#326ce5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-400">Reference</div>
            <h1 className="text-xl font-bold text-white">What each component does</h1>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          Every Kubernetes object, NIC custom resource, controller part and NGINX process used in the labs. Each entry says what it is, how it behaves, what goes in and out, and a command to look at it in a real cluster. Click a node in the diagram to jump to its entry.
        </p>
      </div>

      <div className="rounded-xl border border-edge bg-panel/70 p-2">
        <div className="flex items-center gap-2 px-2 pb-1 pt-1 text-xs font-semibold text-slate-300">
          <Workflow size={14} className="text-k8s" /> Where each component sits
        </div>
        <FlowCanvas cluster={cluster} focus={[]} onSelect={jump} selected={null} />
      </div>

      <label className="flex items-center gap-2 rounded-lg border border-edge bg-panel/70 px-3 py-2">
        <Search size={15} className="text-slate-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter components, e.g. reload, policy, EndpointSlice…"
          className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
          aria-label="Filter components"
        />
      </label>

      {groups.map((g) => (
        <section key={g.id}>
          <div className="mb-2 flex items-baseline gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: g.color }}>{g.title}</h2>
            <span className="text-xs text-slate-500">{g.intro}</span>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {g.items.map((i) => (
              <article
                id={`ref-${i.id}`}
                key={i.id}
                className={`scroll-mt-24 rounded-xl border bg-panel/80 p-4 transition ${hl === i.id ? 'ring-2' : ''}`}
                style={{ borderColor: `${g.color}55`, '--tw-ring-color': g.color }}
              >
                <h3 className="text-base font-bold text-white">{i.name}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-200">{i.what}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{i.how}</p>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <div className="flex items-start gap-1.5 rounded-md bg-void/60 p-2 text-slate-400">
                    <ArrowDownToLine size={13} className="mt-0.5 shrink-0 text-cyan-400" />
                    <span><b className="text-slate-300">In:</b> {i.inputs}</span>
                  </div>
                  <div className="flex items-start gap-1.5 rounded-md bg-void/60 p-2 text-slate-400">
                    <ArrowUpFromLine size={13} className="mt-0.5 shrink-0 text-emerald-400" />
                    <span><b className="text-slate-300">Out:</b> {i.outputs}</span>
                  </div>
                </div>
                <div className="mt-2 space-y-1">
                  {i.commands.map((c) => (
                    <div key={c} className="flex items-start gap-2 font-mono text-[11px] text-slate-400">
                      <Terminal size={12} className="mt-0.5 shrink-0 text-nginx" /> {c}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
