// Curriculum content, aligned with the F5 NGINX Ingress Controller docs
// (docs.nginx.com/nginx-ingress-controller): architecture/design, VirtualServer
// & VirtualServerRoute resources, Policy resources, TransportServer &
// GlobalConfiguration, logging/monitoring, and the ingress-nginx migration guide.

export const RANKS = [
  { level: 1, title: 'YAML Apprentice', minXp: 0 },
  { level: 2, title: 'Manifest Mechanic', minXp: 200 },
  { level: 3, title: 'CRD Router', minXp: 500 },
  { level: 4, title: 'Policy Enforcer', minXp: 850 },
  { level: 5, title: 'Kubernetes Ingress Architect', minXp: 1250 },
]

export const MODULES = [
  {
    id: 'm1',
    num: 1,
    title: 'Pod Internals & Control Loop Flow',
    short: 'Control Loop',
    icon: 'Cpu',
    accent: '#326ce5',
    summary:
      'One pod, one container, three kinds of processes. Follow a `kubectl apply` from the API server through the IC process into nginx.conf, and see why NGINX Plus can scale upstreams without a reload.',
    concepts: [
      'The NIC pod runs a single container holding the Ingress Controller (IC) Go process, the NGINX master process and the NGINX worker processes.',
      'Informers watch the Kubernetes API and keep a local cache. Changes are added to the Workqueue, and the Controller sync handler processes them one at a time.',
      'The Configurator turns resources into NGINX config using Go templates. The Manager writes files under /etc/nginx/ and asks the NGINX master to reload.',
      'A reload starts new workers with the new config. Old workers finish in-flight requests and then exit (worker-shutdown-timeout).',
      'With NGINX Plus, changes to Service endpoints are pushed through the NGINX Plus API into upstream zones, with no reload.',
    ],
    focus: ['informer', 'workqueue', 'configurator', 'manager', 'master', 'workers'],
    tasks: [
      { id: 'm1-inspect', label: 'Inspect 4 control-plane components', xp: 30 },
      { id: 'm1-apply', label: 'Trace a kubectl apply through the control loop', xp: 40 },
      { id: 'm1-scale-oss', label: 'Scale endpoints on NGINX OSS (observe reload)', xp: 40 },
      { id: 'm1-scale-plus', label: 'Scale endpoints on NGINX Plus (zero reload)', xp: 50 },
      { id: 'm1-quiz', label: 'Pass the Control Loop knowledge check', xp: 60 },
    ],
    quiz: [
      {
        q: 'How many containers does a default NGINX Ingress Controller pod run?',
        options: [
          'Two: an IC sidecar plus an NGINX container',
          'One: the IC process and the NGINX master/worker processes share it',
          'Three: IC, NGINX master and NGINX workers each have one',
          'It depends on the number of Ingress resources',
        ],
        answer: 1,
        why: 'NIC runs as a single container. The IC Go process starts and manages the NGINX master, which forks the workers.',
      },
      {
        q: 'Which IC component turns a VirtualServer object into NGINX configuration text?',
        options: ['Informer', 'Workqueue', 'Configurator', 'NGINX Master'],
        answer: 2,
        why: 'The Configurator renders config from Go templates. The Manager writes the files and controls NGINX.',
      },
      {
        q: 'A Deployment behind a VirtualServer scales from 3 to 10 pods. What happens with NGINX Open Source?',
        options: [
          'Nothing, NGINX discovers pods through DNS on its own',
          'The upstream config is regenerated and NGINX reloads',
          'Workers are patched in place through a REST API',
          'The IC pod restarts',
        ],
        answer: 1,
        why: 'With OSS, endpoint IPs live in the upstream server lines, so a change means writing the config again and reloading.',
      },
      {
        q: 'What is the advantage of NGINX Plus when endpoints change?',
        options: [
          'It reloads faster',
          'It caches the old endpoints forever',
          'The IC updates upstream servers through the NGINX Plus API, so there is no reload',
          'It sends traffic straight to the Service ClusterIP',
        ],
        answer: 2,
        why: 'NGINX Plus upstreams use shared-memory zones that the IC can change at runtime through the API.',
      },
      {
        q: 'During a reload, what happens to requests that old workers are still serving?',
        options: [
          'They are dropped right away',
          'Old workers finish them gracefully while new workers take new connections',
          'They move to the new workers mid-stream',
          'They get a 503 error',
        ],
        answer: 1,
        why: 'A graceful reload keeps old workers alive until their connections close, or until worker-shutdown-timeout passes.',
      },
    ],
  },
  {
    id: 'm2',
    num: 2,
    title: 'Advanced L7 Routing with CRDs',
    short: 'L7 Routing',
    icon: 'GitBranch',
    accent: '#009639',
    summary:
      'Move from annotation-heavy Ingress to typed VirtualServer resources. Split canary traffic by weight, route beta users by header, and delegate paths to other namespaces with VirtualServerRoute.',
    concepts: [
      'A standard Ingress only has host and path rules. Anything more needs annotations, which are untyped strings.',
      'A VirtualServer is a typed CRD that holds upstreams, routes, splits, matches, actions, errorPages and snippets, and it is validated when you apply it.',
      'splits render as an NGINX split_clients block keyed on $request_id. The weights must add up to 100.',
      'matches render as map blocks on request variables, such as $http_x_beta_user. The first match that fits wins, and otherwise the route falls back to its default action or splits.',
      'A VirtualServerRoute lets a team in another namespace own a subtree of paths, delegated from the VirtualServer with route: <namespace>/<name>.',
    ],
    focus: ['vs', 'configurator', 'workers', 'svc'],
    tasks: [
      { id: 'm2-compile', label: 'Edit the VirtualServer and recompile nginx.conf', xp: 40 },
      { id: 'm2-canary', label: 'Run a weighted canary split (v2 between 1% and 50%)', xp: 50 },
      { id: 'm2-header', label: 'Route X-Beta-User traffic to v2 with matches', xp: 50 },
      { id: 'm2-vsr', label: 'Explore cross-namespace VirtualServerRoute delegation', xp: 30 },
      { id: 'm2-quiz', label: 'Pass the L7 Routing knowledge check', xp: 60 },
    ],
    quiz: [
      {
        q: 'Which NGINX directive does a VirtualServer `splits` block compile to?',
        options: ['map', 'split_clients', 'upstream backup', 'mirror'],
        answer: 1,
        why: 'NIC generates `split_clients $request_id $vs_..._splits_N { 90% ...; 10% ...; }`.',
      },
      {
        q: 'You apply a VirtualServer whose splits add up to 95. What happens?',
        options: [
          'NGINX sends the remaining 5% to the first upstream',
          'The IC rejects the resource and reports a Warning event and status',
          'The weights are normalized to 100',
          'NGINX fails to reload and goes down',
        ],
        answer: 1,
        why: 'The IC validates CRDs before rendering. An invalid VS is rejected, and its state shows Invalid with a reason.',
      },
      {
        q: 'How is a path delegated to a team in another namespace?',
        options: [
          'A second VirtualServer with the same host',
          'A route with `route: team-ns/team-vsr` that points at a VirtualServerRoute',
          'An Ingress with the nginx.org/mergeable-ingress-type annotation only',
          'A TransportServer',
        ],
        answer: 1,
        why: 'The VS route delegates to a VSR. The VSR must use the same host, and its subroutes must start with the delegated path.',
      },
      {
        q: 'A matches condition with `header: X-Beta-User, value: "true"` is evaluated against which NGINX variable?',
        options: ['$http_x_beta_user', '$arg_x_beta_user', '$cookie_x_beta_user', '$upstream_http_x_beta_user'],
        answer: 0,
        why: 'Request headers are available as $http_<name>, lower-cased with dashes turned into underscores.',
      },
    ],
  },
  {
    id: 'm3',
    num: 3,
    title: 'Security Policies & L4 Load Balancing',
    short: 'Policies & L4',
    icon: 'Shield',
    accent: '#f59e0b',
    summary:
      'Attach Policy CRDs for rate limiting, JWT, OIDC, mTLS, access control and F5 WAF to VirtualServers. Then open TCP/UDP listeners with GlobalConfiguration and route them with TransportServer.',
    concepts: [
      'A Policy is its own resource, referenced from spec.policies (the server) or routes[].policies (a location) of a VirtualServer or VirtualServerRoute.',
      'rateLimit renders limit_req_zone and limit_req. The default rejectCode is 503, so set rejectCode: 429 to return Too Many Requests.',
      'jwt validates tokens at the worker (NGINX Plus). oidc runs the full authorization code flow (NGINX Plus). ingressMTLS checks client certificates. accessControl allows or denies CIDRs.',
      'The waf policy turns on F5 WAF for NGINX (formerly NGINX App Protect) with an APPolicy and security logging.',
      'GlobalConfiguration defines extra listeners (port and protocol). A TransportServer binds to one and load balances TCP/UDP in the stream context. tls-passthrough is a built-in listener.',
    ],
    focus: ['policy', 'workers', 'vs'],
    tasks: [
      { id: 'm3-ratelimit', label: 'Fire a 100-request burst into a rateLimit policy', xp: 50 },
      { id: 'm3-jwt', label: 'Block tokenless requests with a jwt policy', xp: 40 },
      { id: 'm3-acl', label: 'Try ACL, mTLS or WAF enforcement', xp: 30 },
      { id: 'm3-ts', label: 'Bind a TransportServer to a GlobalConfiguration listener', xp: 50 },
      { id: 'm3-quiz', label: 'Pass the Policies & L4 knowledge check', xp: 60 },
    ],
    quiz: [
      {
        q: 'Which status code does a NIC rateLimit policy return by default when a request is over the limit?',
        options: ['429', '503', '403', '401'],
        answer: 1,
        why: 'rateLimit.rejectCode defaults to 503. Set it to 429 explicitly for Too Many Requests.',
      },
      {
        q: 'Where are rate-limited requests rejected?',
        options: [
          'At the Kubernetes API server',
          'In the IC Go process',
          'In the NGINX worker processes (data plane)',
          'In the backend pods',
        ],
        answer: 2,
        why: 'The policy is compiled into limit_req directives that the workers enforce per request. The control plane is never on the request path.',
      },
      {
        q: 'To load balance DNS over UDP port 5353 you need…',
        options: [
          'Only an Ingress with a UDP annotation',
          'A GlobalConfiguration listener (port 5353, UDP) plus a TransportServer that references it',
          'A VirtualServer with type: udp',
          'A NodePort Service only',
        ],
        answer: 1,
        why: 'Listeners are defined centrally in GlobalConfiguration (given to the IC with -global-configuration). TransportServers bind to them by name.',
      },
      {
        q: 'Which policy types require NGINX Plus?',
        options: ['rateLimit and accessControl', 'jwt and oidc', 'ingressMTLS only', 'None'],
        answer: 1,
        why: 'JWT validation and OIDC use NGINX Plus features. Rate limiting, access control and mTLS work with OSS.',
      },
    ],
  },
  {
    id: 'm4',
    num: 4,
    title: 'Production Operations & Observability',
    short: 'Prod Ops',
    icon: 'Activity',
    accent: '#06b6d4',
    summary:
      'Keep NGINX stable at scale: avoid reload storms, watch the right Prometheus and OpenTelemetry signals, use the NGINX Plus live dashboard, and migrate community ingress-nginx annotations to NIC CRDs.',
    concepts: [
      'Each reload starts a new set of workers while old ones drain. Many reloads close together stack up worker generations and memory, which can lead to OOMKills.',
      'The IC batches work: on startup and when many resources change together, it processes them as one batch and reloads once. With NGINX Plus, endpoint churn needs no reload at all.',
      'Prometheus (-enable-prometheus-metrics, port 9113) exposes signals such as nginx_ingress_controller_nginx_reloads_total, nginx_ingress_controller_nginx_last_reload_milliseconds and workqueue depth.',
      'OpenTelemetry tracing is set in the ConfigMap (otel-exporter-endpoint, otel-service-name, otel-trace-in-http). The NGINX Plus dashboard (port 8080, /dashboard.html) shows live zone and upstream health.',
      'Migrating from community ingress-nginx (nginx.ingress.kubernetes.io/*) means mapping annotations to VirtualServer fields, Policy resources, ConfigMap keys or nginx.org/* annotations.',
    ],
    focus: ['master', 'workers', 'manager', 'plusapi'],
    tasks: [
      { id: 'm4-storm', label: 'Trigger a reload storm without batching', xp: 40 },
      { id: 'm4-batch', label: 'Survive the same churn with batching or NGINX Plus', xp: 50 },
      { id: 'm4-metrics', label: 'Query reload metrics in the Prometheus console', xp: 30 },
      { id: 'm4-migrate', label: 'Migrate 6 ingress-nginx annotations to NIC', xp: 60 },
      { id: 'm4-quiz', label: 'Pass the Production Ops knowledge check', xp: 60 },
    ],
    quiz: [
      {
        q: 'Why can frequent reloads cause OOM kills of the NIC pod?',
        options: [
          'Reloads leak goroutines in the API server',
          'Each reload spawns new workers while old ones drain, so several generations hold memory at once',
          'Reloads delete the upstream zones',
          'Prometheus scrapes more often during reloads',
        ],
        answer: 1,
        why: 'Old workers keep memory until their connections close. Long-lived connections and many reloads add up to stacked memory.',
      },
      {
        q: 'Which metric directly counts NGINX reloads?',
        options: [
          'nginx_ingress_nginx_http_requests_total',
          'nginx_ingress_controller_nginx_reloads_total',
          'kube_pod_container_status_restarts_total',
          'nginx_ingress_controller_ingress_resources_total',
        ],
        answer: 1,
        why: 'It is labelled by reason (endpoints or other). Use it together with nginx_ingress_controller_nginx_reload_errors_total.',
      },
      {
        q: 'The community annotation `nginx.ingress.kubernetes.io/canary-weight: "20"` maps best to…',
        options: [
          'A Policy rateLimit',
          'VirtualServer route splits with weights 80/20',
          'nginx.org/canary: "true"',
          'A TransportServer',
        ],
        answer: 1,
        why: 'NIC models canaries natively with splits on a route, so there is no need for a second "canary" Ingress.',
      },
      {
        q: '`nginx.ingress.kubernetes.io/whitelist-source-range` becomes which NIC resource?',
        options: [
          'Policy with accessControl.allow',
          'GlobalConfiguration listener',
          'VirtualServer tls.redirect',
          'ConfigMap key proxy-buffering',
        ],
        answer: 0,
        why: 'IP allow and deny lists are an accessControl Policy attached to the VS or a route.',
      },
    ],
  },
]

