const mysql = require("mysql");
const dotenv = require("dotenv");

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || '208.109.78.44',
  user: process.env.DB_USER || 'kvanbibber',
  password: process.env.DB_PASS || 'Atlas2024!',
  database: process.env.DB_NAME || 'AriasLifeUsers',
  multipleStatements: true,
  connectionLimit: 10,
  queueLimit: 0,
  waitForConnections: true,
  connectTimeout: 10000,
  timezone: 'America/New_York',
};

const pool = mysql.createPool(dbConfig);

const query = (sql, params) => {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

async function runMigration() {
  try {
    console.log("Creating Release tables...");

    // Create checklist_progress table
    await query(`
      CREATE TABLE IF NOT EXISTS checklist_progress (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        video_done BOOLEAN DEFAULT FALSE,
        arias_training BOOLEAN DEFAULT FALSE,
        booking_done BOOLEAN DEFAULT FALSE,
        leadership_track BOOLEAN DEFAULT FALSE,
        practice_pres INT DEFAULT 0,
        refs_25 INT DEFAULT 0,
        sale_1k BOOLEAN DEFAULT FALSE,
        build_team VARCHAR(255) DEFAULT '',
        know_team VARCHAR(255) DEFAULT '',
        contract_2nd VARCHAR(50) DEFAULT NULL,
        bonus_90d VARCHAR(50) DEFAULT NULL,
        bonus_after_90d VARCHAR(50) DEFAULT NULL,
        ready_release VARCHAR(255) DEFAULT '',
        know_more TEXT DEFAULT NULL,
        entrance_start BOOLEAN DEFAULT FALSE,
        referral_open BOOLEAN DEFAULT FALSE,
        texting_referral BOOLEAN DEFAULT FALSE,
        closing_rebuttals BOOLEAN DEFAULT FALSE,
        personal_recruit BOOLEAN DEFAULT FALSE,
        reviewed_by VARCHAR(255) DEFAULT NULL,
        on_script BOOLEAN DEFAULT FALSE,
        warmup_conf BOOLEAN DEFAULT FALSE,
        create_need BOOLEAN DEFAULT FALSE,
        sale_cemented BOOLEAN DEFAULT FALSE,
        would_sell BOOLEAN DEFAULT FALSE,
        ride_days_trainee INT DEFAULT 0,
        ride_days_trainer INT DEFAULT 0,
        pres_done_trainee INT DEFAULT 0,
        pres_done_trainer INT DEFAULT 0,
        ref_pres_done_trainee INT DEFAULT 0,
        ref_pres_done_trainer INT DEFAULT 0,
        ref_sold_trainee INT DEFAULT 0,
        ref_sold_trainer INT DEFAULT 0,
        ref_collected_trainee INT DEFAULT 0,
        ref_collected_trainer INT DEFAULT 0,
        sales_done_trainee INT DEFAULT 0,
        sales_done_trainer INT DEFAULT 0,
        alp_written_trainee INT DEFAULT 0,
        alp_written_trainer INT DEFAULT 0,
        appts_set_trainee INT DEFAULT 0,
        appts_set_trainer INT DEFAULT 0,
        recruits_trainee INT DEFAULT 0,
        recruits_trainer INT DEFAULT 0,
        appts_weekly INT DEFAULT 0,
        pres_weekly INT DEFAULT 0,
        refs_per_home INT DEFAULT 0,
        alp_week INT DEFAULT 0,
        start_wkdy TIME DEFAULT NULL,
        start_wknd TIME DEFAULT NULL,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE KEY unique_user_progress (user_id),
        INDEX idx_user_id (user_id),
        INDEX idx_last_updated (last_updated)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create ja_release table
    await query(`
      CREATE TABLE IF NOT EXISTS ja_release (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        manager_id INT DEFAULT NULL,
        time_submitted TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        release_scheduled TIMESTAMP DEFAULT NULL,
        passed VARCHAR(10) DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        UNIQUE KEY unique_user_release (user_id),
        INDEX idx_user_id (user_id),
        INDEX idx_manager_id (manager_id),
        INDEX idx_release_scheduled (release_scheduled),
        INDEX idx_passed (passed),
        INDEX idx_time_submitted (time_submitted)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create leads_released table
    await query(`
      CREATE TABLE IF NOT EXISTS leads_released (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        type VARCHAR(50) DEFAULT NULL,
        sent TINYINT DEFAULT 0,
        sent_date VARCHAR(50) DEFAULT NULL,
        sent_by INT DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        last_updated VARCHAR(50) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_user_id (user_id),
        INDEX idx_sent_by (sent_by),
        INDEX idx_type (type),
        INDEX idx_sent (sent)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Add released column to users table if it doesn't exist
    await query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS released TINYINT DEFAULT 0,
      ADD INDEX IF NOT EXISTS idx_released (released);
    `);

    console.log("Release tables created successfully!");
    
  } catch (error) {
    console.error("Error creating Release tables:", error);
    throw error;
  } finally {
    pool.end();
  }
}

if (require.main === module) {
  runMigration()
    .then(() => {
      console.log("Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

module.exports = runMigration; 