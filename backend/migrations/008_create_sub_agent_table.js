const { pool } = require('../db');

async function createSubAgentTable() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS sub_agent (
        id INT AUTO_INCREMENT PRIMARY KEY,
        date DATE NOT NULL,
        MGA VARCHAR(255) NOT NULL,
        count INT DEFAULT 0,
        post_six INT DEFAULT 0,
        first_six INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_date (date),
        INDEX idx_mga (MGA),
        INDEX idx_date_mga (date, MGA)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await pool.query(createTableQuery);
    console.log('✅ sub_agent table created successfully');

    // Insert sample data for testing
    const sampleData = [
      { date: '2024-01-01', MGA: 'ARIAS ORGANIZATION', count: 15, post_six: 8, first_six: 7 },
      { date: '2024-01-08', MGA: 'ARIAS ORGANIZATION', count: 18, post_six: 10, first_six: 8 },
      { date: '2024-01-15', MGA: 'ARIAS ORGANIZATION', count: 20, post_six: 12, first_six: 8 },
      { date: '2024-01-22', MGA: 'ARIAS ORGANIZATION', count: 22, post_six: 13, first_six: 9 },
      { date: '2024-01-29', MGA: 'ARIAS ORGANIZATION', count: 25, post_six: 15, first_six: 10 },
      { date: '2024-02-05', MGA: 'ARIAS ORGANIZATION', count: 28, post_six: 17, first_six: 11 },
      { date: '2024-02-12', MGA: 'ARIAS ORGANIZATION', count: 30, post_six: 18, first_six: 12 },
      { date: '2024-02-19', MGA: 'ARIAS ORGANIZATION', count: 32, post_six: 19, first_six: 13 },
      { date: '2024-02-26', MGA: 'ARIAS ORGANIZATION', count: 35, post_six: 21, first_six: 14 },
      { date: '2024-03-04', MGA: 'ARIAS ORGANIZATION', count: 38, post_six: 23, first_six: 15 },
      { date: '2024-03-11', MGA: 'ARIAS ORGANIZATION', count: 40, post_six: 24, first_six: 16 },
      { date: '2024-03-18', MGA: 'ARIAS ORGANIZATION', count: 42, post_six: 25, first_six: 17 },
      { date: '2024-03-25', MGA: 'ARIAS ORGANIZATION', count: 45, post_six: 27, first_six: 18 },
      { date: '2024-04-01', MGA: 'ARIAS ORGANIZATION', count: 48, post_six: 29, first_six: 19 },
      { date: '2024-04-08', MGA: 'ARIAS ORGANIZATION', count: 50, post_six: 30, first_six: 20 },
      { date: '2024-04-15', MGA: 'ARIAS ORGANIZATION', count: 52, post_six: 31, first_six: 21 },
      { date: '2024-04-22', MGA: 'ARIAS ORGANIZATION', count: 55, post_six: 33, first_six: 22 },
      { date: '2024-04-29', MGA: 'ARIAS ORGANIZATION', count: 58, post_six: 35, first_six: 23 },
      { date: '2024-05-06', MGA: 'ARIAS ORGANIZATION', count: 60, post_six: 36, first_six: 24 },
      { date: '2024-05-13', MGA: 'ARIAS ORGANIZATION', count: 62, post_six: 37, first_six: 25 },
      { date: '2024-05-20', MGA: 'ARIAS ORGANIZATION', count: 65, post_six: 39, first_six: 26 },
      { date: '2024-05-27', MGA: 'ARIAS ORGANIZATION', count: 68, post_six: 41, first_six: 27 },
      { date: '2024-06-03', MGA: 'ARIAS ORGANIZATION', count: 70, post_six: 42, first_six: 28 },
      { date: '2024-06-10', MGA: 'ARIAS ORGANIZATION', count: 72, post_six: 43, first_six: 29 },
      { date: '2024-06-17', MGA: 'ARIAS ORGANIZATION', count: 75, post_six: 45, first_six: 30 },
      { date: '2024-06-24', MGA: 'ARIAS ORGANIZATION', count: 78, post_six: 47, first_six: 31 },
      { date: '2024-07-01', MGA: 'ARIAS ORGANIZATION', count: 80, post_six: 48, first_six: 32 },
      { date: '2024-07-08', MGA: 'ARIAS ORGANIZATION', count: 82, post_six: 49, first_six: 33 },
      { date: '2024-07-15', MGA: 'ARIAS ORGANIZATION', count: 85, post_six: 51, first_six: 34 },
      { date: '2024-07-22', MGA: 'ARIAS ORGANIZATION', count: 88, post_six: 53, first_six: 35 },
      { date: '2024-07-29', MGA: 'ARIAS ORGANIZATION', count: 90, post_six: 54, first_six: 36 },
      { date: '2024-08-05', MGA: 'ARIAS ORGANIZATION', count: 92, post_six: 55, first_six: 37 },
      { date: '2024-08-12', MGA: 'ARIAS ORGANIZATION', count: 95, post_six: 57, first_six: 38 },
      { date: '2024-08-19', MGA: 'ARIAS ORGANIZATION', count: 98, post_six: 59, first_six: 39 },
      { date: '2024-08-26', MGA: 'ARIAS ORGANIZATION', count: 100, post_six: 60, first_six: 40 },
      { date: '2024-09-02', MGA: 'ARIAS ORGANIZATION', count: 102, post_six: 61, first_six: 41 },
      { date: '2024-09-09', MGA: 'ARIAS ORGANIZATION', count: 105, post_six: 63, first_six: 42 },
      { date: '2024-09-16', MGA: 'ARIAS ORGANIZATION', count: 108, post_six: 65, first_six: 43 },
      { date: '2024-09-23', MGA: 'ARIAS ORGANIZATION', count: 110, post_six: 66, first_six: 44 },
      { date: '2024-09-30', MGA: 'ARIAS ORGANIZATION', count: 112, post_six: 67, first_six: 45 },
      { date: '2024-10-07', MGA: 'ARIAS ORGANIZATION', count: 115, post_six: 69, first_six: 46 },
      { date: '2024-10-14', MGA: 'ARIAS ORGANIZATION', count: 118, post_six: 71, first_six: 47 },
      { date: '2024-10-21', MGA: 'ARIAS ORGANIZATION', count: 120, post_six: 72, first_six: 48 },
      { date: '2024-10-28', MGA: 'ARIAS ORGANIZATION', count: 122, post_six: 73, first_six: 49 },
      { date: '2024-11-04', MGA: 'ARIAS ORGANIZATION', count: 125, post_six: 75, first_six: 50 },
      { date: '2024-11-11', MGA: 'ARIAS ORGANIZATION', count: 128, post_six: 77, first_six: 51 },
      { date: '2024-11-18', MGA: 'ARIAS ORGANIZATION', count: 130, post_six: 78, first_six: 52 },
      { date: '2024-11-25', MGA: 'ARIAS ORGANIZATION', count: 132, post_six: 79, first_six: 53 },
      { date: '2024-12-02', MGA: 'ARIAS ORGANIZATION', count: 135, post_six: 81, first_six: 54 },
      { date: '2024-12-09', MGA: 'ARIAS ORGANIZATION', count: 138, post_six: 83, first_six: 55 },
      { date: '2024-12-16', MGA: 'ARIAS ORGANIZATION', count: 140, post_six: 84, first_six: 56 },
      { date: '2024-12-23', MGA: 'ARIAS ORGANIZATION', count: 142, post_six: 85, first_six: 57 },
      { date: '2024-12-30', MGA: 'ARIAS ORGANIZATION', count: 145, post_six: 87, first_six: 58 }
    ];

    for (const data of sampleData) {
      // Convert the date string to a proper Date object and format it as YYYY-MM-DD
      const dateObj = new Date(data.date + 'T00:00:00.000Z');
      const formattedDate = dateObj.toISOString().split('T')[0];
      
      await pool.query(
        'INSERT INTO sub_agent (date, MGA, count, post_six, first_six) VALUES (?, ?, ?, ?, ?)',
        [formattedDate, data.MGA, data.count, data.post_six, data.first_six]
      );
    }

    console.log('✅ Sample data inserted successfully');
  } catch (error) {
    console.error('❌ Error creating sub_agent table:', error);
    throw error;
  }
}

// Run the migration
createSubAgentTable()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }); 