export const BADGES = [
  {
    id: 'b-control',
    name: 'Control Loop & Reload Mechanics',
    icon: 'RotateCcw',
    color: '#326ce5',
    requires: ['m1-apply', 'm1-scale-oss', 'm1-scale-plus', 'm1-quiz'],
  },
  {
    id: 'b-canary',
    name: 'VirtualServer & Canary Splits',
    icon: 'Split',
    color: '#009639',
    requires: ['m2-canary', 'm2-header', 'm2-quiz'],
  },
  {
    id: 'b-l4',
    name: 'L4 TransportServer & Policies',
    icon: 'Shield',
    color: '#f59e0b',
    requires: ['m3-ratelimit', 'm3-jwt', 'm3-ts', 'm3-quiz'],
  },
  {
    id: 'b-plus',
    name: 'NGINX Plus Zero-Reload Upstreams',
    icon: 'Zap',
    color: '#06b6d4',
    requires: ['m1-scale-plus', 'm4-batch', 'm4-quiz'],
  },
]

export const MISSIONS = [
  {
    id: 'mission-1',
    num: 1,
    title: 'Zero-Downtime Canary',
    icon: 'Rocket',
    xp: 150,
    module: 'm2',
    brief:
      'The cafe team shipped coffee v2. Its Deployment is at 0 replicas. Roll it out to internal beta users first, then to 10% of everyone, then promote it to 100%, all without a single failed request.',
    objectives: [
      { id: 'scale', text: 'Scale coffee-v2 to at least 2 ready pods before sending it traffic' },
      { id: 'beta', text: 'Send X-Beta-User: true requests to v2 using a matches rule' },
      { id: 'canary', text: 'Serve 10% of general traffic from v2 (90/10 split) and fire at least 50 requests' },
      { id: 'promote', text: 'Promote to 100% v2 and fire at least 20 more requests' },
      { id: 'clean', text: 'Keep failed requests at 0 throughout' },
    ],
  },
  {
    id: 'mission-2',
    num: 2,
    title: 'Shield the Checkout API',
    icon: 'ShieldAlert',
    xp: 150,
    module: 'm3',
    brief:
      'A scraper is hammering /checkout. Attach a rateLimit Policy that returns 429 (not the default 503), hold the rate at 10r/s with a burst of 20, and require a valid JWT so anonymous bots get 401.',
    objectives: [
      { id: 'rl', text: 'Attach a rateLimit policy with rate 10r/s and burst 20' },
      { id: 'code', text: 'Set rejectCode to 429' },
      { id: 'jwt', text: 'Attach a jwt policy too' },
      { id: 'fire', text: 'Fire a 100-request burst and see both 401s and 429s rejected at the worker' },
    ],
  },
  {
    id: 'mission-3',
    num: 3,
    title: 'Tame the Reload Storm',
    icon: 'Flame',
    xp: 150,
    module: 'm4',
    brief:
      'An HPA is flapping a 50-pod Deployment while CI applies 30 VirtualServers. The NIC pod has a 512 MiB memory limit and is getting OOMKilled. Bring reloads down and keep memory under the limit.',
    objectives: [
      { id: 'see', text: 'Reproduce the storm: run the churn with no protections and watch memory pass 512 MiB' },
      { id: 'fix', text: 'Run the churn again with batching and/or NGINX Plus enabled' },
      { id: 'reloads', text: 'Finish the run with 5 reloads or fewer' },
      { id: 'mem', text: 'Keep peak memory under 512 MiB' },
    ],
  },
]

