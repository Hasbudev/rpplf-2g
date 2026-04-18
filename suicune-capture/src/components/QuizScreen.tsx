"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QUIZ_QUESTIONS, QUIZ_PASS_THRESHOLD, type QuizQuestion } from "../lib/battleSystem";
import { submitQuizResult } from "../hooks/useEvent";

const QUIZ_TIME_SECONDS = 300; // 5 min

const KIMONO_GIRLS = [
  { name: "Satsuki", color: "#ef4444", emoji: "🔥" },
  { name: "Tamao", color: "#6366f1", emoji: "🌙" },
  { name: "Koume", color: "#f59e0b", emoji: "⚡" },
  { name: "Sakura", color: "#ec4899", emoji: "💜" },
  { name: "Miki", color: "#3b82f6", emoji: "💧" },
];

interface QuizProps {
  pseudo: string;
  onComplete: (passed: boolean, score: number) => void;
}

export function QuizScreen({ pseudo, onComplete }: QuizProps) {
  // Shuffle questions once
  const questions = useMemo(() => {
    const shuffled = [...QUIZ_QUESTIONS].sort(() => Math.random() - 0.5);
    return shuffled;
  }, []);

  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [timeLeft, setTimeLeft] = useState(QUIZ_TIME_SECONDS);
  const [finished, setFinished] = useState(false);
  const [intro, setIntro] = useState(true);

  // Timer
  useEffect(() => {
    if (finished || intro) return;
    if (timeLeft <= 0) { finishQuiz(score); return; }
    const id = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timeLeft, finished, intro]);

  // Auto-dismiss intro
  useEffect(() => {
    const t = setTimeout(() => setIntro(false), 4000);
    return () => clearTimeout(t);
  }, []);

  const finishQuiz = useCallback((finalScore: number) => {
    if (finished) return;
    setFinished(true);
    const passed = finalScore >= QUIZ_PASS_THRESHOLD;
    submitQuizResult(pseudo, finalScore, questions.length, passed);
    setTimeout(() => onComplete(passed, finalScore), 4000);
  }, [finished, pseudo, questions.length, onComplete]);

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
      if (currentQ + 1 >= questions.length) {
        finishQuiz(newScore);
      } else {
        setCurrentQ((q) => q + 1);
      }
    }, 1500);
  }, [answered, currentQ, questions, score, finished, finishQuiz]);

  const timerMins = Math.floor(timeLeft / 60);
  const timerSecs = timeLeft % 60;
  const timerStr = `${String(timerMins).padStart(2, "0")}:${String(timerSecs).padStart(2, "0")}`;
  const isUrgent = timeLeft < 60;
  const q = questions[currentQ];
  const kimonoGirl = KIMONO_GIRLS[currentQ % KIMONO_GIRLS.length];

  // Intro screen
  if (intro) {
    return (
      <div className="h-dvh w-full flex items-center justify-center overflow-hidden relative"
        style={{ background: "radial-gradient(ellipse at 50% 30%, #2d1208 0%, #1a0800 40%, #0a0400 100%)", fontFamily: "'Courier New', monospace" }}
      >
        <SacredFireBG />
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center z-10 relative">
          <p className="text-amber-400/40 text-xs tracking-[0.3em] uppercase mb-4">Épreuve des Danseuses Kimono</p>
          <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text"
            style={{ backgroundImage: "linear-gradient(135deg, #fef3c7, #f59e0b, #dc2626)" }}
          >Le Quiz Sacré</h1>
          <p className="text-amber-200/40 text-sm mt-4">15 questions · 10 bonnes réponses pour passer</p>
          <div className="flex justify-center gap-3 mt-6">
            {KIMONO_GIRLS.map((g, i) => (
              <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 + i * 0.15 }}
                className="text-2xl">{g.emoji}</motion.div>
            ))}
          </div>
          <button onClick={() => setIntro(false)} className="mt-8 text-amber-300/50 text-xs hover:text-amber-300/80 transition-colors">
            Passer l'intro ▸
          </button>
        </motion.div>
      </div>
    );
  }

  // Finished screen
  if (finished) {
    const passed = score >= QUIZ_PASS_THRESHOLD;
    return (
      <div className="h-dvh w-full flex items-center justify-center overflow-hidden relative"
        style={{ background: "radial-gradient(ellipse at 50% 30%, #2d1208 0%, #1a0800 40%, #0a0400 100%)", fontFamily: "'Courier New', monospace" }}
      >
        <SacredFireBG />
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="bg-[#f8f0e0] border-4 border-black p-8 max-w-sm text-center relative z-10"
          style={{ boxShadow: "6px 6px 0 #000" }}
        >
          <div className="text-4xl mb-4">{passed ? "🌟" : "❌"}</div>
          <h2 className="text-2xl font-bold mb-3" style={{ color: passed ? "#f59e0b" : "#ef4444" }}>
            {passed ? "QUIZ RÉUSSI !" : "QUIZ ÉCHOUÉ"}
          </h2>
          <p className="text-sm text-gray-700 mb-2">
            Score : <strong className="text-black">{score}/{questions.length}</strong>
          </p>
          <p className="text-xs text-gray-500 mb-4">
            {passed
              ? "Les Danseuses Kimono t'acceptent. Prépare-toi au combat !"
              : `Il fallait ${QUIZ_PASS_THRESHOLD} bonnes réponses. Dommage, ${pseudo}…`}
          </p>
          {passed && (
            <div className="flex justify-center gap-1 mb-4">
              {["#ef4444", "#f97316", "#fbbf24", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"].map((c, i) => (
                <motion.div key={i} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className="w-4 h-1 rounded-full" style={{ background: c }} />
              ))}
            </div>
          )}
          <p className="text-[10px] text-gray-400 animate-pulse">Redirection automatique…</p>
        </motion.div>
      </div>
    );
  }

  // Quiz question screen
  return (
    <div className="h-dvh w-full flex flex-col overflow-hidden relative"
      style={{ background: "radial-gradient(ellipse at 50% 20%, #2d1208 0%, #1a0800 50%, #0a0400 100%)", fontFamily: "'Courier New', monospace" }}
    >
      <SacredFireBG />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between p-3 sm:p-4">
        <div className="bg-[#f8f0e0] border-[3px] border-black px-3 py-1.5" style={{ boxShadow: "3px 3px 0 #000" }}>
          <span className="text-[10px] text-gray-600 font-bold">Q {currentQ + 1}/{questions.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-[#f8f0e0] border-[3px] border-black px-3 py-1.5" style={{ boxShadow: "3px 3px 0 #000" }}>
            <span className="text-[10px] font-bold" style={{ color: isUrgent ? "#ef4444" : "#000" }}>
              ⏱ {timerStr}
            </span>
          </div>
          <div className="bg-[#f8f0e0] border-[3px] border-black px-3 py-1.5" style={{ boxShadow: "3px 3px 0 #000" }}>
            <span className="text-[10px] font-bold text-amber-600">★ {score}</span>
          </div>
        </div>
      </div>

      {/* Score bar */}
      <div className="relative z-10 px-4 mb-4">
        <div className="h-2 bg-black/30 rounded-full overflow-hidden border border-amber-400/20">
          <motion.div className="h-full rounded-full"
            animate={{ width: `${(score / QUIZ_PASS_THRESHOLD) * 100}%` }}
            style={{ background: score >= QUIZ_PASS_THRESHOLD ? "linear-gradient(90deg, #22c55e, #4ade80)" : "linear-gradient(90deg, #f59e0b, #fbbf24)" }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-amber-300/30">{score}/{QUIZ_PASS_THRESHOLD} pour passer</span>
          <span className="text-[9px]" style={{ color: kimonoGirl.color }}>{kimonoGirl.emoji} {kimonoGirl.name}</span>
        </div>
      </div>

      {/* Question card */}
      <div className="flex-1 flex items-center justify-center px-4 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQ}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="w-full max-w-lg"
          >
            {/* Question */}
            <div className="bg-[#f8f0e0] border-4 border-black p-5 mb-4" style={{ boxShadow: "6px 6px 0 #000" }}>
              <div className="flex items-start gap-3 mb-1">
                <span className="text-2xl flex-shrink-0">{kimonoGirl.emoji}</span>
                <p className="text-sm sm:text-base font-bold text-black leading-relaxed">{q.question}</p>
              </div>
            </div>

            {/* Options */}
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
                  <motion.button
                    key={i}
                    whileTap={{ scale: 0.97 }}
                    disabled={answered !== null}
                    onClick={() => answer(i)}
                    className="border-[3px] p-3.5 text-left text-sm font-bold text-black disabled:cursor-not-allowed active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                    style={{
                      background: bg, borderColor,
                      boxShadow: showResult && (isCorrect || isSelected) ? "none" : "4px 4px 0 #000",
                    }}
                  >
                    <span className="text-gray-500 mr-2">{String.fromCharCode(65 + i)}.</span>
                    {opt}
                    {showResult && isCorrect && <span className="ml-2">✓</span>}
                    {showResult && isSelected && !isCorrect && <span className="ml-2">✗</span>}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom pseudo */}
      <div className="relative z-10 p-3 text-center">
        <p className="text-[10px] text-amber-300/20">{pseudo} · Quiz des Kimono</p>
      </div>
    </div>
  );
}

/* Sacred fire background particles */
function SacredFireBG() {
  const particles = useMemo(() =>
    Array.from({ length: 25 }, (_, i) => ({
      id: i, left: Math.random() * 100, delay: Math.random() * 5,
      duration: 5 + Math.random() * 7, size: 2 + Math.random() * 4,
      opacity: 0.15 + Math.random() * 0.3,
      color: (["#f59e0b", "#ef4444", "#fbbf24", "#f97316"])[Math.floor(Math.random() * 4)],
    })), []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((p) => (
        <div key={p.id} className="absolute rounded-full" style={{
          left: `${p.left}%`, bottom: "-3%",
          width: p.size, height: p.size, backgroundColor: p.color,
          boxShadow: `0 0 ${p.size * 2}px ${p.color}`, opacity: p.opacity,
          animation: `quiz-fire ${p.duration}s ${p.delay}s infinite linear`,
        }} />
      ))}
      <style>{`
        @keyframes quiz-fire {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 0.5; }
          100% { transform: translateY(-100vh) translateX(${-20 + Math.random() * 40}px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
