import React, { useState, useCallback } from 'react';
import { FiGlobe, FiUsers, FiPlus, FiMaximize2, FiMinimize2 } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import ActivityFeedList from '../components/activityFeed/ActivityFeedList';
import AddSaleModal from '../components/activityFeed/AddSaleModal';
import './ActivityFeed.css';

const TABS = [
  { key: 'org', label: 'Org', icon: <FiGlobe size={15} /> },
  { key: 'team', label: 'My Team', icon: <FiUsers size={15} /> },
];

const ActivityFeed = () => {
  const { user } = useAuth();
  const isSGA = user?.clname === 'SGA';
  const [activeTab, setActiveTab] = useState('org');
  const [showAddSale, setShowAddSale] = useState(false);
  const [addEventFn, setAddEventFn] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleRegisterAddEvent = useCallback((fn) => {
    setAddEventFn(() => fn);
  }, []);

  const handleSaleAdded = useCallback((event) => {
    if (addEventFn) addEventFn(event);
  }, [addEventFn]);

  return (
    <div className={`activity-feed-page${isExpanded ? ' expanded' : ''}`}>
      <div className="activity-feed-page-header">
        <div className="activity-feed-title-row">
          <h2>Activity Feed</h2>
          <button
            className="activity-feed-expand-btn"
            onClick={() => setIsExpanded(v => !v)}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <FiMinimize2 size={15} /> : <FiMaximize2 size={15} />}
            <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
          </button>
        </div>
        {!isSGA && (
          <div className="activity-feed-header-row">
            <div className="activity-feed-tabs">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  className={`activity-feed-tab${activeTab === tab.key ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              className="activity-feed-add-btn"
              onClick={() => setShowAddSale(true)}
              title="Log a sale"
            >
              <FiPlus size={18} />
            </button>
          </div>
        )}
      </div>
      <ActivityFeedList scope={activeTab} onRegisterAddEvent={handleRegisterAddEvent} />
      {showAddSale && (
        <AddSaleModal
          onClose={() => setShowAddSale(false)}
          onSaleAdded={handleSaleAdded}
        />
      )}
    </div>
  );
};

export default ActivityFeed;
