"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QUIZ_QUESTIONS, QUIZ_PASS_THRESHOLD, QUIZ_QUESTIONS_PER_GAME } from "../lib/battleSystem";
import { QuizPassScene, QuizFailScene } from "./DialogueScene";
import { submitQuizResult } from "../hooks/useEvent";

const QUIZ_TIME_SECONDS = 300;
const KIMONO_SPRITE = "https://play.pokemonshowdown.com/sprites/trainers/kimonogirl.png";

const KIMONO_GIRLS = [
  { name: "Satsuki", color: "#ef4444", bgColor: "#3d0808", sprite: "https://play.pokemonshowdown.com/sprites/ani/flareon.gif", pokemon: "Pyroli", hueRotate: "0deg" },
  { name: "Tamao", color: "#6366f1", bgColor: "#1a0830", sprite: "https://play.pokemonshowdown.com/sprites/ani/umbreon.gif", pokemon: "Noctali", hueRotate: "240deg" },
  { name: "Koume", color: "#f59e0b", bgColor: "#2d1800", sprite: "https://play.pokemonshowdown.com/sprites/ani/jolteon.gif", pokemon: "Voltali", hueRotate: "50deg" },
  { name: "Sakura", color: "#ec4899", bgColor: "#2d0820", sprite: "https://play.pokemonshowdown.com/sprites/ani/espeon.gif", pokemon: "Mentali", hueRotate: "300deg" },
  { name: "Miki", color: "#3b82f6", bgColor: "#08182d", sprite: "https://play.pokemonshowdown.com/sprites/ani/vaporeon.gif", pokemon: "Aquali", hueRotate: "190deg" },
];

