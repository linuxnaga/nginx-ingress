import { useState } from 'react'
import { Terminal, ChevronRight, Copy, Check, Lightbulb } from 'lucide-react'
import { COMMAND_EXAMPLES } from '../data/commandExamples.js'

// A clickable command that expands into a worked example: what to type,
// sample output, and what to look for in it.
export default function CommandExample({ cmd }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const ex = COMMAND_EXAMPLES[cmd]

  const copy = (e) => {
    e.stopPropagation()
    navigator.clipboard?.writeText(ex.run).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  if (!ex) {
    return (
      <div className="flex items-start gap-2 font-mono text-[11px] text-slate-400">
        <Terminal size={12} className="mt-0.5 shrink-0 text-nginx" /> {cmd}
      </div>
    )
  }

  return (
    <div className={`rounded-md ${open ? 'bg-void/70 ring-1 ring-edge' : ''}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left font-mono text-[11px] text-slate-300 hover:bg-panel2"
        title="Show a worked example"
      >
        <Terminal size={12} className="mt-0.5 shrink-0 text-nginx" />
        <span className="flex-1 break-all">{cmd}</span>
        <span className="flex shrink-0 items-center gap-0.5 font-sans text-[10px] font-semibold text-cyan-400 group-hover:text-cyan-300">
          {open ? 'Hide' : 'Example'}
          <ChevronRight size={12} className={`transition ${open ? 'rotate-90' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="pop space-y-2 px-2 pb-2.5 pt-1">
          <div className="overflow-hidden rounded-md border border-edge bg-[#05080f]">
            <div className="flex items-center gap-1.5 border-b border-edge bg-panel/80 px-2 py-1">
              <span className="h-2 w-2 rounded-full bg-rose-500/70" />
              <span className="h-2 w-2 rounded-full bg-amber-500/70" />
              <span className="h-2 w-2 rounded-full bg-emerald-500/70" />
              <span className="ml-2 text-[10px] text-slate-500">example · cafe demo cluster</span>
              <button onClick={copy} className="ml-auto flex items-center gap-1 text-[10px] text-slate-400 hover:text-white" aria-label="Copy command">
                {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="scroll-thin max-h-72 overflow-auto p-2.5 font-mono text-[11px] leading-relaxed">
              {ex.run.split('\n').map((l, i) => {
                const comment = l.trim().startsWith('#')
                const prompt = !comment && !/^\s/.test(l) && l.trim() !== 'done'
                return (
                  <div key={i} className="whitespace-pre">
                    {prompt && <span className="text-emerald-400">$ </span>}
                    <span className={comment ? 'text-slate-500' : 'text-sky-300'}>{l}</span>
                  </div>
                )
              })}
              <div className="mt-1 whitespace-pre text-slate-300">{ex.output}</div>
            </pre>
          </div>
          <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-slate-300">
            <Lightbulb size={13} className="mt-0.5 shrink-0 text-amber-400" />
            <span><b className="text-amber-300">What to look for:</b> {ex.look}</span>
          </p>
        </div>
      )}
    </div>
  )
}
