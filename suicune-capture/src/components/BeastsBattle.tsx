"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { fetchPokemonData, type PokemonData } from "../lib/pokeApi";
import { calculateDamage, calculateMaxHP, getEffectiveness, pickMovesForPokemon, canMoveWithParalysis, burnDamage, TYPE_COLORS, BEAST_CONFIGS, ITEMS, EV_SPREADS, type Move, type PokemonType, type StatusState, type Item, type EVSpread } from "../lib/battleSystem";
import { TeamBuilder, type TeamMemberConfig, type TeamBuilderMember } from "./TeamBuilder";
import { updateLiveBattle, submitBeastsResult } from "../hooks/useEvent";
import { BeastsIntroScene, BeastsVictoryScene } from "./DialogueScene";
import type { Player, PlayerPokemon } from "../lib/playerRoster";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
type Phase = "loading"|"intro_scene"|"builder"|"team_select"|"battle"|"victory_scene"|"victory"|"defeat";

interface TeamMember { pokemon: PlayerPokemon; data: PokemonData; currentHP: number; maxHP: number; fainted: boolean; moves: Move[]; status: StatusState; item: Item; evSpread: EVSpread; itemUsed: boolean; }
interface BeastState { config: typeof BEAST_CONFIGS[0]; hp: number; maxHP: number; status: StatusState; defeated: boolean; }
interface QueuedAction { slotIdx: number; teamIdx: number; moveIdx: number; targetBeast: number; }

