const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function updateRoleplayScripts() {
    console.log('🎭 Updating roleplay scripts...');
    
    try {
        // Read the SQL file
        const migrationSQL = fs.readFileSync(
            path.join(__dirname, '../migrations/update_roleplay_scripts.sql'),
            'utf8'
        );
        
        // Split by semicolon and run each statement
        const statements = migrationSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
        
        for (const statement of statements) {
            if (statement.length > 10) {
                try {
                    await pool.query(statement);
                    console.log('✅ Executed statement successfully');
                } catch (err) {
                    // Ignore duplicate key errors for inserts
                    if (err.code !== 'ER_DUP_ENTRY') {
                        console.warn('⚠️ Statement warning:', err.message);
                    }
                }
            }
        }
        
        console.log('✅ Roleplay scripts updated successfully!');
        
        // Show current scripts
        const scripts = await pool.query('SELECT id, name, type FROM roleplay_scripts WHERE is_active = true');
        console.log('\n📜 Available scripts:');
        scripts.forEach(s => {
            console.log(`   - ${s.name} (${s.type})`);
        });
        
    } catch (error) {
        console.error('❌ Update failed:', error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    updateRoleplayScripts()
        .then(() => {
            console.log('\n✨ Script update completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Script update failed:', error);
            process.exit(1);
        });
}

module.exports = { updateRoleplayScripts };

