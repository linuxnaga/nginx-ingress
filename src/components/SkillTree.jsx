import * as Icons from '../icons.js'
import { MODULES, MISSIONS } from '../data/curriculum.js'
import { useGame } from '../game.jsx'

export default function SkillTree({ view, onSelect }) {
  const { done } = useGame()
  return (
    <nav className="flex flex-col gap-2">
      <div className="px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Skill Tree</div>
      <div className="relative flex flex-col gap-2">
        <div className="absolute bottom-6 left-[22px] top-6 w-px bg-gradient-to-b from-k8s via-nginx to-flow opacity-40" />
        {MODULES.map((m) => {
          const Icon = Icons[m.icon]
          const n = m.tasks.filter((t) => done[t.id]).length
          const complete = n === m.tasks.length
          const activeView = view === m.id
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className={`relative flex items-start gap-3 rounded-xl border p-2.5 text-left transition ${
                activeView ? 'border-transparent bg-panel2 ring-1' : 'border-edge bg-panel/60 hover:bg-panel2'
              }`}
              style={activeView ? { '--tw-ring-color': m.accent } : undefined}
            >
              <div
                className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `${m.accent}22`, border: `1px solid ${m.accent}88` }}
              >
                {complete ? <Icons.CheckCircle2 size={18} color="#009639" /> : <Icon size={18} color={m.accent} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: m.accent }}>
                  Module {m.num}
                </div>
                <div className="text-[13px] font-semibold leading-snug text-slate-100">{m.title}</div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-void">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(n / m.tasks.length) * 100}%`, background: m.accent }} />
                  </div>
                  <span className="font-mono text-[10px] text-slate-500">{n}/{m.tasks.length}</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-3 px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Missions</div>
      {MISSIONS.map((ms) => {
        const Icon = Icons[ms.icon]
        const activeView = view === ms.id
        return (
          <button
            key={ms.id}
            onClick={() => onSelect(ms.id)}
            className={`flex items-center gap-3 rounded-xl border p-2.5 text-left transition ${
              activeView ? 'border-amber-500/60 bg-panel2' : 'border-edge bg-panel/60 hover:bg-panel2'
            }`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/50 bg-amber-500/10">
              {done[ms.id] ? <Icons.Trophy size={18} color="#f59e0b" /> : <Icon size={18} color="#f59e0b" />}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                Mission {ms.num} · {ms.xp} XP
              </div>
              <div className="text-[13px] font-semibold text-slate-100">{ms.title}</div>
            </div>
            {done[ms.id] && <Icons.CheckCircle2 size={16} className="ml-auto text-nginx" />}
          </button>
        )
      })}
    </nav>
  )
}
