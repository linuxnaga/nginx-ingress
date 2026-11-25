// Mini "Configurator": turns F5 NGINX Ingress Controller custom resources
// (VirtualServer, Policy, TransportServer, GlobalConfiguration) into the kind of
// NGINX configuration the real Go Configurator renders from its templates.
// It is a teaching approximation of the real templates, not a byte-exact copy.
import YAML from 'yaml'

export function parseDocs(text) {
  try {
    const docs = YAML.parseAllDocuments(text)
    const errs = docs.flatMap((d) => d.errors)
    if (errs.length) return { error: errs[0].message.split('\n')[0], objects: [] }
    const objects = docs.map((d) => d.toJS()).filter(Boolean)
    return { error: null, objects }
  } catch (e) {
    return { error: String(e.message || e), objects: [] }
  }
}

const meta = (o) => ({
  name: o?.metadata?.name || 'unnamed',
  ns: o?.metadata?.namespace || 'default',
})

export function upstreamName(vs, up) {
  const { name, ns } = meta(vs)
  return `vs_${ns}_${name}_${up}`
}

// Validate a VirtualServer the way the IC does before it accepts it.
export function validateVS(vs) {
  const errs = []
  if (!vs) return ['No VirtualServer found in manifest']
  if (vs.kind !== 'VirtualServer') errs.push(`kind must be VirtualServer (got ${vs.kind})`)
  const spec = vs.spec || {}
  if (!spec.host) errs.push('spec.host is required')
  const ups = (spec.upstreams || []).map((u) => u.name)
  for (const r of spec.routes || []) {
    if (r.splits) {
      const total = r.splits.reduce((s, x) => s + Number(x.weight || 0), 0)
      if (total !== 100) errs.push(`route ${r.path}: split weights must sum to 100 (got ${total})`)
      for (const s of r.splits) {
        const p = s.action?.pass
        if (p && !ups.includes(p)) errs.push(`route ${r.path}: split passes to unknown upstream "${p}"`)
      }
    }
    const pass = r.action?.pass
    if (pass && !ups.includes(pass)) errs.push(`route ${r.path}: action.pass references unknown upstream "${pass}"`)
    for (const m of r.matches || []) {
      const p = m.action?.pass
      if (p && !ups.includes(p)) errs.push(`route ${r.path}: match passes to unknown upstream "${p}"`)
    }
  }
  return errs
}

function policyDirectives(pol, vs, indent) {
  if (!pol?.spec) return { http: [], server: [] }
  const { name, ns } = meta(pol)
  const v = meta(vs)
  const s = pol.spec
  const http = []
  const server = []
  if (s.rateLimit) {
    const rl = s.rateLimit
    const zone = `pol_rl_${ns}_${name}_${v.ns}_${v.name}`
    http.push(`limit_req_zone ${rl.key || '${binary_remote_addr}'} zone=${zone}:${rl.zoneSize || '10M'} rate=${rl.rate || '10r/s'};`)
    server.push(`${indent}limit_req zone=${zone}${rl.burst ? ` burst=${rl.burst}` : ''}${rl.noDelay ? ' nodelay' : ''};`)
    server.push(`${indent}limit_req_status ${rl.rejectCode || 503};`)
    if (rl.logLevel) server.push(`${indent}limit_req_log_level ${rl.logLevel};`)
  }
  if (s.jwt) {
    server.push(`${indent}auth_jwt "${s.jwt.realm || 'API'}"${s.jwt.token ? ` token=${s.jwt.token}` : ''};`)
    if (s.jwt.secret) server.push(`${indent}auth_jwt_key_file /etc/nginx/secrets/${ns}-${s.jwt.secret};`)
    if (s.jwt.jwksURI) server.push(`${indent}auth_jwt_key_request /_jwks_uri_server_${name};`)
  }
  if (s.accessControl) {
    for (const a of s.accessControl.allow || []) server.push(`${indent}allow ${a};`)
    if (s.accessControl.allow) server.push(`${indent}deny all;`)
    for (const d of s.accessControl.deny || []) server.push(`${indent}deny ${d};`)
    if (s.accessControl.deny) server.push(`${indent}allow all;`)
  }
  if (s.ingressMTLS) {
    server.push(`${indent}ssl_client_certificate /etc/nginx/secrets/${ns}-${s.ingressMTLS.clientCertSecret || 'ca-secret'};`)
    server.push(`${indent}ssl_verify_client ${s.ingressMTLS.verifyClient || 'on'};`)
    server.push(`${indent}ssl_verify_depth ${s.ingressMTLS.verifyDepth ?? 1};`)
  }
  if (s.oidc) {
    server.push(`${indent}# OIDC (NGINX Plus) – njs-based auth code flow`)
    server.push(`${indent}auth_jwt "" token=$session_jwt;`)
    server.push(`${indent}error_page 401 = @do_oidc_flow;`)
  }
  if (s.waf) {
    server.push(`${indent}app_protect_enable ${s.waf.enable === false ? 'off' : 'on'};`)
    if (s.waf.apPolicy) server.push(`${indent}app_protect_policy_file /etc/nginx/waf/nac-policies/${s.waf.apPolicy.replace('/', '_')};`)
    if (s.waf.securityLog?.enable) server.push(`${indent}app_protect_security_log_enable on;`)
  }
  return { http, server }
}

