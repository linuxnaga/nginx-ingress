import { useState } from 'react'
import { BarChart3, Search, LayoutDashboard, Radar } from 'lucide-react'
import { useGame } from '../../game.jsx'
import { Button, CodeView } from '../ui.jsx'

const OTEL = `kind: ConfigMap
apiVersion: v1
metadata:
  name: nginx-config
  namespace: nginx-ingress
data:
  otel-exporter-endpoint: "otel-collector.observability:4317"
  otel-service-name: "nginx-ingress"
  otel-trace-in-http: "true"        # trace every server block
  worker-shutdown-timeout: "10s"   # cap how long old workers drain
---
# Deployment args
args:
  - -enable-prometheus-metrics       # :9113/metrics
  - -enable-latency-metrics          # upstream latency histograms
  - -nginx-status                    # stub_status (OSS) / Plus API + dashboard :8080`

export default function MetricsLab({ cluster }) {
  const { complete } = useGame()
  const [q, setQ] = useState('nginx_ingress_controller_nginx_reloads_total')
  const [result, setResult] = useState(null)

  const metrics = {
    nginx_ingress_controller_nginx_reloads_total: [
      { labels: '{class="nginx",reason="endpoints"}', v: Math.max(0, Math.round(cluster.reloads * 0.6)) },
      { labels: '{class="nginx",reason="other"}', v: cluster.reloads - Math.max(0, Math.round(cluster.reloads * 0.6)) },
    ],
    nginx_ingress_controller_nginx_reload_errors_total: [{ labels: '{class="nginx"}', v: 0 }],
    nginx_ingress_controller_nginx_last_reload_milliseconds: [{ labels: '{class="nginx"}', v: 180 + cluster.reloads * 3 }],
    nginx_ingress_controller_nginx_last_reload_status: [{ labels: '{class="nginx"}', v: 1 }],
    nginx_ingress_controller_virtualserver_resources_total: [{ labels: '{class="nginx",type="all"}', v: 3 }],
    nginx_ingress_controller_workqueue_depth: [{ labels: '{class="nginx",name="taskQueue"}', v: cluster.draining * 2 }],
    nginx_ingress_nginxplus_upstream_server_active: [
      { labels: '{upstream="vs_default_cafe_coffee-v1"}', v: cluster.mode === 'plus' ? cluster.replicas.v1 : 'n/a (Plus only)' },
    ],
  }

  const run = (query = q) => {
    setQ(query)
    const rate = query.match(/^rate\((\w+)\[5m\]\)$/)
    const name = rate ? rate[1] : query.trim()
    const rows = metrics[name]
    if (!rows) {
      setResult({ err: `no series for "${query}". Try one of the suggestions.` })
      return
    }
    setResult({
      rows: rows.map((r) => ({
        name: `${rate ? `rate(${name}${r.labels}[5m])` : name + r.labels}`,
        v: rate && typeof r.v === 'number' ? (r.v / 300).toFixed(4) : r.v,
      })),
    })
    if (name === 'nginx_ingress_controller_nginx_reloads_total') complete('m4-metrics')
  }

  const plus = cluster.mode === 'plus'
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-edge bg-void/50 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <BarChart3 size={13} /> Prometheus · nginx-ingress:9113/metrics
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              run()
            }}
          >
            <input value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 rounded-md border border-edge bg-void px-2.5 py-1.5 font-mono text-xs text-slate-200 outline-none focus:border-k8s" aria-label="PromQL query" />
            <Button variant="blue" icon={Search} size="sm" type="submit">Execute</Button>
          </form>
          <div className="mt-2 flex flex-wrap gap-1">
            {[
              'nginx_ingress_controller_nginx_reloads_total',
              'rate(nginx_ingress_controller_nginx_reloads_total[5m])',
              'nginx_ingress_controller_nginx_last_reload_milliseconds',
              'nginx_ingress_controller_nginx_reload_errors_total',
              'nginx_ingress_controller_workqueue_depth',
              'nginx_ingress_nginxplus_upstream_server_active',
            ].map((s) => (
              <button key={s} onClick={() => run(s)} className="rounded bg-panel2 px-2 py-0.5 font-mono text-[10px] text-slate-400 hover:text-cyan-300">
                {s.replace('nginx_ingress_controller_', '…').replace('nginx_ingress_nginxplus_', 'plus…')}
              </button>
            ))}
          </div>
          {result && (
            <div className="mt-3 rounded-md border border-edge bg-void p-2 font-mono text-[11px]">
              {result.err ? (
                <span className="text-amber-300">{result.err}</span>
              ) : (
                result.rows.map((r) => (
                  <div key={r.name} className="flex justify-between gap-3">
                    <span className="truncate text-slate-400">{r.name}</span>
                    <span className="text-cyan-300">{r.v}</span>
                  </div>
                ))
              )}
            </div>
          )}
          <p className="mt-2 text-[11px] text-slate-500">
            Alert idea: <span className="font-mono">increase(nginx_ingress_controller_nginx_reloads_total[5m]) &gt; 20</span> means reload storm risk. Run the churn in the Reload Storm tab and query again.
          </p>
        </div>
        <div className="rounded-lg border border-edge bg-void/50 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Radar size={13} /> OpenTelemetry & metrics wiring
          </div>
          <CodeView code={OTEL} lang="yaml" maxH="max-h-72" highlight={['otel-', 'prometheus', 'worker-shutdown']} />
        </div>
      </div>

      <div className={`rounded-lg border p-3 ${plus ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-edge bg-void/50'}`}>
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <LayoutDashboard size={13} /> NGINX Plus live dashboard · :8080/dashboard.html
        </div>
        {!plus ? (
          <p className="text-xs text-slate-400">
            The live dashboard is NGINX Plus only. Switch the diagram toggle to <b className="text-cyan-300">NGINX Plus</b> to open it. OSS gives you stub_status counters plus the Prometheus exporter.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                ['Connections', '1,284 active'],
                ['Requests', `${(2400 + cluster.replicas.v1 * 130).toLocaleString()} req/s`],
                ['SSL handshakes', '99.8% ok'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md border border-edge bg-void p-2">
                  <div className="text-[10px] uppercase text-slate-500">{k}</div>
                  <div className="font-mono text-sm text-cyan-300">{v}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold text-slate-300">HTTP Upstreams</div>
              <table className="w-full text-left font-mono text-[11px]">
                <thead className="text-slate-500">
                  <tr><th className="py-1">upstream</th><th>servers</th><th>req/s</th><th>5xx</th><th>health</th></tr>
                </thead>
                <tbody className="text-slate-300">
                  {[
                    ['vs_default_cafe_coffee-v1', cluster.replicas.v1, 1900, 0],
                    ['vs_default_cafe_coffee-v2', cluster.replicas.v2, 210, cluster.replicas.v2 ? 0 : '-'],
                    ['vs_default_checkout_checkout', 4, 380, 2],
                  ].map(([n, s, r, e]) => (
                    <tr key={n} className="border-t border-edge">
                      <td className="py-1 pr-2">{n}</td>
                      <td>{s} up</td>
                      <td>{r}</td>
                      <td className={e ? 'text-rose-300' : ''}>{e}</td>
                      <td>
                        <div className="flex gap-0.5">
                          {Array.from({ length: Math.min(Number(s) || 0, 8) }).map((_, i) => (
                            <span key={i} className="h-2 w-2 rounded-sm bg-emerald-500" />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-500">
              Scale pods in Module 1 or the canary lab and the server count here changes live. Those are the zone updates the IC made through the Plus API, with no reload.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
