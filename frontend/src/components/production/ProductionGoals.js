import React, { useState, useEffect } from 'react';
import { FiTarget, FiTrendingUp, FiEdit3, FiSave, FiRefreshCcw } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import './ProductionGoals.css';

const ProductionGoals = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [goalData, setGoalData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Goal setting state
  const [monthlyAlpGoal, setMonthlyAlpGoal] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [workingDays, setWorkingDays] = useState([]);
  const [rateSource, setRateSource] = useState('agency'); // 'agency', 'personal', 'custom'
  
  // Custom rates state
  const [customRates, setCustomRates] = useState({
    callsToAppts: 1/35,     // 35 calls to get 1 appointment (2.86%)
    apptsToSits: 0.33,      // 33% show ratio (appts that sit)
    sitsToSales: 0.33,      // 33% close ratio (sits that sell)
    salesToAlp: 1200        // $1200 average ALP per sale
  });

  // Agency and personal averages
  const [agencyRates, setAgencyRates] = useState(null);
  const [personalRates, setPersonalRates] = useState(null);
  
  // Goal breakdown
  const [breakdown, setBreakdown] = useState(null);
  const [monthDaysOptions, setMonthDaysOptions] = useState([]);

  const generateWorkingDaysOptions = () => {
    if (!selectedYear || !selectedMonth) return;
    
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const monthDays = [];
    
    // Add some days from previous month (last 7 days)
    const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
    const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
    const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
    
    // Add last 7 days of previous month
    for (let day = Math.max(1, daysInPrevMonth - 6); day <= daysInPrevMonth; day++) {
      const date = new Date(prevYear, prevMonth - 1, day);
      const dayOfWeek = date.getDay();
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek];
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
      
      monthDays.push({
        day,
        date: date.toISOString().split('T')[0],
        dayName,
        isWeekday,
        isPrevMonth: true,
        month: prevMonth,
        year: prevYear,
        formatted: `${day} (${dayName}) - Prev Month`
      });
    }
    
    // Add current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(selectedYear, selectedMonth - 1, day);
      const dayOfWeek = date.getDay();
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek];
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
      
      monthDays.push({
        day,
        date: date.toISOString().split('T')[0],
        dayName,
        isWeekday,
        isPrevMonth: false,
        month: selectedMonth,
        year: selectedYear,
        formatted: `${day} (${dayName})`
      });
    }
    
    // If no working days are set, default to weekdays
    if (workingDays.length === 0) {
      const defaultWorkingDays = monthDays
        .filter(d => d.isWeekday)
        .map(d => d.date);
      setWorkingDays(defaultWorkingDays);
    }
    
    setMonthDaysOptions(monthDays);
  };

  useEffect(() => {
    loadGoalData();
    loadRates();
    generateWorkingDaysOptions();
  }, [selectedMonth, selectedYear, user?.userId]);

  useEffect(() => {
    generateWorkingDaysOptions();
  }, [selectedMonth, selectedYear]);

  const loadGoalData = async () => {
    if (!user?.userId) return;
    
    try {
      setLoading(true);
      const response = await api.get(`/goals/${user.userId}/${selectedYear}/${selectedMonth}`);
      if (response.data) {
        setGoalData(response.data);
        setMonthlyAlpGoal(response.data.monthlyAlpGoal || '');
        setRateSource(response.data.rateSource || 'agency');
        setWorkingDays(response.data.workingDays || []);
        if (response.data.customRates) {
          setCustomRates(response.data.customRates);
        }
      }
    } catch (error) {
      console.error('Error loading goal data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRates = async () => {
    if (!user?.userId) return;
    
    try {
      // Load agency averages
      const agencyResponse = await api.get('/goals/agency-rates');
      setAgencyRates(agencyResponse.data);
      
      // Load personal averages
      const personalResponse = await api.get(`/goals/personal-rates/${user.userId}`);
      setPersonalRates(personalResponse.data);
    } catch (error) {
      console.error('Error loading rates:', error);
    }
  };



  const calculateBreakdown = () => {
    if (!monthlyAlpGoal || monthlyAlpGoal <= 0 || workingDays.length === 0) return null;

    const rates = getRatesForCalculation();
    if (!rates) return null;

    const goal = parseFloat(monthlyAlpGoal);
    
    // Calculate required metrics to reach ALP goal
    const requiredSales = Math.ceil(goal / rates.salesToAlp);
    const requiredSits = Math.ceil(requiredSales / rates.sitsToSales);
    const requiredAppts = Math.ceil(requiredSits / rates.apptsToSits);
    const requiredCalls = Math.ceil(requiredAppts / rates.callsToAppts);

    // Use selected working days
    const numberOfWorkingDays = workingDays.length;
    const weeksInMonth = Math.ceil(numberOfWorkingDays / 5);

    // Count previous month days
    const currentMonth = selectedMonth;
    const currentYear = selectedYear;
    const prevMonthDays = workingDays.filter(dateString => {
      const date = new Date(dateString + 'T00:00:00');
      return date.getMonth() + 1 !== currentMonth || date.getFullYear() !== currentYear;
    }).length;

    return {
      monthly: {
        alp: goal,
        sales: requiredSales,
        sits: requiredSits,
        appts: requiredAppts,
        calls: requiredCalls
      },
      weekly: {
        alp: Math.round(goal / weeksInMonth),
        sales: Math.ceil(requiredSales / weeksInMonth),
        sits: Math.ceil(requiredSits / weeksInMonth),
        appts: Math.ceil(requiredAppts / weeksInMonth),
        calls: Math.ceil(requiredCalls / weeksInMonth)
      },
      daily: {
        alp: Math.round(goal / numberOfWorkingDays),
        sales: Math.ceil(requiredSales / numberOfWorkingDays),
        sits: Math.ceil(requiredSits / numberOfWorkingDays),
        appts: Math.ceil(requiredAppts / numberOfWorkingDays),
        calls: Math.ceil(requiredCalls / numberOfWorkingDays)
      },
      rates: rates,
      workingDays: numberOfWorkingDays,
      weeksInMonth: weeksInMonth,
      prevMonthDays: prevMonthDays
    };
  };

  const getRatesForCalculation = () => {
    switch (rateSource) {
      case 'agency':
        return agencyRates;
      case 'personal':
        return personalRates;
      case 'custom':
        return customRates;
      default:
        return agencyRates;
    }
  };

  const handleSaveGoal = async () => {
    if (!user?.userId || !monthlyAlpGoal) return;

    try {
      setLoading(true);
      const goalPayload = {
        userId: user.userId,
        year: selectedYear,
        month: selectedMonth,
        monthlyAlpGoal: parseFloat(monthlyAlpGoal),
        workingDays: workingDays,
        rateSource: rateSource,
        customRates: rateSource === 'custom' ? customRates : null
      };

      await api.post('/goals', goalPayload);
      setIsEditing(false);
      loadGoalData();
    } catch (error) {
      console.error('Error saving goal:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate breakdown whenever relevant values change
  useEffect(() => {
    if (monthlyAlpGoal && workingDays.length > 0 && (agencyRates || personalRates)) {
      setBreakdown(calculateBreakdown());
    }
  }, [monthlyAlpGoal, workingDays, rateSource, customRates, agencyRates, personalRates, selectedMonth, selectedYear]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="production-goals">
      <div className="goals-header">
        <div className="header-left">
          <h2>
            <FiTarget className="header-icon" />
            Production Goals
          </h2>
          <p>Set your monthly ALP goal and see the daily/weekly breakdown needed to achieve it.</p>
        </div>
        <div className="header-actions">
          {!isEditing ? (
            <button 
              className="btn btn-primary"
              onClick={() => setIsEditing(true)}
            >
              <FiEdit3 /> Edit Goal
            </button>
          ) : (
            <div className="edit-actions">
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setIsEditing(false);
                  loadGoalData();
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleSaveGoal}
                disabled={loading || !monthlyAlpGoal || workingDays.length === 0}
              >
                <FiSave /> Save Goal
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="goals-content">
        {/* Goal Configuration */}
        <div className="goal-config-section">
          <h3>Goal Configuration</h3>
          
          <div className="config-row">
            <div className="config-group">
              <label>Month & Year</label>
              <div className="month-year-selector">
                <select 
                  value={selectedMonth} 
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  disabled={!isEditing}
                >
                  {monthNames.map((month, index) => (
                    <option key={index + 1} value={index + 1}>{month}</option>
                  ))}
                </select>
                <select 
                  value={selectedYear} 
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  disabled={!isEditing}
                >
                  {[2023, 2024, 2025, 2026].map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="config-group">
              <label>Monthly ALP Goal</label>
              <input
                type="number"
                value={monthlyAlpGoal}
                onChange={(e) => setMonthlyAlpGoal(e.target.value)}
                placeholder="Enter your ALP goal"
                disabled={!isEditing}
                className="goal-input"
              />
            </div>
          </div>

          <div className="calendar-section">
            <label>Working Days & Daily Goals for {monthNames[selectedMonth - 1]} {selectedYear}</label>
            
            <div className="calendar-controls">
              <span>Selected working days: <strong>{workingDays.length}</strong></span>
              <div className="calendar-actions">
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => {
                    const weekdays = monthDaysOptions
                      .filter(d => d.isWeekday)
                      .map(d => d.date);
                    setWorkingDays(weekdays);
                  }}
                  disabled={!isEditing}
                >
                  Select All Weekdays
                </button>
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => setWorkingDays([])}
                  disabled={!isEditing}
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="calendar-container">
              <CalendarView
                year={selectedYear}
                month={selectedMonth}
                workingDays={workingDays}
                onWorkingDaysChange={setWorkingDays}
                isEditing={isEditing}
                breakdown={breakdown}
                monthDaysOptions={monthDaysOptions}
              />
            </div>
          </div>

          <div className="rate-source-section">
            <label>Calculation Method</label>
            <div className="rate-source-options">
              <label className="radio-option">
                <input
                  type="radio"
                  value="agency"
                  checked={rateSource === 'agency'}
                  onChange={(e) => setRateSource(e.target.value)}
                  disabled={!isEditing}
                />
                <span>Agency Averages</span>
                {agencyRates && (
                  <div className="rate-preview">
                    {Math.round(agencyRates.callsToAppts * 100)}% calls→appts, 
                    {Math.round(agencyRates.apptsToSits * 100)}% appts→sits, 
                    {Math.round(agencyRates.sitsToSales * 100)}% sits→sales
                  </div>
                )}
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  value="personal"
                  checked={rateSource === 'personal'}
                  onChange={(e) => setRateSource(e.target.value)}
                  disabled={!isEditing || !personalRates}
                />
                <span>Your Personal Averages</span>
                {personalRates ? (
                  <div className="rate-preview">
                    {Math.round(personalRates.callsToAppts * 100)}% calls→appts, 
                    {Math.round(personalRates.apptsToSits * 100)}% appts→sits, 
                    {Math.round(personalRates.sitsToSales * 100)}% sits→sales
                  </div>
                ) : (
                  <div className="rate-preview text-muted">
                    Not enough personal data available
                  </div>
                )}
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  value="custom"
                  checked={rateSource === 'custom'}
                  onChange={(e) => setRateSource(e.target.value)}
                  disabled={!isEditing}
                />
                <span>Custom Rates</span>
              </label>
            </div>

            {rateSource === 'custom' && isEditing && (
              <div className="custom-rates-section">
                <h4>Custom Conversion Rates</h4>
                <div className="custom-rates-grid">
                  <div className="rate-input-group">
                    <label>Calls to Appointments (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={customRates.callsToAppts * 100}
                      onChange={(e) => setCustomRates({
                        ...customRates,
                        callsToAppts: parseFloat(e.target.value) / 100
                      })}
                    />
                  </div>
                  <div className="rate-input-group">
                    <label>Appointments to Sits (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={customRates.apptsToSits * 100}
                      onChange={(e) => setCustomRates({
                        ...customRates,
                        apptsToSits: parseFloat(e.target.value) / 100
                      })}
                    />
                  </div>
                  <div className="rate-input-group">
                    <label>Sits to Sales (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={customRates.sitsToSales * 100}
                      onChange={(e) => setCustomRates({
                        ...customRates,
                        sitsToSales: parseFloat(e.target.value) / 100
                      })}
                    />
                  </div>
                  <div className="rate-input-group">
                    <label>Average ALP per Sale ($)</label>
                    <input
                      type="number"
                      step="50"
                      min="0"
                      value={customRates.salesToAlp}
                      onChange={(e) => setCustomRates({
                        ...customRates,
                        salesToAlp: parseFloat(e.target.value)
                      })}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Goal Breakdown */}
        {breakdown && (
          <div className="goal-breakdown-section">
            <h3>
              <FiTrendingUp className="section-icon" />
              Goal Breakdown
            </h3>
            
            <div className="breakdown-summary">
              <p>
                To reach your <strong>{formatCurrency(breakdown.monthly.alp)} ALP goal</strong> in {monthNames[selectedMonth - 1]}, 
                you need to average <strong>{breakdown.daily.calls} calls per day</strong> over your {breakdown.workingDays} selected working days
                {breakdown.prevMonthDays > 0 && (
                  <span className="prev-month-note"> (including {breakdown.prevMonthDays} day{breakdown.prevMonthDays !== 1 ? 's' : ''} from previous month)</span>
                )}.
              </p>
              <div className="monthly-summary">
                <div className="summary-item">
                  <span className="summary-label">Monthly Calls:</span>
                  <span className="summary-value">{breakdown.monthly.calls}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Monthly Appointments:</span>
                  <span className="summary-value">{breakdown.monthly.appts}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Monthly Sits:</span>
                  <span className="summary-value">{breakdown.monthly.sits}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Monthly Sales:</span>
                  <span className="summary-value">{breakdown.monthly.sales}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="loading-overlay">
            <FiRefreshCcw className="loading-spinner" />
            <span>Loading...</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Calendar View Component
const CalendarView = ({ year, month, workingDays, onWorkingDaysChange, isEditing, breakdown, monthDaysOptions }) => {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (value) => {
    return Math.round(value);
  };

  // Get first day of month and days in month
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday

  // Get previous month info
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();

  // Create calendar grid
  const calendarDays = [];
  
  // Add previous month days for the empty cells at the beginning
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const date = new Date(prevYear, prevMonth - 1, day);
    const dateString = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const isWorkingDay = workingDays.includes(dateString);
    const dayOption = monthDaysOptions.find(d => d.date === dateString);

    calendarDays.push({
      day,
      date: dateString,
      isWeekday,
      isWorkingDay,
      dayOption,
      isPrevMonth: true,
      month: prevMonth,
      year: prevYear
    });
  }

  // Add days of the current month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dateString = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const isWorkingDay = workingDays.includes(dateString);
    const dayOption = monthDaysOptions.find(d => d.date === dateString);

    calendarDays.push({
      day,
      date: dateString,
      isWeekday,
      isWorkingDay,
      dayOption,
      isPrevMonth: false,
      month: month,
      year: year
    });
  }

  const handleDayClick = (dayData) => {
    if (!isEditing || !dayData) return;

    if (dayData.isWorkingDay) {
      // Remove from working days
      onWorkingDaysChange(workingDays.filter(d => d !== dayData.date));
    } else {
      // Add to working days
      onWorkingDaysChange([...workingDays, dayData.date]);
    }
  };

  const getDailyGoals = () => {
    if (!breakdown || workingDays.length === 0) return null;
    
    return {
      calls: breakdown.daily.calls,
      appts: breakdown.daily.appts,
      sits: breakdown.daily.sits,
      sales: breakdown.daily.sales,
      alp: breakdown.daily.alp
    };
  };

  const dailyGoals = getDailyGoals();

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="calendar-view">
      <div className="calendar-header">
        {dayNames.map(dayName => (
          <div key={dayName} className="calendar-day-header">
            {dayName}
          </div>
        ))}
      </div>
      
      <div className="calendar-grid">
        {calendarDays.map((dayData, index) => (
          <div
            key={index}
            className={`calendar-day ${
              dayData.isPrevMonth ? 'prev-month' : ''
            } ${
              dayData.isWorkingDay ? 'working' : 
              dayData.isWeekday ? 'weekday' : 'weekend'
            } ${isEditing && dayData ? 'editable' : ''}`}
            onClick={() => handleDayClick(dayData)}
          >
            <div className="day-number">
              {dayData.day}
              {dayData.isPrevMonth && <span className="prev-month-indicator">prev</span>}
            </div>
            {dayData.isWorkingDay && dailyGoals && (
              <div className="daily-goals">
                <div className="goal-item primary">
                  <span className="goal-value">{dailyGoals.calls}</span>
                  <span className="goal-label">calls</span>
                </div>
                <div className="goal-item">
                  <span className="goal-value">{dailyGoals.appts}</span>
                  <span className="goal-label">appts</span>
                </div>
                <div className="goal-item">
                  <span className="goal-value">{dailyGoals.sits}</span>
                  <span className="goal-label">sits</span>
                </div>
                <div className="goal-item">
                  <span className="goal-value">{dailyGoals.sales}</span>
                  <span className="goal-label">sales</span>
                </div>
                <div className="goal-item currency">
                  <span className="goal-value">{formatCurrency(dailyGoals.alp)}</span>
                  <span className="goal-label">ALP</span>
                </div>
              </div>
            )}
            {!dayData.isWorkingDay && dayData.isWeekday && isEditing && (
              <div className="day-hint">
                {dayData.isPrevMonth ? 'Click to add (prev month)' : 'Click to add'}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {breakdown && (
        <div className="calendar-legend">
          <h4>Daily Goal Legend</h4>
          <div className="legend-items">
            <div className="legend-item">
              <div className="legend-color calls"></div>
              <span>Calls: <strong>{dailyGoals?.calls || 0}</strong> per working day</span>
            </div>
            <div className="legend-item">
              <div className="legend-color appts"></div>
              <span>Appointments: <strong>{dailyGoals?.appts || 0}</strong> per working day</span>
            </div>
            <div className="legend-item">
              <div className="legend-color sits"></div>
              <span>Sits: <strong>{dailyGoals?.sits || 0}</strong> per working day</span>
            </div>
            <div className="legend-item">
              <div className="legend-color sales"></div>
              <span>Sales: <strong>{dailyGoals?.sales || 0}</strong> per working day</span>
            </div>
            <div className="legend-item">
              <div className="legend-color alp"></div>
              <span>ALP: <strong>{dailyGoals ? formatCurrency(dailyGoals.alp) : '$0'}</strong> per working day</span>
            </div>
          </div>
          
          <div className="conversion-rates">
            <h5>Conversion Rates Used:</h5>
            <div className="rates-grid">
              <div className="rate-item">
                <span>Calls → Appointments:</span>
                <strong>{Math.round(breakdown.rates.callsToAppts * 10000) / 100}%</strong>
                <small>(~{Math.round(1/breakdown.rates.callsToAppts)} calls per appointment)</small>
              </div>
              <div className="rate-item">
                <span>Appointments → Sits:</span>
                <strong>{Math.round(breakdown.rates.apptsToSits * 100)}%</strong>
              </div>
              <div className="rate-item">
                <span>Sits → Sales:</span>
                <strong>{Math.round(breakdown.rates.sitsToSales * 100)}%</strong>
              </div>
              <div className="rate-item">
                <span>Average ALP per Sale:</span>
                <strong>{formatCurrency(breakdown.rates.salesToAlp)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionGoals; 