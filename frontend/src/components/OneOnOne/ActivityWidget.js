import React from 'react';
import { FiChevronLeft, FiChevronRight, FiCalendar } from 'react-icons/fi';

const ActivityWidget = ({
  activityData,
  activityLoading,
  selectedPeriod,
  setSelectedPeriod,
  viewMode,
  setViewMode,
  currentDate,
  setCurrentDate,
  getPeriodOptions,
  getPeriodKeyForDate,
  comparisonData,
  officialYtdAlp,
  error,
  formatCurrency,
  formatNumber
}) => {
  return (
    <div className="oneonone-section activity-section">
      <div className="section-header">
        <h2>Activity</h2>
      </div>

      {/* Controls Row: Period + View Mode + Date Navigator */}
      <div className="controls-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'center', gap: '0.75rem', width: '100%' }}>
        <div className="oneonone-period-tabs">
          <span 
            className={selectedPeriod === "week" ? "selected" : "unselected"} 
            onClick={() => setSelectedPeriod("week")}
          >
            Week
          </span>
          <span className="separator">|</span>
          <span 
            className={selectedPeriod === "month" ? "selected" : "unselected"} 
            onClick={() => setSelectedPeriod("month")}
          >
            Month
          </span>
          <span className="separator">|</span>
          <span 
            className={selectedPeriod === "ytd" ? "selected" : "unselected"} 
            onClick={() => setSelectedPeriod("ytd")}
          >
            YTD
          </span>
          {(selectedPeriod === 'week' || selectedPeriod === 'month') && (
            <>
              <span className="separator">|</span>
              <span 
                className={viewMode === "reported" ? "selected" : "unselected"} 
                onClick={() => setViewMode("reported")}
              >
                Reported
              </span>
              <span className="separator">|</span>
              <span 
                className={viewMode === "official" ? "selected" : "unselected"} 
                onClick={() => setViewMode("official")}
              >
                Official
              </span>
            </>
          )}
        </div>

        {/* Date Navigator (hide for Official view) */}
        {viewMode !== 'official' && (
          <div className="date-navigation" style={{ marginBottom: '0.5rem' }}>
            <button 
              onClick={() => setCurrentDate(prev => {
                const d = new Date(prev);
                if (selectedPeriod === 'week') d.setDate(d.getDate() - 7);
                else if (selectedPeriod === 'month') d.setMonth(d.getMonth() - 1);
                else if (selectedPeriod === 'ytd') d.setFullYear(d.getFullYear() - 1);
                return d;
              })}
              className="date-nav-btn"
              aria-label="Previous"
            >
              <FiChevronLeft />
            </button>
            <div className="date-display">
              <FiCalendar style={{ marginRight: 6 }} />
              <select
                value={getPeriodKeyForDate(selectedPeriod, currentDate)}
                onChange={(e) => {
                  const val = e.target.value;
                  // Map back to a representative date for currentDate
                  if (selectedPeriod === 'week') {
                    // val is Monday ISO; parse as local to avoid UTC shift
                    const [yyyy, mm, dd] = val.split('-').map((t) => parseInt(t, 10));
                    const d = new Date(yyyy, (mm || 1) - 1, dd || 1);
                    setCurrentDate(d);
                  } else if (selectedPeriod === 'month') {
                    const [mm, yyyy] = val.split('/');
                    const d = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, 1);
                    setCurrentDate(d);
                  } else {
                    const year = parseInt(val, 10);
                    setCurrentDate(new Date(year, 0, 1));
                  }
                }}
              >
                {getPeriodOptions(selectedPeriod).map(opt => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
            </div>
            <button 
              onClick={() => setCurrentDate(prev => {
                const d = new Date(prev);
                if (selectedPeriod === 'week') d.setDate(d.getDate() + 7);
                else if (selectedPeriod === 'month') d.setMonth(d.getMonth() + 1);
                else if (selectedPeriod === 'ytd') d.setFullYear(d.getFullYear() + 1);
                return d;
              })}
              className="date-nav-btn"
              aria-label="Next"
            >
              <FiChevronRight />
            </button>
          </div>
        )}
      </div>

      <div className="activity-metrics">
        {activityLoading ? (
          <div className="activity-loading">
            <div className="spinner"></div>
            <p>Loading {selectedPeriod} data...</p>
          </div>
        ) : viewMode === 'official' && (selectedPeriod === 'week' || selectedPeriod === 'month') ? (
          /* Official Comparison View for Weekly/Monthly Data */
          <div className="comparison-view">
            <div className="comparison-header">
              <h4>{selectedPeriod === 'week' ? 'Past 8 Weeks' : 'Past 6 Months'} - Reported vs Official ALP</h4>
            </div>
            {comparisonData && comparisonData.length > 0 ? (
              <div className="comparison-list">
                {comparisonData.map((week, index) => (
                  <div key={week.weekKey || week.month || index} className="comparison-item">
                    <div className="comparison-values">
                      <div className="week-range">{week.weekRange || week.month}</div>
                      <div className="reported-value">
                        <span className="label">Reported:</span>
                        <span className="value">{formatCurrency(week.reportedAlp)}</span>
                      </div>
                      <div className="official-value">
                        <span className="label">Official:</span>
                        <span className="value">{formatCurrency(week.officialAlp)}</span>
                      </div>
                      {(() => {
                        const diff = (Number(week.officialAlp) || 0) - (Number(week.reportedAlp) || 0);
                        const cls = diff === 0 ? 'match' : diff > 0 ? 'over' : 'under';
                        const sign = diff === 0 ? '' : diff > 0 ? '+' : '-';
                        return (
                          <div className={`difference ${cls}`}>
                            <span className="diff-value">
                              {diff === 0 ? '-' : `${sign}${formatCurrency(Math.abs(diff))}`}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-comparison-data">
                <p>No official data available for comparison</p>
              </div>
            )}
          </div>
        ) : (
          /* Regular Aggregated View */
          <>
            <div className="metric-row">
              <div className="metric-item">
                <label>Calls</label>
                <span className="metric-value">{formatNumber(activityData?.calls || 0)}</span>
              </div>
              <div className="metric-item">
                <label>Appts</label>
                <span className="metric-value">{formatNumber(activityData?.appts || 0)}</span>
              </div>
            </div>
            
            <div className="metric-row">
              <div className="metric-item">
                <label>Sits</label>
                <span className="metric-value">{formatNumber(activityData?.sits || 0)}</span>
              </div>
              <div className="metric-item">
                <label>Sales</label>
                <span className="metric-value">{formatNumber(activityData?.sales || 0)}</span>
              </div>
            </div>
            
            <div className="metric-row">
              <div className="metric-item">
                <label>ALP</label>
                <span className="metric-value">{formatCurrency(activityData?.alp || 0)}</span>
                {selectedPeriod === 'ytd' && officialYtdAlp !== null && (
                  <div className="metric-subtext">Official: {formatCurrency(officialYtdAlp)}</div>
                )}
              </div>
              <div className="metric-item">
                <label>Refs</label>
                <span className="metric-value">{formatNumber(activityData?.refs || 0)}</span>
              </div>
            </div>

            {error && (
              <div className="error-message">
                <p>{error}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ActivityWidget;

