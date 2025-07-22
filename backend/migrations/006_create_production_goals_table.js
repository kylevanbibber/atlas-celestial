const mysql = require('mysql2/promise');

async function up(connection) {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS production_goals (
      id INT PRIMARY KEY AUTO_INCREMENT,
      userId INT NOT NULL,
      year INT NOT NULL,
      month INT NOT NULL,
      monthlyAlpGoal DECIMAL(10,2) NOT NULL,
      workingDays JSON DEFAULT NULL,
      rateSource ENUM('agency', 'personal', 'custom') DEFAULT 'agency',
      customRates JSON DEFAULT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_month_year (userId, year, month),
      INDEX idx_user_date (userId, year, month)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  
  await connection.execute(createTableQuery);
  console.log('✅ Created production_goals table');
}

async function down(connection) {
  const dropTableQuery = `DROP TABLE IF EXISTS production_goals;`;
  await connection.execute(dropTableQuery);
  console.log('✅ Dropped production_goals table');
}

module.exports = { up, down }; 