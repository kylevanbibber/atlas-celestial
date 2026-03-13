// routes/tally.js — Tally Dialer integration routes
// Queries the shared Dial database for sessions, phone numbers, caller IDs, etc.
const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const { query } = require("../db");
const bcrypt = require("bcryptjs");
const axios = require("axios");

const TALLY_BACKEND_URL = process.env.TALLY_BACKEND_URL || "https://intense-dusk-79330-68ded9c767c7.herokuapp.com";

// Helper: get tally_user_id for the authenticated Atlas user
const getTallyUserId = async (atlasUserId) => {
  const rows = await query(
    "SELECT tally_user_id FROM activeusers WHERE id = ? LIMIT 1",
    [atlasUserId]
  );
  return rows && rows.length > 0 ? rows[0].tally_user_id : null;
};

// Middleware: require linked Tally account
const requireTallyLink = async (req, res, next) => {
  const tallyUserId = await getTallyUserId(req.userId);
  if (!tallyUserId) {
    return res.status(400).json({
      success: false,
      message: "No Tally account linked. Please connect or create an account first.",
    });
  }
  req.tallyUserId = tallyUserId;
  next();
};

// ============================================================
// REGISTRATION — create Tally account from Atlas & auto-link
// ============================================================
router.post("/register", verifyToken, async (req, res) => {
  try {
    const atlasUserId = req.userId;
    const { firstName, lastName, email, phone, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ success: false, message: "First name, last name, email, and password are required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    }

    // Check if Atlas user already has a linked Tally account
    const existing = await query("SELECT tally_user_id FROM activeusers WHERE id = ? LIMIT 1", [atlasUserId]);
    if (existing && existing.length > 0 && existing[0].tally_user_id) {
      return res.status(400).json({ success: false, message: "You already have a linked Tally account." });
    }

    // Register via Vonage backend (handles Stripe customer creation, Twilio sub-account, etc.)
    let vonageResponse;
    try {
      vonageResponse = await axios.post(`${TALLY_BACKEND_URL}/api/register`, {
        firstName, lastName, email, phone, password
      });
    } catch (vonageErr) {
      const errMsg = vonageErr.response?.data?.msg || vonageErr.response?.data?.errors?.[0]?.msg || vonageErr.message;
      console.error("[Tally Register] Vonage registration failed:", errMsg);
      if (vonageErr.response?.status === 400) {
        return res.status(400).json({ success: false, message: errMsg || "An account with this email already exists." });
      }
      return res.status(500).json({ success: false, message: "Failed to create Tally account." });
    }

    // Get the newly created user ID from Dial.users
    const newUser = await query("SELECT id FROM Dial.users WHERE email = ? LIMIT 1", [email]);
    if (!newUser || newUser.length === 0) {
      return res.status(500).json({ success: false, message: "Account created but could not be linked. Try linking manually." });
    }
    const tallyUserId = newUser[0].id;

    // Auto-link to Atlas account
    const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
    await query(
      "UPDATE activeusers SET tally_user_id = ?, tally_email = ?, tally_linked_at = ? WHERE id = ?",
      [tallyUserId, email, now, atlasUserId]
    );

    console.log(`[Tally] Registered & auto-linked: Atlas user ${atlasUserId} → Tally user ${tallyUserId} (${email})`);

    res.json({
      success: true,
      message: "Tally account created and linked successfully.",
      tallyUserId,
      email,
    });
  } catch (error) {
    console.error("[Tally Register] Error:", error);
    res.status(500).json({ success: false, message: "Error creating Tally account." });
  }
});

// ============================================================
// PROFILE & SUBSCRIPTION
// ============================================================

// Get Tally profile + subscription info
router.get("/profile", verifyToken, requireTallyLink, async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, email, firstName, lastName, phone, subscription_plan, subscription_status,
              stripe_customer_id, default_caller_id_phone, created_at
       FROM Dial.users WHERE id = ? LIMIT 1`,
      [req.tallyUserId]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: "Tally user not found." });
    }
    const user = rows[0];
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        subscriptionPlan: user.subscription_plan,
        subscriptionStatus: user.subscription_status,
        defaultCallerIdPhone: user.default_caller_id_phone,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error("[Tally Profile] Error:", error);
    res.status(500).json({ success: false, message: "Error fetching Tally profile." });
  }
});

// ============================================================
// USAGE & SESSIONS
// ============================================================

// Get monthly usage data
router.get("/usage/monthly", verifyToken, requireTallyLink, async (req, res) => {
  try {
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();
    const month = parseInt(req.query.month) || now.getMonth() + 1;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const sessions = await query(
      `SELECT total_dials, created_at
       FROM Dial.sessions
       WHERE user_id = ? AND created_at BETWEEN ? AND ?
       ORDER BY created_at ASC`,
      [req.tallyUserId, startDate, endDate]
    );

    const totalDials = (sessions || []).reduce((sum, s) => sum + (s.total_dials || 0), 0);

    // Get plan info
    const userRows = await query(
      "SELECT subscription_plan FROM Dial.users WHERE id = ? LIMIT 1",
      [req.tallyUserId]
    );
    const plan = userRows && userRows.length > 0 ? userRows[0].subscription_plan : null;

    const PLAN_LIMITS = { basic: 150, pro: 275, "pro-plus": 450 };
    const dailyAllowance = PLAN_LIMITS[plan] || 0;
    const daysInMonth = new Date(year, month, 0).getDate();
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
    const elapsedDays = isCurrentMonth ? now.getDate() : daysInMonth;

    res.json({
      success: true,
      month,
      year,
      usage: { totalDials, sessions: sessions || [] },
      plan,
      capacity: {
        dailyAllowance,
        daysInMonth,
        fullMonthCapacity: dailyAllowance * daysInMonth,
        toDateCapacity: dailyAllowance * elapsedDays,
        isCurrentMonth,
      },
    });
  } catch (error) {
    console.error("[Tally Usage] Error:", error);
    res.status(500).json({ success: false, message: "Error fetching usage data." });
  }
});

// List dial sessions
router.get("/sessions", verifyToken, requireTallyLink, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    const filter = req.query.filter || "all"; // all, today, week, month

    let dateFilter = "";
    const params = [req.tallyUserId];

    if (filter === "today") {
      dateFilter = "AND DATE(created_at) = CURDATE()";
    } else if (filter === "week") {
      dateFilter = "AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
    } else if (filter === "month") {
      const now2 = new Date();
      const year = parseInt(req.query.year) || now2.getFullYear();
      const month = parseInt(req.query.month) || now2.getMonth() + 1;
      dateFilter = "AND YEAR(created_at) = ? AND MONTH(created_at) = ?";
      params.push(year, month);
    }

    const sessions = await query(
      `SELECT id, session_id, session_duration, total_dials, created_at
       FROM Dial.sessions
       WHERE user_id = ? ${dateFilter}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const countRows = await query(
      `SELECT COUNT(*) AS total FROM Dial.sessions WHERE user_id = ? ${dateFilter}`,
      params
    );

    // Summary stats
    const summaryRows = await query(
      `SELECT COUNT(*) AS totalSessions,
              COALESCE(SUM(total_dials), 0) AS totalDials,
              COALESCE(SUM(session_duration), 0) AS totalDuration,
              COALESCE(AVG(session_duration), 0) AS avgDuration
       FROM Dial.sessions
       WHERE user_id = ? ${dateFilter}`,
      params
    );

    res.json({
      success: true,
      data: sessions || [],
      summary: summaryRows && summaryRows.length > 0 ? summaryRows[0] : {},
      pagination: {
        total: countRows && countRows.length > 0 ? countRows[0].total : 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("[Tally Sessions] Error:", error);
    res.status(500).json({ success: false, message: "Error fetching sessions." });
  }
});

// Get call logs for a specific session
router.get("/sessions/:sessionId/calls", verifyToken, requireTallyLink, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Get session info
    const sessionRows = await query(
      "SELECT id, created_at FROM Dial.sessions WHERE (id = ? OR session_id = ?) AND user_id = ? LIMIT 1",
      [sessionId, sessionId, req.tallyUserId]
    );

    if (!sessionRows || sessionRows.length === 0) {
      return res.status(404).json({ success: false, message: "Session not found." });
    }

    const session = sessionRows[0];

    // Get calls within 1-hour window of session start
    const calls = await query(
      `SELECT call_sid, phone_number, direction, from_number, to_number,
              status, start_time, end_time, duration_seconds, caller_name
       FROM Dial.phone_call_logs
       WHERE user_id = ? AND start_time BETWEEN ? AND DATE_ADD(?, INTERVAL 1 HOUR)
       ORDER BY start_time ASC`,
      [req.tallyUserId, session.created_at, session.created_at]
    );

    res.json({ success: true, data: calls || [] });
  } catch (error) {
    console.error("[Tally Session Calls] Error:", error);
    res.status(500).json({ success: false, message: "Error fetching call logs." });
  }
});

