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

/* ═══════════════════════════════════════════════
   FULL TYPE EFFECTIVENESS CHART
   Gen 6+ (includes Fairy). Values: 0 = immune, 0.5 = not very effective,
   1 = normal, 2 = super effective
   ═══════════════════════════════════════════════ */

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

// Effectiveness multiplier of an attack type against a defender that may have 1 or 2 types
export function getEffectiveness(attackType: PokemonType, defenderTypes: PokemonType[]): number {
  let mult = 1;
  for (const defType of defenderTypes) {
    const chart = TYPE_CHART[attackType];
    if (chart && chart[defType] !== undefined) {
      mult *= chart[defType]!;
    }
  }
  return mult;
}

/* ═══════════════════════════════════════════════
   MOVE DEFINITIONS
   Each move has: name, power (0 for status), optional effect
   Status effects: "paralysis", "burn", "freeze", "poison", "sleep"
   ═══════════════════════════════════════════════ */

export interface Move {
  name: string;
  power: number;
  type: PokemonType;
  effect?: "paralysis" | "burn" | "freeze" | "poison" | "sleep";
  effectChance?: number; // 0-1
}

// All moves organized by type — using REAL French Pokemon attack names
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

/* ═══════════════════════════════════════════════
   RAIKOU MOVESET — Lv.50 stats
   Cage-Éclair is now STATUS (paralysis, no damage)
   Ebullition added to hit Ground types (resists Electric)
   ═══════════════════════════════════════════════ */

export const RAIKOU_MOVES: Move[] = [
  { name: "Tonnerre", power: 95, type: "Électrik", effect: "paralysis", effectChance: 0.3 },
  { name: "Crocs Éclair", power: 65, type: "Électrik", effect: "paralysis", effectChance: 0.2 },
  { name: "Cage-Éclair", power: 0, type: "Électrik", effect: "paralysis", effectChance: 1.0 },
  { name: "Ébullition", power: 80, type: "Eau", effect: "burn", effectChance: 0.3 },
];

/* ═══════════════════════════════════════════════
   MOVE PICKER — for dual-type pokemon, give 2 moves per type
   For single-type pokemon, give 4 moves of that type
   ═══════════════════════════════════════════════ */

export function pickMovesForPokemon(types: PokemonType[]): Move[] {
  if (types.length === 0) return TYPE_MOVES.Normal.slice(0, 4);

  if (types.length === 1) {
    return TYPE_MOVES[types[0]].slice(0, 4);
  }

  // Dual type: 2 moves of first type, 2 of second
  const t1 = TYPE_MOVES[types[0]];
  const t2 = TYPE_MOVES[types[1]];
  // Pick the 2 best (highest power) of each
  const sorted1 = [...t1].sort((a, b) => b.power - a.power).slice(0, 2);
  const sorted2 = [...t2].sort((a, b) => b.power - a.power).slice(0, 2);
  return [...sorted1, ...sorted2];
}

/* ═══════════════════════════════════════════════
   DAMAGE & HP FORMULAS
   ═══════════════════════════════════════════════ */

export function calculateDamage(
  attackerLevel: number,
  movePower: number,
  effectiveness: number = 1,
  isStab: boolean = false
): number {
  if (movePower === 0) return 0; // Status moves
  const base = ((2 * attackerLevel / 5 + 2) * movePower * 1) / 50 + 2;
  const stab = isStab ? 1.5 : 1;
  const random = 0.85 + Math.random() * 0.15;
  return Math.max(1, Math.floor(base * effectiveness * stab * random));
}

export function calculateMaxHP(level: number, baseHP: number = 70): number {
  return Math.floor((2 * baseHP * level) / 100 + level + 10);
}

// Softer capture rates — 0.2% green, 0.5% orange, 1% red, 2% critical
export function calculateCaptureRate(hpPercent: number): number {
  if (hpPercent >= 0.50) return 0.002;
  if (hpPercent >= 0.20) return 0.005;
  if (hpPercent >= 0.05) return 0.01;
  return 0.02;
}

/* ═══════════════════════════════════════════════
   STATUS EFFECTS
   ═══════════════════════════════════════════════ */

export interface StatusState {
  status: "paralysis" | "burn" | "freeze" | "poison" | "sleep" | null;
  turnsRemaining?: number; // for sleep/freeze
}

// Paralysis: 25% chance to skip turn
export function canMoveWithParalysis(): boolean {
  return Math.random() > 0.25;
}

// Burn: deals 1/16 max HP per turn
export function burnDamage(maxHP: number): number {
  return Math.max(1, Math.floor(maxHP / 16));
}

// Poison: deals 1/8 max HP per turn
export function poisonDamage(maxHP: number): number {
  return Math.max(1, Math.floor(maxHP / 8));
}
