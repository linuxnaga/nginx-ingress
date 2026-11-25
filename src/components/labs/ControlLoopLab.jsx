import { useMemo, useRef, useState } from 'react'
import { Play, Plus, Minus, RefreshCcw, Zap, FileCode2 } from 'lucide-react'
import { useGame } from '../../game.jsx'
import { Button, CodeView, Stat } from '../ui.jsx'
import { compileVirtualServer, parseDocs } from '../../lib/compile.js'

const VS = `apiVersion: k8s.nginx.org/v1
kind: VirtualServer
metadata:
  name: cafe
  namespace: default
spec:
  host: cafe.example.com
  upstreams:
  - name: coffee
    service: coffee-v1-svc
    port: 80
  routes:
  - path: /coffee
    action:
      pass: coffee`

const STEPS = [
  ['K8s API Server', 'Stores the VirtualServer and emits a watch event.'],
  ['Informer', 'Updates its local cache and enqueues "default/cafe".'],
  ['Workqueue', 'Hands the key to the Controller sync handler (duplicate keys collapse).'],
  ['Configurator', 'Resolves Services, EndpointSlices and Secrets, then renders vs_default_cafe.conf.'],
  ['Manager', 'Writes /etc/nginx/conf.d/vs_default_cafe.conf and signals the master.'],
  ['NGINX Master', 'Validates the config, forks new workers and drains the old ones.'],
]

export default function ControlLoopLab({ cluster }) {
  const { complete } = useGame()
  const [busy, setBusy] = useState(false)
  const [lastScale, setLastScale] = useState(null)
  const baseline = useRef({ reloads: cluster.reloads, api: cluster.apiUpdates })

  const conf = useMemo(() => {
    const vs = parseDocs(VS).objects[0]
    const eps = Array.from({ length: cluster.replicas.v1 }, (_, i) => `10.244.1.${11 + i}`)
    return compileVirtualServer(vs, [], { plus: cluster.mode === 'plus', endpoints: { 'coffee-v1-svc': eps } })
  }, [cluster.replicas.v1, cluster.mode])

  const apply = () => {
    setBusy(true)
    const d = cluster.applyConfig('virtualserver.k8s.nginx.org/default/cafe')
    setTimeout(() => {
      setBusy(false)
      complete('m1-apply')
    }, d + 300)
  }

  const scale = (delta) => {
    setBusy(true)
    const { plus } = cluster.scale('v1', delta)
    setLastScale(plus ? 'plus' : 'oss')
    setTimeout(() => {
      setBusy(false)
      complete(plus ? 'm1-scale-plus' : 'm1-scale-oss')
    }, 2900)
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-edge bg-void/50 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">1 · Push config through the control loop</div>
          <CodeView code={VS} lang="yaml" maxH="max-h-56" />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="blue" icon={Play} onClick={apply} disabled={busy}>
              kubectl apply -f cafe-vs.yaml
            </Button>
            <span className="text-xs text-slate-500">Watch the blue YAML packet travel through the IC process.</span>
          </div>
          <ol className="mt-3 space-y-1">
            {STEPS.map(([n, d], i) => (
              <li key={n} className="flex gap-2 text-xs">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-k8s/20 font-mono text-[10px] text-blue-300">{i + 1}</span>
                <span><b className="text-slate-200">{n}:</b> <span className="text-slate-400">{d}</span></span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-lg border border-edge bg-void/50 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">2 · Scale backend pods (EndpointSlice churn)</div>
          <p className="text-xs text-slate-400">
            Scale <span className="font-mono text-cyan-300">coffee-v1</span> in both modes. Use the{' '}
            <b>NGINX Open Source / NGINX Plus</b> toggle above the diagram. OSS rewrites the upstream and reloads (amber packet).
            Plus PATCHes the upstream zone through the API (cyan packet) with zero reloads.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button icon={Minus} onClick={() => scale(-1)} disabled={busy || cluster.replicas.v1 <= 1}>Scale down</Button>
            <span className="rounded-md bg-panel2 px-3 py-1.5 font-mono text-sm">{cluster.replicas.v1} pods</span>
            <Button variant={cluster.mode === 'plus' ? 'cyan' : 'amber'} icon={Plus} onClick={() => scale(1)} disabled={busy || cluster.replicas.v1 >= 12}>
              Scale up
            </Button>
          </div>
          {lastScale && (
            <div className={`mt-3 rounded-md px-3 py-2 text-xs ${lastScale === 'plus' ? 'bg-cyan-500/10 text-cyan-300' : 'bg-amber-500/10 text-amber-300'}`}>
              {lastScale === 'plus' ? (
                <><Zap size={12} className="mr-1 inline" />NGINX Plus: the Manager called the Plus API. Worker generation unchanged, existing connections untouched.</>
              ) : (
                <><RefreshCcw size={12} className="mr-1 inline" />NGINX OSS: upstream server lines changed, so the config was rewritten and a graceful reload started a new worker generation.</>
              )}
            </div>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label="Reloads" value={cluster.reloads - baseline.current.reloads} color="#f59e0b" />
            <Stat label="Plus API updates" value={cluster.apiUpdates - baseline.current.api} color="#06b6d4" />
            <Stat label="Worker gen" value={cluster.generation} color="#009639" />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-edge bg-void/50 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <FileCode2 size={13} /> Compiled conf.d/vs_default_cafe.conf ({cluster.mode === 'plus' ? 'NGINX Plus' : 'NGINX OSS'})
        </div>
        <CodeView code={conf} highlight={cluster.mode === 'plus' ? ['state ', 'Plus API'] : ['server 10.244']} maxH="max-h-[560px]" />
        <p className="mt-2 text-[11px] text-slate-500">
          {cluster.mode === 'plus'
            ? 'In Plus mode, upstream membership lives in a shared-memory zone with a state file, so the file never changes when pods scale.'
            : 'Each pod IP is a server line. Scale the Deployment and watch these lines change: that text diff is why OSS must reload.'}
        </p>
      </div>
    </div>
  )
}
