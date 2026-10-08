// npm run deploy  —  registra os comandos no Discord (rode de novo sempre que mudar src/commands.mjs).
import { REST, Routes } from "discord.js";
import { payload } from "./commands.mjs";

const { DISCORD_TOKEN: token, DISCORD_CLIENT_ID: app } = process.env;
const guilds = (process.env.DISCORD_GUILD_ID || "").split(/[\s,]+/).filter(Boolean);
if (!token || !app) { console.error("Preencha DISCORD_TOKEN e DISCORD_CLIENT_ID no arquivo bot/.env"); process.exit(1); }
const rest = new REST().setToken(token);
if (guilds.length) {
  for (const g of guilds) { const out = await rest.put(Routes.applicationGuildCommands(app, g), { body: payload() }); console.log(`${out.length} comandos registrados no servidor ${g}`); }
} else {
  const out = await rest.put(Routes.applicationCommands(app), { body: payload() });
  console.log(`${out.length} comandos registrados globalmente (pode levar até 1 h): ${out.map((c) => "/" + c.name).join(" ")}`);
}