export function QuizScreen({ pseudo, onComplete }: { pseudo: string; onComplete: (passed: boolean, score: number) => void }) {
  // Tire 10 questions au hasard parmi les 40 — différent pour chaque joueur
  const questions = useMemo(() => {
    const shuffled = [...QUIZ_QUESTIONS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, QUIZ_QUESTIONS_PER_GAME);
  }, []);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [timeLeft, setTimeLeft] = useState(QUIZ_TIME_SECONDS);
  const [finished, setFinished] = useState(false);
  const [outro, setOutro] = useState<"pass" | "fail" | null>(null);
  const [finalScore, setFinalScore] = useState(0);
  const [passedResult, setPassedResult] = useState(false);

  // Intro state
  const [intro, setIntro] = useState(true);
  const [introStep, setIntroStep] = useState(0); // 0=title, 1-5=each girl, 6=done

  // ─── INTRO SEQUENCE ───
  useEffect(() => {
    if (!intro) return;
    if (introStep > 5) { setIntro(false); return; }
    const delay = introStep === 0 ? 2500 : 1800;
    const t = setTimeout(() => setIntroStep(s => s + 1), delay);
    return () => clearTimeout(t);
  }, [intro, introStep]);

  // ─── TIMER ───
  useEffect(() => {
    if (finished || intro) return;
    if (timeLeft <= 0) { finishQuiz(score); return; }
    const id = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(id);
  }, [timeLeft, finished, intro]);

  const finishQuiz = useCallback((finalScore: number) => {
    if (finished) return;
    setFinished(true);
    const passed = finalScore >= QUIZ_PASS_THRESHOLD;
    setFinalScore(finalScore);
    setPassedResult(passed); // store result — Firestore written only after dialogue
    // Affiche la cutscène — onComplete sera appelé à la fin de la scène
    setTimeout(() => setOutro(passed ? "pass" : "fail"), 1500);
  }, [finished, pseudo, questions.length]);

  const answer = useCallback((optionIdx: number) => {
    if (answered !== null || finished) return;
    setAnswered(optionIdx);
    const correct = optionIdx === questions[currentQ].correct;
    const newScore = correct ? score + 1 : score;
    if (correct) setScore(newScore);
    setShowResult(true);
    setTimeout(() => {
      setShowResult(false);
      setAnswered(null);
      if (currentQ + 1 >= questions.length) finishQuiz(newScore);
      else setCurrentQ(q => q + 1);
    }, 1800);
  }, [answered, currentQ, questions, score, finished, finishQuiz]);

  const timerStr = `${String(Math.floor(timeLeft / 60)).padStart(2, "0")}:${String(timeLeft % 60).padStart(2, "0")}`;
  const girl = KIMONO_GIRLS[currentQ % KIMONO_GIRLS.length];
  const q = questions[currentQ];

  if (outro === "pass") return (
    <QuizPassScene pseudo={pseudo} score={finalScore} total={questions.length}
      onComplete={() => {
        // Write to Firestore NOW — after dialogue is done
        // This triggers BossEventFlow routing to "beasts"
        submitQuizResult(pseudo, finalScore, questions.length, true);
        onComplete(true, finalScore);
      }} />
  );
  if (outro === "fail") return (
    <QuizFailScene pseudo={pseudo} score={finalScore} total={questions.length}
      onComplete={() => {
        submitQuizResult(pseudo, finalScore, questions.length, false);
        onComplete(false, finalScore);
      }} />
  );

  /* ═══════════════════════════════════════════════
     INTRO — Kimono Sisters Ceremony
     ═══════════════════════════════════════════════ */
  if (intro) {
    return (
      <div className="h-dvh w-full flex items-center justify-center overflow-hidden relative"
        style={{ background: "radial-gradient(ellipse at 50% 30%, #2d1208 0%, #1a0800 40%, #0a0400 100%)", fontFamily: "'Courier New', monospace" }}>
        <SacredFireBG count={30} />

        {/* Ambient temple glow */}
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[400px] h-[300px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(245,158,11,0.06), transparent 70%)", filter: "blur(50px)" }} />

        <div className="text-center z-10 relative">
          <AnimatePresence mode="wait">
            {/* Step 0: Title */}
            {introStep === 0 && (
              <motion.div key="title" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.6 }}>
                <p className="text-amber-400/40 text-xs tracking-[0.3em] uppercase mb-4">Épreuve des Danseuses Kimono</p>
                <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text"
                  style={{ backgroundImage: "linear-gradient(135deg, #fef3c7, #f59e0b, #dc2626)" }}>
                  Le Quiz Sacré
                </h1>
                <p className="text-amber-200/30 text-sm mt-4">10 questions · {QUIZ_PASS_THRESHOLD} bonnes réponses pour passer</p>
                <p className="text-amber-200/20 text-xs mt-6">« Les Danseuses de Rosalia vont tester ta connaissance… »</p>
              </motion.div>
            )}

            {/* Steps 1-5: Each Kimono Girl with her Eeveelution */}
            {introStep >= 1 && introStep <= 5 && (
              <motion.div key={`girl-${introStep}`}
                initial={{ opacity: 0, x: 80, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -80, scale: 0.9 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col items-center"
              >
                {/* Kimono Girl trainer sprite + Eeveelution side by side */}
                <div className="flex items-end justify-center gap-3 mb-4">
                  <motion.img
                    src={KIMONO_SPRITE}
                    alt={KIMONO_GIRLS[introStep - 1].name}
                    initial={{ x: -30, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    style={{
                      width: "80px", imageRendering: "pixelated",
                      filter: `hue-rotate(${KIMONO_GIRLS[introStep - 1].hueRotate}) drop-shadow(0 0 12px ${KIMONO_GIRLS[introStep - 1].color}60)`,
                    }}
                    onError={e => { e.currentTarget.style.display = "none"; }}
                  />
                  <motion.img
                    src={KIMONO_GIRLS[introStep - 1].sprite}
                    alt={KIMONO_GIRLS[introStep - 1].pokemon}
                    initial={{ x: 30, opacity: 0 }}
                    animate={{ x: 0, opacity: 1, y: [0, -8, 0] }}
                    transition={{ delay: 0.3, y: { duration: 1.8, repeat: Infinity } }}
                    style={{
                      imageRendering: "pixelated", width: "60px",
                      filter: `drop-shadow(0 0 12px ${KIMONO_GIRLS[introStep - 1].color}80)`,
                    }}
                    onError={e => { e.currentTarget.style.display = "none"; }}
                  />
                </div>

                {/* Name divider */}
                <div className="w-16 h-0.5 rounded-full mb-3" style={{ background: KIMONO_GIRLS[introStep - 1].color }} />
                <h2 className="text-2xl font-bold mb-1" style={{ color: KIMONO_GIRLS[introStep - 1].color }}>
                  {KIMONO_GIRLS[introStep - 1].name}
                </h2>
                <p className="text-white/30 text-sm">& {KIMONO_GIRLS[introStep - 1].pokemon}</p>

                {/* Progress dots */}
                <div className="flex justify-center gap-2.5 mt-6">
                  {KIMONO_GIRLS.map((g, i) => (
                    <motion.div key={i}
                      className="rounded-full transition-all duration-300"
                      style={{
                        width: i === introStep - 1 ? 12 : 8,
                        height: i === introStep - 1 ? 12 : 8,
                        background: i < introStep ? g.color : i === introStep - 1 ? g.color : "rgba(255,255,255,0.1)",
                        boxShadow: i === introStep - 1 ? `0 0 8px ${g.color}` : "none",
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Skip button */}
          <button onClick={() => setIntro(false)}
            className="mt-10 text-amber-300/25 text-xs hover:text-amber-300/60 transition-colors">
            Passer ▸
          </button>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════
     FINISHED SCREEN
     ═══════════════════════════════════════════════ */
  if (finished) {
    const passed = score >= QUIZ_PASS_THRESHOLD;
    return (
      <div className="h-dvh w-full flex items-center justify-center overflow-hidden relative"
        style={{ background: "radial-gradient(ellipse at 50% 30%, #2d1208 0%, #0a0400 100%)", fontFamily: "'Courier New', monospace" }}>
        <SacredFireBG count={20} />
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="bg-[#f8f0e0] border-4 border-black p-8 max-w-sm text-center relative z-10"
          style={{ boxShadow: "6px 6px 0 #000" }}>
          <div className="text-4xl mb-3">{passed ? "🌟" : "❌"}</div>
          <h2 className="text-2xl font-bold mb-3" style={{ color: passed ? "#f59e0b" : "#ef4444" }}>
            {passed ? "QUIZ RÉUSSI !" : "QUIZ ÉCHOUÉ"}
          </h2>
          <p className="text-sm text-gray-700 mb-2">Score : <strong>{score}/{questions.length}</strong></p>
          <p className="text-xs text-gray-500 mb-4">
            {passed ? "Les Danseuses Kimono t'acceptent !" : `Il fallait ${QUIZ_PASS_THRESHOLD} bonnes réponses.`}
          </p>
          {passed && (
            <div className="flex justify-center gap-1 mb-4">
              {["#ef4444", "#f97316", "#fbbf24", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"].map((c, i) => (
                <motion.div key={i} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                  transition={{ delay: 0.2 + i * 0.07 }}
                  className="w-4 h-1 rounded-full" style={{ background: c }} />
              ))}
            </div>
          )}
          <p className="text-[10px] text-gray-400 animate-pulse">Redirection…</p>
        </motion.div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════
     QUIZ QUESTION — with Kimono Girl asking
     ═══════════════════════════════════════════════ */
  return (
    <div className="h-dvh w-full flex flex-col overflow-hidden relative"
      style={{
        background: `radial-gradient(ellipse at 50% 20%, ${girl.bgColor} 0%, #1a0800 50%, #0a0400 100%)`,
        fontFamily: "'Courier New', monospace",
      }}>
      <SacredFireBG count={18} />

      {/* Ecruteak ambient — temple silhouette hint */}
      <div className="absolute bottom-0 left-0 right-0 h-[15%] pointer-events-none z-0"
        style={{ background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.3))" }} />

      {/* ── TOP BAR ── */}
      <div className="relative z-10 flex items-center justify-between p-3">
        <div className="bg-[#f8f0e0] border-[3px] border-black px-3 py-1.5" style={{ boxShadow: "3px 3px 0 #000" }}>
          <span className="text-[10px] font-bold text-gray-600">Q {currentQ + 1}/{questions.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-[#f8f0e0] border-[3px] border-black px-3 py-1.5" style={{ boxShadow: "3px 3px 0 #000" }}>
            <span className="text-[10px] font-bold" style={{ color: timeLeft < 60 ? "#ef4444" : "#000" }}>⏱ {timerStr}</span>
          </div>
          <div className="bg-[#f8f0e0] border-[3px] border-black px-3 py-1.5" style={{ boxShadow: "3px 3px 0 #000" }}>
            <span className="text-[10px] font-bold text-amber-600">★ {score}/{QUIZ_PASS_THRESHOLD}</span>
          </div>
        </div>
      </div>

      {/* ── SCORE PROGRESS BAR ── */}
      <div className="relative z-10 px-4 mb-1">
        <div className="h-2 bg-black/30 rounded-full overflow-hidden border border-amber-400/20">
          <motion.div className="h-full rounded-full"
            animate={{ width: `${Math.min(100, (score / QUIZ_PASS_THRESHOLD) * 100)}%` }}
            style={{
              background: score >= QUIZ_PASS_THRESHOLD
                ? "linear-gradient(90deg, #22c55e, #4ade80)"
                : "linear-gradient(90deg, #f59e0b, #fbbf24)",
            }} />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[8px] text-amber-300/25">{score}/{QUIZ_PASS_THRESHOLD} pour passer</span>
          <span className="text-[8px]" style={{ color: girl.color }}>⚡ {girl.name}</span>
        </div>
      </div>

      {/* ── QUESTION AREA ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div key={currentQ}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-lg"
          >
            {/* Question card with Kimono Girl */}
            <div className="bg-[#f8f0e0] border-4 border-black p-4 mb-4 relative"
              style={{ boxShadow: "6px 6px 0 #000" }}>

              {/* Sister identity — trainer sprite + eeveelution + name */}
              <div className="flex items-center gap-3 mb-3 pb-3"
                style={{ borderBottom: `2px solid ${girl.color}30` }}>
                <div className="relative flex-shrink-0 flex items-end gap-1">
                  {/* Kimono Girl trainer sprite with color tint */}
                  <img
                    src={KIMONO_SPRITE}
                    alt={girl.name}
                    style={{
                      width: "48px", imageRendering: "pixelated",
                      filter: `hue-rotate(${girl.hueRotate}) drop-shadow(0 0 6px ${girl.color}40)`,
                    }}
                    onError={e => { e.currentTarget.style.display = "none"; }}
                  />
                  {/* Her Eeveelution animated */}
                  <motion.img
                    src={girl.sprite}
                    alt={girl.pokemon}
                    animate={{ y: [0, -3, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{
                      imageRendering: "pixelated", width: "36px", height: "36px",
                      position: "relative",
                    }}
                    onError={e => { e.currentTarget.style.display = "none"; }}
                  />
                </div>
                <div>
                  <p className="text-[11px] font-bold" style={{ color: girl.color }}>{girl.name}</p>
                  <p className="text-[9px] text-gray-500">Danseuse Kimono · {girl.pokemon}</p>
                </div>
              </div>

              {/* Question text — the sister "asks" */}
              <p className="text-sm sm:text-base font-bold text-black leading-relaxed">
                « {q.question} »
              </p>
            </div>

            {/* Answer options */}
            <div className="grid grid-cols-1 gap-2.5">
              {q.options.map((opt, i) => {
                const isCorrect = i === q.correct;
                const isSelected = answered === i;
                let bg = "#f8f0e0";
                let borderColor = "#000";
                if (showResult) {
                  if (isCorrect) { bg = "#bbf7d0"; borderColor = "#16a34a"; }
                  else if (isSelected && !isCorrect) { bg = "#fecaca"; borderColor = "#dc2626"; }
                }
                return (
                  <motion.button key={i} whileTap={{ scale: 0.97 }}
                    disabled={answered !== null}
                    onClick={() => answer(i)}
                    className="border-[3px] p-3.5 text-left text-sm font-bold text-black disabled:cursor-not-allowed active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                    style={{
                      background: bg, borderColor,
                      boxShadow: showResult && (isCorrect || isSelected) ? "none" : "4px 4px 0 #000",
                    }}>
                    <span className="text-gray-500 mr-2">{String.fromCharCode(65 + i)}.</span>
                    {opt}
                    {showResult && isCorrect && <span className="ml-2 text-green-600">✓</span>}
                    {showResult && isSelected && !isCorrect && <span className="ml-2 text-red-600">✗</span>}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom bar */}
      <div className="relative z-10 p-3 text-center">
        <p className="text-[10px] text-amber-300/15">{pseudo} · Quiz des Kimono</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SACRED FIRE BACKGROUND PARTICLES
   ═══════════════════════════════════════════════ */
function SacredFireBG({ count = 20 }: { count?: number }) {
  const particles = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 6,
      duration: 5 + Math.random() * 8,
      size: 2 + Math.random() * 4,
      opacity: 0.15 + Math.random() * 0.3,
      color: ["#f59e0b", "#ef4444", "#fbbf24", "#f97316"][i % 4],
    })),
  [count]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map(p => (
        <div key={p.id} className="absolute rounded-full" style={{
          left: `${p.left}%`,
          bottom: "-3%",
          width: p.size,
          height: p.size,
          backgroundColor: p.color,
          boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
          opacity: p.opacity,
          animation: `sacred-fire-rise ${p.duration}s ${p.delay}s infinite linear`,
        }} />
      ))}
      <style>{`
        @keyframes sacred-fire-rise {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 0.5; }
          80% { opacity: 0.2; }
          100% { transform: translateY(-100vh) translateX(${-20 + Math.random() * 40}px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}