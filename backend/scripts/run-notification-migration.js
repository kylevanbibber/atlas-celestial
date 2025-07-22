/**
 * Run the notification migration script
 */
const { migrate } = require('../migrations/20240531_create_notifications_table');

// Run the migration
console.log('Running notification system migration...');
migrate()
  .then(() => {
    console.log('Migration completed successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  }); 