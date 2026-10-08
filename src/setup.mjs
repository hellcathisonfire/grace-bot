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
  const guild = process.env.DISCORD_GUILD_ID || "";

  try { await initEmojis(rest, appId); }                                   // emblemas de rank + cabeças das lendas (emojis do app)
  catch (e) { console.error("Não consegui preparar os emojis (os cards usam emojis comuns no lugar):", e.message); }

  try {
    const body = payload();
    const h = sha(JSON.stringify(body) + (guild || "global"));
    if ((await getMeta("cmdHash")) !== h) {
      await rest.put(guild ? Routes.applicationGuildCommands(appId, guild) : Routes.applicationCommands(appId), { body });
      await setMeta("cmdHash", h);
      console.log(`Comandos registrados ${guild ? "no servidor " + guild : "globalmente (podem levar até 1 h para aparecer)"}.`);
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