function mapName(vs, ri, mi, ci) {
  const { name, ns } = meta(vs)
  return `$vs_${ns}_${name}_matches_${ri}_match_${mi}_cond_${ci}`
}

export function compileVirtualServer(vs, policies = [], { plus = false, endpoints = {} } = {}) {
  if (!vs?.spec) return '# waiting for a valid VirtualServer…'
  const spec = vs.spec
  const { name, ns } = meta(vs)
  const out = []
  const httpLevel = []
  const findPol = (ref) => policies.find((p) => meta(p).name === (ref?.name || ref))

  const serverPolicies = (spec.policies || []).map((r) => findPol(r)).filter(Boolean)
  const serverPolDirs = serverPolicies.map((p) => policyDirectives(p, vs, '    '))
  serverPolDirs.forEach((d) => httpLevel.push(...d.http))

  out.push(`# /etc/nginx/conf.d/vs_${ns}_${name}.conf`)
  out.push(`# generated by the IC Configurator – do not edit`)
  // upstreams
  for (const u of spec.upstreams || []) {
    const un = upstreamName(vs, u.name)
    out.push(`upstream ${un} {`)
    out.push(`    zone ${un} 256k;`)
    if (u.lbMethod) out.push(`    ${u.lbMethod === 'round_robin' ? '# round_robin (default)' : u.lbMethod};`)
    else out.push(`    random two least_conn;`)
    const eps = endpoints[u.service] || [`10.0.${(u.name.length * 7) % 200}.11`]
    if (plus) {
      out.push(`    # endpoints managed at runtime via NGINX Plus API (no reload)`)
      out.push(`    state /var/lib/nginx/state/${un}.conf;`)
    } else {
      for (const ip of eps) out.push(`    server ${ip}:${u.port || 80} max_fails=1 fail_timeout=10s;`)
    }
    if (u.type === 'grpc') out.push(`    # type: grpc → upstream speaks HTTP/2`)
    out.push(`    keepalive ${u.keepalive ?? 16};`)
    out.push(`}`)
    out.push('')
  }

  // split_clients and maps
  ;(spec.routes || []).forEach((r, ri) => {
    if (r.splits) {
      out.push(`split_clients $request_id $vs_${ns}_${name}_splits_${ri} {`)
      for (const s of r.splits) {
        out.push(`    ${String(s.weight).padStart(3)}% ${upstreamName(vs, s.action?.pass)};`)
      }
      out.push(`}`)
      out.push('')
    }
    ;(r.matches || []).forEach((m, mi) => {
      ;(m.conditions || []).forEach((c, ci) => {
        const variable = c.header
          ? `$http_${c.header.toLowerCase().replace(/-/g, '_')}`
          : c.cookie
            ? `$cookie_${c.cookie}`
            : c.argument
              ? `$arg_${c.argument}`
              : c.variable || '$request_method'
        out.push(`map ${variable} ${mapName(vs, ri, mi, ci)} {`)
        out.push(`    "${c.value}" 1;`)
        out.push(`    default 0;`)
        out.push(`}`)
      })
      if ((m.conditions || []).length) out.push('')
    })
    if ((r.matches || []).length) {
      const all = []
      const regs = []
      r.matches.forEach((m, mi) => {
        const n = (m.conditions || []).length
        regs.push(`    ~^${'.'.repeat(all.length)}${'1'.repeat(n)} @matches_${ri}_match_${mi};`)
        ;(m.conditions || []).forEach((_, ci) => all.push(mapName(vs, ri, mi, ci)))
      })
      out.push(`map ${all.join('')} $vs_${ns}_${name}_matches_${ri} {`)
      out.push(...regs)
      out.push(`    default @matches_${ri}_default;`)
      out.push(`}`)
      out.push('')
    }
  })

  httpLevel.forEach((l) => out.unshift(l))
  if (httpLevel.length) out.splice(httpLevel.length, 0, '')

  // server
  out.push(`server {`)
  out.push(`    listen 80;`)
  out.push(`    listen [::]:80;`)
  if (spec.tls?.secret) {
    out.push(`    listen 443 ssl;`)
    out.push(`    http2 on;`)
    out.push(`    ssl_certificate /etc/nginx/secrets/${ns}-${spec.tls.secret};`)
    out.push(`    ssl_certificate_key /etc/nginx/secrets/${ns}-${spec.tls.secret};`)
  }
  out.push(`    server_name ${spec.host || '_'};`)
  out.push(`    status_zone ${spec.host || name};`)
  if (spec.tls?.redirect?.enable) {
    out.push(`    if ($scheme = http) { return ${spec.tls.redirect.code || 301} https://$host$request_uri; }`)
  }
  serverPolDirs.forEach((d) => out.push(...d.server))
  if (spec['server-snippets']) {
    out.push(`    # server-snippets`)
    String(spec['server-snippets']).trim().split('\n').forEach((l) => out.push(`    ${l.trim()}`))
  }

  ;(spec.routes || []).forEach((r, ri) => {
    out.push('')
    if (r.route) {
      out.push(`    # path ${r.path} delegated to VirtualServerRoute ${r.route}`)
      out.push(`    # (its subroutes are rendered here once the VSR is valid)`)
      return
    }
    const matches = r.matches || []
    if (matches.length) {
      out.push(`    location ${r.path} {`)
      out.push(`        error_page 418 = $vs_${ns}_${name}_matches_${ri};`)
      out.push(`        return 418;`)
      out.push(`    }`)
      matches.forEach((m, mi) => {
        out.push(`    # match ${mi}: ${(m.conditions || []).map((c) => `${c.header || c.cookie || c.argument || c.variable}=${c.value}`).join(' AND ')}`)
        out.push(`    location @matches_${ri}_match_${mi} {`)
        out.push(`        proxy_set_header Host $host;`)
        out.push(`        proxy_pass http://${upstreamName(vs, m.action?.pass)};`)
        out.push(`    }`)
      })
      out.push(`    location @matches_${ri}_default {`)
    } else {
      out.push(`    location ${r.path} {`)
    }
    if (r.errorPages) {
      for (const ep of r.errorPages) {
        out.push(`        error_page ${(ep.codes || []).join(' ')} ${ep.return ? `@error_page_${ri}` : ep.redirect?.url || ''};`)
      }
      out.push(`        proxy_intercept_errors on;`)
    }
    if (r['location-snippets']) {
      String(r['location-snippets']).trim().split('\n').forEach((l) => out.push(`        ${l.trim()}`))
    }
    ;(r.policies || []).forEach((ref) => {
      const p = findPol(ref)
      if (p) {
        const d = policyDirectives(p, vs, '        ')
        out.push(...d.server)
      }
    })
    if (r.action?.proxy?.rewritePath) out.push(`        rewrite ^${r.path}(.*)$ ${r.action.proxy.rewritePath}$1 break;`)
    out.push(`        proxy_http_version 1.1;`)
    out.push(`        proxy_set_header Host $host;`)
    out.push(`        proxy_set_header X-Real-IP $remote_addr;`)
    if (r.splits) out.push(`        proxy_pass http://$vs_${ns}_${name}_splits_${ri};`)
    else if (r.action?.pass || r.action?.proxy?.upstream) out.push(`        proxy_pass http://${upstreamName(vs, r.action.pass || r.action.proxy.upstream)};`)
    else if (r.action?.return) out.push(`        return ${r.action.return.code || 200} "${r.action.return.body || ''}";`)
    else if (r.action?.redirect) out.push(`        return ${r.action.redirect.code || 301} ${r.action.redirect.url};`)
    out.push(`    }`)
  })
  out.push(`}`)
  return out.join('\n')
}

