import {
  User, Server, FileCode2, ShieldCheck, Eye, ListOrdered, Wand2, Settings2, FileText, Crown,
  Zap, Cpu, Globe, Cloud, Network, Box, Layers,
} from 'lucide-react'
import { P, pointAt } from '../lib/useCluster.js'

const NODE_DEF = {
  developer: { label: 'Developer', sub: 'kubectl apply', icon: User, color: '#94a3b8' },
  api: { label: 'K8s API Server', sub: 'etcd · watch', icon: Server, color: '#326ce5' },
  vs: { label: 'VirtualServer', sub: 'k8s.nginx.org/v1', icon: FileCode2, color: '#009639' },
  policy: { label: 'Policy CRD', sub: 'rateLimit · jwt', icon: ShieldCheck, color: '#f59e0b' },
  informer: { label: 'Informers', sub: 'watch+cache', icon: Eye, color: '#326ce5' },
  workqueue: { label: 'Workqueue', sub: 'dedupe keys', icon: ListOrdered, color: '#326ce5' },
  configurator: { label: 'Configurator', sub: 'Go templates', icon: Wand2, color: '#326ce5' },
  manager: { label: 'Manager', sub: 'write + signal', icon: Settings2, color: '#326ce5' },
  conf: { label: 'conf.d/*.conf', sub: '/etc/nginx', icon: FileText, color: '#94a3b8' },
  plusapi: { label: 'NGINX Plus API', sub: 'live upstreams', icon: Zap, color: '#06b6d4' },
  master: { label: 'NGINX Master', sub: 'graceful reload', icon: Crown, color: '#009639' },
  w1: { label: 'Worker #1', sub: '', icon: Cpu, color: '#009639', inspect: 'workers' },
  w2: { label: 'Worker #2', sub: '', icon: Cpu, color: '#009639', inspect: 'workers' },
  client: { label: 'External Client', sub: 'HTTP/gRPC/TCP', icon: Globe, color: '#94a3b8' },
  lb: { label: 'Cloud LB', sub: 'NodePort / LB', icon: Cloud, color: '#326ce5' },
  svc: { label: 'ClusterIP Svc', sub: 'coffee-svc', icon: Network, color: '#326ce5' },
  v1: { label: 'Pods v1', sub: 'stable', icon: Box, color: '#06b6d4' },
  v2: { label: 'Pods v2', sub: 'canary', icon: Box, color: '#a855f7' },
}

const W = 104
const H = 46

function Edge({ a, b, color = '#24324f', active, dashed }) {
  const [x1, y1] = P[a]
  const [x2, y2] = P[b]
  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={active ? color : '#2a3a5c'}
      strokeWidth={active ? 2.2 : 1.6}
      className={active || dashed ? 'flow-dash' : ''}
      opacity={active ? 0.95 : 0.7}
    />
  )
}

function Node({ id, cluster, focus, onSelect, selected }) {
  const def = NODE_DEF[id]
  const [cx, cy] = P[id]
  const Icon = def.icon
  const isActive = cluster.active === id || (cluster.active === 'workers' && (id === 'w1' || id === 'w2'))
  const isFocus = focus.includes(def.inspect || id)
  const dim = id === 'plusapi' && cluster.mode !== 'plus'
  const reloadGlow = id === 'master' && cluster.reloading
  const stroke = reloadGlow ? '#f59e0b' : isActive ? def.color : selected ? '#e2e8f0' : isFocus ? def.color : '#2a3a5c'
  let sub = def.sub
  if (id === 'w1' || id === 'w2') sub = `gen ${cluster.generation}`
  if (id === 'v1' || id === 'v2') sub = `${cluster.replicas[id]} replica${cluster.replicas[id] === 1 ? '' : 's'}`
  if (id === 'master' && cluster.reloading) sub = 'RELOADING…'
  if (dim) sub = 'Plus only'

  return (
    <g
      transform={`translate(${cx - W / 2}, ${cy - H / 2})`}
      onClick={() => onSelect(def.inspect || id)}
      className="cursor-pointer"
      opacity={dim ? 0.35 : 1}
      role="button"
      aria-label={`Inspect ${def.label}`}
    >
      {(isActive || reloadGlow) && (
        <rect x={-5} y={-5} width={W + 10} height={H + 10} rx={12} fill="none" stroke={stroke} strokeWidth={2} opacity={0.5}>
          <animate attributeName="opacity" values="0.7;0.1;0.7" dur="0.9s" repeatCount="indefinite" />
        </rect>
      )}
      <rect
        width={W} height={H} rx={9}
        fill={isActive || reloadGlow ? '#16213a' : '#111a2e'}
        stroke={stroke}
        strokeWidth={isFocus || isActive || selected ? 1.8 : 1.2}
        strokeDasharray={isFocus && !isActive ? '0' : undefined}
      />
      <rect width={4} height={H} rx={2} fill={def.color} opacity={0.9} />
      <Icon x={9} y={15} width={16} height={16} color={def.color} strokeWidth={2} />
      <text x={30} y={20} fontSize={10.5} fontWeight={600} fill="#e2e8f0">{def.label}</text>
      <text x={30} y={34} fontSize={8.5} fill={reloadGlow ? '#f59e0b' : '#94a3b8'} fontFamily="var(--font-mono)">{sub}</text>
      {(id === 'v1' || id === 'v2') &&
        Array.from({ length: Math.min(cluster.replicas[id], 8) }).map((_, i) => (
          <rect key={i} x={W - 10 - (i % 4) * 8} y={6 + Math.floor(i / 4) * 8} width={5} height={5} rx={1} fill={def.color} opacity={0.8} />
        ))}
    </g>
  )
}

