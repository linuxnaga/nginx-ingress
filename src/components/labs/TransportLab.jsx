import { useMemo, useState } from 'react'
import { Radio, Upload, FileCode2, RotateCcw } from 'lucide-react'
import { useGame } from '../../game.jsx'
import { Button, CodeView, YamlEditor } from '../ui.jsx'
import { compileTransportServer, parseDocs } from '../../lib/compile.js'

const START = `apiVersion: k8s.nginx.org/v1
kind: GlobalConfiguration
metadata:
  name: nginx-configuration
  namespace: nginx-ingress
spec:
  listeners:
    - name: dns-udp
      port: 5353
      protocol: UDP
    - name: postgres-tcp
      port: 5432
      protocol: TCP
---
apiVersion: k8s.nginx.org/v1
kind: TransportServer
metadata:
  name: dns
  namespace: default
spec:
  listener:
    name: dns-tcp        # ← fix me: must match a GlobalConfiguration listener
    protocol: UDP
  upstreams:
    - name: dns-app
      service: coredns
      port: 5353
  upstreamParameters:
    udpRequests: 1
    udpResponses: 1
  action:
    pass: dns-app
`

function validate(objs) {
  const gc = objs.find((o) => o.kind === 'GlobalConfiguration')
  const ts = objs.find((o) => o.kind === 'TransportServer')
  const errs = []
  if (!ts) errs.push('no TransportServer in manifest')
  if (!gc) errs.push('no GlobalConfiguration in manifest')
  if (ts && gc) {
    const ln = ts.spec?.listener?.name
    if (ln !== 'tls-passthrough') {
      const l = (gc.spec?.listeners || []).find((x) => x.name === ln)
      if (!l) errs.push(`listener "${ln}" is not defined in GlobalConfiguration nginx-ingress/nginx-configuration`)
      else if (String(l.protocol).toUpperCase() !== String(ts.spec.listener.protocol).toUpperCase())
        errs.push(`listener protocol ${ts.spec.listener.protocol} does not match GlobalConfiguration protocol ${l.protocol}`)
    }
    const ups = (ts.spec?.upstreams || []).map((u) => u.name)
    if (ts.spec?.action?.pass && !ups.includes(ts.spec.action.pass)) errs.push(`action.pass references unknown upstream "${ts.spec.action.pass}"`)
  }
  return { gc, ts, errs }
}

export default function TransportLab({ cluster }) {
  const { complete } = useGame()
  const [text, setText] = useState(START)
  const [live, setLive] = useState(null)
  const parsed = useMemo(() => parseDocs(text), [text])
  const { gc, ts, errs } = useMemo(() => validate(parsed.objects), [parsed])
  const valid = !parsed.error && !errs.length
  const conf = useMemo(() => compileTransportServer(ts, gc), [ts, gc])

  const apply = () => {
    const d = cluster.applyConfig('transportserver.k8s.nginx.org/default/dns')
    setTimeout(() => {
      setLive({ ts, gc })
      cluster.log(`TransportServer default/dns: State=Valid → stream-conf.d/ts_default_dns.conf`, 'ok')
    }, d)
  }

  const send = () => {
    const l = (live.gc.spec.listeners || []).find((x) => x.name === live.ts.spec.listener.name)
    const proto = String(l?.protocol || 'TCP').toUpperCase()
    cluster.log(`$ dig @ingress.example.com -p ${l?.port} cafe.svc  # ${proto} datagrams → stream context`, 'cmd')
    for (let i = 0; i < 16; i++) cluster.request('tcp', { delay: i * 80, color: proto === 'UDP' ? '#f59e0b' : '#facc15' })
    complete('m3-ts')
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Radio size={13} /> L4 manifests (editable)
          <button className="ml-auto flex items-center gap-1 text-[11px] font-normal normal-case text-slate-500 hover:text-slate-300" onClick={() => setText(START)}>
            <RotateCcw size={11} /> reset
          </button>
        </div>
        <YamlEditor value={text} onChange={setText} error={parsed.error} warnings={errs} rows={20} />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="blue" icon={Upload} onClick={apply} disabled={!valid}>kubectl apply</Button>
          <Button variant="amber" icon={Radio} onClick={send} disabled={!live}>Send L4 traffic</Button>
          <span className="text-[11px] text-slate-500">{live ? `Live on :${(live.gc.spec.listeners.find((l) => l.name === live.ts.spec.listener.name) || {}).port}` : 'Fix the listener name, then apply'}</span>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-edge bg-void/50 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <FileCode2 size={13} /> Compiled stream {'{ }'} config
          </div>
          <CodeView code={conf} highlight={['listen', 'ERROR', 'proxy_pass']} maxH="max-h-80" />
        </div>
        <div className="rounded-lg border border-edge bg-void/50 p-3 text-xs leading-relaxed text-slate-400">
          <p><b className="text-slate-200">How it fits together:</b> the IC is started with <span className="font-mono text-cyan-300">-global-configuration=nginx-ingress/nginx-configuration</span>. Each GlobalConfiguration listener becomes a port that NGINX binds in the <span className="font-mono">stream</span> context, and you also have to expose that port on the NIC Service.</p>
          <p className="mt-2">A TransportServer claims one listener by name and protocol. One listener can only be used by one TransportServer. Use the built-in <span className="font-mono">tls-passthrough</span> listener to route TLS by SNI on :443 without terminating it. gRPC is L7 (HTTP/2), so it goes on a VirtualServer upstream with <span className="font-mono">type: grpc</span>.</p>
        </div>
      </div>
    </div>
  )
}
