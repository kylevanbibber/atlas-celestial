// Migration to create Discord-related tables
const db = require('../db');

async function createDiscordTables() {
  try {
    // Create guild_configs table
    await db.query(`
      CREATE TABLE IF NOT EXISTS guild_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        manager_id INT NOT NULL,
        guild_id VARCHAR(255) NOT NULL,
        guild_name VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255) NOT NULL,
        channel_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (manager_id) REFERENCES activeusers(id) ON DELETE CASCADE,
        UNIQUE KEY unique_guild_channel (guild_id, channel_id)
      )
    `);

    // Create discord_reminders table
    await db.query(`
      CREATE TABLE IF NOT EXISTS discord_reminders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        manager_id INT NOT NULL,
        guild_id VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255) NOT NULL,
        cron_expr VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (manager_id) REFERENCES activeusers(id) ON DELETE CASCADE
      )
    `);

    // Create discord_sales table
    await db.query(`
      CREATE TABLE IF NOT EXISTS discord_sales (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        discord_user_id VARCHAR(255) NOT NULL,
        guild_id VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES activeusers(id) ON DELETE CASCADE
      )
    `);

    // Create discord_leaderboards table
    await db.query(`
      CREATE TABLE IF NOT EXISTS discord_leaderboards (
        id INT AUTO_INCREMENT PRIMARY KEY,
        manager_id INT NOT NULL,
        guild_id VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255) NOT NULL,
        cron_expr VARCHAR(100) NOT NULL,
        metric_type ENUM('daily_sales', 'weekly_sales', 'monthly_sales') DEFAULT 'daily_sales',
        top_count INT DEFAULT 10,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (manager_id) REFERENCES activeusers(id) ON DELETE CASCADE
      )
    `);

    console.log('Discord tables created successfully');
  } catch (error) {
    console.error('Error creating Discord tables:', error);
    throw error;
  }
}

module.exports = { createDiscordTables }; 