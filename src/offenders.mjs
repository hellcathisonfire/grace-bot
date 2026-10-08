// Grace Offenders — lista privada de jogadores suspeitos de usar o Dexbot (auto-dodge / auto-ataque).
// Só o dono do bot abre (src/auth.mjs), e só depois de digitar a senha num modal (o texto nunca aparece no chat).
// Mostra cada jogador como o Live Ranked: emblema do rank, nome clicável, lenda em uso, e se está em partida AGORA.
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { ApiError, SITE, getLive, getPlayer, isBhId } from "./api.mjs";
import { attempt, isOwner, lockedUntil } from "./auth.mjs";
import { getOffPanels, getOffenders, setOffPanels, setOffenders } from "./store.mjs";
import { ERROR_COLOR, legendHead, legendIcon, legendSlug, nameLinks, n, noticeMessage, pretty, regionTag, summarize, tierInfo, trend } from "./ui.mjs";

const EPHEMERAL = MessageFlags.Ephemeral;
const RED = 0xef4444, DARK_RED = 0x991b1b;
export const MAX_OFFENDERS = 25;       // limite do menu de remoção do Discord
const SHOWN = 12;                      // quantos cabem no card
const ago = (t) => `<t:${Math.floor(t / 1000)}:R>`;
const clipTxt = (s, max) => (s.length <= max ? s : s.slice(0, max - 1).replace(/\n[^\n]*$/, "") + "\n…");

// ---------- dados ----------
async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => { while (next < items.length) { const k = next++; out[k] = await fn(items[k], k); } }));
  return out;
}

/** Junta perfil (rank, elo) + Live Ranked da região (está jogando? sessão? lenda da partida?) de cada jogador sinalizado. */
export async function loadRows(list) {
  const profiles = await pool(list, 5, async (o) => { try { return await getPlayer(o.id); } catch { return null; } });
  const regionOf = (o, p) => String(p?.ranked?.["1v1"]?.region || o.region || "").toUpperCase() || null;
  const regions = [...new Set(list.map((o, k) => regionOf(o, profiles[k])).filter((r) => r && r !== "ALL"))];
  const lives = new Map();
  await Promise.all(regions.map(async (r) => { try { lives.set(r, await getLive("1v1", r)); } catch {} }));
  return list.map((o, k) => {
    const p = profiles[k], region = regionOf(o, p), live = lives.get(region);
    const hit = live?.players?.find((x) => (x.ids ?? []).map(String).includes(String(o.id))) ?? null;
    return { o, p, r: p?.ranked?.["1v1"] ?? null, region, hit, name: p?.name ?? o.name ?? `ID ${o.id}` };
  });
}

// ---------- visual ----------
function rowLines(x, { notes }) {
  const { o, p, r, hit } = x;
  const active = hit?.status === "active";
  const rating = hit?.rating ?? r?.rating, tier = hit?.tier ?? r?.tier, t = tierInfo(tier), s = hit?.session;
  const l1 = `${t.emoji}  ${nameLinks([x.name], [o.id], 26)}  ·  ${rating ? `**${n(rating)}**` : "*unranked*"}${s?.games ? `  ${trend(s.delta)}` : ""}${active ? "  ·  🚨 **IN GAME NOW**" : ""}`;
  const legend = hit?.legend?.name ? hit.legend : (p ? (() => { const m = summarize(p).main; return m?.name ? { name: m.name, slug: legendSlug(m.name) } : null; })() : null);
  const sub = [];
  if (legend) sub.push(`${legendHead(legend)} **${pretty(legend.name)}**${active ? "" : "  *(most played)*"}`);
  if (x.region) sub.push(regionTag(x.region) + (hit?.rank ? ` #${n(hit.rank)}` : ""));
  if (s?.games) sub.push(`${s.wins}W ${s.losses}L this session`);
  else if (r?.games) sub.push(`${n(r.wins)}W ${n(r.games - r.wins)}L overall`);
  if (!active) sub.push(hit?.lastT ? `last game ${ago(hit.lastT)}` : "not on the tracked board right now");
  const out = [l1, sub.join("  ·  ")];
  if (notes && o.note) out.push(`-# 📝 ${o.note.replace(/\s+/g, " ").slice(0, 160)}`);
  return out.join("\n");
}

