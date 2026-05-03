// ═══════════════════════════════════════════════
// RPPLF Battle System — Version finale complète
// ═══════════════════════════════════════════════

/* ─── TYPES ─────────────────────────────────────────────────────── */

export type PokemonType =
  | "Normal" | "Feu" | "Eau" | "Plante" | "Électrik" | "Glace" | "Combat"
  | "Poison" | "Sol" | "Vol" | "Psy" | "Insecte" | "Roche" | "Spectre"
  | "Dragon" | "Ténèbres" | "Acier" | "Fée";

export const TYPE_FR: Record<string, PokemonType> = {
  normal: "Normal", fire: "Feu", water: "Eau", grass: "Plante",
  electric: "Électrik", ice: "Glace", fighting: "Combat", poison: "Poison",
  ground: "Sol", flying: "Vol", psychic: "Psy", bug: "Insecte",
  rock: "Roche", ghost: "Spectre", dragon: "Dragon", dark: "Ténèbres",
  steel: "Acier", fairy: "Fée",
};

export const TYPE_COLORS: Record<PokemonType, string> = {
  Normal: "#A8A878", Feu: "#F08030", Eau: "#6890F0", Plante: "#78C850",
  Électrik: "#F8D030", Glace: "#98D8D8", Combat: "#C03028", Poison: "#A040A0",
  Sol: "#E0C068", Vol: "#A890F0", Psy: "#F85888", Insecte: "#A8B820",
  Roche: "#B8A038", Spectre: "#705898", Dragon: "#7038F8", Ténèbres: "#705848",
  Acier: "#B8B8D0", Fée: "#EE99AC",
};

/* ─── TYPE CHART ─────────────────────────────────────────────────── */

const TYPE_CHART: Record<PokemonType, Partial<Record<PokemonType, number>>> = {
  Normal:   { Roche: 0.5, Acier: 0.5, Spectre: 0 },
  Feu:      { Feu: 0.5, Eau: 0.5, Plante: 2, Glace: 2, Insecte: 2, Roche: 0.5, Dragon: 0.5, Acier: 2 },
  Eau:      { Feu: 2, Eau: 0.5, Plante: 0.5, Sol: 2, Roche: 2, Dragon: 0.5 },
  Électrik: { Eau: 2, Électrik: 0.5, Plante: 0.5, Sol: 0, Vol: 2, Dragon: 0.5 },
  Plante:   { Feu: 0.5, Eau: 2, Plante: 0.5, Poison: 0.5, Sol: 2, Vol: 0.5, Insecte: 0.5, Roche: 2, Dragon: 0.5, Acier: 0.5 },
  Glace:    { Feu: 0.5, Eau: 0.5, Plante: 2, Glace: 0.5, Sol: 2, Vol: 2, Dragon: 2, Acier: 0.5 },
  Combat:   { Normal: 2, Glace: 2, Poison: 0.5, Vol: 0.5, Psy: 0.5, Insecte: 0.5, Roche: 2, Spectre: 0, Ténèbres: 2, Acier: 2, Fée: 0.5 },
  Poison:   { Plante: 2, Poison: 0.5, Sol: 0.5, Roche: 0.5, Spectre: 0.5, Acier: 0, Fée: 2 },
  Sol:      { Feu: 2, Électrik: 2, Plante: 0.5, Poison: 2, Vol: 0, Insecte: 0.5, Roche: 2, Acier: 2 },
  Vol:      { Électrik: 0.5, Plante: 2, Combat: 2, Insecte: 2, Roche: 0.5, Acier: 0.5 },
  Psy:      { Combat: 2, Poison: 2, Psy: 0.5, Ténèbres: 0, Acier: 0.5 },
  Insecte:  { Feu: 0.5, Plante: 2, Combat: 0.5, Poison: 0.5, Vol: 0.5, Psy: 2, Spectre: 0.5, Ténèbres: 2, Acier: 0.5, Fée: 0.5 },
  Roche:    { Feu: 2, Glace: 2, Combat: 0.5, Sol: 0.5, Vol: 2, Insecte: 2, Acier: 0.5 },
  Spectre:  { Normal: 0, Psy: 2, Spectre: 2, Ténèbres: 0.5 },
  Dragon:   { Dragon: 2, Acier: 0.5, Fée: 0 },
  Ténèbres: { Combat: 0.5, Psy: 2, Spectre: 2, Ténèbres: 0.5, Fée: 0.5 },
  Acier:    { Feu: 0.5, Eau: 0.5, Électrik: 0.5, Glace: 2, Roche: 2, Acier: 0.5, Fée: 2 },
  Fée:      { Feu: 0.5, Combat: 2, Poison: 0.5, Dragon: 2, Ténèbres: 2, Acier: 0.5 },
};