// ============================================================
// PHONE NUMBERS
// ============================================================

// List user's phone numbers
router.get("/phone-numbers", verifyToken, requireTallyLink, async (req, res) => {
  try {
    const numbers = await query(
      `SELECT id, phone_number, sid, friendly_name, created_at
       FROM Dial.phone_numbers
       WHERE user_id = ?
       ORDER BY created_at ASC`,
      [req.tallyUserId]
    );
    res.json({ success: true, data: numbers || [] });
  } catch (error) {
    console.error("[Tally Phone Numbers] Error:", error);
    res.status(500).json({ success: false, message: "Error fetching phone numbers." });
  }
});

// Search available phone numbers
router.get("/phone-numbers/available", verifyToken, requireTallyLink, async (req, res) => {
  try {
    const { areaCode } = req.query;
    if (!areaCode || areaCode.length !== 3) {
      return res.status(400).json({ success: false, message: "A 3-digit area code is required." });
    }

    // Get Twilio client for this user's sub-account
    const twilioInfo = await getTwilioClientForTallyUser(req.tallyUserId);
    const client = twilioInfo.client;

    const numbers = await client.availablePhoneNumbers("US").local.list({
      areaCode,
      limit: 10,
    });

    res.json({
      success: true,
      data: numbers.map((n) => ({
        phoneNumber: n.phoneNumber,
        friendlyName: n.friendlyName,
        locality: n.locality,
        region: n.region,
      })),
    });
  } catch (error) {
    console.error("[Tally Available Numbers] Error:", error);
    res.status(500).json({ success: false, message: "Error searching available numbers." });
  }
});

// Helper: get or create the $5/mo recurring price for additional phone numbers
let _phoneNumberPriceId = null;
async function getPhoneNumberPriceId() {
  if (_phoneNumberPriceId) return _phoneNumberPriceId;
  const stripe = getTallyStripe();

  // Check if we already have the price stored
  const prices = await stripe.prices.list({
    lookup_keys: ['tally_extra_phone_number'],
    limit: 1,
  });
  if (prices.data.length > 0) {
    _phoneNumberPriceId = prices.data[0].id;
    return _phoneNumberPriceId;
  }

  // Search for existing price by metadata
  const allPrices = await stripe.prices.list({ limit: 100, active: true });
  const existing = allPrices.data.find(p => p.metadata?.type === 'tally_extra_phone_number');
  if (existing) {
    _phoneNumberPriceId = existing.id;
    return _phoneNumberPriceId;
  }

  // Create product + price
  const product = await stripe.products.create({
    name: 'Tally Additional Phone Number',
    metadata: { type: 'tally_extra_phone_number' },
  });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 500, // $5.00
    currency: 'usd',
    recurring: { interval: 'month' },
    lookup_key: 'tally_extra_phone_number',
    metadata: { type: 'tally_extra_phone_number' },
  });
  _phoneNumberPriceId = price.id;
  console.log(`[Tally] Created phone number price: ${price.id}`);
  return _phoneNumberPriceId;
}

// Helper: sync phone number subscription item quantity with actual count
async function syncPhoneNumberBilling(tallyUserId) {
  try {
    const stripe = getTallyStripe();

    const userRows = await query(
      "SELECT subscription_id, stripe_customer_id FROM Dial.users WHERE id = ? LIMIT 1",
      [tallyUserId]
    );
    if (!userRows?.[0]?.subscription_id) return;

    const subId = userRows[0].subscription_id;

    // Count total phone numbers (first one is free)
    const countRows = await query(
      "SELECT COUNT(*) as cnt FROM Dial.phone_numbers WHERE user_id = ?",
      [tallyUserId]
    );
    const totalNumbers = countRows[0]?.cnt || 0;
    const billableNumbers = Math.max(0, totalNumbers - 1); // first is free

    const sub = await stripe.subscriptions.retrieve(subId);
    const priceId = await getPhoneNumberPriceId();

    // Find existing phone number line item
    const phoneItem = sub.items.data.find(item => item.price.id === priceId);

    if (billableNumbers === 0 && phoneItem) {
      // Remove the line item entirely
      await stripe.subscriptionItems.del(phoneItem.id, { proration_behavior: 'create_prorations' });
      console.log(`[Tally] Removed phone number billing for user ${tallyUserId}`);
    } else if (billableNumbers > 0 && phoneItem) {
      // Update quantity
      await stripe.subscriptionItems.update(phoneItem.id, {
        quantity: billableNumbers,
        proration_behavior: 'create_prorations',
      });
      console.log(`[Tally] Updated phone number billing for user ${tallyUserId}: ${billableNumbers} extra numbers`);
    } else if (billableNumbers > 0 && !phoneItem) {
      // Add new line item
      await stripe.subscriptionItems.create({
        subscription: subId,
        price: priceId,
        quantity: billableNumbers,
        proration_behavior: 'create_prorations',
      });
      console.log(`[Tally] Added phone number billing for user ${tallyUserId}: ${billableNumbers} extra numbers`);
    }
  } catch (error) {
    console.error(`[Tally] Error syncing phone number billing for user ${tallyUserId}:`, error.message);
  }
}

// Buy phone number(s)
router.post("/phone-numbers/buy", verifyToken, requireTallyLink, async (req, res) => {
  try {
    const { numbers } = req.body;

    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ success: false, message: "At least one phone number is required." });
    }

    // Verify user has active subscription
    const userRows = await query(
      "SELECT subscription_id, stripe_customer_id FROM Dial.users WHERE id = ? LIMIT 1",
      [req.tallyUserId]
    );
    if (!userRows?.[0]?.subscription_id) {
      return res.status(400).json({ success: false, message: "Active subscription required to purchase phone numbers." });
    }

    // Purchase numbers via Twilio
    const twilioInfo = await getTwilioClientForTallyUser(req.tallyUserId);
    const client = twilioInfo.client;
    const purchased = [];
    const errors = [];

    for (const num of numbers) {
      try {
        const incoming = await client.incomingPhoneNumbers.create({
          phoneNumber: num.phoneNumber,
          friendlyName: num.friendlyName || num.phoneNumber,
        });

        await query(
          "INSERT INTO Dial.phone_numbers (user_id, phone_number, sid, friendly_name) VALUES (?, ?, ?, ?)",
          [req.tallyUserId, num.phoneNumber, incoming.sid, incoming.friendlyName || num.phoneNumber]
        );

        purchased.push({ phoneNumber: num.phoneNumber, friendlyName: incoming.friendlyName });
      } catch (err) {
        console.error(`[Tally] Failed to buy ${num.phoneNumber}:`, err.message);
        errors.push({ phoneNumber: num.phoneNumber, error: err.message });
      }
    }

    // Sync recurring billing (adds $5/mo per extra number to subscription)
    if (purchased.length > 0) {
      await syncPhoneNumberBilling(req.tallyUserId);
    }

    // Count for response
    const countRows = await query("SELECT COUNT(*) as cnt FROM Dial.phone_numbers WHERE user_id = ?", [req.tallyUserId]);
    const totalNumbers = countRows[0]?.cnt || 0;
    const billableNumbers = Math.max(0, totalNumbers - 1);

    res.json({
      success: purchased.length > 0,
      message: `Purchased ${purchased.length} of ${numbers.length} number(s).${billableNumbers > 0 ? ` $${billableNumbers * 5}/mo added to your subscription.` : ''}`,
      purchasedNumbers: purchased,
      errors,
      monthlyCharge: billableNumbers * 5,
    });
  } catch (error) {
    console.error("[Tally Buy Number] Error:", error);
    res.status(500).json({ success: false, message: "Error purchasing phone number." });
  }
});

