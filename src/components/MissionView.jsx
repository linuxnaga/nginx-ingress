import { useEffect, useState } from 'react'
import * as Icons from '../icons.js'
import { useCluster } from '../lib/useCluster.js'
import { useGame } from '../game.jsx'
import ArchitecturePanel from './ArchitecturePanel.jsx'
import { Button, Panel } from './ui.jsx'
import CanaryLab from './labs/CanaryLab.jsx'
import PolicyLab, { DEFAULT_POLICY } from './labs/PolicyLab.jsx'
import StormLab from './labs/StormLab.jsx'

const OFF_POLICY = {
  ...DEFAULT_POLICY,
  rateLimit: { ...DEFAULT_POLICY.rateLimit, on: false },
}

function evalMission1(r, replicas) {
  const h = r?.history || []
  const sum = (f) => h.filter(f).reduce((s, b) => s + b.n, 0)
  const canaryN = sum((b) => b.w2 === 10 && !b.inject)
  const firstCanaryDone = (() => {
    let acc = 0
    for (let i = 0; i < h.length; i++) {
      if (h[i].w2 === 10 && !h[i].inject) acc += h[i].n
      if (acc >= 50) return i
    }
    return -1
  })()
  const promoteN = firstCanaryDone < 0 ? 0 : h.slice(firstCanaryDone + 1).filter((b) => b.w2 === 100).reduce((s, b) => s + b.n, 0)
  const fails = h.reduce((s, b) => s + b.fail, 0)
  return {
    scale: replicas.v2 >= 2,
    beta: h.some((b) => b.beta > 0),
    canary: canaryN >= 50,
    promote: promoteN >= 20,
    clean: h.length > 0 && fails === 0,
    _fails: fails,
    _progress: { canaryN, promoteN },
  }
}

function evalMission2(policy, report) {
  const rl = !!policy?.rateLimit.on && policy.rateLimit.rate === 10 && policy.rateLimit.burst === 20
  const code = !!policy?.rateLimit.on && policy.rateLimit.rejectCode === 429
  const jwt = !!policy?.jwt.on
  const lp = report?.policy
  const fire =
    !!report &&
    report.counts.rl > 0 &&
    report.counts.jwt > 0 &&
    lp.rateLimit.on && lp.rateLimit.rate === 10 && lp.rateLimit.burst === 20 && lp.rateLimit.rejectCode === 429 && lp.jwt.on
  return { rl, code, jwt, fire }
}

function evalMission3(runs) {
  const fixed = runs.filter((r) => r.batch || r.plus)
  const last = fixed[fixed.length - 1]
  return {
    see: runs.some((r) => !r.batch && !r.plus && r.peak > 512),
    fix: fixed.length > 0,
    reloads: !!last && last.reloads <= 5,
    mem: !!last && last.peak < 512 && last.ooms === 0,
  }
}

function MissionRun({ mission, onRestart }) {
  const cluster = useCluster(mission.id === 'mission-1' ? { replicas: { v1: 3, v2: 0 } } : {})
  const { done, complete } = useGame()
  const [selected, setSelected] = useState(null)
  const [r1, setR1] = useState(null)
  const [pol, setPol] = useState(OFF_POLICY)
  const [r2, setR2] = useState(null)
  const [runs, setRuns] = useState([])

  const status =
    mission.id === 'mission-1'
      ? evalMission1(r1, cluster.replicas)
      : mission.id === 'mission-2'
        ? evalMission2(pol, r2)
        : evalMission3(runs)
  const allDone = mission.objectives.every((o) => status[o.id])
  const failed = mission.id === 'mission-1' && status._fails > 0

  useEffect(() => {
    if (allDone) complete(mission.id)
  }, [allDone, mission.id, complete])

  const Icon = Icons[mission.icon]
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-panel/70 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500 bg-amber-500/15">
              <Icon size={22} color="#f59e0b" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-400">Mission {mission.num} · {mission.xp} XP</div>
              <h1 className="text-xl font-bold text-white">{mission.title}</h1>
            </div>
            <Button size="sm" icon={Icons.RotateCcw} className="ml-auto" onClick={onRestart}>Restart</Button>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">{mission.brief}</p>
          {mission.id === 'mission-1' && (
            <p className="mt-2 text-xs text-slate-400">
              Progress: {status._progress.canaryN}/50 requests at 90/10 · {status._progress.promoteN}/20 requests at 100% v2 after the canary.
            </p>
          )}
        </div>
        <Panel title="Objectives" icon={Icons.Target} accent="#f59e0b">
          <ul className="space-y-2">
            {mission.objectives.map((o) => (
              <li key={o.id} className="flex items-start gap-2 text-xs">
                {status[o.id] ? (
                  <Icons.CheckCircle2 size={15} className="mt-px shrink-0 text-nginx" />
                ) : o.id === 'clean' && failed ? (
                  <Icons.XCircle size={15} className="mt-px shrink-0 text-rose-400" />
                ) : (
                  <Icons.Circle size={15} className="mt-px shrink-0 text-slate-600" />
                )}
                <span className={status[o.id] ? 'text-slate-400' : 'text-slate-200'}>{o.text}</span>
              </li>
            ))}
          </ul>
          {failed && (
            <div className="mt-3 rounded-md bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {status._fails} request(s) failed with 502. You shifted traffic to an upstream with no ready pods. Restart the mission and scale coffee-v2 first.
            </div>
          )}
          {(allDone || done[mission.id]) && (
            <div className="pop mt-3 flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-300">
              <Icons.Trophy size={16} /> Mission complete!
            </div>
          )}
        </Panel>
      </div>

      <ArchitecturePanel cluster={cluster} focus={[]} selected={selected} onSelect={setSelected} />

      <Panel title="Mission Console" icon={Icons.Swords} accent="#f59e0b">
        {mission.id === 'mission-1' && <CanaryLab cluster={cluster} onReport={setR1} />}
        {mission.id === 'mission-2' && <PolicyLab cluster={cluster} initial={OFF_POLICY} onPolicy={setPol} onReport={setR2} />}
        {mission.id === 'mission-3' && <StormLab cluster={cluster} onReport={(r) => setRuns((x) => [...x, r])} />}
      </Panel>
    </div>
  )
}

export default function MissionView({ mission }) {
  const [attempt, setAttempt] = useState(0)
  return <MissionRun key={`${mission.id}-${attempt}`} mission={mission} onRestart={() => setAttempt((a) => a + 1)} />
}
