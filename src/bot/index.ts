import "dotenv/config";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";

const token = process.env.DISCORD_BOT_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_GUILD_ID;
const portalUrl = process.env.PORTAL_URL;

if (!token) throw new Error("Set DISCORD_BOT_TOKEN before starting the bot");
if (!applicationId) throw new Error("Set DISCORD_APPLICATION_ID before starting the bot");
if (!portalUrl) throw new Error("Set PORTAL_URL before starting the bot");

const parsedPortalUrl = new URL(portalUrl);
if (parsedPortalUrl.protocol !== "https:" && parsedPortalUrl.hostname !== "localhost") {
  throw new Error("PORTAL_URL must use HTTPS except for localhost development");
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const commands = [
  new SlashCommandBuilder()
    .setName("portal")
    .setDescription("Open the PatrolDesk employee signup or login portal"),
];

client.once("ready", async () => {
  try {
    const rest = new REST({ version: "10" }).setToken(token);
    const route = guildId
      ? Routes.applicationGuildCommands(applicationId, guildId)
      : Routes.applicationCommands(applicationId);
    await rest.put(route, { body: commands.map((command) => command.toJSON()) });
    console.info(`Registered /portal ${guildId ? `in guild ${guildId}` : "globally"}`);
    console.info(`PatrolDesk bot connected as ${client.user?.tag}`);
  } catch (error) {
    console.error("Could not register Discord slash commands", error);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === "portal") {
    const portalButton = new ButtonBuilder()
      .setLabel("Open PatrolDesk")
      .setStyle(ButtonStyle.Link)
      .setURL(parsedPortalUrl.toString());
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(portalButton);

    await interaction.reply({
      content: "Sign up for an account or sign in to the PatrolDesk employee portal.",
      components: [row],
      ephemeral: true,
    });
  }
});

void client.login(token).catch((error: unknown) => {
  console.error("Could not connect to Discord", error);
  process.exitCode = 1;
});