// Release a phone number
router.delete("/phone-numbers/:sid", verifyToken, requireTallyLink, async (req, res) => {
  try {
    const { sid } = req.params;

    // Verify ownership
    const numRows = await query(
      "SELECT id, phone_number FROM Dial.phone_numbers WHERE sid = ? AND user_id = ? LIMIT 1",
      [sid, req.tallyUserId]
    );
    if (!numRows || numRows.length === 0) {
      return res.status(404).json({ success: false, message: "Phone number not found." });
    }

    // Release from Twilio
    try {
      const twilioInfo = await getTwilioClientForTallyUser(req.tallyUserId);
      await twilioInfo.client.incomingPhoneNumbers(sid).remove();
    } catch (err) {
      console.warn("[Tally] Twilio release failed (continuing):", err.message);
    }

    // Remove from DB
    await query("DELETE FROM Dial.phone_numbers WHERE sid = ? AND user_id = ?", [sid, req.tallyUserId]);

    // Sync recurring billing (reduces $5/mo charge)
    await syncPhoneNumberBilling(req.tallyUserId);

    res.json({ success: true, message: "Phone number released." });
  } catch (error) {
    console.error("[Tally Release Number] Error:", error);
    res.status(500).json({ success: false, message: "Error releasing phone number." });
  }
});

// ============================================================
// CALLER ID VERIFICATION
// ============================================================

// List verified caller IDs
router.get("/caller-ids", verifyToken, requireTallyLink, async (req, res) => {
  try {
    const callerIds = await query(
      `SELECT id, phone_number, friendly_name, is_verified, verified_at, created_at
       FROM Dial.verified_caller_ids
       WHERE user_id = ?
       ORDER BY is_verified DESC, created_at DESC`,
      [req.tallyUserId]
    );

    const userRows = await query(
      "SELECT default_caller_id_phone FROM Dial.users WHERE id = ? LIMIT 1",
      [req.tallyUserId]
    );
    const defaultCallerId = userRows && userRows.length > 0 ? userRows[0].default_caller_id_phone : null;

    res.json({
      success: true,
      data: callerIds || [],
      defaultCallerId,
    });
  } catch (error) {
    console.error("[Tally Caller IDs] Error:", error);
    res.status(500).json({ success: false, message: "Error fetching caller IDs." });
  }
});

// Initiate caller ID verification
router.post("/caller-ids/verify", verifyToken, requireTallyLink, async (req, res) => {
  try {
    const { phoneNumber, friendlyName } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: "Phone number is required." });
    }

    // Format to E.164
    let formatted = phoneNumber.replace(/\D/g, "");
    if (formatted.length === 10) formatted = "+1" + formatted;
    else if (formatted.length === 11 && formatted.startsWith("1")) formatted = "+" + formatted;
    else if (!formatted.startsWith("+")) formatted = "+" + formatted;

    // Check if already verified
    const existingRows = await query(
      "SELECT id, is_verified FROM Dial.verified_caller_ids WHERE user_id = ? AND phone_number = ? LIMIT 1",
      [req.tallyUserId, formatted]
    );
    if (existingRows && existingRows.length > 0 && existingRows[0].is_verified) {
      return res.status(400).json({ success: false, message: "This number is already verified." });
    }

    // Initiate Twilio verification
    const twilioInfo = await getTwilioClientForTallyUser(req.tallyUserId);
    const validationRequest = await twilioInfo.client.validationRequests.create({
      phoneNumber: formatted,
      friendlyName: friendlyName || formatted,
    });

    // Insert or update DB record
    if (existingRows && existingRows.length > 0) {
      await query(
        `UPDATE Dial.verified_caller_ids
         SET friendly_name = ?, validation_code = ?, call_sid = ?,
             verification_attempts = verification_attempts + 1,
             last_verification_attempt = NOW()
         WHERE id = ?`,
        [friendlyName || formatted, validationRequest.validationCode, validationRequest.callSid, existingRows[0].id]
      );
    } else {
      await query(
        `INSERT INTO Dial.verified_caller_ids
         (user_id, phone_number, friendly_name, validation_code, call_sid, verification_attempts, last_verification_attempt)
         VALUES (?, ?, ?, ?, ?, 1, NOW())`,
        [req.tallyUserId, formatted, friendlyName || formatted, validationRequest.validationCode, validationRequest.callSid]
      );
    }

    res.json({
      success: true,
      message: "Verification call initiated. Answer the call and enter the code.",
      phoneNumber: formatted,
      validationCode: validationRequest.validationCode,
    });
  } catch (error) {
    console.error("[Tally Caller ID Verify] Error:", error);
    if (error.code === 21211) {
      return res.status(400).json({ success: false, message: "Invalid phone number format." });
    }
    if (error.code === 21608) {
      return res.status(400).json({ success: false, message: "This number type cannot be verified (VoIP numbers are not supported)." });
    }
    res.status(500).json({ success: false, message: "Error initiating verification." });
  }
});

// Check verification status
router.get("/caller-ids/status/:phoneNumber", verifyToken, requireTallyLink, async (req, res) => {
  try {
    let formatted = req.params.phoneNumber.replace(/\D/g, "");
    if (formatted.length === 10) formatted = "+1" + formatted;
    else if (formatted.length === 11 && formatted.startsWith("1")) formatted = "+" + formatted;
    else if (!formatted.startsWith("+")) formatted = "+" + formatted;

    const rows = await query(
      "SELECT * FROM Dial.verified_caller_ids WHERE user_id = ? AND phone_number = ? LIMIT 1",
      [req.tallyUserId, formatted]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: "No verification record found." });
    }

    const record = rows[0];

    // If not yet verified and has a call_sid, check with Twilio
    if (!record.is_verified && record.call_sid) {
      try {
        const twilioInfo = await getTwilioClientForTallyUser(req.tallyUserId);
        const call = await twilioInfo.client.calls(record.call_sid).fetch();
        if (call.status === "completed") {
          await query(
            "UPDATE Dial.verified_caller_ids SET is_verified = TRUE, verified_at = NOW() WHERE id = ?",
            [record.id]
          );
          record.is_verified = true;
          record.verified_at = new Date();
        }
      } catch (err) {
        console.warn("[Tally] Could not check call status:", err.message);
      }
    }

    res.json({
      success: true,
      verified: !!record.is_verified,
      phoneNumber: record.phone_number,
      friendlyName: record.friendly_name,
      verifiedAt: record.verified_at,
      verificationAttempts: record.verification_attempts,
    });
  } catch (error) {
    console.error("[Tally Caller ID Status] Error:", error);
    res.status(500).json({ success: false, message: "Error checking verification status." });
  }
});

