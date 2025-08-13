const mysql = require('mysql');
require('dotenv').config();

// Create database connection
const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'atlas',
  multipleStatements: true
});

async function fixPushSubscriptionsSchema() {
  return new Promise((resolve, reject) => {
    console.log('🔧 Starting push_subscriptions schema fix for multi-device support...');
    
    connection.connect((err) => {
      if (err) {
        console.error('❌ Database connection failed:', err);
        return reject(err);
      }
      
      console.log('✅ Connected to database');
      
      // Check current schema
      connection.query('DESCRIBE push_subscriptions', (err, results) => {
        if (err) {
          console.error('❌ Error describing table:', err);
          return reject(err);
        }
        
        console.log('📋 Current push_subscriptions schema:');
        results.forEach(col => {
          console.log(`  ${col.Field}: ${col.Type} ${col.Null} ${col.Key} ${col.Default || ''}`);
        });
        
        // Check current indexes
        connection.query('SHOW INDEX FROM push_subscriptions', (err, indexes) => {
          if (err) {
            console.error('❌ Error showing indexes:', err);
            return reject(err);
          }
          
          console.log('🗂️ Current indexes:');
          indexes.forEach(idx => {
            console.log(`  ${idx.Key_name}: ${idx.Column_name} (Non_unique: ${idx.Non_unique})`);
          });
          
          const hasUserIdUnique = indexes.some(idx => idx.Key_name === 'user_id' && idx.Non_unique === 0);
          const hasEndpointHash = results.some(col => col.Field === 'endpoint_hash');
          
          console.log(`🔍 Analysis:`);
          console.log(`  - Has UNIQUE user_id constraint: ${hasUserIdUnique}`);
          console.log(`  - Has endpoint_hash column: ${hasEndpointHash}`);
          
          if (!hasUserIdUnique && hasEndpointHash) {
            console.log('✅ Schema already fixed for multi-device support!');
            connection.end();
            return resolve();
          }
          
          // Apply the migration
          let migrationSQL = '';
          
          if (hasUserIdUnique) {
            console.log('🔧 Removing UNIQUE constraint on user_id...');
            migrationSQL += 'ALTER TABLE push_subscriptions DROP INDEX user_id;\n';
          }
          
          if (!hasEndpointHash) {
            console.log('🔧 Adding endpoint_hash column and unique constraint...');
            migrationSQL += `
              ALTER TABLE push_subscriptions 
              ADD COLUMN endpoint_hash VARCHAR(64) GENERATED ALWAYS AS (SHA2(JSON_EXTRACT(subscription, '$.endpoint'), 256)) STORED;
              
              ALTER TABLE push_subscriptions 
              ADD UNIQUE KEY unique_endpoint (endpoint_hash);
              
              ALTER TABLE push_subscriptions 
              ADD INDEX idx_user_id (user_id);
            `;
          }
          
          if (migrationSQL) {
            console.log('🚀 Executing migration...');
            console.log('SQL:', migrationSQL);
            
            connection.query(migrationSQL, (err, result) => {
              if (err) {
                console.error('❌ Migration failed:', err);
                connection.end();
                return reject(err);
              }
              
              console.log('✅ Migration completed successfully!');
              console.log('📊 Result:', result);
              
              // Verify the changes
              connection.query('SHOW INDEX FROM push_subscriptions', (err, newIndexes) => {
                if (err) {
                  console.error('❌ Error verifying changes:', err);
                  connection.end();
                  return reject(err);
                }
                
                console.log('🎉 New indexes after migration:');
                newIndexes.forEach(idx => {
                  console.log(`  ${idx.Key_name}: ${idx.Column_name} (Non_unique: ${idx.Non_unique})`);
                });
                
                connection.end();
                resolve();
              });
            });
          } else {
            console.log('ℹ️ No migration needed');
            connection.end();
            resolve();
          }
        });
      });
    });
  });
}

// Run the migration
if (require.main === module) {
  fixPushSubscriptionsSchema()
    .then(() => {
      console.log('🎉 Push subscriptions schema fix completed!');
      console.log('💡 You can now subscribe to push notifications from multiple devices.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Schema fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixPushSubscriptionsSchema }; 