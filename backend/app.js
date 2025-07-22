const express = require("express");
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
app.use("/api/custom", customRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/dataroutes", dataRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  initDiscordBot();
  console.log('Discord bot initialized');
  // Initialize notification scheduler after server has started
  initNotificationScheduler();
  console.log('Notification scheduler initialized');
});