export const pageCount = (total) => Math.max(1, Math.ceil(total / SHOWN));

export function offendersEmbeds(rows, { notes = true, ts, page = 0 } = {}) {
  const sorted = [...rows].sort((a, b) => (b.hit?.status === "active") - (a.hit?.status === "active") || (b.hit?.rating ?? b.r?.rating ?? 0) - (a.hit?.rating ?? a.r?.rating ?? 0));
  const live = sorted.filter((x) => x.hit?.status === "active");
  const pages = pageCount(rows.length), pg = Math.max(0, Math.min(page, pages - 1));
  const e = new EmbedBuilder().setColor(live.length ? RED : DARK_RED).setTitle("Grace Offenders").setURL(`${SITE}/live`)
    .setAuthor({ name: "GraceHalla  ·  Dexbot watchlist", iconURL: `${SITE}/apple-icon.png` })
    .setFooter({ text: `Flagged for Dexbot (auto-dodge / auto-attack)  ·  live data ~2 min${pages > 1 ? `  ·  page ${pg + 1}/${pages}` : ""}`, iconURL: `${SITE}/apple-icon.png` })
    .setTimestamp(ts ? new Date(ts) : new Date());
  if (!rows.length) return [e.setDescription(notes ? "*Nobody flagged yet.*\nPress **Add** and send a Brawlhalla ID to start the list." : "*Nobody is on the list right now.*")];

  const head = `🚫 **${rows.length}** flagged  ·  ${live.length ? `🚨 **${live.length}** in game right now` : "nobody in game right now"}`;
  const take = sorted.slice(pg * SHOWN, (pg + 1) * SHOWN), liveShown = take.filter((x) => x.hit?.status === "active"), rest = take.filter((x) => x.hit?.status !== "active");
  const parts = [head];
  if (liveShown.length) parts.push("**🚨 Playing right now**\n" + liveShown.map((x) => rowLines(x, { notes })).join("\n\n"));
  if (rest.length) parts.push("**Watchlist**\n" + rest.map((x) => rowLines(x, { notes })).join("\n\n"));
  e.setDescription(clipTxt(parts.join("\n\n"), 3900));
  const lead = (liveShown[0] ?? take[0]);
  const lg = lead?.hit?.legend?.name ?? (lead?.p ? summarize(lead.p).main?.name : null);
  if (lg) e.setThumbnail(legendIcon(lg));
  return [e];
}

export function offComponents({ guild, pinned, any }) {
  const btn = (id, label, emoji, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setEmoji(emoji).setStyle(style);
  const row = new ActionRowBuilder().addComponents(
    btn("off:r", "Refresh", "🔄"),
    btn("off:add", "Add", "➕", ButtonStyle.Primary),
    btn("off:rm", "Remove", "🗑️").setDisabled(!any),
    ...(guild ? [btn("off:post", "Post here", "📣").setDisabled(!any), btn("off:pin", pinned ? "Unpin live" : "Pin live", "📌").setDisabled(!any && !pinned)] : []),
  );
  return [row];
}

const passwordModal = () => new ModalBuilder().setCustomId("off:auth").setTitle("Grace Offenders").addComponents(
  new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("pw").setLabel("Password").setStyle(TextInputStyle.Short).setRequired(true).setMinLength(1).setMaxLength(64).setPlaceholder("Restricted area")));

const addModal = () => new ModalBuilder().setCustomId("off:addm").setTitle("Flag a player").addComponents(
  new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("id").setLabel("Brawlhalla ID (numbers only)").setStyle(TextInputStyle.Short).setRequired(true).setMinLength(1).setMaxLength(12)),
  new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("note").setLabel("Evidence / note (only you see it)").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(200).setPlaceholder("e.g. perfect dodges on every reaction, clip link…")));

async function dashboard(i) {
  const list = await getOffenders();
  const rows = await loadRows(list);
  const pinned = i.guildId ? (await getOffPanels()).some((p) => p.guildId === i.guildId) : false;
  return { embeds: offendersEmbeds(rows, { notes: true }), components: offComponents({ guild: Boolean(i.guildId), pinned, any: list.length > 0 }) };
}

