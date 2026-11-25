import { X, MousePointerClick, Terminal } from 'lucide-react'
import { NODES } from '../data/curriculum.js'
import { Chip } from './ui.jsx'

const PLANE = {
  control: { label: 'Control plane', color: '#326ce5' },
  data: { label: 'Data plane', color: '#06b6d4' },
  both: { label: 'Control + data plane', color: '#009639' },
}

export default function Inspector({ nodeId, onClose, mode }) {
  if (!nodeId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-edge p-6 text-center text-sm text-slate-500">
        <MousePointerClick size={22} />
        Click any node in the diagram, such as Workqueue, Configurator, NGINX Master, Workers, VirtualServer or Policy CRD, to open its technical inspector card.
      </div>
    )
  }
  const n = NODES[nodeId]
  if (!n) return null
  const plane = PLANE[n.plane]
  return (
    <div className="pop rounded-xl border border-edge bg-panel p-4 shadow-xl">
      <div className="flex items-start gap-2">
        <div>
          <Chip color={plane.color}>{plane.label}</Chip>
          <h4 className="mt-1.5 text-base font-bold text-white">{n.title}</h4>
        </div>
        <button onClick={onClose} className="ml-auto rounded p-1 text-slate-500 hover:bg-panel2 hover:text-white" aria-label="Close inspector">
          <X size={16} />
        </button>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{n.role}</p>
      {nodeId === 'plusapi' && mode !== 'plus' && (
        <p className="mt-2 rounded-md bg-cyan-500/10 px-2 py-1.5 text-xs text-cyan-300">
          You are in NGINX Open Source mode. Switch the toggle to NGINX Plus to light up this path.
        </p>
      )}
      <ul className="mt-3 space-y-1.5">
        {n.facts.map((f) => (
          <li key={f} className="flex items-start gap-2 font-mono text-[11px] text-slate-400">
            <Terminal size={12} className="mt-0.5 shrink-0 text-nginx" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  )
}
