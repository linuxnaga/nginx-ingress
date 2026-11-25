import { useState } from 'react'
import { HelpCircle, CheckCircle2, XCircle, RotateCcw, Trophy } from 'lucide-react'
import { useGame } from '../game.jsx'
import { Panel, Button } from './ui.jsx'

export default function Quiz({ module }) {
  const { complete, recordQuiz, quizBest, done } = useGame()
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const qs = module.quiz
  const score = qs.filter((q, i) => answers[i] === q.answer).length
  const pass = score >= Math.ceil(qs.length * 0.75)
  const taskId = `${module.id}-quiz`

  const submit = () => {
    setSubmitted(true)
    recordQuiz(module.id, score)
    if (score >= Math.ceil(qs.length * 0.75)) complete(taskId)
  }
  const retry = () => {
    setAnswers({})
    setSubmitted(false)
  }

  return (
    <Panel
      title={`Knowledge Check · Module ${module.num}`}
      icon={HelpCircle}
      accent={module.accent}
      right={
        <span className="text-xs text-slate-400">
          Pass mark {Math.ceil(qs.length * 0.75)}/{qs.length}
          {quizBest[module.id] != null && ` · best ${quizBest[module.id]}/${qs.length}`}
          {done[taskId] && <CheckCircle2 size={13} className="ml-1 inline text-nginx" />}
        </span>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        {qs.map((q, i) => (
          <div key={i} className="rounded-lg border border-edge bg-void/50 p-3">
            <div className="text-[13px] font-semibold text-slate-100">
              <span className="mr-1.5 font-mono text-slate-500">Q{i + 1}.</span>
              {q.q}
            </div>
            <div className="mt-2 flex flex-col gap-1.5">
              {q.options.map((o, j) => {
                const chosen = answers[i] === j
                const correct = submitted && j === q.answer
                const wrong = submitted && chosen && j !== q.answer
                return (
                  <button
                    key={j}
                    disabled={submitted}
                    onClick={() => setAnswers((a) => ({ ...a, [i]: j }))}
                    className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition ${
                      correct
                        ? 'border-emerald-500/70 bg-emerald-500/10 text-emerald-200'
                        : wrong
                          ? 'border-rose-500/70 bg-rose-500/10 text-rose-200'
                          : chosen
                            ? 'border-k8s bg-k8s/15 text-white'
                            : 'border-edge text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <span className="font-mono text-slate-500">{String.fromCharCode(65 + j)}</span>
                    <span className="flex-1">{o}</span>
                    {correct && <CheckCircle2 size={14} className="shrink-0" />}
                    {wrong && <XCircle size={14} className="shrink-0" />}
                  </button>
                )
              })}
            </div>
            {submitted && <p className="mt-2 text-[11px] leading-relaxed text-slate-400">💡 {q.why}</p>}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        {!submitted ? (
          <Button variant="primary" onClick={submit} disabled={Object.keys(answers).length < qs.length}>
            Submit answers ({Object.keys(answers).length}/{qs.length})
          </Button>
        ) : (
          <>
            <div className={`flex items-center gap-2 text-sm font-semibold ${pass ? 'text-emerald-400' : 'text-amber-400'}`}>
              {pass ? <Trophy size={16} /> : <RotateCcw size={16} />}
              Score {score}/{qs.length}. {pass ? 'Knowledge check passed!' : 'Not quite. Review the explanations and try again.'}
            </div>
            <Button size="sm" icon={RotateCcw} onClick={retry}>Retry</Button>
          </>
        )}
      </div>
    </Panel>
  )
}
