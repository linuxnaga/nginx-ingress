import { useCallback, useEffect, useRef, useState } from 'react'

// Coordinates of every node in the dual-plane SVG canvas (viewBox 1000 x 520)
export const P = {
  developer: [70, 80],
  api: [200, 80],
  vs: [70, 190],
  policy: [200, 190],
  informer: [360, 90],
  workqueue: [470, 90],
  configurator: [580, 90],
  manager: [690, 90],
  conf: [690, 200],
  plusapi: [430, 205],
  master: [580, 285],
  w1: [460, 410],
  w2: [600, 410],
  client: [70, 410],
  lb: [200, 410],
  svc: [820, 410],
  v1: [935, 345],
  v2: [935, 470],
}

const CONTROL_RELOAD = ['developer', 'api', 'informer', 'workqueue', 'configurator', 'manager', 'conf', 'master']
const CONTROL_PLUS = ['api', 'informer', 'workqueue', 'configurator', 'manager', 'plusapi']

function pathLen(pts) {
  let L = 0
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  return L
}

export function pointAt(pts, f) {
  const L = pathLen(pts)
  let d = f * L
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    if (d <= seg || i === pts.length - 1) {
      const t = seg ? Math.min(1, d / seg) : 1
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]
    }
    d -= seg
  }
  return pts[pts.length - 1]
}

let tokenSeq = 0

