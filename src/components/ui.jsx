import { useMemo } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

export function Panel({ title, icon: Icon, right, children, className = '', bodyClass = 'p-4', accent = '#326ce5' }) {
  return (
    <section className={`rounded-xl border border-edge bg-panel/80 backdrop-blur shadow-lg shadow-black/30 ${className}`}>
      {title && (
        <header className="flex items-center gap-2 border-b border-edge px-4 py-2.5">
          {Icon && <Icon size={16} color={accent} />}
          <h3 className="text-sm font-semibold tracking-wide text-slate-200">{title}</h3>
          <div className="ml-auto flex items-center gap-2">{right}</div>
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  )
}

const BTN = {
  primary: 'bg-nginx hover:bg-emerald-600 text-white',
  blue: 'bg-k8s hover:bg-blue-600 text-white',
  cyan: 'bg-cyan-600 hover:bg-cyan-500 text-white',
  ghost: 'bg-panel2 hover:bg-edge text-slate-200 border border-edge',
  danger: 'bg-rose-600 hover:bg-rose-500 text-white',
  amber: 'bg-amber-500 hover:bg-amber-400 text-slate-950',
}

export function Button({ variant = 'ghost', icon: Icon, children, className = '', size = 'md', ...rest }) {
  const sz = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm'
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${sz} ${BTN[variant]} ${className}`}
      {...rest}
    >
      {Icon && <Icon size={size === 'sm' ? 13 : 15} />}
      {children}
    </button>
  )
}

export function Toggle({ on, onChange, label, color = '#009639', disabled }) {
  return (
    <label className={`inline-flex items-center gap-2 text-sm ${disabled ? 'opacity-40' : 'cursor-pointer'}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!on)}
        className="relative h-5 w-9 rounded-full transition"
        style={{ background: on ? color : '#24324f' }}
        aria-pressed={on}
      >
        <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: on ? 18 : 2 }} />
      </button>
      {label && <span className="text-slate-300">{label}</span>}
    </label>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-void/70 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
            value === t.id ? 'bg-panel2 text-white shadow ring-1 ring-edge' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t.icon && <t.icon size={13} />}
          {t.label}
          {t.done && <CheckCircle2 size={12} className="text-nginx" />}
        </button>
      ))}
    </div>
  )
}

// Tiny syntax colouring for nginx config and YAML
function colorNginx(line) {
  if (/^\s*#/.test(line)) return <span className="text-slate-500">{line}</span>
  const m = line.match(/^(\s*)([a-z_0-9]+)(.*)$/i)
  if (!m) return line
  const [, ws, kw, rest] = m
  const blockKw = ['upstream', 'server', 'location', 'split_clients', 'map', 'if']
  const parts = rest.split(/(\$[a-zA-Z_0-9]+|"[^"]*"|\d+%|[{};])/g)
  return (
    <>
      {ws}
      <span className={blockKw.includes(kw) ? 'text-emerald-400 font-semibold' : 'text-sky-300'}>{kw}</span>
      {parts.map((p, i) =>
        p.startsWith('$') ? (
          <span key={i} className="text-fuchsia-300">{p}</span>
        ) : p.startsWith('"') ? (
          <span key={i} className="text-amber-300">{p}</span>
        ) : /\d+%/.test(p) ? (
          <span key={i} className="text-cyan-300 font-semibold">{p}</span>
        ) : /[{};]/.test(p) ? (
          <span key={i} className="text-slate-500">{p}</span>
        ) : (
          <span key={i} className="text-slate-200">{p}</span>
        ),
      )}
    </>
  )
}

export function CodeView({ code, lang = 'nginx', highlight = [], className = '', maxH = 'max-h-96' }) {
  const lines = useMemo(() => String(code).split('\n'), [code])
  return (
    <pre className={`scroll-thin overflow-auto rounded-lg border border-edge bg-void p-3 font-mono text-[11.5px] leading-[1.55] ${maxH} ${className}`}>
      {lines.map((l, i) => {
        const hot = highlight.some((h) => l.includes(h))
        return (
          <div key={i} className={`flex ${hot ? 'bg-cyan-500/10 -mx-3 px-3 border-l-2 border-flow' : ''}`}>
            <span className="mr-3 w-6 shrink-0 select-none text-right text-slate-600">{i + 1}</span>
            <span className="whitespace-pre">{lang === 'nginx' ? colorNginx(l) : colorYaml(l)}</span>
          </div>
        )
      })}
    </pre>
  )
}

function colorYaml(line) {
  if (/^\s*#/.test(line)) return <span className="text-slate-500">{line}</span>
  const m = line.match(/^(\s*-?\s*)([\w.\-/]+)(:)(.*)$/)
  if (!m) return <span className="text-slate-200">{line}</span>
  const [, ws, key, colon, val] = m
  return (
    <>
      <span className="text-slate-500">{ws}</span>
      <span className={['kind', 'apiVersion'].includes(key) ? 'text-emerald-400' : 'text-sky-300'}>{key}</span>
      <span className="text-slate-500">{colon}</span>
      <span className={/^\s*\d+$/.test(val) ? 'text-cyan-300' : 'text-amber-200'}>{val}</span>
    </>
  )
}

export function YamlEditor({ value, onChange, error, warnings = [], rows = 22, readOnly }) {
  const lineCount = value.split('\n').length
  return (
    <div className="flex flex-col gap-2">
      <div className="flex overflow-hidden rounded-lg border border-edge bg-void focus-within:border-k8s">
        <div className="select-none border-r border-edge bg-panel/60 px-2 py-3 text-right font-mono text-[11.5px] leading-[1.55] text-slate-600">
          {Array.from({ length: Math.max(lineCount, rows) }).map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <textarea
          className="yaml-editor scroll-thin w-full resize-none bg-transparent px-3 py-3 font-mono text-[11.5px] leading-[1.55] text-slate-200 outline-none"
          spellCheck={false}
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault()
              const t = e.target
              const s = t.selectionStart
              const v = t.value.slice(0, s) + '  ' + t.value.slice(t.selectionEnd)
              onChange?.(v)
              requestAnimationFrame(() => (t.selectionStart = t.selectionEnd = s + 2))
            }
          }}
          rows={Math.max(lineCount, rows)}
          aria-label="YAML manifest editor"
        />
      </div>
      {error ? (
        <div className="flex items-start gap-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span className="font-mono">{error}</span>
        </div>
      ) : warnings.length ? (
        <div className="flex flex-col gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>
                IC validation: <span className="font-mono">{w}</span>. The VirtualServer would be <b>Invalid</b> and the previous config keeps serving.
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-md border border-emerald-600/40 bg-emerald-600/10 px-3 py-1.5 text-xs text-emerald-300">
          <CheckCircle2 size={13} /> Manifest valid. State: Valid
        </div>
      )}
    </div>
  )
}

export function Stat({ label, value, color = '#e2e8f0', sub }) {
  return (
    <div className="rounded-lg border border-edge bg-void/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-mono text-lg font-semibold" style={{ color }}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  )
}

export function Chip({ children, color = '#326ce5' }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}>
      {children}
    </span>
  )
}