// Set default caller ID
router.post("/caller-ids/default", verifyToken, requireTallyLink, async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: "Phone number is required." });
    }

    let formatted = phoneNumber.replace(/\D/g, "");
    if (formatted.length === 10) formatted = "+1" + formatted;
    else if (formatted.length === 11 && formatted.startsWith("1")) formatted = "+" + formatted;
    else if (!formatted.startsWith("+")) formatted = "+" + formatted;

    // Verify it's actually verified
    const rows = await query(
      "SELECT id FROM Dial.verified_caller_ids WHERE user_id = ? AND phone_number = ? AND is_verified = TRUE LIMIT 1",
      [req.tallyUserId, formatted]
    );
    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, message: "This number is not verified." });
    }

    await query("UPDATE Dial.users SET default_caller_id_phone = ? WHERE id = ?", [formatted, req.tallyUserId]);

    res.json({ success: true, message: "Default caller ID updated." });
  } catch (error) {
    console.error("[Tally Default Caller ID] Error:", error);
    res.status(500).json({ success: false, message: "Error setting default caller ID." });
  }
});

// Delete a caller ID
router.delete("/caller-ids/:id", verifyToken, requireTallyLink, async (req, res) => {
  try {
    const callerIdId = req.params.id;

    const rows = await query(
      "SELECT phone_number FROM Dial.verified_caller_ids WHERE id = ? AND user_id = ? LIMIT 1",
      [callerIdId, req.tallyUserId]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: "Caller ID not found." });
    }

    const phoneNumber = rows[0].phone_number;

    // Try to remove from Twilio (best effort)
    try {
      const twilioInfo = await getTwilioClientForTallyUser(req.tallyUserId);
      const outgoing = await twilioInfo.client.outgoingCallerIds.list();
      const match = outgoing.find((c) => c.phoneNumber === phoneNumber);
      if (match) await twilioInfo.client.outgoingCallerIds(match.sid).remove();
    } catch (err) {
      console.warn("[Tally] Twilio caller ID removal failed (continuing):", err.message);
    }

    await query("DELETE FROM Dial.verified_caller_ids WHERE id = ? AND user_id = ?", [callerIdId, req.tallyUserId]);

    // Clear default if this was the default
    await query(
      "UPDATE Dial.users SET default_caller_id_phone = NULL WHERE id = ? AND default_caller_id_phone = ?",
      [req.tallyUserId, phoneNumber]
    );

    res.json({ success: true, message: "Caller ID removed." });
  } catch (error) {
    console.error("[Tally Delete Caller ID] Error:", error);
    res.status(500).json({ success: false, message: "Error removing caller ID." });
  }
});

// ============================================================
// SUBSCRIPTION & BILLING (Stripe via Tally's Stripe account)
// ============================================================

// Helper: get Stripe instance for Tally
function getTallyStripe() {
  const key = process.env.TALLY_STRIPE_SECRET_KEY;
  if (!key) throw new Error("TALLY_STRIPE_SECRET_KEY not configured.");
  return require("stripe")(key);
}

// Plan definitions with Stripe price IDs (new Stripe account)
const PLAN_PRICE_IDS = {
  basic: "price_1T93FWGXEN0cLwpT1bm37YPV",
  pro: "price_1T93FWGXEN0cLwpT4n9gTxuq",
  "pro-plus": "price_1T93FXGXEN0cLwpTO5eEExqy",
};

// Get subscription info (current plan, billing, payment methods)
router.get("/subscription", verifyToken, requireTallyLink, async (req, res) => {
  try {
    const stripe = getTallyStripe();
    const userRows = await query(
      "SELECT stripe_customer_id, subscription_plan, subscription_id, subscription_status FROM Dial.users WHERE id = ? LIMIT 1",
      [req.tallyUserId]
    );
    if (!userRows || userRows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const user = userRows[0];
    const result = {
      hasSubscription: false,
      plan: user.subscription_plan,
      status: user.subscription_status,
      stripeCustomerId: user.stripe_customer_id,
      subscription: null,
      paymentMethods: [],
    };

    // If customer exists, fetch payment methods
    if (user.stripe_customer_id) {
      try {
        const pms = await stripe.paymentMethods.list({
          customer: user.stripe_customer_id,
          type: "card",
        });
        result.paymentMethods = pms.data.map((pm) => ({
          id: pm.id,
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        }));
      } catch (e) {
        console.warn("[Tally Sub] Could not fetch payment methods:", e.message);
      }
    }

    // If subscription exists, fetch from Stripe
    if (user.subscription_id) {
      try {
        const sub = await stripe.subscriptions.retrieve(user.subscription_id, {
          expand: ["discount.coupon", "discount.promotion_code"],
        });
        result.hasSubscription = sub.status === "active" || sub.status === "trialing";
        result.status = sub.status;
        result.subscription = {
          id: sub.id,
          status: sub.status,
          currentPeriodEnd: sub.current_period_end,
          currentPeriodStart: sub.current_period_start,
          startDate: sub.start_date,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          items: sub.items.data.map((item) => ({
            priceId: item.price.id,
            unitAmount: item.price.unit_amount,
            interval: item.price.recurring?.interval,
          })),
          discount: null,
        };

        if (sub.discount) {
          const coupon = sub.discount.coupon;
          result.subscription.discount = {
            percentOff: coupon.percent_off,
            amountOff: coupon.amount_off ? coupon.amount_off / 100 : null,
            duration: coupon.duration,
            promoCode: sub.discount.promotion_code?.code || null,
          };
        }
      } catch (e) {
        console.warn("[Tally Sub] Could not fetch subscription:", e.message);
        // Subscription may have been deleted; clear local record
        if (e.code === "resource_missing") {
          await query(
            "UPDATE Dial.users SET subscription_id = NULL, subscription_status = NULL, subscription_plan = NULL WHERE id = ?",
            [req.tallyUserId]
          );
          result.plan = null;
          result.status = null;
        }
      }
    }

    res.json({ success: true, ...result });
  } catch (error) {
    console.error("[Tally Subscription] Error:", error);
    res.status(500).json({ success: false, message: "Error fetching subscription." });
  }
});

// Ensure Stripe customer exists for this Tally user
router.post("/subscription/ensure-customer", verifyToken, requireTallyLink, async (req, res) => {
  try {
    const stripe = getTallyStripe();
    const userRows = await query(
      "SELECT stripe_customer_id, email, firstName, lastName FROM Dial.users WHERE id = ? LIMIT 1",
      [req.tallyUserId]
    );
    if (!userRows || userRows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const user = userRows[0];
    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      });
      customerId = customer.id;
      await query("UPDATE Dial.users SET stripe_customer_id = ?, stripe_account = 'new' WHERE id = ?", [customerId, req.tallyUserId]);
    }

    res.json({ success: true, customerId });
  } catch (error) {
    console.error("[Tally Ensure Customer] Error:", error);
    res.status(500).json({ success: false, message: "Error setting up billing." });
  }
});

// Create SetupIntent for adding a payment method
router.post("/subscription/setup-intent", verifyToken, requireTallyLink, async (req, res) => {
  try {
    const stripe = getTallyStripe();
    const { customerId } = req.body;
    if (!customerId) {
      return res.status(400).json({ success: false, message: "Customer ID required." });
    }
    const setupIntent = await stripe.setupIntents.create({ customer: customerId });
    res.json({ success: true, clientSecret: setupIntent.client_secret });
  } catch (error) {
    console.error("[Tally SetupIntent] Error:", error);
    res.status(500).json({ success: false, message: "Error creating setup intent." });
  }
});

// Add payment method to customer
router.post("/subscription/add-payment-method", verifyToken, requireTallyLink, async (req, res) => {
  try {
    const stripe = getTallyStripe();
    const { paymentMethodId, customerId } = req.body;
    if (!paymentMethodId || !customerId) {
      return res.status(400).json({ success: false, message: "Payment method and customer ID required." });
    }

    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    res.json({ success: true, message: "Payment method added." });
  } catch (error) {
    console.error("[Tally Add PM] Error:", error);
    res.status(500).json({ success: false, message: error.message || "Error adding payment method." });
  }
});

