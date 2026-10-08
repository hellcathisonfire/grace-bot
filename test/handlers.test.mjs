// npm run test:handlers — comandos com interações falsas e rede simulada.
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
process.env.GRACE_DATA_FILE = "data/test-grace.json";
rmSync("data/test-grace.json", { force: true });

const PLAYER = { id: 66541152, name: "Regulus", slug: "regulus", stats: { xp: 1, level: 523, xp_percentage: 0.3, games: 100, wins: 60 }, ranked: { "1v1": { rating: 2400, peak_rating: 2450, tier: "Diamond", wins: 50, games: 90, region: "brz" } }, clan: null,
  legends: [{ id: 1, name: "Imugi", name_key: "imugi", stats: { xp: 1, level: 80, xp_percentage: 0.5, damage_dealt: 10, damage_taken: 5, kos: 9, falls: 3, suicides: 1, team_kos: 0, matchtime: 3600, games: 100, wins: 60 }, weapon_one: { name: "Greatsword", time_held: 5 }, weapon_two: { name: "Katars", time_held: 1 }, ranked: { rating: 2400, peak_rating: 2450, tier: "Diamond", wins: 50, games: 90 } }] };
const LIVE = { mode: "1v1", region: "BRZ", ts: Date.now(), tracked: 10, cold: false, persistent: true, players: [], feed: [], hour: { games: 0, wins: 0, losses: 0, players: 0 } };
const real = globalThis.fetch;
globalThis.fetch = async (url) => {
  const u = String(url);
  const json = (b, st = 200) => new Response(JSON.stringify(b), { status: st, headers: { "content-type": "application/json" } });
  if (u.includes("/players/66541152")) return json({ data: PLAYER });
  if (u.includes("/players/")) return json({ error: "nf" }, 404);
  if (u.includes("/ranked/1v1")) return json({ data: [{ id: 66541152, name: "Regulus", rank: 12, rating: 2400, tier: "Diamond", region: "brz" }] });
  if (u.includes("/api/live")) { const q = new URL(u).searchParams; return json({ ...LIVE, mode: q.get("mode"), region: q.get("region") }); }
  return real(url);
};
const { handlers, component } = await import("../src/index.mjs");

const fake = (over = {}) => {
  const calls = [];
  const rec = (k) => async (x) => { calls.push([k, x]); };
  const o = { user: { id: "u1", displayName: "Eze" }, guildId: "g1", calls, deferred: false, replied: false,
    deferReply: async (x) => { o.deferred = true; calls.push(["defer", x]); }, deferUpdate: async () => { o.deferred = true; }, reply: rec("reply"), editReply: rec("edit"), followUp: rec("follow"),
    options: { getString: () => null, getUser: () => null, getSubcommand: () => "start" }, ...over };
  return o;
};
const opts = (m) => ({ getString: (k) => m[k] ?? null, getUser: (k) => m[k] ?? null, getSubcommand: () => m.sub });
const last = (i, k) => i.calls.filter((c) => c[0] === k).at(-1)?.[1];

// /profile sem vínculo
let i = fake({ options: opts({}) }); await handlers.profile(i);
assert.match(last(i, "reply").embeds[0].toJSON().title, /No account linked/);
// /link inválido e válido
i = fake({ options: opts({ id: "abc" }) }); await handlers.link(i); assert.match(last(i, "reply").embeds[0].toJSON().title, /doesn't look like/);
i = fake({ options: opts({ id: "99999" }) });
// ID inexistente: o erro sobe para o roteador (aqui conferimos que lança ApiError 404)
await assert.rejects(handlers.link(i), (e) => e.status === 404);
i = fake({ options: opts({ id: "66541152" }) }); await handlers.link(i); assert.match(last(i, "edit").embeds[0].toJSON().description, /Regulus/);
// /profile agora funciona e o botão Ranked também
i = fake({ options: opts({}) }); await handlers.profile(i);
assert.equal(last(i, "edit").embeds[0].toJSON().title, "Regulus");
const b = fake({ customId: "pf:ranked:66541152", isMessageComponent: () => true }); await component(b);
assert.match(last(b, "edit").embeds[0].toJSON().description, /Diamond/);
// busca, live, menus do live
i = fake({ options: opts({ name: "reg" }) }); await handlers.search(i); assert.ok(last(i, "edit").components.length === 1);
const pick = fake({ customId: "search:pick", values: ["66541152"] }); await component(pick); assert.equal(last(pick, "edit").embeds[0].toJSON().title, "Regulus");
i = fake({ options: opts({ mode: "2v2", region: "EU" }) }); await handlers.live(i); assert.match(last(i, "edit").embeds[0].toJSON().title, /2v2.*EU/);
const sel = fake({ customId: "lv:r:2v2", values: ["US-E"] }); await component(sel); assert.match(last(sel, "edit").embeds[0].toJSON().title, /2v2.*US-E/);
const btn = fake({ customId: "lv:m:rotating:SA" }); await component(btn); assert.match(last(btn, "edit").embeds[0].toJSON().title, /Rotating.*SA/);
// /unlink
i = fake({ options: opts({}) }); await handlers.unlink(i); assert.match(last(i, "reply").embeds[0].toJSON().title, /Unlinked/);
i = fake({ options: opts({}) }); await handlers.unlink(i); assert.match(last(i, "reply").embeds[0].toJSON().title, /Nothing to unlink/);
rmSync("data/test-grace.json", { force: true });
console.log("ok: handlers");
