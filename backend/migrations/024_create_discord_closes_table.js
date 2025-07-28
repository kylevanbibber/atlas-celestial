// Migration to create discord_sales table for /close command
const db = require('../db');

async function createDiscordSalesTable() {
  try {
    console.log('Creating discord_sales table...');

    // Create the discord_sales table
    await db.query(`
      CREATE TABLE IF NOT EXISTS discord_sales (
        id INT(11) NOT NULL AUTO_INCREMENT,
        discord_user VARCHAR(32) NOT NULL,
        guild_id VARCHAR(32) NOT NULL,
        alp DECIMAL(10,2) NOT NULL,
        refs INT(3) NOT NULL,
        lead_type VARCHAR(20) NULL,
        ts DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        user_id INT(11) NOT NULL,
        PRIMARY KEY (id),
        INDEX idx_discord_user (discord_user),
        INDEX idx_guild_id (guild_id),
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci
    `);

    console.log('discord_sales table created successfully');

  } catch (error) {
    console.error('Error creating discord_sales table:', error);
    throw error;
  }
}

module.exports = { createDiscordSalesTable }; 