/**
 * Fix NULL recruiting_agent and coded_to in Pipeline Table
 * 
 * This script updates pipeline rows where recruiting_agent and coded_to are NULL
 * by finding the appropriate recruiter from the agent's hierarchy:
 * 1. First try: SA (Senior Associate)
 * 2. If SA is NULL, try: GA (General Agent)
 * 3. If GA is NULL, try: MGA (Managing General Agent)
 * 
 * Usage:
 *   node backend/scripts/fix-null-recruiting-agents.js
 */

const db = require('../config/db');

async function fixNullRecruitingAgents() {
  console.log('🔧 Starting fix for NULL recruiting_agent and coded_to fields...\n');
  
  try {
    // STEP 1: Show current status
    console.log('📊 STEP 1: Analyzing current status...');
    const beforeStats = await db.query(`
      SELECT 
        COUNT(*) as total_pipeline_rows,
        SUM(CASE WHEN recruiting_agent IS NULL THEN 1 ELSE 0 END) as null_recruiting_agent,
        SUM(CASE WHEN coded_to IS NULL THEN 1 ELSE 0 END) as null_coded_to,
        SUM(CASE WHEN recruiting_agent IS NULL AND coded_to IS NULL THEN 1 ELSE 0 END) as both_null
      FROM pipeline
    `);
    
    const stats = beforeStats[0];
    console.log(`   Total pipeline rows: ${stats.total_pipeline_rows}`);
    console.log(`   NULL recruiting_agent: ${stats.null_recruiting_agent}`);
    console.log(`   NULL coded_to: ${stats.null_coded_to}`);
    console.log(`   Both NULL: ${stats.both_null}\n`);
    
    if (stats.both_null === 0 && stats.null_recruiting_agent === 0 && stats.null_coded_to === 0) {
      console.log('✅ No NULL values found. Nothing to fix!');
      process.exit(0);
    }
    
    // STEP 2: Show sample of rows to be updated
    console.log('📋 STEP 2: Sample of rows that will be updated...');
    const sampleRows = await db.query(`
      SELECT 
        p.id as pipeline_id,
        p.recruit_first,
        p.recruit_last,
        p.recruiting_agent as current_recruiting_agent,
        p.coded_to as current_coded_to,
        au.lagnname as agent_name,
        au.sa,
        au.ga,
        au.mga,
        COALESCE(au.sa, au.ga, au.mga) as recruiter_to_use,
        CASE 
          WHEN au.sa IS NOT NULL THEN 'SA'
          WHEN au.ga IS NOT NULL THEN 'GA'
          WHEN au.mga IS NOT NULL THEN 'MGA'
          ELSE 'NONE'
        END as recruiter_level
      FROM pipeline p
      JOIN activeusers au ON au.pipeline_id = p.id
      WHERE p.recruiting_agent IS NULL 
         OR p.coded_to IS NULL
      LIMIT 10
    `);
    
    if (sampleRows.length > 0) {
      console.log(`   Found ${sampleRows.length} sample rows (showing first 10):`);
      sampleRows.forEach((row, index) => {
        console.log(`   ${index + 1}. Pipeline ${row.pipeline_id}: ${row.recruit_first} ${row.recruit_last}`);
        console.log(`      Agent: ${row.agent_name}`);
        console.log(`      Will use: ${row.recruiter_to_use} (${row.recruiter_level})`);
      });
      console.log('');
    }
    
    // STEP 3: Verify recruiters exist
    console.log('🔍 STEP 3: Verifying recruiters exist in activeusers...');
    const verification = await db.query(`
      SELECT 
        COUNT(DISTINCT COALESCE(au.sa, au.ga, au.mga)) as unique_recruiters,
        COUNT(DISTINCT recruiter.id) as recruiters_found
      FROM pipeline p
      JOIN activeusers au ON au.pipeline_id = p.id
      LEFT JOIN activeusers recruiter ON recruiter.lagnname = COALESCE(au.sa, au.ga, au.mga)
      WHERE p.recruiting_agent IS NULL 
         OR p.coded_to IS NULL
    `);
    
    console.log(`   Unique recruiters needed: ${verification[0].unique_recruiters}`);
    console.log(`   Recruiters found in activeusers: ${verification[0].recruiters_found}\n`);
    
    // Check for missing recruiters
    const missingRecruiters = await db.query(`
      SELECT 
        COALESCE(au.sa, au.ga, au.mga) as missing_recruiter_lagnname,
        COUNT(*) as pipeline_rows_affected
      FROM pipeline p
      JOIN activeusers au ON au.pipeline_id = p.id
      LEFT JOIN activeusers recruiter ON recruiter.lagnname = COALESCE(au.sa, au.ga, au.mga)
      WHERE (p.recruiting_agent IS NULL OR p.coded_to IS NULL)
        AND COALESCE(au.sa, au.ga, au.mga) IS NOT NULL
        AND recruiter.id IS NULL
      GROUP BY COALESCE(au.sa, au.ga, au.mga)
    `);
    
    if (missingRecruiters.length > 0) {
      console.log('   ⚠️  WARNING: Some recruiters not found in activeusers:');
      missingRecruiters.forEach(recruiter => {
        console.log(`      - ${recruiter.missing_recruiter_lagnname} (affects ${recruiter.pipeline_rows_affected} rows)`);
      });
      console.log('   These rows will not be updated.\n');
    }
    
    // STEP 4: Update recruiting_agent
    console.log('🔄 STEP 4: Updating recruiting_agent...');
    const updateRecruiting = await db.query(`
      UPDATE pipeline p
      JOIN activeusers au ON au.pipeline_id = p.id
      SET p.recruiting_agent = COALESCE(au.sa, au.ga, au.mga),
          p.date_last_updated = NOW()
      WHERE p.recruiting_agent IS NULL
        AND COALESCE(au.sa, au.ga, au.mga) IS NOT NULL
    `);
    
    const recruitingCount = updateRecruiting.affectedRows || 0;
    console.log(`   ✓ Updated recruiting_agent for ${recruitingCount} rows\n`);
    
    // STEP 5: Update coded_to
    console.log('🔄 STEP 5: Updating coded_to...');
    const updateCodedTo = await db.query(`
      UPDATE pipeline p
      JOIN activeusers au ON au.pipeline_id = p.id
      SET p.coded_to = COALESCE(au.sa, au.ga, au.mga),
          p.date_last_updated = NOW()
      WHERE p.coded_to IS NULL
        AND COALESCE(au.sa, au.ga, au.mga) IS NOT NULL
    `);
    
    const codedToCount = updateCodedTo.affectedRows || 0;
    console.log(`   ✓ Updated coded_to for ${codedToCount} rows\n`);
    
    // STEP 6: Update MGA column (bonus fix)
    console.log('🔄 STEP 6: Updating MGA column (bonus fix)...');
    const updateMGA = await db.query(`
      UPDATE pipeline p
      JOIN activeusers au ON au.pipeline_id = p.id
      SET p.MGA = au.mga,
          p.date_last_updated = NOW()
      WHERE p.MGA IS NULL
        AND au.mga IS NOT NULL
    `);
    
    const mgaCount = updateMGA.affectedRows || 0;
    console.log(`   ✓ Updated MGA column for ${mgaCount} rows\n`);
    
    // STEP 7: Verify results
    console.log('✅ STEP 7: Verifying results...');
    const afterStats = await db.query(`
      SELECT 
        COUNT(*) as total_pipeline_rows,
        SUM(CASE WHEN recruiting_agent IS NULL THEN 1 ELSE 0 END) as null_recruiting_agent,
        SUM(CASE WHEN coded_to IS NULL THEN 1 ELSE 0 END) as null_coded_to,
        SUM(CASE WHEN recruiting_agent IS NULL AND coded_to IS NULL THEN 1 ELSE 0 END) as both_null,
        SUM(CASE WHEN recruiting_agent IS NOT NULL AND coded_to IS NOT NULL THEN 1 ELSE 0 END) as both_populated
      FROM pipeline
    `);
    
    const finalStats = afterStats[0];
    console.log(`   Total pipeline rows: ${finalStats.total_pipeline_rows}`);
    console.log(`   NULL recruiting_agent: ${finalStats.null_recruiting_agent}`);
    console.log(`   NULL coded_to: ${finalStats.null_coded_to}`);
    console.log(`   Both populated: ${finalStats.both_populated}\n`);
    
    // STEP 8: Show recruiter level distribution
    console.log('📊 STEP 8: Recruiter level distribution...');
    const distribution = await db.query(`
      SELECT 
        CASE 
          WHEN au.sa = p.recruiting_agent THEN 'SA (Senior Associate)'
          WHEN au.ga = p.recruiting_agent THEN 'GA (General Agent)'
          WHEN au.mga = p.recruiting_agent THEN 'MGA (Managing General Agent)'
          ELSE 'Other/Unknown'
        END as recruiter_level,
        COUNT(*) as count
      FROM pipeline p
      JOIN activeusers au ON au.pipeline_id = p.id
      WHERE p.recruiting_agent IS NOT NULL
      GROUP BY recruiter_level
      ORDER BY count DESC
    `);
    
    const total = distribution.reduce((sum, row) => sum + row.count, 0);
    distribution.forEach(row => {
      const percentage = ((row.count / total) * 100).toFixed(1);
      console.log(`   ${row.recruiter_level}: ${row.count} (${percentage}%)`);
    });
    console.log('');
    
    // STEP 9: Check for remaining issues
    if (finalStats.null_recruiting_agent > 0 || finalStats.null_coded_to > 0) {
      console.log('⚠️  STEP 9: Remaining issues...');
      const remainingIssues = await db.query(`
        SELECT 
          p.id as pipeline_id,
          p.recruit_first,
          p.recruit_last,
          au.lagnname as agent_name,
          au.sa,
          au.ga,
          au.mga,
          CASE 
            WHEN au.sa IS NULL AND au.ga IS NULL AND au.mga IS NULL THEN 'No hierarchy data'
            ELSE 'Unknown issue'
          END as reason
        FROM pipeline p
        JOIN activeusers au ON au.pipeline_id = p.id
        WHERE p.recruiting_agent IS NULL OR p.coded_to IS NULL
        LIMIT 10
      `);
      
      if (remainingIssues.length > 0) {
        console.log(`   Found ${remainingIssues.length} rows still with issues:`);
        remainingIssues.forEach((row, index) => {
          console.log(`   ${index + 1}. Pipeline ${row.pipeline_id}: ${row.recruit_first} ${row.recruit_last}`);
          console.log(`      Reason: ${row.reason}`);
        });
        console.log('');
      }
    }
    
    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Fix completed successfully!');
    console.log(`   recruiting_agent updated: ${recruitingCount} rows`);
    console.log(`   coded_to updated: ${codedToCount} rows`);
    console.log(`   MGA updated: ${mgaCount} rows`);
    console.log(`   Total changes: ${recruitingCount + codedToCount + mgaCount} updates`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error during fix:', error);
    process.exit(1);
  }
}

// Run the fix
fixNullRecruitingAgents();

