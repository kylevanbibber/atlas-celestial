/**
 * Run Roleplay Migration
 * Creates/updates tables for the AI Roleplay Call Simulator feature
 * 
 * Usage: node scripts/run-roleplay-migration.js
 */
require('dotenv').config();
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { query, pool } = require('../db');

async function runRoleplayMigration() {
  console.log('🎭 Starting Roleplay Tables Migration...\n');

  try {
    // 1. Check if roleplay_scripts table exists
    console.log('📋 Checking roleplay_scripts table...');
    const scriptsTableExists = await tableExists('roleplay_scripts');
    
    if (!scriptsTableExists) {
      console.log('   Creating roleplay_scripts table...');
      await query(`
        CREATE TABLE roleplay_scripts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT DEFAULT NULL,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL DEFAULT 'phone' COMMENT 'phone or zoom',
          script_text TEXT,
          goal_text TEXT,
          objections JSON DEFAULT NULL,
          created_by INT,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id),
          INDEX idx_created_by (created_by)
        )
      `);
      console.log('   ✅ roleplay_scripts table created');
    } else {
      console.log('   ✅ roleplay_scripts table exists');
      
      // Check and add missing columns
      await ensureColumn('roleplay_scripts', 'user_id', 'INT DEFAULT NULL AFTER id');
      await ensureColumn('roleplay_scripts', 'goal_text', 'TEXT AFTER script_text');
    }

    // 2. Check if roleplay_sessions table exists
    console.log('\n📋 Checking roleplay_sessions table...');
    const sessionsTableExists = await tableExists('roleplay_sessions');
    
    if (!sessionsTableExists) {
      console.log('   Creating roleplay_sessions table...');
      await query(`
        CREATE TABLE roleplay_sessions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT,
          script_id INT,
          type VARCHAR(50) NOT NULL DEFAULT 'phone' COMMENT 'phone or zoom',
          duration INT DEFAULT 0 COMMENT 'seconds',
          transcript JSON DEFAULT NULL,
          objections_faced JSON DEFAULT NULL,
          ai_feedback TEXT,
          score INT,
          outcome_json JSON DEFAULT NULL,
          score_json JSON DEFAULT NULL,
          status VARCHAR(50) DEFAULT 'active' COMMENT 'active, completed, ended, abandoned',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id),
          INDEX idx_script_id (script_id),
          INDEX idx_status (status)
        )
      `);
      console.log('   ✅ roleplay_sessions table created');
    } else {
      console.log('   ✅ roleplay_sessions table exists');
      
      // Check and add missing columns
      await ensureColumn('roleplay_sessions', 'outcome_json', 'JSON DEFAULT NULL');
      await ensureColumn('roleplay_sessions', 'score_json', 'JSON DEFAULT NULL');
    }

    // 3. Check if roleplay_messages table exists
    console.log('\n📋 Checking roleplay_messages table...');
    const messagesTableExists = await tableExists('roleplay_messages');
    
    if (!messagesTableExists) {
      console.log('   Creating roleplay_messages table...');
      await query(`
        CREATE TABLE roleplay_messages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          session_id INT NOT NULL,
          role ENUM('user', 'ai', 'system') NOT NULL DEFAULT 'user',
          content TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_session_id (session_id),
          INDEX idx_created_at (created_at)
        )
      `);
      console.log('   ✅ roleplay_messages table created');
    } else {
      console.log('   ✅ roleplay_messages table exists');
    }

    // 4. Check for default scripts
    console.log('\n📋 Checking for default scripts...');
    const existingScripts = await query('SELECT COUNT(*) as count FROM roleplay_scripts WHERE user_id IS NULL');
    
    if (existingScripts[0].count === 0) {
      console.log('   Inserting default Response Card script...');
      await query(`
        INSERT INTO roleplay_scripts (name, type, script_text, goal_text, objections, is_active)
        VALUES (
          'Response Card',
          'phone',
          'INTRO:\\n"Hi, may I speak to (Member)!? Hey (Member), this is [Your Name] with American Income Life. We handle some of your benefits through (Group)."\\n\\nREASON FOR MEETING:\\n"They sent you a letter about this and you sent back a reply card. I just need to verify the information that you wrote down."\\n\\nSETTING THE APPOINTMENT:\\n"We do everything over a quick video meeting. Did I catch you at work or did I catch you at home?"\\n\\n"So, what time do you and your Spouse/Partner normally get home from work? Perfect!"\\n\\n"I have a very booked up schedule right now, but I can squeeze you in today at either TIME or TIME. Which one works best for you and your Spouse/Partner?"\\n\\nSOLIDIFY:\\n"Okay great! Do me a favor, go ahead and grab a pen and paper..."',
          'Book an appointment to explain benefits to the member and their spouse',
          '[
            {"objection": "I''m not interested", "response": "No problem. But let''s take a step back. Have you been to the meetings where they talked about this program? That''s exactly why I''m calling. It''s just my job to explain your benefits and get you caught up."},
            {"objection": "Can you mail it to me?", "response": "Great question! That was the first step. You got a letter in the mail and now I have your reply card. The final step is very easy. I just need to set you up with everything over a quick video meeting."},
            {"objection": "How long will this take?", "response": "It depends on how many questions you have. I''m very busy, so I''ll need to keep it short."},
            {"objection": "How much will this cost?", "response": "Great question! The AD&D benefit you receive as a union member is at no cost. It''s just my job to explain your benefits and get you caught up."},
            {"objection": "I can''t talk right now", "response": "No problem, I''ll get straight to the point!"},
            {"objection": "Why does my spouse need to be there?", "response": "Great question! When something happens to you, your spouse will need to understand how the benefits work and how to make a claim."}
          ]',
          TRUE
        )
      `);
      console.log('   ✅ Default script inserted');
    } else {
      console.log(`   ✅ Found ${existingScripts[0].count} existing scripts`);
    }

    console.log('\n✨ Roleplay migration completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Helper: Check if table exists
async function tableExists(tableName) {
  try {
    const result = await query(`SHOW TABLES LIKE '${tableName}'`);
    return result.length > 0;
  } catch (error) {
    return false;
  }
}

// Helper: Ensure a column exists in a table
async function ensureColumn(tableName, columnName, columnDef) {
  try {
    const columns = await query(`SHOW COLUMNS FROM ${tableName} LIKE '${columnName}'`);
    if (columns.length === 0) {
      console.log(`   Adding column ${columnName} to ${tableName}...`);
      await query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
      console.log(`   ✅ Column ${columnName} added`);
    }
  } catch (error) {
    // Column might already exist or there might be a syntax issue - log but don't fail
    if (!error.message.includes('Duplicate column')) {
      console.warn(`   ⚠️ Could not add column ${columnName}: ${error.message}`);
    }
  }
}

// Run if this file is executed directly
if (require.main === module) {
  runRoleplayMigration()
    .then(() => {
      console.log('\nMigration script finished. Exiting...');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { runRoleplayMigration };

