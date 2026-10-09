// Denúncias de Dexbot.
//  /dexreport    → QUALQUER pessoa denuncia (nome, ID, região, prova). A denúncia NÃO é publicada: vai para a lista privada.
//  /trashbotters → só os donos (mesma regra do /offenders: dono + senha) leem as denúncias e podem
//                  "Flag" (move para a lista pública /dexbotters) ou "Dismiss" (descarta).
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { ApiError, SITE, getPlayer, isBhId } from "./api.mjs";
import { attempt, isOwner, lockedUntil } from "./auth.mjs";
import { MAX_OFFENDERS, lockedMsg, restricted } from "./offenders.mjs";
import { getOffenders, getReports, setOffenders, setReports } from "./store.mjs";
import { ERROR_COLOR, esc, legendHead, legendSlug, nameLinks, n, noticeMessage, pretty, regionTag, summarize, tierInfo } from "./ui.mjs";

const EPHEMERAL = MessageFlags.Ephemeral;
const AMBER = 0xf59e0b;
const PER_PAGE = 5, MAX_REPORTS = 200;
const LIMIT = 3, WINDOW_MS = 60 * 60_000;                      // 3 denúncias por pessoa por hora (anti-spam)
const ago = (t) => `<t:${Math.floor(t / 1000)}:R>`;
const cut = (s, max) => (s.length <= max ? s : s.slice(0, max - 1) + "…");

const sent = new Map();                                        // userId -> [timestamps]
const recent = (u) => { const a = (sent.get(u) ?? []).filter((t) => Date.now() - t < WINDOW_MS); sent.set(u, a); return a; };

// ---------- /dexreport ----------
const input = (id, label, style, required, max, placeholder) => {
  const t = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required).setMaxLength(max);
  return new ActionRowBuilder().addComponents(placeholder ? t.setPlaceholder(placeholder) : t);
};

const reportModal = () => new ModalBuilder().setCustomId("rep:new").setTitle("Report a Dexbot user").addComponents(
  input("name", "Player name", TextInputStyle.Short, true, 40),
  input("id", "Brawlhalla ID (if you know it)", TextInputStyle.Short, false, 12, "numbers only, e.g. 66541152"),
  input("region", "Region (BRZ, US-E, US-W, EU, SEA…)", TextInputStyle.Short, true, 12),
  input("proof", "Proof (video, link, screenshot, message…)", TextInputStyle.Paragraph, true, 500, "Paste a clip / screenshot link, or describe what you saw"));

export async function dexreport(i) {
  if (recent(i.user.id).length >= LIMIT) return i.reply({ ...noticeMessage("Slow down", "You've sent a few reports already. Try again in a while.", ERROR_COLOR), flags: EPHEMERAL });
  return i.showModal(reportModal());
}

async function submit(i) {
  await i.deferReply({ flags: EPHEMERAL });
  const say = (title, text, color) => i.editReply(noticeMessage(title, text, color));
  const get = (k) => (i.fields.getTextInputValue(k) ?? "").trim();
  const name = get("name"), bhId = get("id"), proof = get("proof");
  const region = get("region").toUpperCase().replace(/\s+/g, "");
  if (!name || !region || proof.length < 4) return say("Missing info", "Name, region and some proof are required.", ERROR_COLOR);
  if (recent(i.user.id).length >= LIMIT) return say("Slow down", "You've sent a few reports already. Try again in a while.", ERROR_COLOR);
  let resolved = null;
  if (bhId) {
    if (!isBhId(bhId)) return say("That doesn't look like an ID", "A Brawlhalla ID is just numbers. Leave it empty if you don't know it.", ERROR_COLOR);
    try { resolved = await getPlayer(bhId); }
    catch (e) { if (e instanceof ApiError && (e.status === 404 || e.status === 400)) return say("Player not found", "No Brawlhalla player has that ID. Double-check it, or leave it empty.", ERROR_COLOR); }   // API fora do ar: aceita assim mesmo
  }
  const id = Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 4);
  const report = { id, name, bhId: bhId || null, resolvedName: resolved?.name ?? null, region, proof, by: i.user.id, at: Date.now() };
  await setReports([report, ...(await getReports())].slice(0, MAX_REPORTS));
  sent.set(i.user.id, [...recent(i.user.id), Date.now()]);
  return say("Report sent", `Thanks! Your report **#${id}** went to the owners. Reports are private, nothing gets posted publicly.`);
}

