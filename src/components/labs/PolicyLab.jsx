import { useEffect, useMemo, useRef, useState } from 'react'
import YAML from 'yaml'
import { Flame, ShieldCheck, KeyRound, Fingerprint, Ban, ShieldAlert, Gauge, FileCode2 } from 'lucide-react'
import { useGame } from '../../game.jsx'
import { Button, CodeView, Toggle, Chip } from '../ui.jsx'
import { compileVirtualServer } from '../../lib/compile.js'

const OUTCOME = {
  ok: { label: '200 OK', color: '#009639' },
  rl: { label: 'Rate limited', color: '#f59e0b' },
  jwt: { label: '401 Unauthorized', color: '#f43f5e' },
  acl: { label: '403 Forbidden', color: '#fb7185' },
  mtls: { label: '400 No client cert', color: '#e879f9' },
  waf: { label: 'WAF blocked', color: '#ef4444' },
}

export const DEFAULT_POLICY = {
  rateLimit: { on: true, rate: 10, burst: 0, noDelay: true, rejectCode: 503 },
  jwt: { on: false, tokenShare: 70 },
  accessControl: { on: false, outsideShare: 20 },
  ingressMTLS: { on: false, certShare: 85 },
  waf: { on: false, attackShare: 15 },
}

function buildObjects(p) {
  const policies = []
  const mk = (name, spec) => ({ apiVersion: 'k8s.nginx.org/v1', kind: 'Policy', metadata: { name, namespace: 'default' }, spec })
  if (p.rateLimit.on)
    policies.push(
      mk('rate-limit-policy', {
        rateLimit: {
          rate: `${p.rateLimit.rate}r/s`,
          key: '${binary_remote_addr}',
          zoneSize: '10M',
          ...(p.rateLimit.burst ? { burst: p.rateLimit.burst } : {}),
          ...(p.rateLimit.noDelay ? { noDelay: true } : {}),
          rejectCode: p.rateLimit.rejectCode,
        },
      }),
    )
  if (p.jwt.on) policies.push(mk('jwt-policy', { jwt: { realm: 'CheckoutAPI', secret: 'jwk-secret', token: '$http_token' } }))
  if (p.accessControl.on) policies.push(mk('allow-corp', { accessControl: { allow: ['10.0.0.0/8', '192.168.0.0/16'] } }))
  if (p.ingressMTLS.on) policies.push(mk('client-mtls', { ingressMTLS: { clientCertSecret: 'ingress-mtls-secret', verifyClient: 'on', verifyDepth: 1 } }))
  if (p.waf.on)
    policies.push(mk('waf-policy', { waf: { enable: true, apPolicy: 'default/dataguard-alarm', securityLog: { enable: true, apLogConf: 'default/logconf', logDest: 'syslog:server=syslog-svc:514' } } }))
  const vs = {
    apiVersion: 'k8s.nginx.org/v1',
    kind: 'VirtualServer',
    metadata: { name: 'checkout', namespace: 'default' },
    spec: {
      host: 'shop.example.com',
      tls: { secret: 'shop-tls' },
      ...(policies.length ? { policies: policies.map((x) => ({ name: x.metadata.name })) } : {}),
      upstreams: [{ name: 'checkout', service: 'checkout-svc', port: 8080 }],
      routes: [{ path: '/checkout', action: { pass: 'checkout' } }],
    },
  }
  return { policies, vs }
}

// Simulate a burst: n requests evenly spread over `seconds`
export function simulateBurst(p, n = 100, seconds = 2) {
  const out = []
  let excess = 0
  let last = 0
  for (let i = 0; i < n; i++) {
    const t = (i / n) * seconds
    const rnd = (k) => ((Math.sin((i + 1) * 9301 + k * 49297) + 1) / 2) * 100
    // TLS handshake: mTLS is checked first
    if (p.ingressMTLS.on && rnd(1) > p.ingressMTLS.certShare) { out.push('mtls'); continue }
    // preaccess phase: limit_req (leaky bucket, excess measured in requests)
    if (p.rateLimit.on) {
      excess = Math.max(0, excess - p.rateLimit.rate * (t - last))
      last = t
      if (excess > p.rateLimit.burst) { out.push('rl'); continue }
      excess += 1
    }
    // access phase: allow/deny, then auth_jwt
    if (p.accessControl.on && rnd(2) < p.accessControl.outsideShare) { out.push('acl'); continue }
    if (p.jwt.on && rnd(3) > p.jwt.tokenShare) { out.push('jwt'); continue }
    // F5 WAF inspection
    if (p.waf.on && rnd(4) < p.waf.attackShare) { out.push('waf'); continue }
    out.push('ok')
  }
  return out
}

