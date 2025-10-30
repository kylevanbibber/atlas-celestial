import React from 'react';
import Card from '../utils/Card';
import calendarImage from '../../img/calendar.png';
import trophyImage from '../../img/trophy.png';

const HighlightsWidget = ({
  recordMonth,
  recordWeek,
  recordMonthLoading,
  recordWeekLoading,
  formatCurrency
}) => {
  return (
    <div className="oneonone-section trophy-section">
      <div className="section-header">
        <h2>Highlights</h2>
      </div>
      <div className={`trophy-card-container`}>
        <Card
          title={`Record Month`}
          value={recordMonthLoading ? (<span className="spinner" style={{ width: 16, height: 16 }}></span>) : formatCurrency((recordMonth?.value || 0).toString())}
          subText={recordMonthLoading ? '' : (recordMonth?.month || '-')}
          dateRange={recordMonthLoading ? '' : (recordMonth?.timeSince || '')}
          backgroundImage={trophyImage}
          backgroundSize="auto 80%"
          backgroundPositionX="96%"
          backgroundPositionY="75%"
        />
        <Card
          title={`Record Week`}
          value={recordWeekLoading ? (<span className="spinner" style={{ width: 16, height: 16 }}></span>) : formatCurrency((recordWeek?.value || 0).toString())}
          subText={recordWeekLoading ? '' : (recordWeek?.range || '-')}
          dateRange={recordWeekLoading ? '' : (recordWeek?.timeSince || '')}
          backgroundImage={calendarImage}
          backgroundSize="auto 80%"
          backgroundPositionX="95%"
          backgroundPositionY="50%"
        />
      </div>
    </div>
  );
};

export default HighlightsWidget;

