// Pokemon battle system — types, effectiveness, damage

export type PokemonType =
  | "Normal" | "Feu" | "Eau" | "Plante" | "Électrik" | "Glace" | "Combat"
  | "Poison" | "Sol" | "Vol" | "Psy" | "Insecte" | "Roche" | "Spectre"
  | "Dragon" | "Ténèbres" | "Acier" | "Fée";

// Map English (PokeAPI) → French
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

// Type effectiveness against Electric (Raikou)
// Returns multiplier when attacker uses TYPE against Electric type
export function effectivenessVsElectric(attackerType: PokemonType): number {
  if (attackerType === "Sol") return 2;
  if (attackerType === "Électrik") return 0.5;
  if (attackerType === "Vol") return 0.5;
  if (attackerType === "Acier") return 0.5;
  return 1;
}

// Effectiveness when Electric (Raikou) attacks defender
export function electricVsType(defenderType: PokemonType): number {
  if (defenderType === "Sol") return 0;
  if (defenderType === "Eau") return 2;
  if (defenderType === "Vol") return 2;
  if (defenderType === "Plante") return 0.5;
  if (defenderType === "Électrik") return 0.5;
  if (defenderType === "Dragon") return 0.5;
  return 1;
}

// Default attacks per type — 4 moves with varied power
export const TYPE_MOVES: Record<PokemonType, { name: string; power: number }[]> = {
  Feu: [
    { name: "Flammèche", power: 40 },
    { name: "Lance-Flammes", power: 90 },
    { name: "Déflagration", power: 110 },
    { name: "Danse-Flammes", power: 60 },
  ],
  Eau: [
    { name: "Pistolet à O", power: 40 },
    { name: "Hydrocanon", power: 110 },
    { name: "Surf", power: 90 },
    { name: "Bulles d'O", power: 60 },
  ],
  Plante: [
    { name: "Fouet Lianes", power: 45 },
    { name: "Lance-Soleil", power: 120 },
    { name: "Vampigraine", power: 50 },
    { name: "Tranch'Herbe", power: 55 },
  ],
  Électrik: [
    { name: "Éclair", power: 40 },
    { name: "Tonnerre", power: 110 },
    { name: "Cage-Éclair", power: 90 },
    { name: "Étincelle", power: 65 },
  ],
  Glace: [
    { name: "Vent Glacé", power: 55 },
    { name: "Blizzard", power: 110 },
    { name: "Laser Glace", power: 90 },
    { name: "Poudreuse", power: 40 },
  ],
  Combat: [
    { name: "Coup-Poing", power: 40 },
    { name: "Close Combat", power: 120 },
    { name: "Mach Punch", power: 40 },
    { name: "Casse-Brique", power: 75 },
  ],
  Poison: [
    { name: "Dard-Venin", power: 15 },
    { name: "Bomb-Beurk", power: 90 },
    { name: "Acide", power: 40 },
    { name: "Direct Toxik", power: 80 },
  ],
  Sol: [
    { name: "Tunnel", power: 80 },
    { name: "Séisme", power: 100 },
    { name: "Magnitude", power: 70 },
    { name: "Jet de Sable", power: 30 },
  ],
  Vol: [
    { name: "Cru-Aile", power: 60 },
    { name: "Aéropique", power: 60 },
    { name: "Tornade", power: 40 },
    { name: "Vent Violent", power: 110 },
  ],
  Psy: [
    { name: "Choc Mental", power: 50 },
    { name: "Psyko", power: 90 },
    { name: "Psyko-Boost", power: 140 },
    { name: "Vent Psy", power: 65 },
  ],
  Insecte: [
    { name: "Piqûre", power: 60 },
    { name: "Ultrason", power: 90 },
    { name: "Furie", power: 15 },
    { name: "Damoclès", power: 90 },
  ],
  Roche: [
    { name: "Jet-Pierres", power: 50 },
    { name: "Lance-Roc", power: 75 },
    { name: "Éboulement", power: 75 },
    { name: "Tomboroule", power: 90 },
  ],
  Spectre: [
    { name: "Léchouille", power: 30 },
    { name: "Ball'Ombre", power: 80 },
    { name: "Onde Folie", power: 60 },
    { name: "Châtiment", power: 75 },
  ],
  Dragon: [
    { name: "Colère", power: 120 },
    { name: "Dracosouffle", power: 60 },
    { name: "Dracogriffe", power: 80 },
    { name: "Draco-Météore", power: 130 },
  ],
  Ténèbres: [
    { name: "Mâchouille", power: 80 },
    { name: "Tourmente", power: 60 },
    { name: "Saccage", power: 90 },
    { name: "Pouvoir Antique", power: 60 },
  ],
  Acier: [
    { name: "Tête de Fer", power: 80 },
    { name: "Luminocanon", power: 80 },
    { name: "Aile d'Acier", power: 70 },
    { name: "Griffe Acier", power: 50 },
  ],
  Fée: [
    { name: "Vendetta", power: 60 },
    { name: "Force Lunaire", power: 95 },
    { name: "Voix Enjôleuse", power: 40 },
    { name: "Ébullilarme", power: 75 },
  ],
  Normal: [
    { name: "Charge", power: 40 },
    { name: "Tranche", power: 70 },
    { name: "Vive-Attaque", power: 40 },
    { name: "Hyper Voix", power: 90 },
  ],
};

// Raikou's moves (always Electric type, but mix it up)
export const RAIKOU_MOVES = [
  { name: "Tonnerre", power: 110, type: "Électrik" as PokemonType },
  { name: "Crocs Éclair", power: 65, type: "Électrik" as PokemonType },
  { name: "Cage-Éclair", power: 90, type: "Électrik" as PokemonType },
  { name: "Charge", power: 40, type: "Normal" as PokemonType },
];

// Simplified damage formula
export function calculateDamage(
  attackerLevel: number,
  movePower: number,
  effectiveness: number = 1,
  isStab: boolean = false
): number {
  const base = ((2 * attackerLevel / 5 + 2) * movePower * 1) / 50 + 2;
  const stab = isStab ? 1.5 : 1;
  const random = 0.85 + Math.random() * 0.15;
  return Math.max(1, Math.floor(base * effectiveness * stab * random));
}

// HP calculation (simplified)
export function calculateMaxHP(level: number, baseHP: number = 70): number {
  return Math.floor((2 * baseHP * level) / 100 + level + 10);
}

// Capture rate based on HP percentage
// Returns probability 0-1
export function calculateCaptureRate(hpPercent: number): number {
  if (hpPercent >= 0.95) return 0.002; // 0.2% — full HP
  if (hpPercent >= 0.75) return 0.005; // 0.5%
  if (hpPercent >= 0.50) return 0.01;  // 1%
  if (hpPercent >= 0.25) return 0.025; // 2.5%
  if (hpPercent >= 0.10) return 0.05;  // 5%
  return 0.10; // 10% when very low HP
}