export default function FlowCanvas({ cluster, focus = [], onSelect, selected, overlay }) {
  const { tokens, now, draining } = cluster
  const ctl = ['developer>api', 'api>informer', 'informer>workqueue', 'workqueue>configurator', 'configurator>manager', 'manager>conf', 'conf>master', 'master>w1', 'master>w2']
  const data = ['client>lb', 'lb>w1', 'lb>w2', 'w1>svc', 'w2>svc', 'svc>v1', 'svc>v2']
  const crd = ['vs>api', 'policy>api']
  const plus = ['manager>plusapi', 'plusapi>w1', 'plusapi>w2']

  return (
    <svg viewBox="0 0 1000 520" className="w-full h-auto select-none" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui' }}>
      <defs>
        <linearGradient id="cpband" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#326ce5" stopOpacity="0.10" />
          <stop offset="1" stopColor="#326ce5" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="dpband" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#06b6d4" stopOpacity="0.02" />
          <stop offset="1" stopColor="#06b6d4" stopOpacity="0.10" />
        </linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>

      {/* plane bands */}
      <rect x={8} y={20} width={984} height={228} rx={14} fill="url(#cpband)" stroke="#326ce5" strokeOpacity={0.25} />
      <text x={22} y={40} fontSize={10} fontWeight={700} letterSpacing={2} fill="#326ce5">CONTROL PLANE</text>
      <rect x={8} y={340} width={984} height={170} rx={14} fill="url(#dpband)" stroke="#06b6d4" strokeOpacity={0.25} />
      <text x={22} y={502} fontSize={10} fontWeight={700} letterSpacing={2} fill="#06b6d4">DATA PLANE</text>

      {/* the single-container pod */}
      <rect x={300} y={48} width={450} height={420} rx={16} fill="#0b1120" fillOpacity={0.55} stroke="#009639" strokeOpacity={0.6} strokeDasharray="5 5" />
      <g transform="translate(312, 62)">
        <Layers x={0} y={-10} width={14} height={14} color="#009639" />
        <text x={18} y={1} fontSize={10} fontWeight={700} fill="#009639">nginx-ingress Pod · single container</text>
      </g>
      <text x={740} y={140} fontSize={9} textAnchor="end" fill="#475569" fontFamily="var(--font-mono)">IC Go process</text>
      <text x={740} y={460} fontSize={9} textAnchor="end" fill="#475569" fontFamily="var(--font-mono)">NGINX master + workers</text>

      {/* edges */}
      {crd.map((e) => { const [a, b] = e.split('>'); return <Edge key={e} a={a} b={b} dashed /> })}
      {ctl.map((e) => { const [a, b] = e.split('>'); return <Edge key={e} a={a} b={b} color="#326ce5" active={cluster.active && [a, b].includes(cluster.active)} /> })}
      {cluster.mode === 'plus' && plus.map((e) => { const [a, b] = e.split('>'); return <Edge key={e} a={a} b={b} color="#06b6d4" active={cluster.active === 'plusapi' || cluster.active === 'workers'} /> })}
      {data.map((e) => { const [a, b] = e.split('>'); return <Edge key={e} a={a} b={b} color="#06b6d4" dashed /> })}

      {/* draining old worker generations */}
      {draining > 0 && (
        <g transform={`translate(${P.w1[0] - W / 2}, ${P.w1[1] - H / 2 - 50})`}>
          {draining > 1 && <rect x={6} y={-5} width={W * 2 + 36} height={30} rx={8} fill="#1f1a10" stroke="#f59e0b" strokeDasharray="4 3" opacity={0.4} />}
          <rect width={W * 2 + 36} height={30} rx={8} fill="#1f1a10" stroke="#f59e0b" strokeDasharray="4 3" opacity={0.9} />
          <text x={10} y={19} fontSize={10} fill="#f59e0b" fontFamily="var(--font-mono)">
            {draining} old worker generation{draining > 1 ? 's' : ''} draining connections
          </text>
        </g>
      )}

      {Object.keys(NODE_DEF).map((id) => (
        <Node key={id} id={id} cluster={cluster} focus={focus} onSelect={onSelect} selected={selected === (NODE_DEF[id].inspect || id)} />
      ))}

      {/* tokens */}
      {tokens.map((k) => {
        const f = Math.max(0, Math.min(1, (now - k.t0) / k.dur))
        if (now < k.t0) return null
        const [x, y] = pointAt(k.pts, f)
        const fade = k.fail && f > 0.75 ? 1 - (f - 0.75) * 4 : 1
        return (
          <g key={k.id} opacity={fade} filter="url(#glow)">
            <circle cx={x} cy={y} r={k.r} fill={k.color} />
            {k.label && (f > 0.7 || !k.fail) && (
              <text x={x + 8} y={y - 6} fontSize={9} fontWeight={700} fill={k.color} fontFamily="var(--font-mono)">{k.label}</text>
            )}
          </g>
        )
      })}
      {overlay}
    </svg>
  )
}
