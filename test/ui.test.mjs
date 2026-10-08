// npm test  —  monta todos os cards com dados de exemplo e confere os limites do Discord. Não conecta em nada.
import assert from "node:assert/strict";
import { payload } from "../src/commands.mjs";
import { liveMessage, profileMessage, searchMessage, linkedMessage, TABS, tierInfo, bar, signed, dur } from "../src/ui.mjs";

const leg = (name, games, wins, rating, peak) => ({
  id: 1, name, name_key: name.toLowerCase(),
  stats: { xp: 1e6, level: 80, xp_percentage: 0.42, damage_dealt: 5e6, damage_taken: 2e6, kos: 20000, falls: 9000, suicides: 800, team_kos: 30, matchtime: 400000, games, wins },
  weapon_one: { name: "Greatsword", damage_dealt: 1, kos: 1, time_held: 900 }, weapon_two: { name: "Katars", damage_dealt: 1, kos: 1, time_held: 300 },
  ranked: rating ? { rating, peak_rating: peak, tier: "Diamond", wins: Math.floor(games / 2), games } : null,
});
const player = {
  id: 66541152, name: "Regulus", slug: "regulus",
  stats: { xp: 5507697, level: 523, xp_percentage: 0.27, games: 43362, wins: 31109 },
  ranked: { "1v1": { rating: 2412, peak_rating: 2440, tier: "Diamond", wins: 900, games: 1500, region: "brz" } },
  clan: { id: 1, name: "Lavender Grace", rank: "Leader", xp: 1, personal_xp: 1, joined_at: 1, members_count: 20 },
  legends: ["Imugi", "Bödvar", "Ada", "Kor", "Mako", "Thatch", "Orion", "Hattori", "Sidra"].map((n, k) => leg(n, 3000 - k * 200, 1600 - k * 90, k < 7 ? 2400 - k * 30 : 0, 2450 - k * 30)),
};
const unranked = { ...player, ranked: null, clan: null, legends: [] };

const check = (m, label) => {
  for (const e of m.embeds) {
    const j = e.toJSON();
    const total = (j.title?.length ?? 0) + (j.description?.length ?? 0) + (j.footer?.text.length ?? 0) + (j.author?.name.length ?? 0) + (j.fields ?? []).reduce((a, f) => a + f.name.length + f.value.length, 0);
    assert.ok((j.description?.length ?? 0) <= 4096, `${label}: description`);
    assert.ok((j.fields ?? []).length <= 25, `${label}: fields`);
    for (const f of j.fields ?? []) { assert.ok(f.name.length && f.value.length, `${label}: empty field`); assert.ok(f.name.length <= 256 && f.value.length <= 1024, `${label}: field size`); }
    assert.ok(total <= 6000, `${label}: total ${total}`);
  }
  for (const row of m.components ?? []) { const j = row.toJSON(); assert.ok(j.components.length <= 5, `${label}: row size`); for (const c of j.components) assert.ok(!c.custom_id || c.custom_id.length <= 100, `${label}: custom_id`); }
};

for (const [tab] of TABS) { check(profileMessage(player, tab, { regionRank: 123 }), `profile/${tab}`); check(profileMessage(unranked, tab), `unranked/${tab}`); }

const ev = (k) => ({ id: "e" + k, t: Date.now() - k * 60000, k: "x", names: k % 2 ? ["Alpha"] : ["Alpha", "Beta"], ids: [1], tier: "Diamond", wins: k % 3 ? 1 : 0, losses: k % 3 ? 0 : 1, delta: k % 3 ? 21 : -19, rating: 2400 + k, rkFrom: 5, rkTo: 4, legend: { id: 1, name: "Imugi", slug: "imugi" } });
const live = {
  mode: "1v1", region: "BRZ", ts: Date.now(), tracked: 200, cold: false, persistent: true,
  players: Array.from({ length: 12 }, (_, k) => ({ k: "p" + k, names: ["Player" + k + "WithALongishName"], ids: [k], tier: "Platinum 3", rating: 1900 + k, peak: 2000, rank: k + 1, lastT: Date.now(), status: k < 5 ? "active" : "recent", totalGames: 1, totalWins: 1, session: { games: 4, wins: 3, losses: 1, delta: 41, rkStart: 9, startT: 1 }, legend: { id: 1, name: "Lord Vraxx", slug: "lord-vraxx" }, matches: [] })),
  feed: Array.from({ length: 12 }, (_, k) => ev(k)),
  hour: { games: 87, wins: 50, losses: 37, players: 30, bestGain: { names: ["Alpha"], delta: 63 } },
};
check(liveMessage(live, "1v1", "BRZ"), "live");
check(liveMessage({ ...live, cold: true, players: [], feed: [], hour: { games: 0, wins: 0, losses: 0, players: 0 } }, "2v2", "US-E"), "live/empty");
check(searchMessage("reg", [{ id: 1, name: "Regulus", rank: 12, rating: 2412, tier: "Diamond", region: "brz" }]), "search");
check(searchMessage("zzz", []), "search/empty");
check(linkedMessage(player), "linked");

assert.equal(tierInfo("Platinum 5").key, "Platinum"); assert.equal(tierInfo("Valhallan").key, "Valhallan"); assert.equal(tierInfo(null).key, null);
assert.equal(bar(0.5, 10), "▰▰▰▰▰▱▱▱▱▱"); assert.equal(signed(-5), "−5"); assert.equal(dur(7200 + 125), "2h 2m");
const cmds = payload(); assert.deepEqual(cmds.map((c) => c.name), ["link", "unlink", "profile", "search", "live", "livepanel"]);
console.log("ok:", cmds.length, "comandos e todos os cards dentro dos limites do Discord");
