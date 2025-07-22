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

const commands = [
  new SlashCommandBuilder()
    .setName('sale')
    .setDescription('Record a new sale')
    .addNumberOption(opt =>
      opt.setName('amount')
         .setDescription('Sale amount in USD')
         .setRequired(true)
         .setMinValue(0.01)
    )
    .addStringOption(opt =>
      opt.setName('details')
         .setDescription('Additional sale details')
         .setRequired(false)
    ),
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
    // Load reminders
    const reminders = await db.query('SELECT * FROM discord_reminders WHERE is_active = TRUE');
    reminders.forEach(reminder => {
      cron.schedule(reminder.cron_expr, async () => {
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
      cron.schedule(leaderboard.cron_expr, async () => {
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

async function sendLeaderboard(leaderboard) {
  const { guild_id, channel_id, metric_type, top_count } = leaderboard;
  
  let timeFilter;
  switch (metric_type) {
    case 'daily_sales':
      timeFilter = 'DATE_SUB(NOW(), INTERVAL 1 DAY)';
      break;
    case 'weekly_sales':
      timeFilter = 'DATE_SUB(NOW(), INTERVAL 1 WEEK)';
      break;
    case 'monthly_sales':
      timeFilter = 'DATE_SUB(NOW(), INTERVAL 1 MONTH)';
      break;
    default:
      timeFilter = 'DATE_SUB(NOW(), INTERVAL 1 DAY)';
  }

  const rows = await db.query(`
    SELECT ds.discord_user_id, au.firstname, au.lastname, SUM(ds.amount) AS total
    FROM discord_sales ds
    JOIN activeusers au ON ds.user_id = au.id
    WHERE ds.guild_id = ? AND ds.created_at > ${timeFilter}
    GROUP BY ds.discord_user_id, au.firstname, au.lastname
    ORDER BY total DESC
    LIMIT ?
  `, [guild_id, top_count]);

  if (!rows.length) {
    const channel = await client.channels.fetch(channel_id);
    if (channel && channel.isTextBased()) {
      await channel.send('No sales recorded for this period.');
    }
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${metric_type.replace('_', ' ').toUpperCase()} Leaderboard`)
    .setColor('#00ff00')
    .setTimestamp();

  const description = rows
    .map((row, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      return `${medal} <@${row.discord_user_id}> — $${row.total.toFixed(2)}`;
    })
    .join('\n');

  embed.setDescription(description);

  const channel = await client.channels.fetch(channel_id);
  if (channel && channel.isTextBased()) {
    await channel.send({ embeds: [embed] });
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

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
  await loadScheduledJobs();
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  
  const { commandName, options, guildId, user } = interaction;

  if (commandName === 'sale') {
    try {
      // Check if user has linked their Discord account
      const [userRecord] = await db.query(
        'SELECT id, firstname, lastname FROM activeusers WHERE discord_id = ?',
        [user.id]
      );

      if (!userRecord) {
        return interaction.reply({
          content: '🚨 Please link your Discord account in the web app before using this command.',
          ephemeral: true
        });
      }

      const amount = options.getNumber('amount');
      const details = options.getString('details') || '';

      // Get manager info for this guild
      const [guildConfig] = await db.query(
        'SELECT manager_id FROM guild_configs WHERE guild_id = ? LIMIT 1',
        [guildId]
      );

      if (!guildConfig) {
        return interaction.reply({
          content: '❌ This server is not configured for sales tracking.',
          ephemeral: true
        });
      }

      // Record the sale
      const [result] = await db.query(
        `INSERT INTO discord_sales (user_id, discord_user_id, guild_id, channel_id, amount, details)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userRecord.id, user.id, guildId, interaction.channelId, amount, details]
      );

      // Cross-post to other channels
      await crossPostSale({
        manager_id: guildConfig.manager_id,
        discord_user_id: user.id,
        amount,
        details
      }, interaction.channelId);

      return interaction.reply({
        content: `✅ Recorded sale of $${amount.toFixed(2)}.`,
        ephemeral: false
      });
    } catch (error) {
      console.error('Error processing sale command:', error);
      return interaction.reply({
        content: '❌ An error occurred while recording your sale.',
        ephemeral: true
      });
    }
  }

  if (commandName === 'leaderboard') {
    try {
      const period = options.getString('period') || 'daily';
      
      let timeFilter;
      switch (period) {
        case 'daily':
          timeFilter = 'DATE_SUB(NOW(), INTERVAL 1 DAY)';
          break;
        case 'weekly':
          timeFilter = 'DATE_SUB(NOW(), INTERVAL 1 WEEK)';
          break;
        case 'monthly':
          timeFilter = 'DATE_SUB(NOW(), INTERVAL 1 MONTH)';
          break;
        default:
          timeFilter = 'DATE_SUB(NOW(), INTERVAL 1 DAY)';
      }

      const rows = await db.query(`
        SELECT ds.discord_user_id, au.firstname, au.lastname, SUM(ds.amount) AS total
        FROM discord_sales ds
        JOIN activeusers au ON ds.user_id = au.id
        WHERE ds.guild_id = ? AND ds.created_at > ${timeFilter}
        GROUP BY ds.discord_user_id, au.firstname, au.lastname
        ORDER BY total DESC
        LIMIT 10
      `, [guildId]);

      if (!rows.length) {
        return interaction.reply({
          content: `No sales recorded in the last ${period === 'daily' ? '24 hours' : period === 'weekly' ? 'week' : 'month'}.`,
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(`${period.charAt(0).toUpperCase() + period.slice(1)} Sales Leaderboard`)
        .setColor('#00ff00')
        .setTimestamp();

      const description = rows
        .map((row, index) => {
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
          return `${medal} <@${row.discord_user_id}> — $${row.total.toFixed(2)}`;
        })
        .join('\n');

      embed.setDescription(description);

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error processing leaderboard command:', error);
      return interaction.reply({
        content: '❌ An error occurred while fetching the leaderboard.',
        ephemeral: true
      });
    }
  }
});

function initDiscordBot() {
  client.login(process.env.DISCORD_TOKEN)
    .catch(err => console.error('Discord login error:', err));
}

module.exports = { initDiscordBot };
