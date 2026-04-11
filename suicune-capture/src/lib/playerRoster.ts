// Player roster — fetches Google Sheet CSV and gets player teams + badges

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTyfqJDGbFjXYJsCm2otDFSg9PwNQ3MCFBLE0H2pUU-fRxokkgMypRE22puK4ZuZv1otNyBf9KeFLA6/pub?gid=1351092451&single=true&output=csv";

// Badge column indices (A=0, B=1...)
// AM=38, AQ=42, AU=46, AY=50
const BADGE_COLUMNS = [38, 42, 46, 50];
export const REQUIRED_BADGES = 4;

export interface PlayerPokemon {
  name: string;
  level: number;
}

export interface Player {
  name: string;
  team: PlayerPokemon[];
  badges: number;
}

let cachedPlayers: Player[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === "," && !inQuotes) {
        fields.push(current);
        current = "";
      } else {
        current += c;
      }
    }
    fields.push(current);
    rows.push(fields);
  }
  return rows;
}

export async function fetchPlayers(): Promise<Player[]> {
  if (cachedPlayers && Date.now() - cacheTime < CACHE_DURATION) {
    return cachedPlayers;
  }

  try {
    const res = await fetch(SHEET_CSV_URL);
    if (!res.ok) throw new Error("Failed to fetch sheet");
    const text = await res.text();
    const rows = parseCSV(text);
    const dataRows = rows.slice(2);

    const players: Player[] = [];
    for (const row of dataRows) {
      const name = (row[0] || "").trim();
      if (!name) continue;

      const team: PlayerPokemon[] = [];
      // Columns B-M (indices 1-12), pairs of name/level
      for (let i = 1; i < 13; i += 2) {
        const pokemonName = (row[i] || "").trim();
        const levelStr = (row[i + 1] || "").trim();
        if (pokemonName && levelStr) {
          const level = parseInt(levelStr, 10);
          if (!isNaN(level)) {
            team.push({ name: pokemonName, level });
          }
        }
      }

      // Count badges from columns AM, AQ, AU, AY
      let badges = 0;
      for (const col of BADGE_COLUMNS) {
        const val = (row[col] || "").trim().toLowerCase();
        if (val === "oui" || val === "yes" || val === "o" || val === "x" || val === "1" || val === "true") {
          badges++;
        }
      }

      if (team.length > 0) {
        players.push({ name, team, badges });
      }
    }

    cachedPlayers = players;
    cacheTime = Date.now();
    return players;
  } catch (err) {
    console.error("Failed to fetch players:", err);
    return [];
  }
}

export async function findPlayer(pseudo: string): Promise<Player | null> {
  const players = await fetchPlayers();
  const search = pseudo.trim().toLowerCase();
  return players.find((p) => p.name.toLowerCase() === search) ?? null;
}
