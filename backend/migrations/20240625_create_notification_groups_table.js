/**
 * Migration to create the notification_groups table
 */
const db = require('../db');

async function up() {
  try {
    console.log('Creating notification_groups table...');
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS notification_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        query_data JSON NOT NULL,
        tables JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    
    // Add foreign key relationship to notifications table for target_group
    await db.query(`
      ALTER TABLE notifications 
      MODIFY COLUMN target_group INT NULL,
      ADD CONSTRAINT fk_notifications_group
      FOREIGN KEY (target_group) REFERENCES notification_groups(id)
      ON DELETE SET NULL;
    `);
    
    console.log('notification_groups table created successfully');
    
    return true;
  } catch (error) {
    console.error('Error creating notification_groups table:', error);
    return false;
  }
}

async function down() {
  try {
    console.log('Dropping notification_groups table...');
    
    // First remove the foreign key constraint
    await db.query(`
      ALTER TABLE notifications 
      DROP FOREIGN KEY fk_notifications_group;
    `);
    
    // Modify the target_group column back to its original state
    await db.query(`
      ALTER TABLE notifications 
      MODIFY COLUMN target_group VARCHAR(255) NULL;
    `);
    
    // Then drop the table
    await db.query(`
      DROP TABLE IF EXISTS notification_groups;
    `);
    
    console.log('notification_groups table dropped successfully');
    
    return true;
  } catch (error) {
    console.error('Error dropping notification_groups table:', error);
    return false;
  }
}

module.exports = { up, down }; 