// Remove a payment method
router.post("/subscription/remove-payment-method", verifyToken, requireTallyLink, async (req, res) => {
  try {
    const stripe = getTallyStripe();
    const { paymentMethodId, customerId } = req.body;
    if (!paymentMethodId || !customerId) {
      return res.status(400).json({ success: false, message: "Payment method and customer ID required." });
    }

    // Don't allow removing the last payment method if there's an active subscription
    const pms = await stripe.paymentMethods.list({ customer: customerId, type: "card" });
    const userRows = await query("SELECT subscription_status FROM Dial.users WHERE id = ? LIMIT 1", [req.tallyUserId]);
    const isActive = userRows?.[0]?.subscription_status === "active";

    if (pms.data.length <= 1 && isActive) {
      return res.status(400).json({ success: false, message: "Cannot remove your only payment method while subscribed." });
    }

    await stripe.paymentMethods.detach(paymentMethodId);
    res.json({ success: true, message: "Payment method removed." });
  } catch (error) {
    console.error("[Tally Remove PM] Error:", error);
    res.status(500).json({ success: false, message: "Error removing payment method." });
  }
});

// Create a subscription
router.post("/subscription/create", verifyToken, requireTallyLink, async (req, res) => {
  try {
    const stripe = getTallyStripe();
    const { plan, promoCode, referralCode } = req.body;

    if (!plan || !PLAN_PRICE_IDS[plan]) {
      return res.status(400).json({ success: false, message: "Invalid plan. Choose 'basic', 'pro', or 'pro-plus'." });
    }

    const userRows = await query(
      "SELECT stripe_customer_id, email, firstName, subscription_id FROM Dial.users WHERE id = ? LIMIT 1",
      [req.tallyUserId]
    );
    if (!userRows || userRows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const user = userRows[0];
    if (!user.stripe_customer_id) {
      return res.status(400).json({ success: false, message: "No billing profile. Please add a payment method first." });
    }

    // If already subscribed, reject
    if (user.subscription_id) {
      try {
        const existing = await stripe.subscriptions.retrieve(user.subscription_id);
        if (existing.status === "active" || existing.status === "trialing") {
          return res.status(400).json({ success: false, message: "You already have an active subscription. Use plan change instead." });
        }
      } catch (e) {
        // Subscription doesn't exist in Stripe, continue
      }
    }

    const planNames = { basic: "Tally Basic", pro: "Tally Pro", "pro-plus": "Tally Ultra" };
    const planDials = { basic: 150, pro: 275, "pro-plus": 450 };

    const subscriptionData = {
      customer: user.stripe_customer_id,
      items: [{ price: PLAN_PRICE_IDS[plan] }],
      expand: ["latest_invoice.payment_intent"],
      metadata: {
        plan_type: plan,
        plan_name: planNames[plan],
        dials_per_day: planDials[plan],
      },
    };

    // Handle promo code — use discounts array (Stripe's current API)
    if (promoCode) {
      if (promoCode.startsWith("promo_")) {
        subscriptionData.discounts = [{ promotion_code: promoCode }];
      } else {
        try {
          await stripe.coupons.retrieve(promoCode);
          subscriptionData.discounts = [{ coupon: promoCode }];
        } catch (e) {
          if (e.code === "resource_missing") {
            const promoCodes = await stripe.promotionCodes.list({ code: promoCode, active: true, limit: 1 });
            if (promoCodes.data.length > 0) {
              subscriptionData.discounts = [{ promotion_code: promoCodes.data[0].id }];
            }
          }
        }
      }
    }

    const subscription = await stripe.subscriptions.create(subscriptionData);

    // Update DB
    await query(
      "UPDATE Dial.users SET subscription_plan = ?, subscription_id = ?, subscription_status = ? WHERE id = ?",
      [plan, subscription.id, subscription.status, req.tallyUserId]
    );

    console.log(`[Tally] Subscription created: user ${req.tallyUserId}, plan ${plan}, sub ${subscription.id}`);

    // Apply referral code if provided (and no promo code — can't stack both)
    let referralApplied = false;
    if (referralCode && !promoCode) {
      try {
        const codeRows = await query(
          "SELECT id, user_id FROM Dial.tally_referral_codes WHERE code = ? AND active = 1 LIMIT 1",
          [referralCode.toUpperCase()]
        );
        const existingRef = await query("SELECT id FROM Dial.tally_referrals WHERE referee_id = ?", [req.tallyUserId]);

        if (codeRows.length > 0 && codeRows[0].user_id !== req.tallyUserId && existingRef.length === 0) {
          const refCode = codeRows[0];

          // One-time $10 coupon for referee
          const refereeCoupon = await stripe.coupons.create({
            amount_off: 1000,
            currency: 'usd',
            duration: 'once',
            name: 'Tally Referral: $10 off first month',
          });
          await stripe.subscriptions.update(subscription.id, {
            discounts: [{ coupon: refereeCoupon.id }],
          });

          // Record referral
          await query(
            "INSERT INTO Dial.tally_referrals (referrer_id, referee_id, code_id, stripe_coupon_referee) VALUES (?, ?, ?, ?)",
            [refCode.user_id, req.tallyUserId, refCode.id, refereeCoupon.id]
          );

          // Update referrer's discount
          await updateReferrerDiscount(refCode.user_id);
          referralApplied = true;
          console.log(`[Tally] Referral applied during subscription: referee=${req.tallyUserId}, referrer=${refCode.user_id}`);
        }
      } catch (refErr) {
        console.warn("[Tally] Referral code processing failed (subscription still created):", refErr.message);
      }
    }

    res.json({
      success: true,
      message: referralApplied ? "Subscription created with referral discount!" : "Subscription created successfully!",
      subscription: {
        id: subscription.id,
        status: subscription.status,
        plan,
      },
      referralApplied,
    });
  } catch (error) {
    console.error("[Tally Create Sub] Error:", error);
    res.status(500).json({ success: false, message: error.message || "Error creating subscription." });
  }
});

// Update subscription (change plan)
router.post("/subscription/update", verifyToken, requireTallyLink, async (req, res) => {
  try {
    const stripe = getTallyStripe();
    const { plan } = req.body;

    if (!plan || !PLAN_PRICE_IDS[plan]) {
      return res.status(400).json({ success: false, message: "Invalid plan." });
    }

    const userRows = await query(
      "SELECT subscription_id FROM Dial.users WHERE id = ? LIMIT 1",
      [req.tallyUserId]
    );
    if (!userRows?.[0]?.subscription_id) {
      return res.status(400).json({ success: false, message: "No active subscription to update." });
    }

    const subscriptionId = userRows[0].subscription_id;
    const sub = await stripe.subscriptions.retrieve(subscriptionId);

    await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: sub.items.data[0].id, price: PLAN_PRICE_IDS[plan] }],
      proration_behavior: "none",
    });

    await query("UPDATE Dial.users SET subscription_plan = ? WHERE id = ?", [plan, req.tallyUserId]);

    res.json({ success: true, message: "Plan updated. Change takes effect next billing cycle." });
  } catch (error) {
    console.error("[Tally Update Sub] Error:", error);
    res.status(500).json({ success: false, message: error.message || "Error updating subscription." });
  }
});

