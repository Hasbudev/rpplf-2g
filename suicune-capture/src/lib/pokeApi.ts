// PokeAPI fetcher — gets pokemon types and sprite

import { TYPE_FR, type PokemonType, type Move } from "./battleSystem";

// French pokemon names → English (PokeAPI uses English)
// We translate the most common Gen 1-2 pokemons. For others, fall back to lowercase.
const FRENCH_TO_ENGLISH: Record<string, string> = {
  // Starters
  "bulbizarre": "bulbasaur", "herbizarre": "ivysaur", "florizarre": "venusaur",
  "salameche": "charmander", "reptincel": "charmeleon", "dracaufeu": "charizard",
  "carapuce": "squirtle", "carabaffe": "wartortle", "tortank": "blastoise",
  "germignon": "chikorita", "macronium": "bayleef", "meganium": "meganium",
  "héricendre": "cyndaquil", "hericendre": "cyndaquil", "feurisson": "quilava", "typhlosion": "typhlosion",
  "kaiminus": "totodile", "crocrodil": "croconaw", "aligatueur": "feraligatr",
  // Common
  "rattata": "rattata", "rattatac": "raticate", "roucool": "pidgey",
  "roucoups": "pidgeotto", "roucarnage": "pidgeot", "piafabec": "spearow",
  "rapasdepic": "fearow", "abo": "ekans", "arbok": "arbok", "pikachu": "pikachu",
  "raichu": "raichu", "sabelette": "sandshrew", "sablaireau": "sandslash",
  "nidoran♀": "nidoran-f", "nidorina": "nidorina", "nidoqueen": "nidoqueen",
  "nidoran♂": "nidoran-m", "nidorino": "nidorino", "nidoking": "nidoking",
  "melofee": "clefairy", "mélofée": "clefairy", "melodelfe": "clefable",
  "goupix": "vulpix", "feunard": "ninetales", "rondoudou": "jigglypuff",
  "grodoudou": "wigglytuff", "nosferapti": "zubat", "nosferalto": "golbat",
  "mystherbe": "oddish", "ortide": "gloom", "rafflesia": "vileplume",
  "paras": "paras", "parasect": "parasect", "mimitoss": "venonat",
  "aeromite": "venomoth", "taupiqueur": "diglett", "triopikeur": "dugtrio",
  "miaouss": "meowth", "persian": "persian", "psykokwak": "psyduck",
  "akwakwak": "golduck", "ferosinge": "mankey", "férosinge": "mankey",
  "colossinge": "primeape", "caninos": "growlithe", "arcanin": "arcanine",
  "ptitard": "poliwag", "tetarte": "poliwhirl", "tartard": "poliwrath",
  "abra": "abra", "kadabra": "kadabra", "alakazam": "alakazam",
  "machoc": "machop", "machopeur": "machoke", "mackogneur": "machamp",
  "chetiflor": "bellsprout", "boustiflor": "weepinbell", "empiflor": "victreebel",
  "tentacool": "tentacool", "tentacruel": "tentacruel", "racaillou": "geodude",
  "gravalanch": "graveler", "grolem": "golem", "ponyta": "ponyta",
  "galopa": "rapidash", "ramoloss": "slowpoke", "flagadoss": "slowbro",
  "magneti": "magnemite", "magneton": "magneton", "canarticho": "farfetchd",
  "doduo": "doduo", "dodrio": "dodrio", "otaria": "seel", "lamantine": "dewgong",
  "tadmorv": "grimer", "grotadmorv": "muk", "kokiyas": "shellder",
  "crustabri": "cloyster", "fantominus": "gastly", "spectrum": "haunter",
  "ectoplasma": "gengar", "onix": "onix", "soporifik": "drowzee",
  "hypnomade": "hypno", "krabby": "krabby", "krabboss": "kingler",
  "voltorbe": "voltorb", "electrode": "electrode", "noeunoeuf": "exeggcute",
  "noadkoko": "exeggutor", "osselait": "cubone", "ossatueur": "marowak",
  "kicklee": "hitmonlee", "tygnon": "hitmonchan", "excelangue": "lickitung",
  "smogo": "koffing", "smogogo": "weezing", "rhinocorne": "rhyhorn",
  "rhinoferos": "rhydon", "leveinard": "chansey", "saquedeneu": "tangela",
  "kangourex": "kangaskhan", "hypotrempe": "horsea", "hypocean": "seadra",
  "poissirene": "goldeen", "poissoroy": "seaking", "stari": "staryu",
  "staross": "starmie", "mr.mime": "mr-mime", "m.mime": "mr-mime",
  "insecateur": "scyther", "insécateur": "scyther", "lippoutou": "jynx",
  "elektek": "electabuzz", "magmar": "magmar", "scarabrute": "pinsir",
  "tauros": "tauros", "magicarpe": "magikarp", "leviator": "gyarados",
  "lokhlass": "lapras", "metamorph": "ditto", "evoli": "eevee",
  "aquali": "vaporeon", "voltali": "jolteon", "pyroli": "flareon",
  "porygon": "porygon", "amonita": "omanyte", "amonistar": "omastar",
  "kabuto": "kabuto", "kabutops": "kabutops", "ptera": "aerodactyl",
  "ronflex": "snorlax", "artikodin": "articuno", "electhor": "zapdos",
  "sulfura": "moltres", "minidraco": "dratini", "draco": "dragonair",
  "dracolosse": "dragonite", "mewtwo": "mewtwo", "mew": "mew",
  // Gen 2
  "leuphorie": "blissey", "togepi": "togepi", "togetic": "togetic",
  "natu": "natu", "xatu": "xatu", "wattouat": "mareep", "lainergie": "flaaffy",
  "pharamp": "ampharos", "joliflor": "bellossom", "marill": "marill",
  "azumarill": "azumarill", "simularbre": "sudowoodo", "tarpaud": "politoed",
  "granivol": "hoppip", "floravol": "skiploom", "cotovol": "jumpluff",
  "capumain": "aipom", "tournegrin": "sunkern", "heliatronc": "sunflora",
  "yanma": "yanma", "axoloto": "wooper", "maraiste": "quagsire",
  "mentali": "espeon", "noctali": "umbreon", "cornebre": "murkrow",
  "roigada": "slowking", "feuforeve": "misdreavus", "zarbi": "unown",
  "qulbutoke": "wobbuffet", "girafarig": "girafarig", "pomdepik": "pineco",
  "foretress": "forretress", "insolourdo": "dunsparce", "scarhino": "heracross",
  "farfuret": "sneasel", "teddiursa": "teddiursa", "ursaring": "ursaring",
  "limagma": "slugma", "volcaropod": "magcargo", "marcacrin": "swinub",
  "cochignon": "piloswine", "corayon": "corsola", "remoraid": "remoraid",
  "octillery": "octillery", "cadoizo": "delibird", "demanta": "mantine",
  "airmure": "skarmory", "malosse": "houndour", "demolosse": "houndoom",
  "hyporoi": "kingdra", "phanpy": "phanpy", "donphan": "donphan",
  "porygon2": "porygon2", "cerfrousse": "stantler", "queulorior": "smeargle",
  "debugant": "tyrogue", "kapoera": "tyrogue", "lippouti": "smoochum",
  "elekid": "elekid", "magby": "magby", "ecremeuh": "miltank",
  "raikou": "raikou", "entei": "entei", "suicune": "suicune",
  "embrylex": "larvitar", "ymphect": "pupitar", "tyranocif": "tyranitar",
  "lugia": "lugia", "ho-oh": "ho-oh", "celebi": "celebi",
};

