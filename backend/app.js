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

// Recruiting Objectives routes
const recruitingObjectivesRoutes = require("./routes/recruitingObjectives");
app.use("/api/recruiting-objectives", recruitingObjectivesRoutes);

// PnP routes
const pnpRoutes = require("./routes/pnp");
app.use("/api/pnp", pnpRoutes);

// Commits routes
const commitsRoutes = require("./routes/commits");
app.use("/api/commits", commitsRoutes);

// PayeeWeb report routes
const payeewebRoutes = require("./routes/payeeweb");
app.use("/api/payeeweb", payeewebRoutes);

// MGA Hierarchy routes (for RGA rollup calculations)
const mgaHierarchyRoutes = require("./routes/mgaHierarchy");
app.use("/api/mga-hierarchy", mgaHierarchyRoutes);

// Email Campaigns routes
const emailCampaignsRoutes = require("./routes/emailCampaigns");
app.use("/api/email-campaigns", emailCampaignsRoutes);

// Text Campaigns routes
const textCampaignsRoutes = require("./routes/textCampaigns");
app.use("/api/text-campaigns", textCampaignsRoutes);

// Process Monitor routes (Python web processor monitoring)
const processMonitorRoutes = require("./routes/processMonitor");
app.use("/api/process-monitor", processMonitorRoutes);

// Feedback routes (bug reports & feature requests)
const feedbackRoutes = require("./routes/feedback");
app.use("/api/feedback", feedbackRoutes);

// Navigation tracking routes (for personalized search)
const navigationRoutes = require("./routes/navigation");
app.use("/api/navigation", navigationRoutes);

// Medication reference routes
const medicationsRoutes = require("./routes/medications");
app.use("/api/medications", medicationsRoutes);

// Activity Feed routes
const activityFeedRoutes = require("./routes/activityFeed");
app.use("/api/activity-feed", activityFeedRoutes);

// Calendar routes
const calendarRoutes = require("./routes/calendar");
app.use("/api/calendar", calendarRoutes);

