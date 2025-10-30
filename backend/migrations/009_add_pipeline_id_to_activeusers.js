const db = require('../db');

async function addPipelineIdColumn() {
  try {
    // Add pipeline_id column to activeusers
    await db.query(
      `ALTER TABLE activeusers 
       ADD COLUMN IF NOT EXISTS pipeline_id INT NULL,
       ADD INDEX IF NOT EXISTS idx_pipeline_id (pipeline_id)`
    );
    console.log('✅ Added pipeline_id column to activeusers with index');
  } catch (error) {
    console.error('❌ Error adding pipeline_id column:', error);
    throw error;
  }
}

module.exports = { addPipelineIdColumn };

