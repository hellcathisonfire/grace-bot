// npm run deploy  —  registra os comandos no Discord (rode de novo sempre que mudar src/commands.mjs).
import { REST, Routes } from "discord.js";
import { payload } from "./commands.mjs";

const { DISCORD_TOKEN: token, DISCORD_CLIENT_ID: app, DISCORD_GUILD_ID: guild } = process.env;
if (!token || !app) { console.error("Preencha DISCORD_TOKEN e DISCORD_CLIENT_ID no arquivo bot/.env"); process.exit(1); }
const rest = new REST().setToken(token);
const route = guild ? Routes.applicationGuildCommands(app, guild) : Routes.applicationCommands(app);
const out = await rest.put(route, { body: payload() });
console.log(`${out.length} comandos registrados ${guild ? "no servidor " + guild : "globalmente (pode levar até 1 h)"}: ${out.map((c) => "/" + c.name).join(" ")}`);
