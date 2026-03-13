const express = require('express');
const router = express.Router();
const { query } = require('../db');
const verifyToken = require('../middleware/verifyToken');

router.use(verifyToken);

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getMonthLabel(year, month) {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function getQuarter(month) {
  if (month <= 3) return 'Q1';
  if (month <= 6) return 'Q2';
  if (month <= 9) return 'Q3';
  return 'Q4';
}

// Qualifying months for each bonus month: M-3 and M-2
function getQualifyingMonths(bonusYear, bonusMonth) {
  let qm1Month = bonusMonth - 3;
  let qm1Year = bonusYear;
  if (qm1Month <= 0) { qm1Month += 12; qm1Year -= 1; }

  let qm2Month = bonusMonth - 2;
  let qm2Year = bonusYear;
  if (qm2Month <= 0) { qm2Month += 12; qm2Year -= 1; }

  return {
    qualMonth1: { year: qm1Year, month: qm1Month },
    qualMonth2: { year: qm2Year, month: qm2Month }
  };
}

/**
 * Determine MGA tenure year and transition quarter based on start date.
 *
 * Tenure boundaries (for target year Y):
 *   4th year+: started on or before Oct 1, Y-3
 *   3rd year:  started Oct 1, Y-3  through Oct 1, Y-2
 *   2nd year:  started Oct 2, Y-2  through Oct 1, Y-1
 *   1st year:  started after Oct 1, Y-1
 *
 * Quarter within a tenure year (by month/day of start):
 *   Q1: Oct 1 – Jan 7
 *   Q2: Jan 8 – Apr 1
 *   Q3: Apr 2 – Jul 1
 *   Q4: Jul 2 – Oct 1
 *
 * "Month Begin Applying" for each quarter:
 *   Q1 → Apr (month 4)
 *   Q2 → Jul (month 7)
 *   Q3 → Oct (month 10)
 *   Q4 → Jan next year (month 13, i.e. month 1 of Y+1)
 */
function determineTenure(startDateRaw, targetYear) {
  const start = new Date(startDateRaw);
  if (isNaN(start.getTime())) {
    return { tenureYear: 1, quarter: null, applyMonth: 1 };
  }

  const Y = targetYear;

  // Determine tenure year
  let tenureYear;
  if (start <= new Date(Y - 3, 9, 1)) {        // on or before Oct 1, Y-3
    tenureYear = 4;
  } else if (start <= new Date(Y - 2, 9, 1)) {  // Oct 2, Y-3 through Oct 1, Y-2
    tenureYear = 3;
  } else if (start <= new Date(Y - 1, 9, 1)) {  // Oct 2, Y-2 through Oct 1, Y-1
    tenureYear = 2;
  } else {
    tenureYear = 1;
  }

  if (tenureYear === 1) {
    return { tenureYear: 1, quarter: null, applyMonth: 1 };
  }

  // Determine transition quarter from month/day of start
  const m = start.getMonth() + 1; // 1-12
  const d = start.getDate();

  let quarter;
  if (m === 10 || m === 11 || m === 12 || (m === 1 && d <= 7)) {
    quarter = 'Q1';
  } else if ((m === 1 && d >= 8) || m === 2 || m === 3 || (m === 4 && d <= 1)) {
    quarter = 'Q2';
  } else if ((m === 4 && d >= 2) || m === 5 || m === 6 || (m === 7 && d <= 1)) {
    quarter = 'Q3';
  } else {
    quarter = 'Q4';
  }

  const applyMonths = { Q1: 4, Q2: 7, Q3: 10, Q4: 13 };

  return { tenureYear, quarter, applyMonth: applyMonths[quarter] };
}

/**
 * Get the 10-month calculation window for 3rd/4th year personal objectives.
 *
 * 4th year (all quarters): Jan Y-1 thru Oct Y-1
 * 3rd year:
 *   Q1: Jan Y-1 thru Oct Y-1
 *   Q2: Apr Y-1 thru Jan Y
 *   Q3: Jul Y-1 thru Apr Y
 *   Q4: Oct Y-1 thru Jul Y
 */
function getCalculationWindow(tenureYear, quarter, targetYear) {
  const Y = targetYear;

  if (tenureYear === 4) {
    return { fromYear: Y-1, fromMonth: 1, toYear: Y-1, toMonth: 10 };
  }

  // 3rd year
  const windows = {
    Q1: { fromYear: Y-1, fromMonth: 1,  toYear: Y-1, toMonth: 10 },
    Q2: { fromYear: Y-1, fromMonth: 4,  toYear: Y,   toMonth: 1  },
    Q3: { fromYear: Y-1, fromMonth: 7,  toYear: Y,   toMonth: 4  },
    Q4: { fromYear: Y-1, fromMonth: 10, toYear: Y,   toMonth: 7  },
  };

  return windows[quarter];
}

/**
 * Sum counts from a monthMap ({ "2025-1": 5, "2025-2": 3, ... })
 * across a range of months inclusive.
 */
function countInWindow(monthMap, window) {
  let count = 0;
  let yr = window.fromYear;
  let mo = window.fromMonth;
  while (yr < window.toYear || (yr === window.toYear && mo <= window.toMonth)) {
    count += monthMap[`${yr}-${mo}`] || 0;
    mo++;
    if (mo > 12) { mo = 1; yr++; }
  }
  return count;
}

// GET /api/recruiting-objectives?year=2026
router.get('/', async (req, res) => {
  try {
    const { year } = req.query;
    if (!year) {
      return res.status(400).json({ success: false, message: 'year parameter is required' });
    }
    const yearNum = parseInt(year);

    const userClname = req.user.clname;
    const userLagnname = req.user.lagnname;

    if (!['MGA', 'RGA', 'SGA'].includes(userClname)) {
      return res.status(403).json({ success: false, message: 'Objectives are only available for MGA, RGA, and SGA users' });
    }

    // Get MGA(s) with start dates
    let mgas;
    if (userClname === 'MGA') {
      mgas = await query(
        "SELECT lagnname, start FROM MGAs WHERE lagnname = ? AND Active = 'y'",
        [userLagnname]
      );
    } else if (userClname === 'RGA') {
      // RGA: get own MGA record + all MGAs under this RGA
      mgas = await query(
        "SELECT lagnname, start FROM MGAs WHERE (lagnname = ? OR rga = ?) AND Active = 'y'",
        [userLagnname, userLagnname]
      );
    } else {
      // SGA: all active MGAs
      mgas = await query(
        "SELECT lagnname, start FROM MGAs WHERE Active = 'y'",
        []
      );
    }

    if (mgas.length === 0) {
      return res.json({ success: true, year: yearNum, userClname, mgas: [] });
    }

    const mgaNames = mgas.map(m => m.lagnname);
    const placeholders = mgaNames.map(() => '?').join(',');

    // Bulk fetch codes: Jan Y-1 through Oct Y (covers all calculation windows + qualifying months)
    const codesResult = await query(
      `SELECT MGA, YEAR(PRODDATE) as yr, MONTH(PRODDATE) as mo, COUNT(*) as cnt
       FROM associates
       WHERE MGA IN (${placeholders})
         AND PRODDATE >= ? AND PRODDATE <= ?
       GROUP BY MGA, YEAR(PRODDATE), MONTH(PRODDATE)`,
      [...mgaNames, `${yearNum - 1}-01-01`, `${yearNum}-10-31`]
    );

    // Nested map: mga -> "yr-mo" -> count
    const codesMap = {};
    codesResult.forEach(row => {
      if (!codesMap[row.MGA]) codesMap[row.MGA] = {};
      codesMap[row.MGA][`${row.yr}-${row.mo}`] = row.cnt;
    });

    // Bulk fetch VIPs
    const vipsResult = await query(
      `SELECT mga, YEAR(vip_month) as yr, MONTH(vip_month) as mo, COUNT(*) as cnt
       FROM VIPs
       WHERE mga IN (${placeholders})
         AND vip_month >= ? AND vip_month <= ?
       GROUP BY mga, YEAR(vip_month), MONTH(vip_month)`,
      [...mgaNames, `${yearNum - 1}-01-01`, `${yearNum}-10-31`]
    );

    const vipsMap = {};
    vipsResult.forEach(row => {
      if (!vipsMap[row.mga]) vipsMap[row.mga] = {};
      vipsMap[row.mga][`${row.yr}-${row.mo}`] = row.cnt;
    });

    // Process each MGA
    const mgaResults = mgas.map(mga => {
      const tenure = determineTenure(mga.start, yearNum);

      let objective, prevObjective, windowInfo = null;

      if (tenure.tenureYear === 1) {
        objective = 2;
        prevObjective = 2;
      } else if (tenure.tenureYear === 2) {
        objective = 3;
        prevObjective = 2; // was 1st year
      } else {
        // 3rd or 4th year — personal objective: round(1.2 × total / 5), minimum 5
        const window = getCalculationWindow(tenure.tenureYear, tenure.quarter, yearNum);
        const windowCodes = countInWindow(codesMap[mga.lagnname] || {}, window);
        const windowVips = countInWindow(vipsMap[mga.lagnname] || {}, window);
        const total = windowCodes + windowVips;
        const raw = Math.round(1.2 * total / 5);
        objective = Math.max(raw, 5);

        prevObjective = tenure.tenureYear === 3 ? 3 : objective; // 4th yr prev ≈ same

        windowInfo = {
          from: getMonthLabel(window.fromYear, window.fromMonth),
          to: getMonthLabel(window.toYear, window.toMonth),
          codes: windowCodes,
          vips: windowVips,
          total,
          calculation: `round(1.2 × ${total} / 5) = ${raw}${raw < 5 ? ' → min 5' : ''}`
        };
      }

      // Build monthly data
      const months = [];
      for (let m = 1; m <= 12; m++) {
        const { qualMonth1, qualMonth2 } = getQualifyingMonths(yearNum, m);

        const codesM1 = (codesMap[mga.lagnname] || {})[`${qualMonth1.year}-${qualMonth1.month}`] || 0;
        const codesM2 = (codesMap[mga.lagnname] || {})[`${qualMonth2.year}-${qualMonth2.month}`] || 0;
        const vipsM1 = (vipsMap[mga.lagnname] || {})[`${qualMonth1.year}-${qualMonth1.month}`] || 0;
        const vipsM2 = (vipsMap[mga.lagnname] || {})[`${qualMonth2.year}-${qualMonth2.month}`] || 0;

        const actualTotal = codesM1 + codesM2 + vipsM1 + vipsM2;

        // Objective that applies: new objective after applyMonth, previous before
        const isNewObj = tenure.tenureYear === 1 || m >= tenure.applyMonth;
        const applicableObj = isNewObj ? objective : prevObjective;

        months.push({
          bonusMonth: m,
          bonusMonthLabel: getMonthLabel(yearNum, m),
          qualifyingMonth1: { ...qualMonth1, label: getMonthLabel(qualMonth1.year, qualMonth1.month) },
          qualifyingMonth2: { ...qualMonth2, label: getMonthLabel(qualMonth2.year, qualMonth2.month) },
          codes: codesM1 + codesM2,
          vips: vipsM1 + vipsM2,
          actualTotal,
          codesMonth1: codesM1,
          codesMonth2: codesM2,
          vipsMonth1: vipsM1,
          vipsMonth2: vipsM2,
          objective: applicableObj,
          isNewObjective: isNewObj,
          met: actualTotal >= applicableObj,
          quarter: getQuarter(m)
        });
      }

      // Format start date for display
      const startDate = mga.start ? new Date(mga.start) : null;
      const startDateLabel = startDate && !isNaN(startDate.getTime())
        ? `${MONTH_NAMES[startDate.getMonth()]} ${startDate.getDate()}, ${startDate.getFullYear()}`
        : 'Unknown';

      return {
        lagnname: mga.lagnname,
        startDate: startDateLabel,
        tenureYear: tenure.tenureYear,
        tenureQuarter: tenure.quarter,
        objective,
        prevObjective,
        applyMonth: tenure.applyMonth,
        applyMonthLabel: tenure.applyMonth <= 12
          ? getMonthLabel(yearNum, tenure.applyMonth)
          : getMonthLabel(yearNum + 1, 1),
        windowInfo,
        months
      };
    });

    res.json({
      success: true,
      year: yearNum,
      userClname,
      mgas: mgaResults
    });
  } catch (error) {
    console.error('Error fetching recruiting objectives:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch recruiting objectives' });
  }
});

module.exports = router;
