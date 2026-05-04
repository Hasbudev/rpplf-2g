"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ═══════════════════════════════════════════════
   CREDITS SCREEN — Cinématique de fin
   ═══════════════════════════════════════════════ */

const CREDITS = [
  {
    category: "GOAT",
    subtitle: "Concours Insecte · Défis Raikou / Entei / Suicune · Défi Ho-Oh",
    names: ["Moyerf"],
    color: "#fbbf24",
    emoji: "🐐",
  },
  {
    category: "GOATs du tableau de l'Aventure",
    subtitle: "",
    names: ["Shykimi", "Serigne"],
    color: "#f59e0b",
    emoji: "🏆",
  },
  {
    category: "Conception du tableau",
    subtitle: "",
    names: ["Boonty", "Vincent"],
    color: "#38bdf8",
    emoji: "📋",
  },
  {
    category: "Visuels",
    subtitle: "",
    names: ["Bastien"],
    color: "#a78bfa",
    emoji: "🎨",
  },
  {
    category: "Champions d'Arène",
    subtitle: "",
    names: ["Shraider", "Leafia", "Extinct", "Ludo", "Serigne", "Zaww", "Nihilow", "Shykimi"],
    color: "#34d399",
    emoji: "🏅",
  },
  {
    category: "Conseil des Quatre",
    subtitle: "",
    names: ["Bogi", "Kindy", "Minissou", "Loam"],
    color: "#ef4444",
    emoji: "⚔️",
  },
  {
    category: "Roublard Rocket",
    subtitle: "",
    names: ["Loam"],
    color: "#6366f1",
    emoji: "🕵️",
  },
  {
    category: "Team Rocket",
    subtitle: "",
    names: ["Roudy"],
    color: "#dc2626",
    emoji: "🚀",
  },
  {
    category: "Pokéathlon",
    subtitle: "",
    names: ["Wappy", "Hero Sabis", "Valbat", "Shogui"],
    color: "#f97316",
    emoji: "🏃",
  },
  {
    category: "Quête du Celebi",
    subtitle: "",
    names: ["Juyen"],
    color: "#4ade80",
    emoji: "🌿",
  },
  {
    category: "Postgame",
    subtitle: "",
    names: ["LucioCerra"],
    color: "#c084fc",
    emoji: "🎮",
  },
  {
    category: "Lore",
    subtitle: "",
    names: ["Remysse", "Juyen"],
    color: "#f9a8d4",
    emoji: "📖",
  },
  {
    category: "Création de la saison",
    subtitle: "",
    names: ["Loam", "Remysse", "Juyen", "LucioCerra", "Roudy"],
    color: "#fde68a",
    emoji: "⭐",
  },
  {
    category: "Sur une idée originale de",
    subtitle: "",
    names: ["la RPPLF"],
    color: "#fbbf24",
    emoji: "💡",
  },
];

interface CreditsScreenProps {
  pseudo: string;
  won: boolean;
  onClose: () => void;
}