const restricted = () => ({ ...noticeMessage("Restricted", "This command is only for Grace's owner."), flags: EPHEMERAL });
const lockedMsg = (until) => ({ ...noticeMessage("Too many attempts", `Locked. Try again ${ago(until)}.`, ERROR_COLOR), flags: EPHEMERAL });

// ---------- /offenders ----------
export async function open(i) {
  if (!(await isOwner(i))) return i.reply(restricted());
  const until = lockedUntil(i.user.id);
  if (until) return i.reply(lockedMsg(until));
  return i.showModal(passwordModal());
}

// ---------- modais (senha e adicionar) ----------
export async function modal(i) {
  const [, kind] = i.customId.split(":");
  if (!(await isOwner(i))) return i.reply(restricted());

  if (kind === "auth") {
    const r = attempt(i.user.id, i.fields.getTextInputValue("pw"));
    if (r.locked) return i.reply(lockedMsg(r.until));
    if (!r.ok) return i.reply({ ...noticeMessage("Wrong password", `${r.left} attempt${r.left === 1 ? "" : "s"} left before a 15 minute lock.`, ERROR_COLOR), flags: EPHEMERAL });
    await i.deferReply({ flags: EPHEMERAL });
    return i.editReply(await dashboard(i));
  }

  if (kind === "addm") {
    const fromMsg = i.isFromMessage?.() ?? false;
    if (fromMsg) await i.deferUpdate(); else await i.deferReply({ flags: EPHEMERAL });
    const say = (title, text, color) => i.followUp({ ...noticeMessage(title, text, color), flags: EPHEMERAL });
    const id = i.fields.getTextInputValue("id").trim(), note = (i.fields.getTextInputValue("note") ?? "").trim();
    if (!isBhId(id)) return say("That doesn't look like an ID", "A Brawlhalla ID is just numbers, for example `66541152`.", ERROR_COLOR);
    const list = await getOffenders();
    if (list.some((o) => String(o.id) === id)) return say("Already flagged", "That player is already on the list.");
    if (list.length >= MAX_OFFENDERS) return say("List is full", `Remove someone first (limit ${MAX_OFFENDERS}).`, ERROR_COLOR);
    let p;
    try { p = await getPlayer(id); }
    catch (e) { return say("Player not found", e instanceof ApiError && (e.status === 404 || e.status === 400) ? "No Brawlhalla player with that ID." : "Brawlhalla data isn't reachable right now. Try again in a minute.", ERROR_COLOR); }
    await setOffenders([...list, { id: String(p.id), name: p.name, region: p.ranked?.["1v1"]?.region ?? null, note, addedAt: Date.now() }]);
    return i.editReply(await dashboard(i));
  }
}

