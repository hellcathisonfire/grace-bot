// Grace — bot do GraceHalla. Só usa slash commands (nenhuma intent privilegiada).
import { fileURLToPath } from "node:url";
import { ActivityType, Client, Events, GatewayIntentBits, MessageFlags, PermissionFlagsBits } from "discord.js";
import { ApiError, getLive, getPlayer, getRegionRank, isBhId, searchRanked } from "./api.mjs";
import { getLink, getPanels, removeLink, setLink, setPanels, usingRedis } from "./store.mjs";
import { startHealth } from "./health.mjs";
import { ensureSetup } from "./setup.mjs";
import { component as repComponent, dexreport, modal as repModal, trashbotters } from "./reports.mjs";
import { component as offComponent, dbxComponent, dbxOpen, modal as offModal, open as offOpen, tickOffPanels } from "./offenders.mjs";
import { errorMessage, helpMessage, liveEmbeds, liveMessage, linkedMessage, noticeMessage, profileMessage, searchMessage } from "./ui.mjs";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const EPHEMERAL = MessageFlags.Ephemeral;
const PANEL_EVERY_MS = 120_000;

// Mensagem amigável para qualquer erro, sem vazar detalhes técnicos para o chat.
function friendly(e) {
  if (e instanceof ApiError && (e.status === 404 || e.status === 400)) return "I couldn't find a Brawlhalla player with that ID. Double-check the number, or use `/search` with the player's name.";
  if (e instanceof ApiError) return "Brawlhalla data isn't reachable right now. Give it a minute and try again.";
  console.error(e);
  return "Unexpected error. Please try again.";
}

async function fail(i, e) {
  const msg = errorMessage(friendly(e));
  try {
    if (i.isMessageComponent()) await i.followUp({ ...msg, flags: EPHEMERAL });      // não apaga o card que já estava na tela
    else if (i.deferred || i.replied) await i.editReply(msg);
    else await i.reply({ ...msg, flags: EPHEMERAL });
  } catch (err) { console.error("Falha ao responder erro:", err.message); }
}

// ---------- comandos ----------
export const handlers = {
  async cmndlist(i) { await i.reply(helpMessage()); },                    // pública: todo mundo no canal vê

  dexreport,                                              // denúncia (qualquer pessoa) → fica privada
  trashbotters,                                           // lista de denúncias: só donos + senha
  dexbotters: dbxOpen,                                    // lista pública, só leitura
  offenders: offOpen,                                     // Grace Offenders: só o dono + senha (src/offenders.mjs)

  async link(i) {
    const id = i.options.getString("id", true).trim();
    if (!isBhId(id)) return i.reply({ ...noticeMessage("That doesn't look like an ID", "A Brawlhalla ID is just numbers, for example `66541152`.\nDon't know yours? Use `/search` with your name."), flags: EPHEMERAL });
    await i.deferReply({ flags: EPHEMERAL });
    const p = await getPlayer(id);
    await setLink(i.user.id, p.id);
    await i.editReply(linkedMessage(p));
  },

  async unlink(i) {
    const had = await removeLink(i.user.id);
    await i.reply({ ...(had ? noticeMessage("Unlinked", "Your Brawlhalla account is no longer linked.") : noticeMessage("Nothing to unlink", "You haven't linked an account yet.")), flags: EPHEMERAL });
  },

  async profile(i) {
    let id = i.options.getString("id")?.trim();
    if (id && !isBhId(id)) return i.reply({ ...noticeMessage("That doesn't look like an ID", "A Brawlhalla ID is just numbers, for example `66541152`."), flags: EPHEMERAL });
    if (!id) {
      const target = i.options.getUser("user") ?? i.user;
      id = await getLink(target.id);
      if (!id) {
        const self = target.id === i.user.id;
        return i.reply({ ...noticeMessage("No account linked", self ? "Link yours with `/link id:<your Brawlhalla ID>` and `/profile` will show your stats.\nOr look anyone up with `/profile id:` or `/search`." : `**${target.displayName}** hasn't linked a Brawlhalla account yet.`), flags: EPHEMERAL });
      }
    }
    await i.deferReply();
    await i.editReply(profileMessage(await getPlayer(id), "overview"));
  },

  async search(i) {
    await i.deferReply();
    const name = i.options.getString("name", true).trim();
    await i.editReply(searchMessage(name, await searchRanked(name)));
  },

  async live(i) {
    await i.deferReply();
    const mode = i.options.getString("mode") ?? "1v1", region = i.options.getString("region") ?? "BRZ";
    await i.editReply(liveMessage(await getLive(mode, region), mode, region));
  },

  async livepanel(i) {
    const sub = i.options.getSubcommand();
    const panels = await getPanels();
    const old = panels.find((p) => p.guildId === i.guildId);
    const dropOld = async () => { if (!old) return; try { await (await client.channels.fetch(old.channelId)).messages.delete(old.messageId); } catch {} };

    if (sub === "stop") {
      await i.deferReply({ flags: EPHEMERAL });
      await dropOld();
      await setPanels(panels.filter((p) => p.guildId !== i.guildId));
      return i.editReply(noticeMessage(old ? "Panel removed" : "No panel here", old ? "The live panel is gone." : "This server doesn't have a live panel."));
    }

    const me = i.guild?.members.me;
    const perms = me && i.channel?.permissionsFor(me);
    if (!perms?.has(PermissionFlagsBits.SendMessages) || !perms.has(PermissionFlagsBits.EmbedLinks)) {
      return i.reply({ ...errorMessage("I need **Send Messages** and **Embed Links** in this channel."), flags: EPHEMERAL });
    }
    await i.deferReply({ flags: EPHEMERAL });
    const mode = i.options.getString("mode") ?? "1v1", region = i.options.getString("region") ?? "BRZ";
    const v = await getLive(mode, region);
    await dropOld();
    const msg = await i.channel.send({ embeds: liveEmbeds(v) });
    await setPanels([...panels.filter((p) => p.guildId !== i.guildId), { guildId: i.guildId, channelId: i.channelId, messageId: msg.id, mode, region }]);
    await i.editReply(noticeMessage("Live panel started", `It will refresh itself every ~2 minutes. Use \`/livepanel stop\` to remove it.`));
  },
};

