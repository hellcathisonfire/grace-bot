// Armazenamento simples: um único documento JSON { links: { [discordId]: brawlhallaId }, panels: [...] }.
// Com Upstash (REST) guarda no Redis; sem ele, no arquivo data/grace.json.
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";

const FILE = process.env.GRACE_DATA_FILE || "data/grace.json";
const UP_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
const UP_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
const KEY = "grace:data";
export const usingRedis = Boolean(UP_URL && UP_TOKEN);

async function redis(cmd) {
  const r = await fetch(UP_URL, { method: "POST", headers: { authorization: `Bearer ${UP_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error(`Upstash HTTP ${r.status}`);
  return (await r.json()).result;
}

let doc = null;
let queue = Promise.resolve();

async function load() {
  if (doc) return doc;
  let raw = null;
  try { raw = usingRedis ? await redis(["GET", KEY]) : await readFile(FILE, "utf8"); } catch {}
  try { doc = raw ? JSON.parse(raw) : {}; } catch { doc = {}; }
  doc.links ??= {};
  doc.panels ??= [];
  doc.meta ??= {};
  return doc;
}

// Salvamentos em fila: nunca dois ao mesmo tempo.
function save() {
  queue = queue.then(async () => {
    const json = JSON.stringify(doc, null, 2);
    if (usingRedis) return void (await redis(["SET", KEY, json]));
    await mkdir(dirname(FILE), { recursive: true });
    await writeFile(`${FILE}.tmp`, json);
    await rename(`${FILE}.tmp`, FILE);
  }).catch((e) => console.error("Falha ao salvar:", e.message));
  return queue;
}

export async function getLink(userId) { return (await load()).links[userId] ?? null; }
export async function setLink(userId, bhId) { (await load()).links[userId] = String(bhId); await save(); }
export async function removeLink(userId) { const d = await load(); const had = userId in d.links; delete d.links[userId]; await save(); return had; }
export async function getPanels() { return (await load()).panels; }
export async function setPanels(panels) { (await load()).panels = panels; await save(); }
export async function getMeta(key) { return (await load()).meta[key] ?? null; }
export async function setMeta(key, value) { (await load()).meta[key] = value; await save(); }
