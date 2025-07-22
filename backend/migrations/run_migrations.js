require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql');

// Create a connection to the database
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true // Important for running multiple SQL statements
});

// Connect to the database
connection.connect(err => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the database');
  
  // Get the licensed_states migration file
  const migrationFile = path.join(__dirname, 'create_licensed_states_table.sql');
  
  // Read the SQL file
  fs.readFile(migrationFile, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading migration file:', err);
      connection.end();
      return;
    }
    
    // Execute the SQL
    connection.query(data, (err, results) => {
      if (err) {
        console.error('Error executing migration:', err);
      } else {
        console.log('Migration completed successfully');
      }
      
      // Close the connection
      connection.end();
    });
  });
}); 