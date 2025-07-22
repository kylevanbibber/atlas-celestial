// auth-strategies.js
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const MicrosoftStrategy = require("passport-microsoft").Strategy;
const AppleStrategy = require("passport-apple");
const { pool } = require("../../db"); // Adjust the path to your db.js file

// Common callback function for verifying a user
function verifyUser(accessToken, refreshToken, profile, done) {
  // Extract the email from the profile. The property path might vary between providers.
  const email = profile.emails && profile.emails[0].value;
  
  if (!email) {
    return done(null, false, { message: "No email found in OAuth profile" });
  }
  
  // Query your database to verify that the email exists and the account is active.
  const query = `
    SELECT * FROM activeusers 
    WHERE email = ? AND redeemed = 1 AND active = 'y'
  `;
  pool.query(query, [email], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return done(err);
    }
    if (results.length === 0) {
      // If the email isn't found or the account is not active, reject the login.
      return done(null, false, { message: "Account not registered or not active" });
    }
    // If the user is found, continue with that user's data.
    return done(null, results[0]);
  });
}

// Configure Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    verifyUser
  )
);

// Configure Microsoft Strategy
passport.use(
  new MicrosoftStrategy(
    {
      clientID: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      callbackURL: "/auth/microsoft/callback",
      scope: ["user.read"],
    },
    verifyUser
  )
);

// Configure Apple Strategy
passport.use(
  new AppleStrategy(
    {
      clientID: process.env.APPLE_CLIENT_ID,
      teamID: process.env.APPLE_TEAM_ID,
      keyID: process.env.APPLE_KEY_ID,
      privateKeyString: process.env.APPLE_PRIVATE_KEY, // or load from a file
      callbackURL: "/auth/apple/callback",
    },
    verifyUser
  )
);

// Serialize and deserialize user for session management.
passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser((id, done) => {
  const query = "SELECT * FROM activeusers WHERE id = ?";
  pool.query(query, [id], (err, results) => {
    if (err) return done(err);
    done(null, results[0]);
  });
});

module.exports = passport;