// ---------- /trashbotters (dono + senha) ----------
const passwordModal = () => new ModalBuilder().setCustomId("rep:auth").setTitle("Dexbot reports").addComponents(
  new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("pw").setLabel("Password").setStyle(TextInputStyle.Short).setRequired(true).setMinLength(1).setMaxLength(64).setPlaceholder("Restricted area")));

export async function trashbotters(i) {
  if (!(await isOwner(i))) return i.reply(restricted());
  const until = lockedUntil(i.user.id);
  if (until) return i.reply(lockedMsg(until));
  return i.showModal(passwordModal());
}

export async function modal(i) {
  const [, kind] = i.customId.split(":");
  if (kind === "new") return submit(i);                         // público: qualquer pessoa denuncia
  if (!(await isOwner(i))) return i.reply(restricted());
  if (kind === "auth") {
    const r = attempt(i.user.id, i.fields.getTextInputValue("pw"));
    if (r.locked) return i.reply(lockedMsg(r.until));
    if (!r.ok) return i.reply({ ...noticeMessage("Wrong password", `${r.left} attempt${r.left === 1 ? "" : "s"} left before a 15 minute lock.`, ERROR_COLOR), flags: EPHEMERAL });
    await i.deferReply({ flags: EPHEMERAL });
    return i.editReply(await listMessage(0));
  }
}

function reportLines(r, p) {
  const who = r.bhId ? nameLinks([r.resolvedName ?? r.name], [r.bhId], 26) : `**${esc(cut(r.name, 26))}** *(no ID)*`;
  const out = [`**#${r.id}**  ·  ${regionTag(r.region)}  ·  ${who}`];
  if (p) {
    const rk = p.ranked?.["1v1"], main = summarize(p).main;
    const bits = [];
    if (rk) bits.push(`${tierInfo(rk.tier).emoji} **${n(rk.rating)}**`);
    if (main?.name) bits.push(`${legendHead({ slug: legendSlug(main.name), name: main.name })} ${pretty(main.name)}`);
    if (bits.length) out.push(bits.join("  ·  "));
  }
  out.push(`📎 ${cut(r.proof.replace(/\s+/g, " "), 300)}`);
  out.push(`-# from <@${r.by}>  ·  ${ago(r.at)}`);
  return out.join("\n");
}

const base = () => new EmbedBuilder().setColor(AMBER).setTitle("Dexbot reports")
  .setAuthor({ name: "GraceHalla  ·  Reports", iconURL: `${SITE}/apple-icon.png` })
  .setFooter({ text: "Private: only the owners can see this", iconURL: `${SITE}/apple-icon.png` });

const infoFor = (r) => (r.bhId ? getPlayer(r.bhId).catch(() => null) : null);