export function getEffectiveness(attackType: PokemonType, defenderTypes: PokemonType[]): number {
  let mult = 1;
  for (const defType of defenderTypes) {
    const chart = TYPE_CHART[attackType];
    if (chart && chart[defType] !== undefined) mult *= chart[defType]!;
  }
  return mult;
}

/* ─── MOVES ──────────────────────────────────────────────────────── */

export interface Move {
  name: string;
  power: number;
  type: PokemonType;
  effect?: "paralysis" | "burn" | "freeze" | "poison" | "sleep";
  effectChance?: number;
}

export const TYPE_MOVES: Record<PokemonType, Move[]> = {
  Feu: [
    { name: "Flammèche",     power: 40,  type: "Feu", effect: "burn", effectChance: 0.1 },
    { name: "Lance-Flammes", power: 90,  type: "Feu", effect: "burn", effectChance: 0.1 },
    { name: "Déflagration",  power: 110, type: "Feu", effect: "burn", effectChance: 0.1 },
    { name: "Canicule",      power: 95,  type: "Feu", effect: "burn", effectChance: 0.1 },
  ],
  Eau: [
    { name: "Pistolet à O",  power: 40,  type: "Eau" },
    { name: "Hydrocanon",    power: 110, type: "Eau" },
    { name: "Surf",          power: 90,  type: "Eau" },
    { name: "Cascade",       power: 80,  type: "Eau" },
  ],
  Plante: [
    { name: "Fouet Lianes",  power: 45,  type: "Plante" },
    { name: "Lance-Soleil",  power: 120, type: "Plante" },
    { name: "Méga-Sangsue",  power: 80,  type: "Plante" },
    { name: "Tranch'Herbe",  power: 55,  type: "Plante" },
  ],
  Électrik: [
    { name: "Éclair",        power: 40,  type: "Électrik", effect: "paralysis", effectChance: 0.1 },
    { name: "Tonnerre",      power: 90,  type: "Électrik", effect: "paralysis", effectChance: 0.3 },
    { name: "Fatal-Foudre",  power: 110, type: "Électrik", effect: "paralysis", effectChance: 0.3 },
    { name: "Étincelle",     power: 65,  type: "Électrik", effect: "paralysis", effectChance: 0.3 },
  ],
  Glace: [
    { name: "Vent Glace",    power: 55,  type: "Glace" },
    { name: "Blizzard",      power: 110, type: "Glace", effect: "freeze", effectChance: 0.1 },
    { name: "Laser Glace",   power: 90,  type: "Glace", effect: "freeze", effectChance: 0.1 },
    { name: "Stalagtite",    power: 85,  type: "Glace" },
  ],
  Combat: [
    { name: "Coup d'Karaté", power: 50,  type: "Combat" },
    { name: "Close Combat",  power: 120, type: "Combat" },
    { name: "Mach Punch",    power: 40,  type: "Combat" },
    { name: "Casse-Brique",  power: 75,  type: "Combat" },
  ],
  Poison: [
    { name: "Dard-Venin",    power: 15,  type: "Poison", effect: "poison", effectChance: 0.3 },
    { name: "Bomb-Beurk",    power: 90,  type: "Poison", effect: "poison", effectChance: 0.3 },
    { name: "Direct Toxik",  power: 80,  type: "Poison", effect: "poison", effectChance: 0.3 },
    { name: "Détricanon",    power: 95,  type: "Poison" },
  ],
  Sol: [
    { name: "Tunnel",        power: 80,  type: "Sol" },
    { name: "Séisme",        power: 100, type: "Sol" },
    { name: "Telluriforce",  power: 90,  type: "Sol" },
    { name: "Boue-Bombe",    power: 65,  type: "Sol" },
  ],
  Vol: [
    { name: "Cru-Aile",      power: 60,  type: "Vol" },
    { name: "Aéropique",     power: 60,  type: "Vol" },
    { name: "Vent Violent",  power: 110, type: "Vol" },
    { name: "Rapace",        power: 120, type: "Vol" },
  ],
  Psy: [
    { name: "Choc Mental",   power: 50,  type: "Psy" },
    { name: "Psyko",         power: 90,  type: "Psy" },
    { name: "Psyko-Boost",   power: 140, type: "Psy" },
    { name: "Extrasenseur",  power: 80,  type: "Psy" },
  ],
  Insecte: [
    { name: "Piqûre",        power: 60,  type: "Insecte" },
    { name: "Vibr'Aile",     power: 70,  type: "Insecte" },
    { name: "Ultimapoing",   power: 80,  type: "Insecte" },
    { name: "Bourdon",       power: 90,  type: "Insecte" },
  ],
  Roche: [
    { name: "Jet-Pierres",   power: 50,  type: "Roche" },
    { name: "Lance-Roc",     power: 75,  type: "Roche" },
    { name: "Éboulement",    power: 75,  type: "Roche" },
    { name: "Tête de Pierre",power: 150, type: "Roche" },
  ],
  Spectre: [
    { name: "Léchouille",    power: 30,  type: "Spectre" },
    { name: "Ball'Ombre",    power: 80,  type: "Spectre" },
    { name: "Griffe Ombre",  power: 70,  type: "Spectre" },
    { name: "Châtiment",     power: 75,  type: "Spectre" },
  ],
  Dragon: [
    { name: "Colère",        power: 120, type: "Dragon" },
    { name: "Dracosouffle",  power: 60,  type: "Dragon" },
    { name: "Dracogriffe",   power: 80,  type: "Dragon" },
    { name: "Draco-Météore", power: 130, type: "Dragon" },
  ],
  Ténèbres: [
    { name: "Mâchouille",    power: 80,  type: "Ténèbres" },
    { name: "Tourmente",     power: 60,  type: "Ténèbres" },
    { name: "Morsure",       power: 60,  type: "Ténèbres" },
    { name: "Pouvoir Antique",power: 60, type: "Ténèbres" },
  ],
  Acier: [
    { name: "Tête de Fer",   power: 80,  type: "Acier" },
    { name: "Luminocanon",   power: 80,  type: "Acier" },
    { name: "Aile d'Acier",  power: 70,  type: "Acier" },
    { name: "Griffe Acier",  power: 50,  type: "Acier" },
  ],
  Fée: [
    { name: "Vendetta",      power: 60,  type: "Fée" },
    { name: "Force Lunaire", power: 95,  type: "Fée" },
    { name: "Voix Enjôleuse",power: 40,  type: "Fée" },
    { name: "Clair-Lune",    power: 95,  type: "Fée" },
  ],
  Normal: [
    { name: "Charge",        power: 40,  type: "Normal" },
    { name: "Tranche",       power: 70,  type: "Normal" },
    { name: "Vive-Attaque",  power: 40,  type: "Normal" },
    { name: "Hyper Voix",    power: 90,  type: "Normal" },
  ],
};

