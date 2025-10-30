import React from 'react';
import '../../pages/abc.css';

const YTDSummaryWidget = ({
  currentYear,
  lastYear,
  alpData,
  hiresData,
  associatesData,
  vipsData,
  mgaStartDate,
  groupByMonthAndYear,
  visibleColumns = ['alp', 'hires', 'codes', 'vips', 'hireCode', 'alpCode', 'codeVip'] // Default: show all columns
}) => {
  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const today = new Date();
  const isCurrentYear = currentYear === today.getFullYear();
  const monthsToConsiderForHires = Math.max(1, today.getMonth() + 1); // Include current month for hires
  const monthsToConsiderForOthers = Math.max(0, today.getMonth()); // Exclude current month for others

  // Helper to check if month is excluded due to MGA start date
  const isMonthExcluded = (year, monthIndex) => {
    if (!mgaStartDate || !year) return false;
    const monthEndDate = new Date(year, monthIndex + 1, 0);
    return monthEndDate < mgaStartDate;
  };

  // Calculate YTD values for ALP
  const prevAlpMonthly = alpData[lastYear] || Array(12).fill(0);
  const currAlpMonthly = alpData[currentYear] || Array(12).fill(0);
  
  let prevAlpYTD = 0, currAlpYTD = 0;
  for (let i = 0; i < (isCurrentYear ? monthsToConsiderForOthers : 12); i++) {
    if (!isMonthExcluded(lastYear, i)) prevAlpYTD += prevAlpMonthly[i] || 0;
    if (!isMonthExcluded(currentYear, i)) currAlpYTD += currAlpMonthly[i] || 0;
  }

  // Calculate YTD values for Hires (includes current month)
  const prevHireMonthly = hiresData[lastYear] || Array(12).fill(0);
  const currHireMonthly = hiresData[currentYear] || Array(12).fill(0);
  
  let prevHiresYTD = 0, currHiresYTD = 0;
  for (let i = 0; i < 12; i++) {
    if (!isMonthExcluded(lastYear, i)) prevHiresYTD += prevHireMonthly[i] || 0;
  }
  for (let i = 0; i < (isCurrentYear ? monthsToConsiderForHires : 12); i++) {
    if (!isMonthExcluded(currentYear, i)) currHiresYTD += currHireMonthly[i] || 0;
  }

  // Calculate YTD values for Codes
  const codesGrouped = groupByMonthAndYear(associatesData, "PRODDATE");
  const prevCodeMonthly = codesGrouped[lastYear] || Array(12).fill(0);
  const currCodeMonthly = codesGrouped[currentYear] || Array(12).fill(0);
  
  let prevCodesYTD = 0, currCodesYTD = 0;
  for (let i = 0; i < (isCurrentYear ? monthsToConsiderForOthers : 12); i++) {
    if (!isMonthExcluded(lastYear, i)) prevCodesYTD += prevCodeMonthly[i] || 0;
    if (!isMonthExcluded(currentYear, i)) currCodesYTD += currCodeMonthly[i] || 0;
  }

  // Calculate YTD values for VIPs
  const vipsGrouped = groupByMonthAndYear(vipsData, "vip_month");
  const prevVipMonthly = vipsGrouped[lastYear] || Array(12).fill(0);
  const currVipMonthly = vipsGrouped[currentYear] || Array(12).fill(0);
  
  let prevVipsYTD = 0, currVipsYTD = 0;
  for (let i = 0; i < (isCurrentYear ? monthsToConsiderForOthers : 12); i++) {
    if (!isMonthExcluded(lastYear, i)) prevVipsYTD += prevVipMonthly[i] || 0;
    if (!isMonthExcluded(currentYear, i)) currVipsYTD += currVipMonthly[i] || 0;
  }

  // Calculate ratio YTDs
  const prevHireToCode = prevCodesYTD > 0 ? prevHiresYTD / prevCodesYTD : 0;
  const currHireToCode = currCodesYTD > 0 ? currHiresYTD / currCodesYTD : 0;

  const prevAlpCode = prevCodesYTD > 0 ? prevAlpYTD / prevCodesYTD : 0;
  const currAlpCode = currCodesYTD > 0 ? currAlpYTD / currCodesYTD : 0;

  const prevCodeVip = prevVipsYTD > 0 ? prevCodesYTD / prevVipsYTD : 0;
  const currCodeVip = currVipsYTD > 0 ? currCodesYTD / currVipsYTD : 0;

  // Calculate growth
  const alpGrowth = currAlpYTD - prevAlpYTD;
  const hiresGrowth = currHiresYTD - prevHiresYTD;
  const codesGrowth = currCodesYTD - prevCodesYTD;
  const vipsGrowth = currVipsYTD - prevVipsYTD;
  const hireToCodeGrowth = currHireToCode - prevHireToCode;
  const alpCodeGrowth = currAlpCode - prevAlpCode;
  const codeVipGrowth = currCodeVip - prevCodeVip;

  const ratioFormatter = (num) => Number(num).toFixed(2);

  return (
    <div className="atlas-scorecard-section">
      <h5>YTD Summary</h5>
      <div style={{ overflowX: "auto" }}>
        <div className="atlas-scorecard-custom-table-container">
          <table className="atlas-scorecard-custom-table">
            <thead>
              <tr>
                <th>Year</th>
                {visibleColumns.includes('alp') && <th>ALP</th>}
                {visibleColumns.includes('hires') && <th>Hires</th>}
                {visibleColumns.includes('codes') && <th>Codes</th>}
                {visibleColumns.includes('vips') && <th>VIPs</th>}
                {visibleColumns.includes('hireCode') && <th>Hire/Code</th>}
                {visibleColumns.includes('alpCode') && <th>ALP/Code</th>}
                {visibleColumns.includes('codeVip') && <th>Code/VIP</th>}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{lastYear}</td>
                {visibleColumns.includes('alp') && <td>{currencyFormatter.format(prevAlpYTD)}</td>}
                {visibleColumns.includes('hires') && <td>{prevHiresYTD}</td>}
                {visibleColumns.includes('codes') && <td>{prevCodesYTD}</td>}
                {visibleColumns.includes('vips') && <td>{prevVipsYTD}</td>}
                {visibleColumns.includes('hireCode') && <td>{ratioFormatter(prevHireToCode)}</td>}
                {visibleColumns.includes('alpCode') && <td>{ratioFormatter(prevAlpCode)}</td>}
                {visibleColumns.includes('codeVip') && <td>{ratioFormatter(prevCodeVip)}</td>}
              </tr>
              <tr>
                <td>{currentYear}</td>
                {visibleColumns.includes('alp') && <td>{currencyFormatter.format(currAlpYTD)}</td>}
                {visibleColumns.includes('hires') && <td>{currHiresYTD}</td>}
                {visibleColumns.includes('codes') && <td>{currCodesYTD}</td>}
                {visibleColumns.includes('vips') && <td>{currVipsYTD}</td>}
                {visibleColumns.includes('hireCode') && <td>{ratioFormatter(currHireToCode)}</td>}
                {visibleColumns.includes('alpCode') && <td>{ratioFormatter(currAlpCode)}</td>}
                {visibleColumns.includes('codeVip') && <td>{ratioFormatter(currCodeVip)}</td>}
              </tr>
              <tr className="atlas-scorecard-growth-row">
                <td>Growth</td>
                {visibleColumns.includes('alp') && (
                  <td className={alpGrowth > 0 ? "growth-positive" : alpGrowth < 0 ? "growth-negative" : ""}>
                    {currencyFormatter.format(alpGrowth)}
                  </td>
                )}
                {visibleColumns.includes('hires') && (
                  <td className={hiresGrowth > 0 ? "growth-positive" : hiresGrowth < 0 ? "growth-negative" : ""}>
                    {hiresGrowth}
                  </td>
                )}
                {visibleColumns.includes('codes') && (
                  <td className={codesGrowth > 0 ? "growth-positive" : codesGrowth < 0 ? "growth-negative" : ""}>
                    {codesGrowth}
                  </td>
                )}
                {visibleColumns.includes('vips') && (
                  <td className={vipsGrowth > 0 ? "growth-positive" : vipsGrowth < 0 ? "growth-negative" : ""}>
                    {vipsGrowth}
                  </td>
                )}
                {visibleColumns.includes('hireCode') && (
                  <td className={hireToCodeGrowth < 0 ? "growth-positive" : hireToCodeGrowth > 0 ? "growth-negative" : ""}>
                    {ratioFormatter(Math.abs(hireToCodeGrowth))}
                  </td>
                )}
                {visibleColumns.includes('alpCode') && (
                  <td className={alpCodeGrowth > 0 ? "growth-positive" : alpCodeGrowth < 0 ? "growth-negative" : ""}>
                    {ratioFormatter(Math.abs(alpCodeGrowth))}
                  </td>
                )}
                {visibleColumns.includes('codeVip') && (
                  <td className={codeVipGrowth < 0 ? "growth-positive" : codeVipGrowth > 0 ? "growth-negative" : ""}>
                    {ratioFormatter(Math.abs(codeVipGrowth))}
                  </td>
                )}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <hr />
    </div>
  );
};

export default YTDSummaryWidget;

