// SMS Credit Packages Configuration
// Based on TextMagic costs: $0.055 per text (both SMS and MMS)
// Balance is stored in CENTS (e.g., $10.00 = 1000 cents)
// When sending: Each text deducts 5.5 cents (rounded to 6 cents for simplicity)
// NO STRIPE PRODUCTS NEEDED - charges are created dynamically via Payment Intents
// TESTING MODE: All prices set to $0.50 (Stripe minimum) for testing

const SMS_COST_CENTS = 6; // $0.055 rounded to $0.06 per text (6 cents)

const SMS_PACKAGES = [
  {
    id: 'starter',
    name: '$10',
    credits: 1000, // $10.00 balance (stored as 1000 cents)
    price: 0.50, // TESTING: $0.50 (Stripe minimum), change to 10.00 for production
    actualPrice: 10.00, // Real price for display
    smsCount: 166, // Can send up to 166 texts (1000 cents ÷ 6 cents each)
    description: '166 texts',
  },
  {
    id: 'professional',
    name: '$25',
    credits: 2500, // $25.00 balance (stored as 2500 cents)
    price: 0.50, // TESTING: $0.50 (Stripe minimum), change to 25.00 for production
    actualPrice: 25.00,
    smsCount: 416, // Can send up to 416 texts
    description: '416 texts',
  },
  {
    id: 'business',
    name: '$50',
    credits: 5000, // $50.00 balance (stored as 5000 cents)
    price: 0.50, // TESTING: $0.50 (Stripe minimum), change to 50.00 for production
    actualPrice: 50.00,
    smsCount: 833, // Can send up to 833 texts
    description: '833 texts',
  },
  {
    id: 'enterprise',
    name: '$100',
    credits: 10000, // $100.00 balance (stored as 10000 cents)
    price: 0.50, // TESTING: $0.50 (Stripe minimum), change to 100.00 for production
    actualPrice: 100.00,
    smsCount: 1666, // Can send up to 1666 texts
    description: '1,666 texts',
  },
];

// Auto-reload default options - now in DOLLARS instead of credits
const AUTO_RELOAD_THRESHOLDS = [10, 25, 50, 100]; // In DOLLARS
const AUTO_RELOAD_AMOUNTS = [10, 25, 50, 100]; // In DOLLARS (matches package prices)

module.exports = {
  SMS_PACKAGES,
  SMS_COST_CENTS,
  AUTO_RELOAD_THRESHOLDS,
  AUTO_RELOAD_AMOUNTS,
};