function PolicyRow({ on, onToggle, icon: Icon, title, plusOnly, children }) {
  return (
    <div className={`rounded-lg border p-2.5 ${on ? 'border-amber-500/40 bg-amber-500/5' : 'border-edge bg-void/40'}`}>
      <div className="flex items-center gap-2">
        <Icon size={15} className={on ? 'text-amber-400' : 'text-slate-500'} />
        <span className="text-[13px] font-semibold text-slate-200">{title}</span>
        {plusOnly && <Chip color="#06b6d4">NGINX Plus</Chip>}
        <div className="ml-auto"><Toggle on={on} onChange={onToggle} color="#f59e0b" /></div>
      </div>
      {on && <div className="mt-2 grid gap-2 text-xs text-slate-400">{children}</div>}
    </div>
  )
}

function Range({ label, value, min, max, step = 1, onChange, suffix = '' }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-36 shrink-0">{label}</span>
      <input type="range" className="slider flex-1" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="w-14 text-right font-mono text-slate-200">{value}{suffix}</span>
    </label>
  )
}

export default function PolicyLab({ cluster, onReport, onPolicy, initial }) {
  const { complete } = useGame()
  const [p, setP] = useState(initial || DEFAULT_POLICY)
  const [results, setResults] = useState([])
  const [shown, setShown] = useState(0)
  const [running, setRunning] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    onPolicy?.(p)
  }, [p]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearInterval(timer.current), [])

  const upd = (k, patch) => setP((s) => ({ ...s, [k]: { ...s[k], ...patch } }))
  const { policies, vs } = useMemo(() => buildObjects(p), [p])
  const yamlText = useMemo(
    () => [...policies, vs].map((o) => YAML.stringify(o, { indent: 2, indentSeq: true })).join('---\n'),
    [policies, vs],
  )
  const conf = useMemo(() => compileVirtualServer(vs, policies), [vs, policies])

  const fire = () => {
    const res = simulateBurst(p)
    setResults(res)
    setShown(0)
    setRunning(true)
    clearInterval(timer.current)
    let i = 0
    cluster.log('$ hey -n 100 -c 50 https://shop.example.com/checkout  # burst of 100 requests', 'cmd')
    timer.current = setInterval(() => {
      const chunk = 4
      for (let k = 0; k < chunk && i < res.length; k++, i++) {
        const o = res[i]
        if (o === 'ok') cluster.request('v1', { color: '#009639' })
        else cluster.request('reject', { code: o === 'rl' ? String(p.rateLimit.rejectCode) : OUTCOME[o].label.split(' ')[0] })
      }
      setShown(i)
      if (i >= res.length) {
        clearInterval(timer.current)
        setRunning(false)
        const c = res.reduce((m, o) => ((m[o] = (m[o] || 0) + 1), m), {})
        cluster.log(
          `Burst done: ${c.ok || 0}×200, ${c.rl || 0}×${p.rateLimit.rejectCode} (limit_req), ${c.jwt || 0}×401, ${c.acl || 0}×403 ACL, ${c.mtls || 0}×400 mTLS, ${c.waf || 0} WAF blocks. All rejected at NGINX workers`,
          c.rl || c.jwt ? 'warn' : 'ok',
        )
        if (c.rl) complete('m3-ratelimit')
        if (c.jwt) complete('m3-jwt')
        if (c.acl || c.mtls || c.waf) complete('m3-acl')
        onReport?.({ policy: p, counts: c })
      }
    }, 45)
  }

  const counts = results.slice(0, shown).reduce((m, o) => ((m[o] = (m[o] || 0) + 1), m), {})

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col gap-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Attach Policy CRDs to VirtualServer checkout</div>
        <PolicyRow on={p.rateLimit.on} onToggle={(on) => upd('rateLimit', { on })} icon={Gauge} title="rateLimit">
          <Range label="rate (r/s)" value={p.rateLimit.rate} min={1} max={50} onChange={(v) => upd('rateLimit', { rate: v })} />
          <Range label="burst" value={p.rateLimit.burst} min={0} max={50} onChange={(v) => upd('rateLimit', { burst: v })} />
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-36">rejectCode</span>
            {[503, 429].map((c) => (
              <button key={c} onClick={() => upd('rateLimit', { rejectCode: c })} className={`rounded px-2 py-0.5 font-mono ${p.rateLimit.rejectCode === c ? 'bg-amber-500 text-slate-950' : 'bg-panel2'}`}>
                {c}{c === 503 ? ' (default)' : ''}
              </button>
            ))}
            <Toggle on={p.rateLimit.noDelay} onChange={(v) => upd('rateLimit', { noDelay: v })} label="noDelay" color="#f59e0b" />
          </div>
        </PolicyRow>
        <PolicyRow on={p.jwt.on} onToggle={(on) => upd('jwt', { on })} icon={KeyRound} title="jwt" plusOnly>
          <Range label="requests with valid JWT" value={p.jwt.tokenShare} min={0} max={100} step={5} suffix="%" onChange={(v) => upd('jwt', { tokenShare: v })} />
        </PolicyRow>
        <PolicyRow on={p.accessControl.on} onToggle={(on) => upd('accessControl', { on })} icon={Ban} title="accessControl (allow 10.0.0.0/8)">
          <Range label="traffic from outside CIDR" value={p.accessControl.outsideShare} min={0} max={100} step={5} suffix="%" onChange={(v) => upd('accessControl', { outsideShare: v })} />
        </PolicyRow>
        <PolicyRow on={p.ingressMTLS.on} onToggle={(on) => upd('ingressMTLS', { on })} icon={Fingerprint} title="ingressMTLS">
          <Range label="clients presenting cert" value={p.ingressMTLS.certShare} min={0} max={100} step={5} suffix="%" onChange={(v) => upd('ingressMTLS', { certShare: v })} />
        </PolicyRow>
        <PolicyRow on={p.waf.on} onToggle={(on) => upd('waf', { on })} icon={ShieldAlert} title="waf (F5 WAF for NGINX)">
          <Range label="malicious payloads (SQLi/XSS)" value={p.waf.attackShare} min={0} max={100} step={5} suffix="%" onChange={(v) => upd('waf', { attackShare: v })} />
        </PolicyRow>
        <p className="text-[11px] leading-relaxed text-slate-500">
          Evaluation order in a worker: TLS handshake (mTLS) → preaccess (limit_req) → access (allow/deny, auth_jwt) → WAF → proxy_pass. The control plane is never on the request path.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-edge bg-void/50 p-3">
          <div className="flex items-center gap-2">
            <Button variant="danger" icon={Flame} onClick={fire} disabled={running}>
              Fire burst · 100 requests in 2s
            </Button>
            <span className="text-[11px] text-slate-500">≈50 r/s offered load</span>
          </div>
          <div className="mt-3 grid grid-cols-[repeat(20,minmax(0,1fr))] gap-1">
            {Array.from({ length: 100 }).map((_, i) => {
              const o = i < shown ? results[i] : null
              return (
                <div
                  key={i}
                  title={o ? OUTCOME[o].label : 'pending'}
                  className={`aspect-square rounded-sm transition ${o ? 'pop' : ''}`}
                  style={{ background: o ? OUTCOME[o].color : '#16213a' }}
                />
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(OUTCOME).map(([k, o]) => (
              <span key={k} className="flex items-center gap-1.5 rounded bg-panel2 px-2 py-1 text-[11px]">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: o.color }} />
                {k === 'rl' ? `${p.rateLimit.rejectCode} ${p.rateLimit.rejectCode === 429 ? 'Too Many Requests' : 'Service Unavailable'}` : o.label}
                <b className="font-mono" style={{ color: o.color }}>{counts[k] || 0}</b>
              </span>
            ))}
          </div>
          {p.rateLimit.on && p.rateLimit.rejectCode === 503 && (
            <p className="mt-2 text-[11px] text-amber-300/80">
              Tip: NIC's rateLimit default rejectCode is 503. Clients and CDNs read 503 as an outage, so set rejectCode: 429 for Too Many Requests.
            </p>
          )}
        </div>
        <details className="group rounded-lg border border-edge bg-void/50 p-3" open>
          <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <ShieldCheck size={13} /> Generated Policy + VirtualServer YAML
          </summary>
          <CodeView code={yamlText} lang="yaml" maxH="max-h-64" className="mt-2" highlight={['rejectCode', 'policies:']} />
        </details>
        <div className="rounded-lg border border-edge bg-void/50 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <FileCode2 size={13} /> Compiled nginx.conf preview
          </div>
          <CodeView code={conf} maxH="max-h-72" highlight={['limit_req', 'auth_jwt', 'allow ', 'ssl_verify_client', 'app_protect']} />
        </div>
      </div>
    </div>
  )
}