/* ─── MOVE PICKERS ───────────────────────────────────────────────── */

// Fallback si PokeAPI indisponible
export function pickMovesForPokemon(types: PokemonType[]): Move[] {
  if (types.length === 0) return TYPE_MOVES.Normal.slice(0, 4);
  if (types.length === 1) return TYPE_MOVES[types[0]].slice(0, 4);
  const sorted1 = [...TYPE_MOVES[types[0]]].sort((a, b) => b.power - a.power).slice(0, 2);
  const sorted2 = [...TYPE_MOVES[types[1]]].sort((a, b) => b.power - a.power).slice(0, 2);
  return [...sorted1, ...sorted2];
}

export function getMovepoolForPokemon(types: PokemonType[]): Move[] {
  const pool: Move[] = [];
  const seen = new Set<string>();
  const addMoves = (t: PokemonType) => {
    for (const m of TYPE_MOVES[t] || []) {
      if (!seen.has(m.name)) { seen.add(m.name); pool.push(m); }
    }
  };
  for (const t of types) addMoves(t);
  addMoves("Normal");
  if (!types.includes("Sol"))   addMoves("Sol");
  if (!types.includes("Roche")) addMoves("Roche");
  return pool;
}

/* ─── DAMAGE & HP ────────────────────────────────────────────────── */

export function calculateDamage(
  attackerLevel: number, movePower: number, effectiveness: number = 1, isStab: boolean = false
): number {
  if (movePower === 0) return 0;
  const base = ((2 * attackerLevel / 5 + 2) * movePower) / 50 + 2;
  const stab  = isStab ? 1.5 : 1;
  const rng   = 0.85 + Math.random() * 0.15;
  return Math.max(1, Math.floor(base * effectiveness * stab * rng));
}

export function calculateMaxHP(level: number, baseHP: number = 70): number {
  return Math.floor((2 * baseHP * level) / 100 + level + 10);
}

export function calculateCaptureRate(hpPercent: number): number {
  if (hpPercent >= 0.50) return 0.002;
  if (hpPercent >= 0.20) return 0.005;
  if (hpPercent >= 0.05) return 0.01;
  return 0.02;
}

