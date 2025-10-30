const db = require('../db');
const emailService = require('./emailService');
const logger = require('../utils/logger');

/**
 * Weekly Report Email Service
 * Sends comprehensive production reports every Monday to MGA/RGA leaders
 */

/**
 * Fetch retention data from PnP table for levels -1, -2, -3
 * Uses the same logic as /api/pnp/user-retention endpoint
 * For RGAs, also returns rgaAll for detailed breakdown
 */
async function getRetentionData(lagnname, isRGA = false) {
  try {
    // Helper to fetch latest row for a given suffix
    const fetchForSuffix = async (suffix) => {
      const q = `
        SELECT 
          name_line,
          agent_num,
          date,
          curr_mo_net_submit,
          cur_ytd_life_net_submit,
          first_6_mo_net_submit,
          first_6_ytd_net,
          curr_mo_4mo_rate,
          proj_plus_1_4mo_rate,
          proj_plus_2_4mo_rate
        FROM pnp
        WHERE (name_line = ? OR ? LIKE CONCAT(name_line, ' %'))
          AND agent_num LIKE ?
        ORDER BY STR_TO_DATE(date, '%m/%d/%y') DESC
        LIMIT 1
      `;
      const rows = await db.query(q, [lagnname, lagnname, `%${suffix}`]);
      return rows && rows[0] ? rows[0] : null;
    };

    const [lvl1, lvl2, lvl3] = await Promise.all([
      fetchForSuffix('-1'),
      fetchForSuffix('-2'),
      fetchForSuffix('-3')
    ]);

    // For RGAs, get all rows from the most current month (covers -3, -4, -5 etc.)
    let rgaAll = [];
    if (isRGA) {
      try {
        const latestDateRows = await db.query(`
          SELECT STR_TO_DATE(date, '%m/%d/%y') AS d
          FROM pnp
          WHERE (name_line = ? OR ? LIKE CONCAT(name_line, ' %'))
          ORDER BY STR_TO_DATE(date, '%m/%d/%y') DESC
          LIMIT 1
        `, [lagnname, lagnname]);
        
        if (latestDateRows && latestDateRows[0] && latestDateRows[0].d) {
          const latest = new Date(latestDateRows[0].d);
          const year = latest.getFullYear();
          const month = latest.getMonth() + 1;
          rgaAll = await db.query(`
            SELECT 
              name_line,
              agent_num,
              date,
              curr_mo_net_submit,
              cur_ytd_life_net_submit,
              first_6_mo_net_submit,
              first_6_ytd_net,
              curr_mo_4mo_rate,
              proj_plus_1_4mo_rate,
              proj_plus_2_4mo_rate
            FROM pnp
            WHERE (name_line = ? OR ? LIKE CONCAT(name_line, ' %'))
              AND YEAR(STR_TO_DATE(date, '%m/%d/%y')) = ?
              AND MONTH(STR_TO_DATE(date, '%m/%d/%y')) = ?
            ORDER BY 
              CASE 
                WHEN agent_num REGEXP '-([0-9]+)$' THEN CAST(SUBSTRING_INDEX(agent_num, '-', -1) AS UNSIGNED)
                ELSE 999
              END ASC,
              STR_TO_DATE(date, '%m/%d/%y') DESC
          `, [lagnname, lagnname, year, month]);
        }
      } catch (e) {
        logger.error(`Error fetching rgaAll for ${lagnname}:`, e);
      }
    }

    return { lvl1, lvl2, lvl3, rgaAll };
  } catch (error) {
    logger.error(`Error fetching retention data for ${lagnname}:`, error);
    return { lvl1: null, lvl2: null, lvl3: null, rgaAll: [] };
  }
}

/**
 * Calculate hire to code ratio (YTD)
 * Simple calculation: Total hires for the year / Total associates for the year
 * Uses MGA column from both amore_data and associates tables
 */
async function calculateHireToCodeRatio(lagnname, currentYear) {
  try {
    const now = new Date();
    const isCurrentYear = currentYear === now.getFullYear();
    
    // For current year, only count up to last completed month
    let yearStart, yearEnd;
    if (isCurrentYear) {
      yearStart = new Date(currentYear, 0, 1);
      yearEnd = new Date(currentYear, now.getMonth(), 0); // Last day of previous month
    } else {
      yearStart = new Date(currentYear, 0, 1);
      yearEnd = new Date(currentYear, 11, 31);
    }

    // Get total codes (associates) for the year where MGA column matches
    const codesResult = await db.query(`
      SELECT COUNT(*) as total
      FROM associates
      WHERE MGA = ?
      AND PRODDATE BETWEEN ? AND ?
    `, [lagnname, yearStart, yearEnd]);

    const totalCodes = codesResult[0]?.total || 0;

    // Get total hires for the year where MGA column matches
    const hiresResult = await db.query(`
      SELECT SUM(Total_Hires) as total
      FROM amore_data
      WHERE MGA = ?
      AND MORE_Date BETWEEN ? AND ?
    `, [lagnname, yearStart, yearEnd]);

    const totalHires = parseFloat(hiresResult[0]?.total) || 0;

    // Calculate ratio
    const ratio = totalCodes > 0 ? totalHires / totalCodes : 0;
    
    return ratio;
  } catch (error) {
    logger.error(`Error calculating hire to code ratio for ${lagnname}:`, error);
    return 0;
  }
}

/**
 * Generate the weekly report email for a single MGA/RGA/SA/GA
 */
