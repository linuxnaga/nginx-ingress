import { useEffect, useRef, useState } from 'react'
import { Flame, Play, MemoryStick, Layers, Zap, Timer, Skull } from 'lucide-react'
import { useGame } from '../../game.jsx'
import { Button, Stat, Toggle } from '../ui.jsx'

const LIMIT = 512
const BASE = 140 // IC process + master + shared zones (MiB)
const GEN = 60 // one worker generation (MiB)
const DUR = 60
const STEP = 0.25

// Churn scenario: CI applies 30 VirtualServers in a burst + an HPA flapping a 50-pod Deployment
function scenario() {
  const ev = []
  for (let i = 0; i < 30; i++) ev.push({ t: 5 + i * 0.1, kind: 'config', what: `vs/app-${i}` })
  for (let t = 12; t < 58; t += 1.5) ev.push({ t, kind: 'endpoints', what: 'deploy/api (HPA)' })
  return ev.sort((a, b) => a.t - b.t)
}

export function simulateStorm({ batch, plus, drain }) {
  const events = scenario()
  const reloads = [] // times
  const api = []
  let pending = null // batch window
  for (const e of events) {
    if (plus && e.kind === 'endpoints') {
      api.push(e.t)
      continue
    }
    if (batch) {
      if (pending == null || e.t > pending + 2) {
        pending = e.t
        reloads.push(e.t + 2) // one reload at the end of the 2s window
      }
    } else reloads.push(e.t)
  }
  // memory timeline
  const series = []
  const ooms = []
  let downUntil = -1
  let alive = [] // draining generation end times
  let reloadIdx = 0
  let effectiveReloads = 0
  for (let t = 0; t <= DUR; t += STEP) {
    while (reloadIdx < reloads.length && reloads[reloadIdx] <= t) {
      if (t >= downUntil) {
        alive.push(t + drain)
        effectiveReloads++
      }
      reloadIdx++
    }
    alive = alive.filter((end) => end > t)
    let mem = t < downUntil ? 40 : BASE + GEN + alive.length * GEN
    if (mem > LIMIT && t >= downUntil) {
      ooms.push(t)
      series.push({ t, mem })
      alive = []
      downUntil = t + 4 // pod restarting
      continue
    }
    series.push({ t, mem })
  }
  const peak = Math.max(...series.map((s) => s.mem))
  return { series, reloads: reloads.filter((r) => r <= DUR), api, ooms, peak, effectiveReloads }
}

const DRAIN = [
  { v: 90, label: 'unset (long-lived conns ≈90s)' },
  { v: 30, label: '30s' },
  { v: 10, label: '10s' },
]