/* ─── STATUS ─────────────────────────────────────────────────────── */

export interface StatusState {
  status: "paralysis" | "burn" | "freeze" | "poison" | "sleep" | null;
  turnsRemaining?: number;
}

export function canMoveWithParalysis(): boolean  { return Math.random() > 0.25; }
export function burnDamage(maxHP: number): number  { return Math.max(1, Math.floor(maxHP / 16)); }
export function poisonDamage(maxHP: number): number { return Math.max(1, Math.floor(maxHP / 8)); }

/* ═══════════════════════════════════════════════
   LEGENDARY BEASTS — 3v3
   Niveau 120 — HP recalculés
   ═══════════════════════════════════════════════ */

export interface BeastConfig {
  name: string;
  displayName: string;
  level: number;
  maxHP: number;
  types: PokemonType[];
  moves: Move[];
  sprite: string;
  color: string;
  glowColor: string;
}

// Moves individuels exportés pour les composants de combat spécifiques
export const RAIKOU_MOVES: Move[] = [
  { name: "Tonnerre",     power: 90, type: "Électrik", effect: "paralysis", effectChance: 0.3 },
  { name: "Crocs Éclair", power: 65, type: "Électrik", effect: "paralysis", effectChance: 0.2 },
  { name: "Cage-Éclair",  power: 0,  type: "Électrik", effect: "paralysis", effectChance: 1.0 },
  { name: "Ébullition",   power: 80, type: "Eau",      effect: "burn",      effectChance: 0.3 },
];

export const ENTEI_MOVES: Move[] = [
  { name: "Feu Sacré",     power: 95, type: "Feu", effect: "burn", effectChance: 0.5 },
  { name: "Lance-Flammes", power: 90, type: "Feu", effect: "burn", effectChance: 0.1 },
  { name: "Piétisol",      power: 60, type: "Sol" },
  { name: "Crocs Feu",     power: 65, type: "Feu", effect: "burn", effectChance: 0.1 },
];

export const SUICUNE_MOVES: Move[] = [
  { name: "Hydrocanon",   power: 110, type: "Eau" },
  { name: "Laser Glace",  power: 90,  type: "Glace", effect: "freeze", effectChance: 0.1 },
  { name: "Vent Arrière", power: 0,   type: "Vol" },
  { name: "Surf",         power: 90,  type: "Eau" },
];

export const BEAST_CONFIGS: BeastConfig[] = [
  {
    name: "raikou", displayName: "RAIKOU", level: 120, maxHP: 346,
    types: ["Électrik"],
    moves: [
      { name: "Tonnerre",     power: 90, type: "Électrik", effect: "paralysis", effectChance: 0.3 },
      { name: "Crocs Éclair", power: 65, type: "Électrik", effect: "paralysis", effectChance: 0.2 },
      { name: "Cage-Éclair",  power: 0,  type: "Électrik", effect: "paralysis", effectChance: 1.0 },
      { name: "Ébullition",   power: 80, type: "Eau",      effect: "burn",      effectChance: 0.3 },
    ],
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/243.gif",
    color: "#fbbf24", glowColor: "rgba(251, 191, 36, 0.5)",
  },
  {
    name: "entei", displayName: "ENTEI", level: 120, maxHP: 406,
    types: ["Feu"],
    moves: [
      { name: "Feu Sacré",     power: 95, type: "Feu", effect: "burn", effectChance: 0.5 },
      { name: "Lance-Flammes", power: 90, type: "Feu", effect: "burn", effectChance: 0.1 },
      { name: "Piétisol",      power: 60, type: "Sol" },
      { name: "Crocs Feu",     power: 65, type: "Feu", effect: "burn", effectChance: 0.1 },
    ],
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/244.gif",
    color: "#ef4444", glowColor: "rgba(239, 68, 68, 0.5)",
  },
  {
    name: "suicune", displayName: "SUICUNE", level: 120, maxHP: 370,
    types: ["Eau"],
    moves: [
      { name: "Hydrocanon",   power: 110, type: "Eau" },
      { name: "Laser Glace",  power: 90,  type: "Glace", effect: "freeze", effectChance: 0.1 },
      { name: "Vent Arrière", power: 0,   type: "Vol" },
      { name: "Surf",         power: 90,  type: "Eau" },
    ],
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/245.gif",
    color: "#38bdf8", glowColor: "rgba(56, 189, 248, 0.5)",
  },
];

