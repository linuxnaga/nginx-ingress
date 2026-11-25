import { Award, Sparkles, Crown } from 'lucide-react'
import { useGame } from '../game.jsx'

const STYLE = {
  xp: { icon: Sparkles, color: '#06b6d4' },
  badge: { icon: Award, color: '#f59e0b' },
  rank: { icon: Crown, color: '#009639' },
  info: { icon: Sparkles, color: '#326ce5' },
}

export default function Toasts() {
  const { toasts } = useGame()
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-72 flex-col gap-2">
      {toasts.map((t) => {
        const s = STYLE[t.kind] || STYLE.info
        return (
          <div
            key={t.id}
            className="pop flex items-start gap-3 rounded-xl border bg-panel/95 p-3 shadow-2xl backdrop-blur"
            style={{ borderColor: `${s.color}88`, boxShadow: `0 0 24px ${s.color}33` }}
          >
            <s.icon size={18} color={s.color} className="mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-bold" style={{ color: s.color }}>{t.title}</div>
              <div className="text-xs text-slate-300">{t.body}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
