import { useEffect, useMemo, useRef, useState } from 'react'
import YAML from 'yaml'
import { Send, Upload, Split, Users, GitFork, Minus, Plus, FileCode2, RotateCcw } from 'lucide-react'
import { useGame } from '../../game.jsx'
import { Button, CodeView, Toggle, YamlEditor, Chip } from '../ui.jsx'
import { compileVirtualServer, parseDocs, validateVS } from '../../lib/compile.js'

export const START_VS = `apiVersion: k8s.nginx.org/v1
kind: VirtualServer
metadata:
  name: cafe
  namespace: default
spec:
  host: cafe.example.com
  upstreams:
    - name: coffee-v1
      service: coffee-v1-svc
      port: 80
    - name: coffee-v2
      service: coffee-v2-svc
      port: 80
  routes:
    - path: /coffee
      splits:
        - weight: 100
          action:
            pass: coffee-v1
        - weight: 0
          action:
            pass: coffee-v2
`

const VSR_DEMO = `apiVersion: k8s.nginx.org/v1
kind: VirtualServer
metadata:
  name: cafe
  namespace: default
spec:
  host: cafe.example.com
  routes:
    - path: /tea
      route: tea-team/tea-vsr   # delegate /tea to another namespace
---
apiVersion: k8s.nginx.org/v1
kind: VirtualServerRoute
metadata:
  name: tea-vsr
  namespace: tea-team
spec:
  host: cafe.example.com       # must equal the VS host
  upstreams:
    - name: tea
      service: tea-svc
      port: 80
  subroutes:
    - path: /tea               # must start with the delegated path
      action:
        pass: tea
    - path: /tea/matcha
      action:
        proxy:
          upstream: tea
          rewritePath: /matcha`

const versionOf = (vs, upName) => {
  const up = (vs?.spec?.upstreams || []).find((u) => u.name === upName)
  return up && /v2/.test(up.service) ? 'v2' : 'v1'
}

// Route one request through the applied VirtualServer
function route(vs, headers) {
  const r = (vs?.spec?.routes || []).find((x) => x.path === '/coffee') || vs?.spec?.routes?.[0]
  if (!r) return { up: null, via: 'none' }
  for (const m of r.matches || []) {
    const ok = (m.conditions || []).every((c) => {
      if (c.header) return String(headers[c.header.toLowerCase()] ?? '') === String(c.value)
      return false
    })
    if (ok && m.action?.pass) return { up: m.action.pass, via: 'match' }
  }
  if (r.splits) {
    let x = Math.random() * 100
    for (const s of r.splits) {
      x -= Number(s.weight)
      if (x < 0) return { up: s.action?.pass, via: 'split' }
    }
    return { up: r.splits[r.splits.length - 1].action?.pass, via: 'split' }
  }
  return { up: r.action?.pass, via: 'action' }
}