/* ═══════════════════════════════════════════════
   HO-OH BOSS
   3 phases avec résurrection à 100% HP
   Phase 1 : Lv.100 · 420 PV  — Flamme Sacrée
   Phase 2 : Lv.120 · 560 PV  — Colère Ardente
   Phase 3 : Lv.150 · 720 PV  — Jugement Divin
   ═══════════════════════════════════════════════ */

export const HOOH_LEVEL  = 150;
export const HOOH_MAX_HP = 420;
export const HOOH_TYPES: PokemonType[] = ["Feu", "Vol"];

export type BossPhase = "sacred" | "rage" | "divine";

export function getBossPhase(hpPercent: number): BossPhase {
  if (hpPercent > 0.50) return "sacred";
  if (hpPercent > 0.20) return "rage";
  return "divine";
}

export const PHASE_NAMES: Record<BossPhase, string> = {
  sacred: "Flamme Sacrée",
  rage:   "Colère Ardente",
  divine: "Jugement Divin",
};

export const PHASE_COLORS: Record<BossPhase, { primary: string; secondary: string; glow: string }> = {
  sacred: { primary: "#f59e0b", secondary: "#dc2626", glow: "rgba(245, 158, 11, 0.4)" },
  rage:   { primary: "#ef4444", secondary: "#7c2d12", glow: "rgba(239, 68, 68, 0.5)"  },
  divine: { primary: "#fbbf24", secondary: "#f9fafb", glow: "rgba(251, 191, 36, 0.6)" },
};

export const HOOH_MOVES_SACRED: Move[] = [
  { name: "Feu Sacré",   power: 100, type: "Feu", effect: "burn", effectChance: 0.5 },
  { name: "Lame d'Air",  power: 75,  type: "Vol" },
  { name: "Séisme",      power: 100, type: "Sol" },
  { name: "Aurore",      power: 0,   type: "Normal" },
];

export const HOOH_MOVES_RAGE: Move[] = [
  { name: "Feu Sacré",   power: 130, type: "Feu", effect: "burn", effectChance: 0.5 },
  { name: "Rapace",      power: 120, type: "Vol" },
  { name: "Séisme",      power: 100, type: "Sol" },
  { name: "Aurore",      power: 0,   type: "Normal" },
];

export const HOOH_MOVES_DIVINE: Move[] = [
  { name: "Flamme Ultime",   power: 160, type: "Feu",     effect: "burn", effectChance: 0.6 },
  { name: "Vent Divin",      power: 140, type: "Vol" },
  { name: "Séisme",          power: 100, type: "Sol" },
  { name: "Châtiment Sacré", power: 120, type: "Spectre" },
];

export function getHoOhMoves(phase: BossPhase): Move[] {
  switch (phase) {
    case "sacred": return HOOH_MOVES_SACRED;
    case "rage":   return HOOH_MOVES_RAGE;
    case "divine": return HOOH_MOVES_DIVINE;
  }
}

export function calculateBossCaptureRate(hpPercent: number): number {
  if (hpPercent >= 0.50) return 0.001;
  if (hpPercent >= 0.20) return 0.003;
  if (hpPercent >= 0.05) return 0.008;
  return 0.015;
}

export function getBossDamageMultiplier(phase: BossPhase): number {
  switch (phase) {
    case "sacred": return 1.0;
    case "rage":   return 1.35;
    case "divine": return 1.7;
  }
}

/* ═══════════════════════════════════════════════
   QUIZ — 41 questions RPPLF exclusives
   Chaque joueur reçoit 10 questions au hasard
   parmi les 41 → anti-triche garanti
   Seuil : 7/10 bonnes réponses pour passer
   ═══════════════════════════════════════════════ */

