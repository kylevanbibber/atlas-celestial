// bot/index.js
require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { SlashCommandBuilder } = require('@discordjs/builders');
const cron = require('node-cron');
const db = require('../db');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Keep track of all scheduled jobs so we can stop them later
const scheduledJobs = {
  reminders: {},
  leaderboards: {}
};

const commands = [
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show top sales in the last 24h')
    .addStringOption(opt =>
      opt.setName('period')
         .setDescription('Time period for leaderboard')
         .setRequired(false)
         .addChoices(
           { name: 'Today', value: 'daily' },
           { name: 'This Week', value: 'weekly' },
           { name: 'This Month', value: 'monthly' }
         )
    ),
  new SlashCommandBuilder()
    .setName('close')
    .setDescription('Record a close with ALP, refs, and lead type')
    .addNumberOption(opt =>
      opt.setName('alp')
         .setDescription('ALP amount')
         .setRequired(true)
         .setMinValue(0)
    )
    .addIntegerOption(opt =>
      opt.setName('refs')
         .setDescription('Number of referrals')
         .setRequired(true)
         .setMinValue(0)
    )
    .addStringOption(opt =>
      opt.setName('lead_type')
         .setDescription('Type of lead')
         .setRequired(true)
         .addChoices(
           { name: 'Union', value: 'union' },
           { name: 'Credit Union', value: 'credit_union' },
           { name: 'Association', value: 'association' },
           { name: 'POS', value: 'pos' },
           { name: 'Ref', value: 'ref' },
           { name: 'Child Safe', value: 'child_safe' },
           { name: 'Free Will Kit', value: 'free_will_kit' },
           { name: 'Other', value: 'other' }
         )
    )
].map(cmd => cmd.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);
  
  try {
    if (process.env.TEST_GUILD_ID) {
      // Register commands for test guild (faster updates)
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.TEST_GUILD_ID),
        { body: commands }
      );
      console.log('Discord slash commands registered for test guild');
    } else {
      // Register commands globally
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
      );
      console.log('Discord slash commands registered globally');
    }
  } catch (error) {
    console.error('Error registering Discord commands:', error);
  }
}

async function loadScheduledJobs() {
  try {
    // Clear existing scheduled jobs
    Object.values(scheduledJobs.reminders).forEach(job => job.stop());
    Object.values(scheduledJobs.leaderboards).forEach(job => job.stop());
    
    scheduledJobs.reminders = {};
    scheduledJobs.leaderboards = {};

    // Load reminders
    const reminders = await db.query('SELECT * FROM discord_reminders WHERE is_active = TRUE');
    reminders.forEach(reminder => {
      scheduledJobs.reminders[reminder.id] = cron.schedule(reminder.cron_expr, async () => {
        try {
          const channel = await client.channels.fetch(reminder.channel_id);
          if (channel && channel.isTextBased()) {
            await channel.send(reminder.message);
          }
        } catch (error) {
          console.error(`Error sending reminder to channel ${reminder.channel_id}:`, error);
        }
      });
      console.log(`Scheduled reminder: ${reminder.cron_expr} -> ${reminder.channel_id}`);
    });

    // Load leaderboards
    const leaderboards = await db.query('SELECT * FROM discord_leaderboards WHERE is_active = TRUE');
    leaderboards.forEach(leaderboard => {
      scheduledJobs.leaderboards[leaderboard.id] = cron.schedule(leaderboard.cron_expr, async () => {
        try {
          await sendLeaderboard(leaderboard);
        } catch (error) {
          console.error(`Error sending leaderboard to channel ${leaderboard.channel_id}:`, error);
        }
      });
      console.log(`Scheduled leaderboard: ${leaderboard.cron_expr} -> ${leaderboard.channel_id}`);
    });
  } catch (error) {
    console.error('Error loading scheduled jobs:', error);
  }
}

// Expose this function to be called from routes when reminders/leaderboards are updated
async function reloadScheduledJobs() {
  console.log('Reloading scheduled jobs');
  return loadScheduledJobs();
}

// Function to get the Discord client for sending messages directly
function getClient() {
  return client;
}

