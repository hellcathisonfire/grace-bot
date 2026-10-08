// Tudo que o bot mostra: embeds e botões. Mantido num só lugar para o visual ficar consistente.
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from "discord.js";
import { SITE } from "./api.mjs";

export const ACCENT = 0xa78bfa;
export const ERROR_COLOR = 0xf87171;
export const MODES = [["1v1", "1v1"], ["2v2", "2v2"], ["rotating", "Rotating"]];
export const REGIONS = ["BRZ", "US-E", "US-W", "EU", "SEA", "AUS", "SA", "JPN", "ME", "SAF"];

// ---------- formatação ----------
const nf = new Intl.NumberFormat("en-US");
export const n = (v) => nf.format(Math.round(Number(v) || 0));
export const pct = (a, b) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "—");
export const bar = (f, len = 12) => { const k = Math.round(Math.max(0, Math.min(1, f)) * len); return "▰".repeat(k) + "▱".repeat(len - k); };
export const signed = (v) => (v > 0 ? `+${n(v)}` : v < 0 ? `−${n(Math.abs(v))}` : "±0");
export const dur = (sec) => { const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60); return h ? `${n(h)}h ${m}m` : `${m}m`; };
const slug = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const pretty = (s) => {
  const t = String(s ?? "").replace(/[_-]+/g, " ").trim();
  return t && (t === t.toLowerCase() || t === t.toUpperCase()) ? t.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : t;
};
const pad = (s, w) => String(s).slice(0, w).padEnd(w);
const padL = (s, w) => String(s).slice(0, w).padStart(w);
const clip = (s, max = 1000) => (s.length <= max ? s : s.slice(0, max - 1).replace(/\n[^\n]*$/, "") + "\n…");
const names = (a) => (a?.length ? a.join(" & ") : "?");
const legendIcon = (name) => `${SITE}/legends-icons/${slug(name)}.png`;

// ---------- ranks ----------
const TIERS = {
  Tin: ["#aab0ba", "🔘"], Bronze: ["#e39a56", "🥉"], Silver: ["#e4e9f1", "🥈"], Gold: ["#ffd75e", "🥇"],
  Platinum: ["#6df0dc", "💠"], Diamond: ["#7cc4ff", "💎"], Valhallan: ["#ff7aa2", "👑"],
};
export function tierInfo(tier) {
  const w = String(tier ?? "").trim().split(/\s+/)[0].toLowerCase();
  const key = w.startsWith("valhall") ? "Valhallan" : Object.keys(TIERS).find((t) => t.toLowerCase() === w);
  return key ? { key, color: parseInt(TIERS[key][0].slice(1), 16), emoji: TIERS[key][1] } : { key: null, color: ACCENT, emoji: "▫️" };
}

// ---------- jogador ----------
function summarize(p) {
  const L = p.legends ?? [];
  const sum = (f) => L.reduce((a, l) => a + (Number(f(l)) || 0), 0);
  const main = [...L].sort((a, b) => (b.stats?.games ?? 0) - (a.stats?.games ?? 0))[0];
  const weapons = new Map();
  for (const l of L) for (const w of [l.weapon_one, l.weapon_two]) if (w?.name) weapons.set(w.name, (weapons.get(w.name) ?? 0) + (Number(w.time_held) || 0));
  const topWeapon = [...weapons].sort((a, b) => b[1] - a[1])[0]?.[0];
  return {
    kos: sum((l) => l.stats?.kos), falls: sum((l) => l.stats?.falls), suicides: sum((l) => l.stats?.suicides), teamKos: sum((l) => l.stats?.team_kos),
    dealt: sum((l) => l.stats?.damage_dealt), taken: sum((l) => l.stats?.damage_taken), time: sum((l) => l.stats?.matchtime),
    legendLevels: sum((l) => l.stats?.level), main, topWeapon,
  };
}

export const TABS = [["overview", "Overview"], ["ranked", "Ranked"], ["legends", "Legends"], ["combat", "Combat"]];

