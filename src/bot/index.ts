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
const courtUrl = new URL("/court", parsedPortalUrl).toString();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const commands = [
  new SlashCommandBuilder()
    .setName("portal")
    .setDescription("Open the PatrolDesk employee signup or login portal"),
  new SlashCommandBuilder()
    .setName("court")
    .setDescription("Open the Westbridge roleplay courthouse portal"),
];

client.once("clientReady", async () => {
  try {
    const rest = new REST({ version: "10" }).setToken(token);
    const route = guildId
      ? Routes.applicationGuildCommands(applicationId, guildId)
      : Routes.applicationCommands(applicationId);
    await rest.put(route, { body: commands.map((command) => command.toJSON()) });
    console.info(`Registered /portal and /court ${guildId ? `in guild ${guildId}` : "globally"}`);
    console.info(`PatrolDesk bot connected as ${client.user?.tag}`);
  } catch (error) {
    console.error("Could not register Discord slash commands", error);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    await interaction.deferReply({ ephemeral: true });

    if (interaction.commandName !== "portal" && interaction.commandName !== "court") {
      await interaction.editReply("This command is not supported by PatrolDesk.");
      return;
    }

    const isCourt = interaction.commandName === "court";
    const portalButton = new ButtonBuilder()
      .setLabel(isCourt ? "Open Courthouse" : "Open PatrolDesk")
      .setStyle(ButtonStyle.Link)
      .setURL(isCourt ? courtUrl : parsedPortalUrl.toString());
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(portalButton);

    await interaction.editReply({
      content: isCourt
        ? "Open the roleplay courthouse to file or review in-game cases. Sign in to access your character's court records."
        : "Sign up for an account or sign in to the PatrolDesk employee portal.",
      components: [row],
    });
  } catch (error) {
    console.error(`Could not handle Discord command "${interaction.commandName}"`, error);

    if (interaction.deferred && !interaction.replied) {
      try {
        await interaction.editReply("PatrolDesk could not complete that command. Please try again.");
      } catch (replyError) {
        console.error("Could not send the Discord command error response", replyError);
      }
    }
  }
});

void client.login(token).catch((error: unknown) => {
  console.error("Could not connect to Discord", error);
  process.exitCode = 1;
});