async function generateWeeklyReport(user) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const lagnname = user.lagnname;
  const clname = user.clname;
  const isRGA = clname === 'RGA';
  const isSA = clname === 'SA';
  const isGA = clname === 'GA';
  const isMGA = clname === 'MGA';

  // Get current month start/end dates
  const monthStart = new Date(currentYear, currentMonth, 1);
  const monthEnd = new Date(currentYear, currentMonth + 1, 0);

  // Get 45 days ago date
  const fortyFiveDaysAgo = new Date();
  fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);

  // Get last month dates
  const lastMonthStart = new Date(currentYear, currentMonth - 1, 1);
  const lastMonthEnd = new Date(currentYear, currentMonth, 0);

  try {
    const axios = require('axios');
    const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5001/api';
    
    // For RGAs and MGAs, fetch data using API endpoints (like OneOnOne MGA/RGA tabs)
    let mgaLevelData = { codes: 0, vips: 0, hires: 0 };
    let rgaLevelData = { codes: 0, vips: 0, hires: 0 };
    
    let rgaBreakdown = []; // Store per-MGA breakdown for RGAs
    
    if (isRGA) {
      try {
        // Fetch MGA-level data (the RGA's own MGA team - just their personal numbers)
        const [mgaCodesRes, mgaHiresRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/dataroutes/associates/multiple?value=${encodeURIComponent(lagnname)}`),
          axios.get(`${API_BASE_URL}/dataroutes/total-hires?value=${encodeURIComponent(lagnname)}`)
        ]);
        
        const mgaCodesArr = mgaCodesRes?.data?.data || [];
        const mgaHiresArr = mgaHiresRes?.data?.data || [];
        
        mgaLevelData.codes = mgaCodesArr.filter((row) => {
          const d = row?.PRODDATE ? new Date(row.PRODDATE) : null;
          return d && d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        }).length;
        
        mgaLevelData.hires = Math.round(mgaHiresArr.reduce((sum, row) => {
          const d = row?.MORE_Date ? new Date(row.MORE_Date) : null;
          if (d && d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
            return sum + (parseFloat(row?.Total_Hires) || 0);
          }
          return sum;
        }, 0));
        
        // Get MGA VIPs from Potential VIPs (RGA's own MGA team)
        try {
          const ym = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
          const potRes = await axios.get(`${API_BASE_URL}/admin/potential-vips`, { params: { month: ym } });
          const potRows = potRes?.data?.data || [];
          
          mgaLevelData.vips = potRows.filter(r => {
            const mgaName = String(r?.mga || '').toLowerCase();
            const isMatch = String(lagnname).toLowerCase() === mgaName;
            const gross = typeof r?.totalLvl1Gross === 'number' ? r.totalLvl1Gross : parseFloat(r?.totalLvl1Gross || 0);
            return isMatch && Number.isFinite(gross) && gross >= 5000;
          }).length;
        } catch (e) {
          logger.warn('MGA VIPs fetch failed', e);
          mgaLevelData.vips = 0;
        }
        
        logger.info(`RGA ${lagnname} - MGA level data (own team):`, mgaLevelData);
        
        // Fetch RGA-level data (RGA + all their MGAs)
        // This uses the RGA rollup to get all MGAs under them
        const rollupRes = await axios.get(`${API_BASE_URL}/mga-hierarchy/rga-rollup/${encodeURIComponent(lagnname)}`);
        
        if (rollupRes?.data?.success) {
          const mgas = rollupRes.data.data.mgas || [];
          const mgaLagnNames = mgas.map(m => m.lagnname).filter(Boolean);
          
          // Include RGA themselves in the list
          const allLagnNames = [lagnname, ...mgaLagnNames];
          
          logger.info(`RGA ${lagnname} - RGA level: ${lagnname} + ${mgaLagnNames.length} MGAs = ${allLagnNames.length} total`);
          
          // Build rollup info map
          const rollupInfo = {};
          mgas.forEach(mga => {
            rollupInfo[mga.lagnname] = {
              isFirstYear: mga.isFirstYear || false,
              rollupReason: mga.rollupReason,
              uplineMGA: mga.rga // The MGA they roll up to
            };
          });
          
          // Fetch data for each MGA individually (including RGA themselves) to build breakdown
          const fetchForMGA = async (mgaName) => {
            const enc = encodeURIComponent(mgaName);
            const [codesRes, hiresRes] = await Promise.all([
              axios.get(`${API_BASE_URL}/dataroutes/associates/multiple?value=${enc}`),
              axios.get(`${API_BASE_URL}/dataroutes/total-hires?value=${enc}`)
            ]);
            
            const codesArr = codesRes?.data?.data || [];
            const hiresArr = hiresRes?.data?.data || [];
            
            const codes = codesArr.filter((row) => {
              const d = row?.PRODDATE ? new Date(row.PRODDATE) : null;
              return d && d.getFullYear() === currentYear && d.getMonth() === currentMonth;
            }).length;
            
            const hires = Math.round(hiresArr.reduce((sum, row) => {
              const d = row?.MORE_Date ? new Date(row.MORE_Date) : null;
              if (d && d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
                return sum + (parseFloat(row?.Total_Hires) || 0);
              }
              return sum;
            }, 0));
            
            return { codes, hires };
          };
          
          // Fetch for all (RGA + MGAs)
          const allResults = await Promise.all(allLagnNames.map(fetchForMGA));
          
          // Get Potential VIPs data (IMPORTANT: This is how OneOnOne calculates VIPs!)
          let vipsByMGA = {};
          try {
            const ym = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`; // YYYY-MM
            const potRes = await axios.get(`${API_BASE_URL}/admin/potential-vips`, { params: { month: ym } });
            const potRows = potRes?.data?.data || [];
            
            // Initialize counts
            allLagnNames.forEach(name => {
              vipsByMGA[name] = 0;
            });
            
            // Count VIPs per MGA (totalLvl1Gross >= 5000)
            potRows.forEach(r => {
              const mgaName = String(r?.mga || '').toLowerCase();
              const matchedMGA = allLagnNames.find(n => String(n).toLowerCase() === mgaName);
              if (!matchedMGA) return;
              
              const gross = typeof r?.totalLvl1Gross === 'number' ? r.totalLvl1Gross : parseFloat(r?.totalLvl1Gross || 0);
              if (Number.isFinite(gross) && gross >= 5000) {
                vipsByMGA[matchedMGA] = (vipsByMGA[matchedMGA] || 0) + 1;
              }
            });
            
            logger.info(`RGA ${lagnname} - VIPs calculated from Potential VIPs`);
          } catch (e) {
            logger.warn('Potential VIPs fetch failed; VIPs will be 0', e);
            allLagnNames.forEach(name => {
              vipsByMGA[name] = 0;
            });
          }
          
          // Build breakdown with rollup information (excluding RGA themselves from breakdown table)
          rgaBreakdown = mgaLagnNames.map((mgaName, idx) => ({
            lagnname: mgaName,
            hires: allResults[idx + 1].hires, // +1 because RGA is at index 0
            codes: allResults[idx + 1].codes,
            vips: vipsByMGA[mgaName] || 0,
            isFirstYearRollup: rollupInfo[mgaName]?.isFirstYear || false,
            uplineMGA: rollupInfo[mgaName]?.uplineMGA || null,
            isSelf: false
          }));
          
          // Also add RGA themselves to breakdown
          rgaBreakdown.unshift({
            lagnname: lagnname,
            hires: allResults[0].hires,
            codes: allResults[0].codes,
            vips: vipsByMGA[lagnname] || 0,
            isFirstYearRollup: false,
            uplineMGA: null,
            isSelf: true
          });
          
          // Calculate RGA-level totals (RGA + all their MGAs)
          rgaLevelData.codes = allResults.reduce((sum, r) => sum + r.codes, 0);
          rgaLevelData.hires = allResults.reduce((sum, r) => sum + r.hires, 0);
          rgaLevelData.vips = Object.values(vipsByMGA).reduce((sum, v) => sum + v, 0);
          
          logger.info(`RGA ${lagnname} - RGA level data (full org):`, rgaLevelData);
        }
      } catch (error) {
        logger.error(`Error fetching RGA data for ${lagnname}:`, error);
      }
    }
    
    // 1. Count of associates (codes) this month - use API endpoints like OneOnOne for MGA/RGA
    let codesMTD = 0;
    if (isMGA || isRGA) {
      try {
        const codesRes = await axios.get(`${API_BASE_URL}/dataroutes/associates/multiple?value=${encodeURIComponent(lagnname)}`);
        const codesArr = codesRes?.data?.data || [];
        codesMTD = codesArr.filter((row) => {
          const d = row?.PRODDATE ? new Date(row.PRODDATE) : null;
          return d && d >= monthStart && d <= monthEnd;
        }).length;
        logger.info(`${clname} ${lagnname} - Codes MTD via API: ${codesMTD}`);
      } catch (error) {
        logger.error(`Error fetching codes for ${lagnname}:`, error);
        // Fallback to direct query
    const codesThisMonth = await db.query(`
      SELECT COUNT(*) as count
      FROM associates
      WHERE MGA = ?
      AND PRODDATE BETWEEN ? AND ?
    `, [lagnname, monthStart, monthEnd]);
        codesMTD = codesThisMonth[0]?.count || 0;
      }
    } else {
      // For SA/GA, use direct database query
      const codesThisMonth = await db.query(`
        SELECT COUNT(*) as count
        FROM associates
        WHERE MGA = ?
        AND PRODDATE BETWEEN ? AND ?
      `, [lagnname, monthStart, monthEnd]);
      codesMTD = codesThisMonth[0]?.count || 0;
    }

    // 2. Count of pending (not yet coded) from last 45 days - use MGA column
    const pendingCount = await db.query(`
      SELECT COUNT(*) as count
      FROM pending
      WHERE MGA = ?
      AND PendingDate >= ?
      AND LagnName NOT IN (SELECT LagnName FROM associates WHERE LagnName IS NOT NULL)
    `, [lagnname, fortyFiveDaysAgo]);

    const pendingNotCoded = pendingCount[0]?.count || 0;

    // 3. Hire to Code Ratio (YTD) - Only for MGA/RGA
    let hireToCodeRatio = 0;
    if (isMGA || isRGA) {
      hireToCodeRatio = await calculateHireToCodeRatio(lagnname, currentYear);
    }

    // 4. Hires MTD - Use API endpoints like OneOnOne for MGA/RGA
    let hiresMTDValue = 0;
    if (isMGA || isRGA) {
      try {
        const hiresRes = await axios.get(`${API_BASE_URL}/dataroutes/total-hires?value=${encodeURIComponent(lagnname)}`);
        const hiresArr = hiresRes?.data?.data || [];
        hiresMTDValue = Math.round(hiresArr.reduce((sum, row) => {
          const d = row?.MORE_Date ? new Date(row.MORE_Date) : null;
          if (d && d >= monthStart && d <= monthEnd) {
            const n = parseFloat(row?.Total_Hires) || 0;
            return sum + n;
          }
          return sum;
        }, 0));
        logger.info(`${clname} ${lagnname} - Hires MTD via API: ${hiresMTDValue}`);
      } catch (error) {
        logger.error(`Error fetching hires for ${lagnname}:`, error);
        // Fallback to direct query
      const hiresMTD = await db.query(`
        SELECT SUM(Total_Hires) as total
        FROM amore_data
        WHERE MGA = ?
        AND MORE_Date BETWEEN ? AND ?
      `, [lagnname, monthStart, monthEnd]);
      hiresMTDValue = Math.round(parseFloat(hiresMTD[0]?.total) || 0);
      }
    }

    // 5. Team ALP MTD and Personal Production
    // For RGAs, we need to handle multiple entities (NY and Main) that may have different reportdates
    // We want to get data from the most recent week, which might span different reportdates
    // Get the most recent report date first (reportdate is VARCHAR, so we need to convert for MAX)
    const maxReportDate = await db.query(`
      SELECT reportdate as maxDate
      FROM Weekly_ALP
      WHERE REPORT = 'MTD Recap'
      AND LagnName = ?
      ORDER BY STR_TO_DATE(reportdate, '%m/%d/%Y') DESC
      LIMIT 1
    `, [lagnname]);

    const latestReportDate = maxReportDate[0]?.maxDate;

    // For RGAs, we need to check for multiple report dates within the same week
    // Parse the latest report date to determine the week
    let alpData = [];
    if (isRGA && latestReportDate) {
      // Get reports from the last 3 days to capture both NY (Friday) and Main (Wednesday) reports
      const latestDate = new Date(latestReportDate);
      const weekStart = new Date(latestDate);
      weekStart.setDate(latestDate.getDate() - 3); // 3 days ago (inclusive of end date)
      
      // Get all rows for this RGA within the last 3 days (different entities may have different reportdates)
      // We'll sum their values
      alpData = await db.query(`
        SELECT LVL_3_NET, LVL_2_NET, LVL_1_NET, CL_Name, reportdate
        FROM Weekly_ALP
        WHERE REPORT = 'MTD Recap'
        AND LagnName = ?
        AND STR_TO_DATE(reportdate, '%m/%d/%Y') BETWEEN ? AND ?
        ORDER BY CASE WHEN CL_Name = 'MGA' THEN 1 ELSE 2 END, reportdate DESC
      `, [lagnname, weekStart, latestDate]);
    } else {
      // For non-RGAs or when no latest date, use the single latest report
      alpData = await db.query(`
        SELECT LVL_3_NET, LVL_2_NET, LVL_1_NET, CL_Name
        FROM Weekly_ALP
        WHERE REPORT = 'MTD Recap'
        AND LagnName = ?
        AND reportdate = ?
        ORDER BY CASE WHEN CL_Name = 'MGA' THEN 1 ELSE 2 END
      `, [lagnname, latestReportDate]);
    }

    let mgaTeamALP = 0;
    let rgaTeamALP = 0;
    let personalProduction = 0;

    // Helper function to parse currency values (handles both strings and numbers)
    const parseCurrency = (value) => {
      if (value === null || value === undefined) return 0;
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        return parseFloat(value.replace(/[$,()]/g, match => match === '(' ? '-' : '')) || 0;
      }
      return 0;
    };

    if (isRGA) {
      // For RGAs, sum across all entities (NY and Main)
      // MGA rows: CL_Name = 'MGA'
      // RGA rows: CL_Name != 'MGA' or null (these are the RGA-only numbers)
      const mgaRows = alpData.filter(row => row.CL_Name === 'MGA');
      const rgaRows = alpData.filter(row => !row.CL_Name || row.CL_Name !== 'MGA');

      // Sum MGA team values (may have multiple entities)
      mgaRows.forEach(row => {
        mgaTeamALP += parseCurrency(row.LVL_3_NET);
        personalProduction += parseCurrency(row.LVL_1_NET);
      });

      // Sum RGA team values (may have multiple entities - NY and Main)
      rgaRows.forEach(row => {
        rgaTeamALP += parseCurrency(row.LVL_3_NET);
      });
    } else if (isMGA) {
      // For MGAs, use LVL_3_NET
      const mgaRow = alpData.find(row => row.CL_Name === 'MGA');
      if (mgaRow) {
        mgaTeamALP = parseCurrency(mgaRow.LVL_3_NET);
        personalProduction = parseCurrency(mgaRow.LVL_1_NET);
      }
    } else if (isSA) {
      // For SAs, use LVL_2_NET for team production
      if (alpData[0]) {
        mgaTeamALP = parseCurrency(alpData[0].LVL_2_NET);
        personalProduction = parseCurrency(alpData[0].LVL_1_NET);
      }
    } else if (isGA) {
      // For GAs, use LVL_3_NET for team production
      if (alpData[0]) {
        mgaTeamALP = parseCurrency(alpData[0].LVL_3_NET);
        personalProduction = parseCurrency(alpData[0].LVL_1_NET);
      }
    }

    // 6. Associates from last month - use MGA column
    const associatesLastMonth = await db.query(`
      SELECT COUNT(*) as count
      FROM associates
      WHERE MGA = ?
      AND PRODDATE BETWEEN ? AND ?
    `, [lagnname, lastMonthStart, lastMonthEnd]);

    const codesLastMonth = associatesLastMonth[0]?.count || 0;

    // 7. VIPs from last month - use MGA column
    const vipsLastMonth = await db.query(`
      SELECT COUNT(*) as count
      FROM VIPs
      WHERE MGA = ?
      AND YEAR(vip_month) = ?
      AND MONTH(vip_month) = ?
    `, [lagnname, lastMonthStart.getFullYear(), lastMonthStart.getMonth() + 1]);

    const vipsLastMonthCount = vipsLastMonth[0]?.count || 0;

    // Get retention data from PnP table
    const retention = await getRetentionData(lagnname, isRGA);

    return {
      codesMTD,
      pendingNotCoded,
      hireToCodeRatio,
      hiresMTD: hiresMTDValue,
      mgaTeamALP,
      rgaTeamALP,
      personalProduction,
      codesLastMonth,
      vipsLastMonth: vipsLastMonthCount,
      isRGA,
      isSA,
      isGA,
      isMGA,
      clname,
      alpReportDate: latestReportDate || 'N/A',
      retention,
      // RGA-specific: MGA-level and RGA-level data (like OneOnOne tabs)
      mgaLevelData,
      rgaLevelData,
      // RGA breakdown: detailed per-MGA data with rollup indicators
      rgaBreakdown
    };
  } catch (error) {
    logger.error(`Error generating weekly report for ${lagnname}:`, error);
    throw error;
  }
}