export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    question: "Parmi ces participants, lequel n'a eu aucun légendaire au cours de la saison 2G ?",
    options: ["Serigne", "Nihilow", "Ludo", "Hero Sabis"],
    correct: 3,
  },
  {
    question: "Parmi ces noms, lequel n'est pas un nom de Champion du Pokéathlon ?",
    options: ["Eddie Milkilomètres", "Drapolas œil-de-Mazout", "Jennifer Nacier", "Cajotey Foulcan"],
    correct: 0,
  },
  {
    question: "Quel est le premier joueur à avoir triomphé du C4 de la saison aventure 2G ?",
    options: ["Kthuloutre", "Un passant Ordinaire", "Roaring Moonlight", "Hero Sabis"],
    correct: 0,
  },
  {
    question: "Dans le défi Rocket « Le Trafic du Puits Ramoloss », quel est le nom du personnage qui vient en aide à Gold ?",
    options: ["Fargas Halliday", "Fargas Bem-Bem Vroum", "Fargas Cadillac", "Fargas Troentérite"],
    correct: 2,
  },
  {
    question: "Qui a été le premier challenger à être bloqué dans une arène dans l'Aventure 2G ?",
    options: ["Ikra", "Mate", "Trigazelli", "Rudy"],
    correct: 2,
  },
  {
    question: "Quel Pokémon étranger des régions de Johto était-il possible d'obtenir au Concours Insecte du Parc Naturel ?",
    options: ["Papilusion", "Larveyette", "Lilliterelle", "Grillepattes"],
    correct: 3,
  },
  {
    question: "Quel duo de champions d'arènes apparaissait dans « La quête du Pokémon Volcan » ?",
    options: ["Kabu et Rubépin", "Auguste et Ariane", "Auguste et Rubépin", "Kabu et Ariane"],
    correct: 1,
  },
  {
    question: "Quel méchant des Jeux Pokémons est apparu dans le lore de l'aventure 2G ?",
    options: ["Giovanni", "Ghetis", "Arthur", "Max"],
    correct: 3,
  },
  {
    question: "Dans le lore RPPLF, quel personnage accompagne régulièrement Celebi ?",
    options: ["Le Commissaire Chammal", "Le Commissaire Chamsin", "Le Commissaire Chamoulaud", "Le Commissaire Moulin"],
    correct: 0,
  },
  {
    question: "Parmi ces joueurs, lequel a réussi un parcours sans faute dans les arènes ? (0 défaite)",
    options: ["Nihilow", "Kthuloutre", "Juyen", "Kindy"],
    correct: 0,
  },
  {
    question: "Quelle était la récompense du premier défi Rocket ?",
    options: ["Togepi", "Porygon2", "Ramoloss", "Salamèche"],
    correct: 2,
  },
  {
    question: "Quel Pokémon déjà apparu dans le lore RPPLF a fait son retour dans la quête du Celebi ?",
    options: ["L'Absol du Chaos", "Le Limonde de l'Apocalypse", "Le Démolosse des Enfers", "Le Palarticho Originel"],
    correct: 3,
  },
  {
    question: "L'équipe de Blanche était constituée d'Ecrémeuh, Excelangue et…",
    options: ["Queulorior", "Mélofée", "Snubbul", "Cerfrousse"],
    correct: 3,
  },
  {
    question: "Quelle pierre évolutive pouvait-on obtenir en premier dans l'Aventure 2G ?",
    options: ["Pierre Foudre", "Pierre Eau", "Pierre Feu", "Pierre Lune"],
    correct: 1,
  },
  {
    question: "Quel était le thème de l'épreuve de Pokéathlon organisée par Valbat ?",
    options: ["La vitesse", "La force", "Le saut", "L'endurance"],
    correct: 3,
  },
  {
    question: "D'après certaines rumeurs, quel Pokémon aurait été à l'origine du ragequitte de Roudy au cours de l'aventure ?",
    options: ["Natu", "Pomdepik", "Feuforêve", "Roudy ne ragequitte jamais"],
    correct: 0,
  },
  {
    question: "Lors du stream d'inauguration de la saison, combien a-t-il fallu d'essais à Juyen pour passer l'arène de Shraider ?",
    options: ["Un", "Trois", "Cinq", "Il s'est fait bloquer"],
    correct: 2,
  },
  {
    question: "Snubbul n'était pas disponible au cours de l'Aventure 2G.",
    options: ["Vrai", "Faux"],
    correct: 1,
  },
  {
    question: "Comment s'appelait l'événement qui permettait d'échanger ses Pokémons ?",
    options: ["Le troc de Doublonville", "La foire d'Oliville", "Le marché de Doublonville", "La foire de Doublonville"],
    correct: 1,
  },
  {
    question: "De quel niveau était le Steelix de Jasmine ?",
    options: ["40", "42", "44", "46"],
    correct: 0,
  },
  {
    question: "D'après la légende racontée par le Commissaire Chammal à Gold, quel Pokémon serait à l'origine de la disparition des Magicarpe de la région ?",
    options: ["Le Léviator Rouge", "Zeraora", "Lugia", "Engloutyran"],
    correct: 3,
  },
  {
    question: "Combien d'Hydrocanon fallait-il réussir à la suite pour obtenir le Carapuce à 0 ?",
    options: ["Trois", "Cinq", "Huit", "Il fallait réussir un coup critique"],
    correct: 1,
  },
  {
    question: "Quel objet était offert via une quête du Roublard Rocket ?",
    options: ["Les baskets de Roudy", "Le Multi Exp", "Le passe-bateau", "Le cherche VS"],
    correct: 2,
  },
  {
    question: "Parmi ces joueurs, lequel n'a PAS pris part à la saison 2G ?",
    options: ["Artymasion", "Bibix", "Cicada", "JspKiC"],
    correct: 2,
  },
  {
    question: "Quel Pokémon n'était pas possédé par un membre du Conseil 4 ?",
    options: ["Tentacruel", "Porygon 2", "Tyranocif", "Migalos"],
    correct: 3,
  },
  {
    question: "Quel thème a pu être entendu lors d'une quête annexe cette saison ?",
    options: ["Le thème de Raikou", "Le thème d'Entei", "Le thème de Suicune", "Le thème de Celebi"],
    correct: 0,
  },
  {
    question: "Parmi ces joueurs, lequel a effectué un sans-faute lors des défis rocket ?",
    options: ["Juyen", "LucioCerra", "Artymasion", "Asta"],
    correct: 3,
  },
  {
    question: "Quel champion d'arène possédait le Pokémon avec la plus haute statistique d'attaque ?",
    options: ["Hector", "Sandra", "Chuck", "Fredo"],
    correct: 3,
  },
  {
    question: "Quel objet n'était PAS disponible via les routes ou les champions de l'Aventure 2G ?",
    options: ["Restes", "Veste de Combat", "Orbe Vie", "Baie Chérim"],
    correct: 2,
  },
  {
    question: "Quel joueur a joint à sa candidature de champion d'arène un vocal dans lequel il imite le champion concerné ?",
    options: ["Kthuloutre", "Remysse", "Shykimi", "Extinct"],
    correct: 3,
  },
  {
    question: "Quel duo s'est lancé dans une review de l'Aventure 2G sur la chaîne Youtube RPPLF ?",
    options: ["Kthuloutre et Rémysse", "Serigne et Wappy", "Skander et Juyen", "Roudy et Cicada"],
    correct: 0,
  },
  {
    question: "Quel chanteur français est mentionné dans le défi Pokéathlon n°3 (épreuve force) ?",
    options: ["Christophe", "Joe Dassin", "Serge Lama", "Michel Sardou"],
    correct: 1,
  },
  {
    question: "Quelle attaque était offerte en CT par un champion ?",
    options: ["Toxic", "Sabotage", "Lance-Flammes", "Surf"],
    correct: 1,
  },
  {
    question: "Quel Pokémon ne pouvait PAS être obtenu via le Roublard Rocket ?",
    options: ["Métamorph", "Mélofée", "Machoc", "Galopa"],
    correct: 0,
  },
  {
    question: "Le maître de l'Aventure 1G était LucioCerra ?",
    options: ["Vrai", "Faux"],
    correct: 0,
  },
  {
    question: "Un postgame existait pour les joueurs ayant vaincu le Conseil 4 ?",
    options: ["Vrai", "Faux"],
    correct: 0,
  },
  {
    question: "Au-delà d'être le nom du héros de la 2G, Gold est aussi le nom d'un groupe de musique français des années 70 ?",
    options: ["Vrai", "Faux (fondé en 1982)"],
    correct: 1,
  },
  {
    question: "Quel est le nom du chef de Jessie et James dans l'Aventure 2G ?",
    options: ["Lambda", "Giovanni", "Lance", "Pluton"],
    correct: 2,
  },
  {
    question: "Dans le défi Pokéathlon 1, de quel instrument de musique joue Eddie Milaleur ?",
    options: ["Piano", "Saxophone", "Batterie", "Guitare Électrique"],
    correct: 3,
  },
  {
    question: "Quel joueur n'a pas vaincu le C4 de l'Aventure 2G ?",
    options: ["Dieu Shykimi", "Kthuloutre", "Hero Sabis", "Roaring Moonlight"],
    correct: 0,
  },
  {
    question: "Quel Pokémon Ludo Poulain a-t-il désespérément cherché à avoir tout au long de l'aventure ?",
    options: ["Scarinho", "Entei", "Ronflex", "Insécateur"],
    correct: 3,
  },
];