function shell(p, tab, color) {
  const label = TABS.find(([k]) => k === tab)?.[1] ?? "";
  const s = summarize(p);
  const e = new EmbedBuilder().setColor(color).setTitle(p.name).setURL(`${SITE}/player/${p.id}`)
    .setAuthor({ name: `GraceHalla  ·  ${label}`, iconURL: `${SITE}/apple-icon.png` })
    .setFooter({ text: `ID ${p.id}  ·  grace-halla.vercel.app`, iconURL: `${SITE}/apple-icon.png` });
  if (s.main?.name) e.setThumbnail(legendIcon(s.main.name));
  return { e, s };
}

export function profileEmbed(p, tab = "overview", extra = {}) {
  const r = p.ranked?.["1v1"] ?? null;
  const t = tierInfo(r?.tier);
  const { e, s } = shell(p, tab, r ? t.color : ACCENT);
  const games = p.stats?.games ?? 0, wins = p.stats?.wins ?? 0;

  if (tab === "ranked") {
    if (!r) return e.setDescription("*No ranked 1v1 data for this player yet.*");
    e.setDescription(`${t.emoji}  **${r.tier ?? "Unranked"}**\n**${n(r.rating)} elo**`);
    e.addFields(
      { name: "Games", value: `**${n(r.games)}**`, inline: true },
      { name: "Wins", value: `**${n(r.wins)}**`, inline: true },
      { name: "Win rate", value: `**${pct(r.wins, r.games)}**`, inline: true },
      { name: "Region", value: `**${(r.region ?? "—").toUpperCase()}**`, inline: true },
      { name: "Regional rank", value: extra.regionRank ? `**#${n(extra.regionRank)}**` : "—", inline: true },
      { name: "Peak elo", value: `**${n(r.peak_rating)}**`, inline: true },
    );
    const rows = (p.legends ?? []).filter((l) => l.ranked && l.ranked.games > 0).sort((a, b) => b.ranked.rating - a.ranked.rating).slice(0, 6);
    if (rows.length) {
      const table = [`${pad("Legend", 12)} ${padL("Elo", 5)} ${padL("Peak", 5)} ${padL("Win%", 5)}`, ...rows.map((l) =>
        `${pad(pretty(l.name), 12)} ${padL(l.ranked.rating, 5)} ${padL(l.ranked.peak_rating, 5)} ${padL(Math.round((l.ranked.wins / l.ranked.games) * 100) + "%", 5)}`)].join("\n");
      e.addFields({ name: "Top legends · 1v1", value: "```\n" + table + "\n```" });
    }
    return e;
  }

  if (tab === "legends") {
    const rows = [...(p.legends ?? [])].filter((l) => l.stats?.games > 0).sort((a, b) => b.stats.games - a.stats.games).slice(0, 8);
    if (!rows.length) return e.setDescription("*No legend data yet.*");
    const table = [`${pad("Legend", 12)} ${padL("Lv", 3)} ${padL("Games", 6)} ${padL("Win%", 5)}`, ...rows.map((l) =>
      `${pad(pretty(l.name), 12)} ${padL(l.stats.level, 3)} ${padL(n(l.stats.games), 6)} ${padL(Math.round((l.stats.wins / l.stats.games) * 100) + "%", 5)}`)].join("\n");
    return e.setDescription(`Top ${rows.length} by games played\n\`\`\`\n${table}\n\`\`\``).addFields(
      { name: "Legends played", value: `**${n((p.legends ?? []).filter((l) => l.stats?.games > 0).length)}**`, inline: true },
      { name: "Combined levels", value: `**${n(s.legendLevels)}**`, inline: true },
    );
  }

  if (tab === "combat") {
    const share = s.dealt + s.taken > 0 ? s.dealt / (s.dealt + s.taken) : 0;
    return e.setDescription(`**Damage share**  ${bar(share, 14)}  **${(share * 100).toFixed(1)}%**`).addFields(
      { name: "KOs", value: `**${n(s.kos)}**`, inline: true },
      { name: "Falls", value: `**${n(s.falls)}**`, inline: true },
      { name: "KO rate", value: `**${pct(s.kos, s.kos + s.falls)}**`, inline: true },
      { name: "Damage dealt", value: `**${n(s.dealt)}**`, inline: true },
      { name: "Damage taken", value: `**${n(s.taken)}**`, inline: true },
      { name: "Ratio", value: `**${s.taken ? (s.dealt / s.taken).toFixed(2) : "—"}**`, inline: true },
      { name: "Suicides", value: `**${n(s.suicides)}**`, inline: true },
      { name: "Team KOs", value: `**${n(s.teamKos)}**`, inline: true },
      { name: "Playtime", value: `**${dur(s.time)}**`, inline: true },
    );
  }

  // overview
  const f = p.stats?.xp_percentage ?? 0;
  const frac = f > 1 ? f / 100 : f;
  const lines = [`**Level ${n(p.stats?.level)}**  ${bar(frac)}  ${Math.round(frac * 100)}%`];
  if (p.clan?.name) lines.push(`🛡️  **${p.clan.name}**${p.clan.rank ? `  ·  ${pretty(p.clan.rank)}` : ""}`);
  lines.push(r ? `${t.emoji}  **${r.tier}**  ·  ${n(r.rating)} elo  *(peak ${n(r.peak_rating)})*` : "▫️  *Unranked in 1v1*");
  e.setDescription(lines.join("\n"));
  e.addFields(
    { name: "Games", value: `**${n(games)}**`, inline: true },
    { name: "Wins", value: `**${n(wins)}**`, inline: true },
    { name: "Win rate", value: `**${pct(wins, games)}**`, inline: true },
    { name: "Playtime", value: `**${dur(s.time)}**`, inline: true },
    { name: "KOs", value: `**${n(s.kos)}**`, inline: true },
    { name: "Falls", value: `**${n(s.falls)}**`, inline: true },
    { name: "Most played", value: s.main ? `**${pretty(s.main.name)}**\n${n(s.main.stats.games)} games` : "—", inline: true },
    { name: "Top weapon", value: s.topWeapon ? `**${pretty(s.topWeapon)}**` : "—", inline: true },
    { name: "Legend levels", value: `**${n(s.legendLevels)}**`, inline: true },
  );
  return e;
}

