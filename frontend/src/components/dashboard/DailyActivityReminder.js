import React, { useState, useEffect, useRef } from 'react';
import { FiChevronDown, FiChevronUp, FiAlertCircle } from 'react-icons/fi';
import api from '../../api';
import LoadingSuccessOverlay from '../animations/LoadingSuccessOverlay';
import './DailyActivityReminder.css';

const DailyActivityReminder = ({ user }) => {
  const isTestLoop = new URLSearchParams(window.location.search).get('activityReminderTest') === '1';
  const [hasMissingData, setHasMissingData] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const reminderRef = useRef(null);
  const [yesterdayDate, setYesterdayDate] = useState('');
  const [yesterdayDisplay, setYesterdayDisplay] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const successTimeoutRef = useRef(null);
  const testLoopTimersRef = useRef([]);
  
  // Form data for yesterday's activity
  const [formData, setFormData] = useState({
    calls: '',
    appts: '',
    sits: '',
    sales: '',
    alp: '',
    refs: '',
    refAppt: '',
    refSit: '',
    refSale: '',
    refAlp: ''
  });

  // Utility function to get yesterday's date in Eastern Time
  const getYesterdayEastern = () => {
    const now = new Date();
    const easternTimeString = now.toLocaleString("en-US", {
      timeZone: "America/New_York",
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    // Parse the MM/DD/YYYY format and convert to Date
    const [month, day, year] = easternTimeString.split('/');
    const todayEastern = new Date(year, month - 1, day);
    
    // Get yesterday
    const yesterday = new Date(todayEastern);
    yesterday.setDate(todayEastern.getDate() - 1);
    
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    const yesterdayDisplayStr = `${String(yesterday.getMonth() + 1)}/${String(yesterday.getDate()).padStart(2, '0')}/${yesterday.getFullYear()}`;
    
    return { yesterdayStr, yesterdayDisplayStr };
  };

  useEffect(() => {
    checkYesterdayActivity();
  }, [user]);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = null;
      }
      testLoopTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      testLoopTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!isTestLoop) {
      return;
    }

    setLoading(false);
    setHasMissingData(true);
    setIsExpanded(true);

    const clearTimers = () => {
      testLoopTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      testLoopTimersRef.current = [];
    };

    const runLoop = () => {
      setSaving(true);
      setShowSuccess(false);

      const savingTimer = setTimeout(() => {
        setSaving(false);
        setShowSuccess(true);
      }, 900);

      const successTimer = setTimeout(() => {
        setShowSuccess(false);
        const restartTimer = setTimeout(runLoop, 900);
        testLoopTimersRef.current.push(restartTimer);
      }, 1800);

      testLoopTimersRef.current.push(savingTimer, successTimer);
    };

    clearTimers();
    runLoop();

    return () => {
      clearTimers();
      setSaving(false);
      setShowSuccess(false);
    };
  }, [isTestLoop]);



  const checkYesterdayActivity = async () => {
    if (isTestLoop) {
      return;
    }

    if (!user?.userId) {
      setLoading(false);
      return;
    }

    try {
      const { yesterdayStr, yesterdayDisplayStr } = getYesterdayEastern();
      setYesterdayDate(yesterdayStr);
      setYesterdayDisplay(yesterdayDisplayStr);

      // Check if data exists for yesterday
      const response = await api.get(`/dailyActivity/user-summary?startDate=${yesterdayStr}&endDate=${yesterdayStr}`);
      const result = response.data;

      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        const yesterdayData = result.data[0];
        
        // Check if any activity data exists
        const hasActivity = 
          yesterdayData.calls !== undefined && yesterdayData.calls !== null ||
          yesterdayData.appts !== undefined && yesterdayData.appts !== null ||
          yesterdayData.sits !== undefined && yesterdayData.sits !== null ||
          yesterdayData.sales !== undefined && yesterdayData.sales !== null ||
          yesterdayData.alp !== undefined && yesterdayData.alp !== null ||
          yesterdayData.refs !== undefined && yesterdayData.refs !== null ||
          yesterdayData.refAppt !== undefined && yesterdayData.refAppt !== null ||
          yesterdayData.refSit !== undefined && yesterdayData.refSit !== null ||
          yesterdayData.refSale !== undefined && yesterdayData.refSale !== null ||
          yesterdayData.refAlp !== undefined && yesterdayData.refAlp !== null;

        setHasMissingData(!hasActivity);
        
        // Pre-fill form with existing data if any
        if (hasActivity) {
          setFormData({
            calls: yesterdayData.calls || '',
            appts: yesterdayData.appts || '',
            sits: yesterdayData.sits || '',
            sales: yesterdayData.sales || '',
            alp: yesterdayData.alp || '',
            refs: yesterdayData.refs || '',
            refAppt: yesterdayData.refAppt || '',
            refSit: yesterdayData.refSit || '',
            refSale: yesterdayData.refSale || '',
            refAlp: yesterdayData.refAlp || ''
          });
        }
      } else {
        // No data found for yesterday
        setHasMissingData(true);
      }
    } catch (error) {
      console.error('Error checking yesterday activity:', error);
      setHasMissingData(true);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    if (!user?.userId) {
      console.error('User ID not found');
      return;
    }

    setSaving(true);
    setShowSuccess(false);

    try {
      const response = await api.post('/dailyActivity/update', {
        userId: user.userId,
        updates: {
          [yesterdayDate]: {
            reportDate: yesterdayDate,
            ...formData
          }
        }
      });

      const result = response.data;

      if (result.success) {
        setShowSuccess(true);
        successTimeoutRef.current = setTimeout(() => {
          setHasMissingData(false);
          setShowSuccess(false);
          setIsExpanded(false);
          successTimeoutRef.current = null;
        }, 1600);
      } else {
        console.error('Failed to save activity:', result.message);
        alert('Failed to save activity. Please try again.');
      }
    } catch (error) {
      console.error('Error saving activity:', error);
      alert('Error saving activity. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Don't render if loading or no missing data
  if (loading || !hasMissingData) {
    return null;
  }

  return (
    <>
      {/* Backdrop with blur effect - prevents interaction with page content */}
      <div 
        className="daily-activity-backdrop"
        onClick={(e) => {
          // Prevent clicks on backdrop from doing anything
          e.preventDefault();
          e.stopPropagation();
        }}
      />
      
      {/* Modal content */}
      <div className="daily-activity-reminder" ref={reminderRef}>
        <LoadingSuccessOverlay
          isLoading={saving}
          isSuccess={showSuccess}
          message={saving ? 'Saving your activity...' : 'Activity saved successfully!'}
          size={120}
        />
        <div 
          className="reminder-header"
          onClick={() => {
            if (saving || showSuccess) {
              return;
            }
            setIsExpanded(!isExpanded);
          }}
        >
          <div className="reminder-icon">
            <FiAlertCircle size={20} />
          </div>
          <div className="reminder-message">
            You have not reported your daily activity from yesterday, <strong>{yesterdayDisplay}</strong>. 
            Please report now to re-enable full functionality.
          </div>
          <div className="reminder-toggle">
            {isExpanded ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
          </div>
        </div>

        {isExpanded && (
          <div className="reminder-form">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Calls</th>
                    <th>Appts</th>
                    <th>Sits</th>
                    <th>Sales</th>
                    <th>Total ALP</th>
                    <th>Refs</th>
                    <th>Ref Appts</th>
                    <th>Ref Sits</th>
                    <th>Ref Sales</th>
                    <th>Ref ALP</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="date-cell">
                      <strong>{yesterdayDisplay}</strong>
                    </td>
                    <td>
                      <input
                        type="number"
                        value={formData.calls}
                        onChange={(e) => handleInputChange('calls', e.target.value)}
                        placeholder="0"
                        min="0"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={formData.appts}
                        onChange={(e) => handleInputChange('appts', e.target.value)}
                        placeholder="0"
                        min="0"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={formData.sits}
                        onChange={(e) => handleInputChange('sits', e.target.value)}
                        placeholder="0"
                        min="0"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={formData.sales}
                        onChange={(e) => handleInputChange('sales', e.target.value)}
                        placeholder="0"
                        min="0"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={formData.alp}
                        onChange={(e) => handleInputChange('alp', e.target.value)}
                        placeholder="0"
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={formData.refs}
                        onChange={(e) => handleInputChange('refs', e.target.value)}
                        placeholder="0"
                        min="0"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={formData.refAppt}
                        onChange={(e) => handleInputChange('refAppt', e.target.value)}
                        placeholder="0"
                        min="0"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={formData.refSit}
                        onChange={(e) => handleInputChange('refSit', e.target.value)}
                        placeholder="0"
                        min="0"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={formData.refSale}
                        onChange={(e) => handleInputChange('refSale', e.target.value)}
                        placeholder="0"
                        min="0"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={formData.refAlp}
                        onChange={(e) => handleInputChange('refAlp', e.target.value)}
                        placeholder="0"
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td className="submit-cell">
                      <button 
                        className="submit-button"
                        onClick={handleSubmit}
                      disabled={saving || showSuccess}
                        title={saving ? 'Saving...' : 'Submit Activity'}
                      >
                        {saving ? '...' : '✓'}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default DailyActivityReminder;
