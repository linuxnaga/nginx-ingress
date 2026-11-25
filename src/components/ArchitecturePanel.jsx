import { Workflow, RefreshCcw, Zap } from 'lucide-react'
import FlowCanvas from './FlowCanvas.jsx'
import Inspector from './Inspector.jsx'
import EventLog from './EventLog.jsx'
import { Panel } from './ui.jsx'

export function ModeSwitch({ mode, onChange }) {
  return (
    <div className="flex rounded-lg bg-void p-0.5 ring-1 ring-edge" role="radiogroup" aria-label="NGINX edition">
      <button
        role="radio"
        aria-checked={mode === 'oss'}
        onClick={() => onChange('oss')}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${mode === 'oss' ? 'bg-nginx text-white' : 'text-slate-400'}`}
      >
        <RefreshCcw size={12} /> NGINX Open Source <span className="hidden font-normal opacity-80 md:inline">· reload on endpoint change</span>
      </button>
      <button
        role="radio"
        aria-checked={mode === 'plus'}
        onClick={() => onChange('plus')}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${mode === 'plus' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}
      >
        <Zap size={12} /> NGINX Plus <span className="hidden font-normal opacity-80 md:inline">· dynamic API upstreams</span>
      </button>
    </div>
  )
}

export default function ArchitecturePanel({ cluster, focus, selected, onSelect }) {
  return (
    <div className="grid gap-4 2xl:grid-cols-[1fr_340px]">
      <Panel
        title="Dual-Plane Architecture Flow"
        icon={Workflow}
        bodyClass="p-2"
        right={<ModeSwitch mode={cluster.mode} onChange={cluster.setMode} />}
      >
        <FlowCanvas cluster={cluster} focus={focus} selected={selected} onSelect={onSelect} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 pb-1 text-[10.5px] text-slate-500">
          <Legend c="#326ce5">config (YAML) event</Legend>
          <Legend c="#f59e0b">endpoint change → reload</Legend>
          <Legend c="#06b6d4">Plus API update / request → v1</Legend>
          <Legend c="#a855f7">request → v2</Legend>
          <Legend c="#ec4899">header match</Legend>
          <Legend c="#f43f5e">rejected at worker</Legend>
          <span className="ml-auto font-mono">
            reloads <b className="text-amber-300">{cluster.reloads}</b> · Plus API <b className="text-cyan-300">{cluster.apiUpdates}</b> · gen <b className="text-emerald-400">{cluster.generation}</b>
          </span>
        </div>
      </Panel>
      <div className="flex flex-col gap-4">
        <Inspector nodeId={selected} onClose={() => onSelect(null)} mode={cluster.mode} />
        <EventLog events={cluster.events} />
      </div>
    </div>
  )
}

function Legend({ c, children }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: c }} />
      {children}
    </span>
  )
}
