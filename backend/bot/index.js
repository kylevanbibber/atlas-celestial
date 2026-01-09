// bot/index.js
require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const cron = require('node-cron');
const axios = require('axios');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');
const os = require('os');
const db = require('../db');

// Imgur API client ID (same as in upload.js)
const IMGUR_CLIENT_ID = 'd08c81e700c9978';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// Keep track of all scheduled jobs so we can stop them later
const scheduledJobs = {
  reminders: {},
  leaderboards: {},
  motivationCalls: {},
  moreReminders: {}
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
    .addAttachmentOption(opt =>
      opt.setName('image')
         .setDescription('Optional image of the close (receipt, screenshot, etc.)')
         .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('more')
    .setDescription('Report aMORE hires (DM only)')
    .addStringOption(opt =>
      opt.setName('values')
         .setDescription('total,pr (e.g., 5,3)')
         .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask questions about your data, performance, or app information')
    .addStringOption(opt =>
      opt.setName('question')
         .setDescription('What would you like to know?')
         .setRequired(true)
         .setMaxLength(500)
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
    } else {
      // Register commands globally
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
      );
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
    Object.values(scheduledJobs.motivationCalls).forEach(job => job.stop());
    Object.values(scheduledJobs.moreReminders).forEach(job => job.stop());
    
    scheduledJobs.reminders = {};
    scheduledJobs.leaderboards = {};
    scheduledJobs.motivationCalls = {};
    scheduledJobs.moreReminders = {};

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
    });

    // Load motivation calls (disabled)
    // const motivationCalls = await db.query('SELECT * FROM discord_motivation_calls WHERE is_active = TRUE');
    // motivationCalls.forEach(motivationCall => { /* disabled */ });
    // console.log('Motivation call scheduling disabled');

    // Schedule aMORE DM reminders (EST timezone)
    scheduleMoreDmReminders();
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

// Helper: get current week's Friday date in YYYY-MM-DD (Eastern Time), assuming week Sat–Fri
function getCurrentFridayEST() {
  const now = new Date();
  const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const currentDay = estNow.getDay(); // 0=Sun..6=Sat
  const startOfWeek = new Date(estNow);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(estNow.getDate() - currentDay - 1); // Saturday
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Friday
  const yyyy = endOfWeek.getFullYear();
  const mm = String(endOfWeek.getMonth() + 1).padStart(2, '0');
  const dd = String(endOfWeek.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Helper: returns MGA lookup key for hierarchy and reporting (we use user.lagnname for reporting)
function deriveMgaLookupKey(user) {
  const role = (user.clname || '').toUpperCase();
  if (role === 'MGA' || role === 'RGA') return user.lagnname || user.mga || user.lagnname;
  return user.mga || user.lagnname;
}

// Core: find Discord-linked users who have NOT reported aMORE for this week
async function findUsersMissingMoreForWeek(fridayDate) {
  // Get all discord-linked, active users
  const users = await db.query(
    `SELECT id, lagnname, clname, mga, discord_id
     FROM activeusers
     WHERE Active = 'y'
       AND clname IN ('MGA','RGA')
       AND discord_id IS NOT NULL
       AND discord_id <> ''`
  );
  if (!users || users.length === 0) return [];

  // Build checks per user (reporting key is their own lagnname)
  const missing = [];
  for (const u of users) {
    try {
      const mgaKeyForReport = u.lagnname; // reporting uses user's lagnname as MGA
      const rows = await db.query(
        `SELECT 1 FROM amore_data WHERE MGA = ? AND MORE_Date = ? LIMIT 1`,
        [mgaKeyForReport, fridayDate]
      );
      if (!rows || rows.length === 0) {
        missing.push(u);
      }
    } catch (e) {
      // continue
    }
  }
  return missing;
}

// Schedule cron jobs to DM users who haven't reported aMORE by certain EST times
function scheduleMoreDmReminders() {
  const tz = 'America/New_York';
  const schedules = [
    { cron: '0 13 * * 5', label: 'Fri 1:00 PM ET' },
    { cron: '0 16 * * 5', label: 'Fri 4:00 PM ET' },
    { cron: '45 18 * * 5', label: 'Fri 6:45 PM ET' },
    { cron: '0 19 * * 5', label: 'Fri 7:00 PM ET' },
    { cron: '15 19 * * 5', label: 'Fri 7:15 PM ET' },
    { cron: '30 19 * * 5', label: 'Fri 7:30 PM ET' },
    { cron: '45 19 * * 5', label: 'Fri 7:45 PM ET' }
  ];

  schedules.forEach((entry, idx) => {
    const job = cron.schedule(entry.cron, async () => {
      try {
        if (!client || !client.isReady()) return;
        const friday = getCurrentFridayEST();
        const missing = await findUsersMissingMoreForWeek(friday);
        if (!missing || missing.length === 0) return;

        for (const u of missing) {
          try {
            const userObj = await client.users.fetch(u.discord_id);
            if (!userObj) continue;

            const friendlyFriday = new Date(friday + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: tz });
            const message = `Hi ${u.lagnname}, quick reminder to report your MORE numbers for the week ending ${friendlyFriday}.
You can DM me: \`/more values: total,pr\` (example: \`/more values: 5,3\`).`;

            await userObj.send(message);
            // small spacing to avoid burst
            await new Promise(res => setTimeout(res, 250));
          } catch (dmErr) {
            // Skip user on DM failure
          }
        }
      } catch (err) {
        console.error('[BOT] MORE reminder error:', err);
      }
    }, { timezone: tz });

    scheduledJobs.moreReminders[`more_${idx}`] = job;
  });
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

// Function to execute motivation calls (disabled)
async function executeMotivationCall(motivationCall) {
  console.log(`[BOT] Motivation feature removed. Skipping execution for: ${motivationCall?.title || 'unknown'}`);
  return;
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

          // Add image if available
          if (saleData.image_url) {
            embed.setImage(saleData.image_url);
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
    // Get all servers the bot is currently in
    const botGuilds = client.guilds.cache.map(guild => ({
      id: guild.id,
      name: guild.name
    }));
    
    if (botGuilds.length === 0) {
      return;
    }
    
    // Get all guild_configs entries
    const guildConfigs = await db.query('SELECT * FROM guild_configs');
    
    // Update bot_added = 1 for servers the bot is in
    for (const botGuild of botGuilds) {
      const matchingConfigs = guildConfigs.filter(config => config.guild_id === botGuild.id && !config.bot_added);
      
      if (matchingConfigs.length > 0) {
        // Update the database
        await db.query(
          'UPDATE guild_configs SET bot_added = 1 WHERE guild_id = ?',
          [botGuild.id]
        );
      }
    }
    
    // Update bot_added = 0 for servers the bot is not in
    const botGuildIds = botGuilds.map(g => g.id);
    const configsWithBotAdded = guildConfigs.filter(config => 
      config.bot_added && !botGuildIds.includes(config.guild_id)
    );
    
    for (const config of configsWithBotAdded) {
      // Update the database
      await db.query(
        'UPDATE guild_configs SET bot_added = 0 WHERE guild_id = ?',
        [config.guild_id]
      );
    }
  } catch (error) {
    console.error('Error synchronizing bot presence with database:', error);
  }
}

/**
 * Upload a Discord attachment to Imgur
 * @param {string} attachmentUrl - The Discord attachment URL
 * @param {string} filename - The filename to use
 * @returns {Promise<{url: string, deleteHash: string}>}
 */
async function uploadDiscordAttachmentToImgur(attachmentUrl, filename) {
  try {
    console.log(`[BOT] Uploading Discord attachment to Imgur: ${attachmentUrl}`);
    
    // Download the attachment from Discord
    const response = await axios.get(attachmentUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'DiscordBot (Atlas Bot)'
      }
    });
    
    // Create a temporary file
    const tempDir = os.tmpdir();
    const tempPath = path.join(tempDir, filename);
    
    // Write the file
    fs.writeFileSync(tempPath, response.data);
    
    // Create form data for Imgur upload
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('image', fs.createReadStream(tempPath));
    
    // Upload to Imgur
    const imgurResponse = await axios.post('https://api.imgur.com/3/image', formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Client-ID ${IMGUR_CLIENT_ID}`
      }
    });
    
    // Clean up temp file
    fs.unlinkSync(tempPath);
    
    if (imgurResponse.data.success) {
      console.log(`[BOT] Successfully uploaded to Imgur: ${imgurResponse.data.data.link}`);
      return {
        url: imgurResponse.data.data.link,
        deleteHash: imgurResponse.data.data.deletehash
      };
    } else {
      throw new Error(imgurResponse.data.data.error || 'Imgur upload failed');
    }
    
  } catch (error) {
    console.error('[BOT] Error uploading Discord attachment to Imgur:', error);
    throw error;
  }
}

/**
 * Update Daily_Activity table directly with Discord sale data
 * @param {number} userId - The user ID
 * @param {string} saleDate - The sale date in YYYY-MM-DD format (Eastern Time)
 * @param {number} alp - The ALP amount from the sale
 * @param {number} refs - The refs count from the sale
 */
async function updateDailyActivityFromDiscordSale(userId, saleDate, alp, refs) {
  try {
    console.log(`[BOT] 📊 === STARTING updateDailyActivityFromDiscordSale ===`);
    console.log(`[BOT] 📊 Input parameters: userId=${userId}, saleDate=${saleDate} (Eastern), alp=${alp}, refs=${refs}`);
    console.log(`[BOT] 📊 Database timezone setting: America/New_York`);
    console.log(`[BOT] �� Using Eastern date for database queries: ${saleDate}`);

    // Get user details from activeusers
    console.log(`[BOT] 🔍 Querying activeusers table for userId: ${userId}`);
    const userDetailsQuery = 'SELECT lagnname, esid, MGA, SA, GA, rga FROM activeusers WHERE id = ?';
    console.log(`[BOT] 🔍 Query: ${userDetailsQuery} with params: [${userId}]`);
    
    const userDetails = await db.query(userDetailsQuery, [userId]);
    console.log(`[BOT] 🔍 User query result:`, userDetails);

    if (!userDetails || userDetails.length === 0) {
      console.error(`[BOT] ❌ User ${userId} not found in activeusers table`);
      return;
    }

    const user = userDetails[0];
    console.log(`[BOT] 👤 User details found:`, { 
      lagnname: user.lagnname, 
      esid: user.esid, 
      MGA: user.MGA, 
      SA: user.SA, 
      GA: user.GA,
      rga: user.rga
    });

    // Add a final safety check: verify this specific sale values haven't been added to Daily_Activity in the last few minutes
    console.log(`[BOT] 🔍 Safety check: Looking for recent Daily_Activity updates with these exact values...`);
    const recentUpdateCheck = await db.query(`
      SELECT reportDate, sales, alp, refs, UNIX_TIMESTAMP(NOW()) - UNIX_TIMESTAMP(reportDate) as seconds_ago
      FROM Daily_Activity 
      WHERE agent = ? 
        AND reportDate = ?
        AND MOD(alp, ?) = 0
        AND MOD(refs, ?) = 0
        AND UNIX_TIMESTAMP(NOW()) - UNIX_TIMESTAMP(reportDate) < 300
    `, [user.lagnname, saleDate, alp || 1, refs || 1]);
    
    console.log(`[BOT] 🔍 Recent Daily_Activity check result:`, recentUpdateCheck);

    // Check if Daily_Activity record exists for this date and user
    // Note: We're using the UTC date, but the database connection is set to America/New_York timezone
    console.log(`[BOT] 🔍 Checking for existing Daily_Activity record: agent=${user.lagnname}, date=${saleDate}`);
    const existingRecordQuery = 'SELECT * FROM Daily_Activity WHERE agent = ? AND reportDate = ?';
    console.log(`[BOT] 🔍 Query: ${existingRecordQuery} with params: [${user.lagnname}, ${saleDate}]`);
    
    const existingRecord = await db.query(existingRecordQuery, [user.lagnname, saleDate]);
    console.log(`[BOT] 🔍 Existing record query result:`, existingRecord);

    if (existingRecord && existingRecord.length > 0) {
      // Update existing record - add this sale to current values
      console.log(`[BOT] 🔄 === UPDATING EXISTING RECORD ===`);
      
      const existing = existingRecord[0];
      console.log(`[BOT] 🔄 Current record values:`, {
        sales: existing.sales,
        alp: existing.alp,
        refs: existing.refs,
        reportDate: existing.reportDate
      });
      
      // Add this sale's values to existing values
      const newSales = (existing.sales || 0) + 1; // Add 1 sale
      const newAlp = (existing.alp || 0) + alp;
      const newRefs = (existing.refs || 0) + refs;

      console.log(`[BOT] 🔄 Calculated new values:`, {
        newSales: newSales,
        newAlp: newAlp,
        newRefs: newRefs
      });

      const updateQuery = `
        UPDATE Daily_Activity 
        SET 
          sales = ?,
          alp = ?,
          refs = ?
        WHERE agent = ? AND reportDate = ?
      `;
      const updateParams = [newSales, newAlp, newRefs, user.lagnname, saleDate];
      
      console.log(`[BOT] 🔄 Update query: ${updateQuery}`);
      console.log(`[BOT] 🔄 Update params:`, updateParams);

      const updateResult = await db.query(updateQuery, updateParams);
      console.log(`[BOT] 🔄 Update result:`, updateResult);

      console.log(`[BOT] ✅ Updated Daily_Activity: sales=${newSales}, alp=${newAlp}, refs=${newRefs}`);
    } else {
      // Create new record
      console.log(`[BOT] ➕ === CREATING NEW RECORD ===`);
      console.log(`[BOT] ➕ Will create record with reportDate: ${saleDate} (UTC format)`);
      console.log(`[BOT] ➕ Values to insert - sales: 1, alp: ${alp}, refs: ${refs}`);
      console.log(`[BOT] ➕ ALP type: ${typeof alp}, Refs type: ${typeof refs}`);

      const insertQuery = `
        INSERT INTO Daily_Activity (
          reportDate,
          esid,
          MGA,
          Work,
          calls,
          appts,
          sits,
          sales,
          alp,
          refs,
          rga,
          agent,
          SA,
          GA,
          userId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const insertParams = [
        saleDate,           // reportDate (UTC YYYY-MM-DD)
        user.esid,          // esid
        user.MGA,           // MGA
        saleDate,           // Work (use same date)
        0,                  // calls (default to 0)
        0,                  // appts (default to 0)
        0,                  // sits (default to 0)
        1,                  // sales (1 sale)
        alp,                // alp
        refs,               // refs
        user.rga || null,   // rga (might be null)
        user.lagnname,      // agent
        user.SA,            // SA
        user.GA,            // GA
        userId              // userId
      ];

      console.log(`[BOT] ➕ Insert query: ${insertQuery}`);
      console.log(`[BOT] ➕ Insert params detailed:`, {
        reportDate: insertParams[0],
        esid: insertParams[1],
        MGA: insertParams[2],
        Work: insertParams[3],
        calls: insertParams[4],
        appts: insertParams[5],
        sits: insertParams[6],
        sales: insertParams[7],
        alp: insertParams[8],
        refs: insertParams[9],
        rga: insertParams[10],
        agent: insertParams[11],
        SA: insertParams[12],
        GA: insertParams[13],
        userId: insertParams[14]
      });

      const insertResult = await db.query(insertQuery, insertParams);
      console.log(`[BOT] ➕ Insert result:`, insertResult);

      // Verify what was actually inserted
      if (insertResult.insertId || insertResult.affectedRows > 0) {
        console.log(`[BOT] ➕ Verifying inserted record...`);
        const verifyQuery = `
          SELECT reportDate, sales, alp, refs, agent, userId 
          FROM Daily_Activity 
          WHERE agent = ? AND reportDate = ?
        `;
        const verifyResult = await db.query(verifyQuery, [user.lagnname, saleDate]);
        console.log(`[BOT] ➕ Verification result:`, verifyResult[0]);
      }

    
      console.log(`[BOT] ✅ Created new Daily_Activity record: sales=1, alp=${alp}, refs=${refs}`);
    }

    console.log(`[BOT] 📊 === COMPLETED updateDailyActivityFromDiscordSale ===`);

  } catch (error) {
    console.error(`[BOT] ❌ Error updating Daily_Activity:`, error);
    console.error(`[BOT] ❌ Error stack:`, error.stack);
  }
}

// Q&A Helper Functions
const qaHelpers = {
  // Process natural language questions and extract intent
  processQuestion(question) {
    const lowerQuestion = question.toLowerCase();
    
    // Check for different question types
    if (lowerQuestion.includes('how many') || lowerQuestion.includes('count') || lowerQuestion.includes('total')) {
      return { type: 'count', question: lowerQuestion };
    }
    
    if (lowerQuestion.includes('what is') || lowerQuestion.includes('show me') || lowerQuestion.includes('get')) {
      return { type: 'info', question: lowerQuestion };
    }
    
    if (lowerQuestion.includes('when') || lowerQuestion.includes('date') || lowerQuestion.includes('time')) {
      return { type: 'date', question: lowerQuestion };
    }
    
    if (lowerQuestion.includes('performance') || lowerQuestion.includes('stats') || lowerQuestion.includes('metrics')) {
      return { type: 'performance', question: lowerQuestion };
    }
    
    // Default to general info
    return { type: 'general', question: lowerQuestion };
  },

  // Generate database queries based on question type and content
  async generateQuery(questionData, userId) {
    const { type, question } = questionData;
    
    try {
      // Get user info for personalized queries
      const userInfo = await db.query(
        'SELECT lagnname, clname, sa, ga, mga, rga FROM activeusers WHERE discord_id = ?',
        [userId]
      );
      
      if (!userInfo || userInfo.length === 0) {
        return { error: 'User not found in database' };
      }
      
      const user = userInfo[0];
      
      // Handle different question types
      switch (type) {
        case 'count':
          return await this.handleCountQuery(question, user);
        case 'performance':
          return await this.handlePerformanceQuery(question, user);
        case 'date':
          return await this.handleDateQuery(question, user);
        case 'info':
          return await this.handleInfoQuery(question, user);
        default:
          return await this.handleGeneralQuery(question, user);
      }
    } catch (error) {
      console.error('Error generating query:', error);
      return { error: 'Failed to process question' };
    }
  },

  // Handle count-based questions
  async handleCountQuery(question, user) {
    if (question.includes('sales') || question.includes('closes')) {
      const result = await db.query(
        'SELECT COUNT(*) as total FROM discord_sales WHERE user_id = (SELECT id FROM activeusers WHERE discord_id = ?)',
        [user.discord_id]
      );
      return {
        title: 'Sales Count',
        description: `You have made **${result[0].total}** total sales.`,
        color: 0x00ff00
      };
    }
    
    if (question.includes('refs') || question.includes('referrals')) {
      const result = await db.query(
        'SELECT SUM(refs) as total_refs FROM discord_sales WHERE user_id = (SELECT id FROM activeusers WHERE discord_id = ?)',
        [user.discord_id]
      );
      return {
        title: 'Referrals Count',
        description: `You have generated **${result[0].total_refs || 0}** total referrals.`,
        color: 0x0099ff
      };
    }
    
    if (question.includes('alp') || question.includes('premium')) {
      const result = await db.query(
        'SELECT SUM(alp) as total_alp FROM discord_sales WHERE user_id = (SELECT id FROM activeusers WHERE discord_id = ?)',
        [user.discord_id]
      );
      return {
        title: 'ALP Total',
        description: `Your total ALP is **$${(result[0].total_alp || 0).toLocaleString()}**.`,
        color: 0xff9900
      };
    }
    
    return { error: 'I couldn\'t understand what you want me to count. Try asking about sales, refs, or ALP.' };
  },

  // Handle performance-based questions
  async handlePerformanceQuery(question, user) {
    if (question.includes('today') || question.includes('today\'s')) {
      const today = new Date().toISOString().split('T')[0];
      const result = await db.query(
        'SELECT COUNT(*) as sales, SUM(alp) as alp, SUM(refs) as refs FROM discord_sales WHERE user_id = (SELECT id FROM activeusers WHERE discord_id = ?) AND DATE(ts) = ?',
        [user.discord_id, today]
      );
      
      return {
        title: 'Today\'s Performance',
        description: `**Sales:** ${result[0].sales || 0}\n**ALP:** $${(result[0].alp || 0).toLocaleString()}\n**Referrals:** ${result[0].refs || 0}`,
        color: 0x00ff00
      };
    }
    
    if (question.includes('week') || question.includes('weekly')) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() + (6 - weekEnd.getDay()));
      
      const result = await db.query(
        'SELECT COUNT(*) as sales, SUM(alp) as alp, SUM(refs) as refs FROM discord_sales WHERE user_id = (SELECT id FROM activeusers WHERE discord_id = ?) AND DATE(ts) BETWEEN ? AND ?',
        [user.discord_id, weekStart.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0]]
      );
      
      return {
        title: 'This Week\'s Performance',
        description: `**Sales:** ${result[0].sales || 0}\n**ALP:** $${(result[0].alp || 0).toLocaleString()}\n**Referrals:** ${result[0].refs || 0}`,
        color: 0x0099ff
      };
    }
    
    if (question.includes('month') || question.includes('monthly')) {
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthEnd = new Date();
      monthEnd.setMonth(monthEnd.getMonth() + 1, 0);
      
      const result = await db.query(
        'SELECT COUNT(*) as sales, SUM(alp) as alp, SUM(refs) as refs FROM discord_sales WHERE user_id = (SELECT id FROM activeusers WHERE discord_id = ?) AND DATE(ts) BETWEEN ? AND ?',
        [user.discord_id, monthStart.toISOString().split('T')[0], monthEnd.toISOString().split('T')[0]]
      );
      
      return {
        title: 'This Month\'s Performance',
        description: `**Sales:** ${result[0].sales || 0}\n**ALP:** $${(result[0].alp || 0).toLocaleString()}\n**Referrals:** ${result[0].refs || 0}`,
        color: 0xff9900
      };
    }
    
    return { error: 'I couldn\'t understand the time period. Try asking about today, this week, or this month.' };
  },

  // Handle date-based questions
  async handleDateQuery(question, user) {
    if (question.includes('last sale') || question.includes('most recent')) {
      const result = await db.query(
        'SELECT ts, alp, refs, lead_type FROM discord_sales WHERE user_id = (SELECT id FROM activeusers WHERE discord_id = ?) ORDER BY ts DESC LIMIT 1',
        [user.discord_id]
      );
      
      if (result.length === 0) {
        return { error: 'You haven\'t made any sales yet.' };
      }
      
      const sale = result[0];
      const date = new Date(sale.ts).toLocaleDateString();
      
      return {
        title: 'Last Sale',
        description: `**Date:** ${date}\n**ALP:** $${sale.alp.toLocaleString()}\n**Referrals:** ${sale.refs}\n**Type:** ${sale.lead_type}`,
        color: 0x00ff00
      };
    }
    
    return { error: 'I couldn\'t understand what date information you\'re looking for. Try asking about your last sale.' };
  },

  // Handle general info questions
  async handleInfoQuery(question, user) {
    if (question.includes('role') || question.includes('position')) {
      return {
        title: 'Your Role',
        description: `**Name:** ${user.lagnname}\n**Role:** ${user.clname}\n**SA:** ${user.sa || 'N/A'}\n**GA:** ${user.ga || 'N/A'}\n**MGA:** ${user.mga || 'N/A'}\n**RGA:** ${user.rga || 'N/A'}`,
        color: 0x0099ff
      };
    }
    
    if (question.includes('help') || question.includes('commands')) {
      return {
        title: 'Available Commands',
        description: `**/close** - Record a sale\n**/leaderboard** - View performance rankings\n**/ask** - Ask questions about your data\n\nTry asking me about:\n• Your sales count\n• Today\'s performance\n• Your role information\n• Recent activity`,
        color: 0x0099ff
      };
    }
    
    return { error: 'I couldn\'t understand what information you want. Try asking about your role, or type "help" for available commands.' };
  },

  // Handle general queries
  async handleGeneralQuery(question, user) {
    // Try to match common patterns
    if (question.includes('hello') || question.includes('hi')) {
      return {
        title: 'Hello!',
        description: `Hi ${user.lagnname}! I\'m here to help you with information about your performance and data. Try asking me about your sales, referrals, or role!`,
        color: 0x00ff00
      };
    }
    
    // Default response with suggestions
    return {
      title: 'I\'m here to help!',
      description: `I can help you with:\n• **Sales information** - "How many sales do I have?"\n• **Performance metrics** - "What's my performance today?"\n• **Role details** - "What's my role?"\n• **Recent activity** - "When was my last sale?"\n\nTry rephrasing your question or ask for help!`,
      color: 0x0099ff
    };
  }
};