export default function CanaryLab({ cluster, onReport }) {
  const { complete } = useGame()
  const [text, setText] = useState(START_VS)
  const [applied, setApplied] = useState(() => parseDocs(START_VS).objects[0])
  const [applying, setApplying] = useState(false)
  const [inject, setInject] = useState(false)
  const [count, setCount] = useState(50)
  const [stats, setStats] = useState({ v1: 0, v2: 0, fail: 0, beta: 0, total: 0 })
  const [showVsr, setShowVsr] = useState(false)
  const history = useRef([])
  const edited = useRef(false)

  const parsed = useMemo(() => parseDocs(text), [text])
  const vs = parsed.objects.find((o) => o.kind === 'VirtualServer') || parsed.objects[0]
  const warnings = parsed.error ? [] : validateVS(vs)
  const valid = !parsed.error && warnings.length === 0
  const conf = useMemo(() => (valid ? compileVirtualServer(vs) : null), [valid, vs])
  const appliedConf = useMemo(() => compileVirtualServer(applied), [applied])

  const route0 = vs?.spec?.routes?.[0]
  const w2 = Number(route0?.splits?.find((s) => versionOf(vs, s.action?.pass) === 'v2')?.weight ?? 0)
  const hasHeaderRule = (route0?.matches || []).some((m) =>
    (m.conditions || []).some((c) => c.header?.toLowerCase() === 'x-beta-user'),
  )
  const appliedR = applied?.spec?.routes?.[0]
  const appliedW2 = Number(appliedR?.splits?.find((s) => versionOf(applied, s.action?.pass) === 'v2')?.weight ?? 0)
  const appliedHeader = (appliedR?.matches || []).some((m) => (m.conditions || []).some((c) => c.header?.toLowerCase() === 'x-beta-user'))

  const mutate = (fn) => {
    if (!vs || parsed.error) return
    const copy = structuredClone(vs)
    fn(copy)
    edited.current = true
    setText(YAML.stringify(copy, { indent: 2, indentSeq: true }))
  }

  const setWeight = (v) =>
    mutate((o) => {
      const r = o.spec.routes[0]
      if (!r.splits) {
        r.splits = [
          { weight: 100 - v, action: { pass: 'coffee-v1' } },
          { weight: v, action: { pass: 'coffee-v2' } },
        ]
        delete r.action
      }
      r.splits.forEach((s) => (s.weight = versionOf(o, s.action?.pass) === 'v2' ? v : 100 - v))
    })

  const toggleHeaderRule = (on) =>
    mutate((o) => {
      const r = o.spec.routes[0]
      if (on) r.matches = [{ conditions: [{ header: 'X-Beta-User', value: 'true' }], action: { pass: 'coffee-v2' } }]
      else delete r.matches
      // keep key order: path, matches, splits
      o.spec.routes[0] = { path: r.path, ...(r.matches ? { matches: r.matches } : {}), ...r, }
    })

  const onEdit = (t) => {
    edited.current = true
    setText(t)
  }

  useEffect(() => {
    if (edited.current && valid && text !== START_VS) complete('m2-compile')
  }, [text, valid, complete])

  const apply = () => {
    if (!valid) return
    setApplying(true)
    const d = cluster.applyConfig('virtualserver.k8s.nginx.org/default/cafe')
    const next = structuredClone(vs)
    setTimeout(() => {
      setApplied(next)
      setApplying(false)
      cluster.log(`VirtualServer default/cafe: State=Valid, Reason=AddedOrUpdated (v2 weight ${w2}%${hasHeaderRule ? ', X-Beta-User match' : ''})`, 'ok')
    }, d)
  }

  const fire = () => {
    const batch = { w2: appliedW2, header: appliedHeader, inject, n: count, v1: 0, v2: 0, fail: 0, beta: 0 }
    for (let i = 0; i < count; i++) {
      const headers = inject ? { 'x-beta-user': 'true' } : {}
      const { up, via } = route(applied, headers)
      const ver = versionOf(applied, up)
      const pods = cluster.replicas[ver]
      const delay = i * Math.max(25, 1600 / count)
      if (!up || pods === 0) {
        batch.fail++
        cluster.request('reject', { delay, code: '502' })
      } else {
        batch[ver]++
        if (via === 'match' && ver === 'v2') batch.beta++
        cluster.request(ver, { delay, color: via === 'match' ? '#ec4899' : undefined })
      }
    }
    history.current.push(batch)
    setStats((s) => ({
      v1: s.v1 + batch.v1,
      v2: s.v2 + batch.v2,
      fail: s.fail + batch.fail,
      beta: s.beta + batch.beta,
      total: s.total + count,
    }))
    if (batch.w2 >= 1 && batch.w2 <= 50 && !inject && count >= 10 && batch.v2 > 0) complete('m2-canary')
    if (batch.beta > 0) complete('m2-header')
    if (batch.fail) cluster.log(`${batch.fail} requests → 502 Bad Gateway: upstream has no ready endpoints`, 'err')
    onReport?.({ history: [...history.current], replicas: cluster.replicas })
  }

  const resetStats = () => setStats({ v1: 0, v2: 0, fail: 0, beta: 0, total: 0 })
  const pct = (n) => (stats.total ? Math.round((n / stats.total) * 100) : 0)

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <FileCode2 size={13} /> cafe-virtualserver.yaml <span className="font-normal normal-case text-slate-500">(editable)</span>
          <button className="ml-auto flex items-center gap-1 text-[11px] font-normal normal-case text-slate-500 hover:text-slate-300" onClick={() => setText(START_VS)}>
            <RotateCcw size={11} /> reset
          </button>
        </div>
        <YamlEditor value={text} onChange={onEdit} error={parsed.error} warnings={warnings} rows={18} />

        <div className="rounded-lg border border-edge bg-void/50 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Split size={13} /> Canary traffic slider
          </div>
          <div className="flex items-center gap-3">
            <span className="w-16 font-mono text-sm text-cyan-300">v1 {100 - w2}%</span>
            <input type="range" min={0} max={100} step={5} value={w2} onChange={(e) => setWeight(Number(e.target.value))} className="slider flex-1" disabled={!!parsed.error} aria-label="v2 weight" />
            <span className="w-16 text-right font-mono text-sm text-purple-300">v2 {w2}%</span>
          </div>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full">
            <div style={{ width: `${100 - w2}%` }} className="bg-cyan-500 transition-all" />
            <div style={{ width: `${w2}%` }} className="bg-purple-500 transition-all" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <Toggle on={hasHeaderRule} onChange={toggleHeaderRule} color="#ec4899" label="matches: X-Beta-User = true → v2" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="blue" icon={Upload} onClick={apply} disabled={!valid || applying}>
              {applying ? 'Reconciling…' : 'kubectl apply'}
            </Button>
            <span className="text-[11px] text-slate-500">
              Live: v2 {appliedW2}%{appliedHeader ? ' + beta header match' : ''}. Edits only reach traffic after apply.
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-edge bg-void/50 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Send size={13} /> Traffic generator
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1">
              {[10, 50, 100].map((n) => (
                <button key={n} onClick={() => setCount(n)} className={`rounded-md px-2.5 py-1 font-mono text-xs ${count === n ? 'bg-k8s text-white' : 'bg-panel2 text-slate-400'}`}>
                  {n}
                </button>
              ))}
            </div>
            <Toggle on={inject} onChange={setInject} color="#ec4899" label={<span className="font-mono text-xs">-H "X-Beta-User: true"</span>} />
            <Button variant="primary" icon={Send} onClick={fire} disabled={applying && false}>
              curl × {count}
            </Button>
          </div>
          <div className="mt-2 flex items-center gap-2 font-mono text-[11px] text-slate-500">
            pods: v1={cluster.replicas.v1}
            <button className="rounded bg-panel2 p-0.5" onClick={() => cluster.scale('v1', -1)} aria-label="scale v1 down"><Minus size={11} /></button>
            <button className="rounded bg-panel2 p-0.5" onClick={() => cluster.scale('v1', 1)} aria-label="scale v1 up"><Plus size={11} /></button>
            <span className="ml-2">v2={cluster.replicas.v2}</span>
            <button className="rounded bg-panel2 p-0.5" onClick={() => cluster.scale('v2', -1)} aria-label="scale v2 down"><Minus size={11} /></button>
            <button className="rounded bg-panel2 p-0.5" onClick={() => cluster.scale('v2', 1)} aria-label="scale v2 up"><Plus size={11} /></button>
          </div>

          <div className="mt-3 space-y-2">
            {[
              ['v1 (stable)', stats.v1, '#06b6d4'],
              ['v2 (canary)', stats.v2, '#a855f7'],
              ['  ↳ via X-Beta-User match', stats.beta, '#ec4899'],
              ['502 failed', stats.fail, '#f43f5e'],
            ].map(([l, n, c]) => (
              <div key={l} className="flex items-center gap-2 text-xs">
                <span className="w-44 whitespace-pre text-slate-400">{l}</span>
                <div className="h-3 flex-1 overflow-hidden rounded bg-panel2">
                  <div className="h-full rounded transition-all" style={{ width: `${pct(n)}%`, background: c }} />
                </div>
                <span className="w-20 text-right font-mono" style={{ color: c }}>{n} · {pct(n)}%</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>{stats.total} requests sent</span>
              <button onClick={resetStats} className="hover:text-slate-300">clear counters</button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-edge bg-void/50 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <FileCode2 size={13} /> Compiled nginx.conf preview
            {!valid && <Chip color="#f43f5e">showing last valid (live) config</Chip>}
          </div>
          <CodeView code={conf || appliedConf} highlight={['split_clients', '%', 'map $http', '@matches_0_match']} maxH="max-h-80" />
        </div>

        <div className="rounded-lg border border-edge bg-void/50 p-3">
          <div className="flex items-center gap-2">
            <GitFork size={14} className="text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Cross-namespace delegation</span>
            <Button
              size="sm"
              className="ml-auto"
              icon={Users}
              onClick={() => {
                setShowVsr((v) => !v)
                complete('m2-vsr')
              }}
            >
              {showVsr ? 'Hide' : 'Show'} VirtualServerRoute
            </Button>
          </div>
          {showVsr && (
            <div className="mt-3">
              <p className="mb-2 text-xs text-slate-400">
                The platform team owns the VirtualServer for <span className="font-mono">cafe.example.com</span>. The tea team owns{' '}
                <span className="font-mono">/tea</span> in its own namespace through a VirtualServerRoute. RBAC stays per namespace, and NIC merges both into one server block.
              </p>
              <CodeView code={VSR_DEMO} lang="yaml" maxH="max-h-72" highlight={['route:', 'host:']} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
