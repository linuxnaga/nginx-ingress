import { useState } from 'react'
import * as Icons from '../icons.js'
import { useCluster } from '../lib/useCluster.js'
import { useGame } from '../game.jsx'
import ArchitecturePanel from './ArchitecturePanel.jsx'
import Quiz from './Quiz.jsx'
import { Panel, Tabs } from './ui.jsx'
import ControlLoopLab from './labs/ControlLoopLab.jsx'
import CanaryLab from './labs/CanaryLab.jsx'
import PolicyLab from './labs/PolicyLab.jsx'
import TransportLab from './labs/TransportLab.jsx'
import StormLab from './labs/StormLab.jsx'
import MetricsLab from './labs/MetricsLab.jsx'
import MigrationLab from './labs/MigrationLab.jsx'
import LabGuide from './LabGuide.jsx'
import { LAB_GUIDES } from '../data/guides.js'

const LABS = {
  m1: [{ id: 'loop', label: 'Control Loop Console', icon: Icons.RefreshCcw, C: ControlLoopLab, tasks: ['m1-apply', 'm1-scale-oss', 'm1-scale-plus'] }],
  m2: [{ id: 'canary', label: 'VirtualServer Canary Lab', icon: Icons.Split, C: CanaryLab, tasks: ['m2-compile', 'm2-canary', 'm2-header', 'm2-vsr'] }],
  m3: [
    { id: 'policy', label: 'Policy Enforcement Lab', icon: Icons.ShieldAlert, C: PolicyLab, tasks: ['m3-ratelimit', 'm3-jwt', 'm3-acl'] },
    { id: 'l4', label: 'TransportServer L4 Lab', icon: Icons.Radio, C: TransportLab, tasks: ['m3-ts'] },
  ],
  m4: [
    { id: 'storm', label: 'Reload Storm Simulator', icon: Icons.Flame, C: StormLab, tasks: ['m4-storm', 'm4-batch'] },
    { id: 'metrics', label: 'Observability Console', icon: Icons.BarChart3, C: MetricsLab, tasks: ['m4-metrics'] },
    { id: 'migrate', label: 'ingress-nginx Migration', icon: Icons.ArrowRightLeft, C: MigrationLab, tasks: ['m4-migrate'] },
  ],
}

export default function ModuleView({ module }) {
  const cluster = useCluster()
  const { done, complete } = useGame()
  const [selected, setSelected] = useState(null)
  const [inspected, setInspected] = useState([])
  const labs = LABS[module.id]
  const [tab, setTab] = useState(labs[0].id)
  const lab = labs.find((l) => l.id === tab) || labs[0]
  const Icon = Icons[module.icon]

  const onSelect = (id) => {
    setSelected(id)
    if (!id) return
    const n = inspected.includes(id) ? inspected : [...inspected, id]
    setInspected(n)
    if (n.length >= 4) complete('m1-inspect')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-xl border border-edge bg-panel/70 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `${module.accent}22`, border: `1px solid ${module.accent}` }}>
              <Icon size={22} color={module.accent} />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: module.accent }}>Module {module.num}</div>
              <h1 className="text-xl font-bold text-white">{module.title}</h1>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">{module.summary}</p>
          <details className="mt-3 group" open={module.num === 1}>
            <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200">
              <Icons.BookOpen size={13} /> Key concepts
            </summary>
            <ul className="mt-2 grid gap-2 md:grid-cols-2">
              {module.concepts.map((c, i) => (
                <li key={i} className="flex gap-2 rounded-lg bg-void/50 p-2.5 text-xs leading-relaxed text-slate-300">
                  <Icons.Lightbulb size={13} className="mt-0.5 shrink-0" color={module.accent} />
                  {c}
                </li>
              ))}
            </ul>
          </details>
        </div>
        <Panel title="Module objectives" icon={Icons.ListChecks} accent={module.accent}>
          <ul className="space-y-2">
            {module.tasks.map((t) => (
              <li key={t.id} className="flex items-start gap-2 text-xs">
                {done[t.id] ? (
                  <Icons.CheckCircle2 size={15} className="mt-px shrink-0 text-nginx" />
                ) : (
                  <Icons.Circle size={15} className="mt-px shrink-0 text-slate-600" />
                )}
                <span className={done[t.id] ? 'text-slate-400 line-through decoration-slate-600' : 'text-slate-200'}>
                  {t.label}
                  {t.id === 'm1-inspect' && !done[t.id] && <span className="text-slate-500"> ({inspected.length}/4)</span>}
                </span>
                <span className="ml-auto shrink-0 font-mono text-[10px] text-cyan-400">+{t.xp}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <ArchitecturePanel cluster={cluster} focus={module.focus} selected={selected} onSelect={onSelect} />

      <Panel
        title="Hands-On YAML & Traffic Lab Console"
        icon={Icons.FlaskConical}
        accent={module.accent}
        right={
          labs.length > 1 && (
            <Tabs tabs={labs.map((l) => ({ id: l.id, label: l.label, icon: l.icon, done: l.tasks.every((t) => done[t]) }))} value={tab} onChange={setTab} />
          )
        }
      >
        <LabGuide key={`g-${lab.id}`} guide={LAB_GUIDES[lab.id]} accent={module.accent} />
        <lab.C key={lab.id} cluster={cluster} />
      </Panel>

      <Quiz key={module.id} module={module} />
    </div>
  )
}