// Simulated cluster: owns the OSS/Plus mode, reload bookkeeping and animated
// packets ("tokens") that travel along the canvas.
export function useCluster(init = {}) {
  const [mode, setMode] = useState(init.mode || 'oss') // 'oss' | 'plus'
  const [tokens, setTokens] = useState([])
  const [now, setNow] = useState(() => performance.now())
  const [reloads, setReloads] = useState(0)
  const [apiUpdates, setApiUpdates] = useState(0)
  const [generation, setGeneration] = useState(1)
  const [draining, setDraining] = useState(0)
  const [reloading, setReloading] = useState(false)
  const [active, setActive] = useState(null) // node id currently pulsing
  const [replicas, setReplicas] = useState(init.replicas || { v1: 3, v2: 1 })
  const [events, setEvents] = useState([
    { t: Date.now(), kind: 'info', msg: 'nginx-ingress pod Ready: IC process started NGINX master (pid 14), 2 workers' },
  ])
  const raf = useRef(0)
  const timers = useRef([])

  const log = useCallback((msg, kind = 'info') => {
    setEvents((e) => [...e.slice(-80), { t: Date.now(), kind, msg }])
  }, [])

  const later = useCallback((ms, fn) => {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
  }, [])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // animation loop only while tokens exist
  useEffect(() => {
    if (!tokens.length) return
    const tick = () => {
      const t = performance.now()
      setNow(t)
      setTokens((ts) => {
        const alive = ts.filter((k) => t - k.t0 < k.dur + (k.linger || 0))
        return alive.length === ts.length ? ts : alive
      })
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [tokens.length > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  const spawn = useCallback((nodes, opts = {}) => {
    const pts = nodes.map((n) => (Array.isArray(n) ? n : P[n]))
    const tok = {
      id: ++tokenSeq,
      pts,
      t0: performance.now() + (opts.delay || 0),
      dur: opts.dur || 1600,
      color: opts.color || '#06b6d4',
      r: opts.r || 5,
      label: opts.label,
      fail: opts.fail,
      linger: opts.linger || 0,
    }
    setTokens((ts) => [...ts.slice(-220), tok])
    return tok
  }, [])

  // Graceful reload: new worker generation, old one drains
  const reload = useCallback(
    (reason = 'other') => {
      setReloads((r) => r + 1)
      setReloading(true)
      setGeneration((g) => g + 1)
      setDraining((d) => d + 1)
      log(`NGINX master: reload (reason=${reason}) → spawning worker generation, old workers draining`, 'warn')
      later(900, () => setReloading(false))
      later(3200, () => setDraining((d) => Math.max(0, d - 1)))
    },
    [log, later],
  )

  // kubectl apply of a config resource → always a reload (config text changes)
  const applyConfig = useCallback(
    (what = 'virtualserver.k8s.nginx.org/cafe', { silent = false } = {}) => {
      if (!silent) log(`$ kubectl apply -f manifest.yaml → ${what} configured`, 'cmd')
      const seq = CONTROL_RELOAD
      const dur = 3200
      spawn(seq, { color: '#326ce5', dur, r: 6, label: 'YAML' })
      seq.forEach((n, i) => later((dur / (seq.length - 1)) * i, () => setActive(n)))
      later(dur * 0.3, () => log(`Informer: MODIFIED event → enqueue key "${what.split('/').slice(1).join('/') || 'default/cafe'}"`))
      later(dur * 0.55, () => log('Configurator: rendered conf.d/vs_default_cafe.conf from nginx.virtualserver.tmpl'))
      later(dur * 0.85, () => log('Manager: wrote config, signalling NGINX master (SIGHUP)'))
      later(dur, () => {
        setActive(null)
        reload('other')
      })
      return dur
    },
    [log, spawn, later, reload],
  )

  // Endpoints change → OSS reload, Plus dynamic API
  const scale = useCallback(
    (target, delta) => {
      const next = Math.max(0, Math.min(12, replicas[target] + delta))
      setReplicas((r) => ({ ...r, [target]: next }))
      log(`$ kubectl scale deploy coffee-${target} --replicas=${next}`, 'cmd')
      const plus = mode === 'plus'
      const seq = plus ? CONTROL_PLUS : CONTROL_RELOAD.slice(1)
      const dur = 2600
      spawn(seq, { color: plus ? '#06b6d4' : '#f59e0b', dur, r: 6, label: 'EPS' })
      seq.forEach((n, i) => later((dur / (seq.length - 1)) * i, () => setActive(n)))
      later(dur * 0.25, () => log('Informer: EndpointSlice changed for service coffee-svc'))
      if (plus) {
        later(dur, () => {
          setActive('workers')
          setApiUpdates((a) => a + 1)
          log('Manager: PATCH NGINX Plus API /api/9/http/upstreams/vs_default_cafe_coffee/servers → updated live, 0 reloads', 'ok')
          spawn(['plusapi', 'w1'], { color: '#06b6d4', dur: 600 })
          spawn(['plusapi', 'w2'], { color: '#06b6d4', dur: 600 })
          later(700, () => setActive(null))
        })
      } else {
        later(dur * 0.7, () => log('Configurator: upstream server list changed → config must be rewritten'))
        later(dur, () => {
          setActive(null)
          reload('endpoints')
        })
      }
      return { plus, next }
    },
    [mode, replicas, log, spawn, later, reload],
  )

  // A data-plane request; outcome: 'v1' | 'v2' | 'reject' | 'tcp'
  const request = useCallback(
    (outcome, opts = {}) => {
      const w = Math.random() < 0.5 ? 'w1' : 'w2'
      const color =
        opts.color || (outcome === 'reject' ? '#f43f5e' : outcome === 'v2' ? '#a855f7' : outcome === 'tcp' ? '#f59e0b' : '#06b6d4')
      if (outcome === 'reject') {
        spawn(['client', 'lb', w, [P[w][0], P[w][1] - 40]], { color, dur: 1100, delay: opts.delay, label: opts.code, fail: true })
      } else {
        const dst = outcome === 'v2' ? 'v2' : 'v1'
        spawn(['client', 'lb', w, 'svc', dst], { color, dur: 1500, delay: opts.delay })
      }
    },
    [spawn],
  )

  const changeMode = useCallback(
    (m) => {
      setMode(m)
      log(m === 'plus' ? 'Switched data plane to NGINX Plus (dynamic upstream API enabled)' : 'Switched data plane to NGINX Open Source (reload on endpoint change)')
    },
    [log],
  )

  return {
    mode,
    setMode: changeMode,
    tokens,
    now,
    reloads,
    apiUpdates,
    generation,
    draining,
    reloading,
    active,
    setActive,
    replicas,
    events,
    log,
    spawn,
    reload,
    applyConfig,
    scale,
    request,
  }
}