export default function StormLab({ cluster, onReport }) {
  const { complete } = useGame()
  const [batch, setBatch] = useState(false)
  const [drain, setDrain] = useState(90)
  const [run, setRun] = useState(null)
  const [cursor, setCursor] = useState(0)
  const timer = useRef(null)
  const plus = cluster.mode === 'plus'

  useEffect(() => () => clearInterval(timer.current), [])

  const start = () => {
    const res = simulateStorm({ batch, plus, drain })
    setRun({ ...res, batch, plus, drain })
    setCursor(0)
    clearInterval(timer.current)
    cluster.log(`Churn started: CI applies 30 VirtualServers + HPA flaps api pods (batch=${batch ? 'on' : 'off'}, ${plus ? 'NGINX Plus' : 'NGINX OSS'}, worker-shutdown-timeout=${drain === 90 ? 'unset' : drain + 's'})`, 'cmd')
    let t = 0
    let ri = 0
    let ai = 0
    let oi = 0
    timer.current = setInterval(() => {
      t += 0.75
      setCursor(t)
      // mirror a sample of events onto the canvas
      let n = 0
      while (ri < res.reloads.length && res.reloads[ri] <= t) {
        if (n++ < 2) cluster.reload('other')
        ri++
      }
      while (ai < res.api.length && res.api[ai] <= t) {
        cluster.spawn(['manager', 'plusapi', 'w1'], { color: '#06b6d4', dur: 700 })
        ai++
      }
      while (oi < res.ooms.length && res.ooms[oi] <= t) {
        cluster.log(`OOMKilled: nginx-ingress pod exceeded ${LIMIT}Mi memory limit, container restarting`, 'err')
        oi++
      }
      if (t >= DUR) {
        clearInterval(timer.current)
        const stormy = res.ooms.length > 0
        cluster.log(
          `Churn finished: ${res.reloads.length} reloads, ${res.api.length} Plus API updates, peak ${res.peak} MiB, ${res.ooms.length} OOMKills`,
          stormy ? 'err' : 'ok',
        )
        if (!batch && !plus && stormy) complete('m4-storm')
        if ((batch || plus) && !stormy) complete('m4-batch')
        onReport?.({ batch, plus, drain, reloads: res.reloads.length, peak: res.peak, ooms: res.ooms.length })
      }
    }, 70)
  }

  // chart geometry
  const Wd = 640
  const Ht = 220
  const x = (t) => 40 + (t / DUR) * (Wd - 50)
  const y = (m) => Ht - 24 - (Math.min(m, 900) / 900) * (Ht - 40)
  const visible = run ? run.series.filter((s) => s.t <= cursor) : []
  const line = visible.map((s, i) => `${i ? 'L' : 'M'}${x(s.t).toFixed(1)},${y(s.mem).toFixed(1)}`).join(' ')
  const cur = visible[visible.length - 1]
  const reloadsSoFar = run ? run.reloads.filter((r) => r <= cursor).length : 0

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <div className="flex flex-col gap-3 rounded-lg border border-edge bg-void/50 p-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Scenario</div>
        <p className="text-xs leading-relaxed text-slate-400">
          At t=5s CI applies <b className="text-slate-200">30 VirtualServers</b> in 3 seconds. From t=12s an HPA flaps the <b className="text-slate-200">api</b> Deployment every 1.5s. The pod limit is <b className="text-rose-300">{LIMIT} MiB</b>, and each worker generation holds about {GEN} MiB until it drains.
        </p>
        <Toggle on={batch} onChange={setBatch} label="Batch updates (2s debounce window)" color="#009639" />
        <Toggle on={plus} onChange={(v) => cluster.setMode(v ? 'plus' : 'oss')} label="NGINX Plus dynamic upstreams" color="#06b6d4" />
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-400"><Timer size={12} /> ConfigMap worker-shutdown-timeout</div>
          <div className="flex flex-wrap gap-1">
            {DRAIN.map((d) => (
              <button key={d.v} onClick={() => setDrain(d.v)} className={`rounded px-2 py-1 font-mono text-[11px] ${drain === d.v ? 'bg-k8s text-white' : 'bg-panel2 text-slate-400'}`}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <Button variant="danger" icon={run && cursor < DUR ? Flame : Play} onClick={start} disabled={run && cursor < DUR}>
          {run && cursor < DUR ? 'Churning…' : 'Run 60s churn'}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat label="Reloads" value={reloadsSoFar} color={reloadsSoFar > 5 ? '#f59e0b' : '#009639'} sub="nginx_reloads_total" />
          <Stat label="Plus API updates" value={run ? run.api.filter((a) => a <= cursor).length : 0} color="#06b6d4" sub="0 reloads each" />
          <Stat label="Memory" value={cur ? `${cur.mem} MiB` : '-'} color={cur && cur.mem > 400 ? '#f43f5e' : '#e2e8f0'} sub={`limit ${LIMIT} MiB`} />
          <Stat label="OOMKills" value={run ? run.ooms.filter((o) => o <= cursor).length : 0} color="#f43f5e" sub="container restarts" />
        </div>
        <div className="rounded-lg border border-edge bg-void/50 p-2">
          <svg viewBox={`0 0 ${Wd} ${Ht}`} className="w-full">
            {[0, 256, 512, 768].map((m) => (
              <g key={m}>
                <line x1={40} x2={Wd - 10} y1={y(m)} y2={y(m)} stroke="#24324f" strokeDasharray="2 4" />
                <text x={34} y={y(m) + 3} fontSize={9} textAnchor="end" fill="#64748b" fontFamily="monospace">{m}</text>
              </g>
            ))}
            <line x1={40} x2={Wd - 10} y1={y(LIMIT)} y2={y(LIMIT)} stroke="#f43f5e" strokeWidth={1.5} />
            <text x={Wd - 12} y={y(LIMIT) - 4} fontSize={9} textAnchor="end" fill="#f43f5e">memory limit {LIMIT}Mi</text>
            <rect x={x(5)} y={14} width={x(8) - x(5)} height={Ht - 38} fill="#326ce5" opacity={0.08} />
            <text x={x(5)} y={12} fontSize={8} fill="#326ce5">CI burst</text>
            <rect x={x(12)} y={14} width={x(58) - x(12)} height={Ht - 38} fill="#a855f7" opacity={0.05} />
            <text x={x(12) + 40} y={12} fontSize={8} fill="#a855f7">HPA endpoint flapping</text>
            {line && <path d={line} fill="none" stroke="url(#memgrad)" strokeWidth={2} />}
            <defs>
              <linearGradient id="memgrad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#f43f5e" />
                <stop offset="0.45" stopColor="#f59e0b" />
                <stop offset="0.8" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
            {run?.reloads.filter((r) => r <= cursor).map((r, i) => (
              <line key={i} x1={x(r)} x2={x(r)} y1={Ht - 22} y2={Ht - 14} stroke="#f59e0b" strokeWidth={1.2} />
            ))}
            {run?.api.filter((r) => r <= cursor).map((r, i) => (
              <circle key={i} cx={x(r)} cy={Ht - 10} r={1.8} fill="#06b6d4" />
            ))}
            {run?.ooms.filter((o) => o <= cursor).map((o, i) => (
              <g key={i} transform={`translate(${x(o) - 7}, ${y(LIMIT) - 22})`}>
                <Skull width={14} height={14} color="#f43f5e" />
              </g>
            ))}
            <text x={40} y={Ht - 2} fontSize={8} fill="#64748b">0s</text>
            <text x={Wd - 10} y={Ht - 2} fontSize={8} textAnchor="end" fill="#64748b">60s</text>
            <text x={Wd / 2} y={Ht - 2} fontSize={8} textAnchor="middle" fill="#64748b">▮ reload · ● Plus API update</text>
          </svg>
        </div>
        {run && cursor >= DUR && (
          <div className={`rounded-md px-3 py-2 text-xs ${run.ooms.length ? 'bg-rose-500/10 text-rose-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
            {run.ooms.length ? (
              <><Flame size={12} className="mr-1 inline" /> Reload storm: {run.reloads.length} reloads stacked {GEN} MiB worker generations faster than they drained, so the pod was OOMKilled {run.ooms.length}×. Try batching, NGINX Plus, or a shorter worker-shutdown-timeout.</>
            ) : run.reloads.length > 5 ? (
              <><MemoryStick size={12} className="mr-1 inline" /> Survived, but with {run.reloads.length} reloads. Every reload still resets keepalives and warms caches again. Endpoint churn only goes away completely with NGINX Plus.</>
            ) : (
              <><Zap size={12} className="mr-1 inline" /> Stable: {run.reloads.length} reloads, {run.api.length} zero-reload API updates, peak {run.peak} MiB.</>
            )}
          </div>
        )}
        <p className="flex items-start gap-1.5 text-[11px] text-slate-500">
          <Layers size={12} className="mt-0.5 shrink-0" /> Teaching model: real memory per generation depends on worker_processes, connections, zones and modules such as F5 WAF. The shape of the curve is what matters.
        </p>
      </div>
    </div>
  )
}
