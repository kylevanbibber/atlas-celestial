-- Tally Referral/Affiliate System
-- Referrer: stacks $10/mo off per active referral (capped at plan price)
-- Referee: $10 off first month only

CREATE TABLE IF NOT EXISTS Dial.tally_referral_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  active TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT NOW(),
  INDEX idx_user_id (user_id),
  INDEX idx_code (code)
);

CREATE TABLE IF NOT EXISTS Dial.tally_referrals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  referrer_id INT NOT NULL,          -- Dial.users.id of the person who shared
  referee_id INT NOT NULL,           -- Dial.users.id of the person who signed up
  code_id INT NOT NULL,              -- tally_referral_codes.id
  status ENUM('active','cancelled') DEFAULT 'active',
  stripe_coupon_referee VARCHAR(100),  -- one-time coupon applied to referee
  created_at DATETIME DEFAULT NOW(),
  cancelled_at DATETIME NULL,
  UNIQUE(referee_id),                -- each user can only be referred once
  INDEX idx_referrer (referrer_id),
  INDEX idx_status (status)
);
