// Emojis de aplicação: o Discord deixa o bot subir emojis próprios (até 2000) que funcionam em qualquer servidor.
// Usamos isso para mostrar a CABEÇA de cada lenda e o EMBLEMA de cada rank direto no texto dos cards.
// Tudo é automático: ao ligar, o bot sobe os emblemas (assets/ranks) e as cabeças das lendas (do próprio site).
// Se algo falhar, os cards continuam funcionando com emojis comuns no lugar.
import { readFile } from "node:fs/promises";
import { SITE } from "./api.mjs";

const MAX_BYTES = 256 * 1024;                       // limite do Discord por emoji
const RANKS = ["tin", "bronze", "silver", "gold", "platinum", "diamond", "valhallan"];
// Lendas conhecidas (slug = nome do arquivo em /legends-icons/). Lendas novas são subidas sozinhas na primeira vez que aparecem.
const LEGENDS = ["bodvar", "cassidy", "orion", "lord-vraxx", "gnash", "queen-nai", "hattori", "sir-roland", "scarlet", "thatch", "ada", "sentinel", "lucien", "teros", "brynn", "asuri", "barraza", "ember", "azoth", "koji", "ulgrim", "diana", "jhala", "kor", "wu-shang", "val", "ragnir", "cross", "mirage", "nix", "mordex", "yumiko", "artemis", "caspian", "sidra", "xull", "kaya", "isaiah", "jiro", "lin-fei", "zariel", "rayman", "dusk", "fait", "thor", "petra", "vector", "volkov", "onyx", "jaeyun", "mako", "magyar", "reno", "munin", "arcadia", "ezio", "tezca", "thea", "red-raptor", "loki", "seven", "vivi", "imugi", "king-zuva"];

const have = new Map();        // nome -> id
const failed = new Set();      // nomes que não deu para criar (não tenta de novo até reiniciar)
const queued = new Set();
let ctx = null;                // { rest, appId }
let working = false;

export const legendEmojiName = (slug) => ("lg_" + String(slug).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")).slice(0, 32);
export const rankEmojiName = (key) => "rk_" + String(key).toLowerCase();
const tag = (name) => (have.has(name) ? `<:${name}:${have.get(name)}>` : "");

/** Emoji da cabeça da lenda, ou "" se ainda não existe (e agenda o upload). */
export function legendEmoji(slug) {
  if (!slug) return "";
  const name = legendEmojiName(slug);
  if (!have.has(name)) warm([slug]);
  return tag(name);
}
/** Emoji do emblema do rank (key: "Diamond", "Valhallan"...), ou "". */
export const rankEmoji = (key) => (key ? tag(rankEmojiName(key)) : "");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function create(name, dataUri) {
  const e = await ctx.rest.post(`/applications/${ctx.appId}/emojis`, { body: { name, image: dataUri } });
  have.set(name, e.id);
}

async function fetchLegendImage(slug) {
  const res = await fetch(`${SITE}/legends-icons/${encodeURIComponent(slug)}.png`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error(`imagem grande demais (${buf.length} bytes)`);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

async function work() {
  if (working || !ctx) return;
  working = true;
  try {
    for (const slug of queued) {
      queued.delete(slug);
      const name = legendEmojiName(slug);
      if (have.has(name) || failed.has(name)) continue;
      try { await create(name, await fetchLegendImage(slug)); await sleep(350); }
      catch (e) { failed.add(name); console.error(`Emoji da lenda ${slug}:`, e.message); }
    }
  } finally { working = false; }
  if (queued.size) work();
}

/** Agenda o upload das cabeças que ainda não existem (não bloqueia quem chamou). */
export function warm(slugs) {
  for (const s of slugs) { const name = legendEmojiName(s); if (s && !have.has(name) && !failed.has(name)) queued.add(s); }
  if (queued.size) work().catch((e) => console.error("emoji:", e.message));
}

/** Chamado ao ligar: lê os emojis que já existem, sobe os emblemas que faltam e agenda as cabeças. */
export async function initEmojis(rest, appId) {
  ctx = { rest, appId };
  const list = await rest.get(`/applications/${appId}/emojis`);
  for (const e of list?.items ?? []) have.set(e.name, e.id);
  for (const key of RANKS) {
    const name = rankEmojiName(key);
    if (have.has(name)) continue;
    try {
      const img = await readFile(new URL(`../assets/ranks/${key}.png`, import.meta.url));
      await create(name, `data:image/png;base64,${img.toString("base64")}`);
    } catch (e) { failed.add(name); console.error(`Emoji do rank ${key}:`, e.message); }
  }
  warm(LEGENDS);
  console.log(`Emojis prontos: ${have.size} no total (${queued.size} cabeças de lendas ainda na fila).`);
}

export const emojiStats = () => ({ have: have.size, queued: queued.size, failed: failed.size });