// ---------- botões e menus ----------
export async function component(i) {
  const [kind, a, b, c] = i.customId.split(":");
  if (kind === "dbx") return dbxComponent(i);
  if (kind === "rep") return repComponent(i);
  if (kind === "off") return offComponent(i);             // responde por conta própria (abre modal, confere o dono)
  await i.deferUpdate();
  if (kind === "pf") {                                    // pf:<aba>:<id>
    const p = await getPlayer(b);
    const extra = a === "ranked" ? { regionRank: await getRegionRank(p, p.ranked?.["1v1"]?.region) } : {};
    return i.editReply(profileMessage(p, a, extra));
  }
  if (kind === "search") return i.editReply(profileMessage(await getPlayer(i.values[0]), "overview"));   // menu da busca
  if (kind === "lv") {                                    // lv:m:<modo>:<região> | lv:x:<modo>:<região> | lv:r:<modo> (menu)
    const mode = b;                                       // "m" e "x": modo vem do botão; "r": do id do menu
    const region = a === "r" ? i.values[0] : c;
    return i.editReply(liveMessage(await getLive(mode, region), mode, region));
  }
}

client.on(Events.InteractionCreate, async (i) => {
  try {
    if (i.isChatInputCommand()) return void (await handlers[i.commandName]?.(i));
    if (i.isButton() || i.isStringSelectMenu()) return void (await component(i));
    if (i.isModalSubmit()) return void (await (i.customId.startsWith("rep:") ? repModal(i) : offModal(i)));
  } catch (e) { await fail(i, e); }
});

// ---------- painéis ao vivo ----------
async function tickPanels() {
  const panels = await getPanels();
  if (!panels.length) return;
  const keep = [];
  for (const pn of panels) {
    try {
      const v = await getLive(pn.mode, pn.region);
      const msg = await (await client.channels.fetch(pn.channelId)).messages.fetch(pn.messageId);
      await msg.edit({ embeds: liveEmbeds(v) });
      keep.push(pn);
    } catch (e) {
      if ([10003, 10008, 50001, 50013].includes(e.code)) console.log(`Painel removido (${e.code}): servidor ${pn.guildId}`);   // canal/mensagem sumiu ou sem permissão
      else { keep.push(pn); if (!(e instanceof ApiError)) console.error("Painel:", e.message); }
    }
  }
  if (keep.length !== panels.length) await setPanels(keep);
}

async function tickAll() {
  await tickPanels();
  await tickOffPanels(client).catch((e) => console.error("tickOffPanels:", e.message));
}

let ready = false;

client.once(Events.ClientReady, (c) => {
  ready = true;
  console.log(`Grace online como ${c.user.tag} em ${c.guilds.cache.size} servidor(es). Armazenamento: ${usingRedis ? "Upstash Redis" : "arquivo local (data/grace.json)"}`);
  c.user.setPresence({ activities: [{ name: "Brawlhalla  ·  /profile", type: ActivityType.Playing }], status: "online" });
  ensureSetup(c.application.id).catch((e) => console.error("setup:", e.message));     // registra comandos e foto (só quando mudam)
  setInterval(() => tickAll().catch((e) => console.error("tickPanels:", e.message)), PANEL_EVERY_MS);
});

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {   // só conecta quando rodado direto (os testes importam sem conectar)
  process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));
  startHealth(() => ({ ok: true, ready, uptimeSec: Math.round(process.uptime()) }));   // Render exige uma porta aberta; também serve para o cron "acordar" o bot
  if (!process.env.DISCORD_TOKEN) { console.error("ERRO: falta a variável DISCORD_TOKEN (veja bot/README.md)."); process.exit(1); }
  try { await client.login(process.env.DISCORD_TOKEN); }
  catch (e) { console.error("ERRO ao entrar no Discord. O DISCORD_TOKEN está certo e sem espaços?", e.message); process.exit(1); }
}