async function sendLeaderboard(leaderboard) {
  try {
    console.log(`[BOT] Sending scheduled leaderboard for channel ${leaderboard.channel_id}`);
    
    // Check if client is ready
    if (!client || !client.isReady()) {
      console.error(`[BOT] Discord bot is not ready when trying to send leaderboard to channel ${leaderboard.channel_id}`);
      return;
    }
    
    // Import the generateLeaderboardMessage function from discord routes
    const { generateLeaderboardMessage } = require('../routes/discord');
    
    // Generate the leaderboard message(s)
    const leaderboardMessages = await generateLeaderboardMessage(leaderboard);
    
    // Get the channel
    const channel = await client.channels.fetch(leaderboard.channel_id);
    
    if (!channel || !channel.isTextBased()) {
      console.error(`[BOT] Channel ${leaderboard.channel_id} not found or is not a text channel`);
      return;
    }
    
    // Send the message(s)
    if (Array.isArray(leaderboardMessages)) {
      // Send multiple messages with a small delay between them
      console.log(`[BOT] Sending ${leaderboardMessages.length} separate leaderboard messages`);
      for (let i = 0; i < leaderboardMessages.length; i++) {
        await channel.send(leaderboardMessages[i]);
        // Add a small delay between messages to avoid rate limiting
        if (i < leaderboardMessages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } else {
      // Send single message (backwards compatibility)
      console.log(`[BOT] Sending single leaderboard message`);
      await channel.send(leaderboardMessages);
    }
    
    console.log(`[BOT] Successfully sent leaderboard to channel ${leaderboard.channel_id}`);
    
  } catch (error) {
    console.error(`[BOT] Error sending leaderboard to channel ${leaderboard.channel_id}:`, error);
    throw error;
  }
}

async function crossPostSale(saleData, originalChannelId) {
  try {
    // Get all channels for the same manager (excluding the original channel)
    const channels = await db.query(`
      SELECT DISTINCT gc.channel_id, gc.channel_name
      FROM guild_configs gc
      WHERE gc.manager_id = ? AND gc.channel_id != ?
    `, [saleData.manager_id, originalChannelId]);

    for (const channel of channels) {
      try {
        const discordChannel = await client.channels.fetch(channel.channel_id);
        if (discordChannel && discordChannel.isTextBased()) {
          const embed = new EmbedBuilder()
            .setTitle('💰 New Sale Recorded!')
            .setDescription(`<@${saleData.discord_user_id}> just recorded a $${saleData.amount.toFixed(2)} sale!`)
            .setColor('#00ff00')
            .setTimestamp();

          if (saleData.details) {
            embed.addFields({ name: 'Details', value: saleData.details });
          }

          await discordChannel.send({ embeds: [embed] });
        }
      } catch (error) {
        console.error(`Error cross-posting to channel ${channel.channel_id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in cross-posting sale:', error);
  }
}

// Synchronize bot presence with database
async function syncBotPresenceWithDatabase() {
  try {
    console.log('Starting bot presence synchronization...');
    
    // Get all servers the bot is currently in
    const botGuilds = client.guilds.cache.map(guild => ({
      id: guild.id,
      name: guild.name
    }));
    
    if (botGuilds.length === 0) {
      console.log('Bot is not in any servers.');
      return;
    }
    
    console.log(`Bot is in ${botGuilds.length} servers.`);
    
    // Get all guild_configs entries
    const guildConfigs = await db.query('SELECT * FROM guild_configs');
    
    // Update bot_added = 1 for servers the bot is in
    for (const botGuild of botGuilds) {
      const matchingConfigs = guildConfigs.filter(config => config.guild_id === botGuild.id && !config.bot_added);
      
      if (matchingConfigs.length > 0) {
        console.log(`Found ${matchingConfigs.length} configs for guild ${botGuild.id} (${botGuild.name}) with bot_added = 0`);
        
        // Update the database
        await db.query(
          'UPDATE guild_configs SET bot_added = 1 WHERE guild_id = ?',
          [botGuild.id]
        );
        
        console.log(`Updated bot_added to 1 for guild ${botGuild.id} (${botGuild.name})`);
      }
    }
    
    // Update bot_added = 0 for servers the bot is not in
    const botGuildIds = botGuilds.map(g => g.id);
    const configsWithBotAdded = guildConfigs.filter(config => 
      config.bot_added && !botGuildIds.includes(config.guild_id)
    );
    
    for (const config of configsWithBotAdded) {
      console.log(`Bot is not in guild ${config.guild_id} (${config.guild_name}) but bot_added = 1`);
      
      // Update the database
      await db.query(
        'UPDATE guild_configs SET bot_added = 0 WHERE guild_id = ?',
        [config.guild_id]
      );
      
      console.log(`Updated bot_added to 0 for guild ${config.guild_id} (${config.guild_name})`);
    }
    
    console.log('Bot presence synchronization completed.');
  } catch (error) {
    console.error('Error synchronizing bot presence with database:', error);
  }
}

client.once('ready', async () => {
  console.log(`Discord bot logged in as ${client.user.tag} and is ready!`);
  console.log(`Bot is ready: ${client.isReady()}`);
  console.log(`Bot ready timestamp: ${client.readyAt}`);
  
  try {
    await registerCommands();
    console.log('Bot commands registered successfully');
    
    await loadScheduledJobs();
    console.log('Scheduled jobs loaded successfully');
    
    // Run initial synchronization
    await syncBotPresenceWithDatabase();
    console.log('Initial bot synchronization completed');
    
    // Schedule periodic synchronization (every hour)
    setInterval(syncBotPresenceWithDatabase, 60 * 60 * 1000);
    console.log('Periodic synchronization scheduled');
    
  } catch (error) {
    console.error('Error during bot ready initialization:', error);
  }
});

// Handle slash command interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    if (commandName === 'close') {
      await handleCloseCommand(interaction);
    } else if (commandName === 'leaderboard') {
      await handleLeaderboardCommand(interaction);
    }
  } catch (error) {
    console.error(`Error handling command ${commandName}:`, error);
    
    const errorMessage = 'There was an error processing your command. Please try again later.';
    
    if (interaction.replied) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
});

// Handle the /close command
async function handleCloseCommand(interaction) {
  const alp = interaction.options.getNumber('alp');
  const refs = interaction.options.getInteger('refs');
  const leadType = interaction.options.getString('lead_type');
  const discordUserId = interaction.user.id;
  const guildId = interaction.guild?.id;

  await interaction.deferReply({ ephemeral: true });

  try {
    const userQuery = `
      SELECT id, lagnname
      FROM activeusers
      WHERE discord_id = ? AND Active = 'y'
    `;
    const userResult = await db.query(userQuery, [discordUserId]);

    if (!userResult || userResult.length === 0) {
      await interaction.editReply({
        content: `❌ **Discord Account Not Linked**\n\nYour Discord account is not linked to your Arias Life account. Please visit **agents.ariaslife.com** to link your Discord account.\n\n**Steps:**\n1. Go to agents.ariaslife.com\n2. Log in with your Arias Life credentials\n3. Navigate to Account Settings\n4. Link your Discord account\n\nOnce linked, you'll be able to use the /close command.`
      });
      return;
    }

    const user = userResult[0];

    const insertQuery = `
      INSERT INTO discord_sales (discord_user, guild_id, alp, refs, lead_type, user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await db.query(insertQuery, [
      discordUserId,
      guildId,
      alp,
      refs,
      leadType,
      user.id
    ]);

    // Get today's total for this user
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const totalQuery = `
      SELECT 
        COALESCE(SUM(alp), 0) as total_alp,
        COALESCE(SUM(refs), 0) as total_refs,
        COUNT(*) as total_closes
      FROM discord_sales 
      WHERE user_id = ? 
        AND DATE(ts) = ?
    `;
    
    const totalResult = await db.query(totalQuery, [user.id, todayStr]);
    const totals = totalResult[0];

    const leadTypeDisplay = leadType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    await interaction.editReply({
      content: `✅ **Close Recorded Successfully!**\n\n**Agent:** ${user.lagnname}\n**ALP:** $${alp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n**Refs:** ${refs}\n**Lead Type:** ${leadTypeDisplay}\n**Time:** ${new Date().toLocaleString()}\n\n📊 **Today's Totals:**\n**Total ALP:** $${totals.total_alp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n**Total Refs:** ${totals.total_refs}\n**Total Closes:** ${totals.total_closes}`
    });

    console.log(`Close recorded: User ${user.lagnname} (${discordUserId}) - ALP: $${alp}, Refs: ${refs}, Lead Type: ${leadType}`);

  } catch (error) {
    console.error('Error recording close:', error);
    await interaction.editReply({
      content: '❌ **Error Recording Close**\n\nThere was an error saving your close. Please try again or contact support if the problem persists.'
    });
  }
}

// Placeholder handler for existing commands (to be implemented if needed)
async function handleLeaderboardCommand(interaction) {
  await interaction.reply({ 
    content: 'Leaderboard command is not yet implemented.', 
    ephemeral: true 
  });
}

// Add error event handler
client.on('error', (error) => {
  console.error('Discord client error:', error);
});

// Add disconnect event handler
client.on('disconnect', () => {
  console.log('Discord bot disconnected');
});

// Add reconnecting event handler
client.on('reconnecting', () => {
  console.log('Discord bot reconnecting...');
});

// Add resume event handler
client.on('resume', () => {
  console.log('Discord bot resumed connection');
});

// Add event handler for when the bot joins a new server
client.on('guildCreate', async (guild) => {
  try {
    console.log(`Bot joined a new server: ${guild.name} (${guild.id})`);
    
    // First, update any existing guild_configs entries to set bot_added = 1
    const updateResult = await db.query(
      `UPDATE guild_configs SET bot_added = 1 WHERE guild_id = ?`,
      [guild.id]
    );
    
    console.log(`Updated ${updateResult.affectedRows} existing guild_configs entries for guild ${guild.id}`);
    
    // Find the first text channel the bot can send messages in
    const generalChannel = guild.channels.cache.find(
      channel => 
        channel.isTextBased() && 
        channel.permissionsFor(guild.members.me).has('SendMessages')
    );
    
    if (!generalChannel) {
      console.log(`Could not find a suitable channel in ${guild.name} to configure.`);
      return;
    }
    
    // Get the owner of the server as the default manager
    const guildOwner = await guild.fetchOwner();
    
    // Check if this owner has a linked Discord account in our system
    const [ownerRecord] = await db.query(
      'SELECT id FROM activeusers WHERE discord_id = ?',
      [guildOwner.id]
    );
    
    if (!ownerRecord) {
      console.log(`Server owner of ${guild.name} does not have a linked account.`);
      
      // Send a welcome message to the channel
      await generalChannel.send(
        `👋 Hello! I'm now part of this server. To fully configure me, please link your Discord account in the web app and then use the "Configure Server" option in the Discord settings.`
      );
      return;
    }
    
    // Check if this guild is already configured
    const [existingConfig] = await db.query(
      'SELECT * FROM guild_configs WHERE guild_id = ? AND channel_id = ?',
      [guild.id, generalChannel.id]
    );
    
    if (existingConfig) {
      console.log(`Guild ${guild.name} is already configured.`);
      return;
    }
    
    // Check if this guild already has any configuration (without channel)
    const [existingGuildConfig] = await db.query(
      'SELECT * FROM guild_configs WHERE guild_id = ? AND (channel_id IS NULL OR channel_id = "")',
      [guild.id]
    );
    
    if (existingGuildConfig) {
      // Update the existing config with channel info
      await db.query(
        `UPDATE guild_configs 
         SET channel_id = ?, channel_name = ?, bot_added = 1
         WHERE id = ?`,
        [generalChannel.id, generalChannel.name, existingGuildConfig.id]
      );
      
      console.log(`Updated existing guild config for ${guild.name} with channel #${generalChannel.name}`);
    } else {
      // Add entry to guild_configs
      await db.query(
        `INSERT INTO guild_configs (manager_id, guild_id, guild_name, channel_id, channel_name, bot_added, is_primary)
         VALUES (?, ?, ?, ?, ?, 1, 0)`,
        [ownerRecord.id, guild.id, guild.name, generalChannel.id, generalChannel.name]
      );
      
      console.log(`Automatically configured guild ${guild.name} with channel #${generalChannel.name}`);
    }
    
    // Send a welcome message
    await generalChannel.send(
      `👋 Hello! I've been automatically configured to use this channel. You can change this in the web app's Discord settings.`
    );
    
  } catch (error) {
    console.error('Error handling guildCreate event:', error);
  }
});

// Add event handler for when the bot is removed from a server
client.on('guildDelete', async (guild) => {
  try {
    console.log(`Bot was removed from server: ${guild.name} (${guild.id})`);
    
    // Update configurations for this guild to set bot_added = 0
    const updateResult = await db.query(
      'UPDATE guild_configs SET bot_added = 0 WHERE guild_id = ?',
      [guild.id]
    );
    
    console.log(`Updated ${updateResult.affectedRows} guild configurations for ${guild.name}`);
  } catch (error) {
    console.error('Error handling guildDelete event:', error);
  }
});

function initDiscordBot() {
  if (!process.env.DISCORD_TOKEN) {
    console.error('DISCORD_TOKEN environment variable is not set');
    return;
  }
  
  console.log('Attempting to login to Discord...');
  client.login(process.env.DISCORD_TOKEN)
    .then(() => console.log('Discord bot login successful'))
    .catch(err => console.error('Discord login error:', err));
}

module.exports = { 
  initDiscordBot,
  syncBotPresenceWithDatabase,
  reloadScheduledJobs,
  getClient
};
