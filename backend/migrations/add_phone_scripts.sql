-- Add all phone script types

-- 1. Hard Card (RESPONSE) - Default (already exists as "Standard Phone Presentation")

-- 2. Will Kit
INSERT INTO roleplay_scripts (name, type, script_text, objections, is_active, created_at)
VALUES (
  'Will Kit',
  'phone',
  'INTRO: Hi, may I speak to (Member)!? Hey (Member), this is (Your Name), with American Income Life. We provide the Will Kit that you requested from TheFreeWillKit.com.

REASON FOR CALLING: I\'m calling to let you know that the Will Kits you ordered have just arrived! First I\'ll need to verify the information that you provided. You listed your street address as (ADDRESS) and your email address as (EMAIL). Is that correct? Then it looks like you ordered (#) Will Kit(s). Is that correct?

(Member), I\'ll briefly go over the Will Kit and make sure you know where to get it notarized. That way your family doesn\'t end up in probate court.',
  '[
    {"objection": "I\'m not interested", "response": "I can understand that. Nobody likes to think about this subject. I\'ve even heard a few people say that in the past, but when I explained the Will Kit to them, they were super grateful, especially since it\'s at no cost and comes with a living will too."},
    {"objection": "Can you mail it to me?", "response": "That\'s exactly what I\'m going to do. They just require me to explain how to fill it out and where to get it notarized."},
    {"objection": "I don\'t need help filling it out", "response": "Thank you for letting me know because that\'s going to save us some time. I\'ll skip all of the boring stuff and point out the most important parts since these are legal documents that require some expertise to fill out properly."},
    {"objection": "I don\'t remember filling this out", "response": "I completely understand, you must have been thinking about your family and how to better protect them. Looking at my records, it says here that you requested this recently."},
    {"objection": "I already have one set up", "response": "Thank you for letting me know because that\'s going to save us some time. They\'ve recently added some details that are very important. We\'ll just need to update yours with the new one."}
  ]',
  TRUE,
  NOW()
);

-- 3. Child Safe
INSERT INTO roleplay_scripts (name, type, script_text, objections, is_active, created_at)
VALUES (
  'Child Safe',
  'phone',
  'INTRO: Hi, may I speak to (Member)!? Hey (Member), this is (Your Name) with American Income Life calling about the Child Safe Kits that you requested online! You probably remember doing that through Facebook.

REASON FOR MEETING: When you filled out the form, you requested (#) child safe kits. Is that correct? Okay, great! Also, you listed your address as (ADDRESS). Is that still correct? Perfect!

This program is sponsored and endorsed by the International Union of Police Associations. It\'s my job to deliver and explain the child safe kits and go over the Family Care Program. A lot of families have requested these, so I apologize for the wait, but I have fantastic news for you. The child safe kits that YOU requested have finally come in!',
  '[
    {"objection": "I\'m not interested", "response": "I can understand how you feel about that. However, the police tell us that when a child goes missing it takes parents up to 5 hours to gather this vital information. This Child Safe Kit is designed to minimize the time to locate a missing child ALIVE."},
    {"objection": "Can you mail it to me?", "response": "We used to mail them but we found out that not everyone was filling them out correctly. Once we explain the Child Safe Kits, you\'ll scan a unique QR code to set up your Child Safe app."},
    {"objection": "I don\'t remember doing this", "response": "Oh really? Well, don\'t feel bad if you forgot. You requested this on Facebook back recently."},
    {"objection": "I already have a Child Safe Kit", "response": "That\'s exactly why I\'m calling! They went digital now so everyone is getting an update. Once we explain the new Child Safe Kits, you\'ll scan a unique QR code to set up your Child Safe app."},
    {"objection": "How much will this cost?", "response": "Great news! There\'s absolutely no cost to you for the Child Safe Kits."}
  ]',
  TRUE,
  NOW()
);

