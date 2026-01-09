-- Update existing roleplay script with the actual Response Card script and rebuttals
-- This migration improves the roleplay training experience with real scripts

-- Update the Response Card script with the actual content
UPDATE roleplay_scripts 
SET script_text = '📞 RESPONSE CARD SCRIPT

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTRO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"Hi, may I speak to (Member)!? Hey (Member), this is [Your Name] with American Income Life. We handle some of your benefits through (Group)."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REASON FOR MEETING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"They sent you a letter about this and you sent back a reply card. I just need to verify the information that you wrote down."

"Now, (Member), you wrote down your address as ADDRESS. Is that correct? Okay great!"

"You also wrote down your date of birth as DOB. Is that correct? Awesome!"

"For the beneficiary of the life insurance policy, you wrote down (Beneficiary). Is that still correct? Perfect!"

"It looks like you''re one of the members who hasn''t received their benefits package yet. It''s my job to explain the benefits, activate the permanent ones, and get you caught up."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SETTING THE APPOINTMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"We do everything over a quick video meeting. Did I catch you at work or did I catch you at home?"

[If at home - switch to instant appointment]

"So, what time do you and your Spouse/Partner normally get home from work? Perfect!"

"I have a very booked up schedule right now, but I can squeeze you in today at either TIME or TIME. Which one works best for you and your Spouse/Partner?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOLIDIFY THE APPOINTMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"Okay great! Do me a favor, go ahead and grab a pen and paper, I have some very important information that I need you to write down. Let me know when you''re ready."

• "First, please write down my name: [Your Name]"
• "Second, write down the confirmation number: [Meeting ID]. Please repeat it back to me to make sure we''ve got it right."
• "Next, write down the appointment time: DAY at TIME"

"What''s a good email address so we can send text and email reminders?"

"Now, (Member), if I save that spot for you then I can''t save it for another family. Do you see ANY reason why DAY at TIME would not work? It''s very IMPORTANT that you''re both there. Sound good? Awesome! I''ll be on DAY at TIME. If for some reason I''m running behind, I''ll be sure to call you."

💡 Extra to improve show ratio: "One last thing! I''m sending the meeting link to you so that we can test it right now. We need to make sure it works with your device."',
    objections = '[
  {"objection": "I''m not interested", "response": "No problem. But let''s take a step back. Have you been to the meetings where they talked about this program? That''s exactly why I''m calling. It''s just my job to explain your benefits and get you caught up."},
  {"objection": "Can you mail it to me?", "response": "Great question! That was the first step. You got a letter in the mail and now I have your reply card. The final step is very easy. I just need to set you up with everything over a quick video meeting."},
  {"objection": "How long will this take?", "response": "It depends on how many questions you have. I''m very busy, so I''ll need to keep it short."},
  {"objection": "How much will this cost?", "response": "Great question! The AD&D benefit you receive as a union member is at no cost. It''s just my job to explain your benefits and get you caught up."},
  {"objection": "I can''t talk right now", "response": "No problem, I''ll get straight to the point!"},
  {"objection": "I''m at work right now", "response": "No problem, I''ll get straight to the point!"},
  {"objection": "We''re not buying anything", "response": "I don''t even know if you would qualify. It''s just my job to explain your benefits and get you caught up."},
  {"objection": "Are you trying to sell me something?", "response": "I don''t even know if you would qualify. It''s just my job to explain your benefits and get you caught up."},
  {"objection": "Why does my spouse need to be there?", "response": "Great question! When something happens to you, your spouse will need to understand how the benefits work and how to make a claim."},
  {"objection": "Are you trying to sell me insurance?", "response": "My job is to deliver your benefits, explain them to you and get you caught up with all the other members. Just like your letter said, there are other insurance programs that are available, but the option is, of course, yours."},
  {"objection": "I don''t remember any card", "response": "That''s exactly why I''m calling. There are so many members who sent back the card that it has taken us a while to get to them all. However, I''ll show you a copy of the card, which will help to refresh your memory."},
  {"objection": "I''m not part of the union anymore", "response": "That''s exactly why I''m calling. These benefits are permanent, and you can keep them even if you are no longer part of the union. It''s just my job to explain your benefits and get you caught up."}
]'
WHERE type = 'phone' AND name = 'Response Card';

-- Insert the Response Card script if it doesn't exist
INSERT INTO roleplay_scripts (name, type, script_text, objections, is_active, created_at)
SELECT 'Response Card', 'phone',
'📞 RESPONSE CARD SCRIPT

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTRO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"Hi, may I speak to (Member)!? Hey (Member), this is [Your Name] with American Income Life. We handle some of your benefits through (Group)."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REASON FOR MEETING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"They sent you a letter about this and you sent back a reply card. I just need to verify the information that you wrote down."

"Now, (Member), you wrote down your address as ADDRESS. Is that correct? Okay great!"

"You also wrote down your date of birth as DOB. Is that correct? Awesome!"

"For the beneficiary of the life insurance policy, you wrote down (Beneficiary). Is that still correct? Perfect!"

"It looks like you''re one of the members who hasn''t received their benefits package yet. It''s my job to explain the benefits, activate the permanent ones, and get you caught up."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SETTING THE APPOINTMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"We do everything over a quick video meeting. Did I catch you at work or did I catch you at home?"

[If at home - switch to instant appointment]

