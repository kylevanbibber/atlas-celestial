const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const path = require("path");
const url = require("url");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { initNotificationScheduler } = require('./schedulers/notificationScheduler');
const { initPipelineLinkingScheduler } = require('./schedulers/pipelineLinkingScheduler');
const { initDiscordBot } = require('./bot');
const { initVoiceWebSocket, isPremiumAvailable } = require('./wsVoice');

dotenv.config();
// Also attempt to load env from backend/.env when the process is started from repo root.
// (dotenv won't override already-set env vars by default.)
dotenv.config({ path: path.join(__dirname, '.env') });
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
      "https://ariaslife.com",
      "https://salebase.ai",
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
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

// Presentation routes
const presentationsRoutes = require("./routes/presentations");
app.use("/api/presentations", presentationsRoutes);

// Production Reports routes
const productionReportsRoutes = require("./routes/productionReports");
app.use("/api/production-reports", productionReportsRoutes);

// Production Goals routes
const goalsRoutes = require("./routes/goals");
app.use("/api/goals", goalsRoutes);

// Recruitment routes
const recruitmentRoutes = require("./routes/recruitment");
app.use("/api/recruitment", recruitmentRoutes);

// AIL Appointments Sync routes
const ailSyncRoutes = require("./routes/ail-sync");
app.use("/api/ail-sync", ailSyncRoutes);

// SMS Template Variables routes
const smsTemplateVariablesRoutes = require("./routes/smsTemplateVariables");
app.use("/api/sms-template-variables", smsTemplateVariablesRoutes);

// Check-In Texts routes
const checkInTextsRoutes = require("./routes/checkInTexts");
app.use("/api/check-in-texts", checkInTextsRoutes);

// Pipeline Attachments routes
const pipelineAttachmentsRoutes = require("./routes/pipeline-attachments");
app.use("/api/pipeline-attachments", pipelineAttachmentsRoutes);

// Pipeline Linking routes
const pipelineLinkingRoutes = require("./routes/pipelineLinking");
app.use("/api/pipeline-linking", pipelineLinkingRoutes);

// Pending Agent Sync routes
const pendingAgentSyncRoutes = require("./routes/pendingAgentSync");
app.use("/api/pending-agent-sync", pendingAgentSyncRoutes);

// Careers custom videos routes
const careersCustomVideosRoutes = require("./routes/careersCustomVideos");
app.use("/api/careers-videos", careersCustomVideosRoutes);

// REF Report routes
const refReportRoutes = require("./routes/refReport");
app.use("/api/ref-report", refReportRoutes);

// Verification routes
const verifyRoutes = require("./routes/verify");
app.use("/api/verify", verifyRoutes);

// Trophy routes
const trophyRoutes = require("./routes/trophy");
app.use("/api/trophy", trophyRoutes);

// Release routes
const releaseRoutes = require("./routes/release");
app.use("/api/release", releaseRoutes);

// Discord routes
const discordRoutes = require("./routes/discord");
app.use("/api/discord", discordRoutes);

// Competitions routes
const competitionsRoutes = require("./routes/competitions");
app.use("/api/competitions", competitionsRoutes);

// SGAs routes
const sgasRoutes = require("./routes/sgas");
app.use("/api/sgas", sgasRoutes);

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
const dateOverridesRoutes = require("./routes/dateOverrides");
const customRoutes = require("./routes/custom");
const uploadRoutes = require("./routes/upload");
const notificationsRoutes = require("./routes/notifications");
const dataRoutes = require("./routes/dataRoutes");
const trainingRoutes = require("./routes/training");
const codePotentialRoutes = require("./routes/codePotential");
const analyticsRoutes = require("./routes/analytics");

app.use("/api/alp", alpRoutes);
app.use("/api/codes", codesRoutes);
app.use("/api/vips", vipsRoutes);
app.use("/api/more", moreRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/refs", refsRoutes);
app.use("/api/date-overrides", dateOverridesRoutes);
app.use("/api/code-potential", codePotentialRoutes);
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
app.use("/api/training", trainingRoutes);
app.use("/api/analytics", analyticsRoutes);

// PnP routes
const pnpRoutes = require("./routes/pnp");
app.use("/api/pnp", pnpRoutes);

// Commits routes
const commitsRoutes = require("./routes/commits");
app.use("/api/commits", commitsRoutes);

// MGA Hierarchy routes (for RGA rollup calculations)
const mgaHierarchyRoutes = require("./routes/mgaHierarchy");
app.use("/api/mga-hierarchy", mgaHierarchyRoutes);

// Email Campaigns routes
const emailCampaignsRoutes = require("./routes/emailCampaigns");
app.use("/api/email-campaigns", emailCampaignsRoutes);

// Feedback routes (bug reports & feature requests)
const feedbackRoutes = require("./routes/feedback");
app.use("/api/feedback", feedbackRoutes);

// Navigation tracking routes (for personalized search)
const navigationRoutes = require("./routes/navigation");
app.use("/api/navigation", navigationRoutes);

// Medication reference routes
const medicationsRoutes = require("./routes/medications");
app.use("/api/medications", medicationsRoutes);

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

    return notifiedUsers;
  }

  getConnectionCount() {
    return Array.from(this.connections.values()).reduce((total, userConnections) => total + userConnections.size, 0);
  }
}

