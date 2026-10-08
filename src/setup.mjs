// Ao ligar, registra os comandos e a foto do bot — mas só quando algo mudou (guarda um "hash" no armazenamento).
// Assim não precisa rodar `npm run deploy` / `npm run avatar` no seu PC.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { REST, Routes } from "discord.js";
import { payload } from "./commands.mjs";
import { getMeta, setMeta } from "./store.mjs";
import { initEmojis } from "./emoji.mjs";

const sha = (x) => createHash("sha256").update(x).digest("hex").slice(0, 16);

export async function ensureSetup(appId) {
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  const guilds = (process.env.DISCORD_GUILD_ID || "").split(/[\s,]+/).filter(Boolean);   // vários servidores: IDs separados por vírgula; vazio = global

  try { await initEmojis(rest, appId); }                                   // emblemas de rank + cabeças das lendas (emojis do app)
  catch (e) { console.error("Não consegui preparar os emojis (os cards usam emojis comuns no lugar):", e.message); }

  try {
    const body = payload();
    const h = sha(JSON.stringify(body) + (guilds.join(",") || "global"));
    if ((await getMeta("cmdHash")) !== h) {
      let failed = 0;
      if (guilds.length) {
        for (const g of guilds) {                                          // um servidor com problema não derruba os outros
          try { await rest.put(Routes.applicationGuildCommands(appId, g), { body }); }
          catch (e) { failed++; console.error(`Servidor ${g}: não consegui registrar os comandos (${e.message}). O ID está certo e o bot foi convidado com o escopo applications.commands?`); }
        }
      } else await rest.put(Routes.applicationCommands(appId), { body });
      if (failed) console.error(`Comandos registrados em ${guilds.length - failed} de ${guilds.length} servidor(es). Tento de novo no próximo início.`);
      else {
        await setMeta("cmdHash", h);                                      // só marca como feito se deu certo em todos
        console.log(`Comandos registrados ${guilds.length ? "no(s) servidor(es) " + guilds.join(", ") : "globalmente (podem levar até 1 h para aparecer)"}.`);
      }
    }
  } catch (e) { console.error("Não consegui registrar os comandos:", e.message); }

  try {
    const img = await readFile(new URL("../assets/grace.png", import.meta.url));
    const h = sha(img);
    if ((await getMeta("avatarHash")) !== h) {
      await rest.patch(Routes.user("@me"), { body: { avatar: `data:image/png;base64,${img.toString("base64")}` } });
      await setMeta("avatarHash", h);
      console.log("Foto do bot atualizada.");
    }
  } catch (e) { console.error("Não consegui trocar a foto (o Discord limita; tento de novo no próximo início):", e.message); }
}
