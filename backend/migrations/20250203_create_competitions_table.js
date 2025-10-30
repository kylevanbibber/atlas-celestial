/**
 * Migration: Create Competitions Table
 * 
 * This migration creates only the competitions table.
 * We'll use the existing activeusers table for participation and progress tracking.
 */

const db = require('../db');

async function up() {
  try {
    // First check if the table already exists
    const [tableExists] = await db.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name = 'competitions'
    `);
    
    if (tableExists[0].count > 0) {
      console.log('competitions table already exists, skipping creation.');
      return;
    }
    
    console.log('Creating competitions table...');
    
    // Create the competitions table only
    await db.query(`
      CREATE TABLE competitions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        prize TEXT NOT NULL,
        rules TEXT NOT NULL,
        start_date DATETIME NOT NULL,
        end_date DATETIME NOT NULL,
        status ENUM('draft', 'active', 'completed', 'cancelled') DEFAULT 'draft',
        competition_type ENUM('individual', 'team', 'group') DEFAULT 'individual',
        metric_type ENUM('alp', 'calls', 'appointments', 'sales', 'codes', 'hires', 'refs', 'custom') NOT NULL,
        target_value DECIMAL(15, 2),
        min_participants INT DEFAULT 1,
        max_participants INT,
        is_global BOOLEAN DEFAULT false,
        eligible_roles JSON,
        eligible_users JSON,
        progress_calculation_type ENUM('sum', 'average', 'max', 'min', 'count') DEFAULT 'sum',
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES activeusers(id) ON DELETE RESTRICT,
        INDEX idx_status (status),
        INDEX idx_dates (start_date, end_date),
        INDEX idx_type (competition_type),
        INDEX idx_metric (metric_type),
        INDEX idx_global (is_global)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    
    console.log('Competitions table created successfully.');
    return { success: true, message: 'Competitions table created successfully.' };
  } catch (error) {
    console.error('Error creating competitions table:', error);
    return { success: false, error };
  }
}

async function down() {
  try {
    console.log('Dropping competitions table...');
    
    await db.query(`DROP TABLE IF EXISTS competitions`);
    
    console.log('Competitions table dropped successfully.');
    return { success: true, message: 'Competitions table dropped successfully.' };
  } catch (error) {
    console.error('Error dropping competitions table:', error);
    return { success: false, error };
  }
}

module.exports = { up, down };
