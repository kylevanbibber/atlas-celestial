import React, { useState, useEffect } from 'react';
import Card from '../../utils/Card';
import './Widgets.css';

const StatCardWidget = ({ variant = 'default', onError }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [variant]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      // Mock data - replace with actual API calls based on your existing patterns
      const mockStats = {
        overview: {
          title: 'Overview',
          value: '24,562',
          subtitle: 'Total Production',
          percentage: '+12.5%',
          trend: 'up'
        },
        summary: {
          title: 'Monthly Summary',
          value: '8,420',
          subtitle: 'This Month',
          percentage: '+8.2%',
          trend: 'up'
        },
        detailed: {
          title: 'Detailed Stats',
          value: '156',
          subtitle: 'Active Cases',
          percentage: '-2.1%',
          trend: 'down'
        },
        default: {
          title: 'Quick Stats',
          value: '42',
          subtitle: 'Key Metric',
          percentage: '+5.7%',
          trend: 'up'
        }
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setStats(mockStats[variant] || mockStats.default);
    } catch (error) {
      onError && onError(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="widget-loading">
        <div className="spinner"></div>
        <span>Loading statistics...</span>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="widget-error">
        Unable to load statistics
      </div>
    );
  }

  // Use the Card component
  return (
    <Card 
      title={stats.title}
      value={stats.value}
      subText={stats.subtitle}
      className="dashboard-card"
    />
  );
};

export default StatCardWidget;