client.once('ready', async () => {
  console.log(`Discord bot ready as ${client.user.tag}`);
  
  try {
    await registerCommands();
    await loadScheduledJobs();
    
    // Run initial synchronization
    await syncBotPresenceWithDatabase();
    
    // Schedule periodic synchronization (every hour)
    setInterval(syncBotPresenceWithDatabase, 60 * 60 * 1000);
    
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
    } else if (commandName === 'ask') {
      await handleAskCommand(interaction);
    } else if (commandName === 'more') {
      await handleMoreCommand(interaction);
    }
  } catch (error) {
    console.error(`Error handling command ${commandName}:`, error);
    
    const errorMessage = 'There was an error processing your command. Please try again later.';
    
    try {
      if (interaction.replied) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    } catch (interactionError) {
      console.error('Error responding to interaction:', interactionError);
      // If we can't respond to the interaction, just log it
    }
  }
});

// Handle the /close command
async function handleCloseCommand(interaction) {
  console.log(`[BOT] 🎯 === STARTING handleCloseCommand ===`);
  
  const alp = interaction.options.getNumber('alp');
  const refs = interaction.options.getInteger('refs');
  const leadType = interaction.options.getString('lead_type');
  const attachment = interaction.options.getAttachment('image');
  const discordUserId = interaction.user.id;
  const guildId = interaction.guild?.id;

  console.log(`[BOT] 🎯 Command parameters:`, {
    alp: alp,
    refs: refs,
    leadType: leadType,
    discordUserId: discordUserId,
    guildId: guildId,
    hasAttachment: !!attachment
  });

  // Try to defer reply, but continue even if it fails (for testing with multiple instances)
  let canReply = true;
  try {
    console.log(`[BOT] 🎯 Attempting to defer reply...`);
    await interaction.deferReply({ ephemeral: true });
    console.log(`[BOT] 🎯 ✅ Reply deferred successfully`);
  } catch (error) {
    console.error('[BOT] 🎯 ❌ Error deferring reply (likely multiple bot instances):', error.message);
    console.log('[BOT] 🎯 ⚠️ Continuing without ability to reply...');
    canReply = false;
  }

  try {
    console.log(`[BOT] 🎯 Looking up user by Discord ID: ${discordUserId}`);
    const userQuery = `
      SELECT id, lagnname
      FROM activeusers
      WHERE discord_id = ? AND Active = 'y'
    `;
    const userResult = await db.query(userQuery, [discordUserId]);
    console.log(`[BOT] 🎯 User lookup result:`, userResult);

    if (!userResult || userResult.length === 0) {
      console.log(`[BOT] 🎯 ❌ User not found or not linked`);
      if (canReply) {
        await interaction.editReply({
          content: `❌ **Discord Account Not Linked**\n\nYour Discord account is not linked to your Arias Life account. Please visit **agents.ariaslife.com** to link your Discord account.\n\n**Steps:**\n1. Go to agents.ariaslife.com\n2. Log in with your Arias Life credentials\n3. Navigate to Account Settings\n4. Link your Discord account\n\nOnce linked, you'll be able to use the /close command.`
        });
      }
      return;
    }

    const user = userResult[0];
    console.log(`[BOT] 🎯 ✅ User found:`, { id: user.id, lagnname: user.lagnname });

    // Check for duplicate submissions within the last 60 seconds to prevent double-processing
    console.log(`[BOT] 🎯 Checking for recent duplicate submissions...`);
    const duplicateCheckQuery = `
      SELECT id, ts, alp, refs, lead_type 
      FROM discord_sales 
      WHERE user_id = ? 
        AND alp = ? 
        AND refs = ? 
        AND lead_type = ?
        AND ts >= DATE_SUB(NOW(), INTERVAL 60 SECOND)
    `;
    const duplicateCheck = await db.query(duplicateCheckQuery, [user.id, alp, refs, leadType]);
    console.log(`[BOT] 🎯 Duplicate check result:`, duplicateCheck);

    if (duplicateCheck && duplicateCheck.length > 0) {
      console.log(`[BOT] 🎯 ⚠️ Duplicate submission detected - same values within 60 seconds`);
      console.log(`[BOT] 🎯 ⚠️ Existing record:`, duplicateCheck[0]);
      
      if (canReply) {
        await interaction.editReply({
          content: `⚠️ **Duplicate Submission Detected**\n\nA close with the same values was already recorded within the last 60 seconds. If this was intentional, please wait a moment and try again.`
        });
      }
      return;
    }

    let imageUrl = null;

    // Process image if provided
    if (attachment) {
      console.log(`[BOT] 🎯 Processing attachment...`);
      try {
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(attachment.contentType)) {
          console.log(`[BOT] 🎯 ❌ Invalid file type: ${attachment.contentType}`);
          if (canReply) {
            await interaction.editReply({
              content: '❌ **Invalid Image Type**\n\nPlease upload a valid image file (JPEG, PNG, GIF, or WebP).'
            });
          }
          return;
        }

        // Validate file size (max 10MB for Imgur)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (attachment.size > maxSize) {
          console.log(`[BOT] 🎯 ❌ File too large: ${attachment.size} bytes`);
          if (canReply) {
            await interaction.editReply({
              content: '❌ **File Too Large**\n\nPlease upload an image smaller than 10MB.'
            });
          }
          return;
        }

        console.log(`[BOT] 🎯 Uploading to Imgur...`);
        // Upload to Imgur
        const uploadResult = await uploadDiscordAttachmentToImgur(
          attachment.url, 
          attachment.name || 'discord_attachment.jpg'
        );
        imageUrl = uploadResult.url;
        console.log(`[BOT] 🎯 ✅ Image uploaded: ${imageUrl}`);
        
      } catch (error) {
        console.error('[BOT] 🎯 ❌ Error processing image:', error);
        // Continue without the image - don't show error to user since we're continuing
        imageUrl = null;
      }
    }

    console.log(`[BOT] 🎯 Preparing to insert into discord_sales table...`);
    
    // Calculate Eastern Time timestamp for insertion
    const currentTime = new Date();
    const easternTime = new Date(currentTime.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const easternTimestamp = easternTime.toISOString().slice(0, 19).replace('T', ' ');
    
    console.log(`[BOT] 🎯 Current UTC time: ${currentTime.toISOString()}`);
    console.log(`[BOT] 🎯 Eastern timestamp for DB: ${easternTimestamp}`);
    
    // Idempotency guard: prevent duplicate inserts for the same user/value within a short window
    try {
      const dupCheck = await db.query(
        `SELECT id FROM discord_sales
         WHERE user_id = ?
           AND alp = ?
           AND refs = ?
           AND lead_type = ?
           AND ABS(TIMESTAMPDIFF(SECOND, ts, ?)) <= 5
         LIMIT 1`,
        [user.id, alp, refs, leadType, easternTimestamp]
      );

      if (dupCheck.length > 0) {
        console.log(`[BOT] 🎯 ⚠️ Duplicate close detected (time/value match) — skipping insert. Existing id=${dupCheck[0].id}`);
        if (canReply) {
          await interaction.editReply({
            content: `⚠️ **Close Already Recorded**\n\nA similar close was recorded moments ago. If this wasn't you, please contact support.`
          });
        }
        return;
      }
    } catch (dupErr) {
      console.warn('[BOT] 🎯 Duplicate check failed (continuing):', dupErr.message);
    }

    // Use a more robust approach: try to insert with a unique constraint check (via submission_id)
    // Prefer Discord interaction id for idempotency when available
    const submissionId = (interaction && interaction.id) 
      ? `ixn_${interaction.id}` 
      : `${discordUserId}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    
    const insertQuery = `
      INSERT INTO discord_sales (discord_user, guild_id, alp, refs, lead_type, image_url, user_id, submission_id, ts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const insertParams = [discordUserId, guildId, alp, refs, leadType, imageUrl, user.id, submissionId, easternTimestamp];
    console.log(`[BOT] 🎯 Insert query:`, insertQuery);
    console.log(`[BOT] 🎯 Insert params:`, insertParams);
    console.log(`[BOT] 🎯 Submission ID: ${submissionId}`);

    let insertResult;
    try {
      insertResult = await db.query(insertQuery, insertParams);
      console.log(`[BOT] 🎯 ✅ Discord sale inserted successfully:`, insertResult);
    } catch (insertError) {
      if (insertError.code === 'ER_DUP_ENTRY') {
        console.log(`[BOT] 🎯 ⚠️ Duplicate entry prevented by database constraint`);
        
        if (canReply) {
          await interaction.editReply({
            content: `⚠️ **Close Already Recorded**\n\nThis close appears to have already been recorded. If you believe this is an error, please contact support.`
          });
        }
        return;
      } else if (insertError.code === 'ER_BAD_FIELD_ERROR') {
        // submission_id column doesn't exist, try without it
        console.log(`[BOT] 🎯 ⚠️ submission_id column doesn't exist, falling back to original insert`);
        
        const fallbackQuery = `
          INSERT INTO discord_sales (discord_user, guild_id, alp, refs, lead_type, image_url, user_id, ts)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const fallbackParams = [discordUserId, guildId, alp, refs, leadType, imageUrl, user.id, easternTimestamp];
        
        try {
          insertResult = await db.query(fallbackQuery, fallbackParams);
          console.log(`[BOT] 🎯 ✅ Discord sale inserted successfully (fallback):`, insertResult);
        } catch (fallbackError) {
          console.error(`[BOT] 🎯 ❌ Fallback insert also failed:`, fallbackError);
          throw fallbackError;
        }
      } else {
        throw insertError; // Re-throw other errors
      }
    }

    // Log the actual timestamp that was stored
    if (insertResult.insertId) {
      console.log(`[BOT] 🎯 Checking stored timestamp for insert ID: ${insertResult.insertId}`);
      const timestampCheck = await db.query(
        'SELECT id, ts, DATE(ts) as date_part, TIME(ts) as time_part FROM discord_sales WHERE id = ?',
        [insertResult.insertId]
      );
      console.log(`[BOT] 🎯 Stored timestamp info:`, timestampCheck[0]);
    }

    console.log(`[BOT] 🎯 Close recorded: User ${user.lagnname} (${discordUserId}) - ALP: $${alp}, Refs: ${refs}, Lead Type: ${leadType}${imageUrl ? ', Image: ' + imageUrl : ''}`);

    // Update Daily_Activity table with the new sale
    console.log(`[BOT] 🎯 === CALLING updateDailyActivityFromDiscordSale ===`);
    
    // Use Eastern Time to match database timezone setting (America/New_York)
    const now = new Date();
    
    // Properly convert to Eastern Time
    const easternTimeString = now.toLocaleString("en-US", {
      timeZone: "America/New_York",
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    // Parse the MM/DD/YYYY format and convert to YYYY-MM-DD
    const [month, day, year] = easternTimeString.split('/');
    const saleDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    
    console.log(`[BOT] 🎯 Current UTC time: ${now.toISOString()}`);
    console.log(`[BOT] 🎯 Eastern time string: ${easternTimeString}`);
    console.log(`[BOT] 🎯 Sale date (Eastern): ${saleDate}, User ID: ${user.id}`);
    
    await updateDailyActivityFromDiscordSale(user.id, saleDate, alp, refs);
    console.log(`[BOT] 🎯 ✅ Daily activity update completed`);

    // Always calculate today's totals for logging, regardless of reply ability
    console.log(`[BOT] 🎯 Getting today's totals...`);
    
    // Use DATE(ts) to query just by date instead of datetime range
    console.log(`[BOT] 🎯 Querying discord_sales for date: ${saleDate}`);
    
    const totalQuery = `
      SELECT 
        COALESCE(SUM(alp), 0) as total_alp,
        COALESCE(SUM(refs), 0) as total_refs,
        COUNT(*) as total_closes
      FROM discord_sales 
      WHERE user_id = ? 
        AND DATE(ts) = ?
    `;
    
    const totalResult = await db.query(totalQuery, [user.id, saleDate]);
    const totals = totalResult[0];
    console.log(`[BOT] 🎯 Today's totals query params: [${user.id}, ${saleDate}]`);
    console.log(`[BOT] 🎯 Today's totals result:`, totals);

    // Send reply only if we can reply
    if (canReply) {
      const leadTypeDisplay = leadType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

      // Use Eastern Time for display
      const displayTime = new Date().toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      let responseContent = `✅ **Close Recorded Successfully!**\n\n**Agent:** ${user.lagnname}\n**ALP:** $${alp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n**Refs:** ${refs}\n**Lead Type:** ${leadTypeDisplay}\n**Time:** ${displayTime}`;

      if (imageUrl) {
        responseContent += `\n📷 **Image:** [View Receipt](${imageUrl})`;
      }

      // Note: No Today's Totals in the private reply

      console.log(`[BOT] 🎯 Sending final reply...`);
      try {
        await interaction.editReply({
          content: responseContent
        });
        console.log(`[BOT] 🎯 ✅ Final reply sent successfully`);
      } catch (replyError) {
        console.error('[BOT] 🎯 ❌ Error sending final reply:', replyError.message);
      }
    } else {
      console.log(`[BOT] 🎯 ⚠️ Skipping reply - cannot respond to this interaction`);
      console.log(`[BOT] 🎯 📊 TOTALS CALCULATED (for logs): ALP=$${totals.total_alp}, Refs=${totals.total_refs}, Closes=${totals.total_closes}`);
    }

    // Always send a public message to the channel regardless of reply ability
    console.log(`[BOT] 🎯 Sending public channel message...`);
    try {
      const leadTypeDisplay = leadType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      // Use Eastern Time for display
      const displayTime = new Date().toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      // Create an embed for the close announcement
      const embed = new EmbedBuilder()
        .setTitle('🎉 New Close Recorded!')
        .setColor('#00ff00')
        .addFields(
          { name: '👤 Agent', value: user.lagnname, inline: true },
          { name: '💰 ALP', value: `$${alp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, inline: true },
          { name: '🔗 Refs', value: refs.toString(), inline: true },
          { name: '📋 Lead Type', value: leadTypeDisplay, inline: true },
          { name: '⏰ Time', value: displayTime, inline: true },
          { name: '📊 Today\'s Totals', value: `**ALP:** $${totals.total_alp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n**Refs:** ${totals.total_refs}\n**Closes:** ${totals.total_closes}`, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'Recorded via Discord Bot' });

      if (imageUrl) {
        embed.setImage(imageUrl);
      }

      // Get the current channel to send the public message
      const channel = interaction.channel;
      if (channel && channel.isTextBased()) {
        // Add user mention to the message content along with the embed
        const messageContent = `<@${discordUserId}> recorded a new close! 🎉`;
        await channel.send({ 
          content: messageContent,
          embeds: [embed] 
        });
        console.log(`[BOT] 🎯 ✅ Public channel message sent successfully with user mention`);
      } else {
        console.log(`[BOT] 🎯 ⚠️ Could not send public message - channel not available or not text-based`);
      }
    } catch (channelError) {
      console.error('[BOT] 🎯 ❌ Error sending public channel message:', channelError.message);
    }

  } catch (error) {
    console.error('[BOT] 🎯 ❌ Error recording close:', error);
    console.error('[BOT] 🎯 ❌ Error stack:', error.stack);
    
    if (canReply) {
      try {
        await interaction.editReply({
          content: '❌ **Error Recording Close**\n\nThere was an error saving your close. Please try again or contact support if the problem persists.'
        });
      } catch (editError) {
        console.error('[BOT] 🎯 ❌ Error editing reply with error message:', editError);
      }
    }
  }
  
  console.log(`[BOT] 🎯 === COMPLETED handleCloseCommand ===`);
}

// Handle the /more command (DM-only)
async function handleMoreCommand(interaction) {
  console.log(`[BOT] 📈 === STARTING handleMoreCommand ===`);

  const values = interaction.options.getString('values');
  const discordUserId = interaction.user.id;

  // Enforce DM usage
  if (interaction.guildId) {
    try {
      await interaction.reply({ content: 'ℹ️ Please DM me and use `/more values: 5,3` to report your MORE hires.', ephemeral: true });
    } catch (err) {
      console.warn('[BOT] 📈 Could not send guild ephemeral reply:', err.message);
    }
    return;
  }

  // Defer a normal DM reply (ephemeral not supported in DMs)
  let canReply = true;
  try {
    await interaction.deferReply();
  } catch (err) {
    console.warn('[BOT] 📈 Could not defer DM reply:', err.message);
    canReply = false;
  }

  try {
    if (!values) {
      if (canReply) {
        await interaction.editReply('❌ Please provide values as `total,pr` (e.g., `5,3`).');
      }
      return;
    }

    // Parse "total,pr" accepting comma or space separator
    const parts = values.replace(/\s+/g, '').split(/[ ,]+/);
    const totalHires = parseInt(parts[0], 10);
    const prHires = parseInt(parts[1] || '0', 10);

    if (Number.isNaN(totalHires) || Number.isNaN(prHires) || totalHires < 0 || prHires < 0) {
      if (canReply) {
        await interaction.editReply('❌ Invalid values. Use `total,pr` with non-negative integers (e.g., `5,3`).');
      }
      return;
    }
    if (prHires > totalHires) {
      if (canReply) {
        await interaction.editReply('❌ PR Hires cannot be greater than Total Hires.');
      }
      return;
    }

    // Lookup linked user by Discord ID
    const userQuery = `
      SELECT id, lagnname, clname, mga
      FROM activeusers
      WHERE discord_id = ? AND Active = 'y'
      LIMIT 1
    `;
    const userRows = await db.query(userQuery, [discordUserId]);
    if (!userRows || userRows.length === 0) {
      if (canReply) {
        await interaction.editReply('❌ Your Discord is not linked. Log in to agents.ariaslife.com and link your Discord in Settings.');
      }
      return;
    }

    const user = userRows[0];
    const MGA = user.lagnname; // Per requirement: use lagnname as MGA
    const userRole = user.clname || 'MGA';

    // Compute Eastern current time and this week's Friday date (Saturday–Friday week)
    const now = new Date();
    const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const currentDay = estNow.getDay(); // 0=Sun ... 6=Sat
    const startOfWeek = new Date(estNow);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(estNow.getDate() - currentDay - 1); // Move to Saturday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Friday

    // Format YYYY-MM-DD for MORE_Date
    const yyyy = endOfWeek.getFullYear();
    const mm = String(endOfWeek.getMonth() + 1).padStart(2, '0');
    const dd = String(endOfWeek.getDate()).padStart(2, '0');
    const MORE_Date = `${yyyy}-${mm}-${dd}`;

    // On-time if before or at Friday 3:15 PM EST
    const deadline = new Date(endOfWeek);
    deadline.setHours(15, 15, 0, 0);
    const on_time = estNow.getTime() <= deadline.getTime();

    // Fetch MGA hierarchy (fallback to MGA if not found)
    // If user is MGA or RGA, use their lagnname as the lookup key; otherwise, use their MGA field
    const lookupKey = (userRole === 'MGA' || userRole === 'RGA') ? (user.lagnname || MGA) : (user.mga || MGA);
    const hierarchyRows = await db.query(`
      SELECT rga, legacy, tree
      FROM MGAs
      WHERE lagnname = ?
        AND (active = 'y' OR active IS NULL)
        AND (hide = 'n' OR hide IS NULL)
      LIMIT 1
    `, [lookupKey]);
    const rga = (hierarchyRows[0] && hierarchyRows[0].rga) ? hierarchyRows[0].rga : MGA;
    const legacy = (hierarchyRows[0] && hierarchyRows[0].legacy) ? hierarchyRows[0].legacy : MGA;
    const tree = (hierarchyRows[0] && hierarchyRows[0].tree) ? hierarchyRows[0].tree : MGA;

    const nonPr = totalHires - prHires;

    // Upsert into amore_data
    const existsRows = await db.query(
      'SELECT 1 FROM amore_data WHERE MGA = ? AND MORE_Date = ? LIMIT 1',
      [MGA, MORE_Date]
    );

    if (!existsRows || existsRows.length === 0) {
      const defaults = {
        MGA,
        MORE_Date,
        userRole,
        on_time,
        External_Sets: 0,
        External_Shows: 0,
        Internal_Sets: 0,
        Internal_Shows: 0,
        Personal_Sets: 0,
        Personal_Shows: 0,
        Total_Set: 0,
        Total_Show: 0,
        Group_Invite: 0,
        Finals_Set: 0,
        Finals_Show: 0,
        Non_PR_Hires: nonPr,
        PR_Hires: prHires,
        Total_Hires: totalHires,
        RGA: rga,
        Legacy: legacy,
        Tree: tree,
        Office: null,
        first_reported: new Date()
      };

      const columns = Object.keys(defaults);
      const placeholders = columns.map(() => '?').join(', ');
      const insertSql = `INSERT INTO amore_data (${columns.join(', ')}) VALUES (${placeholders})`;
      await db.query(insertSql, Object.values(defaults));
    } else {
      const updateSql = `
        UPDATE amore_data
        SET Total_Hires = ?, PR_Hires = ?, Non_PR_Hires = ?,
            RGA = ?, Legacy = ?, Tree = ?, on_time = ?,
            last_updated = CURRENT_TIMESTAMP
        WHERE MGA = ? AND MORE_Date = ?
      `;
      await db.query(updateSql, [
        totalHires, prHires, nonPr,
        rga, legacy, tree, on_time,
        MGA, MORE_Date
      ]);
    }

    // Prepare human display for Friday date in EST
    const displayFriday = endOfWeek.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
    const status = on_time ? 'on time' : 'late';

    if (canReply) {
      await interaction.editReply(`✅ MORE recorded for **${MGA}** (week ending ${displayFriday}).\nTotal Hires: **${totalHires}**, PR Hires: **${prHires}** (${status}).`);
    }

    console.log(`[BOT] 📈 ✅ MORE recorded: MGA=${MGA}, Date=${MORE_Date}, Total=${totalHires}, PR=${prHires}, on_time=${on_time}`);
  } catch (error) {
    console.error('[BOT] 📈 ❌ Error handling /more:', error);
    if (canReply) {
      try {
        await interaction.editReply('❌ There was an error recording your MORE. Please try again later.');
      } catch (e) {
        console.warn('[BOT] 📈 Could not send error reply:', e.message);
      }
    }
  }

  console.log(`[BOT] 📈 === COMPLETED handleMoreCommand ===`);
}

// Placeholder handler for existing commands (to be implemented if needed)
async function handleLeaderboardCommand(interaction) {
  await interaction.reply({ 
    content: 'Leaderboard command is not yet implemented.', 
    ephemeral: true 
  });
}

// Handle the /ask command
async function handleAskCommand(interaction) {
  console.log(`[BOT] 🤔 === STARTING handleAskCommand ===`);
  
  const question = interaction.options.getString('question');
  const discordUserId = interaction.user.id;
  
  console.log(`[BOT] 🤔 Question: "${question}" from user ${discordUserId}`);
  
  // Try to defer reply
  let canReply = true;
  try {
    await interaction.deferReply({ ephemeral: true });
    console.log(`[BOT] 🤔 ✅ Reply deferred successfully`);
  } catch (error) {
    console.error('[BOT] 🤔 ❌ Error deferring reply:', error.message);
    canReply = false;
  }
  
  try {
    // Process the question
    const questionData = qaHelpers.processQuestion(question);
    console.log(`[BOT] 🤔 Question type: ${questionData.type}`);
    
    // Generate response
    const response = await qaHelpers.generateQuery(questionData, discordUserId);
    
    if (response.error) {
      // Handle error responses
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Question Not Understood')
        .setDescription(response.error)
        .setColor(0xff0000)
        .setTimestamp();
      
      if (canReply) {
        await interaction.editReply({ embeds: [errorEmbed] });
      }
      return;
    }
    
    // Create success embed
    const embed = new EmbedBuilder()
      .setTitle(response.title)
      .setDescription(response.description)
      .setColor(response.color)
      .setTimestamp()
      .setFooter({ text: 'Atlas Q&A Bot' });
    
    if (canReply) {
      await interaction.editReply({ embeds: [embed] });
    }
    
    console.log(`[BOT] 🤔 ✅ Question answered successfully`);
    
  } catch (error) {
    console.error('[BOT] 🤔 ❌ Error processing question:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Error Processing Question')
      .setDescription('Sorry, I encountered an error while processing your question. Please try again later.')
      .setColor(0xff0000)
      .setTimestamp();
    
    if (canReply) {
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
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
  
  client.login(process.env.DISCORD_TOKEN)
    .catch(err => console.error('Discord login error:', err));
}

module.exports = { 
  initDiscordBot,
  syncBotPresenceWithDatabase,
  reloadScheduledJobs,
  getClient,
  executeMotivationCallTest: executeMotivationCall
};