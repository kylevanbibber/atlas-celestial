/**
 * Migration: Create Push Subscriptions Table
 * 
 * This migration creates the push_subscriptions table for storing push notification
 * subscription data for web push notifications.
 */

const db = require('../db');

async function up() {
  try {
    // First check if the table already exists
    const [tableExists] = await db.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name = 'push_subscriptions'
    `);
    
    if (tableExists[0].count > 0) {
      console.log('push_subscriptions table already exists, skipping creation.');
      return;
    }
    
    console.log('Creating push_subscriptions table...');
    
    // Create the push_subscriptions table
    await db.query(`
      CREATE TABLE push_subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        subscription TEXT NOT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        UNIQUE KEY user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    
    console.log('push_subscriptions table created successfully.');
    return { success: true, message: 'Push subscriptions table created successfully.' };
  } catch (error) {
    console.error('Error creating push_subscriptions table:', error);
    return { success: false, error };
  }
}

async function down() {
  try {
    console.log('Dropping push_subscriptions table...');
    
    await db.query(`DROP TABLE IF EXISTS push_subscriptions`);
    
    console.log('push_subscriptions table dropped successfully.');
    return { success: true, message: 'Push subscriptions table dropped successfully.' };
  } catch (error) {
    console.error('Error dropping push_subscriptions table:', error);
    return { success: false, error };
  }
}

module.exports = { up, down }; 