import { useState } from 'react'
import { GameProvider, useGame } from './game.jsx'
import { MODULES, MISSIONS } from './data/curriculum.js'
import HUD from './components/HUD.jsx'
import SkillTree from './components/SkillTree.jsx'
import ModuleView from './components/ModuleView.jsx'
import MissionView from './components/MissionView.jsx'
import Toasts from './components/Toasts.jsx'
import GuideView from './components/GuideView.jsx'
import ReferenceView from './components/ReferenceView.jsx'
import { NavCtx } from './nav.js'

function Shell() {
  const { reset, done } = useGame()
  const [view, setViewRaw] = useState(() => (Object.keys(done).length ? 'm1' : 'guide'))
  const [refFocus, setRefFocus] = useState(null)
  const setView = (v, focus = null) => {
    setViewRaw(v)
    setRefFocus(focus)
    window.scrollTo({ top: 0 })
  }
  const mod = MODULES.find((m) => m.id === view)
  const mission = MISSIONS.find((m) => m.id === view)

  const onReset = () => {
    if (window.confirm('Reset all XP, badges and mission progress?')) reset()
  }

  return (
    <NavCtx.Provider value={{ go: setView }}>
    <div className="min-h-full">
      <HUD onReset={onReset} />
      <div className="mx-auto grid max-w-[1600px] gap-4 px-4 py-4 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-[84px] lg:h-[calc(100vh-100px)] lg:overflow-y-auto scroll-thin">
          <SkillTree view={view} onSelect={setView} />
          <p className="mt-4 px-1 text-[10px] leading-relaxed text-slate-600">
            Content follows the F5 NGINX Ingress Controller docs. Simulated traffic and configs are teaching models, not a live cluster. Progress is saved in your browser.
          </p>
        </aside>
        <main className="min-w-0">
          {view === 'guide' && <GuideView />}
          {view === 'reference' && <ReferenceView focusId={refFocus} />}
          {mod && <ModuleView key={mod.id} module={mod} />}
          {mission && <MissionView key={mission.id} mission={mission} />}
        </main>
      </div>
      <Toasts />
    </div>
    </NavCtx.Provider>
  )
}

export default function App() {
  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  )
}