// 10 questions tirées au hasard parmi les 41 — différentes pour chaque joueur
export const QUIZ_QUESTIONS_PER_GAME = 10;

// 7 bonnes réponses sur 10 pour passer
export const QUIZ_PASS_THRESHOLD = 7;

/* ═══════════════════════════════════════════════
   ITEMS
   ═══════════════════════════════════════════════ */

export type ItemEffect =
  | "leftovers"
  | "lifeorb"
  | "choiceband"
  | "choicespecs"
  | "sitrusberry"
  | "focussash"
  | "shellbell"
  | "rockyhelmet"
  | "lumberry"
  | "assaultvest"
  | "none";

export interface Item {
  id: string;
  name: string;
  description: string;
  emoji: string;
  effect: ItemEffect;
  color: string;
}

export const ITEMS: Item[] = [
  { id: "none",        name: "Aucun objet",     description: "Pas d'objet tenu.",                                    emoji: "—",  effect: "none",        color: "#9ca3af" },
  { id: "leftovers",   name: "Restes",           description: "Récupère 1/16 des PV max à chaque tour.",              emoji: "🍖", effect: "leftovers",   color: "#4ade80" },
  { id: "lifeorb",     name: "Orbe Vie",         description: "+30% dégâts, perd 10% PV après chaque attaque.",       emoji: "🔮", effect: "lifeorb",     color: "#f87171" },
  { id: "choiceband",  name: "Bandeau Choix",    description: "+50% dégâts sur attaques physiques.",                  emoji: "🎽", effect: "choiceband",  color: "#fb923c" },
  { id: "choicespecs", name: "Écharpe Choix",    description: "+50% dégâts sur attaques spéciales.",                  emoji: "🧣", effect: "choicespecs", color: "#c084fc" },
  { id: "sitrusberry", name: "Baie Sitrus",      description: "Récupère 25% PV max quand PV < 50% (1 fois).",         emoji: "🍊", effect: "sitrusberry", color: "#fbbf24" },
  { id: "focussash",   name: "Filet Faîte",      description: "Survit à un coup fatal à 1 PV si PV pleins (1 fois).", emoji: "🕸️", effect: "focussash",   color: "#e0f2fe" },
  { id: "shellbell",   name: "Coque Cloche",     description: "Récupère 1/8 des dégâts infligés à chaque attaque.",   emoji: "🔔", effect: "shellbell",   color: "#38bdf8" },
  { id: "rockyhelmet", name: "Casque Gonflant",  description: "L'attaquant perd 1/6 de ses PV max en contact.",       emoji: "⛑️", effect: "rockyhelmet", color: "#94a3b8" },
  { id: "lumberry",    name: "Baie Lum",         description: "Soigne n'importe quel statut une fois.",               emoji: "🫐", effect: "lumberry",    color: "#a78bfa" },
  { id: "assaultvest", name: "Veste d'Assaut",   description: "Réduit de 25% les dégâts des attaques spéciales.",     emoji: "🦺", effect: "assaultvest", color: "#6ee7b7" },
];

