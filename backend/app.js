const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { initNotificationScheduler } = require('./schedulers/notificationScheduler');
const { initDiscordBot } = require('./bot');

dotenv.config();
const app = express();

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      "http://localhost:3000",
      "https://localhost:3000",
      "http://127.0.0.1:3000",
      "https://127.0.0.1:3000",
      "https://agents.ariaslife.com",
      "https://agents.ariaslife.com",
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Mount the auth routes
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

// License management routes
const licensingRoutes = require("./routes/licensing");
app.use("/api/licenses", licensingRoutes);

// Users routes
const usersRoutes = require("./routes/users");
app.use("/api/users", usersRoutes);

// Admin routes
const adminRoutes = require("./routes/admin");
app.use("/api/admin", adminRoutes);

// Settings routes
const settingsRoutes = require("./routes/settings");
app.use("/api/settings", settingsRoutes);

// Schema routes for database information
const schemaRoutes = require("./routes/schema");
app.use("/api/schema", schemaRoutes);


// Daily Activity routes
const dailyActivityRoutes = require("./routes/dailyActivity");
app.use("/api/dailyActivity", dailyActivityRoutes);

// Production Reports routes
const productionReportsRoutes = require("./routes/productionReports");
app.use("/api/production-reports", productionReportsRoutes);

// Production Goals routes
const goalsRoutes = require("./routes/goals");
app.use("/api/goals", goalsRoutes);

// Recruitment routes
const recruitmentRoutes = require("./routes/recruitment");
app.use("/api/recruitment", recruitmentRoutes);

// REF Report routes
const refReportRoutes = require("./routes/refReport");
app.use("/api/ref-report", refReportRoutes);

// Verification routes
const verifyRoutes = require("./routes/verify");
app.use("/api/verify", verifyRoutes);

// Release routes
const releaseRoutes = require("./routes/release");
app.use("/api/release", releaseRoutes);

// Discord routes
const discordRoutes = require("./routes/discord");
app.use("/api/discord", discordRoutes);

// Document signing routes
const sigRoutes = require("./routes/sigRoutes");
app.use("/api/signing-session", sigRoutes);

// Other routes...
const alpRoutes = require("./routes/alp");
const codesRoutes = require("./routes/codes");
const vipsRoutes = require("./routes/vips");
const moreRoutes = require("./routes/more");
const accountRoutes = require("./routes/account");
const refsRoutes = require("./routes/refs");
const customRoutes = require("./routes/custom");
const uploadRoutes = require("./routes/upload");
const notificationsRoutes = require("./routes/notifications");
const dataRoutes = require("./routes/dataRoutes");

app.use("/api/alp", alpRoutes);
app.use("/api/codes", codesRoutes);
app.use("/api/vips", vipsRoutes);
app.use("/api/more", moreRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/refs", refsRoutes);
const refvalidationRoutes = require("./routes/refvalidation");
const adminDashboardRoutes = require("./routes/adminDashboard");
const adminLicensingRoutes = require("./routes/adminLicensing");
const verificationRoutes = require("./routes/verification");
app.use("/api/refvalidation", refvalidationRoutes);
app.use("/api/admin/dashboard", adminDashboardRoutes);
app.use("/api/admin/licensing", adminLicensingRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/custom", customRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/dataroutes", dataRoutes);

// Create HTTP server for both Express and WebSocket
const server = http.createServer(app);

// WebSocket connection manager
class NotificationManager {
  constructor() {
    this.connections = new Map(); // userId -> Set of WebSocket connections
  }

  addConnection(userId, ws) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId).add(ws);
    console.log(`WebSocket connected for user ${userId}. Total connections: ${this.connections.get(userId).size}`);
  }

  removeConnection(userId, ws) {
    if (this.connections.has(userId)) {
      this.connections.get(userId).delete(ws);
      if (this.connections.get(userId).size === 0) {
        this.connections.delete(userId);
      }
      console.log(`WebSocket disconnected for user ${userId}`);
    }
  }

  notifyUser(userId, notification) {
    if (this.connections.has(userId)) {
      const userConnections = this.connections.get(userId);
      const message = JSON.stringify({
        type: 'notification',
        notification: notification
      });

      userConnections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });

      console.log(`Sent real-time notification to user ${userId} (${userConnections.size} connections)`);
      return true;
    }
    return false;
  }

  notifyAll(notification) {
    const message = JSON.stringify({
      type: 'notification',
      notification: notification
    });

    let notifiedUsers = 0;
    this.connections.forEach((userConnections, userId) => {
      userConnections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
      notifiedUsers++;
    });

    console.log(`Sent broadcast notification to ${notifiedUsers} users`);
    return notifiedUsers;
  }

  getConnectionCount() {
    return Array.from(this.connections.values()).reduce((total, userConnections) => total + userConnections.size, 0);
  }
}

// Global notification manager instance
const notificationManager = new NotificationManager();

// Create WebSocket server
const wss = new WebSocket.Server({ 
  server,
  path: '/ws/notifications'
});

// WebSocket authentication and connection handling
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection attempt');
  let userId = null;
  let isAuthenticated = false;

  // Set up ping/pong to keep connection alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 30000); // Ping every 30 seconds

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'auth' && data.token) {
        // Authenticate the WebSocket connection
        try {
          const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
          userId = decoded.userId;
          isAuthenticated = true;
          
          // Add to notification manager
          notificationManager.addConnection(userId, ws);
          
          // Send authentication success
          ws.send(JSON.stringify({ 
            type: 'auth_success', 
            message: 'WebSocket authenticated successfully' 
          }));
          
          console.log(`WebSocket authenticated for user ${userId}`);
        } catch (error) {
          console.error('WebSocket authentication failed:', error);
          ws.send(JSON.stringify({ 
            type: 'auth_error', 
            message: 'Authentication failed' 
          }));
          ws.close();
        }
      } else if (data.type === 'pong') {
        // Handle pong response - connection is alive

      } else if (!isAuthenticated) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Please authenticate first' 
        }));
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    if (userId) {
      notificationManager.removeConnection(userId, ws);
    }
    console.log('WebSocket connection closed');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clearInterval(pingInterval);
    if (userId) {
      notificationManager.removeConnection(userId, ws);
    }
  });
});

// Make notification manager available globally
global.notificationManager = notificationManager;

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${PORT}/ws/notifications`);

  initDiscordBot();
  console.log('Discord bot initialized');
  // Initialize notification scheduler after server has started
  initNotificationScheduler();
  console.log('Notification scheduler initialized');
});