// Global notification manager instance
const notificationManager = new NotificationManager();

// Create WebSocket servers (noServer) and route upgrades manually.
// This avoids WS path conflicts and prevents 400 "Bad Request" during upgrade.
const notificationsWss = new WebSocket.Server({
  noServer: true,
  perMessageDeflate: false
});

// Voice WebSocket server for premium voice mode
const voiceWss = new WebSocket.Server({
  noServer: true,
  perMessageDeflate: false
});

// Initialize voice WebSocket handler
initVoiceWebSocket(voiceWss);

server.on('upgrade', (req, socket, head) => {
  try {
    const pathname = url.parse(req.url).pathname;
    console.log('[UPGRADE] WebSocket upgrade request received for:', pathname);

    if (pathname === '/ws/notifications') {
      console.log('[UPGRADE] Routing to notifications WebSocket');
      notificationsWss.handleUpgrade(req, socket, head, (ws) => {
        notificationsWss.emit('connection', ws, req);
      });
      return;
    }

    if (pathname === '/ws/voice') {
      console.log('[UPGRADE] *** ROUTING TO VOICE WEBSOCKET ***');
      voiceWss.handleUpgrade(req, socket, head, (ws) => {
        console.log('[UPGRADE] Voice WebSocket upgrade complete, emitting connection');
        voiceWss.emit('connection', ws, req);
      });
      return;
    }

    console.log('[UPGRADE] Unknown path, destroying socket:', pathname);
    socket.destroy();
  } catch (e) {
    console.error('[UPGRADE] Error during upgrade:', e);
    try { socket.destroy(); } catch (_) {}
  }
});

// WebSocket authentication and connection handling
notificationsWss.on('connection', (ws, req) => {
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
  console.log(`Voice WebSocket running on ws://localhost:${PORT}/ws/voice (Premium: ${isPremiumAvailable()})`);

  initDiscordBot();
  console.log('Discord bot initialized');
  
  const DISABLE_SCHEDULERS = process.env.DISABLE_SCHEDULERS === 'true' || process.env.NODE_ENV !== 'production';
  if (!DISABLE_SCHEDULERS) {
    // Initialize notification scheduler after server has started
    initNotificationScheduler();
  } else {
    console.log('Schedulers disabled');
  }
  
  // Initialize email campaign scheduler
  const { startScheduler } = require('./scripts/process-email-campaigns');
  startScheduler();
  console.log('Email campaign scheduler initialized');
  
  // Initialize weekly report email scheduler
  const { startWeeklyReportScheduler } = require('./scripts/weekly-report-scheduler');
  if (!DISABLE_SCHEDULERS) {
    startWeeklyReportScheduler();
    console.log('Weekly report email scheduler initialized');
  }
  
  // Initialize pipeline linking scheduler
  if (!DISABLE_SCHEDULERS) {
    initPipelineLinkingScheduler();
    console.log('Pipeline linking scheduler initialized');
  }

  // Mount onboarding routes
  try {
    app.use('/api/onboarding', require('./routes/onboarding'));
    console.log('Onboarding routes mounted at /api/onboarding');
  } catch (e) {
    console.error('Failed to mount onboarding routes', e);
  }
  
  // Run pending agent sync on startup
  const { syncActivateAgentNumber } = require('./scripts/sync-activate-agent-number');
  const { syncPendingAgents } = require('./scripts/sync-pending-agents');
  
  if (!DISABLE_SCHEDULERS) {
    setTimeout(() => {
      console.log('\n🔄 Running pending agent activation sync...');
      syncActivateAgentNumber().catch(err => {
        console.error('Failed to run pending agent activation sync:', err);
      });
    }, 5000); // Wait 5 seconds after server starts
    
    setTimeout(() => {
      console.log('\n🔄 Running pending agents pipeline sync...');
      syncPendingAgents().catch(err => {
        console.error('Failed to run pending agents pipeline sync:', err);
      });
    }, 7000); // Wait 7 seconds after server starts
  }
});
