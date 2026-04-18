// Pokemon battle system — types, effectiveness, damage, status moves

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

export interface Move {
  name: string;
  power: number;
  type: PokemonType;
  effect?: "paralysis" | "burn" | "freeze" | "poison" | "sleep";
  effectChance?: number;
}

export const TYPE_MOVES: Record<PokemonType, Move[]> = {
  Feu: [
    { name: "Flammèche", power: 40, type: "Feu", effect: "burn", effectChance: 0.1 },
    { name: "Lance-Flammes", power: 90, type: "Feu", effect: "burn", effectChance: 0.1 },
    { name: "Déflagration", power: 110, type: "Feu", effect: "burn", effectChance: 0.1 },
    { name: "Canicule", power: 95, type: "Feu", effect: "burn", effectChance: 0.1 },
  ],
  Eau: [
    { name: "Pistolet à O", power: 40, type: "Eau" },
    { name: "Hydrocanon", power: 110, type: "Eau" },
    { name: "Surf", power: 90, type: "Eau" },
    { name: "Cascade", power: 80, type: "Eau" },
  ],
  Plante: [
    { name: "Fouet Lianes", power: 45, type: "Plante" },
    { name: "Lance-Soleil", power: 120, type: "Plante" },
    { name: "Méga-Sangsue", power: 80, type: "Plante" },
    { name: "Tranch'Herbe", power: 55, type: "Plante" },
  ],
  Électrik: [
    { name: "Éclair", power: 40, type: "Électrik", effect: "paralysis", effectChance: 0.1 },
    { name: "Tonnerre", power: 90, type: "Électrik", effect: "paralysis", effectChance: 0.3 },
    { name: "Fatal-Foudre", power: 110, type: "Électrik", effect: "paralysis", effectChance: 0.3 },
    { name: "Étincelle", power: 65, type: "Électrik", effect: "paralysis", effectChance: 0.3 },
  ],
  Glace: [
    { name: "Vent Glace", power: 55, type: "Glace" },
    { name: "Blizzard", power: 110, type: "Glace", effect: "freeze", effectChance: 0.1 },
    { name: "Laser Glace", power: 90, type: "Glace", effect: "freeze", effectChance: 0.1 },
    { name: "Stalagtite", power: 85, type: "Glace" },
  ],
  Combat: [
    { name: "Coup d'Karaté", power: 50, type: "Combat" },
    { name: "Close Combat", power: 120, type: "Combat" },
    { name: "Mach Punch", power: 40, type: "Combat" },
    { name: "Casse-Brique", power: 75, type: "Combat" },
  ],
  Poison: [
    { name: "Dard-Venin", power: 15, type: "Poison", effect: "poison", effectChance: 0.3 },
    { name: "Bomb-Beurk", power: 90, type: "Poison", effect: "poison", effectChance: 0.3 },
    { name: "Direct Toxik", power: 80, type: "Poison", effect: "poison", effectChance: 0.3 },
    { name: "Détricanon", power: 95, type: "Poison" },
  ],
  Sol: [
    { name: "Tunnel", power: 80, type: "Sol" },
    { name: "Séisme", power: 100, type: "Sol" },
    { name: "Telluriforce", power: 90, type: "Sol" },
    { name: "Boue-Bombe", power: 65, type: "Sol" },
  ],
  Vol: [
    { name: "Cru-Aile", power: 60, type: "Vol" },
    { name: "Aéropique", power: 60, type: "Vol" },
    { name: "Vent Violent", power: 110, type: "Vol" },
    { name: "Rapace", power: 120, type: "Vol" },
  ],
  Psy: [
    { name: "Choc Mental", power: 50, type: "Psy" },
    { name: "Psyko", power: 90, type: "Psy" },
    { name: "Psyko-Boost", power: 140, type: "Psy" },
    { name: "Extrasenseur", power: 80, type: "Psy" },
  ],
  Insecte: [
    { name: "Piqûre", power: 60, type: "Insecte" },
    { name: "Vibr'Aile", power: 70, type: "Insecte" },
    { name: "Ultimapoing", power: 80, type: "Insecte" },
    { name: "Bourdon", power: 90, type: "Insecte" },
  ],
  Roche: [
    { name: "Jet-Pierres", power: 50, type: "Roche" },
    { name: "Lance-Roc", power: 75, type: "Roche" },
    { name: "Éboulement", power: 75, type: "Roche" },
    { name: "Tête de Pierre", power: 150, type: "Roche" },
  ],
  Spectre: [
    { name: "Léchouille", power: 30, type: "Spectre" },
    { name: "Ball'Ombre", power: 80, type: "Spectre" },
    { name: "Griffe Ombre", power: 70, type: "Spectre" },
    { name: "Châtiment", power: 75, type: "Spectre" },
  ],
  Dragon: [
    { name: "Colère", power: 120, type: "Dragon" },
    { name: "Dracosouffle", power: 60, type: "Dragon" },
    { name: "Dracogriffe", power: 80, type: "Dragon" },
    { name: "Draco-Météore", power: 130, type: "Dragon" },
  ],
  Ténèbres: [
    { name: "Mâchouille", power: 80, type: "Ténèbres" },
    { name: "Tourmente", power: 60, type: "Ténèbres" },
    { name: "Morsure", power: 60, type: "Ténèbres" },
    { name: "Pouvoir Antique", power: 60, type: "Ténèbres" },
  ],
  Acier: [
    { name: "Tête de Fer", power: 80, type: "Acier" },
    { name: "Luminocanon", power: 80, type: "Acier" },
    { name: "Aile d'Acier", power: 70, type: "Acier" },
    { name: "Griffe Acier", power: 50, type: "Acier" },
  ],
  Fée: [
    { name: "Vendetta", power: 60, type: "Fée" },
    { name: "Force Lunaire", power: 95, type: "Fée" },
    { name: "Voix Enjôleuse", power: 40, type: "Fée" },
    { name: "Clair-Lune", power: 95, type: "Fée" },
  ],
  Normal: [
    { name: "Charge", power: 40, type: "Normal" },
    { name: "Tranche", power: 70, type: "Normal" },
    { name: "Vive-Attaque", power: 40, type: "Normal" },
    { name: "Hyper Voix", power: 90, type: "Normal" },
  ],
};

