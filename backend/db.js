const mysql = require("mysql");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();
// Also attempt to load env from backend/.env when the process is started from repo root.
dotenv.config({ path: path.join(__dirname, '.env') });

// IMPORTANT: Avoid defaulting to production credentials in local/dev.
// Use environment variables; fall back to safe localhost defaults.
const dbConfig = {
  host: process.env.DB_HOST || '107.180.115.113',
  user: process.env.DB_USER || 'kvanbibber',
  password: process.env.DB_PASS || 'Atlas2024!',
  database: process.env.DB_NAME || 'atlas',
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
