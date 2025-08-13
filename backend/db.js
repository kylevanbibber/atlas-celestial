const mysql = require("mysql");
const dotenv = require("dotenv");

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || '208.109.78.44',
  user: process.env.DB_USER || 'kvanbibber',
  password: process.env.DB_PASS || 'Atlas2024!',
  database: process.env.DB_NAME || 'AriasLifeUsers',
  multipleStatements: true,
  connectionLimit: 15,
  queueLimit: 0,
  waitForConnections: true,
  connectTimeout: 60000,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  idleTimeout: 300000,
  timezone: 'America/New_York',
};

const pool = mysql.createPool(dbConfig);

pool.on("error", (err) => {
  console.error("Database error:", err);
  if (err.code === "PROTOCOL_CONNECTION_LOST" || err.code === "ECONNRESET") {
    console.log("Reconnecting to MySQL...");
  } else {
    throw err;
  }
});

const getConnection = (callback) => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error getting MySQL connection:", err);
      return callback(err, null);
    }
    callback(null, connection);
  });
};

// Add this query helper function:
const query = (sql, params) => {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, results) => {
      if (err) {
        console.error('Database query error:', err);
        return reject(err);
      }
      resolve(results);
    });
  });
};

module.exports = { pool, getConnection, query };