export function profileComponents(id, active) {
  const row = new ActionRowBuilder().addComponents(
    ...TABS.map(([k, label]) => new ButtonBuilder().setCustomId(`pf:${k}:${id}`).setLabel(label).setStyle(k === active ? ButtonStyle.Primary : ButtonStyle.Secondary)),
    new ButtonBuilder().setLabel("Website").setStyle(ButtonStyle.Link).setURL(`${SITE}/player/${id}`),
  );
  return [row];
}

export const profileMessage = (p, tab = "overview", extra = {}) => ({ embeds: [profileEmbed(p, tab, extra)], components: profileComponents(p.id, tab) });

// ---------- busca ----------
export function searchMessage(query, rows) {
  const list = rows.slice(0, 10);
  const e = new EmbedBuilder().setColor(ACCENT).setAuthor({ name: "GraceHalla  ·  Search", iconURL: `${SITE}/apple-icon.png` })
    .setFooter({ text: "Only players with ranked 1v1 games show up here. Use /profile id: for anyone else." });
  if (!list.length) return { embeds: [e.setTitle("No players found").setDescription(`Nothing for **${query}**.\nTry the exact in-game name, or look the player up by ID with \`/profile id:\`.`)], components: [] };
  e.setTitle(`Results for “${query}”`).setDescription(list.map((r) => {
    const t = tierInfo(r.tier);
    return `**${r.rank ? "#" + n(r.rank) : "·"}**  ${t.emoji}  **${r.name}**  ·  ${r.tier ?? ""} ${n(r.rating)}  ·  ${String(r.region ?? "").toUpperCase()}`;
  }).join("\n"));
  const menu = new StringSelectMenuBuilder().setCustomId("search:pick").setPlaceholder("Open a profile…").addOptions(list.map((r) => ({
    label: String(r.name).slice(0, 100), description: `${r.tier ?? ""} ${n(r.rating)} elo · ID ${r.id}`.slice(0, 100), value: String(r.id),
  })));
  return { embeds: [e], components: [new ActionRowBuilder().addComponents(menu)] };
}

