"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ═══════════════════════════════════════════════
   RPG DIALOGUE SYSTEM — Version cinématique
   Sprites légendaires géants + effets atmosphériques
   ═══════════════════════════════════════════════ */

export interface DialogueLine {
  speaker: string;
  text: string;
  // Sprite principal affiché dans la scène (grand, centré)
  sceneSprite?: string;
  sceneSpriteSize?: string;       // ex: "min(280px,55vw)"
  sceneSpriteFilter?: string;     // CSS filter
  sceneSpriteAnim?: "float" | "shake" | "pulse" | "roar"; // animation du sprite
  sceneSpritePos?: "left" | "center" | "right";
  // Couleurs / ambiance
  color?: string;                 // couleur du nom du speaker
  bgGradient?: string;            // override fond
  particles?: "fire" | "electric" | "water" | "divine" | "none";
  // Effets
  speed?: number;
  pause?: number;
  shake?: boolean;
  flash?: string;
}

export interface DialogueSceneProps {
  lines: DialogueLine[];
  onComplete: () => void;
  skipable?: boolean;
  defaultBg?: string;
}

const DEFAULT_SPEED = 26;

/* ════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════ */
export function DialogueScene({
  lines, onComplete, skipable = true, defaultBg = "radial-gradient(ellipse at 50% 30%, #1a0800, #0a0400)",
}: DialogueSceneProps) {
  const [lineIdx,    setLineIdx]    = useState(0);
  const [displayed,  setDisplayed]  = useState("");
  const [isTyping,   setIsTyping]   = useState(true);
  const [flash,      setFlash]      = useState<string | null>(null);
  const [doShake,    setDoShake]    = useState(false);
  const [spriteAnim, setSpriteAnim] = useState<string>("float");
  const [blocked, setBlocked]       = useState(true); // ignore clicks for first 600ms
  const timerRef  = useRef<NodeJS.Timeout | null>(null);
  const pauseRef  = useRef<NodeJS.Timeout | null>(null);

  // Unblock clicks after 600ms — prevents quiz answer click from bubbling in
  useEffect(() => {
    const t = setTimeout(() => setBlocked(false), 600);
    return () => clearTimeout(t);
  }, []);

  const line = lines[lineIdx];

  // ── Typewriter ────────────────────────────────────────────────
  useEffect(() => {
    if (!line) return;
    setDisplayed("");
    setIsTyping(true);
    setSpriteAnim(line.sceneSpriteAnim ?? "float");

    if (line.shake) { setDoShake(true); setTimeout(() => setDoShake(false), 700); }
    if (line.flash) { setFlash(line.flash); setTimeout(() => setFlash(null), 400); }

    let i = 0;
    const spd = line.speed ?? DEFAULT_SPEED;
    timerRef.current = setInterval(() => {
      i++;
      setDisplayed(line.text.slice(0, i));
      if (i >= line.text.length) {
        clearInterval(timerRef.current!);
        setIsTyping(false);
        if (line.pause) pauseRef.current = setTimeout(advance, line.pause);
      }
    }, spd);
    return () => { clearInterval(timerRef.current!); clearTimeout(pauseRef.current!); };
  }, [lineIdx]);

  const advance = useCallback(() => {
    if (blocked) return; // ignore early clicks
    clearTimeout(pauseRef.current!);
    if (isTyping) {
      clearInterval(timerRef.current!);
      setDisplayed(line.text);
      setIsTyping(false);
      return;
    }
    if (lineIdx + 1 >= lines.length) onComplete();
    else setLineIdx(i => i + 1);
  }, [isTyping, lineIdx, lines.length, onComplete, line]);

  if (!line) return null;

  const bg = line.bgGradient ?? defaultBg;
  const pos = line.sceneSpritePos ?? "right";

  return (
    <div
      className="h-dvh w-full flex flex-col overflow-hidden relative select-none"
      style={{
        background: bg,
        fontFamily: "'Courier New', monospace",
        animation: doShake ? "dlg-shake 0.12s ease-in-out 5" : "none",
      }}
      onClick={advance}>

      {/* Flash overlay */}
      <AnimatePresence>
        {flash && (
          <motion.div initial={{ opacity: 0.7 }} animate={{ opacity: 0 }}
            transition={{ duration: 0.4 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 pointer-events-none"
            style={{ background: flash }} />
        )}
      </AnimatePresence>

      {/* ── SCENE AREA ── */}
      <div className="flex-1 relative overflow-hidden">

        {/* Particles */}
        {line.particles && line.particles !== "none" && (
          <SceneParticles type={line.particles} />
        )}

        {/* Atmospheric glow behind sprite */}
        {line.color && (
          <div className="absolute pointer-events-none"
            style={{
              width: "70%", height: "80%",
              top: "10%",
              left: pos === "left" ? "0%" : pos === "right" ? "30%" : "15%",
              background: `radial-gradient(ellipse, ${line.color}20, transparent 65%)`,
              filter: "blur(40px)",
            }} />
        )}

        {/* Main scene sprite */}
        <AnimatePresence mode="wait">
          {line.sceneSprite && (
            <motion.div
              key={`sprite-${lineIdx}-${line.sceneSprite}`}
              initial={{ opacity: 0, scale: 0.85, x: pos === "left" ? -80 : pos === "right" ? 80 : 0 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="absolute"
              style={{
                bottom: "12%",
                left: pos === "left"   ? "5%"  : pos === "right" ? "auto" : "50%",
                right: pos === "right" ? "5%"  : "auto",
                transform: pos === "center" ? "translateX(-50%)" : "none",
              }}>
              <img
                src={line.sceneSprite}
                alt={line.speaker}
                style={{
                  imageRendering: "pixelated",
                  width: line.sceneSpriteSize ?? "min(260px,52vw)",
                  filter: line.sceneSpriteFilter ?? `drop-shadow(0 0 30px ${line.color ?? "#fff"}60)`,
                  animation:
                    spriteAnim === "float"   ? "dlg-float 3s ease-in-out infinite" :
                    spriteAnim === "shake"   ? "dlg-sprite-shake 0.15s ease-in-out infinite" :
                    spriteAnim === "pulse"   ? "dlg-pulse 1.5s ease-in-out infinite" :
                    spriteAnim === "roar"    ? "dlg-roar 0.3s ease-in-out 3" :
                    "dlg-float 3s ease-in-out infinite",
                  transition: "width 0.8s ease, filter 0.8s ease",
                }}
                onError={e => { e.currentTarget.style.opacity = "0"; }}
              />
              {/* Glow halo under sprite */}
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 pointer-events-none"
                style={{
                  width: "80%", height: "30px",
                  background: `radial-gradient(ellipse, ${line.color ?? "#fff"}30, transparent 70%)`,
                  filter: "blur(8px)",
                }} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Speaker name — floats near sprite */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`floating-name-${lineIdx}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-4 pointer-events-none"
            style={{
              left: pos === "left"   ? "12%" : pos === "right" ? "auto" : "50%",
              right: pos === "right" ? "12%" : "auto",
              transform: pos === "center" ? "translateX(-50%)" : "none",
            }}>
            <div className="px-3 py-1 font-black text-[11px] tracking-widest uppercase"
              style={{
                background: `${line.color ?? "#f8f0e0"}22`,
                border: `1px solid ${line.color ?? "#f8f0e0"}44`,
                color: line.color ?? "#f8f0e0",
                backdropFilter: "blur(8px)",
                borderRadius: "4px",
                textShadow: `0 0 12px ${line.color ?? "#fff"}`,
              }}>
              {line.speaker}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Skip button */}
        {skipable && (
          <button
            onClick={e => { e.stopPropagation(); onComplete(); }}
            className="absolute top-3 right-4 text-[10px] uppercase tracking-widest font-bold pointer-events-auto"
            style={{ color: "rgba(255,255,255,0.25)" }}>
            SKIP ▶▶
          </button>
        )}

        {/* Progress dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none">
          {lines.map((_, i) => (
            <div key={i} className="rounded-full transition-all duration-300"
              style={{
                width: i === lineIdx ? 10 : 6, height: 6,
                background: i < lineIdx
                  ? (line.color ?? "#22c55e")
                  : i === lineIdx
                  ? (line.color ?? "#fff")
                  : "rgba(255,255,255,0.15)",
              }} />
          ))}
        </div>
      </div>

      {/* ── DIALOGUE BOX ── */}
      <div className="relative z-10 flex-shrink-0">
        {/* Speaker name tab on box */}
        <div className="absolute -top-7 left-5">
          <div className="px-4 py-1 border-[3px] border-black font-black text-[12px]"
            style={{
              background: line.color ?? "#f8f0e0",
              color: "#000",
              boxShadow: "3px 3px 0 #000",
            }}>
            {line.speaker}
          </div>
        </div>

        {/* Text box */}
        <div className="bg-[#f8f0e0] border-t-[4px] border-black px-5 py-4 relative"
          style={{ minHeight: "110px" }}>
          <div className="absolute top-2 left-2 right-2 bottom-2 border border-black/10 pointer-events-none" />

          <p className="text-[15px] text-black font-bold leading-relaxed min-h-[2.8em] pr-6">
            {displayed}
            {isTyping && <span className="animate-pulse ml-0.5 opacity-60">▌</span>}
          </p>

          {!isTyping && (
            <motion.div
              animate={{ y: [0, 4, 0] }} transition={{ duration: 0.6, repeat: Infinity }}
              className="absolute bottom-3 right-5 font-black text-lg text-black/60">
              ▼
            </motion.div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes dlg-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes dlg-shake { 0%,100%{transform:translate(0,0)} 25%{transform:translate(-4px,2px)} 75%{transform:translate(4px,-2px)} }
        @keyframes dlg-sprite-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
        @keyframes dlg-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
        @keyframes dlg-roar { 0%,100%{transform:scale(1) rotate(0deg)} 25%{transform:scale(1.1) rotate(-3deg)} 75%{transform:scale(1.08) rotate(3deg)} }
      `}</style>
    </div>
  );
}

/* ════════════════════════════════════════════════
   PARTICLES
   ════════════════════════════════════════════════ */
function SceneParticles({ type }: { type: "fire" | "electric" | "water" | "divine" }) {
  const count = type === "divine" ? 40 : 25;
  const ps = useMemo(() => Array.from({ length: count }, (_, i) => {
    const colors = {
      fire:     ["#f59e0b","#ef4444","#f97316","#fbbf24"],
      electric: ["#fde047","#fbbf24","#fff","#a3e635"],
      water:    ["#38bdf8","#7dd3fc","#0ea5e9","#e0f2fe"],
      divine:   ["#fbbf24","#fff","#f59e0b","#fef3c7","#ec4899"],
    }[type];
    return {
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 5,
      dur: type === "electric" ? 1 + Math.random() * 1.5 : 5 + Math.random() * 7,
      size: type === "divine" ? 2 + Math.random() * 6 : 2 + Math.random() * 4,
      op: 0.3 + Math.random() * 0.5,
      color: colors[i % colors.length],
      isLightning: type === "electric" && Math.random() < 0.3,
    };
  }), [type, count]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {ps.map(p => (
        p.isLightning ? (
          // Lightning bolt particles
          <div key={p.id} className="absolute text-yellow-300 font-bold text-xs"
            style={{
              left: `${p.left}%`, top: `${10 + Math.random() * 70}%`,
              opacity: p.op,
              animation: `dlg-lightning ${p.dur}s ${p.delay}s infinite`,
              fontSize: `${8 + Math.random() * 12}px`,
            }}>⚡</div>
        ) : (
          <div key={p.id} className="absolute rounded-full"
            style={{
              left: `${p.left}%`, bottom: "-3%",
              width: p.size, height: p.size,
              backgroundColor: p.color,
              boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
              opacity: p.op,
              animation: `dlg-particle-up ${p.dur}s ${p.delay}s infinite linear`,
            }} />
        )
      ))}
      <style>{`
        @keyframes dlg-particle-up {
          0%{transform:translateY(0);opacity:0}
          10%{opacity:.6}
          100%{transform:translateY(-110vh);opacity:0}
        }
        @keyframes dlg-lightning {
          0%,85%,100%{opacity:0}
          86%,88%,90%{opacity:.8}
          87%,89%{opacity:.1}
        }
      `}</style>
    </div>
  );
}

/* ════════════════════════════════════════════════
   SPRITE URLS
   ════════════════════════════════════════════════ */
const SPRITES = {
  raikou:  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/243.gif",
  entei:   "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/244.gif",
  suicune: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/245.gif",
  hooh:    "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/250.gif",
  hoohShiny: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/250.gif",
  kimono:  "https://play.pokemonshowdown.com/sprites/trainers/kimonogirl.png",
};

/* ════════════════════════════════════════════════
   QUIZ PASS SCENE
   ════════════════════════════════════════════════ */
export function QuizPassScene({ pseudo, score, total, onComplete }: {
  pseudo: string; score: number; total: number; onComplete: () => void;
}) {
  const lines: DialogueLine[] = [
    {
      speaker: "Satsuki",
      text: `${score} bonnes réponses sur ${total}… Remarquable, ${pseudo}.`,
      sceneSprite: SPRITES.kimono,
      sceneSpriteSize: "min(180px,36vw)",
      sceneSpriteFilter: "hue-rotate(0deg) drop-shadow(0 0 20px rgba(239,68,68,0.6))",
      sceneSpritePos: "left",
      color: "#ef4444",
      particles: "fire",
      bgGradient: "radial-gradient(ellipse at 30% 50%, #3d0808 0%, #1a0800 50%, #0a0400 100%)",
      speed: 28,
    },
    {
      speaker: "Tamao",
      text: "Ta connaissance de la ligue RPPLF est indéniable. Nous l'avions pressenti.",
      sceneSprite: SPRITES.kimono,
      sceneSpriteSize: "min(180px,36vw)",
      sceneSpriteFilter: "hue-rotate(240deg) drop-shadow(0 0 20px rgba(99,102,241,0.7))",
      sceneSpritePos: "right",
      color: "#6366f1",
      particles: "none",
      bgGradient: "radial-gradient(ellipse at 70% 50%, #1a0830 0%, #0d0820 50%, #050810 100%)",
      speed: 28,
    },
    {
      speaker: "Koume",
      text: "La Tour Cendrée t'attend. Les trois bêtes légendaires gardent le passage.",
      sceneSprite: SPRITES.kimono,
      sceneSpriteSize: "min(180px,36vw)",
      sceneSpriteFilter: "hue-rotate(50deg) drop-shadow(0 0 20px rgba(245,158,11,0.7))",
      sceneSpritePos: "left",
      color: "#f59e0b",
      particles: "fire",
      bgGradient: "radial-gradient(ellipse at 30% 50%, #2d1800 0%, #1a0c00 50%, #0a0500 100%)",
      speed: 28,
    },
    {
      speaker: "Sakura",
      text: "Raikou la foudre, Entei le volcan, Suicune les eaux sacrées… Seul un vrai champion peut les vaincre.",
      sceneSprite: SPRITES.kimono,
      sceneSpriteSize: "min(180px,36vw)",
      sceneSpriteFilter: "hue-rotate(300deg) drop-shadow(0 0 20px rgba(236,72,153,0.7))",
      sceneSpritePos: "right",
      color: "#ec4899",
      particles: "none",
      bgGradient: "radial-gradient(ellipse at 70% 50%, #2d0820 0%, #1a0510 50%, #0a0408 100%)",
      speed: 26,
    },
    {
      speaker: "Miki",
      text: "Et si tu triomphes de ces trois gardiens… Ho-Oh lui-même descendra des cieux.",
      sceneSprite: SPRITES.hooh,
      sceneSpriteSize: "min(200px,40vw)",
      sceneSpriteFilter: "drop-shadow(0 0 30px rgba(245,158,11,0.7)) brightness(1.1)",
      sceneSpritePos: "center",
      color: "#3b82f6",
      particles: "divine",
      bgGradient: "radial-gradient(ellipse at 50% 30%, #1a1200 0%, #0a0800 50%, #050400 100%)",
      speed: 26,
      sceneSpriteAnim: "float",
    },
    {
      speaker: "Les Cinq Sœurs",
      text: "BONNE CHANCE, DRESSEUR. Que les flammes sacrées guident ton chemin !",
      sceneSprite: SPRITES.hooh,
      sceneSpriteSize: "min(240px,48vw)",
      sceneSpriteFilter: "drop-shadow(0 0 40px rgba(245,158,11,0.9)) brightness(1.3) saturate(1.5)",
      sceneSpritePos: "center",
      color: "#f59e0b",
      particles: "fire",
      bgGradient: "radial-gradient(ellipse at 50% 20%, #2d1208 0%, #1a0800 50%, #0a0400 100%)",
      speed: 20,
      flash: "rgba(245,158,11,0.25)",
      sceneSpriteAnim: "pulse",
    },
  ];

  return <DialogueScene lines={lines} onComplete={onComplete} defaultBg="radial-gradient(ellipse at 50% 30%, #2d1208, #0a0400)" />;
}

/* ════════════════════════════════════════════════
   QUIZ FAIL SCENE
   ════════════════════════════════════════════════ */
export function QuizFailScene({ pseudo, score, total, onComplete }: {
  pseudo: string; score: number; total: number; onComplete: () => void;
}) {
  const lines: DialogueLine[] = [
    {
      speaker: "Satsuki",
      text: `${score} sur ${total}… Ce n'est pas suffisant, ${pseudo}.`,
      sceneSprite: SPRITES.kimono,
      sceneSpriteSize: "min(180px,36vw)",
      sceneSpriteFilter: "hue-rotate(0deg) drop-shadow(0 0 16px rgba(239,68,68,0.4)) brightness(0.7)",
      sceneSpritePos: "left",
      color: "#ef4444",
      particles: "none",
      bgGradient: "radial-gradient(ellipse at 30% 50%, #1a0400 0%, #0a0200 50%, #000 100%)",
      speed: 32,
    },
    {
      speaker: "Tamao",
      text: "La Tour Cendrée n'est pas un endroit pour les imprudents. La connaissance est une armure.",
      sceneSprite: SPRITES.kimono,
      sceneSpriteSize: "min(180px,36vw)",
      sceneSpriteFilter: "hue-rotate(240deg) drop-shadow(0 0 16px rgba(99,102,241,0.4)) brightness(0.7)",
      sceneSpritePos: "right",
      color: "#6366f1",
      particles: "none",
      bgGradient: "radial-gradient(ellipse at 70% 50%, #0d0820 0%, #050810 100%)",
      speed: 30,
    },
    {
      speaker: "Miki",
      text: "Reviens quand tu seras prêt. Les bêtes t'attendront.",
      sceneSprite: SPRITES.kimono,
      sceneSpriteSize: "min(180px,36vw)",
      sceneSpriteFilter: "hue-rotate(190deg) drop-shadow(0 0 16px rgba(56,189,248,0.4)) brightness(0.7)",
      sceneSpritePos: "left",
      color: "#3b82f6",
      particles: "none",
      bgGradient: "radial-gradient(ellipse at 30% 50%, #081828 0%, #040c14 100%)",
      speed: 30,
    },
  ];

  return <DialogueScene lines={lines} onComplete={onComplete} defaultBg="radial-gradient(ellipse at 50% 30%, #1a0800, #000)" />;
}

/* ════════════════════════════════════════════════
   BEASTS INTRO SCENE
   Chaque bête apparaît à son tour
   ════════════════════════════════════════════════ */
export function BeastsIntroScene({ pseudo, onComplete }: {
  pseudo: string; onComplete: () => void;
}) {
  const lines: DialogueLine[] = [
    {
      speaker: "???",
      text: "…",
      sceneSprite: SPRITES.raikou,
      sceneSpriteSize: "min(260px,52vw)",
      sceneSpriteFilter: "drop-shadow(0 0 40px rgba(251,191,36,0.8)) brightness(1.2)",
      sceneSpritePos: "center",
      color: "#fbbf24",
      particles: "electric",
      bgGradient: "radial-gradient(ellipse at 50% 40%, #1a1400 0%, #0f0c00 50%, #000 100%)",
      speed: 80,
      pause: 1200,
      sceneSpriteAnim: "float",
    },
    {
      speaker: "RAIKOU",
      text: `GROOAARR !!! Tu oses fouler ce sanctuaire, ${pseudo} ?`,
      sceneSprite: SPRITES.raikou,
      sceneSpriteSize: "min(280px,56vw)",
      sceneSpriteFilter: "drop-shadow(0 0 50px rgba(251,191,36,1)) brightness(1.4) saturate(1.5)",
      sceneSpritePos: "center",
      color: "#fbbf24",
      particles: "electric",
      bgGradient: "radial-gradient(ellipse at 50% 30%, #2a2000 0%, #1a1400 50%, #000 100%)",
      speed: 22,
      shake: true,
      flash: "rgba(251,191,36,0.4)",
      sceneSpriteAnim: "roar",
    },
    {
      speaker: "ENTEI",
      text: "Nous sommes les Trois Gardiens de la Tour Cendrée. Nul ne passe sans nous affronter.",
      sceneSprite: SPRITES.entei,
      sceneSpriteSize: "min(280px,56vw)",
      sceneSpriteFilter: "drop-shadow(0 0 50px rgba(239,68,68,0.9)) brightness(1.3) saturate(1.4)",
      sceneSpritePos: "center",
      color: "#ef4444",
      particles: "fire",
      bgGradient: "radial-gradient(ellipse at 50% 30%, #2a0800 0%, #1a0500 50%, #0a0200 100%)",
      speed: 26,
      sceneSpriteAnim: "float",
    },
    {
      speaker: "SUICUNE",
      text: "Prouve ta valeur, Dresseur. Bats-nous tous les trois… ou rentre chez toi.",
      sceneSprite: SPRITES.suicune,
      sceneSpriteSize: "min(280px,56vw)",
      sceneSpriteFilter: "drop-shadow(0 0 50px rgba(56,189,248,0.9)) brightness(1.2) saturate(1.3)",
      sceneSpritePos: "center",
      color: "#38bdf8",
      particles: "water",
      bgGradient: "radial-gradient(ellipse at 50% 30%, #081828 0%, #050f1a 50%, #020810 100%)",
      speed: 26,
      sceneSpriteAnim: "float",
    },
    {
      speaker: "RAIKOU",
      text: "EN GARDE !!!",
      sceneSprite: SPRITES.raikou,
      sceneSpriteSize: "min(300px,60vw)",
      sceneSpriteFilter: "drop-shadow(0 0 60px rgba(251,191,36,1)) brightness(1.6) saturate(2)",
      sceneSpritePos: "center",
      color: "#fbbf24",
      particles: "electric",
      bgGradient: "radial-gradient(ellipse at 50% 30%, #3a2800 0%, #1a1400 50%, #000 100%)",
      speed: 15,
      shake: true,
      flash: "rgba(251,191,36,0.6)",
      sceneSpriteAnim: "roar",
    },
  ];

  return <DialogueScene lines={lines} onComplete={onComplete} skipable={true} defaultBg="radial-gradient(ellipse at 50% 30%, #1a1200, #000)" />;
}

/* ════════════════════════════════════════════════
   BEASTS VICTORY SCENE
   ════════════════════════════════════════════════ */
export function BeastsVictoryScene({ pseudo, onComplete }: {
  pseudo: string; onComplete: () => void;
}) {
  const lines: DialogueLine[] = [
    {
      speaker: "RAIKOU",
      text: "...... Impressionnant.",
      sceneSprite: SPRITES.raikou,
      sceneSpriteSize: "min(240px,48vw)",
      sceneSpriteFilter: "drop-shadow(0 0 30px rgba(251,191,36,0.6)) brightness(0.9)",
      sceneSpritePos: "left",
      color: "#fbbf24",
      particles: "electric",
      bgGradient: "radial-gradient(ellipse at 30% 50%, #1a1400 0%, #0a0900 50%, #000 100%)",
      speed: 40,
      pause: 800,
      sceneSpriteAnim: "float",
    },
    {
      speaker: "ENTEI",
      text: `Tu as vaincu les Trois Gardiens, ${pseudo}. Peu y sont parvenus.`,
      sceneSprite: SPRITES.entei,
      sceneSpriteSize: "min(240px,48vw)",
      sceneSpriteFilter: "drop-shadow(0 0 30px rgba(239,68,68,0.6))",
      sceneSpritePos: "right",
      color: "#ef4444",
      particles: "fire",
      bgGradient: "radial-gradient(ellipse at 70% 50%, #1a0800 0%, #0a0400 50%, #050200 100%)",
      speed: 26,
      sceneSpriteAnim: "float",
    },
    {
      speaker: "SUICUNE",
      text: "La Tour Cendrée s'ouvre devant toi. Mais ce qui t'attend au sommet…",
      sceneSprite: SPRITES.suicune,
      sceneSpriteSize: "min(240px,48vw)",
      sceneSpriteFilter: "drop-shadow(0 0 30px rgba(56,189,248,0.7))",
      sceneSpritePos: "left",
      color: "#38bdf8",
      particles: "water",
      bgGradient: "radial-gradient(ellipse at 30% 50%, #081828 0%, #040c14 50%, #020810 100%)",
      speed: 26,
      sceneSpriteAnim: "float",
    },
    {
      speaker: "ENTEI",
      text: "… dépasse tout ce que tu as jamais affronté.",
      sceneSprite: SPRITES.entei,
      sceneSpriteSize: "min(240px,48vw)",
      sceneSpriteFilter: "drop-shadow(0 0 30px rgba(239,68,68,0.5))",
      sceneSpritePos: "right",
      color: "#ef4444",
      particles: "none",
      bgGradient: "radial-gradient(ellipse at 70% 50%, #1a0800 0%, #0a0400 100%)",
      speed: 28,
    },
    {
      speaker: "RAIKOU",
      text: "HO-OH t'attend, Dresseur. Montre-lui ce dont tu es capable.",
      sceneSprite: SPRITES.hooh,
      sceneSpriteSize: "min(260px,52vw)",
      sceneSpriteFilter: "drop-shadow(0 0 50px rgba(245,158,11,0.8)) brightness(1.2)",
      sceneSpritePos: "center",
      color: "#fbbf24",
      particles: "divine",
      bgGradient: "radial-gradient(ellipse at 50% 20%, #2d1208 0%, #1a0800 50%, #0a0400 100%)",
      speed: 24,
      flash: "rgba(255,255,255,0.15)",
      sceneSpriteAnim: "float",
    },
  ];

  return <DialogueScene lines={lines} onComplete={onComplete} defaultBg="radial-gradient(ellipse at 50% 30%, #1a0800, #000)" />;
}

/* ════════════════════════════════════════════════
   HO-OH INTRO SCENE
   ════════════════════════════════════════════════ */
export function HoOhIntroScene({ pseudo, onComplete }: {
  pseudo: string; onComplete: () => void;
}) {
  const lines: DialogueLine[] = [
    {
      speaker: "???",
      text: "…",
      sceneSprite: SPRITES.hooh,
      sceneSpriteSize: "min(240px,48vw)",
      sceneSpriteFilter: "drop-shadow(0 0 40px rgba(245,158,11,0.6)) brightness(0.8)",
      sceneSpritePos: "center",
      color: "#f59e0b",
      particles: "fire",
      bgGradient: "radial-gradient(ellipse at 50% 30%, #1a1000 0%, #0f0800 50%, #000 100%)",
      speed: 100,
      pause: 2000,
      sceneSpriteAnim: "float",
    },
    {
      speaker: "HO-OH",
      text: `Tu as traversé l'épreuve des Danseuses… Vaincu les Trois Gardiens… Ton courage est indéniable, ${pseudo}.`,
      sceneSprite: SPRITES.hooh,
      sceneSpriteSize: "min(260px,52vw)",
      sceneSpriteFilter: "drop-shadow(0 0 50px rgba(245,158,11,0.8)) brightness(1.1)",
      sceneSpritePos: "center",
      color: "#f59e0b",
      particles: "fire",
      bgGradient: "radial-gradient(ellipse at 50% 20%, #2d1208 0%, #1a0800 50%, #0a0400 100%)",
      speed: 26,
      flash: "rgba(245,158,11,0.12)",
      sceneSpriteAnim: "float",
    },
    {
      speaker: "HO-OH",
      text: "Mais la sagesse des Anciens ne s'obtient pas par la force seule. Je vais te mettre à l'épreuve.",
      sceneSprite: SPRITES.hooh,
      sceneSpriteSize: "min(260px,52vw)",
      sceneSpriteFilter: "drop-shadow(0 0 40px rgba(245,158,11,0.7))",
      sceneSpritePos: "center",
      color: "#f59e0b",
      particles: "divine",
      bgGradient: "radial-gradient(ellipse at 50% 20%, #2d1208 0%, #1a0800 50%, #0a0400 100%)",
      speed: 24,
    },
    {
      speaker: "HO-OH",
      text: "Si tu me bats, je reconnaîtrai ta valeur. Mais si tu échoues… tu repartiras les mains vides.",
      sceneSprite: SPRITES.hooh,
      sceneSpriteSize: "min(260px,52vw)",
      sceneSpriteFilter: "drop-shadow(0 0 40px rgba(239,68,68,0.6)) hue-rotate(10deg)",
      sceneSpritePos: "center",
      color: "#ef4444",
      particles: "fire",
      bgGradient: "radial-gradient(ellipse at 50% 20%, #2a0800 0%, #1a0400 50%, #0a0200 100%)",
      speed: 24,
    },
    {
      speaker: "HO-OH",
      text: "PRÉPARE-TOI !!!",
      sceneSprite: SPRITES.hooh,
      sceneSpriteSize: "min(300px,60vw)",
      sceneSpriteFilter: "drop-shadow(0 0 60px rgba(245,158,11,1)) brightness(1.5) saturate(2)",
      sceneSpritePos: "center",
      color: "#fbbf24",
      particles: "divine",
      bgGradient: "radial-gradient(ellipse at 50% 10%, #3d2000 0%, #1a0e00 50%, #050400 100%)",
      speed: 14,
      shake: true,
      flash: "rgba(245,158,11,0.6)",
      sceneSpriteAnim: "roar",
    },
  ];

  return <DialogueScene lines={lines} onComplete={onComplete} skipable={false} defaultBg="radial-gradient(ellipse at 50% 30%, #2d1208, #0a0400)" />;
}

/* ════════════════════════════════════════════════
   HO-OH RAGE SCENE (Phase 2)
   ════════════════════════════════════════════════ */
export function HoOhRageScene({ onComplete }: { onComplete: () => void }) {
  const lines: DialogueLine[] = [
    {
      speaker: "HO-OH",
      text: "……Kkraaah !",
      sceneSprite: SPRITES.hoohShiny,
      sceneSpriteSize: "min(260px,52vw)",
      sceneSpriteFilter: "drop-shadow(0 0 40px rgba(220,0,0,0.9)) hue-rotate(340deg) saturate(2) brightness(1.2)",
      sceneSpritePos: "center",
      color: "#ef4444",
      particles: "fire",
      bgGradient: "radial-gradient(ellipse at 50% 30%, #2a0000 0%, #1a0000 50%, #0a0000 100%)",
      speed: 28,
      shake: true,
      flash: "rgba(220,0,0,0.45)",
      sceneSpriteAnim: "roar",
    },
    {
      speaker: "HO-OH",
      text: "Tu m'as blessé… Longtemps que cela ne m'était arrivé. Je dois te reconnaître comme adversaire.",
      sceneSprite: SPRITES.hoohShiny,
      sceneSpriteSize: "min(260px,52vw)",
      sceneSpriteFilter: "drop-shadow(0 0 35px rgba(220,30,30,0.8)) hue-rotate(340deg) saturate(1.8)",
      sceneSpritePos: "center",
      color: "#ef4444",
      particles: "fire",
      bgGradient: "radial-gradient(ellipse at 50% 30%, #2a0000 0%, #1a0000 50%, #0a0000 100%)",
      speed: 24,
    },
    {
      speaker: "HO-OH",
      text: "Mais tu n'as encore rien vu. Les flammes de ma VRAIE puissance vont t'engloutir !",
      sceneSprite: SPRITES.hoohShiny,
      sceneSpriteSize: "min(300px,60vw)",
      sceneSpriteFilter: "drop-shadow(0 0 60px rgba(220,0,0,1)) hue-rotate(340deg) saturate(2.5) brightness(1.4)",
      sceneSpritePos: "center",
      color: "#dc2626",
      particles: "fire",
      bgGradient: "radial-gradient(ellipse at 50% 20%, #3a0000 0%, #200000 50%, #0a0000 100%)",
      speed: 20,
      shake: true,
      flash: "rgba(220,0,0,0.6)",
      sceneSpriteAnim: "roar",
    },
  ];

  return <DialogueScene lines={lines} onComplete={onComplete} skipable={false} defaultBg="radial-gradient(ellipse at 50% 30%, #2a0000, #000)" />;
}

/* ════════════════════════════════════════════════
   HO-OH DIVINE SCENE (Phase 3)
   ════════════════════════════════════════════════ */
export function HoOhDivineScene({ onComplete }: { onComplete: () => void }) {
  const lines: DialogueLine[] = [
    {
      speaker: "HO-OH",
      text: "…C'est impossible.",
      sceneSprite: SPRITES.hooh,
      sceneSpriteSize: "min(260px,52vw)",
      sceneSpriteFilter: "drop-shadow(0 0 40px rgba(251,191,36,0.7)) brightness(0.9)",
      sceneSpritePos: "center",
      color: "#fbbf24",
      particles: "divine",
      bgGradient: "linear-gradient(180deg, #000 0%, #0a0800 50%, #0f0900 100%)",
      speed: 40,
      pause: 1200,
    },
    {
      speaker: "HO-OH",
      text: "Tu as brisé mes deux premières formes. En des siècles d'existence… je n'ai connu cela qu'une seule fois.",
      sceneSprite: SPRITES.hooh,
      sceneSpriteSize: "min(270px,54vw)",
      sceneSpriteFilter: "drop-shadow(0 0 50px rgba(251,191,36,0.85)) brightness(1.1)",
      sceneSpritePos: "center",
      color: "#fbbf24",
      particles: "divine",
      bgGradient: "linear-gradient(180deg, #000 0%, #0a0800 50%, #0f0900 100%)",
      speed: 22,
    },
    {
      speaker: "HO-OH",
      text: "Alors soit. Je t'accorderai ce privilège ultime.",
      sceneSprite: SPRITES.hooh,
      sceneSpriteSize: "min(270px,54vw)",
      sceneSpriteFilter: "drop-shadow(0 0 50px rgba(251,191,36,0.9)) brightness(1.2)",
      sceneSpritePos: "center",
      color: "#f59e0b",
      particles: "divine",
      bgGradient: "radial-gradient(ellipse at 50% 20%, #1a1200 0%, #0a0800 50%, #000 100%)",
      speed: 26,
    },
    {
      speaker: "HO-OH",
      text: "MA FORME DIVINE. Que les cieux tremblent !",
      sceneSprite: SPRITES.hooh,
      sceneSpriteSize: "min(320px,64vw)",
      sceneSpriteFilter: "drop-shadow(0 0 80px rgba(255,220,0,1)) brightness(1.8) saturate(2.5) hue-rotate(5deg)",
      sceneSpritePos: "center",
      color: "#fbbf24",
      particles: "divine",
      bgGradient: "radial-gradient(ellipse at 50% 10%, #2d2000 0%, #1a1200 50%, #050400 100%)",
      speed: 15,
      shake: true,
      flash: "rgba(255,255,255,0.85)",
      sceneSpriteAnim: "roar",
    },
  ];

  return <DialogueScene lines={lines} onComplete={onComplete} skipable={false} defaultBg="linear-gradient(180deg, #000, #0a0800)" />;
}