export const RAIKOU_MOVES: Move[] = [
  { name: "Tonnerre", power: 95, type: "Électrik", effect: "paralysis", effectChance: 0.3 },
  { name: "Crocs Éclair", power: 65, type: "Électrik", effect: "paralysis", effectChance: 0.2 },
  { name: "Cage-Éclair", power: 0, type: "Électrik", effect: "paralysis", effectChance: 1.0 },
  { name: "Ébullition", power: 80, type: "Eau", effect: "burn", effectChance: 0.3 },
];

export function pickMovesForPokemon(types: PokemonType[]): Move[] {
  if (types.length === 0) return TYPE_MOVES.Normal.slice(0, 4);
  if (types.length === 1) return TYPE_MOVES[types[0]].slice(0, 4);
  const sorted1 = [...TYPE_MOVES[types[0]]].sort((a, b) => b.power - a.power).slice(0, 2);
  const sorted2 = [...TYPE_MOVES[types[1]]].sort((a, b) => b.power - a.power).slice(0, 2);
  return [...sorted1, ...sorted2];
}

export function calculateDamage(
  attackerLevel: number, movePower: number, effectiveness: number = 1, isStab: boolean = false
): number {
  if (movePower === 0) return 0;
  const base = ((2 * attackerLevel / 5 + 2) * movePower * 1) / 50 + 2;
  const stab = isStab ? 1.5 : 1;
  const random = 0.85 + Math.random() * 0.15;
  return Math.max(1, Math.floor(base * effectiveness * stab * random));
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

export interface StatusState {
  status: "paralysis" | "burn" | "freeze" | "poison" | "sleep" | null;
  turnsRemaining?: number;
}

export function canMoveWithParalysis(): boolean { return Math.random() > 0.25; }
export function burnDamage(maxHP: number): number { return Math.max(1, Math.floor(maxHP / 16)); }
export function poisonDamage(maxHP: number): number { return Math.max(1, Math.floor(maxHP / 8)); }

/* ═══════════════════════════════════════════════
   LEGENDARY BEASTS — 3v3 sequential config
   Raikou Lv.55, Entei Lv.55, Suicune Lv.55
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

export const BEAST_CONFIGS: BeastConfig[] = [
  {
    name: "raikou", displayName: "RAIKOU", level: 55, maxHP: 190,
    types: ["Électrik"],
    moves: [
      { name: "Tonnerre", power: 90, type: "Électrik", effect: "paralysis", effectChance: 0.3 },
      { name: "Crocs Éclair", power: 65, type: "Électrik", effect: "paralysis", effectChance: 0.2 },
      { name: "Cage-Éclair", power: 0, type: "Électrik", effect: "paralysis", effectChance: 1.0 },
      { name: "Ébullition", power: 80, type: "Eau", effect: "burn", effectChance: 0.3 },
    ],
    sprite: "https://play.pokemonshowdown.com/sprites/ani/raikou.gif",
    color: "#fbbf24", glowColor: "rgba(251, 191, 36, 0.5)",
  },
  {
    name: "entei", displayName: "ENTEI", level: 55, maxHP: 200,
    types: ["Feu"],
    moves: [
      { name: "Feu Sacré", power: 95, type: "Feu", effect: "burn", effectChance: 0.5 },
      { name: "Lance-Flammes", power: 90, type: "Feu", effect: "burn", effectChance: 0.1 },
      { name: "Piétisol", power: 60, type: "Sol" },
      { name: "Crocs Feu", power: 65, type: "Feu", effect: "burn", effectChance: 0.1 },
    ],
    sprite: "https://play.pokemonshowdown.com/sprites/ani/entei.gif",
    color: "#ef4444", glowColor: "rgba(239, 68, 68, 0.5)",
  },
  {
    name: "suicune", displayName: "SUICUNE", level: 55, maxHP: 210,
    types: ["Eau"],
    moves: [
      { name: "Hydrocanon", power: 110, type: "Eau" },
      { name: "Laser Glace", power: 90, type: "Glace", effect: "freeze", effectChance: 0.1 },
      { name: "Vent Arrière", power: 0, type: "Vol" }, // status — handled in AI as +speed (cosmetic)
      { name: "Surf", power: 90, type: "Eau" },
    ],
    sprite: "https://play.pokemonshowdown.com/sprites/ani/suicune.gif",
    color: "#38bdf8", glowColor: "rgba(56, 189, 248, 0.5)",
  },
];

/* ═══════════════════════════════════════════════
   HO-OH BOSS — Lv.150, Feu/Vol, 3 phases
   ═══════════════════════════════════════════════ */

export const HOOH_LEVEL = 150;
export const HOOH_MAX_HP = 550;
export const HOOH_TYPES: PokemonType[] = ["Feu", "Vol"];

export type BossPhase = "sacred" | "rage" | "divine";

export function getBossPhase(hpPercent: number): BossPhase {
  if (hpPercent > 0.50) return "sacred";
  if (hpPercent > 0.20) return "rage";
  return "divine";
}

export const PHASE_NAMES: Record<BossPhase, string> = {
  sacred: "Flamme Sacrée", rage: "Colère Ardente", divine: "Jugement Divin",
};

export const PHASE_COLORS: Record<BossPhase, { primary: string; secondary: string; glow: string }> = {
  sacred: { primary: "#f59e0b", secondary: "#dc2626", glow: "rgba(245, 158, 11, 0.4)" },
  rage:   { primary: "#ef4444", secondary: "#7c2d12", glow: "rgba(239, 68, 68, 0.5)" },
  divine: { primary: "#fbbf24", secondary: "#f9fafb", glow: "rgba(251, 191, 36, 0.6)" },
};

export const HOOH_MOVES_SACRED: Move[] = [
  { name: "Feu Sacré", power: 100, type: "Feu", effect: "burn", effectChance: 0.5 },
  { name: "Lame d'Air", power: 75, type: "Vol" },
  { name: "Séisme", power: 100, type: "Sol" },
  { name: "Aurore", power: 0, type: "Normal" },
];
export const HOOH_MOVES_RAGE: Move[] = [
  { name: "Feu Sacré", power: 130, type: "Feu", effect: "burn", effectChance: 0.5 },
  { name: "Rapace", power: 120, type: "Vol" },
  { name: "Séisme", power: 100, type: "Sol" },
  { name: "Aurore", power: 0, type: "Normal" },
];
export const HOOH_MOVES_DIVINE: Move[] = [
  { name: "Flamme Ultime", power: 160, type: "Feu", effect: "burn", effectChance: 0.6 },
  { name: "Vent Divin", power: 140, type: "Vol" },
  { name: "Séisme", power: 100, type: "Sol" },
  { name: "Châtiment Sacré", power: 120, type: "Spectre" },
];

export function getHoOhMoves(phase: BossPhase): Move[] {
  switch (phase) {
    case "sacred": return HOOH_MOVES_SACRED;
    case "rage": return HOOH_MOVES_RAGE;
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
    case "rage": return 1.35;
    case "divine": return 1.7;
  }
}

/* ═══════════════════════════════════════════════
   QUIZ — Kimono Sisters questions
   ═══════════════════════════════════════════════ */

export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number; // index
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  { question: "Combien y a-t-il de Danseuses Kimono à Rosalia ?", options: ["3", "4", "5", "7"], correct: 2 },
  { question: "Quel Pokémon les Danseuses Kimono invoquent-elles dans Or HeartGold ?", options: ["Lugia", "Ho-Oh", "Celebi", "Suicune"], correct: 1 },
  { question: "Quel type est Raikou ?", options: ["Feu", "Eau", "Électrik", "Sol"], correct: 2 },
  { question: "Quel événement a créé les trois chiens légendaires ?", options: ["Un tsunami", "L'incendie de la Tour Cendrée", "Un séisme", "La guerre de Johto"], correct: 1 },
  { question: "Quel est le type de Ho-Oh ?", options: ["Feu/Vol", "Feu/Psy", "Normal/Vol", "Feu/Dragon"], correct: 0 },
  { question: "Quelle attaque signature Ho-Oh possède-t-il ?", options: ["Déflagration", "Feu Sacré", "Flamme Ultime", "Eruption"], correct: 1 },
  { question: "Dans quelle ville se trouve la Tour Cendrée ?", options: ["Doublonville", "Rosalia", "Oliville", "Acajou"], correct: 1 },
  { question: "Quel type est super efficace contre les 3 types des chiens légendaires ?", options: ["Sol", "Roche", "Aucun", "Combat"], correct: 2 },
  { question: "Quelle évolution d'Évoli la danseuse Satsuki utilise-t-elle ?", options: ["Aquali", "Voltali", "Pyroli", "Noctali"], correct: 2 },
  { question: "Quel objet Ho-Oh est-il censé laisser derrière lui ?", options: ["Plume Arc-en-Ciel", "Cendre Sacrée", "Flamme Éternelle", "Écaille Miracle"], correct: 0 },
  { question: "Combien de tours existent à Rosalia ?", options: ["1", "2", "3", "4"], correct: 1 },
  { question: "Quel type bat Entei ET Suicune ?", options: ["Plante", "Sol", "Électrik", "Aucun des trois"], correct: 2 },
  { question: "En quelle génération les Danseuses Kimono sont-elles apparues ?", options: ["Gen 1", "Gen 2", "Gen 3", "Gen 4"], correct: 1 },
  { question: "Quel chien légendaire représente la foudre qui a frappé la tour ?", options: ["Entei", "Suicune", "Raikou", "Ho-Oh"], correct: 2 },
  { question: "Quelle capacité spéciale Ho-Oh possède-t-il ?", options: ["Intimidation", "Pression", "Lévitation", "Brasier"], correct: 1 },
];

export const QUIZ_PASS_THRESHOLD = 10; // Need 10/15 to pass