-- 4. Referral
INSERT INTO roleplay_scripts (name, type, script_text, objections, is_active, created_at)
VALUES (
  'Referral',
  'phone',
  'INTRO: Hi, may I speak to (Member)!? Hey (Member), this is (Your Name) with American Income Life. I just spoke with (Sponsor) and the reason I\'m calling you now is because they sponsored you for some very important benefits for your family! They told you about this, right?

REASON FOR MEETING: (Sponsor) has given you some benefits that are usually only available to unions and special groups like the police, firefighters, and teachers. I gave my word to (Sponsor) that I would get these out to you and explain everything. The only problem is that I\'m getting very busy. I decided to call you now so that we don\'t miss you altogether.',
  '[
    {"objection": "I\'m not interested", "response": "No problem. But let\'s take a step back. Did (Sponsor) send you a text about this? Either way, I made a promise to get these out to you. I\'m sorry to catch you off guard but it\'s just my job to explain the benefits that (Sponsor) sponsored you for."},
    {"objection": "Can you mail it to me?", "response": "That\'s exactly what I\'m going to do. (Sponsor) sponsored you, so I just need to explain everything over a quick video meeting before I can mail it out."},
    {"objection": "How much will this cost?", "response": "Great question! You were sponsored by (Sponsor) and there is no cost to you. It\'s just my job to explain your benefits and get you caught up here."},
    {"objection": "We\'re not buying anything", "response": "I don\'t even know if you would qualify. It\'s just my job to explain your benefits and get you caught up here."},
    {"objection": "Why does my spouse need to be there?", "response": "Great question! When something happens to you, your spouse will need to understand how the benefits work and how to make a claim."}
  ]',
  TRUE,
  NOW()
);

-- 5. POS (Policy Owner Service)
INSERT INTO roleplay_scripts (name, type, script_text, objections, is_active, created_at)
VALUES (
  'POS - Policy Review',
  'phone',
  'INTRO: Hi, may I speak to (Member)!? Hey (Member), this is (Your Name) with American Income Life, your life insurance company, how are you doing? The reason I\'m calling is to set up a review on your policy. So that way you know where your money is going, answer any questions you have and also update your claim forms. Now, do you remember that Freedom of Choice certificate?

I\'ll be able to help you copy the policy number over to the back of that certificate and organize your folder. That way your family never has to worry about digging through papers looking for policy numbers. I\'ll also review your policy with you and reeducate you about how all this stuff works.',
  '[
    {"objection": "I\'m not interested", "response": "No problem! My job is just to review your coverage and go over everything for you."},
    {"objection": "That time won\'t work", "response": "No problem I understand. I could also fit you in on my schedule at another time. Which one works best for you?"},
    {"objection": "How long will this take?", "response": "It depends on how many questions you have. I run a very booked-up schedule, so for me, the shorter the better."},
    {"objection": "I already spoke with someone", "response": "That\'s exactly why I\'m calling. There have been several changes and every policyholder is getting a quick review for the updates. It won\'t take long, and there might be a few ways you can save some money as well."}
  ]',
  TRUE,
  NOW()
);

-- 6. Globe Life
INSERT INTO roleplay_scripts (name, type, script_text, objections, is_active, created_at)
VALUES (
  'Globe Life',
  'phone',
  'INTRO: Hi, may I speak to (Member)!? Hey (Member), this is (Your Name) your agent with Globe Life!

REASON FOR MEETING: I\'m reaching out because we got your request to speak with an agent about our life insurance options and we wanted to follow up. Before we get started, let me verify everything that you listed on your request. You listed your address as (ADDRESS). Is that correct?

What I\'m going to do for you is explain the different options that we have and do a quick needs analysis to see what makes the most sense for your situation.',
  '[
    {"objection": "I\'m not interested", "response": "No problem at all! Were you looking for life insurance for yourself or someone else?"},
    {"objection": "Can you mail it to me?", "response": "That\'s exactly what I\'m going to do. They just require me to explain all the different options, do a needs analysis, and find a policy that fits your needs."},
    {"objection": "I thought it was the $1 insurance policy?", "response": "Yes, that is for the accidental. Most people didn\'t get a proper explanation. So, it\'s my job to explain all the different options, do a needs analysis, and find a policy that fits your needs."},
    {"objection": "It\'s too expensive", "response": "No problem at all. Did you have anybody explain how those policies work yet? Most people didn\'t get a proper explanation. We have an advanced needs analysis that helps to find any gaps in your coverage."},
    {"objection": "I was just shopping around", "response": "Perfect! Were you looking for life insurance for yourself or someone else?"}
  ]',
  TRUE,
  NOW()
);