export function BeastsBattle({ pseudo, player, onComplete }: { pseudo: string; player: Player; onComplete: (passed: boolean, defeated: number) => void; }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [team, setTeam] = useState<TeamMember[]>([]);
  const teamRef = useRef<TeamMember[]>([]); useEffect(() => { teamRef.current = team; }, [team]);
  const [activeSlots, setActiveSlots] = useState<(number|null)[]>([null,null,null]);
  const [turnQueue, setTurnQueue] = useState<QueuedAction[]>([]);
  const [pickingSlot, setPickingSlot] = useState<number|null>(null);
  const [pickingMove, setPickingMove] = useState<number|null>(null);
  const [beasts, setBeasts] = useState<BeastState[]>(BEAST_CONFIGS.map(c => ({ config: c, hp: c.maxHP, maxHP: c.maxHP, status: { status: null }, defeated: false })));
  const beastsRef = useRef(beasts); useEffect(() => { beastsRef.current = beasts; }, [beasts]);
  const activeSlotsRef = useRef<(number|null)[]>([null,null,null]);
  useEffect(() => { activeSlotsRef.current = activeSlots; }, [activeSlots]);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement|null>(null);

  useEffect(() => { const a = audioRef.current; if (!a) return; if ((phase==="battle"||phase==="team_select")&&musicEnabled) { a.volume=.25; a.loop=true; a.play().catch(()=>{}); } else a.pause(); }, [phase, musicEnabled]);
  useEffect(() => { (async () => { const td: TeamMember[] = []; for (const p of player.team) { const data = await fetchPokemonData(p.name); if (data) { const p100 = { ...p, level: 100 }; const maxHP = calculateMaxHP(100, data.baseHP); td.push({ pokemon: p100, data, currentHP: maxHP, maxHP, fainted: false, moves: pickMovesForPokemon(data.types), status: { status: null }, item: ITEMS[0], evSpread: EV_SPREADS[0], itemUsed: false }); } } setTeam(td); setPhase("intro_scene"); })(); }, [player]);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  // Helper — envoie l'état du combat en live au panel admin
  const sendLiveUpdate = useCallback((lastAction: string, status: "in_battle"|"victory"|"defeat" = "in_battle") => {
    const bs = beastsRef.current;
    const tm = teamRef.current;
    // Beast avec le moins de HP (pas encore vaincu) = le plus intéressant à montrer
    const activeBeast = bs.find(b => !b.defeated) ?? bs[0];
    // Pokémon joueur actif (premier non K.O.)
    const activePlayer = tm.find(m => !m.fainted);
    updateLiveBattle({
      pseudo,
      pokemon: "beasts",
      battlePhase: "beasts",
      status,
      currentBeast: activeBeast?.config.name ?? null,
      raikouHP: activeBeast?.hp ?? 0,
      raikouMaxHP: activeBeast?.maxHP ?? 1,
      currentPokemon: activePlayer?.pokemon.name ?? null,
      currentPokemonHP: activePlayer?.currentHP ?? 0,
      currentPokemonMaxHP: activePlayer?.maxHP ?? 1,
      beastsDefeated: bs.filter(b => b.defeated).length,
      lastAction,
      log: [lastAction],
    });
  }, [pseudo]);


  const aliveActiveSlots = useMemo(() => activeSlots.map((idx, si) => ({ si, idx })).filter(({ idx }) => idx !== null && team[idx!] && !team[idx!].fainted), [activeSlots, team]);
  const beastsDefeated = useMemo(() => beasts.filter(b => b.defeated).length, [beasts]);

  const selectTeam = useCallback((indices: number[]) => {
    setActiveSlots([indices[0]??null, indices[1]??null, indices[2]??null]);
    setLog(["Le Trio Légendaire apparaît !", "Chacun de vos Pokémon doit choisir une action !"]);
    setPhase("battle"); setBusy(false); setTurnQueue([]); setPickingSlot(null); setPickingMove(null);
    setTimeout(() => sendLiveUpdate("Combat 3v3 commencé !"), 500);
  }, []);

  const startNewTurn = useCallback(() => { setTurnQueue([]); setPickingSlot(null); setPickingMove(null); setBusy(false); setLog(l => [...l, "Choisissez les actions de vos Pokémon !"]); }, []);
  const queueAction = useCallback((slotIdx: number, teamIdx: number, moveIdx: number, targetBeast: number) => { setTurnQueue(q => [...q, { slotIdx, teamIdx, moveIdx, targetBeast }]); setPickingSlot(null); setPickingMove(null); }, []);

  useEffect(() => { if (busy || phase !== "battle") return; const needed = aliveActiveSlots.length; if (needed > 0 && turnQueue.length >= needed) executeTurn(); }, [turnQueue.length, aliveActiveSlots.length, busy, phase]);

  const executeTurn = useCallback(async () => {
    setBusy(true);

    // ═══ BEASTS ATTACK FIRST ═══
    setLog(["— Le Trio attaque ! —"]);
    await sleep(500);
    for (let bi = 0; bi < beastsRef.current.length; bi++) {
      const beast = beastsRef.current[bi]; if (beast.defeated) continue;
      if (beast.status.status === "paralysis" && !canMoveWithParalysis()) { setLog(l => [...l, `${beast.config.displayName} est paralysé !`]); await sleep(600); continue; }
      const targets = activeSlots.map((idx, si) => ({ si, idx })).filter(({ idx }) => idx !== null && teamRef.current[idx!] && !teamRef.current[idx!].fainted);
      if (targets.length === 0) break;
      const target = targets[Math.floor(Math.random() * targets.length)];
      const tm = teamRef.current[target.idx!]; if (!tm) continue;
      const moves = beast.config.moves.filter(m => m.power > 0);
      const move = moves[Math.floor(Math.random() * moves.length)] || beast.config.moves[0];
      const eff = getEffectiveness(move.type, tm.data.types);
      const stab = beast.config.types.includes(move.type);
      let damage = eff === 0 ? 0 : calculateDamage(beast.config.level, move.power, eff, stab);
      if (damage > 0 && tm) {
        damage = Math.floor(damage * tm.evSpread.defMult);
        if (tm.item.effect === "assaultvest") damage = Math.floor(damage * 0.75);
      }
      setLog(l => [...l, `${beast.config.displayName} → ${move.name} sur ${tm.pokemon.name.toUpperCase()} !`]);
      sendLiveUpdate(`${beast.config.displayName} → ${move.name}`);
      await sleep(500);
      if (eff === 0) { setLog(l => [...l, "Ça n'affecte pas !"]); await sleep(400); continue; }
      const effMsg = eff > 1 ? " Super efficace !" : eff < 1 ? " Pas très efficace…" : "";
      const newHP = Math.max(0, tm.currentHP - damage);
      setTeam(prev => prev.map((m, i) => i === target.idx! ? { ...m, currentHP: newHP, fainted: newHP <= 0 } : m));
      setLog(l => [...l, `${damage} dégâts !${effMsg}`]);
      await sleep(400);
      if (move.effect && move.effectChance && Math.random() < move.effectChance && tm.status.status === null) {
        const ok = !(move.effect === "burn" && tm.data.types.includes("Feu")) && !(move.effect === "paralysis" && tm.data.types.includes("Électrik"));
        if (ok) { setTeam(prev => prev.map((m, i) => i === target.idx! ? { ...m, status: { status: move.effect! } } : m)); setLog(l => [...l, `${tm.pokemon.name.toUpperCase()} est ${move.effect === "burn" ? "brûlé" : "paralysé"} !`]); await sleep(400); }
      }
      if (newHP <= 0) {
        setLog(l => [...l, `${tm.pokemon.name.toUpperCase()} est K.O. !`]); await sleep(600);
        // Use ref to get current activeSlots — prevents assigning same pokemon to multiple slots
        const currentSlots = activeSlotsRef.current;
        const reserve = teamRef.current.findIndex((m, i) => !m.fainted && !currentSlots.includes(i));
        if (reserve >= 0) {
          const newSlots = currentSlots.map(idx => idx === target.idx! ? reserve : idx);
          activeSlotsRef.current = newSlots; // update ref immediately
          setActiveSlots(newSlots);
          setLog(l => [...l, `${teamRef.current[reserve].pokemon.name.toUpperCase()} entre en jeu !`]);
          await sleep(400);
        } else {
          const newSlots = currentSlots.map(idx => idx === target.idx! ? null : idx);
          activeSlotsRef.current = newSlots;
          setActiveSlots(newSlots);
        }
      }
    }
    // Check defeat after beasts attack
    const allDown1 = teamRef.current.every(m => m.fainted);
    if (allDown1) { setLog(l => [...l, "Toute votre équipe est K.O. !"]); sendLiveUpdate("Équipe K.O.", "defeat"); submitBeastsResult(pseudo, beastsRef.current.filter(b => b.defeated).length, false); await sleep(2000); setPhase("defeat"); return; }

    // ═══ PLAYER ATTACKS ═══
    setLog(l => [...l, "— Vos Pokémon ripostent ! —"]);
    await sleep(500);
    for (const action of turnQueue) {
      const attacker = teamRef.current[action.teamIdx]; if (!attacker || attacker.fainted) continue;
      let ti = action.targetBeast;
      if (beastsRef.current[ti]?.defeated) { const next = beastsRef.current.findIndex(b => !b.defeated); if (next < 0) break; ti = next; }
      const tb = beastsRef.current[ti]; if (!tb || tb.defeated) continue;
      if (attacker.status.status === "paralysis" && !canMoveWithParalysis()) { setLog(l => [...l, `${attacker.pokemon.name.toUpperCase()} est paralysé !`]); await sleep(500); continue; }
      const move = attacker.moves[action.moveIdx];
      const stab = attacker.data.types.includes(move.type);
      const eff = getEffectiveness(move.type, tb.config.types);
      const damage = eff === 0 ? 0 : calculateDamage(attacker.pokemon.level, move.power, eff, stab);
      setLog(l => [...l, `${attacker.pokemon.name.toUpperCase()} → ${move.name} sur ${tb.config.displayName} !`]);
      sendLiveUpdate(`${attacker.pokemon.name} → ${move.name} sur ${tb.config.displayName}`);
      await sleep(500);
      if (eff === 0) { setLog(l => [...l, "Ça n'affecte pas !"]); await sleep(400); continue; }
      const effMsg = eff > 1 ? " Super efficace !" : eff < 1 ? " Pas très efficace…" : "";
      const newHP = Math.max(0, tb.hp - damage);
      setBeasts(prev => prev.map((b, i) => i === ti ? { ...b, hp: newHP, defeated: newHP <= 0 } : b));
      setLog(l => [...l, `${damage} dégâts !${effMsg}`]); await sleep(400);
      if (newHP <= 0) { setLog(l => [...l, `${tb.config.displayName} est vaincu !`]); await sleep(700); }
      if (attacker.status.status === "burn") { const d = burnDamage(attacker.maxHP); const h = Math.max(0, attacker.currentHP - d); setTeam(prev => prev.map((m, i) => i === action.teamIdx ? { ...m, currentHP: h, fainted: h <= 0 } : m)); setLog(l => [...l, `Brûlure ! -${d}`]); await sleep(300); }
    }

    if (beastsRef.current.every(b => b.defeated)) {
      setLog(l => [...l, "Le Trio Légendaire est vaincu !"]);
      sendLiveUpdate("Trio Légendaire vaincu !", "victory");
      await sleep(2000); setPhase("victory_scene"); return;
    }
    const allDown2 = teamRef.current.every(m => m.fainted);
    if (allDown2) { setLog(l => [...l, "Toute votre équipe est K.O. !"]); sendLiveUpdate("Équipe K.O.", "defeat"); submitBeastsResult(pseudo, beastsRef.current.filter(b => b.defeated).length, false); await sleep(2000); setPhase("defeat"); return; }

    sendLiveUpdate("Tour terminé");
    startNewTurn();
  }, [turnQueue, activeSlots, pseudo, startNewTurn]);

  const handleBuilderConfirm = useCallback((configs: TeamMemberConfig[]) => {
    setTeam(prev => prev.map((m, i) => {
      const cfg = configs[i];
      if (!cfg) return m;
      const newMaxHP = Math.floor(m.maxHP * cfg.evSpread.hpMult);
      return { ...m, moves: cfg.moves, item: cfg.item, evSpread: cfg.evSpread, maxHP: newMaxHP, currentHP: newMaxHP, itemUsed: false };
    }));
    setPhase("team_select");
  }, []);

  const audioEl = <audio ref={audioRef} src={`${BASE_PATH}/audio/beasts-theme.mp3`} preload="auto" />;
  if (phase === "intro_scene") return (
    <BeastsIntroScene pseudo={pseudo} onComplete={() => setPhase("builder")} />
  );
  if (phase === "victory_scene") return (
    <BeastsVictoryScene pseudo={pseudo} onComplete={() => {
      submitBeastsResult(pseudo, 3, true);
      setPhase("victory");
    }} />
  );
  if (phase === "loading") return <>{audioEl}<div className="h-dvh w-full flex items-center justify-center" style={{ background: "radial-gradient(ellipse at 50% 30%, #1a0a2e, #0a0518)", fontFamily: "'Courier New', monospace" }}><p className="text-white/40 animate-pulse">Chargement…</p></div></>;
  if (phase === "builder") return <TeamBuilder
    team={team.map(m => ({ pokemon: m.pokemon, data: m.data, maxHP: m.maxHP }))}
    title="Prépare ton équipe — 3v3 Légendaires"
    subtitle="Tu vas affronter Raikou, Entei et Suicune en simultané"
    onConfirm={handleBuilderConfirm}
  />;
  if (phase === "team_select") return <>{audioEl}<TeamPicker team={team} onSelect={selectTeam} pseudo={pseudo} musicEnabled={musicEnabled} setMusicEnabled={setMusicEnabled} /></>;
  if (phase === "victory") return <>{audioEl}<EndScreen type="victory" pseudo={pseudo} defeated={3} onClose={() => onComplete(true, 3)} /></>;
  if (phase === "defeat") return <>{audioEl}<EndScreen type="defeat" pseudo={pseudo} defeated={beastsDefeated} onClose={() => onComplete(false, beastsDefeated)} /></>;

  const queuedSlots = new Set(turnQueue.map(q => q.slotIdx));
  const hpCol = (p: number) => p > 50 ? "#22c55e" : p > 20 ? "#f59e0b" : "#ef4444";

  return (<>{audioEl}
    <div className="h-dvh w-full flex flex-col" style={{ fontFamily: "'Courier New', monospace", background: "#0a0518" }}>
      <div className="relative flex-1 overflow-hidden" style={{ background: "linear-gradient(180deg, #0a0520 0%, #1a0c35 25%, #2a1545 50%, #1a0c35 75%, #0f0825 100%)", minHeight: "50%" }}>
        {/* Night sky with stars */}
        <div className="absolute inset-0">{Array.from({ length: 40 }).map((_, i) => (<div key={i} className="absolute rounded-full" style={{ width: i%5===0?3:1.5, height: i%5===0?3:1.5, background: i%7===0?"#fbbf24":"#fff", top: `${Math.random()*45}%`, left: `${Math.random()*100}%`, opacity: Math.random()*.6+.2, boxShadow: i%5===0?`0 0 4px ${i%7===0?"#fbbf24":"#fff"}`:undefined, animation: `twk ${2+Math.random()*3}s ${Math.random()*2}s ease-in-out infinite` }} />))}</div>
        {/* Tin Tower silhouette */}
        <svg className="absolute bottom-0 left-0 right-0 w-full" viewBox="0 0 400 120" preserveAspectRatio="none" style={{ height: "25%" }}>
          <path d="M0 120 L0 90 L30 80 L50 90 L70 70 L90 85 L120 60 L135 70 L150 50 L165 65 L180 45 L195 60 L210 55 L225 65 L240 50 L260 70 L280 60 L300 75 L320 55 L340 70 L360 80 L380 65 L400 80 L400 120Z" fill="#0a0520" opacity=".9"/>
          <path d="M0 120 L0 100 L40 95 L80 100 L120 90 L160 100 L200 85 L240 95 L280 90 L320 95 L360 100 L400 90 L400 120Z" fill="#050310"/>
          {/* Tower shape center */}
          <rect x="185" y="30" width="30" height="90" fill="#0d0625" opacity=".8"/>
          <polygon points="185,30 200,10 215,30" fill="#0d0625" opacity=".8"/>
          <rect x="190" y="15" width="20" height="5" fill="#1a0a35" opacity=".6"/>
        </svg>
        {/* Ambient glow */}
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[400px] h-[200px] rounded-full pointer-events-none" style={{ background: "radial-gradient(ellipse, rgba(120,80,200,0.08), transparent 70%)", filter: "blur(40px)" }}/>

        {/* Beast progress bar */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-[#f8f0e0] border-[3px] border-black px-4 py-1.5" style={{ boxShadow: "3px 3px 0 #000" }}>
          <span className="text-[11px] font-bold">{beasts.map((b, i) => (<span key={i} style={{ color: b.defeated?"#22c55e":b.config.color, marginRight: i<2?8:0, textDecoration: b.defeated?"line-through":"none" }}>{b.config.displayName}</span>))}</span>
        </div>

        {/* 3 beasts — bigger sprites */}
        <div className="absolute top-[12%] left-0 right-0 flex justify-center gap-6 sm:gap-12 z-10">
          {beasts.map((b, i) => (
            <div key={i} className="text-center" style={{ opacity: b.defeated?.12:1, filter: b.defeated?"grayscale(1)":undefined }}>
              <div className="relative">
                {!b.defeated && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100px] h-[100px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${b.config.glowColor}, transparent 70%)`, filter: "blur(15px)" }}/>}
                <motion.img src={b.config.sprite} alt={b.config.name} animate={b.defeated?{}:{ y: [0,-5,0] }} transition={{ duration: 2+i*.3, repeat: Infinity }}
                  style={{ imageRendering: "pixelated", width: "min(80px, 20vw)", position: "relative", filter: b.defeated?"grayscale(1)":`drop-shadow(0 0 12px ${b.config.glowColor})` }}
                  onError={e => { e.currentTarget.style.display = "none"; }} />
              </div>
              {!b.defeated && <div className="mt-1.5 mx-auto" style={{ width: "70px" }}>
                <div className="text-[8px] font-bold mb-0.5" style={{ color: b.config.color }}>{b.config.displayName}</div>
                <div className="h-2 bg-black rounded-full overflow-hidden border border-white/20" style={{ padding: "1px" }}>
                  <div style={{ width: `${(b.hp/b.maxHP)*100}%`, height: "100%", background: hpCol((b.hp/b.maxHP)*100), transition: "width .4s", boxShadow: `0 0 4px ${hpCol((b.hp/b.maxHP)*100)}` }} />
                </div>
                <p className="text-[7px] font-bold text-white/60 mt-0.5">{b.hp}/{b.maxHP}</p>
              </div>}
              {b.defeated && <p className="text-[8px] text-gray-500 mt-1 font-bold">VAINCU</p>}
            </div>
          ))}
        </div>

        {/* Player pokemon — bigger, better positioned */}
        <div className="absolute bottom-[6%] left-0 right-0 flex justify-center gap-4 sm:gap-10 z-10">
          {activeSlots.map((teamIdx, slotIdx) => {
            if (teamIdx === null || !team[teamIdx] || team[teamIdx].fainted) return (<div key={slotIdx} style={{ width: "min(70px,18vw)" }} className="text-center"><div className="h-20 flex items-center justify-center"><span className="text-gray-700 text-[9px]">{teamIdx !== null && team[teamIdx]?.fainted?"K.O.":"—"}</span></div></div>);
            const m = team[teamIdx]; const isQ = queuedSlots.has(slotIdx); const isP = pickingSlot === slotIdx;
            return (<div key={slotIdx} className="text-center" style={{ outline: isP?`2px solid ${m.data.types[0]?TYPE_COLORS[m.data.types[0]]:"#fff"}`:isQ?"2px solid #22c55e":"none", outlineOffset: "4px", borderRadius: "4px" }}>
              <motion.div animate={{ y: [0,-3,0] }} transition={{ duration: 2, repeat: Infinity }}>
                {m.data.spriteAnimated ? <img src={m.data.spriteAnimated} alt={m.pokemon.name} style={{ imageRendering: "pixelated", width: "min(70px, 18vw)", transform: "scaleX(-1)", filter: "drop-shadow(0 4px 8px rgba(0,0,0,.5))" }} />
                : m.data.sprite ? <img src={m.data.sprite} alt="" style={{ width: "min(60px,16vw)", transform: "scaleX(-1)" }} /> : null}
              </motion.div>
              <div className="mt-1 mx-auto" style={{ width: "65px" }}>
                <div className="h-2 bg-black rounded-full overflow-hidden border border-white/20" style={{ padding: "1px" }}>
                  <div style={{ width: `${(m.currentHP/m.maxHP)*100}%`, height: "100%", background: hpCol((m.currentHP/m.maxHP)*100), transition: "width .4s" }} />
                </div>
                <p className="text-[7px] font-bold text-white mt-0.5">{m.pokemon.name.substring(0,8).toUpperCase()}</p>
                <p className="text-[6px] text-white/40">{m.currentHP}/{m.maxHP}</p>
              </div>
              {isQ && <p className="text-[7px] text-green-400 font-bold">✓</p>}
            </div>);
          })}
        </div>

        <button onClick={() => setMusicEnabled(m => !m)} className="absolute top-3 right-3 z-20 border-[3px] border-black bg-[#f8f0e0] px-2 py-1 text-sm font-bold" style={{ boxShadow: "3px 3px 0 #000" }}>{musicEnabled?"🔊":"🔇"}</button>
      </div>

      {/* Commands */}
      <div className="bg-[#f8f0e0] border-t-4 border-black" style={{ minHeight: "195px", padding: "10px 12px 12px" }}>
        <div className="bg-white border-[3px] border-black p-2.5 mb-2 relative" style={{ boxShadow: "4px 4px 0 #000", minHeight: "40px" }}>
          <div className="absolute top-0.5 left-0.5 right-0.5 bottom-0.5 border border-gray-300 pointer-events-none" />
          {log.slice(-2).map((l, i) => <p key={i} className="text-[12px] text-black font-bold" style={{ lineHeight: 1.4 }}>{l}</p>)}
        </div>

        {busy && <div className="text-center py-4"><p className="text-[11px] text-gray-600 font-bold animate-pulse">Combat en cours…</p></div>}

        {!busy && pickingSlot === null && pickingMove === null && (
          <div>
            <p className="text-[10px] text-gray-600 font-bold mb-1.5">Actions ({turnQueue.length}/{aliveActiveSlots.length}) :</p>
            <div className="grid grid-cols-3 gap-2">
              {activeSlots.map((teamIdx, slotIdx) => {
                if (teamIdx===null||!team[teamIdx]||team[teamIdx].fainted) return <div key={slotIdx} className="border-[3px] border-gray-300 p-2 text-center text-[9px] text-gray-400 bg-gray-100">—</div>;
                const m=team[teamIdx]; const done=queuedSlots.has(slotIdx);
                return (<button key={slotIdx} disabled={done} onClick={() => setPickingSlot(slotIdx)} className="border-[3px] border-black p-2 text-center hover:bg-[#ffe080] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-30" style={{ boxShadow: done?"none":"3px 3px 0 #000", background: done?"#d4edda":TYPE_COLORS[m.data.types[0]||"Normal"]+"30" }}><div className="text-[10px] font-bold text-black">{m.pokemon.name.substring(0,10).toUpperCase()}</div><div className="text-[8px] text-gray-700">{m.currentHP}/{m.maxHP}</div>{done && <div className="text-[8px] text-green-600 font-bold">✓</div>}</button>);
              })}
            </div>
          </div>
        )}
        {!busy && pickingSlot !== null && pickingMove === null && activeSlots[pickingSlot] !== null && team[activeSlots[pickingSlot]!] && (
          <div>
            <p className="text-[10px] text-gray-600 font-bold mb-1.5">{team[activeSlots[pickingSlot]!].pokemon.name.toUpperCase()} — Attaque :</p>
            <div className="grid grid-cols-2 gap-2">
              {team[activeSlots[pickingSlot]!].moves.map((m, i) => (<button key={i} onClick={() => setPickingMove(i)} className="border-[3px] border-black p-2 text-left active:translate-x-[2px] active:translate-y-[2px] active:shadow-none" style={{ boxShadow: "3px 3px 0 #000", background: TYPE_COLORS[m.type], color: "#000" }}><div className="text-[11px] font-bold" style={{ textShadow: "1px 1px 0 rgba(255,255,255,.5)" }}>{m.name.toUpperCase()}</div><div className="text-[9px] text-black/70 font-bold">PUI: {m.power} · {m.type}</div></button>))}
            </div>
            <button onClick={() => setPickingSlot(null)} className="text-[10px] text-black font-bold underline mt-2">← Retour</button>
          </div>
        )}
        {!busy && pickingSlot !== null && pickingMove !== null && (
          <div>
            <p className="text-[10px] text-gray-600 font-bold mb-1.5">Cible :</p>
            <div className="grid grid-cols-3 gap-2">
              {beasts.map((b, i) => (<button key={i} disabled={b.defeated} onClick={() => queueAction(pickingSlot, activeSlots[pickingSlot]!, pickingMove, i)} className="border-[3px] border-black p-2 text-center active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-15" style={{ boxShadow: b.defeated?"none":"3px 3px 0 #000", background: b.defeated?"#e5e5e5":"#f8f0e0" }}><img src={b.config.sprite} alt={b.config.name} style={{ imageRendering: "pixelated", width: "30px", margin: "0 auto", filter: b.defeated?"grayscale(1)":`drop-shadow(0 0 4px ${b.config.glowColor})` }} onError={e => { e.currentTarget.style.display="none"; }} /><div className="text-[8px] font-bold mt-1" style={{ color: b.defeated?"#999":b.config.color }}>{b.defeated?"K.O.":b.config.displayName}</div></button>))}
            </div>
            <button onClick={() => setPickingMove(null)} className="text-[10px] text-black font-bold underline mt-2">← Retour</button>
          </div>
        )}
      </div>
      <style>{`@keyframes twk { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:1;transform:scale(1.3)} }`}</style>
    </div></>);
}

function TeamPicker({ team, onSelect, pseudo, musicEnabled, setMusicEnabled }: { team: TeamMember[]; onSelect: (i: number[]) => void; pseudo: string; musicEnabled: boolean; setMusicEnabled: (v: boolean) => void; }) {
  const [sel, setSel] = useState<number[]>([]);
  const toggle = (i: number) => setSel(p => p.includes(i)?p.filter(x=>x!==i):p.length>=3?p:[...p,i]);
  return (<div className="h-dvh w-full p-4 overflow-auto" style={{ fontFamily: "'Courier New', monospace", background: "radial-gradient(ellipse at 50% 30%, #1a0a2e, #0a0518)" }}>
    <div className="max-w-2xl mx-auto">
      <div className="bg-[#f8f0e0] border-4 border-black p-4 mb-4 flex justify-between items-start" style={{ boxShadow: "6px 6px 0 #000" }}>
        <div><h1 className="text-lg font-bold text-black mb-1">Choisis 3 Pokémon</h1><p className="text-xs text-gray-600">{pseudo} · Combat 3v3 simultané</p><p className="text-xs text-red-600 font-bold mt-1">{sel.length}/3</p></div>
        <button onClick={() => setMusicEnabled(!musicEnabled)} className="border-2 border-black bg-white px-2 py-1 text-xs font-bold" style={{ boxShadow: "2px 2px 0 #000" }}>{musicEnabled?"🔊":"🔇"}</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">{team.map((m, i) => { const s = sel.includes(i); return (<button key={i} onClick={() => toggle(i)} className="bg-[#f8f0e0] border-4 p-3 text-left transition-all" style={{ borderColor: s?"#f59e0b":"#000", boxShadow: s?"4px 4px 0 #f59e0b":"4px 4px 0 #000" }}><div className="flex items-center justify-center h-16 mb-1">{m.data.spriteAnimated?<img src={m.data.spriteAnimated} alt="" style={{ imageRendering: "pixelated", height: "55px" }}/>:m.data.sprite?<img src={m.data.sprite} alt="" style={{ height: "55px" }}/>:null}</div><div className="text-[11px] font-bold text-black">{m.pokemon.name.toUpperCase()}</div><div className="text-[9px] text-gray-700">Niv.{m.pokemon.level}</div><div className="flex gap-1 mt-1">{m.data.types.map(t=><span key={t} className="text-[7px] px-1 py-0.5 text-white font-bold" style={{ background: TYPE_COLORS[t] }}>{t}</span>)}</div>{s&&<div className="text-[10px] font-bold text-amber-600 mt-1">✓</div>}</button>); })}</div>
      {sel.length===3 && <motion.button initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }} onClick={() => onSelect(sel)} className="w-full bg-black text-white py-3 text-sm font-bold hover:bg-gray-800 border-4 border-black" style={{ boxShadow: "6px 6px 0 #f59e0b" }}>COMBATTRE LE TRIO →</motion.button>}
    </div>
  </div>);
}

function EndScreen({ type, pseudo, defeated, onClose }: { type: "victory"|"defeat"; pseudo: string; defeated: number; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 6000); return () => clearTimeout(t); }, [onClose]);
  return (<div className="h-dvh w-full flex items-center justify-center p-6" style={{ fontFamily: "'Courier New', monospace", background: "radial-gradient(ellipse at 50% 30%, #1a0a2e, #0a0518)" }}>
    <motion.div initial={{ scale:.8 }} animate={{ scale:1 }} className="bg-[#f8f0e0] border-4 border-black p-8 max-w-sm text-center" style={{ boxShadow: "8px 8px 0 #000" }}>
      <div className="text-4xl mb-3">{type==="victory"?"🏆":"💀"}</div>
      <h1 className="text-2xl font-bold mb-3" style={{ color: type==="victory"?"#f59e0b":"#ef4444" }}>{type==="victory"?"TRIO VAINCU !":"DÉFAITE…"}</h1>
      <p className="text-sm text-gray-700 mb-4">{type==="victory"?`Bravo ${pseudo} !`:`${defeated}/3 bêtes vaincues.`}</p>
      {type==="victory"&&<p className="text-xs text-amber-600 font-bold mb-4">Qualifié pour le Boss Final !</p>}
      <button onClick={onClose} className="bg-black text-white px-6 py-3 text-sm font-bold hover:bg-gray-800">{type==="victory"?"CONTINUER →":"FERMER"}</button>
    </motion.div>
  </div>);
}