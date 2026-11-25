import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { MODULES, MISSIONS, RANKS, BADGES } from './data/curriculum.js'

const STORAGE_KEY = 'nic-sim-progress-v1'
const GameCtx = createContext(null)

export const ALL_TASKS = [
  ...MODULES.flatMap((m) => m.tasks.map((t) => ({ ...t, module: m.id }))),
  ...MISSIONS.map((m) => ({ id: m.id, label: m.title, xp: m.xp, module: 'missions' })),
]
export const MAX_XP = ALL_TASKS.reduce((s, t) => s + t.xp, 0)

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return { done: {}, quizBest: {} }
}

export function GameProvider({ children }) {
  const [state, setState] = useState(load)
  const [toasts, setToasts] = useState([])
  const toastId = useRef(0)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* ignore */
    }
  }, [state])

  const pushToast = useCallback((t) => {
    const id = ++toastId.current
    setToasts((ts) => [...ts, { id, ...t }])
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), t.ms || 3800)
  }, [])

  const xp = useMemo(
    () => ALL_TASKS.filter((t) => state.done[t.id]).reduce((s, t) => s + t.xp, 0),
    [state.done],
  )

  const earnedBadges = useMemo(
    () => BADGES.filter((b) => b.requires.every((id) => state.done[id])).map((b) => b.id),
    [state.done],
  )

  const prevBadges = useRef(earnedBadges)
  useEffect(() => {
    const fresh = earnedBadges.filter((b) => !prevBadges.current.includes(b))
    fresh.forEach((id) => {
      const b = BADGES.find((x) => x.id === id)
      pushToast({ kind: 'badge', title: 'Badge unlocked', body: b.name, ms: 5200 })
    })
    prevBadges.current = earnedBadges
  }, [earnedBadges, pushToast])

  const rank = useMemo(() => {
    let r = RANKS[0]
    for (const k of RANKS) if (xp >= k.minXp) r = k
    return r
  }, [xp])

  const prevRank = useRef(rank.level)
  useEffect(() => {
    if (rank.level > prevRank.current) {
      pushToast({ kind: 'rank', title: `Promoted to Lvl ${rank.level}`, body: rank.title, ms: 5200 })
    }
    prevRank.current = rank.level
  }, [rank, pushToast])

  const doneRef = useRef(state.done)
  doneRef.current = state.done
  const complete = useCallback(
    (id) => {
      if (doneRef.current[id]) return
      doneRef.current = { ...doneRef.current, [id]: Date.now() }
      const task = ALL_TASKS.find((t) => t.id === id)
      if (task) pushToast({ kind: 'xp', title: `+${task.xp} XP`, body: task.label })
      setState((s) => (s.done[id] ? s : { ...s, done: { ...s.done, [id]: Date.now() } }))
    },
    [pushToast],
  )

  const recordQuiz = useCallback((moduleId, score) => {
    setState((s) => ({
      ...s,
      quizBest: { ...s.quizBest, [moduleId]: Math.max(score, s.quizBest[moduleId] || 0) },
    }))
  }, [])

  const reset = useCallback(() => setState({ done: {}, quizBest: {} }), [])

  const value = {
    done: state.done,
    quizBest: state.quizBest,
    xp,
    rank,
    earnedBadges,
    complete,
    recordQuiz,
    reset,
    toasts,
    pushToast,
  }
  return <GameCtx.Provider value={value}>{children}</GameCtx.Provider>
}

export const useGame = () => useContext(GameCtx)