// ---------- vínculo ----------
export const linkedMessage = (p) => ({ embeds: [new EmbedBuilder().setColor(ACCENT).setAuthor({ name: "Account linked", iconURL: `${SITE}/apple-icon.png` })
  .setTitle(p.name).setURL(`${SITE}/player/${p.id}`)
  .setDescription(`Your Discord is now linked to **${p.name}** (ID \`${p.id}\`).\nUse \`/profile\` any time to see your stats, or \`/unlink\` to remove it.`)
  .setThumbnail(summarize(p).main?.name ? legendIcon(summarize(p).main.name) : null)
  .setFooter({ text: "Linking uses your public Brawlhalla ID, there is no password." })] });

export const noticeMessage = (title, text, color = ACCENT) => ({ embeds: [new EmbedBuilder().setColor(color).setTitle(title).setDescription(text)], components: [] });
export const errorMessage = (text) => noticeMessage("Something went wrong", text, ERROR_COLOR);

// ---------- Live Ranked ----------
export function liveEmbed(v) {
  const e = new EmbedBuilder().setColor(ACCENT).setTitle(`Live Ranked  ·  ${v.mode === "rotating" ? "Rotating" : v.mode}  ·  ${v.region}`).setURL(`${SITE}/live`)
    .setAuthor({ name: "GraceHalla  ·  Live", iconURL: `${SITE}/apple-icon.png` })
    .setFooter({ text: "Detected from the ranked leaderboard  ·  refreshes about every 2 min", iconURL: `${SITE}/apple-icon.png` })
    .setTimestamp(v.ts ? new Date(v.ts) : new Date());
  const active = (v.players ?? []).filter((p) => p.status === "active");
  const head = [`🟢  **${active.length}** playing now  ·  **${n(v.hour?.games)}** games in the last hour`];
  if (v.hour?.bestGain) head.push(`🔥  Best gain: **${names(v.hour.bestGain.names)}** ${signed(v.hour.bestGain.delta)}`);
  if (v.cold) head.push("\n*Warming up: I need two snapshots to spot matches. Check back in a couple of minutes.*");
  if (v.stale) head.push("\n*Official API hiccup: showing the last known state.*");
  e.setDescription(head.join("\n"));

  const now = (v.players ?? []).slice(0, 8).map((p) => {
    const t = tierInfo(p.tier);
    const sess = p.session?.games ? `  ·  ${signed(p.session.delta)} (${p.session.wins}W ${p.session.losses}L)` : "";
    const dot = p.status === "active" ? "🟢" : "⚪";
    return `${dot} **${names(p.names)}**  ${t.emoji} ${n(p.rating)}${sess}${p.legend?.name ? `  ·  ${pretty(p.legend.name)}` : ""}`;
  });
  e.addFields({ name: "Players", value: now.length ? clip(now.join("\n")) : "*Nobody tracked right now.*" });

  const feed = (v.feed ?? []).slice(0, 7).map((m) => {
    const won = m.wins >= m.losses;
    return `${won ? "🟢" : "🔴"} **${names(m.names)}**  ${signed(m.delta)} → ${n(m.rating)}${m.legend?.name ? `  ·  ${pretty(m.legend.name)}` : ""}  ·  <t:${Math.floor(m.t / 1000)}:R>`;
  });
  e.addFields({ name: "Latest matches", value: feed.length ? clip(feed.join("\n")) : "*No matches detected yet.*" });
  return e;
}

export function liveComponents(mode, region) {
  const buttons = new ActionRowBuilder().addComponents(
    ...MODES.map(([k, label]) => new ButtonBuilder().setCustomId(`lv:m:${k}:${region}`).setLabel(label).setStyle(k === mode ? ButtonStyle.Primary : ButtonStyle.Secondary)),
    new ButtonBuilder().setCustomId(`lv:x:${mode}:${region}`).setLabel("Refresh").setEmoji("🔄").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setLabel("Open site").setStyle(ButtonStyle.Link).setURL(`${SITE}/live`),
  );
  const select = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`lv:r:${mode}`).setPlaceholder("Region")
    .addOptions(REGIONS.map((r) => ({ label: r, value: r, default: r === region }))));
  return [buttons, select];
}

export const liveMessage = (v, mode, region) => ({ embeds: [liveEmbed(v)], components: liveComponents(mode, region) });