// Tally Dialer routes
const tallyRoutes = require("./routes/tally");
app.use("/api/tally", tallyRoutes);

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
    console.log(`WebSocket connected for user ${userId}. Total connections: ${this.connections.get(userId).size}. Active users: ${this.connections.size}`);
    this.broadcastActiveUsers();
  }

  removeConnection(userId, ws) {
    if (this.connections.has(userId)) {
      this.connections.get(userId).delete(ws);
      if (this.connections.get(userId).size === 0) {
        this.connections.delete(userId);
      }
      console.log(`WebSocket disconnected for user ${userId}. Active users: ${this.connections.size}`);
      this.broadcastActiveUsers();
    }
  }

  notifyUser(userId, data) {
    if (this.connections.has(userId)) {
      const userConnections = this.connections.get(userId);
      
      // If the data already has a 'type' that is a status update (not a new notification),
      // send it as-is so the frontend can route it to the correct handler.
      // For new notifications (no type or type is a notification category like 'info'),
      // wrap with type: 'notification'.
      const STATUS_TYPES = ['notification_read', 'all_notifications_read', 'notification_dismissed'];
      
      let message;
      if (data.type && STATUS_TYPES.includes(data.type)) {
        // Status update — send directly without wrapping
        message = JSON.stringify(data);
      } else {
        // New notification — wrap with type: 'notification'
        message = JSON.stringify({
          type: 'notification',
          notification: data
        });
      }

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

  getActiveUserCount() {
    return this.connections.size;
  }

  getActiveUserIds() {
    return Array.from(this.connections.keys());
  }

  // Broadcast raw data to ALL connected users (no wrapping)
  broadcastAll(data) {
    const message = JSON.stringify(data);
    let notifiedUsers = 0;
    this.connections.forEach((userConnections) => {
      userConnections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
      notifiedUsers++;
    });
    return notifiedUsers;
  }

  broadcastActiveUsers() {
    const count = this.getActiveUserCount();
    const message = JSON.stringify({
      type: 'active_users_count',
      count
    });
    this.connections.forEach((userConnections) => {
      userConnections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    });
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
          
          // Send current active user count immediately
          ws.send(JSON.stringify({
            type: 'active_users_count',
            count: notificationManager.getActiveUserCount()
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
  console.log(`[Schedulers] NODE_ENV=${process.env.NODE_ENV}, DISABLE_SCHEDULERS=${DISABLE_SCHEDULERS}`);
  
  if (!DISABLE_SCHEDULERS) {
    // Initialize notification scheduler after server has started
    initNotificationScheduler();
    console.log('✅ Notification scheduler initialized');
  } else {
    console.log('⚠️  Schedulers disabled (NODE_ENV must be "production" and DISABLE_SCHEDULERS must not be "true")');
  }
  
  // Initialize email campaign scheduler
  const { startScheduler } = require('./scripts/process-email-campaigns');
  startScheduler();
  console.log('Email campaign scheduler initialized');
  
  // Initialize weekly report email scheduler
  const { startWeeklyReportScheduler } = require('./scripts/weekly-report-scheduler');
  if (!DISABLE_SCHEDULERS) {
    startWeeklyReportScheduler();
    console.log('✅ Weekly report email scheduler initialized (Monday 9:00 AM ET)');
  } else {
    console.log('⚠️  Weekly report scheduler SKIPPED — schedulers disabled');
  }
  
  // Initialize pipeline linking scheduler
  if (!DISABLE_SCHEDULERS) {
    initPipelineLinkingScheduler();
    console.log('✅ Pipeline linking scheduler initialized');
  }

  // Initialize text campaign follow-up scheduler
  if (!DISABLE_SCHEDULERS) {
    const { initTextCampaignFollowUpScheduler } = require('./schedulers/textCampaignFollowUpScheduler');
    initTextCampaignFollowUpScheduler();
    console.log('✅ Text campaign follow-up scheduler initialized (every 5 min)');
  }

  // Initialize verification email/SMS scheduler (daily 8 AM EST)
  if (!DISABLE_SCHEDULERS) {
    const { initVerificationScheduler } = require('./schedulers/verificationScheduler');
    initVerificationScheduler();
    console.log('✅ Verification email scheduler initialized (daily 8 AM EST)');
  }

  // Initialize daily activity reminder scheduler (daily 9 PM ET)
  if (!DISABLE_SCHEDULERS) {
    const { initDailyActivityReminderScheduler } = require('./schedulers/dailyActivityReminderScheduler');
    initDailyActivityReminderScheduler();
    console.log('✅ Daily activity reminder scheduler initialized (daily 9 PM ET)');
  }

  // Initialize Gmail watch renewal scheduler (daily 3 AM ET)
  if (!DISABLE_SCHEDULERS) {
    const { initGmailWatchScheduler } = require('./schedulers/gmailWatchScheduler');
    initGmailWatchScheduler();
    console.log('✅ Gmail watch renewal scheduler initialized (daily 3 AM ET)');
  }

  // Fallback: pending eligibility notification scheduler (hourly).
  // Primary delivery is via the Python processor calling /api/process-monitor/callback/associates-activated.
  // This scheduler catches any agents missed if the callback timed out or errored.
  if (!DISABLE_SCHEDULERS) {
    const { initPendingEligibilityNotificationScheduler } = require('./schedulers/pendingEligibilityNotificationScheduler');
    initPendingEligibilityNotificationScheduler();
    console.log('✅ Pending eligibility notification scheduler initialized (hourly fallback)');
  }

  // Initialize PayeeWeb report scheduler (weekdays 6 AM ET)
  if (!DISABLE_SCHEDULERS) {
    const { initPayeeWebReportScheduler } = require('./schedulers/payeeWebReportScheduler');
    initPayeeWebReportScheduler();
    console.log('✅ PayeeWeb report scheduler initialized (weekdays 6 AM ET)');
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
