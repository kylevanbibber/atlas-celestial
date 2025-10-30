const mysql = require("mysql");
const dotenv = require("dotenv");

dotenv.config();

// Parse JAWSDB_URL if it exists (for Heroku)
let dbConfig;

if (process.env.JAWSDB_URL) {
  // Parse the JAWSDB_URL (format: mysql://user:pass@host:port/database)
  const url = new URL(process.env.JAWSDB_URL);
  dbConfig = {
    host: url.hostname,
    user: url.username,
    password: url.password,
    database: url.pathname.substring(1), // Remove leading slash
    port: url.port || 3306,
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
  console.log('[DB] 🚀 Using JawsDB MySQL (Heroku)');
} else {
  // Use individual environment variables or local defaults
  dbConfig = {
    host: process.env.DB_HOST || '216.69.162.18',
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
  console.log('[DB] 🔧 Using custom database configuration');
}

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
  // Support both callback and promise styles
  if (typeof callback === 'function') {
    pool.getConnection((err, connection) => {
      if (err) {
        console.error("Error getting MySQL connection:", err);
        return callback(err, null);
      }
      callback(null, connection);
    });
    return;
  }
  // Promise style when no callback provided
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        console.error("Error getting MySQL connection:", err);
        return reject(err);
      }
      resolve(connection);
    });
  });
};

// Add this query helper function:
const query = (sql, params) => {
  return new Promise((resolve, reject) => {
    const acquireStart = Date.now();
    pool.getConnection((connErr, connection) => {
      const acquireMs = Date.now() - acquireStart;
      if (connErr) {
        console.error('[DB] ❌ Error acquiring connection:', connErr.code || connErr.message);
        return reject(connErr);
      }

      if (acquireMs > 1000) {
        const poolStats = {
          all: pool._allConnections?.length,
          free: pool._freeConnections?.length,
          queue: (pool._connectionQueue?.length ?? pool._acquiringConnections?.length)
        };
        console.warn(`[DB] ⚠️ Slow acquire (${acquireMs}ms)`, poolStats);
      }

      const queryStart = Date.now();
      connection.query(sql, params, (err, results) => {
        const queryMs = Date.now() - queryStart;
        const totalMs = Date.now() - acquireStart;

        if (queryMs > 3000) {
          const sqlText = typeof sql === 'string' ? sql.trim() : (sql.sql || '').trim();
          console.warn(`[DB] ⚠️ Slow query (${queryMs}ms, total ${totalMs}ms):`, sqlText);
        }

        connection.release();

        if (err) {
          console.error('[DB] ❌ Query error after', totalMs, 'ms:', err.code || err.message);
          return reject(err);
        }
        resolve(results);
      });
    });
  });
};

module.exports = { pool, getConnection, query };