async function listMessage(page) {
  const all = [...(await getReports())].sort((a, b) => b.at - a.at);
  const pages = Math.max(1, Math.ceil(all.length / PER_PAGE)), pg = Math.max(0, Math.min(page, pages - 1));
  const slice = all.slice(pg * PER_PAGE, (pg + 1) * PER_PAGE);
  const e = base().setFooter({ text: `Private: only the owners can see this  ·  ${all.length} report${all.length === 1 ? "" : "s"}${pages > 1 ? `  ·  page ${pg + 1}/${pages}` : ""}` });
  if (!all.length) e.setDescription("*No reports yet.*\nNew ones sent with `/dexreport` show up here.");
  else { const infos = await Promise.all(slice.map(infoFor)); e.setDescription(slice.map((r, k) => reportLines(r, infos[k])).join("\n\n")); }
  const nav = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`rep:p:${pg - 1}`).setEmoji("◀️").setStyle(ButtonStyle.Secondary).setDisabled(pg <= 0),
    new ButtonBuilder().setCustomId(`rep:r:${pg}`).setLabel("Refresh").setEmoji("🔄").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`rep:p:${pg + 1}`).setEmoji("▶️").setStyle(ButtonStyle.Secondary).setDisabled(pg >= pages - 1));
  const components = [nav];
  if (slice.length) components.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("rep:pick").setPlaceholder("Open a report to flag or dismiss…")
    .addOptions(slice.map((r) => ({ label: cut(`#${r.id} · ${r.name}`, 100), description: cut(`${r.region} · ${r.proof.replace(/\s+/g, " ")}`, 100), value: r.id })))));
  return { embeds: [e], components };
}

async function detailMessage(r, page) {
  const p = await infoFor(r);
  const e = base().setTitle(`Report #${r.id}`).setDescription(reportLines({ ...r, proof: cut(r.proof, 900) }, p));
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`rep:flag:${r.id}`).setLabel("Flag as Dexbotter").setEmoji("🚫").setStyle(ButtonStyle.Danger).setDisabled(!r.bhId),
    new ButtonBuilder().setCustomId(`rep:del:${r.id}`).setLabel("Dismiss").setEmoji("🗑️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`rep:back:${page}`).setLabel("Back").setStyle(ButtonStyle.Secondary));
  if (!r.bhId) e.setFooter({ text: "No Brawlhalla ID: add the player from /offenders instead", iconURL: `${SITE}/apple-icon.png` });
  return { embeds: [e], components: [row] };
}

export async function component(i) {
  const [, act, arg] = i.customId.split(":");
  if (!(await isOwner(i))) return i.reply(restricted());
  await i.deferUpdate();
  const tell = (title, text, color) => i.followUp({ ...noticeMessage(title, text, color), flags: EPHEMERAL });
  const reports = await getReports();

  if (act === "p" || act === "r" || act === "back") return i.editReply(await listMessage(Number(arg) || 0));

  if (act === "pick") {
    const idx = [...reports].sort((a, b) => b.at - a.at).findIndex((r) => r.id === i.values[0]);
    if (idx < 0) return i.editReply(await listMessage(0));
    return i.editReply(await detailMessage([...reports].sort((a, b) => b.at - a.at)[idx], Math.floor(idx / PER_PAGE)));
  }

  const r = reports.find((x) => x.id === arg);
  if (!r) return i.editReply(await listMessage(0));            // já foi tratada

  if (act === "del") { await setReports(reports.filter((x) => x.id !== arg)); return i.editReply(await listMessage(0)); }

  if (act === "flag") {
    const list = await getOffenders();
    if (list.some((o) => String(o.id) === String(r.bhId))) { await setReports(reports.filter((x) => x.id !== arg)); await tell("Already flagged", "That player was already on the list, so I dismissed this report."); return i.editReply(await listMessage(0)); }
    if (list.length >= MAX_OFFENDERS) { await tell("List is full", `Remove someone from /offenders first (limit ${MAX_OFFENDERS}).`, ERROR_COLOR); return i.editReply(await detailMessage(r, 0)); }
    let p;
    try { p = await getPlayer(r.bhId); }
    catch { await tell("Couldn't reach Brawlhalla", "Try again in a minute.", ERROR_COLOR); return i.editReply(await detailMessage(r, 0)); }
    await setOffenders([...list, { id: String(p.id), name: p.name, region: p.ranked?.["1v1"]?.region ?? null, note: cut(r.proof.replace(/\s+/g, " "), 200), addedAt: Date.now() }]);
    await setReports(reports.filter((x) => x.id !== arg));
    await tell("Flagged", `**${p.name}** is now on the public /dexbotters list, with the report's proof as the note.`);
    return i.editReply(await listMessage(0));
  }
}