"So, what time do you and your Spouse/Partner normally get home from work? Perfect!"

"I have a very booked up schedule right now, but I can squeeze you in today at either TIME or TIME. Which one works best for you and your Spouse/Partner?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOLIDIFY THE APPOINTMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"Okay great! Do me a favor, go ahead and grab a pen and paper, I have some very important information that I need you to write down. Let me know when you''re ready."

• "First, please write down my name: [Your Name]"
• "Second, write down the confirmation number: [Meeting ID]. Please repeat it back to me to make sure we''ve got it right."
• "Next, write down the appointment time: DAY at TIME"

"What''s a good email address so we can send text and email reminders?"

"Now, (Member), if I save that spot for you then I can''t save it for another family. Do you see ANY reason why DAY at TIME would not work? It''s very IMPORTANT that you''re both there. Sound good? Awesome! I''ll be on DAY at TIME. If for some reason I''m running behind, I''ll be sure to call you."

💡 Extra to improve show ratio: "One last thing! I''m sending the meeting link to you so that we can test it right now. We need to make sure it works with your device."',
'[
  {"objection": "I''m not interested", "response": "No problem. But let''s take a step back. Have you been to the meetings where they talked about this program? That''s exactly why I''m calling. It''s just my job to explain your benefits and get you caught up."},
  {"objection": "Can you mail it to me?", "response": "Great question! That was the first step. You got a letter in the mail and now I have your reply card. The final step is very easy. I just need to set you up with everything over a quick video meeting."},
  {"objection": "How long will this take?", "response": "It depends on how many questions you have. I''m very busy, so I''ll need to keep it short."},
  {"objection": "How much will this cost?", "response": "Great question! The AD&D benefit you receive as a union member is at no cost. It''s just my job to explain your benefits and get you caught up."},
  {"objection": "I can''t talk right now", "response": "No problem, I''ll get straight to the point!"},
  {"objection": "I''m at work right now", "response": "No problem, I''ll get straight to the point!"},
  {"objection": "We''re not buying anything", "response": "I don''t even know if you would qualify. It''s just my job to explain your benefits and get you caught up."},
  {"objection": "Are you trying to sell me something?", "response": "I don''t even know if you would qualify. It''s just my job to explain your benefits and get you caught up."},
  {"objection": "Why does my spouse need to be there?", "response": "Great question! When something happens to you, your spouse will need to understand how the benefits work and how to make a claim."},
  {"objection": "Are you trying to sell me insurance?", "response": "My job is to deliver your benefits, explain them to you and get you caught up with all the other members. Just like your letter said, there are other insurance programs that are available, but the option is, of course, yours."},
  {"objection": "I don''t remember any card", "response": "That''s exactly why I''m calling. There are so many members who sent back the card that it has taken us a while to get to them all. However, I''ll show you a copy of the card, which will help to refresh your memory."},
  {"objection": "I''m not part of the union anymore", "response": "That''s exactly why I''m calling. These benefits are permanent, and you can keep them even if you are no longer part of the union. It''s just my job to explain your benefits and get you caught up."}
]',
TRUE, NOW()
WHERE NOT EXISTS (SELECT 1 FROM roleplay_scripts WHERE name = 'Response Card');

-- Update ALL existing phone scripts to use the standard rebuttals
UPDATE roleplay_scripts 
SET objections = '[
  {"objection": "I''m not interested", "response": "No problem. But let''s take a step back. Have you been to the meetings where they talked about this program? That''s exactly why I''m calling. It''s just my job to explain your benefits and get you caught up."},
  {"objection": "Can you mail it to me?", "response": "Great question! That was the first step. You got a letter in the mail and now I have your reply card. The final step is very easy. I just need to set you up with everything over a quick video meeting."},
  {"objection": "How long will this take?", "response": "It depends on how many questions you have. I''m very busy, so I''ll need to keep it short."},
  {"objection": "How much will this cost?", "response": "Great question! The AD&D benefit you receive as a union member is at no cost. It''s just my job to explain your benefits and get you caught up."},
  {"objection": "I can''t talk right now", "response": "No problem, I''ll get straight to the point!"},
  {"objection": "I''m at work right now", "response": "No problem, I''ll get straight to the point!"},
  {"objection": "We''re not buying anything", "response": "I don''t even know if you would qualify. It''s just my job to explain your benefits and get you caught up."},
  {"objection": "Are you trying to sell me something?", "response": "I don''t even know if you would qualify. It''s just my job to explain your benefits and get you caught up."},
  {"objection": "Why does my spouse need to be there?", "response": "Great question! When something happens to you, your spouse will need to understand how the benefits work and how to make a claim."},
  {"objection": "Are you trying to sell me insurance?", "response": "My job is to deliver your benefits, explain them to you and get you caught up with all the other members. Just like your letter said, there are other insurance programs that are available, but the option is, of course, yours."},
  {"objection": "I don''t remember any card", "response": "That''s exactly why I''m calling. There are so many members who sent back the card that it has taken us a while to get to them all. However, I''ll show you a copy of the card, which will help to refresh your memory."},
  {"objection": "I''m not part of the union anymore", "response": "That''s exactly why I''m calling. These benefits are permanent, and you can keep them even if you are no longer part of the union. It''s just my job to explain your benefits and get you caught up."}
]'
WHERE type = 'phone' AND is_active = true;

