# NIC Flow Simulator

A gamified learning and architecture flow simulator for the **F5 NGINX Ingress Controller (NIC)**. It is a single-page React app built with Vite, Tailwind CSS v4 and Lucide icons.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/, works from any sub-path
```

## What's inside

**HUD.** It shows your platform rank (Lvl 1 YAML Apprentice up to Lvl 5 Kubernetes Ingress Architect), an XP bar, a mastery score, and four unlockable badges:
- Control Loop & Reload Mechanics
- VirtualServer & Canary Splits
- L4 TransportServer & Policies
- NGINX Plus Zero-Reload Upstreams

Progress is saved in `localStorage`.

**Skill tree with 4 modules.** Each module has an animated dual-plane SVG diagram with an NGINX Open Source / NGINX Plus toggle, clickable inspector cards, a hands-on lab console and a knowledge check.

| Module | Labs |
|---|---|
| 1. Pod Internals & Control Loop | `kubectl apply` traced through Informer → Workqueue → Configurator → Manager → NGINX master; scale pods to compare an OSS reload with a Plus API update; live upstream preview |
| 2. Advanced L7 Routing with CRDs | Editable VirtualServer YAML, canary weight slider, `X-Beta-User` header matches, animated traffic split, compiled `split_clients`/`map` preview, VirtualServerRoute delegation |
| 3. Security Policies & L4 | Policy lab (rateLimit, jwt, accessControl, ingressMTLS, waf) firing a 100-request burst; GlobalConfiguration + TransportServer lab with a compiled `stream` config |
| 4. Production Ops & Observability | Reload storm simulator (batching, NGINX Plus, worker-shutdown-timeout, memory vs OOMKill); Prometheus console, NGINX Plus dashboard, OTel config; ingress-nginx annotation migration |

**Missions**
1. **Zero-Downtime Canary**: scale v2, route beta users by header, run a 90/10 split, then promote to 100% with zero 502s.
2. **Shield the Checkout API**: rateLimit at 10r/s with burst 20 and rejectCode 429, plus JWT. Fire a burst and see 401s and 429s.
3. **Tame the Reload Storm**: reproduce an OOMKill under CI and HPA churn, then fix it with batching and NGINX Plus (5 reloads or fewer, memory under 512 MiB).

The generated NGINX config and the traffic and memory models are teaching approximations of NIC behaviour, not output from a live cluster.

## Layout

```
src/
  data/curriculum.js     modules, quizzes, missions, badges, ranks, inspector cards
  lib/compile.js         mini "Configurator": VirtualServer/Policy/TransportServer → nginx config
  lib/useCluster.js      simulated cluster: OSS/Plus mode, reloads, animated packets
  components/            HUD, skill tree, flow canvas, inspector, quiz, module & mission views
  components/labs/       the hands-on labs
```
