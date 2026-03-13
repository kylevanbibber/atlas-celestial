/**
 * Personal Metrics Cards Component
 * Displays individual metric cards for personal view (Calls, Appointments, Sits, Sales, ALP, Refs)
 */

import React from 'react';
import { 
  FiPhone, FiCalendar, FiUsers, FiTrendingUp, FiDollarSign, FiUserPlus,
  FiEdit2, FiToggleLeft, FiToggleRight, FiX, FiSave 
} from 'react-icons/fi';
import WidgetCard from '../utils/WidgetCard';
import { formatCurrency, formatNumber } from '../../utils/dashboardHelpers';

const PersonalMetricsCards = ({
  activityData,
  activityLoading,
  statsData,
  statsLoading,
  personalComparison,
  personalAlpMode,
  setPersonalAlpMode,
  hasOfficialAlpData,
  personalOfficialAlp,
  personalGoal,
  editingPersonalGoal,
  setEditingPersonalGoal,
  personalGoalInput,
  setPersonalGoalInput,
  savePersonalAlpGoal,
  viewMode
}) => {
  return (
    <div style={{ marginTop: '1rem' }}>
      <div className="metric-row" style={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1rem'
      }}>
        {/* Calls Card */}
        <WidgetCard
          title="Calls"
          value={activityLoading ? <span className="spinner"></span> : formatNumber(activityData?.calls || 0)}
          icon={FiPhone}
          color="#3b82f6"
          loading={activityLoading}
          subText={statsLoading ? '' : `${statsData?.callsToAppt || 0} calls to appt`}
          showComparison={!!personalComparison}
          comparisonValue={personalComparison?.calls}
          comparisonLabel={personalComparison?.label}
          comparisonFormat="number"
        />

        {/* Appointments Card */}
        <WidgetCard
          title="Appointments"
          value={activityLoading ? <span className="spinner"></span> : formatNumber(activityData?.appts || 0)}
          icon={FiCalendar}
          color="#8b5cf6"
          loading={activityLoading}
          subText={statsLoading ? '' : `${statsData?.showRatio || 0}% show ratio`}
          showComparison={!!personalComparison}
          comparisonValue={personalComparison?.appts}
          comparisonLabel={personalComparison?.label}
          comparisonFormat="number"
        />

        {/* Sits Card */}
        <WidgetCard
          title="Sits"
          value={activityLoading ? <span className="spinner"></span> : formatNumber(activityData?.sits || 0)}
          icon={FiUsers}
          color="#f59e0b"
          loading={activityLoading}
          subText={statsLoading ? '' : `${statsData?.closeRatio || 0}% close ratio`}
          showComparison={!!personalComparison}
          comparisonValue={personalComparison?.sits}
          comparisonLabel={personalComparison?.label}
          comparisonFormat="number"
        />

        {/* Sales Card */}
        <WidgetCard
          title="Sales"
          value={activityLoading ? <span className="spinner"></span> : formatNumber(activityData?.sales || 0)}
          icon={FiTrendingUp}
          color="#10b981"
          loading={activityLoading}
          subText={statsLoading ? '' : `${formatCurrency(statsData?.alpPerSit || 0)} ALP per sit`}
          showComparison={!!personalComparison}
          comparisonValue={personalComparison?.sales}
          comparisonLabel={personalComparison?.label}
          comparisonFormat="number"
        />

        {/* ALP Card */}
        <WidgetCard
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>ALP</span>
              {hasOfficialAlpData && (
                <span style={{
                  fontSize: '0.75rem',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '0.25rem',
                  background: personalAlpMode === 'official' ? '#06b6d420' : '#8b5cf620',
                  color: personalAlpMode === 'official' ? '#06b6d4' : '#8b5cf6',
                  fontWeight: '500'
                }}>
                  {personalAlpMode === 'official' ? 'Official' : 'Reported'}
                </span>
              )}
            </div>
          }
          value={activityLoading ? <span className="spinner"></span> : formatCurrency(
            personalAlpMode === 'official' && hasOfficialAlpData
              ? personalOfficialAlp || 0
              : activityData?.alp || 0
          )}
          icon={FiDollarSign}
          color="#06b6d4"
          loading={activityLoading}
          subText={statsLoading ? '' : `${formatCurrency(statsData?.alpPerSale || 0)} ALP per sale`}
          showComparison={!!personalComparison}
          comparisonValue={personalComparison?.alp}
          comparisonLabel={personalComparison?.label}
          comparisonFormat="currency"
          showProgress={viewMode === 'month' && !!personalGoal}
          currentValue={
            personalAlpMode === 'official' && hasOfficialAlpData
              ? personalOfficialAlp || 0
              : activityData?.alp || 0
          }
          goalValue={personalGoal}
          topRightAction={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {hasOfficialAlpData && (
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setPersonalAlpMode(personalAlpMode === 'reported' ? 'official' : 'reported');
                  }}
                  style={{ 
                    padding: '6px', 
                    borderRadius: '6px', 
                    background: 'transparent', 
                    color: '#06b6d4', 
                    border: 'none', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#06b6d420'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  title={`Switch to ${personalAlpMode === 'reported' ? 'official' : 'reported'} ALP`}
                >
                  {personalAlpMode === 'reported' ? <FiToggleRight size={18} /> : <FiToggleLeft size={18} />}
                </button>
              )}
              {editingPersonalGoal ? (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      savePersonalAlpGoal();
                    }}
                    style={{
                      padding: '6px',
                      borderRadius: '6px',
                      background: 'transparent',
                      color: '#06b6d4',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#06b6d420')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    title="Save goal"
                  >
                    <FiSave size={18} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPersonalGoal(false);
                    }}
                    style={{
                      padding: '6px',
                      borderRadius: '6px',
                      background: 'transparent',
                      color: '#06b6d4',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#06b6d420')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    title="Cancel editing"
                  >
                    <FiX size={18} />
                  </button>
                </>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingPersonalGoal(true);
                    setPersonalGoalInput(personalGoal ? String(personalGoal) : '');
                  }}
                  style={{
                    padding: '6px',
                    borderRadius: '6px',
                    background: 'transparent',
                    color: '#06b6d4',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#06b6d420')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  title={personalGoal ? 'Edit Goal' : 'Set Goal'}
                >
                  <FiEdit2 size={18} />
                </button>
              )}
            </div>
          }
        >
          {editingPersonalGoal && (
            <div className="alp-goal-edit-row">
              <input
                type="number"
                value={personalGoalInput}
                onChange={(e) => setPersonalGoalInput(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="alp-goal-input"
                placeholder="Enter goal amount"
                autoFocus
              />
            </div>
          )}
        </WidgetCard>

        {/* Refs Card */}
        <WidgetCard
          title="Refs"
          value={activityLoading ? <span className="spinner"></span> : formatNumber(activityData?.refs || 0)}
          icon={FiUserPlus}
          color="#ec4899"
          loading={activityLoading}
          subText={statsLoading ? '' : `${statsData?.refsPerSit || 0} refs per sit`}
          showComparison={!!personalComparison}
          comparisonValue={personalComparison?.refs}
          comparisonLabel={personalComparison?.label}
          comparisonFormat="number"
        />
      </div>
    </div>
  );
};

export default PersonalMetricsCards;
