/**
 * Activity Baselines
 *
 * Industry/agency baselines for evaluating funnel performance.
 * Used by the Activity Pipeline, Conversion Trend, and any future
 * widget that needs to color-code or coach on activity metrics.
 *
 * Each metric has:
 *   - thresholds with { good, decent } cutoffs (anything worse = bad)
 *   - direction: 'lower' = lower is better, 'higher' = higher is better
 *   - tips: coaching suggestions when the metric is in the "bad" zone
 */

const BASELINES = {
  callsPerAppt: {
    label: 'Calls / Appt',
    direction: 'lower', // lower number = better
    good: 80,           // ≤80 is good
    decent: 120,        // 80–120 is decent
    // >120 is bad
    tips: [
      'Need more consistent calling effort',
      'Work on handling objections on the phone',
      'Focus on at least setting an appointment',
    ],
  },

  showRate: {
    label: 'Show Rate',
    direction: 'higher', // higher % = better
    good: 33,            // ≥33% is good
    decent: 25,          // 25–33% is decent
    // <25% is bad
    tips: [
      'Not solidifying appointments — setting weak appts',
      'Review and improve the phone script',
      'Send reminders to the client before appointments',
    ],
  },

  closeRate: {
    label: 'Close Rate',
    direction: 'higher', // higher % = better
    good: 45,            // ≥45% is good
    decent: 25,          // 25–45% is decent
    // <25% is bad
    tips: [
      'Needs script work on the presentation',
      'Work on closing techniques',
      'Review presentations with a leader',
    ],
  },

  alpPerSale: {
    label: 'ALP / Sale',
    direction: 'higher', // higher $ = better
    good: 1200,          // ≥$1,200 is good
    decent: 800,         // $800–$1,200 is decent
    // <$800 is bad
    tips: [
      'Not showing big enough checks / plans',
      'Reducing down instead of trying to rebuttal',
      'Not showing a big enough need to the client',
    ],
  },

  refsPerSit: {
    label: 'Refs / Sit',
    direction: 'higher', // higher = better
    good: 3,             // ≥3 is good
    decent: 3,           // no "decent" band — anything <3 is bad
    // <3 is bad
    tips: [
      'Not asking for referrals',
      'Not showing enough value in no-cost benefits',
      'Not being referrable — review client experience',
    ],
  },
};

/**
 * Evaluate a metric value against its baseline.
 * Returns { status: 'good'|'decent'|'bad', color, tips }
 */
const evaluate = (metricKey, value) => {
  const baseline = BASELINES[metricKey];
  if (!baseline || value == null || !isFinite(value)) {
    return { status: 'neutral', color: 'var(--muted-foreground, #999)', tips: [] };
  }

  if (baseline.direction === 'lower') {
    // Lower is better (e.g. callsPerAppt)
    if (value <= baseline.good) return { status: 'good', color: 'var(--success, #10b981)', tips: [] };
    if (value <= baseline.decent) return { status: 'decent', color: 'var(--warning, #f59e0b)', tips: [] };
    return { status: 'bad', color: 'var(--destructive, #ef4444)', tips: baseline.tips };
  }

  // Higher is better (showRate, closeRate, alpPerSale, refsPerSit)
  if (value >= baseline.good) return { status: 'good', color: 'var(--success, #10b981)', tips: [] };
  if (value >= baseline.decent) return { status: 'decent', color: 'var(--warning, #f59e0b)', tips: [] };
  return { status: 'bad', color: 'var(--destructive, #ef4444)', tips: baseline.tips };
};

export { BASELINES, evaluate };
export default BASELINES;
