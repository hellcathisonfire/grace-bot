// npm run avatar  —  coloca assets/grace.png como foto do bot (o Discord limita a troca a poucas vezes por hora).
import { readFile } from "node:fs/promises";
import { REST, Routes } from "discord.js";

if (!process.env.DISCORD_TOKEN) { console.error("Preencha DISCORD_TOKEN no arquivo bot/.env"); process.exit(1); }
const img = await readFile(new URL("../assets/grace.png", import.meta.url));
await new REST().setToken(process.env.DISCORD_TOKEN).patch(Routes.user("@me"), { body: { avatar: `data:image/png;base64,${img.toString("base64")}` } });
console.log("Foto do bot atualizada.");
