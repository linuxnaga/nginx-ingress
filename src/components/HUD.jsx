import * as Icons from '../icons.js'
import { useGame, MAX_XP, ALL_TASKS } from '../game.jsx'
import { RANKS, BADGES } from '../data/curriculum.js'

export default function HUD({ onReset }) {
  const { xp, rank, earnedBadges, done } = useGame()
  const next = RANKS.find((r) => r.minXp > xp)
  const lvlStart = rank.minXp
  const lvlEnd = next ? next.minXp : MAX_XP
  const pct = Math.min(100, ((xp - lvlStart) / Math.max(1, lvlEnd - lvlStart)) * 100)
  const mastery = Math.round((ALL_TASKS.filter((t) => done[t.id]).length / ALL_TASKS.length) * 100)

  return (
    <header className="sticky top-0 z-30 border-b border-edge bg-void/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 32 32" width="34" height="34" aria-hidden>
            <polygon points="16,2 29,9.5 29,22.5 16,30 3,22.5 3,9.5" fill="#009639" />
            <polygon points="16,7 24.5,12 24.5,20 16,25 7.5,20 7.5,12" fill="none" stroke="#fff" strokeWidth="1.5" />
            <text x="16" y="19.5" fontSize="8" textAnchor="middle" fill="#fff" fontWeight="bold" fontFamily="monospace">NIC</text>
          </svg>
          <div>
            <div className="text-sm font-bold leading-tight text-white">NIC Flow Simulator</div>
            <div className="text-[11px] leading-tight text-slate-400">F5 NGINX Ingress Controller Academy</div>
          </div>
        </div>

        <div className="flex min-w-[260px] flex-1 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-k8s/50 bg-k8s/15 font-mono text-sm font-bold text-blue-300">
            L{rank.level}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate font-semibold text-white">
                Platform Rank: <span className="text-cyan-300">Lvl {rank.level}: {rank.title}</span>
              </span>
              <span className="shrink-0 font-mono text-slate-400">
                {xp} / {next ? next.minXp : MAX_XP} XP
              </span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-panel2 ring-1 ring-edge">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#009639,#06b6d4,#326ce5)' }}
              />
            </div>
            <div className="mt-1 text-[10px] text-slate-500">
              {next ? `Next: Lvl ${next.level} ${next.title}` : 'Max rank reached'}
            </div>
          </div>
          <div className="hidden shrink-0 text-center sm:block">
            <div className="font-mono text-lg font-bold text-nginx">{mastery}%</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Mastery</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {BADGES.map((b) => {
            const Icon = Icons[b.icon]
            const got = earnedBadges.includes(b.id)
            const prog = b.requires.filter((r) => done[r]).length
            return (
              <div key={b.id} className="group relative">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition ${got ? 'pop' : 'grayscale'}`}
                  style={{
                    borderColor: got ? b.color : '#24324f',
                    background: got ? `${b.color}25` : '#111a2e',
                    boxShadow: got ? `0 0 14px ${b.color}66` : 'none',
                  }}
                >
                  {got ? <Icon size={18} color={b.color} /> : <Icons.Lock size={15} color="#475569" />}
                </div>
                <div className="pointer-events-none absolute right-0 top-12 z-40 hidden w-56 rounded-lg border border-edge bg-panel p-3 text-xs shadow-xl group-hover:block">
                  <div className="font-semibold" style={{ color: got ? b.color : '#cbd5e1' }}>{b.name}</div>
                  <div className="mt-1 text-slate-400">
                    {got ? 'Unlocked' : `Locked · ${prog}/${b.requires.length} requirements`}
                  </div>
                  <ul className="mt-1.5 space-y-0.5">
                    {b.requires.map((r) => (
                      <li key={r} className={done[r] ? 'text-emerald-400' : 'text-slate-500'}>
                        {done[r] ? '✓' : '○'} {ALL_TASKS.find((t) => t.id === r)?.label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}
          <button
            onClick={onReset}
            title="Reset progress"
            className="ml-1 rounded-md p-2 text-slate-500 hover:bg-panel2 hover:text-slate-300"
          >
            <Icons.RotateCcw size={15} />
          </button>
        </div>
      </div>
    </header>
  )
}