export interface PokemonData {
  name: string;
  types: PokemonType[];
  sprite: string;
  spriteAnimated?: string;
  baseHP: number;
  baseAttack: number;
}

const cache = new Map<string, PokemonData>();

function normalizeName(french: string): string {
  const lower = french.toLowerCase().trim().replace(/\s+/g, "");
  return FRENCH_TO_ENGLISH[lower] || lower;
}

export async function fetchPokemonData(frenchName: string): Promise<PokemonData | null> {
  const apiName = normalizeName(frenchName);

  if (cache.has(apiName)) return cache.get(apiName)!;

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${apiName}`);
    if (!res.ok) {
      console.warn(`Pokemon not found: ${frenchName} (${apiName})`);
      return null;
    }
    const data = await res.json();

    const types = data.types.map((t: any) => TYPE_FR[t.type.name]).filter(Boolean);
    const baseHP = data.stats.find((s: any) => s.stat.name === "hp")?.base_stat ?? 70;
    const baseAttack = data.stats.find((s: any) => s.stat.name === "attack")?.base_stat ?? 70;

    // Try animated sprite first (Showdown), fallback to official artwork
    const spriteAnimated =
      data.sprites?.versions?.["generation-v"]?.["black-white"]?.animated?.front_default;
    const sprite =
      data.sprites?.other?.["official-artwork"]?.front_default ||
      data.sprites?.front_default;

    const result: PokemonData = {
      name: frenchName,
      types,
      sprite: sprite || "",
      spriteAnimated: spriteAnimated || undefined,
      baseHP,
      baseAttack,
    };

    cache.set(apiName, result);
    return result;
  } catch (err) {
    console.error(`Error fetching ${frenchName}:`, err);
    return null;
  }
}

// Batch fetch for multiple pokemon
export async function fetchPokemonBatch(names: string[]): Promise<Map<string, PokemonData>> {
  const results = new Map<string, PokemonData>();
  await Promise.all(
    names.map(async (name) => {
      const data = await fetchPokemonData(name);
      if (data) results.set(name, data);
    })
  );
  return results;
}

/* ═══════════════════════════════════════════════
   REAL LEVEL-UP MOVESET FETCHER
   ═══════════════════════════════════════════════ */


const moveDetailCache = new Map<string, Move | null>();
const movepoolCache   = new Map<string, Move[]>();

const AILMENT_MAP: Record<string, Move["effect"]> = {
  "paralysis":  "paralysis",
  "burn":       "burn",
  "freeze":     "freeze",
  "poison":     "poison",
  "bad-poison": "poison",
  "sleep":      "sleep",
};

async function fetchMoveDetails(moveName: string): Promise<Move | null> {
  if (moveDetailCache.has(moveName)) return moveDetailCache.get(moveName)!;
  try {
    const res  = await fetch(`https://pokeapi.co/api/v2/move/${moveName}`);
    if (!res.ok) { moveDetailCache.set(moveName, null); return null; }
    const data = await res.json();

    // French name
    const frEntry = data.names?.find((n: any) => n.language.name === "fr");
    const name    = frEntry?.name ?? moveName;

    const typeFr  = TYPE_FR[data.type?.name] as PokemonType | undefined;
    if (!typeFr)  { moveDetailCache.set(moveName, null); return null; }

    const power: number = data.power ?? 0;

    const ailmentName: string = data.meta?.ailment?.name ?? "none";
    const effect     = AILMENT_MAP[ailmentName];
    const effectChance = effect && data.meta?.ailment_chance
      ? data.meta.ailment_chance / 100
      : undefined;

    const move: Move = {
      name,
      power,
      type: typeFr,
      ...(effect ? { effect, effectChance } : {}),
    };

    moveDetailCache.set(moveName, move);
    return move;
  } catch {
    moveDetailCache.set(moveName, null);
    return null;
  }
}

export async function fetchLevelUpMoves(frenchName: string): Promise<Move[]> {
  const apiName = normalizeName(frenchName);
  if (movepoolCache.has(apiName)) return movepoolCache.get(apiName)!;

  try {
    const res  = await fetch(`https://pokeapi.co/api/v2/pokemon/${apiName}`);
    if (!res.ok) return [];
    const data = await res.json();

    const levelUpMoves: { name: string; level: number }[] = [];
    const seen = new Set<string>();

    for (const entry of data.moves ?? []) {
      for (const vgd of entry.version_group_details ?? []) {
        if (
          vgd.move_learn_method?.name === "level-up" &&
          vgd.level_learned_at <= 100 &&
          !seen.has(entry.move.name)
        ) {
          seen.add(entry.move.name);
          levelUpMoves.push({ name: entry.move.name, level: vgd.level_learned_at });
          break;
        }
      }
    }

    levelUpMoves.sort((a, b) => a.level - b.level);

    const details = await Promise.all(
      levelUpMoves.map(m => fetchMoveDetails(m.name))
    );

    const pool = details.filter((m): m is Move => m !== null);
    movepoolCache.set(apiName, pool);
    return pool;
  } catch {
    return [];
  }
}