import { useState } from 'react'
import { BookOpenCheck, ChevronDown, Eye, Target, Lightbulb } from 'lucide-react'

export default function LabGuide({ guide, accent = '#06b6d4', steps, tips, title = 'How to run this lab', defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const list = steps || guide?.steps || []
  return (
    <div className="mb-4 rounded-lg border bg-void/60" style={{ borderColor: `${accent}55` }}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-2 text-left" aria-expanded={open}>
        <BookOpenCheck size={15} color={accent} />
        <span className="text-sm font-semibold text-slate-100">{title}</span>
        {guide?.goal && !open && <span className="truncate text-xs text-slate-500">· {guide.goal}</span>}
        <ChevronDown size={15} className={`ml-auto shrink-0 text-slate-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="grid gap-4 border-t border-edge px-3 py-3 lg:grid-cols-[1.6fr_1fr]">
          <div>
            {guide?.goal && (
              <p className="mb-2 flex items-start gap-2 text-xs text-slate-300">
                <Target size={13} className="mt-0.5 shrink-0" color={accent} />
                <span><b className="text-slate-100">Goal:</b> {guide.goal}</span>
              </p>
            )}
            <ol className="space-y-1.5">
              {list.map((s, i) => (
                <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-300">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold text-slate-950" style={{ background: accent }}>
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-col gap-3">
            {guide?.watch && (
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <Eye size={12} /> What to watch
                </div>
                <ul className="space-y-1">
                  {guide.watch.map((w) => (
                    <li key={w} className="text-xs text-slate-400">• {w}</li>
                  ))}
                </ul>
              </div>
            )}
            {(guide?.takeaway || tips) && (
              <div className="rounded-md bg-panel2/70 p-2.5 text-xs leading-relaxed text-slate-300">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: accent }}>
                  <Lightbulb size={12} /> {guide?.takeaway ? 'Key takeaway' : 'Tip'}
                </div>
                {guide?.takeaway || tips}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
