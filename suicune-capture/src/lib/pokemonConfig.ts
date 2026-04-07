import * as THREE from "three";

export interface PokemonConfig {
  name: string;
  displayName: string;
  model: string;
  island: string;
  accentColor: string;
  accentColorHex: string;
  secondaryColor: string;
  glowColor: string;
  hudBorder: string;
  hudGlow: string;
  badgeColor: string;
  titleGradient: string;
  spotlightColor: string;
  spotlightIntensity: number;
  rimColor: string;
  rimIntensity: number;
  accentLightColor: string;
  auraColor1: string;
  auraColor2: string;
  sparkleColor1: string;
  sparkleColor2: string;
  fireflyColor1: string;
  fireflyColor2: string;
  moonColor: string;
  fogColor: string;
  bgColor: string;
  islandPos: [number, number, number];
  islandScale: number;
  islandRotationY: number;
  encounterPos: [number, number, number];
  camPos: [number, number, number];
  camLookAtOffset: [number, number, number];
  // New: render mode — "3d" for Suicune/Entei, "2d-battle" for Raikou
  renderMode?: "3d" | "2d-battle";
}

const POKEMON_CONFIGS: Record<string, PokemonConfig> = {
  suicune: {
    name: "suicune", displayName: "Suicune", model: "suicune", island: "island_suicune",
    accentColor: "cyan", accentColorHex: "#38bdf8", secondaryColor: "#a78bfa", glowColor: "#22d3ee",
    hudBorder: "rgba(100, 180, 255, 0.18)", hudGlow: "rgba(56, 140, 255, 0.06)",
    badgeColor: "text-cyan-400/60",
    titleGradient: "linear-gradient(135deg, #fff 0%, #93c5fd 50%, #38bdf8 100%)",
    spotlightColor: "#38bdf8", spotlightIntensity: 12, rimColor: "#ec4899", rimIntensity: 3,
    accentLightColor: "#7c3aed", auraColor1: "#38bdf8", auraColor2: "#a78bfa",
    sparkleColor1: "#60a5fa", sparkleColor2: "#f9a8d4",
    fireflyColor1: "#67e8f9", fireflyColor2: "#fde68a",
    moonColor: "#8899cc", fogColor: "#0a0a1a", bgColor: "#0a0a1a",
    islandPos: [0, -4, 0], islandScale: 0.035, islandRotationY: Math.PI * 1.1,
    encounterPos: [0.5, 5.5, -0.6], camPos: [7, 6.5, 3], camLookAtOffset: [0, 0.3, 0],
    renderMode: "3d",
  },

  entei: {
    name: "entei", displayName: "Entei", model: "entei", island: "island_entei",
    accentColor: "red", accentColorHex: "#ef4444", secondaryColor: "#f59e0b", glowColor: "#f97316",
    hudBorder: "rgba(239, 68, 68, 0.18)", hudGlow: "rgba(239, 68, 68, 0.06)",
    badgeColor: "text-red-400/60",
    titleGradient: "linear-gradient(135deg, #fff 0%, #fca5a5 50%, #ef4444 100%)",
    spotlightColor: "#f97316", spotlightIntensity: 14, rimColor: "#ef4444", rimIntensity: 4,
    accentLightColor: "#f59e0b", auraColor1: "#f97316", auraColor2: "#ef4444",
    sparkleColor1: "#fb923c", sparkleColor2: "#fbbf24",
    fireflyColor1: "#f97316", fireflyColor2: "#ef4444",
    moonColor: "#cc6644", fogColor: "#1a0a0a", bgColor: "#1a0808",
    islandPos: [-4.2, 3.9, -1.1], islandScale: 0.17, islandRotationY: 5.34,
    encounterPos: [0.5, 5.5, -0.6], camPos: [6.2, 5.0, 3.0], camLookAtOffset: [0, 0.3, 0],
    renderMode: "3d",
  },

  raikou: {
    name: "raikou", displayName: "Raikou", model: "raikou", island: "island_raikou",
    accentColor: "yellow", accentColorHex: "#fbbf24", secondaryColor: "#a855f7", glowColor: "#fde047",
    hudBorder: "rgba(251, 191, 36, 0.3)", hudGlow: "rgba(251, 191, 36, 0.08)",
    badgeColor: "text-yellow-400/70",
    titleGradient: "linear-gradient(135deg, #fff 0%, #fde047 50%, #fbbf24 100%)",
    // 3D values not used (renderMode is 2d-battle), but kept for type safety
    spotlightColor: "#fbbf24", spotlightIntensity: 12, rimColor: "#a855f7", rimIntensity: 3,
    accentLightColor: "#fde047", auraColor1: "#fbbf24", auraColor2: "#a855f7",
    sparkleColor1: "#fde047", sparkleColor2: "#c4b5fd",
    fireflyColor1: "#fde047", fireflyColor2: "#a855f7",
    moonColor: "#fef9c3", fogColor: "#0a0518", bgColor: "#0a0518",
    islandPos: [0, -4, 0], islandScale: 0.035, islandRotationY: 0,
    encounterPos: [0, 5.5, 0], camPos: [7, 6.5, 3], camLookAtOffset: [0, 0.3, 0],
    renderMode: "2d-battle",
  },
};

export function getPokemonConfig(name: string): PokemonConfig {
  return POKEMON_CONFIGS[name] ?? POKEMON_CONFIGS.suicune;
}

export default POKEMON_CONFIGS;