// Inspector cards for clickable diagram nodes
export const NODES = {
  developer: {
    title: 'Developer · kubectl apply',
    plane: 'control',
    role: 'Sends a VirtualServer, Policy or Ingress manifest to the Kubernetes API server. NIC never receives anything from kubectl directly, because everything goes through the API.',
    facts: ['kubectl apply -f cafe-vs.yaml', 'kubectl describe vs cafe  # shows State: Valid / Invalid', 'kubectl get events --field-selector involvedObject.kind=VirtualServer'],
  },
  api: {
    title: 'Kubernetes API Server',
    plane: 'control',
    role: 'Stores the desired state in etcd and streams watch events (ADDED / MODIFIED / DELETED) to anything listening, including the NIC informers. It also holds EndpointSlices, which change whenever backend pods scale.',
    facts: ['Watch streams per resource type', 'CRDs: k8s.nginx.org/v1 VirtualServer, VirtualServerRoute, Policy, TransportServer, GlobalConfiguration', 'EndpointSlices drive upstream membership'],
  },
  vs: {
    title: 'VirtualServer CRD',
    plane: 'control',
    role: 'A typed L7 load-balancing config for one host: upstreams, routes, splits, matches, actions, error pages, policies and snippets. The IC validates it and writes its State (Valid, Warning, Invalid) back into status.',
    facts: ['apiVersion: k8s.nginx.org/v1', 'Renders to /etc/nginx/conf.d/vs_<ns>_<name>.conf', 'Delegates paths with route: <ns>/<vsr-name>'],
  },
  policy: {
    title: 'Policy CRD',
    plane: 'control',
    role: 'A reusable security or traffic policy: rateLimit, jwt, oidc, ingressMTLS, egressMTLS, accessControl, basicAuth, apiKey or waf. It does nothing until a VirtualServer or VirtualServerRoute references it in spec.policies or routes[].policies.',
    facts: ['One policy type per Policy resource', 'Server-level and route-level attachment', 'Enforced in NGINX workers, never in the IC process'],
  },
  informer: {
    title: 'Informers & Listers (client-go)',
    plane: 'control',
    role: 'Watch the API for Ingresses, CRDs, Services, EndpointSlices, Secrets and ConfigMaps, and keep an in-memory cache. Event handlers compare old and new objects and add a key to the Workqueue when something meaningful changed.',
    facts: ['Shared informer cache, so no API round-trip per lookup', 'Resync and cache sync before the IC reports Ready', 'Watched namespaces set with -watch-namespace'],
  },
  workqueue: {
    title: 'Workqueue',
    plane: 'control',
    role: 'A rate-limited FIFO queue of keys such as "default/cafe". The Controller sync handler takes one key at a time. Duplicate keys collapse, and backlogs can be processed as a batch, which is the first line of defense against reload storms.',
    facts: ['Keys are de-duplicated while queued', 'Failed syncs are re-queued with backoff', 'Watch the workqueue depth metric for backlogs'],
  },
  configurator: {
    title: 'Configurator',
    plane: 'control',
    role: 'Builds an in-memory config model from the resource and everything it references (Services, Endpoints, Secrets, Policies), then renders NGINX config text from Go templates (nginx.virtualserver.tmpl, nginx.transportserver.tmpl).',
    facts: ['Validates cross-references (missing upstream, policy and so on)', 'Decides whether a change needs a reload or only an API update', 'Custom templates can be given through the ConfigMap'],
  },
  manager: {
    title: 'Manager',
    plane: 'control',
    role: 'The only component that touches NGINX. It writes config files and TLS secrets to disk, runs nginx -t style verification, signals the master to reload, and on NGINX Plus calls the Plus REST API to update upstream servers live.',
    facts: ['Writes /etc/nginx/conf.d/*.conf and /etc/nginx/secrets/*', 'Reload = SIGHUP to the master process, then the IC waits for the new config to load', 'Plus: PATCH /api/9/http/upstreams/<name>/servers'],
  },
  conf: {
    title: '/etc/nginx/conf.d/*.conf',
    plane: 'control',
    role: 'The rendered configuration files. nginx.conf is the main file, built from the ConfigMap and nginx.tmpl. Each VirtualServer gets conf.d/vs_<ns>_<name>.conf, and each TransportServer gets stream-conf.d/ts_<ns>_<name>.conf.',
    facts: ['Never edit by hand, since the IC overwrites them', 'kubectl exec <ic-pod> -- nginx -T  # dump the full config', 'Snippets are pasted in verbatim, so use with care'],
  },
  master: {
    title: 'NGINX Master Process',
    plane: 'both',
    role: 'Reads config, binds listen sockets and manages the worker processes. On reload it parses the new config, starts a new generation of workers, and asks the old generation to stop gracefully once their connections finish.',
    facts: ['Runs as PID 1 child of the IC process', 'A bad config means the reload fails and the old workers keep serving', 'worker-shutdown-timeout limits how long old workers drain'],
  },
  plusapi: {
    title: 'NGINX Plus REST API',
    plane: 'control',
    role: 'NGINX Plus only. It lets the IC add or remove upstream servers in shared-memory zones at runtime. When only endpoints change, nothing is rewritten and nothing reloads, so workers keep their connections and memory stays flat.',
    facts: ['Also exposes live metrics for the dashboard', 'Dashboard on :8080/dashboard.html when enabled (-nginx-status)', 'State files keep upstream servers across restarts'],
  },
  workers: {
    title: 'NGINX Worker Processes',
    plane: 'data',
    role: 'The actual data plane. Workers accept client connections, match server_name and location, enforce policies (limit_req, auth_jwt, allow/deny, WAF), pick an upstream with split_clients or map, and proxy to the pod IPs directly.',
    facts: ['One worker per CPU core by default (worker-processes)', 'Proxies straight to pod IPs, skipping kube-proxy', 'Rate limiting and JWT checks happen here'],
  },
  client: {
    title: 'External Client',
    plane: 'data',
    role: 'A browser, mobile app or API consumer sending HTTP(S), gRPC, TCP or UDP traffic to the public address of the ingress.',
    facts: ['Host header and SNI pick the VirtualServer', 'Headers such as X-Beta-User can drive matches routing'],
  },
  lb: {
    title: 'Cloud LB / NodePort Service',
    plane: 'data',
    role: 'The NIC Service (type LoadBalancer or NodePort) exposes the controller pods. The cloud LB spreads connections across NIC replicas, and NIC then does all the L7 routing.',
    facts: ['externalTrafficPolicy: Local preserves the client IP', 'PROXY protocol supported through the ConfigMap', 'Scale NIC horizontally behind the LB'],
  },
  svc: {
    title: 'ClusterIP Service',
    plane: 'data',
    role: 'The logical grouping of backend pods that a VirtualServer upstream references. NIC reads the Service EndpointSlices and load balances across pod IPs itself, so the ClusterIP VIP is not on the data path by default.',
    facts: ['upstreams[].service + port', 'use-cluster-ip: true sends traffic to the ClusterIP instead', 'subselector picks a subset of pods by label'],
  },
  v1: {
    title: 'Backend Pods · v1 (stable)',
    plane: 'data',
    role: 'The current stable release. In a canary rollout it gets most of the weight.',
    facts: ['Deployment coffee-v1', 'Readiness gates its membership in the endpoints'],
  },
  v2: {
    title: 'Backend Pods · v2 (canary)',
    plane: 'data',
    role: 'The new release. It gets a small split weight or only header-matched beta traffic until it is promoted.',
    facts: ['Deployment coffee-v2', 'Watch upstream 5xx on the dashboard before promoting'],
  },
}
