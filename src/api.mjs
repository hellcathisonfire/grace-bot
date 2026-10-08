// Acesso aos dados: jogadores/ranking na dair.api (mesma fonte do site) e Live Ranked no próprio site (/api/live).
const DAIR = (process.env.DAIR_API_BASE || process.env.ALT_SOURCE_BASE || "https://api.dair.gg").replace(/\/+$/, "");
export const SITE = (process.env.GRACEHALLA_URL || "https://grace-halla.vercel.app").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(status, message = "") { super(message || `HTTP ${status}`); this.status = status; }
}

// Cache curto em memória (e deduplica pedidos iguais ao mesmo tempo).
const cache = new Map();
async function getJson(url, ttlMs, timeoutMs = 9000) {
  const hit = cache.get(url);
  if (hit && hit.exp > Date.now()) return hit.p;
  const p = (async () => {
    let res;
    try { res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: "application/json", "user-agent": "GraceHalla-Grace-Bot/1.0" } }); }
    catch (e) { throw new ApiError(504, `sem resposta: ${e.message}`); }
    if (!res.ok) throw new ApiError(res.status, (await res.text().catch(() => "")).slice(0, 200));
    return res.json();
  })();
  cache.set(url, { exp: Date.now() + ttlMs, p });
  p.catch(() => cache.delete(url));
  if (cache.size > 300) for (const [k, v] of cache) if (v.exp < Date.now()) cache.delete(k);
  return p;
}

export const isBhId = (s) => /^\d{1,12}$/.test(String(s).trim());

export async function getPlayer(id) {
  if (!isBhId(id)) throw new ApiError(400, "ID inválido");
  return (await getJson(`${DAIR}/v1/brawlhalla/players/${encodeURIComponent(String(id).trim())}`, 120_000)).data;
}

// Busca no ranking 1v1 por nome (só acha quem tem ranked).
export async function searchRanked(name) {
  const q = new URLSearchParams({ region: "all", page: "1", name });
  return (await getJson(`${DAIR}/v1/brawlhalla/ranked/1v1?${q}`, 60_000, 8000)).data ?? [];
}

// Posição regional (ex.: #123 em BRZ). null se não achar.
export async function getRegionRank(p, region) {
  if (!region) return null;
  try {
    const q = new URLSearchParams({ region: region.toLowerCase(), page: "1", name: p.name });
    const rows = (await getJson(`${DAIR}/v1/brawlhalla/ranked/1v1?${q}`, 300_000, 6000)).data ?? [];
    const hit = rows.find((r) => r.id === p.id);
    return hit ? hit.rank : null;
  } catch { return null; }
}

// Live Ranked: o mesmo endpoint que alimenta a página /live do site.
export async function getLive(mode, region) {
  const q = new URLSearchParams({ mode, region });
  return getJson(`${SITE}/api/live?${q}`, 15_000, 12_000);
}