// Validate promo code
router.post("/subscription/validate-promo", verifyToken, requireTallyLink, async (req, res) => {
  try {
    const stripe = getTallyStripe();
    const { promoCode } = req.body;
    console.log("[Tally Validate Promo] Received request:", { promoCode, tallyUserId: req.tallyUserId });
    console.log("[Tally Validate Promo] TALLY_STRIPE_SECRET_KEY starts with:", process.env.TALLY_STRIPE_SECRET_KEY?.substring(0, 20));

    if (!promoCode?.trim()) {
      console.log("[Tally Validate Promo] Empty promo code");
      return res.status(400).json({ success: false, valid: false, message: "Promo code required." });
    }

    // Use the raw trimmed code for Stripe lookups (Stripe promotion codes are case-sensitive)
    const code = promoCode.trim();
    console.log("[Tally Validate Promo] Looking up code:", code);
    let coupon;
    let promotionCode;

    if (code.startsWith("promo_")) {
      console.log("[Tally Validate Promo] Detected promo_ prefix, retrieving promotion code...");
      promotionCode = await stripe.promotionCodes.retrieve(code);
      console.log("[Tally Validate Promo] Retrieved promotion code:", { id: promotionCode.id, active: promotionCode.active });
      if (!promotionCode.active) return res.json({ success: true, valid: false, message: "This promo code is no longer active." });
      coupon = promotionCode.coupon;
    } else {
      // First try as coupon ID
      try {
        console.log("[Tally Validate Promo] Trying as coupon ID:", code);
        coupon = await stripe.coupons.retrieve(code);
        console.log("[Tally Validate Promo] Found coupon:", { id: coupon.id, percent_off: coupon.percent_off, amount_off: coupon.amount_off });
      } catch (e) {
        console.log("[Tally Validate Promo] Coupon lookup failed:", { code: e.code, message: e.message });
        if (e.code === "resource_missing") {
          // Try as user-facing promotion code
          console.log("[Tally Validate Promo] Trying as promotion code with promotionCodes.list({ code:", code, "})");
          const promoCodes = await stripe.promotionCodes.list({ code, active: true, limit: 1 });
          console.log("[Tally Validate Promo] promotionCodes.list result:", { count: promoCodes.data.length, codes: promoCodes.data.map(p => ({ id: p.id, code: p.code, active: p.active })) });
          if (promoCodes.data.length > 0) {
            promotionCode = promoCodes.data[0];
            coupon = promotionCode.coupon;
            console.log("[Tally Validate Promo] Found promotion code:", { id: promotionCode.id, code: promotionCode.code, couponId: coupon.id });
          } else {
            // Also try case-insensitive: try uppercase version
            const upperCode = code.toUpperCase();
            if (upperCode !== code) {
              console.log("[Tally Validate Promo] Trying uppercase:", upperCode);
              const upperPromoCodes = await stripe.promotionCodes.list({ code: upperCode, active: true, limit: 1 });
              console.log("[Tally Validate Promo] Uppercase result:", { count: upperPromoCodes.data.length });
              if (upperPromoCodes.data.length > 0) {
                promotionCode = upperPromoCodes.data[0];
                coupon = promotionCode.coupon;
                console.log("[Tally Validate Promo] Found with uppercase:", { id: promotionCode.id, code: promotionCode.code });
              } else {
                console.log("[Tally Validate Promo] No promotion code found for:", code, "or", upperCode);
                return res.json({ success: true, valid: false, message: "Invalid promo code." });
              }
            } else {
              console.log("[Tally Validate Promo] No promotion code found for:", code);
              return res.json({ success: true, valid: false, message: "Invalid promo code." });
            }
          }
        } else throw e;
      }
    }

    if (!coupon || coupon.deleted) {
      console.log("[Tally Validate Promo] Coupon not found or deleted");
      return res.json({ success: true, valid: false, message: "Invalid promo code." });
    }

    const now = Math.floor(Date.now() / 1000);
    if (coupon.redeem_by && coupon.redeem_by < now) {
      console.log("[Tally Validate Promo] Coupon expired:", { redeem_by: coupon.redeem_by, now });
      return res.json({ success: true, valid: false, message: "This promo code has expired." });
    }
    if (coupon.max_redemptions && coupon.times_redeemed >= coupon.max_redemptions) {
      console.log("[Tally Validate Promo] Coupon max redemptions reached:", { max: coupon.max_redemptions, redeemed: coupon.times_redeemed });
      return res.json({ success: true, valid: false, message: "This promo code has reached its usage limit." });
    }

    let description = "";
    if (coupon.percent_off) description = `${coupon.percent_off}% off`;
    else if (coupon.amount_off) description = `$${coupon.amount_off / 100} off`;
    if (coupon.duration === "once") description += " first payment";
    else if (coupon.duration === "repeating") description += ` for ${coupon.duration_in_months} months`;
    else if (coupon.duration === "forever") description += " every month";

    console.log("[Tally Validate Promo] SUCCESS - Valid promo:", { description, promoCodeId: promotionCode ? promotionCode.id : code, couponId: coupon.id });

    res.json({
      success: true,
      valid: true,
      description,
      promoCodeId: promotionCode ? promotionCode.id : code,
      coupon: { percentOff: coupon.percent_off, amountOff: coupon.amount_off ? coupon.amount_off / 100 : null },
    });
  } catch (error) {
    console.error("[Tally Validate Promo] Error:", { message: error.message, code: error.code, type: error.type, statusCode: error.statusCode });
    console.error("[Tally Validate Promo] Full error:", error);
    res.json({ success: true, valid: false, message: "Error validating promo code." });
  }
});

// ============================================================
// TWILIO HELPER — get Twilio client for a Tally user
// ============================================================
async function getTwilioClientForTallyUser(tallyUserId) {
  const rows = await query(
    `SELECT twilio_account_sid, twilio_auth_token, twilio_twiml_app_sid,
            twilio_api_key_sid, twilio_api_key_secret, twilio_subaccount_status
     FROM Dial.users WHERE id = ? LIMIT 1`,
    [tallyUserId]
  );

  const twilio = require("twilio");

  // Use sub-account if provisioned
  if (
    rows &&
    rows.length > 0 &&
    rows[0].twilio_subaccount_status === "active" &&
    rows[0].twilio_account_sid &&
    rows[0].twilio_auth_token
  ) {
    const user = rows[0];
    return {
      client: twilio(user.twilio_account_sid, user.twilio_auth_token),
      accountSid: user.twilio_account_sid,
      authToken: user.twilio_auth_token,
      twimlAppSid: user.twilio_twiml_app_sid,
      apiKeySid: user.twilio_api_key_sid,
      apiKeySecret: user.twilio_api_key_secret,
      isMaster: false,
    };
  }

  // Fallback to master account
  const masterSid = process.env.TALLY_TWILIO_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID;
  const masterToken = process.env.TALLY_TWILIO_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN;

  if (!masterSid || !masterToken) {
    throw new Error("Twilio credentials not configured.");
  }

  return {
    client: twilio(masterSid, masterToken),
    accountSid: masterSid,
    authToken: masterToken,
    isMaster: true,
  };
}

// ============================================================
// ADMIN (restricted to activeusers.id = 92)
// ============================================================