export function CreditsScreen({ pseudo, won, onClose }: CreditsScreenProps) {
  const [phase, setPhase] = useState<"intro" | "credits" | "finale">("intro");
  const [creditsY, setCreditsY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | undefined>(undefined);
  const startRef = useRef<number | null>(null);

  const TOTAL_CREDITS_HEIGHT = CREDITS.length * 140 + 600;
  const SCROLL_DURATION = 60000; // 60 secondes

  // Auto-scroll credits
  useEffect(() => {
    if (phase !== "credits") return;

    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / SCROLL_DURATION, 1);
      const maxScroll = TOTAL_CREDITS_HEIGHT + window.innerHeight;
      setCreditsY(-progress * maxScroll);

      if (progress >= 1) {
        setPhase("finale");
        return;
      }
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [phase]);

  return (
    <div className="h-dvh w-full overflow-hidden relative flex flex-col"
      style={{ background: "#000", fontFamily: "'Courier New', monospace" }}>

      {/* Background particles */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 50 }, (_, i) => (
          <div key={i} className="absolute rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: Math.random() * 2 + 1,
              height: Math.random() * 2 + 1,
              background: ["#fbbf24","#f59e0b","#ef4444","#ec4899","#38bdf8"][i % 5],
              opacity: 0.2 + Math.random() * 0.3,
              animation: `twinkle ${2 + Math.random() * 4}s ${Math.random() * 4}s ease-in-out infinite`,
            }} />
        ))}
      </div>

      {/* YouTube music player (hidden) */}
      <iframe
        className="hidden"
        src="https://www.youtube.com/embed/slvKqu-6AZI?autoplay=1&loop=1&playlist=slvKqu-6AZI&controls=0"
        allow="autoplay"
      />

      <AnimatePresence mode="wait">

        {/* ── INTRO ── */}
        {phase === "intro" && (
          <motion.div key="intro"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center text-center px-8">

            <motion.div
              animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity }}
              className="text-8xl mb-6">
              🌈
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
              className="font-black text-4xl mb-4"
              style={{
                background: "linear-gradient(135deg, #fef3c7, #fbbf24, #f59e0b, #ef4444)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>
              {won ? "Ho-Oh reconnaît ta valeur" : "L'aventure continue..."}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
              className="text-amber-200/50 text-lg mb-2">
              Félicitations, {pseudo}.
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
              className="text-amber-200/30 text-sm mb-12">
              Tu as participé à la Quête de Ho-Oh — Saison 2G de la Ligue RPPLF.
            </motion.p>

            {/* Rainbow divider */}
            <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 2, duration: 1 }}
              className="flex gap-1 mb-12">
              {["#ef4444","#f97316","#fbbf24","#22c55e","#3b82f6","#8b5cf6","#ec4899"].map((c, i) => (
                <div key={i} className="h-1 w-8 rounded-full" style={{ background: c }} />
              ))}
            </motion.div>

            <motion.button
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5 }}
              onClick={() => setPhase("credits")}
              className="px-8 py-3 rounded-full font-black text-sm tracking-widest"
              style={{
                background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                color: "#fff",
                boxShadow: "0 0 30px rgba(245,158,11,0.4)",
              }}>
              VOIR LES CRÉDITS ▶
            </motion.button>
          </motion.div>
        )}

        {/* ── CREDITS SCROLL ── */}
        {phase === "credits" && (
          <motion.div key="credits"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 overflow-hidden relative">

            {/* Click to skip */}
            <button onClick={() => setPhase("finale")}
              className="absolute top-4 right-4 z-20 text-white/20 hover:text-white/50 text-xs font-bold tracking-widest transition-colors">
              SKIP ▶▶
            </button>

            {/* Scrolling content */}
            <div style={{ transform: `translateY(${creditsY}px)`, willChange: "transform" }}>
              {/* Top fade-in space */}
              <div style={{ height: "100vh" }} />

              {/* Credits entries */}
              {CREDITS.map((section, si) => (
                <div key={si} className="text-center px-8 mb-16">
                  {/* Category */}
                  <div className="text-2xl mb-2">{section.emoji}</div>
                  <p className="text-sm font-bold mb-1 tracking-widest uppercase"
                    style={{ color: `${section.color}80` }}>
                    {section.category}
                  </p>
                  {section.subtitle && (
                    <p className="text-xs mb-3" style={{ color: `${section.color}50` }}>{section.subtitle}</p>
                  )}
                  {/* Names */}
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {section.names.map((name, ni) => (
                      <span key={ni} className="text-xl sm:text-2xl font-black"
                        style={{ color: section.color, textShadow: `0 0 20px ${section.color}60` }}>
                        {name}
                      </span>
                    ))}
                  </div>
                  {/* Divider */}
                  {si < CREDITS.length - 1 && (
                    <div className="mt-10 w-16 h-px mx-auto"
                      style={{ background: `linear-gradient(90deg,transparent,${section.color}30,transparent)` }} />
                  )}
                </div>
              ))}

              {/* Bottom */}
              <div className="text-center py-20 px-8">
                <div className="text-5xl mb-6">🌈</div>
                <p className="text-2xl font-black text-white/60 mb-2">Merci à tous</p>
                <p className="text-sm text-white/20">RPPLF League · Saison 2G · 2025</p>
                <div className="flex justify-center gap-1 mt-8">
                  {["#ef4444","#f97316","#fbbf24","#22c55e","#3b82f6","#8b5cf6","#ec4899"].map((c, i) => (
                    <div key={i} className="h-1 w-6 rounded-full" style={{ background: c }} />
                  ))}
                </div>
              </div>

              <div style={{ height: "100vh" }} />
            </div>

            {/* Fade top/bottom */}
            <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
              style={{ background: "linear-gradient(180deg, #000, transparent)" }} />
            <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
              style={{ background: "linear-gradient(0deg, #000, transparent)" }} />
          </motion.div>
        )}

        {/* ── FINALE ── */}
        {phase === "finale" && (
          <motion.div key="finale"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center text-center px-8">

            <motion.div animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 3, repeat: Infinity }} className="text-8xl mb-8">
              🌈
            </motion.div>

            <h1 className="text-3xl font-black mb-4"
              style={{
                background: "linear-gradient(135deg, #fef3c7, #fbbf24, #ef4444)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>
              La RPPLF vous remercie
            </h1>
            <p className="text-white/30 text-sm mb-12">Sur une idée originale de la RPPLF</p>

            <button onClick={onClose}
              className="px-8 py-3 rounded-full font-black text-sm tracking-widest border border-white/10 text-white/40 hover:text-white hover:border-white/30 transition-all">
              FERMER
            </button>
          </motion.div>
        )}

      </AnimatePresence>

      <style>{`
        @keyframes twinkle { 0%,100%{opacity:.1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.5)} }
      `}</style>
    </div>
  );
}