export function compileTransportServer(ts, gc) {
  if (!ts?.spec) return '# waiting for a valid TransportServer…'
  const { name, ns } = meta(ts)
  const spec = ts.spec
  const out = []
  const lis = (gc?.spec?.listeners || []).find((l) => l.name === spec.listener?.name)
  out.push(`# /etc/nginx/stream-conf.d/ts_${ns}_${name}.conf`)
  for (const u of spec.upstreams || []) {
    const un = `ts_${ns}_${name}_${u.name}`
    out.push(`upstream ${un} {`)
    out.push(`    zone ${un} 512k;`)
    out.push(`    server 10.0.7.21:${u.port};`)
    out.push(`    server 10.0.7.22:${u.port};`)
    out.push(`}`)
    out.push('')
  }
  out.push(`server {`)
  if (spec.listener?.name === 'tls-passthrough') {
    out.push(`    listen unix:/var/lib/nginx/passthrough-https.sock proxy_protocol;`)
    out.push(`    # SNI host ${spec.host || '?'} is mapped by the built-in tls-passthrough listener on :443`)
  } else if (lis) {
    out.push(`    listen ${lis.port}${String(lis.protocol).toUpperCase() === 'UDP' ? ' udp' : ''};`)
  } else {
    out.push(`    # ERROR: listener "${spec.listener?.name}" not defined in GlobalConfiguration`)
  }
  if (spec.upstreamParameters?.udpRequests) out.push(`    proxy_requests ${spec.upstreamParameters.udpRequests};`)
  if (spec.upstreamParameters?.udpResponses) out.push(`    proxy_responses ${spec.upstreamParameters.udpResponses};`)
  if (spec.sessionParameters?.timeout) out.push(`    proxy_timeout ${spec.sessionParameters.timeout};`)
  if (spec.action?.pass) out.push(`    proxy_pass ts_${ns}_${name}_${spec.action.pass};`)
  out.push(`}`)
  return out.join('\n')
}
