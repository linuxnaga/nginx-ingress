import { useState } from 'react'
import { GameProvider, useGame } from './game.jsx'
import { MODULES, MISSIONS } from './data/curriculum.js'
import HUD from './components/HUD.jsx'
import SkillTree from './components/SkillTree.jsx'
import ModuleView from './components/ModuleView.jsx'
import MissionView from './components/MissionView.jsx'
import Toasts from './components/Toasts.jsx'

function Shell() {
  const { reset } = useGame()
  const [view, setView] = useState('m1')
  const mod = MODULES.find((m) => m.id === view)
  const mission = MISSIONS.find((m) => m.id === view)

  const onReset = () => {
    if (window.confirm('Reset all XP, badges and mission progress?')) reset()
  }

  return (
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
          {mod && <ModuleView key={mod.id} module={mod} />}
          {mission && <MissionView key={mission.id} mission={mission} />}
        </main>
      </div>
      <Toasts />
    </div>
  )
}

export default function App() {
  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  )
}
