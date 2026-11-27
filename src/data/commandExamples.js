// Worked examples for every command in the Component Reference. Each one has
// the command as you would type it in the lab's cafe demo cluster, sample
// output, and what to look for in that output.
// Keys must match the strings in components.js `commands` exactly.
// Sample output is illustrative: names, IPs, ages and versions will differ in
// your cluster.

const POD = 'nginx-ingress-7c9d8f6b4d-x2k9p'

export const COMMAND_EXAMPLES = {
  'kubectl get vs,vsr,ts,policy -A': {
    run: 'kubectl get vs,vsr,ts,policy -A',
    output: `NAMESPACE   NAME                                    STATE   HOST               IP             PORTS      AGE
default     virtualserver.k8s.nginx.org/cafe        Valid   cafe.example.com   203.0.113.10   [80,443]   2d
default     virtualserver.k8s.nginx.org/checkout    Valid   shop.example.com   203.0.113.10   [80,443]   5h

NAMESPACE   NAME                                          STATE   HOST               IP             PORTS      AGE
tea-team    virtualserverroute.k8s.nginx.org/tea-vsr      Valid   cafe.example.com   203.0.113.10   [80,443]   2d

NAMESPACE   NAME                                   STATE   REASON          AGE
default     transportserver.k8s.nginx.org/dns      Valid   AddedOrUpdated  3h

NAMESPACE   NAME                                         STATE   AGE
default     policy.k8s.nginx.org/rate-limit-policy       Valid   5h
default     policy.k8s.nginx.org/jwt-policy              Valid   5h`,
    look: 'The STATE column is filled in by the IC after it validates each resource. Anything other than Valid (Warning or Invalid) means NGINX is not serving what you applied, so run kubectl describe on it next.',
  },
  'kubectl describe vs cafe': {
    run: 'kubectl describe vs cafe',
    output: `Name:         cafe
Namespace:    default
API Version:  k8s.nginx.org/v1
Kind:         VirtualServer
Spec:
  Host:  cafe.example.com
  Routes:
    Path:  /coffee
    Splits:
      Action:
        Pass:  coffee-v1
      Weight:  90
      Action:
        Pass:  coffee-v2
      Weight:  10
Status:
  External Endpoints:
    Ip:     203.0.113.10
    Ports:  [80,443]
  Message:  Configuration for default/cafe was added or updated
  Reason:   AddedOrUpdated
  State:    Valid
Events:
  Type    Reason          Age   From                      Message
  ----    ------          ----  ----                      -------
  Normal  AddedOrUpdated  12s   nginx-ingress-controller  Configuration for default/cafe was added or updated`,
    look: 'Check Status.State and Message first, then Events. An Invalid VirtualServer shows the exact validation error here, for example "spec.routes[0].splits: Invalid value: weights must sum to 100".',
  },
  'kubectl get ingressclass': {
    run: 'kubectl get ingressclass',
    output: `NAME    CONTROLLER                     PARAMETERS   AGE
nginx   nginx.org/ingress-controller   <none>       14d`,
    look: 'The CONTROLLER for F5 NIC is nginx.org/ingress-controller. The community ingress-nginx uses k8s.io/ingress-nginx. If both are installed, every Ingress needs the right ingressClassName.',
  },
  'kubectl get ingress -A': {
    run: 'kubectl get ingress -A',
    output: `NAMESPACE   NAME           CLASS   HOSTS              ADDRESS        PORTS     AGE
default     legacy-cafe    nginx   old.example.com    203.0.113.10   80, 443   30d
shop        storefront     nginx   www.example.com    203.0.113.10   80        12d`,
    look: 'ADDRESS is written by the NIC status updater. If it is empty, the Ingress class does not match or leader election has not finished. These are the candidates to migrate to VirtualServer.',
  },
  'kubectl get svc coffee-svc': {
    run: 'kubectl get svc coffee-v1-svc coffee-v2-svc',
    output: `NAME            TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE
coffee-v1-svc   ClusterIP   10.96.41.17    <none>        80/TCP    2d
coffee-v2-svc   ClusterIP   10.96.88.203   <none>        80/TCP    1h`,
    look: 'The PORT here is what upstreams[].port in the VirtualServer must reference. The CLUSTER-IP is not used by NIC unless use-cluster-ip: true is set, because NIC proxies to pod IPs.',
  },
  'kubectl get endpointslices -l kubernetes.io/service-name=coffee-svc': {
    run: 'kubectl get endpointslices -l kubernetes.io/service-name=coffee-v1-svc',
    output: `NAME                  ADDRESSTYPE   PORTS   ENDPOINTS                             AGE
coffee-v1-svc-8xq2m   IPv4          80      10.244.1.11,10.244.1.12,10.244.2.13   2d`,
    look: 'These ENDPOINTS are exactly the "server" lines in the NGINX upstream. If the list is empty, the Service selector matches no Ready pods and NGINX returns 502.',
  },
  'kubectl get endpointslices -w': {
    run: 'kubectl get endpointslices -l kubernetes.io/service-name=coffee-v1-svc -w',
    output: `NAME                  ADDRESSTYPE   PORTS   ENDPOINTS                             AGE
coffee-v1-svc-8xq2m   IPv4          80      10.244.1.11,10.244.1.12,10.244.2.13   2d
coffee-v1-svc-8xq2m   IPv4          80      10.244.1.11,10.244.1.12,10.244.2.13 + 1 more...   2d
coffee-v1-svc-8xq2m   IPv4          80      10.244.1.11,10.244.1.12,10.244.2.13 + 2 more...   2d
coffee-v1-svc-8xq2m   IPv4          80      10.244.1.11,10.244.1.12,10.244.2.13   2d`,
    look: 'Each new line is a change the NIC informers also see. On NGINX OSS every line means a reload, and on NGINX Plus it means an API update. Lots of lines per minute (HPA flapping, crash loops) is the warning sign of a reload storm.',
  },
  'kubectl scale deploy coffee-v2 --replicas=2': {
    run: 'kubectl scale deploy coffee-v2 --replicas=2',
    output: `deployment.apps/coffee-v2 scaled`,
    look: 'This only changes the desired count. The pods join the upstream once they pass their readiness probe. Follow up with rollout status, and on OSS watch the reload counter go up.',
  },
  'kubectl rollout status deploy/coffee-v2': {
    run: 'kubectl rollout status deploy/coffee-v2',
    output: `Waiting for deployment "coffee-v2" rollout to finish: 1 of 2 updated replicas are available...
deployment "coffee-v2" successfully rolled out`,
    look: 'Wait for "successfully rolled out" before shifting split weight to v2. Sending traffic earlier is how the Zero-Downtime Canary mission produces 502s.',
  },
  'kubectl create secret tls cafe-tls --cert=c.crt --key=c.key': {
    run: 'kubectl create secret tls cafe-tls --cert=cafe.crt --key=cafe.key',
    output: `secret/cafe-tls created`,
    look: 'Reference it from the VirtualServer with spec.tls.secret: cafe-tls. If the name is wrong or the Secret is invalid, the VS goes to Warning and NGINX rejects TLS handshakes for that host.',
  },
  'kubectl -n nginx-ingress edit cm nginx-config': {
    run: 'kubectl -n nginx-ingress get cm nginx-config -o yaml   # view first, then edit',
    output: `apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-config
  namespace: nginx-ingress
data:
  worker-processes: "auto"
  worker-shutdown-timeout: "10s"
  proxy-buffering: "on"
  otel-exporter-endpoint: "otel-collector.observability:4317"
  otel-service-name: "nginx-ingress"`,
    look: 'Keys are global and apply to every host. After you save an edit, the IC logs a reload and nginx_ingress_controller_nginx_reloads_total goes up. A bad value is logged as an error and ignored.',
  },
  'kubectl -n nginx-ingress get svc nginx-ingress': {
    run: 'kubectl -n nginx-ingress get svc nginx-ingress',
    output: `NAME            TYPE           CLUSTER-IP     EXTERNAL-IP    PORT(S)                                    AGE
nginx-ingress   LoadBalancer   10.96.12.240   203.0.113.10   80:31080/TCP,443:31443/TCP,5353:31353/UDP   14d`,
    look: 'EXTERNAL-IP is the address clients and DNS should point at. Every GlobalConfiguration listener port (5353/UDP here) must also appear in PORT(S), or L4 traffic never reaches NGINX.',
  },
  'kubectl get vs cafe -o jsonpath="{.status.state}"': {
    run: 'kubectl get vs cafe -o jsonpath="{.status.state}{\'\\n\'}{.status.message}{\'\\n\'}"',
    output: `Invalid
VirtualServer default/cafe was rejected with error: spec.routes[0].splits: Invalid value: "95": the sum of the weights of all splits must be equal to 100`,
    look: 'Handy in CI or scripts. Fail the pipeline if the state is not Valid. The old config keeps serving while the VS is Invalid, so nothing breaks, but your change is not live either.',
  },
  'kubectl -n tea-team get vsr': {
    run: 'kubectl -n tea-team get vsr',
    output: `NAME      STATE   HOST               IP             PORTS      AGE
tea-vsr   Valid   cafe.example.com   203.0.113.10   [80,443]   2d`,
    look: 'The HOST must match the parent VirtualServer. If the VS does not delegate to this VSR (route: tea-team/tea-vsr), it shows Warning with "is not referenced by any VirtualServer".',
  },
  'kubectl get policy': {
    run: 'kubectl get policy',
    output: `NAME                STATE   AGE
rate-limit-policy   Valid   5h
jwt-policy          Valid   5h
allow-corp          Valid   5h`,
    look: 'Valid only means the Policy itself is well formed. It does nothing until a VirtualServer lists it under spec.policies or routes[].policies.',
  },
  'kubectl describe policy rate-limit-policy': {
    run: 'kubectl describe policy rate-limit-policy',
    output: `Name:         rate-limit-policy
Namespace:    default
Kind:         Policy
Spec:
  Rate Limit:
    Burst:        20
    Key:          \${binary_remote_addr}
    No Delay:     true
    Rate:         10r/s
    Reject Code:  429
    Zone Size:    10M
Status:
  Message:  Policy default/rate-limit-policy was added or updated
  Reason:   AddedOrUpdated
  State:    Valid`,
    look: 'Check Reject Code: without it NIC returns 503. Check Key too: binary_remote_addr limits per client IP, so make sure the real client IP is preserved at the load balancer.',
  },
  'kubectl -n nginx-ingress get globalconfiguration': {
    run: 'kubectl -n nginx-ingress get globalconfiguration nginx-configuration -o yaml',
    output: `apiVersion: k8s.nginx.org/v1
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
    protocol: TCP`,
    look: 'Its namespace/name must equal the -global-configuration argument of the IC. Otherwise it is ignored and every TransportServer that uses these listeners is rejected.',
  },
  'kubectl get ts': {
    run: 'kubectl get ts',
    output: `NAME   STATE     REASON     AGE
dns    Warning   Rejected   1m`,
    look: 'Rejected TransportServers usually reference a listener name that is not in the GlobalConfiguration, or a listener already claimed by another TS. kubectl describe ts dns shows which one.',
  },
  "kubectl -n nginx-ingress get deploy nginx-ingress -o jsonpath='{.spec.template.spec.containers[0].args}'": {
    run: "kubectl -n nginx-ingress get deploy nginx-ingress -o jsonpath='{.spec.template.spec.containers[0].args}' | tr ',' '\\n'",
    output: `["-nginx-plus=false"
"-nginx-configmaps=$(POD_NAMESPACE)/nginx-config"
"-ingress-class=nginx"
"-watch-namespace=default,tea-team"
"-enable-custom-resources=true"
"-global-configuration=nginx-ingress/nginx-configuration"
"-enable-prometheus-metrics=true"
"-enable-leader-election=true"]`,
    look: '-watch-namespace limits which namespaces the informers watch. Resources outside it are invisible to NIC, which is a common reason a VirtualServer gets no STATE at all.',
  },
  'curl -s <pod-ip>:9113/metrics | grep workqueue': {
    run: `kubectl -n nginx-ingress port-forward ${POD} 9113:9113 &
curl -s localhost:9113/metrics | grep workqueue_depth`,
    output: `# HELP nginx_ingress_controller_workqueue_depth Current depth of workqueue
# TYPE nginx_ingress_controller_workqueue_depth gauge
nginx_ingress_controller_workqueue_depth{class="nginx",name="taskQueue"} 0`,
    look: 'Depth should hover near 0. If it stays high, the controller cannot keep up (very large configs, slow reloads, or a flood of endpoint changes) and changes take longer to reach NGINX.',
  },
  'kubectl get events --field-selector involvedObject.kind=VirtualServer': {
    run: 'kubectl get events --field-selector involvedObject.kind=VirtualServer --sort-by=.lastTimestamp',
    output: `LAST SEEN   TYPE      REASON           OBJECT                MESSAGE
4m          Normal    AddedOrUpdated   virtualserver/cafe    Configuration for default/cafe was added or updated
90s         Warning   Rejected         virtualserver/cafe    VirtualServer default/cafe was rejected with error: spec.upstreams[1].service: Required value
20s         Normal    AddedOrUpdated   virtualserver/cafe    Configuration for default/cafe was added or updated`,
    look: 'This is the history of every sync, including the rejections that came and went. Warning events are where the controller explains why your change did not apply.',
  },
  'kubectl exec -n nginx-ingress <pod> -- cat /etc/nginx/conf.d/vs_default_cafe.conf': {
    run: `kubectl exec -n nginx-ingress ${POD} -- cat /etc/nginx/conf.d/vs_default_cafe.conf`,
    output: `upstream vs_default_cafe_coffee-v1 {
    zone vs_default_cafe_coffee-v1 256k;
    random two least_conn;
    server 10.244.1.11:80 max_fails=1 fail_timeout=10s max_conns=0;
    server 10.244.1.12:80 max_fails=1 fail_timeout=10s max_conns=0;
}
split_clients $request_id $vs_default_cafe_splits_0 {
    90% vs_default_cafe_coffee-v1;
    10% vs_default_cafe_coffee-v2;
}
server {
    listen 80;
    server_name cafe.example.com;
    location /coffee {
        proxy_pass http://$vs_default_cafe_splits_0;
    }
}`,
    look: 'This is the Configurator\'s output for one VirtualServer. Compare it with the "Compiled nginx.conf preview" in the labs to see that split_clients, upstream and location come from your YAML.',
  },
  'kubectl exec -n nginx-ingress <pod> -- nginx -T': {
    run: `kubectl exec -n nginx-ingress ${POD} -- nginx -T 2>/dev/null | grep -A3 "split_clients"`,
    output: `split_clients $request_id $vs_default_cafe_splits_0 {
    90% vs_default_cafe_coffee-v1;
    10% vs_default_cafe_coffee-v2;
}`,
    look: 'nginx -T tests and prints the full config NGINX is running, across all included files. Pipe it through grep to confirm a change actually landed after the Manager wrote it and reloaded.',
  },
  'kubectl get vs -o wide': {
    run: 'kubectl get vs -o wide',
    output: `NAME       STATE   HOST               IP             EXTERNALHOSTNAME   PORTS      AGE
cafe       Valid   cafe.example.com   203.0.113.10                      [80,443]   2d
checkout   Valid   shop.example.com   203.0.113.10                      [80,443]   5h`,
    look: 'IP and PORTS are written by the leader replica\'s status updater. If STATE is set but IP is empty, check that the NIC Service has an external address.',
  },
  'curl <pod-ip>:9113/metrics | grep reloads_total': {
    run: `kubectl -n nginx-ingress port-forward ${POD} 9113:9113 &
curl -s localhost:9113/metrics | grep -E "reloads_total|reload_errors_total|last_reload_milliseconds"`,
    output: `nginx_ingress_controller_nginx_reloads_total{class="nginx",reason="endpoints"} 142
nginx_ingress_controller_nginx_reloads_total{class="nginx",reason="other"} 17
nginx_ingress_controller_nginx_reload_errors_total{class="nginx"} 0
nginx_ingress_controller_nginx_last_reload_milliseconds{class="nginx"} 184`,
    look: 'A high reason="endpoints" count is pod churn forcing reloads, which NGINX Plus removes. reload_errors_total should stay 0. A rising last_reload_milliseconds means the config is getting large.',
  },
  'kubectl exec <pod> -- ls /etc/nginx/conf.d': {
    run: `kubectl exec -n nginx-ingress ${POD} -- ls /etc/nginx/conf.d /etc/nginx/stream-conf.d`,
    output: `/etc/nginx/conf.d:
default-legacy-cafe.conf
vs_default_cafe.conf
vs_default_checkout.conf

/etc/nginx/stream-conf.d:
ts_default_dns.conf`,
    look: 'One file per resource: <namespace>-<name>.conf for Ingress, vs_<namespace>_<name>.conf for VirtualServer, and ts_<namespace>_<name>.conf for TransportServer. A missing file means that resource is not Valid.',
  },
  'kubectl exec <pod> -- nginx -T': {
    run: `kubectl exec -n nginx-ingress ${POD} -- nginx -T 2>&1 | head -3`,
    output: `nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
# configuration file /etc/nginx/nginx.conf:`,
    look: 'The first two lines confirm the config on disk is valid. After that, every file is printed with a "# configuration file" header, so you can see which resource each block came from.',
  },
  'kubectl exec <pod> -- ps -ef | grep nginx': {
    run: `kubectl exec -n nginx-ingress ${POD} -- ps -ef`,
    output: `UID   PID  PPID  CMD
101     1     0  /nginx-ingress -nginx-configmaps=nginx-ingress/nginx-config ...
101    14     1  nginx: master process /usr/sbin/nginx -g daemon off;
101    61    14  nginx: worker process
101    62    14  nginx: worker process
101    48    14  nginx: worker process is shutting down
101    49    14  nginx: worker process is shutting down`,
    look: 'PID 1 is the IC Go process and the master is its child, all in one container. "is shutting down" workers are the previous generation still draining after a reload. Many of those at once means memory pressure.',
  },
  'kubectl -n nginx-ingress logs <pod> --tail=3': {
    run: `kubectl -n nginx-ingress logs ${POD} --tail=3`,
    output: `10.0.0.5 - - [25/Nov/2026:16:02:11 +0000] "GET /coffee HTTP/1.1" 200 158 "-" "curl/8.5.0" "-"
10.0.0.5 - - [25/Nov/2026:16:02:11 +0000] "GET /checkout HTTP/1.1" 429 179 "-" "hey/0.0.1" "-"
I1125 16:02:12.104511       1 event.go:377] Event(v1.ObjectReference{Kind:"VirtualServer", Namespace:"default", Name:"cafe"}): type: 'Normal' reason: 'AddedOrUpdated' Configuration for default/cafe was added or updated`,
    look: 'The same stream mixes NGINX access logs (the 429 is limit_req rejecting at the worker) with IC controller logs (the I1125 line). Grep for the status code or the resource name to separate them.',
  },
  'kubectl port-forward <pod> 8080:8080  # then open /dashboard.html': {
    run: `kubectl -n nginx-ingress port-forward ${POD} 8080:8080
# open http://localhost:8080/dashboard.html   (NGINX Plus only)
curl -s localhost:8080/api/9/http/upstreams/vs_default_cafe_coffee-v1 | jq '.peers[] | {server, state, active}'`,
    output: `Forwarding from 127.0.0.1:8080 -> 8080
{ "server": "10.244.1.11:80", "state": "up", "active": 3 }
{ "server": "10.244.1.12:80", "state": "up", "active": 2 }
{ "server": "10.244.2.13:80", "state": "up", "active": 4 }`,
    look: 'These peers were added through the Plus API with no reload. Scale the Deployment and run the curl again to see servers appear and disappear while the reload counter stays flat.',
  },
  'kubectl apply -f cafe-vs.yaml': {
    run: 'kubectl apply -f cafe-vs.yaml',
    output: `virtualserver.k8s.nginx.org/cafe configured`,
    look: '"configured" only means the API server stored it. The IC validates it asynchronously, so follow up with kubectl get vs cafe and check that STATE is Valid.',
  },
  'curl -H "Host: cafe.example.com" -H "X-Beta-User: true" http://<lb-ip>/coffee': {
    run: `for i in $(seq 1 5); do
  curl -s -H "Host: cafe.example.com" -H "X-Beta-User: true" http://203.0.113.10/coffee | grep "Server name"
done`,
    output: `Server name: coffee-v2-5b8c6d7f9-8hj2k
Server name: coffee-v2-5b8c6d7f9-q4w7n
Server name: coffee-v2-5b8c6d7f9-8hj2k
Server name: coffee-v2-5b8c6d7f9-q4w7n
Server name: coffee-v2-5b8c6d7f9-8hj2k`,
    look: 'With the header, every response comes from a v2 pod because of the matches rule. Drop the -H "X-Beta-User: true" and you should get mostly v1, roughly matching your split weights.',
  },
}
