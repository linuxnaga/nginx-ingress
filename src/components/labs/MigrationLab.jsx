import { useState } from 'react'
import { ArrowRightLeft, CheckCircle2, XCircle } from 'lucide-react'
import { useGame } from '../../game.jsx'
import { CodeView } from '../ui.jsx'

const ITEMS = [
  {
    ann: 'nginx.ingress.kubernetes.io/canary-weight: "20"',
    answer: 'splits',
    yaml: 'routes:\n- path: /\n  splits:\n  - weight: 80\n    action: { pass: app-v1 }\n  - weight: 20\n    action: { pass: app-v2 }',
  },
  {
    ann: 'nginx.ingress.kubernetes.io/limit-rps: "10"',
    answer: 'rateLimit',
    yaml: 'kind: Policy\nspec:\n  rateLimit:\n    rate: 10r/s\n    key: ${binary_remote_addr}\n    zoneSize: 10M\n    rejectCode: 429',
  },
  {
    ann: 'nginx.ingress.kubernetes.io/whitelist-source-range: "10.0.0.0/8"',
    answer: 'accessControl',
    yaml: 'kind: Policy\nspec:\n  accessControl:\n    allow: ["10.0.0.0/8"]',
  },
  {
    ann: 'nginx.ingress.kubernetes.io/rewrite-target: /$2',
    answer: 'rewritePath',
    yaml: 'routes:\n- path: /api\n  action:\n    proxy:\n      upstream: api\n      rewritePath: /',
  },
  {
    ann: 'nginx.ingress.kubernetes.io/auth-tls-secret: default/ca',
    answer: 'ingressMTLS',
    yaml: 'kind: Policy\nspec:\n  ingressMTLS:\n    clientCertSecret: ca\n    verifyClient: "on"',
  },
  {
    ann: 'nginx.ingress.kubernetes.io/backend-protocol: "GRPC"',
    answer: 'grpc',
    yaml: 'upstreams:\n- name: greeter\n  service: greeter-svc\n  port: 50051\n  type: grpc',
  },
  {
    ann: 'nginx.ingress.kubernetes.io/ssl-redirect: "true"',
    answer: 'tlsRedirect',
    yaml: 'spec:\n  tls:\n    secret: app-tls\n    redirect:\n      enable: true\n      code: 301',
  },
  {
    ann: 'nginx.ingress.kubernetes.io/proxy-body-size: 8m',
    answer: 'bodySize',
    yaml: 'upstreams:\n- name: upload\n  service: upload-svc\n  port: 80\n  client-max-body-size: 8m',
  },
]

const TARGETS = [
  { id: 'splits', label: 'VS routes[].splits' },
  { id: 'rateLimit', label: 'Policy: rateLimit' },
  { id: 'accessControl', label: 'Policy: accessControl' },
  { id: 'rewritePath', label: 'VS action.proxy.rewritePath' },
  { id: 'ingressMTLS', label: 'Policy: ingressMTLS' },
  { id: 'grpc', label: 'VS upstream type: grpc' },
  { id: 'tlsRedirect', label: 'VS tls.redirect' },
  { id: 'bodySize', label: 'VS upstream client-max-body-size' },
]

export default function MigrationLab() {
  const { complete } = useGame()
  const [picks, setPicks] = useState({})
  const correct = ITEMS.filter((it, i) => picks[i] === it.answer).length

  const pick = (i, v) => {
    const next = { ...picks, [i]: v }
    setPicks(next)
    if (ITEMS.filter((it, k) => next[k] === it.answer).length >= 6) complete('m4-migrate')
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
        <ArrowRightLeft size={14} className="text-cyan-400" />
        Map each community <span className="font-mono text-slate-300">ingress-nginx</span> annotation to its F5 NGINX Ingress Controller equivalent. Get at least 6 of 8 right to complete the migration.
        <span className="ml-auto font-mono text-sm text-cyan-300">{correct}/{ITEMS.length}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {ITEMS.map((it, i) => {
          const p = picks[i]
          const ok = p === it.answer
          return (
            <div key={i} className={`rounded-lg border p-3 ${p ? (ok ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-rose-500/50 bg-rose-500/5') : 'border-edge bg-void/50'}`}>
              <div className="flex items-start gap-2">
                <code className="flex-1 break-all text-[11px] text-amber-200">{it.ann}</code>
                {p && (ok ? <CheckCircle2 size={15} className="text-emerald-400" /> : <XCircle size={15} className="text-rose-400" />)}
              </div>
              <select
                value={p || ''}
                onChange={(e) => pick(i, e.target.value)}
                className="mt-2 w-full rounded-md border border-edge bg-panel2 px-2 py-1.5 text-xs text-slate-200 outline-none"
                aria-label={`NIC equivalent for ${it.ann}`}
              >
                <option value="" disabled>Choose NIC equivalent…</option>
                {TARGETS.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
              {ok && <CodeView code={it.yaml} lang="yaml" maxH="max-h-40" className="mt-2" />}
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        Not every annotation has a CRD field. Global tuning goes to the NIC ConfigMap (for example proxy-buffering or worker-shutdown-timeout), and per-Ingress tweaks can use nginx.org/* annotations or VirtualServer snippets.
      </p>
    </div>
  )
}