/**
 * Extract first name from user data and format it properly
 * If screenName exists (format: "First Last"), use first word
 * Otherwise parse lagnname (format: "Last First Middle Suffix") and use second word
 * Formatting: Capitalize first letter, lowercase rest (except 2-letter names stay uppercase)
 */
function getFirstName(user) {
  let firstName = '';
  
  // Try screenName first (format: "First Last")
  if (user.screenName && user.screenName.trim()) {
    const parts = user.screenName.trim().split(/\s+/);
    firstName = parts[0]; // First word is the first name
  }
  // Fall back to lagnname (format: "Last First Middle Suffix")
  else if (user.lagnname && user.lagnname.trim()) {
    const parts = user.lagnname.trim().split(/\s+/);
    if (parts.length >= 2) {
      firstName = parts[1]; // Second word is the first name
    } else {
      firstName = user.lagnname;
    }
  }
  // Ultimate fallback
  else {
    firstName = user.lagnname || 'there';
  }
  
  // Format the name: 2-letter names stay uppercase, others get title case
  if (firstName.length === 2) {
    return firstName.toUpperCase(); // Keep 2-letter names like "JR" uppercase
  } else if (firstName.length > 0) {
    return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  }
  
  return firstName;
}

/**
 * Format the email HTML
 */
function formatWeeklyReportEmail(user, data) {
  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

  const now = new Date();
  const monthName = now.toLocaleString('en-US', { month: 'long' });
  const year = now.getFullYear();
  
  // Format the ALP report date
  const alpDateFormatted = data.alpReportDate 
    ? new Date(data.alpReportDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'N/A';

  // Get user's first name for greeting
  const firstName = getFirstName(user);

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
    h2 { color: #34495e; margin-top: 25px; border-bottom: 2px solid #95a5a6; padding-bottom: 8px; margin-bottom: 5px; }
    .subtitle { color: #777; font-size: 13px; font-style: italic; margin: 0 0 15px 0; }
    .metric { background: #f8f9fa; padding: 15px; margin: 10px 0; border-left: 4px solid #3498db; border-radius: 4px; }
    .metric-label { font-weight: bold; color: #555; font-size: 14px; }
    .metric-value { font-size: 24px; color: #2c3e50; font-weight: bold; margin-top: 5px; }
    .highlight { background: #e8f5e9; border-left-color: #4caf50; }
    .warning { background: #fff3e0; border-left-color: #ff9800; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Weekly Production Report</h1>
    <p>Hello ${firstName},</p>
    <p>Here's your weekly production summary for <strong>${monthName} ${year}</strong>:</p>

    ${data.isRGA ? `
    <h2>📊 MGA Level Performance</h2>
    <p class="subtitle">Your personal MGA team</p>
    
    <div class="metric highlight">
      <div class="metric-label">Codes MTD</div>
      <div class="metric-value">${data.mgaLevelData.codes}</div>
    </div>
    
    <div class="metric">
      <div class="metric-label">Hires MTD</div>
      <div class="metric-value">${Math.round(data.mgaLevelData.hires)}</div>
    </div>
    
    <div class="metric">
      <div class="metric-label">VIPs MTD</div>
      <div class="metric-value">${data.mgaLevelData.vips}</div>
    </div>

    <div class="metric">
      <div class="metric-label">Hire to Code Ratio (YTD)</div>
      <div class="metric-value">${data.hireToCodeRatio.toFixed(2)}</div>
    </div>

    <h3 style="margin-top: 20px; color: #34495e; border-bottom: 1px solid #95a5a6; padding-bottom: 5px;">💰 Production Summary</h3>
    <p class="subtitle">As of ${alpDateFormatted}</p>
    
    <div class="metric">
      <div class="metric-label">MGA Team ALP MTD</div>
      <div class="metric-value">${currencyFormatter.format(data.mgaTeamALP)}</div>
    </div>

    <div class="metric">
      <div class="metric-label">Personal Production MTD</div>
      <div class="metric-value">${currencyFormatter.format(data.personalProduction)}</div>
    </div>

    <h3 style="margin-top: 20px; color: #34495e; border-bottom: 1px solid #95a5a6; padding-bottom: 5px;">📈 Previous Month</h3>
    
    <div class="metric">
      <div class="metric-label">Codes Last Month</div>
      <div class="metric-value">${data.codesLastMonth}</div>
    </div>

    <div class="metric">
      <div class="metric-label">VIPs Last Month</div>
      <div class="metric-value">${data.vipsLastMonth}</div>
    </div>
    
    <h2>📊 RGA Level Performance</h2>
    <p class="subtitle">Your full organization</p>
    
    <div class="metric highlight">
      <div class="metric-label">Codes MTD</div>
      <div class="metric-value">${data.rgaLevelData.codes}</div>
    </div>
    
    <div class="metric ${data.pendingNotCoded > 0 ? 'warning' : ''}">
      <div class="metric-label">Pending - Last 45 Days</div>
      <div class="metric-value">${data.pendingNotCoded}</div>
    </div>
    
    <div class="metric">
      <div class="metric-label">Hires MTD</div>
      <div class="metric-value">${Math.round(data.rgaLevelData.hires)}</div>
    </div>

    <div class="metric">
      <div class="metric-label">VIPs MTD</div>
      <div class="metric-value">${data.rgaLevelData.vips}</div>
    </div>

    <div class="metric">
      <div class="metric-label">RGA Team ALP MTD</div>
      <div class="metric-value">${currencyFormatter.format(data.rgaTeamALP)}</div>
    </div>
    
    ${data.rgaBreakdown && data.rgaBreakdown.length > 0 ? `
    <h3 style="margin-top: 20px; color: #34495e; border-bottom: 1px solid #95a5a6; padding-bottom: 5px;">
      Organization Breakdown 
    </h3>
    <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px;">
      <thead>
        <tr style="background: #ecf0f1; border-bottom: 2px solid #95a5a6;">
          <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">MGA</th>
          <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">Hires</th>
          <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">Codes</th>
          <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">VIPs</th>
        </tr>
      </thead>
      <tbody>
        ${(() => {
          // Group by upline for hierarchical display
          const grouped = {};
          const selfRows = [];
          const directMGAs = [];
          
          data.rgaBreakdown.forEach(row => {
            if (row.isSelf) {
              selfRows.push(row);
            } else if (row.isFirstYearRollup && row.uplineMGA) {
              if (!grouped[row.uplineMGA]) {
                grouped[row.uplineMGA] = [];
              }
              grouped[row.uplineMGA].push(row);
            } else {
              directMGAs.push(row);
            }
          });
          
          // Sort direct MGAs by total
          directMGAs.sort((a, b) => {
            const totalA = a.hires + a.codes + a.vips;
            const totalB = b.hires + b.codes + b.vips;
            return totalB - totalA;
          });
          
          let html = '';
          let rowIndex = 0;
          
          // Add self first
          selfRows.forEach(row => {
            const bgColor = rowIndex % 2 === 0 ? '#ffffff' : '#f8f9fa';
            html += `
              <tr style="background: ${bgColor}; border-bottom: 1px solid #eee;">
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: 600;">${row.lagnname} (You)</td>
                <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${row.hires}</td>
                <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${row.codes}</td>
                <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${row.vips}</td>
              </tr>
            `;
            rowIndex++;
          });
          
          // Add direct MGAs and their rollups
          directMGAs.forEach(mga => {
            const bgColor = rowIndex % 2 === 0 ? '#ffffff' : '#f8f9fa';
            html += `
              <tr style="background: ${bgColor}; border-bottom: 1px solid #eee;">
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: 500;">${mga.lagnname}</td>
                <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${mga.hires}</td>
                <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${mga.codes}</td>
                <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${mga.vips}</td>
              </tr>
            `;
            rowIndex++;
            
            // Add rollups under this MGA
            const rollups = grouped[mga.lagnname] || [];
            rollups.forEach(rollup => {
              const bgColor = rowIndex % 2 === 0 ? '#ffffff' : '#f8f9fa';
              html += `
                <tr style="background: ${bgColor}; border-bottom: 1px solid #eee;">
                  <td style="padding: 8px 8px 8px 24px; border: 1px solid #ddd; font-style: italic; color: #666;">↳ ${rollup.lagnname}*</td>
                  <td style="padding: 8px; text-align: right; border: 1px solid #ddd; color: #666;">${rollup.hires}</td>
                  <td style="padding: 8px; text-align: right; border: 1px solid #ddd; color: #666;">${rollup.codes}</td>
                  <td style="padding: 8px; text-align: right; border: 1px solid #ddd; color: #666;">${rollup.vips}</td>
                </tr>
              `;
              rowIndex++;
            });
          });
          
          // Total row
          const totalHires = data.rgaBreakdown.reduce((sum, r) => sum + r.hires, 0);
          const totalCodes = data.rgaBreakdown.reduce((sum, r) => sum + r.codes, 0);
          const totalVips = data.rgaBreakdown.reduce((sum, r) => sum + r.vips, 0);
          
          html += `
            <tr style="background: #e8f5e9; border-top: 2px solid #4caf50; font-weight: bold;">
              <td style="padding: 8px; border: 1px solid #ddd;">TOTAL</td>
              <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${totalHires}</td>
              <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${totalCodes}</td>
              <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${totalVips}</td>
            </tr>
          `;
          
          return html;
        })()}
      </tbody>
    </table>
    ${data.rgaBreakdown.some(row => row.isFirstYearRollup) ? `
      <p style="margin-top: 10px; font-size: 12px; color: #666; font-style: italic;">
        * First-year MGA rolling up to their upline
      </p>
    ` : ''}
    ` : ''}
    ` : `
    <h2>📊 Current Month Performance</h2>
    
    <div class="metric highlight">
      <div class="metric-label">Codes MTD</div>
      <div class="metric-value">${data.codesMTD}</div>
    </div>

    <div class="metric ${data.pendingNotCoded > 0 ? 'warning' : ''}">
      <div class="metric-label">Pending - Last 45 Days</div>
      <div class="metric-value">${data.pendingNotCoded}</div>
    </div>

    ${(data.isMGA) ? `
    <div class="metric">
      <div class="metric-label">Hires MTD</div>
      <div class="metric-value">${Math.round(data.hiresMTD)}</div>
    </div>

    <div class="metric">
      <div class="metric-label">Hire to Code Ratio (YTD)</div>
      <div class="metric-value">${data.hireToCodeRatio.toFixed(2)}</div>
    </div>
    ` : ''}
    `}

    ${!data.isRGA ? `
    <h2>💰 Production Summary</h2>
    <p class="subtitle">As of ${alpDateFormatted}</p>
    
    <div class="metric">
      <div class="metric-label">${data.isSA ? 'SA' : data.isGA ? 'GA' : 'MGA'} Team ALP MTD</div>
      <div class="metric-value">${currencyFormatter.format(data.mgaTeamALP)}</div>
    </div>

    <div class="metric">
      <div class="metric-label">Personal Production MTD</div>
      <div class="metric-value">${currencyFormatter.format(data.personalProduction)}</div>
    </div>

    <h2>📈 Previous Month</h2>
    
    <div class="metric">
      <div class="metric-label">Codes Last Month</div>
      <div class="metric-value">${data.codesLastMonth}</div>
    </div>

    <div class="metric">
      <div class="metric-label">VIPs Last Month</div>
      <div class="metric-value">${data.vipsLastMonth}</div>
    </div>
    ` : ''}

    <h2>🎯 Retention</h2>
    <p class="subtitle">As of ${data.retention.lvl1?.date || data.retention.lvl2?.date || data.retention.lvl3?.date || 'N/A'}</p>
    
    ${(() => {
      // Helper functions for formatting
      const fmtNum = (v) => {
        if (v === null || v === undefined || v === '' || v === 'N/A') return '—';
        const n = parseFloat(String(v).toString().replace(/[^0-9.-]/g, ''));
        return Number.isFinite(n) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n) : '—';
      };
      
      const fmtPct = (v) => {
        if (v === null || v === undefined || v === '' || v === 'N/A') return '—';
        const s = String(v).trim();
        return s.endsWith('%') ? s : (s ? `${s}%` : '—');
      };
      
      // Build retention table
      let html = '<table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px;">';
      html += '<thead><tr style="background: #ecf0f1; border-bottom: 2px solid #95a5a6;">';
      
      // For AGT users, don't show the Level column
      if (data.clname !== 'AGT') {
        html += '<th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Level</th>';
      }
      
      html += `
        <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">Curr Mo Net Submit</th>
        <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">YTD Life Net Submit</th>
        <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">First 6 Mo Net Submit</th>
        <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">First 6 YTD Net</th>
        <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">Curr Mo 4Mo Rate</th>
        <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">Proj +1 4Mo Rate</th>
        <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">Proj +2 4Mo Rate</th>
      </tr></thead>
      <tbody>`;
      
      // Determine which rows to show based on user role
      const baseKeys = data.clname === 'AGT' ? ['lvl1']
                     : data.clname === 'SA' ? ['lvl1', 'lvl2']
                     : data.isRGA ? [] // RGA has special handling below
                     : ['lvl1', 'lvl2', 'lvl3'];
      
      // Show base level rows (for non-RGA users)
      baseKeys.forEach(k => {
        const row = data.retention[k] || {};
        const label = k === 'lvl1' ? 'LVL 1 (-1)' : k === 'lvl2' ? 'LVL 2 (-2)' : 'LVL 3 (-3)';
        html += '<tr style="border-bottom: 1px solid #eee;">';
        
        if (data.clname !== 'AGT') {
          html += `<td style="padding: 8px; border: 1px solid #ddd;">${label}</td>`;
        }
        
        html += `
          <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${fmtNum(row.curr_mo_net_submit)}</td>
          <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${fmtNum(row.cur_ytd_life_net_submit)}</td>
          <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${fmtNum(row.first_6_mo_net_submit)}</td>
          <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${fmtNum(row.first_6_ytd_net)}</td>
          <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${fmtPct(row.curr_mo_4mo_rate)}</td>
          <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${fmtPct(row.proj_plus_1_4mo_rate)}</td>
          <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${fmtPct(row.proj_plus_2_4mo_rate)}</td>
        </tr>`;
      });
      
      // RGA users: Special handling like OneOnOne.js
      if (data.isRGA && data.retention.rgaAll && data.retention.rgaAll.length > 0) {
      const getSuffix = (agentNum) => String(agentNum || '').split('-').pop();
      const lvl3Rows = data.retention.rgaAll.filter(r => getSuffix(r.agent_num) === '3');
      
        // Calculate LVL 3 Total (sum of all lvl3 rows, no 4mo rates)
        if (lvl3Rows.length > 0) {
          const parseNum = (v) => {
            const n = parseFloat(String(v || '').replace(/[^0-9.-]/g, ''));
            return Number.isFinite(n) ? n : 0;
          };
          
          const total = {
            curr_mo_net_submit: lvl3Rows.reduce((s, r) => s + parseNum(r.curr_mo_net_submit), 0),
            cur_ytd_life_net_submit: lvl3Rows.reduce((s, r) => s + parseNum(r.cur_ytd_life_net_submit), 0),
            first_6_mo_net_submit: lvl3Rows.reduce((s, r) => s + parseNum(r.first_6_mo_net_submit), 0),
            first_6_ytd_net: lvl3Rows.reduce((s, r) => s + parseNum(r.first_6_ytd_net), 0)
          };
          
          html += `
            <tr style="background: #e8f5e9; border-bottom: 1px solid #eee; font-weight: bold;">
              <td style="padding: 8px; border: 1px solid #ddd;">LVL 3 (RGA Total)</td>
              <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${fmtNum(total.curr_mo_net_submit)}</td>
              <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${fmtNum(total.cur_ytd_life_net_submit)}</td>
              <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${fmtNum(total.first_6_mo_net_submit)}</td>
              <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${fmtNum(total.first_6_ytd_net)}</td>
              <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">—</td>
              <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">—</td>
              <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">—</td>
            </tr>`;
        }
        
        // Show individual rows with MGA/RGA labels
        data.retention.rgaAll.forEach(row => {
          const suffix = (row.agent_num || '').split('-').pop();
          const baseFrom = String(data.retention.lvl1?.agent_num || data.retention.lvl2?.agent_num || '').split('-')[0];
          const baseThis = String(row.agent_num || '').split('-')[0];
          const isLvl3 = suffix === '3';
          const labelAddon = isLvl3 ? (baseFrom && baseThis === baseFrom ? ' (MGA)' : ' (RGA w/o MGA)') : '';
          const label = `LVL ${suffix || '?'}${labelAddon}`;
          
          html += `
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 8px; border: 1px solid #ddd;">${label}</td>
              <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${fmtNum(row.curr_mo_net_submit)}</td>
              <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${fmtNum(row.cur_ytd_life_net_submit)}</td>
              <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${fmtNum(row.first_6_mo_net_submit)}</td>
              <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${fmtNum(row.first_6_ytd_net)}</td>
              <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${fmtPct(row.curr_mo_4mo_rate)}</td>
              <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${fmtPct(row.proj_plus_1_4mo_rate)}</td>
              <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${fmtPct(row.proj_plus_2_4mo_rate)}</td>
            </tr>`;
        });
      }
      
      html += '</tbody></table>';
      
      // Show "No data" message if no retention data exists
      if (!data.retention.lvl1 && !data.retention.lvl2 && !data.retention.lvl3 && 
          (!data.retention.rgaAll || data.retention.rgaAll.length === 0)) {
        html = '<div class="metric"><div class="metric-label">No retention data available</div><div class="metric-value">—</div></div>';
      }
      
      return html;
    })()}

    <div class="footer">
      <p>This is an automated weekly report from Atlas. If you have questions about your data, please contact your manager.</p>
      <p><em>Report generated on ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</em></p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Format the summary email HTML for admin reporting
 */
function formatSummaryEmail(countsByClname, successCount, failCount, totalRecipients) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
    h2 { color: #34495e; margin-top: 25px; border-bottom: 2px solid #95a5a6; padding-bottom: 8px; }
    .summary-box { background: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 4px; border-left: 4px solid #3498db; }
    .summary-label { font-weight: bold; color: #555; font-size: 14px; }
    .summary-value { font-size: 20px; color: #2c3e50; font-weight: bold; margin-top: 5px; }
    .success { color: #4caf50; }
    .fail { color: #f44336; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #ecf0f1; padding: 12px; text-align: left; border: 1px solid #ddd; font-weight: bold; }
    td { padding: 10px; border: 1px solid #ddd; }
    tr:nth-child(even) { background: #f8f9fa; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Weekly Report Summary</h1>
    <p><strong>${dateStr}</strong></p>
    
    <div class="summary-box">
      <div class="summary-label">Total Recipients</div>
      <div class="summary-value">${totalRecipients}</div>
    </div>
    
    <div class="summary-box">
      <div class="summary-label">Successfully Sent</div>
      <div class="summary-value success">✅ ${successCount}</div>
    </div>
    
    ${failCount > 0 ? `
    <div class="summary-box" style="border-left-color: #f44336;">
      <div class="summary-label">Failed to Send</div>
      <div class="summary-value fail">❌ ${failCount}</div>
    </div>
    ` : ''}
    
    <h2>Breakdown by Role</h2>
    
    <table>
      <thead>
        <tr>
          <th>Role</th>
          <th style="text-align: center;">Success</th>
          <th style="text-align: center;">Failed</th>
          <th style="text-align: center;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(countsByClname).map(([clname, counts]) => {
          const total = counts.success + counts.fail;
          if (total === 0) return ''; // Skip roles with no users
          return `
            <tr>
              <td><strong>${clname}</strong></td>
              <td style="text-align: center;" class="success">${counts.success}</td>
              <td style="text-align: center;" class="fail">${counts.fail}</td>
              <td style="text-align: center;"><strong>${total}</strong></td>
            </tr>
          `;
        }).join('')}
        <tr style="background: #e8f5e9; font-weight: bold;">
          <td>TOTAL</td>
          <td style="text-align: center;" class="success">${successCount}</td>
          <td style="text-align: center;" class="fail">${failCount}</td>
          <td style="text-align: center;">${totalRecipients}</td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      <p>This is an automated summary from Atlas Weekly Report System.</p>
      <p><em>Report generated at ${now.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</em></p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Send weekly reports to all MGAs and RGAs
 */
async function sendWeeklyReports() {
  try {
    logger.info('Starting weekly report email job...');

    // Get all active MGAs, RGAs, SAs, and GAs with valid emails
    // Only send to users where both Active and managerActive are 'y'
    const recipients = await db.query(`
      SELECT id, lagnname, email, clname, screenName
      FROM activeusers
      WHERE Active = 'y'
      AND (managerActive = 'y' OR managerActive IS NULL)
      AND (clname = 'MGA' OR clname = 'RGA' OR clname = 'SA' OR clname = 'GA')
      AND email IS NOT NULL
      AND email != ''
      ORDER BY clname, lagnname
    `);

    logger.info(`Found ${recipients.length} recipients for weekly reports`);

    let successCount = 0;
    let failCount = 0;
    
    // Track counts by clname for summary report
    const countsByClname = {
      MGA: { success: 0, fail: 0 },
      RGA: { success: 0, fail: 0 },
      SA: { success: 0, fail: 0 },
      GA: { success: 0, fail: 0 }
    };

    for (const user of recipients) {
      try {
        logger.info(`Generating report for ${user.lagnname} (${user.clname})...`);

        // Generate report data
        const reportData = await generateWeeklyReport(user);

        // Format email
        const emailHtml = formatWeeklyReportEmail(user, reportData);
        const subject = `Weekly Production Report - ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

        // Send email
        await emailService.sendEmail(user.email, subject, emailHtml);

        successCount++;
        countsByClname[user.clname].success++;
        logger.info(`✅ Report sent to ${user.lagnname} at ${user.email}`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        failCount++;
        countsByClname[user.clname].fail++;
        logger.error(`❌ Failed to send report to ${user.lagnname}:`, error);
      }
    }

    logger.info(`Weekly reports completed: ${successCount} sent, ${failCount} failed`);
    
    // Send summary email to kvanbibber@ariasagencies.com
    try {
      const summaryHtml = formatSummaryEmail(countsByClname, successCount, failCount, recipients.length);
      const summarySubject = `Weekly Report Summary - ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
      await emailService.sendEmail('kvanbibber@ariasagencies.com', summarySubject, summaryHtml);
      logger.info('✅ Summary email sent to kvanbibber@ariasagencies.com');
    } catch (error) {
      logger.error('❌ Failed to send summary email:', error);
    }
    
    return { successCount, failCount, total: recipients.length, countsByClname };
  } catch (error) {
    logger.error('Error in sendWeeklyReports:', error);
    throw error;
  }
}

module.exports = {
  sendWeeklyReports,
  generateWeeklyReport,
  formatWeeklyReportEmail
};

