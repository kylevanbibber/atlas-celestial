const db = require('../db');

exports.up = async function() {
  console.log('Adding performance indexes to Daily_Activity table...');
  
  const indexes = [
    // Index for userId and reportDate - used in personal rate calculations
    {
      name: 'idx_userId_reportDate',
      sql: 'CREATE INDEX idx_userId_reportDate ON Daily_Activity (userId, reportDate)',
      description: 'Optimize personal rate calculations by user and date'
    },
    // Index for reportDate and calls - used in agency rate calculations
    {
      name: 'idx_reportDate_calls',
      sql: 'CREATE INDEX idx_reportDate_calls ON Daily_Activity (reportDate, calls)',
      description: 'Optimize agency rate calculations with date and call filters'
    },
    // Composite index for the most common query pattern
    {
      name: 'idx_userId_reportDate_activity',
      sql: 'CREATE INDEX idx_userId_reportDate_activity ON Daily_Activity (userId, reportDate, calls, appts, sits, sales, alp)',
      description: 'Composite index for comprehensive activity queries'
    }
  ];

  for (const index of indexes) {
    try {
      console.log(`📋 Creating index: ${index.name} - ${index.description}`);
      await db.query(index.sql);
      console.log(`✅ Created index: ${index.name}`);
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log(`⏭️  Index already exists, skipping: ${index.name}`);
      } else {
        console.error(`❌ Error creating index ${index.name}:`, error.message);
        // Continue with other indexes even if one fails
      }
    }
  }
  
  console.log('✅ Daily_Activity performance indexes optimization completed');
};

exports.down = async function() {
  console.log('Removing performance indexes from Daily_Activity table...');
  
  const indexes = [
    'idx_userId_reportDate',
    'idx_reportDate_calls',
    'idx_userId_reportDate_activity'
  ];

  for (const indexName of indexes) {
    try {
      console.log(`📋 Dropping index: ${indexName}`);
      await db.query(`DROP INDEX ${indexName} ON Daily_Activity`);
      console.log(`✅ Dropped index: ${indexName}`);
    } catch (error) {
      if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log(`⏭️  Index doesn't exist, skipping: ${indexName}`);
      } else {
        console.error(`❌ Error dropping index ${indexName}:`, error.message);
      }
    }
  }
  
  console.log('✅ Daily_Activity performance indexes removed');
};