// ---------- botões e menu ----------
export async function component(i) {
  const [, act] = i.customId.split(":");
  if (!(await isOwner(i))) return i.reply(restricted());
  if (act === "add") return i.showModal(addModal());
  await i.deferUpdate();
  const followUp = (title, text, color) => i.followUp({ ...noticeMessage(title, text, color), flags: EPHEMERAL });

  if (act === "r") return i.editReply(await dashboard(i));

  if (act === "rm") {
    const list = await getOffenders();
    if (!list.length) return i.editReply(await dashboard(i));
    const menu = new StringSelectMenuBuilder().setCustomId("off:rmpick").setPlaceholder("Who should be removed?")
      .addOptions(list.slice(0, 25).map((o) => ({ label: String(o.name ?? o.id).slice(0, 100), description: `ID ${o.id}`, value: String(o.id) })));
    const back = new ButtonBuilder().setCustomId("off:r").setLabel("Back").setStyle(ButtonStyle.Secondary);
    return i.editReply({ ...noticeMessage("Remove a player", "Pick who to take off the list."), components: [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(back)] });
  }

  if (act === "rmpick") {
    const id = i.values[0];
    await setOffenders((await getOffenders()).filter((o) => String(o.id) !== id));
    return i.editReply(await dashboard(i));
  }

  if (act === "post" || act === "pin") {
    if (!i.guildId) return followUp("Server only", "Open this from a server channel.", ERROR_COLOR);
    const old = (await getOffPanels()).find((p) => p.guildId === i.guildId);
    if (act === "pin" && old) {                                                  // "Unpin live"
      try { await (await i.client.channels.fetch(old.channelId)).messages.delete(old.messageId); } catch {}
      await setOffPanels((await getOffPanels()).filter((p) => p.guildId !== i.guildId));
      return i.editReply(await dashboard(i));
    }
    const channel = i.channel ?? await i.client.channels.fetch(i.channelId);
    const me = i.guild?.members.me, perms = me && channel?.permissionsFor?.(me);
    if (!perms?.has("SendMessages") || !perms.has("EmbedLinks")) return followUp("Missing permissions", "I need **Send Messages** and **Embed Links** in this channel.", ERROR_COLOR);
    const rows = await loadRows(await getOffenders());
    const link = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel("Open GraceHalla").setStyle(ButtonStyle.Link).setURL(`${SITE}/live`));
    const msg = await channel.send({ embeds: offendersEmbeds(rows, { notes: false }), components: [link] });   // público: sem as suas anotações
    if (act === "pin") await setOffPanels([...(await getOffPanels()).filter((p) => p.guildId !== i.guildId), { guildId: i.guildId, channelId: channel.id, messageId: msg.id }]);
    await followUp(act === "pin" ? "Live panel pinned" : "Posted", act === "pin" ? "It refreshes itself every ~2 minutes. Your private notes are never shown there." : "Posted in this channel (your private notes are hidden).");
    return i.editReply(await dashboard(i));
  }
}

// ---------- /dexbotters: lista PÚBLICA, só leitura (qualquer pessoa vê; ninguém adiciona nem remove) ----------
function dbxComponents(page, pages) {
  const btn = (id, label, emoji) => new ButtonBuilder().setCustomId(id).setEmoji(emoji).setStyle(ButtonStyle.Secondary).setLabel(label);
  const row = new ActionRowBuilder();
  if (pages > 1) row.addComponents(new ButtonBuilder().setCustomId(`dbx:p:${page - 1}`).setEmoji("◀️").setStyle(ButtonStyle.Secondary).setDisabled(page <= 0));
  row.addComponents(btn(`dbx:r:${page}`, "Refresh", "🔄"));
  if (pages > 1) row.addComponents(new ButtonBuilder().setCustomId(`dbx:p:${page + 1}`).setEmoji("▶️").setStyle(ButtonStyle.Secondary).setDisabled(page >= pages - 1));
  row.addComponents(new ButtonBuilder().setLabel("Open site").setStyle(ButtonStyle.Link).setURL(`${SITE}/live`));
  return [row];
}

async function dbxMessage(page) {
  const rows = await loadRows(await getOffenders());
  const pages = pageCount(rows.length), pg = Math.max(0, Math.min(page, pages - 1));
  return { embeds: offendersEmbeds(rows, { notes: false, page: pg }), components: dbxComponents(pg, pages) };   // sem as anotações privadas
}

export async function dbxOpen(i) { await i.deferReply(); return i.editReply(await dbxMessage(0)); }

export async function dbxComponent(i) {
  const [, , arg] = i.customId.split(":");                      // dbx:p:<página> | dbx:r:<página>
  await i.deferUpdate();
  return i.editReply(await dbxMessage(Number(arg) || 0));
}

// ---------- painéis fixados (chamado a cada ~2 min pelo index) ----------
export async function tickOffPanels(client) {
  const panels = await getOffPanels();
  if (!panels.length) return;
  const rows = await loadRows(await getOffenders());
  const embeds = offendersEmbeds(rows, { notes: false });
  const keep = [];
  for (const pn of panels) {
    try {
      const msg = await (await client.channels.fetch(pn.channelId)).messages.fetch(pn.messageId);
      await msg.edit({ embeds });
      keep.push(pn);
    } catch (e) {
      if ([10003, 10008, 50001, 50013].includes(e.code)) console.log(`Painel Offenders removido (${e.code}): servidor ${pn.guildId}`);
      else { keep.push(pn); console.error("Painel Offenders:", e.message); }
    }
  }
  if (keep.length !== panels.length) await setOffPanels(keep);
}
