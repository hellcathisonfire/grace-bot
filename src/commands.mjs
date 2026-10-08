import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { MODES, REGIONS } from "./ui.mjs";

const modeOpt = (o) => o.setName("mode").setDescription("Queue").addChoices(...MODES.map(([value, name]) => ({ name, value })));
const regionOpt = (o) => o.setName("region").setDescription("Region").addChoices(...REGIONS.map((r) => ({ name: r, value: r })));

export const commands = [
  new SlashCommandBuilder().setName("link").setDescription("Link your Discord to your Brawlhalla account")
    .addStringOption((o) => o.setName("id").setDescription("Your Brawlhalla ID (numbers only)").setRequired(true).setMinLength(1).setMaxLength(12)),
  new SlashCommandBuilder().setName("unlink").setDescription("Remove the link to your Brawlhalla account"),
  new SlashCommandBuilder().setName("profile").setDescription("Show a player profile (yours by default)")
    .addUserOption((o) => o.setName("user").setDescription("A server member who linked their account"))
    .addStringOption((o) => o.setName("id").setDescription("Any Brawlhalla ID").setMinLength(1).setMaxLength(12)),
  new SlashCommandBuilder().setName("search").setDescription("Find a ranked player by name")
    .addStringOption((o) => o.setName("name").setDescription("Player name").setRequired(true).setMinLength(2).setMaxLength(40)),
  new SlashCommandBuilder().setName("live").setDescription("See who is playing ranked right now")
    .addStringOption(modeOpt).addStringOption(regionOpt),
  new SlashCommandBuilder().setName("livepanel").setDescription("A live ranked panel that updates itself")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName("start").setDescription("Post a self-updating panel in this channel").addStringOption(modeOpt).addStringOption(regionOpt))
    .addSubcommand((s) => s.setName("stop").setDescription("Stop and remove this server's panel")),
];

export const payload = () => commands.map((c) => c.toJSON());