/* ═══════════════════════════════════════════════
   EV SPREADS
   ═══════════════════════════════════════════════ */

export interface EVSpread {
  id: string;
  name: string;
  description: string;
  detail: string;
  emoji: string;
  color: string;
  hpMult: number;
  atkMult: number;
  defMult: number;
}

export const EV_SPREADS: EVSpread[] = [
  {
    id: "sweeper", name: "Sweeper",
    description: "Maximum de puissance et de vitesse. Fragile mais dévastateur.",
    detail: "252 Atk / 252 Vit / 4 PV", emoji: "⚔️", color: "#ef4444",
    hpMult: 1.0, atkMult: 1.40, defMult: 1.0,
  },
  {
    id: "tank", name: "Tank",
    description: "Maximum de résistance. Encaisse tout, dure longtemps.",
    detail: "252 PV / 252 Def / 4 AtqSp", emoji: "🛡️", color: "#3b82f6",
    hpMult: 1.50, atkMult: 1.0, defMult: 0.70,
  },
  {
    id: "bulky", name: "Bulky Offensif",
    description: "Équilibre entre puissance et endurance. Le choix sûr.",
    detail: "128 Atk / 128 PV / 252 Vit", emoji: "💪", color: "#f59e0b",
    hpMult: 1.20, atkMult: 1.20, defMult: 0.90,
  },
  {
    id: "glass", name: "Glass Cannon",
    description: "Dégâts extrêmes, survie minimale. All-in.",
    detail: "252 Atk / 252 AtqSp / 4 Vit", emoji: "💥", color: "#a855f7",
    hpMult: 0.85, atkMult: 1.55, defMult: 1.0,
  },
  {
    id: "support", name: "Support",
    description: "Survie maximale des deux côtés. Pour tenir en équipe.",
    detail: "252 PV / 128 Def / 128 DefSp", emoji: "✨", color: "#22c55e",
    hpMult: 1.40, atkMult: 0.90, defMult: 0.75,
  },
];