router.get("/admin/overview", verifyToken, async (req, res) => {
  if (req.userId !== 92) return res.status(403).json({ success: false, message: "Access denied." });

  try {
    const stripe = getTallyStripe();

    // Total users
    const totalRows = await query("SELECT COUNT(*) as cnt FROM Dial.users");
    const totalUsers = totalRows[0]?.cnt || 0;

    // Get all users with subscription IDs and Twilio sub-account info
    const allUsers = await query(`
      SELECT u.id, u.firstName, u.lastName, u.email,
             u.subscription_plan as plan, u.subscription_id, u.stripe_customer_id,
             u.twilio_account_sid, u.twilio_subaccount_status,
             (SELECT COUNT(*) FROM Dial.tally_referrals r WHERE r.referrer_id = u.id AND r.status = 'active') as referralCount,
             (SELECT COUNT(*) FROM Dial.phone_numbers pn WHERE pn.user_id = u.id) as phoneNumberCount
      FROM Dial.users u
      ORDER BY u.id DESC
    `);

    // Verify each subscription against Stripe for actual payment status
    const subscribers = [];
    const planCounts = {};
    let monthlyRevenue = 0;
    let totalReferralDiscounts = 0;
    let totalTwilioCost = 0;
    const planPrices = { basic: 225, pro: 350, 'pro-plus': 475 };

    // Fetch Twilio usage from Vonage backend (which owns the Twilio client)
    const twilioUsageMap = {};
    let twilioAccountTotal = 0;
    let projectedAccountTotal = 0;
    const now = new Date();
    let dayOfMonth = now.getDate();
    let daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectionMultiplier = dayOfMonth > 0 ? daysInMonth / dayOfMonth : 1;

    try {
      const ATLAS_API_KEY = process.env.ATLAS_API_KEY || 'atlas-tally-integration-2026';
      console.log('[Tally Admin] Fetching Twilio usage from Vonage backend...');
      const twilioRes = await axios.get(`${TALLY_BACKEND_URL}/api/admin/internal/twilio-usage?period=month`, {
        headers: { 'x-api-key': ATLAS_API_KEY },
        timeout: 30000,
      });

      console.log('[Tally Admin] Vonage response status:', twilioRes.status);
      console.log('[Tally Admin] Vonage response success:', twilioRes.data?.success);
      console.log('[Tally Admin] Vonage usageData count:', twilioRes.data?.usageData?.length || 0);
      console.log('[Tally Admin] Account total:', twilioRes.data?.accountTotal, '| Projected:', twilioRes.data?.projectedAccountTotal);
      console.log('[Tally Admin] Day', twilioRes.data?.dayOfMonth, 'of', twilioRes.data?.daysInMonth, '| Multiplier:', projectionMultiplier.toFixed(2));

      if (twilioRes.data?.success) {
        twilioAccountTotal = twilioRes.data.accountTotal || 0;
        projectedAccountTotal = twilioRes.data.projectedAccountTotal || 0;
        dayOfMonth = twilioRes.data.dayOfMonth || dayOfMonth;
        daysInMonth = twilioRes.data.daysInMonth || daysInMonth;

        for (const ud of (twilioRes.data.usageData || [])) {
          const u = ud.twilio_usage;
          const bc = ud.billing_cycle || {};
          const totalDials = ud.total_dials || 0;
          const totalCalls = u.total_calls || 0;

          if (u.total_cost > 0 || totalDials > 0) {
            console.log(`[Tally Admin] User ${ud.user_id} (${ud.email}): cost=$${u.total_cost?.toFixed(4)} | dials=${totalDials} | calls=${totalCalls} | day ${bc.days_elapsed}/${bc.total_days} | projected=$${ud.projected_cost} | max=$${ud.max_cost} | $/dial=$${ud.cost_per_dial}`);
          }

          twilioUsageMap[ud.user_id] = {
            calls: totalCalls,
            outboundCalls: u.outbound_calls || 0,
            inboundCalls: u.inbound_calls || 0,
            minutes: Math.round((u.total_duration || 0) / 60),
            sms: u.sms_count || 0,
            cost: u.total_cost || 0,
            projectedCost: ud.projected_cost || 0,
            maxCost: ud.max_cost || 0,
            totalDials,
            dialsPerDay: ud.dialsPerDay || 150,
            costPerDial: ud.cost_per_dial || 0,
            costPerCall: totalCalls > 0 ? Math.round(((u.total_cost || 0) / totalCalls) * 10000) / 10000 : 0,
            billingCycle: {
              start: bc.start || null,
              end: bc.end || null,
              totalDays: bc.total_days || daysInMonth,
              daysElapsed: bc.days_elapsed || dayOfMonth,
              daysRemaining: bc.days_remaining || (daysInMonth - dayOfMonth),
            },
            breakdown: {
              callsCost: u.voice_cost || 0,
              smsCost: u.sms_cost || 0,
              numbersCost: u.numbers_cost || 0,
              recordingsCost: u.recordings_cost || 0,
              amdCost: u.amd_cost || 0,
              lookupsCost: u.lookups_cost || 0,
              conferenceCost: u.conference_cost || 0,
              pollyCost: u.polly_cost || 0,
              otherCost: u.other_cost || 0,
            },
          };
        }

        console.log(`[Tally Admin] Mapped ${Object.keys(twilioUsageMap).length} users with Twilio data`);
      } else {
        console.warn('[Tally Admin] Vonage response was not successful:', twilioRes.data);
      }
    } catch (e) {
      console.error('[Tally Admin] Error fetching Twilio usage from Vonage backend:', e.message);
      if (e.response) {
        console.error('[Tally Admin] Response status:', e.response.status, '| data:', JSON.stringify(e.response.data).substring(0, 500));
      }
    }

    for (const user of allUsers) {
      let stripeStatus = null;
      let stripePlan = user.plan;

      if (user.subscription_id) {
        try {
          const sub = await stripe.subscriptions.retrieve(user.subscription_id);
          stripeStatus = sub.status;

          if (stripeStatus === 'active' || stripeStatus === 'trialing') {
            if (!planCounts[stripePlan]) planCounts[stripePlan] = 0;
            planCounts[stripePlan]++;
            monthlyRevenue += planPrices[stripePlan] || 0;

            if (user.referralCount > 0) {
              totalReferralDiscounts += user.referralCount * 10;
            }
          }

          if (sub.status !== user.plan) {
            await query(
              "UPDATE Dial.users SET subscription_status = ? WHERE id = ?",
              [sub.status, user.id]
            );
          }
        } catch (e) {
          if (e.code === 'resource_missing') {
            stripeStatus = 'deleted';
            await query(
              "UPDATE Dial.users SET subscription_id = NULL, subscription_status = NULL, subscription_plan = NULL WHERE id = ?",
              [user.id]
            );
          }
        }
      }

      const twilioUsage = twilioUsageMap[user.id] || null;
      if (twilioUsage) {
        totalTwilioCost += twilioUsage.cost;
      }

      subscribers.push({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        plan: stripePlan,
        status: stripeStatus || 'none',
        referralCount: user.referralCount,
        phoneNumbers: user.phoneNumberCount || 0,
        hasTwilio: !!(user.twilio_account_sid && user.twilio_subaccount_status === 'active'),
        twilioUsage,
      });
    }

    // Sort: active first, then by id desc
    subscribers.sort((a, b) => {
      const aActive = a.status === 'active' || a.status === 'trialing' ? 1 : 0;
      const bActive = b.status === 'active' || b.status === 'trialing' ? 1 : 0;
      if (bActive !== aActive) return bActive - aActive;
      return b.id - a.id;
    });

    const activeSubscribers = Object.values(planCounts).reduce((sum, c) => sum + c, 0);
    const planBreakdown = Object.entries(planCounts).map(([plan, count]) => ({ plan, count }));

    // Recent referrals
    const recentReferrals = await query(`
      SELECT r.id, r.status, r.created_at as createdAt,
             CONCAT(ref.firstName, ' ', ref.lastName) as referrerName,
             CONCAT(ree.firstName, ' ', ree.lastName) as refereeName
      FROM Dial.tally_referrals r
      JOIN Dial.users ref ON ref.id = r.referrer_id
      JOIN Dial.users ree ON ree.id = r.referee_id
      ORDER BY r.created_at DESC
      LIMIT 20
    `);

    // Calculate projected total Twilio cost
    const totalProjectedTwilioCost = subscribers.reduce((sum, s) => sum + (s.twilioUsage?.projectedCost || 0), 0);

    res.json({
      success: true,
      totalUsers,
      activeSubscribers,
      monthlyRevenue,
      totalReferralDiscounts,
      totalTwilioCost: twilioAccountTotal || Math.round(totalTwilioCost * 100) / 100,
      totalProjectedTwilioCost: projectedAccountTotal || Math.round(totalProjectedTwilioCost * 100) / 100,
      dayOfMonth,
      daysInMonth,
      planBreakdown,
      subscribers,
      recentReferrals,
    });
  } catch (error) {
    console.error("[Tally Admin] Error:", error);
    res.status(500).json({ success: false, message: "Error fetching admin data." });
  }
});

