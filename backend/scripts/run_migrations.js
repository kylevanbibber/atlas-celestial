const fs = require('fs');
const path = require('path');
const { query } = require('../db');

async function runMigrations() {
    console.log('Running database migrations...');
    
    try {
        // Read and execute leads_released table migration
        const leadsReleasedSQL = fs.readFileSync(
            path.join(__dirname, '../migrations/create_leads_released_table.sql'),
            'utf8'
        );
        
        await query(leadsReleasedSQL);
        console.log('✅ leads_released table created successfully');
        
        // Read and execute licensed_states table migration
        const licensedStatesSQL = fs.readFileSync(
            path.join(__dirname, '../migrations/create_licensed_states_table.sql'),
            'utf8'
        );
        
        await query(licensedStatesSQL);
        console.log('✅ licensed_states table created successfully');
        
        console.log('✅ All migrations completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run migrations if this file is executed directly
if (require.main === module) {
    runMigrations()
        .then(() => {
            console.log('Migration script completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = { runMigrations }; 