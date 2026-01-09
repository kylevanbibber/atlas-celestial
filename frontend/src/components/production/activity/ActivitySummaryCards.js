import React from 'react';
import './ActivitySummaryCards.css';

const ActivitySummaryCards = ({ data = [] }) => {
  // SVG circle calculations for donut charts
  const circleRadius = 15.915;
  const circumference = 2 * Math.PI * circleRadius;

  const calculateStrokeDasharray = (percentage) => {
    const filled = (percentage / 100) * circumference;
    return `${filled} ${circumference}`;
  };
  // Calculate totals from the data
  const totals = data.reduce((acc, row) => {
    // Skip rows that should be excluded from totals (like expanded MGA rows)
    if (row._excludeFromTotals) return acc;
    
    return {
      calls: acc.calls + (parseFloat(row.calls) || 0),
      appts: acc.appts + (parseFloat(row.appts) || 0),
      sits: acc.sits + (parseFloat(row.sits) || 0),
      sales: acc.sales + (parseFloat(row.sales) || 0),
      alp: acc.alp + (parseFloat(row.alp) || 0),
      refs: acc.refs + (parseFloat(row.refs) || 0),
      refAppt: acc.refAppt + (parseFloat(row.refAppt) || 0),
      refSit: acc.refSit + (parseFloat(row.refSit) || 0),
      refSale: acc.refSale + (parseFloat(row.refSale) || 0),
      refAlp: acc.refAlp + (parseFloat(row.refAlp) || 0)
    };
  }, {
    calls: 0,
    appts: 0,
    sits: 0,
    sales: 0,
    alp: 0,
    refs: 0,
    refAppt: 0,
    refSit: 0,
    refSale: 0,
    refAlp: 0
  });

  // Calculate ratios - matching old ActivityCards logic
  const callsToSet = totals.appts > 0 ? Math.round(totals.calls / totals.appts) : 0; // Whole number
  const showRatio = totals.appts > 0 ? ((totals.sits / totals.appts) * 100).toFixed(0) : '0'; // Percentage
  const refsPerSit = totals.sits > 0 ? (totals.refs / totals.sits).toFixed(2) : '0.00'; // Decimal number
  const refSitPercent = totals.refs > 0 ? ((totals.refSit / totals.refs) * 100).toFixed(0) : '0'; // Percentage (refSit/refs)
  const closeRatio = totals.sits > 0 ? ((totals.sales / totals.sits) * 100).toFixed(0) : '0'; // Percentage
  const alpPerSit = totals.sits > 0 ? Math.round(totals.alp / totals.sits) : 0; // Dollar amount (rounded)
  const refCloseRatio = totals.refSit > 0 ? ((totals.refSale / totals.refSit) * 100).toFixed(0) : '0'; // Percentage
  const alpPerRefSale = totals.refSale > 0 ? Math.round(totals.refAlp / totals.refSale) : 0; // Dollar amount (rounded)

  return (
    <div className="activity-summary-wrapper">
      <h3 className="activity-summary-header">Activity</h3>
      
      {/* Top ALP Cards */}
      <div className="activity-alp-cards">
        <div className="activity-alp-card">
          <div className="activity-alp-card-title">ALP</div>
          <div className="activity-alp-card-value">${Math.round(totals.alp).toLocaleString()}</div>
        </div>
        <div className="activity-alp-card">
          <div className="activity-alp-card-title">Ref ALP</div>
          <div className="activity-alp-card-value">${totals.refAlp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      </div>

      {/* Activity Metric Cards Grid */}
      <div className="activity-metric-cards-grid">
        {/* Row 1 */}
        <div className="activity-metric-card">
          <div className="activity-metric-card-content">
            <div className="activity-metric-card-title">Calls</div>
            <div className="activity-metric-card-value">{totals.calls.toLocaleString()}</div>
          </div>
          <div className="activity-donut-container">
            <svg viewBox="0 0 36 36" className="activity-donut-chart">
              <circle className="donut-ring" cx="18" cy="18" r="15.915" fill="transparent" stroke="#e0e0e0" strokeWidth="3" />
              <circle className="donut-segment" cx="18" cy="18" r="15.915" fill="transparent" stroke="#00558c" strokeWidth="3"
                strokeDasharray={calculateStrokeDasharray(Math.min((callsToSet / 100) * 100, 100))}
                strokeDashoffset="0"
              />
              <text x="18" y="18" textAnchor="middle" fontSize="7" fill="#333">
                {callsToSet}
              </text>
              <text x="18" y="25" textAnchor="middle" fontSize="5" fill="#666">
                Call/Set
              </text>
            </svg>
          </div>
        </div>

        <div className="activity-metric-card">
          <div className="activity-metric-card-content">
            <div className="activity-metric-card-title">Appts</div>
            <div className="activity-metric-card-value">{totals.appts.toLocaleString()}</div>
          </div>
          <div className="activity-donut-container">
            <svg viewBox="0 0 36 36" className="activity-donut-chart">
              <circle className="donut-ring" cx="18" cy="18" r="15.915" fill="transparent" stroke="#e0e0e0" strokeWidth="3" />
              <circle className="donut-segment" cx="18" cy="18" r="15.915" fill="transparent" stroke="#ff9800" strokeWidth="3"
                strokeDasharray={calculateStrokeDasharray(parseFloat(showRatio))}
                strokeDashoffset="0"
              />
              <text x="18" y="18" textAnchor="middle" fontSize="7" fill="#333">
                {showRatio}%
              </text>
              <text x="18" y="25" textAnchor="middle" fontSize="5" fill="#666">
                Show
              </text>
            </svg>
          </div>
        </div>

        <div className="activity-metric-card">
          <div className="activity-metric-card-content">
            <div className="activity-metric-card-title">Refs</div>
            <div className="activity-metric-card-value">{totals.refs.toLocaleString()}</div>
          </div>
          <div className="activity-donut-container">
            <svg viewBox="0 0 36 36" className="activity-donut-chart">
              <circle className="donut-ring" cx="18" cy="18" r="15.915" fill="transparent" stroke="#e0e0e0" strokeWidth="3" />
              <circle className="donut-segment" cx="18" cy="18" r="15.915" fill="transparent" stroke="#00558c" strokeWidth="3"
                strokeDasharray={calculateStrokeDasharray(Math.min((parseFloat(refsPerSit) / 15) * 100, 100))}
                strokeDashoffset="0"
              />
              <text x="18" y="18" textAnchor="middle" fontSize="7" fill="#333">
                {refsPerSit}
              </text>
              <text x="18" y="25" textAnchor="middle" fontSize="5" fill="#666">
                Refs/Sit
              </text>
            </svg>
          </div>
        </div>

        <div className="activity-metric-card">
          <div className="activity-metric-card-content">
            <div className="activity-metric-card-title">Ref Appts</div>
            <div className="activity-metric-card-value">{totals.refAppt.toLocaleString()}</div>
          </div>
          <div className="activity-donut-container">
            <svg viewBox="0 0 36 36" className="activity-donut-chart">
              <circle className="donut-ring" cx="18" cy="18" r="15.915" fill="transparent" stroke="#e0e0e0" strokeWidth="3" />
              <circle className="donut-segment" cx="18" cy="18" r="15.915" fill="transparent" stroke="#ff9800" strokeWidth="3"
                strokeDasharray={calculateStrokeDasharray(parseFloat(refSitPercent))}
                strokeDashoffset="0"
              />
              <text x="18" y="18" textAnchor="middle" fontSize="7" fill="#333">
                {refSitPercent}%
              </text>
              <text x="18" y="25" textAnchor="middle" fontSize="5" fill="#666">
                Sit %
              </text>
            </svg>
          </div>
        </div>

        {/* Row 2 */}
        <div className="activity-metric-card">
          <div className="activity-metric-card-content">
            <div className="activity-metric-card-title">Sits</div>
            <div className="activity-metric-card-value">{totals.sits.toLocaleString()}</div>
          </div>
          <div className="activity-donut-container">
            <svg viewBox="0 0 36 36" className="activity-donut-chart">
              <circle className="donut-ring" cx="18" cy="18" r="15.915" fill="transparent" stroke="#e0e0e0" strokeWidth="3" />
              <circle className="donut-segment" cx="18" cy="18" r="15.915" fill="transparent" stroke="rgb(178, 82, 113)" strokeWidth="3"
                strokeDasharray={calculateStrokeDasharray(parseFloat(closeRatio))}
                strokeDashoffset="0"
              />
              <text x="18" y="18" textAnchor="middle" fontSize="7" fill="#333">
                {closeRatio}%
              </text>
              <text x="18" y="25" textAnchor="middle" fontSize="5" fill="#666">
                Close
              </text>
            </svg>
          </div>
        </div>

        <div className="activity-metric-card">
          <div className="activity-metric-card-content">
            <div className="activity-metric-card-title">Sales</div>
            <div className="activity-metric-card-value">{totals.sales.toLocaleString()}</div>
          </div>
          <div className="activity-donut-container">
            <svg viewBox="0 0 36 36" className="activity-donut-chart">
              <circle className="donut-ring" cx="18" cy="18" r="15.915" fill="transparent" stroke="#e0e0e0" strokeWidth="3" />
              <circle className="donut-segment" cx="18" cy="18" r="15.915" fill="transparent" stroke="#4caf50" strokeWidth="3"
                strokeDasharray={calculateStrokeDasharray(Math.min((alpPerSit / 600) * 100, 100))}
                strokeDashoffset="0"
              />
              <text x="18" y="18" textAnchor="middle" fontSize="7" fill="#333">
                ${alpPerSit.toLocaleString()}
              </text>
              <text x="18" y="25" textAnchor="middle" fontSize="5" fill="#666">
                ALP/Sit
              </text>
            </svg>
          </div>
        </div>

        <div className="activity-metric-card">
          <div className="activity-metric-card-content">
            <div className="activity-metric-card-title">Ref Sits</div>
            <div className="activity-metric-card-value">{totals.refSit.toLocaleString()}</div>
          </div>
          <div className="activity-donut-container">
            <svg viewBox="0 0 36 36" className="activity-donut-chart">
              <circle className="donut-ring" cx="18" cy="18" r="15.915" fill="transparent" stroke="#e0e0e0" strokeWidth="3" />
              <circle className="donut-segment" cx="18" cy="18" r="15.915" fill="transparent" stroke="rgb(178, 82, 113)" strokeWidth="3"
                strokeDasharray={calculateStrokeDasharray(parseFloat(refCloseRatio))}
                strokeDashoffset="0"
              />
              <text x="18" y="18" textAnchor="middle" fontSize="7" fill="#333">
                {refCloseRatio}%
              </text>
              <text x="18" y="25" textAnchor="middle" fontSize="5" fill="#666">
                Close
              </text>
            </svg>
          </div>
        </div>

        <div className="activity-metric-card">
          <div className="activity-metric-card-content">
            <div className="activity-metric-card-title">Ref Sales</div>
            <div className="activity-metric-card-value">{totals.refSale.toLocaleString()}</div>
          </div>
          <div className="activity-donut-container">
            <svg viewBox="0 0 36 36" className="activity-donut-chart">
              <circle className="donut-ring" cx="18" cy="18" r="15.915" fill="transparent" stroke="#e0e0e0" strokeWidth="3" />
              <circle className="donut-segment" cx="18" cy="18" r="15.915" fill="transparent" stroke="#4caf50" strokeWidth="3"
                strokeDasharray={calculateStrokeDasharray(Math.min((alpPerRefSale / 2400) * 100, 100))}
                strokeDashoffset="0"
              />
              <text x="18" y="18" textAnchor="middle" fontSize="7" fill="#333">
                ${alpPerRefSale.toLocaleString()}
              </text>
              <text x="18" y="25" textAnchor="middle" fontSize="5" fill="#666">
                ALP/Sale
              </text>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivitySummaryCards;

