import React, { useState, useEffect, useCallback } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useHeader } from '../../context/HeaderContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import ProductionGoals from './ProductionGoals';
import DailyActivityForm from './activity/DailyActivityForm';
import CommitsOverviewTable from './CommitsOverviewTable';
import '../dashboard/DateRangeSelector.css';

const fmt = (d) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const MANAGER_ROLES = ['SA', 'GA', 'MGA', 'RGA', 'SGA'];

// Returns the start of the week containing `date`, respecting schedule type
const getWeekStart = (date, scheduleType) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  if (scheduleType === 'wed-tue') {
    const daysBack = day >= 3 ? day - 3 : day + 4;
    d.setDate(d.getDate() - daysBack);
  } else {
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  }
  return d;
};

const ActivityGoalsCombinedPage = () => {
  const { setHeaderContent } = useHeader();
  const { user } = useAuth();
  const [selectedRange, setSelectedRange] = useState('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scheduleType, setScheduleType] = useState(() => {
    try {
      const saved = localStorage.getItem('dailyActivityScheduleType');
      return saved === 'wed-tue' ? 'wed-tue' : 'mon-sun';
    } catch { return 'mon-sun'; }
  });
  const [viewScope, setViewScope] = useState('personal');
  const [breakdown, setBreakdown] = useState(null);
  const [goalReloadKey, setGoalReloadKey] = useState(0);
  const [showGoalsEditor, setShowGoalsEditor] = useState(false);
  const [hasGoalChanges, setHasGoalChanges] = useState(false);
  const [saveTriggerKey, setSaveTriggerKey] = useState(0);

  const handleOpenGoalEditor = useCallback(() => setShowGoalsEditor(true), []);

  const handleCloseGoalEditor = useCallback(() => {
    if (hasGoalChanges) {
      if (!window.confirm('You have unsaved changes. Discard them?')) return;
    }
    setShowGoalsEditor(false);
    setHasGoalChanges(false);
    setGoalReloadKey((k) => k + 1);
  }, [hasGoalChanges]);

  const handleSaveGoalChanges = useCallback(() => {
    setSaveTriggerKey((k) => k + 1);
  }, []);

  // Stay in sync if DailyActivityForm changes schedule type during this session
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'dailyActivityScheduleType') {
        setScheduleType(e.newValue === 'wed-tue' ? 'wed-tue' : 'mon-sun');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const isManager = MANAGER_ROLES.includes((user?.clname || '').toUpperCase());

  const navigateBack = useCallback(() => {
    setCurrentDate((d) => {
      const n = new Date(d);
      if (viewScope === 'commits' || selectedRange === 'month') return new Date(n.getFullYear(), n.getMonth() - 1, 1);
      if (selectedRange === 'week') n.setDate(n.getDate() - 7);
      else return new Date(n.getFullYear() - 1, 0, 1);
      return n;
    });
  }, [selectedRange, viewScope]);

  const navigateForward = useCallback(() => {
    setCurrentDate((d) => {
      const n = new Date(d);
      if (viewScope === 'commits' || selectedRange === 'month') return new Date(n.getFullYear(), n.getMonth() + 1, 1);
      if (selectedRange === 'week') n.setDate(n.getDate() + 7);
      else return new Date(n.getFullYear() + 1, 0, 1);
      return n;
    });
  }, [selectedRange, viewScope]);

  const getLabel = useCallback(() => {
    // Commits view always shows month
    if (viewScope === 'commits') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    if (selectedRange === 'week') {
      const start = getWeekStart(currentDate, scheduleType);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const sameYear = start.getFullYear() === end.getFullYear();
      return `${fmt(start)} – ${fmt(end)}${sameYear ? `, ${start.getFullYear()}` : ''}`;
    }
    if (selectedRange === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    return `${currentDate.getFullYear()} YTD`;
  }, [selectedRange, currentDate, scheduleType, viewScope]);

  const handleRangeChange = useCallback((range) => {
    setSelectedRange(range);
    const today = new Date();
    if (range === 'week') setCurrentDate(today);
    else if (range === 'month') setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    else setCurrentDate(new Date(today.getFullYear(), 0, 1));
  }, []);

  useEffect(() => {
    if (showGoalsEditor) return; // goals editor owns this space
    setHeaderContent(
      <div className="date-range-selector-wrapper">
        <div className="date-range-selector">
          {isManager && (
            <>
              <div className="view-scope-buttons">
                {[
                  { id: 'personal', label: 'Personal' },
                  { id: 'team', label: 'Team' },
                  { id: 'commits', label: 'Commits' },
                ].map((s) => (
                  <Button
                    key={s.id}
                    variant={viewScope === s.id ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewScope(s.id)}
                    className="drs-btn"
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
              <div className="date-range-divider" />
            </>
          )}
          {viewScope !== 'commits' && (
            <>
              <div className="view-mode-buttons">
                {[
                  { id: 'week', label: 'Week' },
                  { id: 'month', label: 'MTD' },
                  { id: 'ytd', label: 'YTD' },
                ].map((p) => (
                  <Button
                    key={p.id}
                    variant={selectedRange === p.id ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleRangeChange(p.id)}
                    className="drs-btn"
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <div className="date-range-divider" />
            </>
          )}
          <Button variant="ghost" size="icon" onClick={navigateBack} className="drs-nav-btn">
            <FiChevronLeft className="nav-icon" />
          </Button>
          <div className="date-display">{getLabel()}</div>
          <Button variant="ghost" size="icon" onClick={navigateForward} className="drs-nav-btn">
            <FiChevronRight className="nav-icon" />
          </Button>
        </div>
      </div>
    );
    return () => setHeaderContent(null);
  }, [selectedRange, currentDate, viewScope, isManager, navigateBack, navigateForward, getLabel, handleRangeChange, setHeaderContent, showGoalsEditor, scheduleType]);

  // For commits view, force month-level navigation
  const commitsDate = viewScope === 'commits'
    ? new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    : currentDate;

  return (
    <>
      {viewScope === 'commits' ? (
        <CommitsOverviewTable currentDate={commitsDate} />
      ) : (
        <>
          {/* Always mounted headlessly to keep breakdown computed */}
          <ProductionGoals
            summaryOnly
            displayPeriod={selectedRange}
            weekStart={currentDate}
            externalViewScope={viewScope}
            onBreakdownChange={setBreakdown}
            reloadTrigger={goalReloadKey}
          />

          {/* Goals editor — always mounted for instant reveal, hidden when not active */}
          <div style={showGoalsEditor ? undefined : { display: 'none' }}>
            <div className="goals-editor-inplace">
              <div className="goals-editor-nav">
                <button className="goals-editor-back-btn" onClick={handleCloseGoalEditor}>
                  ← Back to Activity
                </button>
                {hasGoalChanges && (
                  <button className="goals-editor-save-btn" onClick={handleSaveGoalChanges}>
                    Save Changes
                  </button>
                )}
              </div>
              <ProductionGoals
                displayPeriod={selectedRange}
                weekStart={currentDate}
                externalViewScope={viewScope}
                suppressHeader={true}
                forceEditing={showGoalsEditor}
                onHasChanges={setHasGoalChanges}
                saveTrigger={saveTriggerKey}
              />
            </div>
          </div>

          {/* Activity table — always mounted, hidden when goals editor is open */}
          <div style={showGoalsEditor ? { display: 'none' } : undefined}>
            <DailyActivityForm
              controlled
              selectedRange={selectedRange}
              currentDate={currentDate}
              onRangeChange={setSelectedRange}
              onCurrentDateChange={setCurrentDate}
              viewScope={viewScope}
              breakdown={breakdown}
              onGoalEdit={handleOpenGoalEditor}
            />
          </div>
        </>
      )}
    </>
  );
};

export default ActivityGoalsCombinedPage;