// ============================================================
// REFERRAL / AFFILIATE SYSTEM
// ============================================================

// Helper: generate a unique referral code
function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
  let code = 'TALLY-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Helper: recalculate and apply referrer's stacking discount
async function updateReferrerDiscount(referrerId) {
  try {
    const stripe = getTallyStripe();

    // Count active referrals
    const activeRefs = await query(
      "SELECT COUNT(*) as cnt FROM Dial.tally_referrals WHERE referrer_id = ? AND status = 'active'",
      [referrerId]
    );
    const activeCount = activeRefs[0]?.cnt || 0;
    const discountAmount = activeCount * 1000; // $10.00 per referral in cents

    // Get referrer's subscription
    const userRows = await query(
      "SELECT subscription_id, stripe_customer_id FROM Dial.users WHERE id = ? LIMIT 1",
      [referrerId]
    );
    if (!userRows?.[0]?.subscription_id) return; // no active subscription to discount

    const subId = userRows[0].subscription_id;

    if (activeCount === 0) {
      // Remove any existing referral discount
      try {
        await stripe.subscriptions.deleteDiscount(subId);
        console.log(`[Tally Referral] Removed discount from referrer ${referrerId}`);
      } catch (e) {
        // No discount to remove
      }
      return;
    }

    // Get subscription to check plan price (cap discount at plan price)
    const sub = await stripe.subscriptions.retrieve(subId);
    const planAmount = sub.items.data[0]?.price?.unit_amount || 0;
    const cappedDiscount = Math.min(discountAmount, planAmount);

    // Create a new coupon with the calculated amount
    const coupon = await stripe.coupons.create({
      amount_off: cappedDiscount,
      currency: 'usd',
      duration: 'forever',
      name: `Tally Referral: $${(cappedDiscount / 100).toFixed(0)}/mo off (${activeCount} referral${activeCount > 1 ? 's' : ''})`,
    });

    // Apply to subscription (replaces any existing discount)
    await stripe.subscriptions.update(subId, {
      discounts: [{ coupon: coupon.id }],
    });

    console.log(`[Tally Referral] Updated referrer ${referrerId} discount: $${(cappedDiscount / 100).toFixed(0)}/mo (${activeCount} referrals)`);
  } catch (error) {
    console.error(`[Tally Referral] Error updating referrer ${referrerId} discount:`, error.message);
  }
}

// Get or create referral code for current user
router.get("/referral/code", verifyToken, requireTallyLink, async (req, res) => {
  try {
    // Check for existing code
    const existing = await query(
      "SELECT code, created_at FROM Dial.tally_referral_codes WHERE user_id = ? AND active = 1 LIMIT 1",
      [req.tallyUserId]
    );
    if (existing.length > 0) {
      return res.json({ success: true, code: existing[0].code, createdAt: existing[0].created_at });
    }

    // Generate new unique code
    let code, attempts = 0;
    while (attempts < 10) {
      code = generateReferralCode();
      const dupe = await query("SELECT id FROM Dial.tally_referral_codes WHERE code = ?", [code]);
      if (dupe.length === 0) break;
      attempts++;
    }
    if (attempts >= 10) {
      return res.status(500).json({ success: false, message: "Could not generate unique code." });
    }

    await query(
      "INSERT INTO Dial.tally_referral_codes (user_id, code) VALUES (?, ?)",
      [req.tallyUserId, code]
    );

    res.json({ success: true, code, createdAt: new Date() });
  } catch (error) {
    console.error("[Tally Referral] Error getting/creating code:", error);
    res.status(500).json({ success: false, message: "Error generating referral code." });
  }
});

// Get referral stats for current user
router.get("/referral/stats", verifyToken, requireTallyLink, async (req, res) => {
  try {
    // Get referral code
    const codeRows = await query(
      "SELECT id, code FROM Dial.tally_referral_codes WHERE user_id = ? AND active = 1 LIMIT 1",
      [req.tallyUserId]
    );

    // Get referrals made by this user
    const referrals = await query(`
      SELECT r.id, r.status, r.created_at, r.cancelled_at,
             u.firstName, u.lastName, u.email
      FROM Dial.tally_referrals r
      JOIN Dial.users u ON u.id = r.referee_id
      WHERE r.referrer_id = ?
      ORDER BY r.created_at DESC
    `, [req.tallyUserId]);

    const activeCount = referrals.filter(r => r.status === 'active').length;
    const totalDiscount = activeCount * 10; // $10 per active referral

    // Check if this user was referred by someone
    const referredBy = await query(
      "SELECT rc.code FROM Dial.tally_referrals r JOIN Dial.tally_referral_codes rc ON rc.id = r.code_id WHERE r.referee_id = ? LIMIT 1",
      [req.tallyUserId]
    );

    res.json({
      success: true,
      code: codeRows[0]?.code || null,
      referrals: referrals.map(r => ({
        id: r.id,
        name: `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.email,
        status: r.status,
        createdAt: r.created_at,
        cancelledAt: r.cancelled_at,
      })),
      activeCount,
      totalDiscount,
      wasReferred: referredBy.length > 0,
      referredByCode: referredBy[0]?.code || null,
    });
  } catch (error) {
    console.error("[Tally Referral] Error getting stats:", error);
    res.status(500).json({ success: false, message: "Error fetching referral stats." });
  }
});

// Validate a referral code (used during signup/subscription)
router.post("/referral/validate", verifyToken, requireTallyLink, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: "Referral code required." });

    const codeRows = await query(
      "SELECT rc.id, rc.user_id, u.firstName, u.lastName FROM Dial.tally_referral_codes rc JOIN Dial.users u ON u.id = rc.user_id WHERE rc.code = ? AND rc.active = 1 LIMIT 1",
      [code.toUpperCase()]
    );

    if (codeRows.length === 0) {
      return res.json({ success: false, message: "Invalid or expired referral code." });
    }

    // Can't use your own code
    if (codeRows[0].user_id === req.tallyUserId) {
      return res.json({ success: false, message: "You cannot use your own referral code." });
    }

    // Check if already referred
    const existing = await query(
      "SELECT id FROM Dial.tally_referrals WHERE referee_id = ?",
      [req.tallyUserId]
    );
    if (existing.length > 0) {
      return res.json({ success: false, message: "You have already used a referral code." });
    }

    const referrer = codeRows[0];
    res.json({
      success: true,
      valid: true,
      referrerName: `${referrer.firstName || ''} ${referrer.lastName || ''}`.trim(),
      discount: "$10 off your first month",
    });
  } catch (error) {
    console.error("[Tally Referral] Error validating code:", error);
    res.status(500).json({ success: false, message: "Error validating referral code." });
  }
});

// Cancel a referral (when referee's subscription ends)
// This would typically be called from a Stripe webhook
router.post("/referral/cancel", async (req, res) => {
  try {
    const { refereeUserId } = req.body;
    if (!refereeUserId) return res.status(400).json({ success: false });

    const referral = await query(
      "SELECT id, referrer_id FROM Dial.tally_referrals WHERE referee_id = ? AND status = 'active' LIMIT 1",
      [refereeUserId]
    );
    if (referral.length === 0) return res.json({ success: true, message: "No active referral." });

    // Mark cancelled
    await query(
      "UPDATE Dial.tally_referrals SET status = 'cancelled', cancelled_at = NOW() WHERE id = ?",
      [referral[0].id]
    );

    // Recalculate referrer's discount
    await updateReferrerDiscount(referral[0].referrer_id);

    console.log(`[Tally Referral] Cancelled: referee=${refereeUserId}, referrer=${referral[0].referrer_id}`);
    res.json({ success: true });
  } catch (error) {
    console.error("[Tally Referral] Error cancelling:", error);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
