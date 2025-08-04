import React, { useState, useEffect } from 'react';
import './Widgets.css';

const ActivityCardWidget = ({ showRecent = 5, onError }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, [showRecent]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      
      // Mock activity data - replace with actual API calls
      const mockActivities = [
        {
          id: 1,
          type: 'sale',
          title: 'New Policy Sold',
          description: 'Term Life Policy - $500K',
          timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
          icon: '💰',
          color: 'success'
        },
        {
          id: 2,
          type: 'meeting',
          title: 'Client Meeting',
          description: 'Follow-up with John Smith',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
          icon: '👥',
          color: 'info'
        },
        {
          id: 3,
          type: 'lead',
          title: 'New Lead Generated',
          description: 'Warm lead from referral',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
          icon: '🎯',
          color: 'warning'
        },
        {
          id: 4,
          type: 'task',
          title: 'Task Completed',
          description: 'Updated client contact information',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
          icon: '✅',
          color: 'success'
        },
        {
          id: 5,
          type: 'appointment',
          title: 'Appointment Scheduled',
          description: 'Insurance review with Sarah Johnson',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8), // 8 hours ago
          icon: '📅',
          color: 'primary'
        },
        {
          id: 6,
          type: 'document',
          title: 'Document Uploaded',
          description: 'Policy documents for processing',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
          icon: '📄',
          color: 'secondary'
        },
        {
          id: 7,
          type: 'call',
          title: 'Phone Call',
          description: 'Prospecting call with potential client',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
          icon: '📞',
          color: 'info'
        }
      ];

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setActivities(mockActivities.slice(0, showRecent));
    } catch (error) {
      onError && onError(error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return `${days}d ago`;
    }
  };

  if (loading) {
    return (
      <div className="widget-loading">
        <div className="spinner"></div>
        <span>Loading activities...</span>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="activity-empty">
        <div className="empty-icon">📋</div>
        <p>No recent activities</p>
      </div>
    );
  }

  return (
    <div className="activity-widget">
      <div className="activity-list">
        {activities.map(activity => (
          <ActivityItem 
            key={activity.id}
            activity={activity}
            formatTimestamp={formatTimestamp}
          />
        ))}
      </div>
      
      {activities.length >= showRecent && (
        <div className="activity-footer">
          <button className="view-all-btn">
            View All Activities
          </button>
        </div>
      )}
    </div>
  );
};

const ActivityItem = ({ activity, formatTimestamp }) => {
  return (
    <div className={`activity-item ${activity.color}`}>
      <div className="activity-icon">
        {activity.icon}
      </div>
      <div className="activity-content">
        <div className="activity-header">
          <h5 className="activity-title">{activity.title}</h5>
          <span className="activity-time">
            {formatTimestamp(activity.timestamp)}
          </span>
        </div>
        <p className="activity-description">{activity.description}</p>
      </div>
    </div>
  );
};

export default ActivityCardWidget;