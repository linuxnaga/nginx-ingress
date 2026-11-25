import { useEffect, useRef } from 'react'
import { Terminal } from 'lucide-react'

const COLOR = { cmd: 'text-sky-300', ok: 'text-emerald-400', warn: 'text-amber-300', err: 'text-rose-400', info: 'text-slate-400' }

export default function EventLog({ events }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [events.length])
  return (
    <div className="rounded-xl border border-edge bg-void/80">
      <div className="flex items-center gap-2 border-b border-edge px-3 py-2 text-xs font-semibold text-slate-300">
        <Terminal size={13} className="text-nginx" /> kubectl & controller events
      </div>
      <div ref={ref} className="scroll-thin h-48 overflow-y-auto px-3 py-2 font-mono text-[10.5px] leading-relaxed">
        {events.map((e, i) => (
          <div key={i} className={COLOR[e.kind] || COLOR.info}>
            <span className="text-slate-600">{new Date(e.t).toLocaleTimeString([], { hour12: false })} </span>
            {e.msg}
          </div>
        ))}
      </div>
    </div>
  )
}
