import React from 'react';

const StatisticsWidget = ({
  statsTimeframe,
  setStatsTimeframe,
  statsLoading,
  statisticsData,
  formatCurrency
}) => {
  return (
    <div className="oneonone-section statistics-section">
      <div className="section-header">
        <h2>Statistics</h2>
      </div>
      
      <div className="statistics-grid">
        {/* Stats timeframe selector */}
        <div className="stat-row">
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="oneonone-period-tabs" style={{ marginTop: '0.5rem' }}>
              <span className={statsTimeframe === 'this_month' ? 'selected' : 'unselected'} onClick={() => setStatsTimeframe('this_month')}>This Month</span>
              <span className="separator">|</span>
              <span className={statsTimeframe === 'last_month' ? 'selected' : 'unselected'} onClick={() => setStatsTimeframe('last_month')}>Last Month</span>
              <span className="separator">|</span>
              <span className={statsTimeframe === 'six_months' ? 'selected' : 'unselected'} onClick={() => setStatsTimeframe('six_months')}>6 Months</span>
              <span className="separator">|</span>
              <span className={statsTimeframe === 'all_time' ? 'selected' : 'unselected'} onClick={() => setStatsTimeframe('all_time')}>All Time</span>
            </div>
          </div>
        </div>
        <div className="stat-row">
          <div className="stat-item">
            <label>Calls to Appt</label>
            <span className="stat-value">{statsLoading ? <span className="spinner" style={{ width: 14, height: 14 }}></span> : (statisticsData?.callsToAppt ?? 0)}</span>
          </div>
          <div className="stat-item">
            <label>Calls to Sit</label>
            <span className="stat-value">{statsLoading ? <span className="spinner" style={{ width: 14, height: 14 }}></span> : (statisticsData?.callsToSit ?? 0)}</span>
          </div>
        </div>
        
        <div className="stat-row">
          <div className="stat-item">
            <label>Show Ratio</label>
            <span className="stat-value">{statsLoading ? <span className="spinner" style={{ width: 14, height: 14 }}></span> : (Number.isFinite(statisticsData?.showRatio) ? statisticsData.showRatio : 0)}%</span>
          </div>
          <div className="stat-item">
            <label>Close Ratio</label>
            <span className="stat-value">{statsLoading ? <span className="spinner" style={{ width: 14, height: 14 }}></span> : (Number.isFinite(statisticsData?.closeRatio) ? statisticsData.closeRatio : 0)}%</span>
          </div>
        </div>
        
        <div className="stat-row">
          <div className="stat-item">
            <label>ALP per Sit</label>
            <span className="stat-value">{statsLoading ? <span className="spinner" style={{ width: 14, height: 14 }}></span> : formatCurrency(statisticsData?.alpPerSit || 0)}</span>
          </div>
          <div className="stat-item">
            <label>ALP per Sale</label>
            <span className="stat-value">{statsLoading ? <span className="spinner" style={{ width: 14, height: 14 }}></span> : formatCurrency(statisticsData?.alpPerSale || 0)}</span>
          </div>
        </div>
        
        <div className="stat-row">
          <div className="stat-item">
            <label>Refs per Sit</label>
            <span className="stat-value">{statsLoading ? <span className="spinner" style={{ width: 14, height: 14 }}></span> : (statisticsData?.refsPerSit ?? 0)}</span>
          </div>
          <div className="stat-item">
            <label>Ref ALP / Refs</label>
            <span className="stat-value">{statsLoading ? <span className="spinner" style={{ width: 14, height: 14 }}></span> : formatCurrency(statisticsData?.refAlpPerRef || 0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsWidget;

