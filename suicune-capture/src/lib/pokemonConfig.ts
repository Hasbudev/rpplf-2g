import * as THREE from "three";

export interface PokemonConfig {
  name: string;
  displayName: string;
  model: string;
  island: string;
  // Theme colors
  accentColor: string;
  accentColorHex: string;
  secondaryColor: string;
  glowColor: string;
  // CSS theme
  hudBorder: string;
  hudGlow: string;
  badgeColor: string;
  titleGradient: string;
  // 3D Lighting
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
  // Island positioning (may differ per model)
  islandPos: [number, number, number];
  islandScale: number;
  islandRotationY: number;
  encounterPos: [number, number, number];
  camPos: [number, number, number];
  camLookAtOffset: [number, number, number];
}

const POKEMON_CONFIGS: Record<string, PokemonConfig> = {
  suicune: {
    name: "suicune",
    displayName: "Suicune",
    model: "suicune",
    island: "island_suicune",
    // Cyan/blue theme
    accentColor: "cyan",
    accentColorHex: "#38bdf8",
    secondaryColor: "#a78bfa",
    glowColor: "#22d3ee",
    hudBorder: "rgba(100, 180, 255, 0.18)",
    hudGlow: "rgba(56, 140, 255, 0.06)",
    badgeColor: "text-cyan-400/60",
    titleGradient: "linear-gradient(135deg, #fff 0%, #93c5fd 50%, #38bdf8 100%)",
    // 3D
    spotlightColor: "#38bdf8",
    spotlightIntensity: 12,
    rimColor: "#ec4899",
    rimIntensity: 3,
    accentLightColor: "#7c3aed",
    auraColor1: "#38bdf8",
    auraColor2: "#a78bfa",
    sparkleColor1: "#60a5fa",
    sparkleColor2: "#f9a8d4",
    fireflyColor1: "#67e8f9",
    fireflyColor2: "#fde68a",
    moonColor: "#8899cc",
    fogColor: "#0a0a1a",
    bgColor: "#0a0a1a",
    // Positioning
    islandPos: [0, -4, 0],
    islandScale: 0.035,
    islandRotationY: Math.PI * 1.1,
    encounterPos: [0.5, 5.5, -0.6],
    camPos: [7, 6.5, 3],
    camLookAtOffset: [0, 0.3, 0],
  },

  entei: {
    name: "entei",
    displayName: "Entei",
    model: "entei",
    island: "island_entei",
    // Red/orange fire theme
    accentColor: "red",
    accentColorHex: "#ef4444",
    secondaryColor: "#f59e0b",
    glowColor: "#f97316",
    hudBorder: "rgba(239, 68, 68, 0.18)",
    hudGlow: "rgba(239, 68, 68, 0.06)",
    badgeColor: "text-red-400/60",
    titleGradient: "linear-gradient(135deg, #fff 0%, #fca5a5 50%, #ef4444 100%)",
    // 3D
    spotlightColor: "#f97316",
    spotlightIntensity: 14,
    rimColor: "#ef4444",
    rimIntensity: 4,
    accentLightColor: "#f59e0b",
    auraColor1: "#f97316",
    auraColor2: "#ef4444",
    sparkleColor1: "#fb923c",
    sparkleColor2: "#fbbf24",
    fireflyColor1: "#f97316",
    fireflyColor2: "#ef4444",
    moonColor: "#cc6644",
    fogColor: "#1a0a0a",
    bgColor: "#1a0808",
    // Positioning
   // Positioning
    islandPos: [-4.2, 3.9, -1.1],
    islandScale: 0.17,
    islandRotationY: 5.34,
    encounterPos: [0.5, 5.5, -0.6],
    camPos: [6.2, 5.0, 3.0],
    camLookAtOffset: [0, 0.3, 0],
  },
};

export function getPokemonConfig(name: string): PokemonConfig {
  return POKEMON_CONFIGS[name] ?? POKEMON_CONFIGS.suicune;
}

export default POKEMON_CONFIGS;
