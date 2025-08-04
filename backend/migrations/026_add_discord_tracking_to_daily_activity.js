const db = require('../db');

exports.up = async function() {
  console.log('Adding Discord tracking columns to Daily_Activity table...');
  
  const migrations = [
    'ALTER TABLE Daily_Activity ADD COLUMN discord_sales INT(11) DEFAULT 0 AFTER sales',
    'ALTER TABLE Daily_Activity ADD COLUMN discord_alp DECIMAL(10,2) DEFAULT 0.00 AFTER alp', 
    'ALTER TABLE Daily_Activity ADD COLUMN discord_refs INT(11) DEFAULT 0 AFTER refs'
  ];

  for (const migration of migrations) {
    try {
      await db.query(migration);
      console.log(`✅ Executed: ${migration}`);
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log(`⏭️  Column already exists, skipping: ${migration}`);
      } else {
        throw error;
      }
    }
  }
  
  console.log('✅ Discord tracking columns added to Daily_Activity table');
};

exports.down = async function() {
  console.log('Removing Discord tracking columns from Daily_Activity table...');
  
  const rollbacks = [
    'ALTER TABLE Daily_Activity DROP COLUMN discord_sales',
    'ALTER TABLE Daily_Activity DROP COLUMN discord_alp',
    'ALTER TABLE Daily_Activity DROP COLUMN discord_refs'
  ];

  for (const rollback of rollbacks) {
    try {
      await db.query(rollback);
      console.log(`✅ Executed: ${rollback}`);
    } catch (error) {
      if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log(`⏭️  Column doesn't exist, skipping: ${rollback}`);
      } else {
        throw error;
      }
    }
  }
  
  console.log('✅ Discord tracking columns removed from Daily_Activity table');
}; 