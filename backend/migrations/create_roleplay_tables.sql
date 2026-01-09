-- Create roleplay_scripts table
CREATE TABLE IF NOT EXISTS roleplay_scripts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL COMMENT 'phone or zoom',
  script_text TEXT,
  objections JSON DEFAULT NULL,
  created_by INT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_created_by (created_by)
);

-- Create roleplay_sessions table
CREATE TABLE IF NOT EXISTS roleplay_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  script_id INT,
  type VARCHAR(50) NOT NULL COMMENT 'phone or zoom',
  duration INT DEFAULT 0 COMMENT 'seconds',
  transcript JSON DEFAULT NULL,
  objections_faced JSON DEFAULT NULL,
  ai_feedback TEXT,
  score INT,
  status VARCHAR(50) DEFAULT 'active' COMMENT 'active, completed, abandoned',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_script_id (script_id)
);

-- Create roleplay_analytics table
CREATE TABLE IF NOT EXISTS roleplay_analytics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  session_id INT,
  metric_type VARCHAR(100),
  metric_value JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id_analytics (user_id),
  INDEX idx_session_id_analytics (session_id)
);

-- Insert a default phone script
INSERT INTO roleplay_scripts (name, type, script_text, objections, is_active)
VALUES (
  'Standard Phone Presentation',
  'phone',
  'Opening: "Hi [Name], this is [Your Name] with Arias Organization. How are you doing today?"

Value Proposition: "I\'m reaching out because we help families like yours protect their financial future through life insurance solutions."

Discovery: "Can I ask you a few quick questions to see if this might be a good fit for you?"

Presentation: "Based on what you\'ve shared, I believe we have a solution that can provide your family with peace of mind..."

Close: "Does this sound like something you\'d be interested in learning more about?"',
  '[
    {"objection": "I\'m not interested", "response": "I understand. Can I ask what specifically doesn\'t interest you? That way I can better understand your situation."},
    {"objection": "I already have insurance", "response": "That\'s great to hear! Many of our best clients already had some coverage. When was the last time you reviewed your policy to make sure it still meets your family\'s needs?"},
    {"objection": "It\'s too expensive", "response": "I hear you - budget is important. That\'s exactly why I\'d like to show you some options. You might be surprised at how affordable protection can be. Can we spend just 5 minutes looking at what fits your budget?"},
    {"objection": "Call me back later", "response": "I\'d be happy to. When would be a better time for you? I want to make sure I catch you when you have a few minutes to talk."},
    {"objection": "Send me information", "response": "I can definitely do that. But I\'ve found that a quick 5-minute conversation helps me send you exactly what you need rather than generic information. Do you have just a few minutes now?"}
  ]',
  TRUE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_roleplay_sessions_user_id ON roleplay_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_roleplay_sessions_created_at ON roleplay_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_roleplay_analytics_session_id ON roleplay_analytics(session_id);
