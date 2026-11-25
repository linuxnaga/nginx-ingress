import { Compass, ArrowRight } from 'lucide-react'
import { GETTING_STARTED, LAB_GUIDES } from '../data/guides.js'
import { MODULES, MISSIONS } from '../data/curriculum.js'
import { useNav } from '../nav.js'
import { Button } from './ui.jsx'

const LAB_MODULE = { loop: 'm1', canary: 'm2', policy: 'm3', l4: 'm3', storm: 'm4', metrics: 'm4', migrate: 'm4' }

export default function GuideView() {
  const { go } = useNav()
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-nginx/50 bg-gradient-to-br from-nginx/10 to-panel/70 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-nginx bg-nginx/15">
            <Compass size={22} color="#009639" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">Start here</div>
            <h1 className="text-xl font-bold text-white">{GETTING_STARTED.title}</h1>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="primary" icon={ArrowRight} onClick={() => go('m1')}>Start Module 1</Button>
            <Button onClick={() => go('reference')}>Component reference</Button>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">{GETTING_STARTED.intro}</p>
      </div>

      <ol className="grid gap-3 md:grid-cols-2">
        {GETTING_STARTED.steps.map((s, i) => (
          <li key={s.title} className="flex gap-3 rounded-xl border border-edge bg-panel/70 p-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-nginx font-mono text-sm font-bold text-white">{i + 1}</span>
            <div>
              <div className="text-sm font-semibold text-white">{s.title}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="rounded-xl border border-edge bg-panel/70 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Course map</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1.5 pr-3">Where</th>
                <th className="pr-3">Lab</th>
                <th>What you will do</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(LAB_GUIDES).map(([id, g]) => {
                const m = MODULES.find((x) => x.id === LAB_MODULE[id])
                return (
                  <tr key={id} className="cursor-pointer border-t border-edge hover:bg-panel2" onClick={() => go(m.id)}>
                    <td className="py-2 pr-3 font-semibold" style={{ color: m.accent }}>Module {m.num}</td>
                    <td className="pr-3 font-semibold text-slate-200">{g.title}</td>
                    <td className="text-slate-400">{g.goal}</td>
                  </tr>
                )
              })}
              {MISSIONS.map((ms) => (
                <tr key={ms.id} className="cursor-pointer border-t border-edge hover:bg-panel2" onClick={() => go(ms.id)}>
                  <td className="py-2 pr-3 font-semibold text-amber-400">Mission {ms.num}</td>
                  <td className="pr-3 font-semibold text-slate-200">{ms.title}</td>
                  <td className="text-slate-400">{ms.brief}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
