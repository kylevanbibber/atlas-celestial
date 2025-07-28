import React, { useState, useEffect } from 'react';
import { FaPlus, FaTrash, FaEdit, FaServer, FaHashtag, FaCopy, FaPlay } from 'react-icons/fa';
import api from '../../api';

const LeaderboardSettings = ({ leaderboards, setLeaderboards, configuredGuilds, availableManagers, userRole }) => {
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);

  const handleCreateLeaderboard = async (formData) => {
    try {
      const response = await api.post('/discord/leaderboards', formData);

      // Get the new leaderboard with its ID from the response
      const newLeaderboard = response.data.leaderboard || {
        ...formData,
        id: Date.now(), // Fallback ID if the API doesn't return the created leaderboard
        is_active: true
      };

      // Update local state
      setLeaderboards(prev => [...prev, newLeaderboard]);
      setShowLeaderboardModal(false);
    } catch (error) {
      console.error('Error creating leaderboard:', error);
    }
  };

  // Helper function to get dynamic manager label based on scope
  const getManagerLabel = (scope) => {
    switch (scope) {
      case 'mga_team': return 'MGA Manager';
      case 'rga_team': return 'RGA Manager';
      case 'family_tree': return 'Family Tree Manager';
      case 'agency_tree': return 'Agency Manager';
      case 'full_agency': return 'Full Agency Manager';
      default: return 'Manager (Team Owner)';
    }
  };

  return (
    <div className="settings-section">
      <div className="settings-card">
        <h2 className="settings-card-title">Discord Leaderboard Settings</h2>
        
        {/* Create New Leaderboard Button */}
        <div className="settings-row">
          <button 
            onClick={() => setShowLeaderboardModal(!showLeaderboardModal)} 
            className="settings-button"
            disabled={showLeaderboardModal}
          >
            <FaPlus /> {showLeaderboardModal ? 'Cancel' : 'Add Leaderboard'}
          </button>
        </div>

        {/* Create Form */}
        {showLeaderboardModal && (
          <div className="settings-card" style={{ marginTop: '20px' }}>
            <h3 className="settings-card-title">Create New Leaderboard</h3>
            <InlineLeaderboardForm 
              configuredGuilds={configuredGuilds}
              onSubmit={handleCreateLeaderboard}
              onCancel={() => setShowLeaderboardModal(false)}
              availableManagers={availableManagers}
              userRole={userRole}
            />
          </div>
        )}

        {/* Error/Success Messages */}
        {/* {message && (
          <div className={`settings-alert ${message.type === 'success' ? 'settings-alert-success' : 'settings-alert-error'}`}>
            {message.text}
          </div>
        )} */}

        {/* Loading State */}
        {/* {loading && (
          <div className="notification-loading">
            <div className="spinner"></div> Loading leaderboards...
          </div>
        )} */}

        {/* Leaderboards List */}
        {!showLeaderboardModal && leaderboards.length === 0 ? (
          <div className="notification-empty">
            <p>No leaderboards configured yet. Create your first one above!</p>
          </div>
        ) : (
          <div style={{ marginTop: '20px' }}>
            <h3 className="settings-card-title">Existing Leaderboards</h3>
            {leaderboards.map(leaderboard => (
              <LeaderboardItem
                key={leaderboard.id}
                leaderboard={leaderboard}
                userRole={userRole}
                onUpdate={setLeaderboards}
                configuredGuilds={configuredGuilds}
                availableManagers={availableManagers}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const LeaderboardItem = ({ leaderboard, onUpdate, configuredGuilds, availableManagers, userRole }) => {
  // Available metrics from Daily_Activity table
  const availableMetrics = [
    { key: 'calls', label: 'Calls' },
    { key: 'appts', label: 'Appointments' },
    { key: 'sits', label: 'Sits' },
    { key: 'sales', label: 'Sales' },
    { key: 'alp', label: 'ALP' },
    { key: 'refs', label: 'Referrals' },
    { key: 'refALP', label: 'Referral ALP' }
  ];

  // Parse cron expression to determine frequency
  const getFrequencyFromCron = (cronExpr) => {
    if (!cronExpr) return 'daily';
    
    const parts = cronExpr.split(' ');
    if (parts.length !== 5) return 'daily';
    
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    
    if (dayOfWeek === '5' && hour === '17') {
      return 'weekly_friday'; // Friday 5 PM
    } else if (dayOfWeek === '1' && hour === '9') {
      return 'weekly'; // Monday 9 AM
    } else if (dayOfMonth === '1' && hour === '9') {
      return 'monthly'; // 1st of month 9 AM
    } else if (hour === '9') {
      return 'daily'; // Daily 9 AM
    } else if (hour === '*') {
      return 'hourly'; // Every hour
    }
    
    return 'daily'; // Default fallback
  };

  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    guild_id: leaderboard.guild_id || '',
    channel_id: leaderboard.channel_id || '',
    scope: leaderboard.scope || 'rga_team',
    manager_id: leaderboard.manager_id || '',
    leaderboard_type: leaderboard.leaderboard_type || 'activity',
    metrics: Array.isArray(leaderboard.metrics) ? leaderboard.metrics : 
             (typeof leaderboard.metrics === 'string' ? JSON.parse(leaderboard.metrics || '["sales"]') : ['sales']),
    data_period: Array.isArray(leaderboard.data_period) ? leaderboard.data_period : 
                 (typeof leaderboard.data_period === 'string' ? JSON.parse(leaderboard.data_period || '["daily"]') : ['daily']),
    frequency: getFrequencyFromCron(leaderboard.cron_expr),
    top_count: leaderboard.top_count || 10,
    is_active: leaderboard.is_active !== undefined ? leaderboard.is_active : true
  });
  const [availableChannels, setAvailableChannels] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  // Filter managers based on scope
  const getFilteredManagers = (scope) => {
    if (!availableManagers || availableManagers.length === 0) return [];
    
    // Add logging for family_tree scope
    if (scope === 'family_tree') {
      console.log('Family Tree Options - All available managers:', availableManagers);
      const treeOptions = availableManagers.filter(manager => manager.clname === 'Tree');
      console.log('Family Tree Options - Filtered Tree managers:', treeOptions);
      return treeOptions;
    }
    
    switch (scope) {
      case 'mga_team':
        return availableManagers.filter(manager => manager.clname === 'MGA');
      case 'rga_team':
        return availableManagers.filter(manager => manager.clname === 'RGA');
      case 'family_tree':
      case 'full_agency':
        // For these scopes, show all managers
        return availableManagers;
      default:
        return availableManagers.filter(manager => manager.clname === 'MGA');
    }
  };

  // Get available metrics based on leaderboard type
  const getAvailableMetrics = (leaderboardType) => {
    if (leaderboardType === 'production') {
      return [
        { key: 'net', label: 'Net Production' },
        { key: 'gross', label: 'Gross Production' }
      ];
    } else {
      // Default to activity metrics
      return [
        { key: 'calls', label: 'Calls' },
        { key: 'appts', label: 'Appointments' },
        { key: 'sits', label: 'Sits' },
        { key: 'sales', label: 'Sales' },
        { key: 'alp', label: 'ALP' },
        { key: 'refs', label: 'Referrals' },
        { key: 'refALP', label: 'Referral ALP' }
      ];
    }
  };

  // Get available data periods based on leaderboard type
  const getAvailableDataPeriods = (leaderboardType) => {
    if (leaderboardType === 'production') {
      return [
        { key: 'weekly', label: 'Weekly' },
        { key: 'mtd', label: 'Month to Date' },
        { key: 'ytd', label: 'Year to Date' }
      ];
    } else {
      // Default to activity periods
      return [
        { key: 'daily', label: 'Daily' },
        { key: 'weekly', label: 'Weekly' },
        { key: 'monthly', label: 'Monthly' }
      ];
    }
  };

  // Update frequency when editing starts
  useEffect(() => {
    if (editing) {
      setFormData(prev => ({
        ...prev,
        frequency: getFrequencyFromCron(leaderboard.cron_expr)
      }));
    }
  }, [editing, leaderboard.cron_expr]);

  // Load channels when guild is selected and in edit mode
  useEffect(() => {
    if (!editing || !formData.guild_id) {
      return;
    }

    const loadChannels = async () => {
      try {
        setLoadingChannels(true);
        const response = await api.get(`/discord/guilds/${formData.guild_id}/channels`);
        if (response.data && response.data.channels) {
          setAvailableChannels(response.data.channels);
        }
      } catch (error) {
        console.error('Error loading channels:', error);
        setAvailableChannels([]);
      } finally {
        setLoadingChannels(false);
      }
    };

    loadChannels();
  }, [formData.guild_id, editing]);

  // Generate cron expression based on frequency
  const generateCronExpression = (frequency) => {
    switch (frequency) {
      case 'hourly':
        return '0 * * * *'; // Every hour at minute 0
      case 'daily':
        return '0 9 * * *'; // Every day at 9 AM
      case 'weekly':
        return '0 9 * * 1'; // Every Monday at 9 AM
      case 'weekly_friday':
        return '0 17 * * 5'; // Every Friday at 5 PM
      case 'monthly':
        return '0 9 1 * *'; // 1st of every month at 9 AM
      default:
        return '0 9 * * *';
    }
  };

  const handleMetricToggle = (metricKey) => {
    setFormData(prev => ({
      ...prev,
      metrics: prev.metrics.includes(metricKey)
        ? prev.metrics.filter(m => m !== metricKey)
        : [...prev.metrics, metricKey]
    }));
  };

  const handleDataPeriodToggle = (period) => {
    setFormData(prev => ({
      ...prev,
      data_period: prev.data_period.includes(period)
        ? prev.data_period.filter(p => p !== period)
        : [...prev.data_period, period]
    }));
  };

  const handleUpdate = async () => {
    try {
      if (formData.metrics.length === 0) {
        alert('Please select at least one metric to track');
        return;
      }

      if (formData.data_period.length === 0) {
        alert('Please select at least one data period');
        return;
      }

      // Get guild and channel names
      let guildName = leaderboard.guild_name;
      let channelName = leaderboard.channel_name;

      // If the server or channel has changed, get the new names
      if (formData.guild_id !== leaderboard.guild_id || formData.channel_id !== leaderboard.channel_id) {
        // Try to get from configuredGuilds
        const selectedGuild = configuredGuilds.find(g => g.guild_id === formData.guild_id);
        if (selectedGuild) {
          guildName = selectedGuild.guild_name;
        }
        
        // Try to get from availableChannels
        const selectedChannel = availableChannels.find(c => c.id === formData.channel_id);
        if (selectedChannel) {
          channelName = selectedChannel.name;
        }
      }

      const updatedData = {
        guild_id: formData.guild_id,
        guild_name: guildName,
        channel_id: formData.channel_id,
        channel_name: channelName,
        cron_expr: generateCronExpression(formData.frequency),
        metric_type: formData.leaderboard_type === 'production' ? 'production_leaderboard' : 'activity_leaderboard',
        leaderboard_type: formData.leaderboard_type,
        metrics: formData.metrics,
        data_period: Array.isArray(formData.data_period) ? formData.data_period : [formData.data_period],
        scope: formData.scope,
        top_count: formData.top_count,
        is_active: formData.is_active
      };

      // Add manager_id if admin and changed
      if (userRole === 'Admin') {
        updatedData.manager_id = formData.manager_id;
      }
      
      await api.put(`/discord/leaderboards/${leaderboard.id}`, updatedData);
      setEditing(false);
      
      // Update the leaderboard in the parent component's state
      onUpdate(prev => prev.map(l => 
        l.id === leaderboard.id ? { ...l, ...updatedData } : l
      ));
    } catch (error) {
      console.error('Error updating leaderboard:', error);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this leaderboard?')) {
      return;
    }
    
    try {
      await api.delete(`/discord/leaderboards/${leaderboard.id}`);
      
      // Remove the leaderboard from the parent component's state
      onUpdate(prev => prev.filter(l => l.id !== leaderboard.id));
    } catch (error) {
      console.error('Error deleting leaderboard:', error);
    }
  };

  const handleTestLeaderboard = async () => {
    if (!leaderboard.id) return;
    
    try {
      setSendingTest(true);
      await api.post(`/discord/leaderboards/${leaderboard.id}/test`);
      alert('Test leaderboard sent successfully!');
    } catch (error) {
      console.error('Error sending test leaderboard:', error);
      alert(`Failed to send test leaderboard: ${error.response?.data?.error || error.message}`);
    } finally {
      setSendingTest(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      // Create a new leaderboard with the same data as this one
      // Get the guild and channel names
      const selectedGuild = configuredGuilds.find(g => 
        g.guild_id === leaderboard.guild_id
      );

      const duplicateData = {
        guild_id: leaderboard.guild_id,
        guild_name: leaderboard.guild_name || (selectedGuild?.guild_name || 'Unknown Server'),
        channel_id: leaderboard.channel_id,
        channel_name: leaderboard.channel_name || 'Unknown Channel',
        cron_expr: generateCronExpression(formData.frequency),
        metric_type: 'activity_leaderboard',
        metrics: leaderboard.metrics,
        data_period: leaderboard.data_period,
        scope: leaderboard.scope,
        top_count: leaderboard.top_count
      };

      // Add manager_id if admin
      if (userRole === 'Admin' && leaderboard.manager_id) {
        duplicateData.manager_id = leaderboard.manager_id;
      }

      const response = await api.post('/discord/leaderboards', duplicateData);

      // Get the new leaderboard with its ID from the response
      const newLeaderboard = response.data.leaderboard || {
        ...leaderboard,
        id: Date.now(), // Fallback ID if the API doesn't return the created leaderboard
        is_active: true
      };

      // Update local state
      onUpdate(prev => [...prev, newLeaderboard]);
      
      // Show a brief success message
      alert('Leaderboard duplicated successfully');
    } catch (error) {
      console.error('Error duplicating leaderboard:', error);
      alert('Failed to duplicate leaderboard');
    }
  };

  // Format metrics for display
  const formatMetrics = (metrics) => {
    if (!Array.isArray(metrics)) return 'Sales';
    return metrics.map(m => availableMetrics.find(am => am.key === m)?.label || m).join(', ');
  };

  // Format frequency for display
  const formatFrequency = (cronExpr) => {
    const frequency = getFrequencyFromCron(cronExpr);
    const frequencyLabels = {
      'hourly': 'Hourly',
      'daily': 'Daily',
      'weekly': 'Weekly (Monday 9 AM)',
      'weekly_friday': 'Weekly (Friday 5 PM)',
      'monthly': 'Monthly'
    };
    return frequencyLabels[frequency] || frequency.charAt(0).toUpperCase() + frequency.slice(1);
  };

  // Format scope for display
  const formatScope = (scope) => {
    switch (scope) {
      case 'mga_team': return 'MGA Team';
      case 'rga_team': return 'RGA Team';
      case 'family_tree': return 'Family Tree';
      case 'agency_tree': return 'Agency Tree';
      case 'full_agency': return 'Full Agency';
      default: return scope || 'MGA Team';
    }
  };

  // Format data periods for display
  const formatDataPeriods = (dataPeriods) => {
    if (!Array.isArray(dataPeriods)) return 'Daily';
    return dataPeriods.map(p => {
      switch (p) {
        case 'daily': return 'Daily';
        case 'weekly': return 'Weekly';
        case 'monthly': return 'Monthly';
        default: return p;
      }
    }).join(', ');
  };

  // Helper function to get dynamic manager label based on scope
  const getManagerLabel = (scope) => {
    switch (scope) {
      case 'mga_team': return 'MGA Manager';
      case 'rga_team': return 'RGA Manager';
      case 'family_tree': return 'Family Tree Manager';
      case 'agency_tree': return 'Agency Manager';
      case 'full_agency': return 'Full Agency Manager';
      default: return 'Manager (Team Owner)';
    }
  };

  return (
    <div className="settings-card" style={{ marginBottom: '16px' }}>
      {editing ? (
        <div>
          <h4 className="settings-card-title">Edit Leaderboard</h4>
          
          <div className="form-row">
            <div className="form-group">
              <label>Leaderboard Type:</label>
              <select
                value={formData.leaderboard_type}
                onChange={(e) => {
                  const newType = e.target.value;
                  setFormData({
                    ...formData, 
                    leaderboard_type: newType,
                    metrics: newType === 'production' ? ['net'] : ['sales'],
                    data_period: newType === 'production' ? ['weekly'] : ['daily'],
                    frequency: newType === 'production' ? 'weekly_friday' : formData.frequency
                  });
                }}
                className="settings-row select"
              >
                <option value="activity">Daily Activity</option>
                <option value="production">Production Reports</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Scope:</label>
              <select
                value={formData.scope}
                onChange={(e) => {
                  const newScope = e.target.value;
                  setFormData({
                    ...formData, 
                    scope: newScope,
                    manager_id: ''
                  });
                }}
                className="settings-row select"
              >
                <option value="rga_team">RGA Team</option>
                <option value="family_tree">Family Tree</option>
                <option value="full_agency">Organization</option>
              </select>
            </div>
          </div>

          {userRole === 'Admin' && formData.scope !== 'full_agency' && (
            <div className="form-row">
              <div className="form-group">
                <label>{getManagerLabel(formData.scope)}:</label>
                <select 
                  value={formData.manager_id}
                  onChange={(e) => setFormData({...formData, manager_id: e.target.value})}
                  className="settings-row select"
                >
                  <option value="">Choose manager...</option>
                  {getFilteredManagers(formData.scope).map(manager => (
                    <option key={manager.id} value={manager.id}>
                      {manager.lagnname}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Server:</label>
              <select 
                value={formData.guild_id}
                onChange={(e) => {
                  setFormData({
                    ...formData, 
                    guild_id: e.target.value,
                    channel_id: '' // Reset channel when server changes
                  });
                }}
                required
                className="settings-row select"
              >
                {configuredGuilds
                  .filter((guild, index, self) => 
                    // Filter unique servers (some may have multiple channel configs)
                    index === self.findIndex(g => g.guild_id === guild.guild_id)
                  )
                  .map(guild => (
                    <option key={guild.guild_id} value={guild.guild_id}>
                      {guild.guild_name}
                    </option>
                  ))
                }
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Channel:</label>
              <select 
                value={formData.channel_id}
                onChange={(e) => setFormData({...formData, channel_id: e.target.value})}
                required
                className="settings-row select"
                disabled={loadingChannels}
              >
                <option value="">
                  {loadingChannels ? 'Loading channels...' : 'Choose channel...'}
                </option>
                {availableChannels
                  .filter(channel => channel.type === 0) // Only text channels
                  .map(channel => (
                    <option key={channel.id} value={channel.id}>
                      #{channel.name}
                    </option>
                  ))
                }
              </select>
              {formData.guild_id && availableChannels.length === 0 && !loadingChannels && (
                <div style={{ fontSize: '0.85em', color: 'var(--error-color)', marginTop: '5px' }}>
                  No channels available. Make sure the bot has been added to this server.
                </div>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Metrics:</label>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
                gap: '8px',
                padding: '8px',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-tertiary)'
              }}>
                {getAvailableMetrics(formData.leaderboard_type).map(metric => (
                  <label key={metric.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9em' }}>
                    <input
                      type="checkbox"
                      checked={formData.metrics.includes(metric.key)}
                      onChange={() => handleMetricToggle(metric.key)}
                    />
                    {metric.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Data Periods:</label>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', 
                gap: '8px',
                padding: '8px',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-tertiary)'
              }}>
                {getAvailableDataPeriods(formData.leaderboard_type).map(period => (
                  <label key={period.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9em' }}>
                    <input
                      type="checkbox"
                      checked={formData.data_period.includes(period.key)}
                      onChange={() => handleDataPeriodToggle(period.key)}
                    />
                    {period.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Frequency:</label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({...formData, frequency: e.target.value})}
                className="settings-row select"
                disabled={formData.leaderboard_type === 'production'}
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly (Monday 9 AM)</option>
                <option value="weekly_friday">Weekly (Friday 5 PM)</option>
                <option value="monthly">Monthly</option>
              </select>
              {formData.leaderboard_type === 'production' && (
                <div style={{ fontSize: '0.8em', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Production leaderboards are automatically sent weekly on Friday at 5 PM
                </div>
              )}
            </div>
            
            <div className="form-group">
              <label>Top Count:</label>
              <input
                type="number"
                value={formData.top_count}
                onChange={(e) => setFormData({...formData, top_count: parseInt(e.target.value) || 10})}
                min="1"
                max="50"
                className="settings-row input"
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <div className="switch-container">
                <label>Active:</label>
                <div className="switch">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                  />
                  <span className="slider"></span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="form-actions">
            <button onClick={handleUpdate} className="settings-button">Save</button>
            <button onClick={() => setEditing(false)} className="settings-button-secondary">Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
            {/* Server and channel info */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              fontSize: '0.85em',
              marginBottom: '5px',
              color: 'var(--text-secondary)'
            }}>
              <FaServer style={{ fontSize: '0.9em' }} />
              <span>{leaderboard.guild_name || 'Unknown Server'}</span>
              <FaHashtag style={{ fontSize: '0.9em' }} />
              <span>{leaderboard.channel_name || 'Unknown Channel'}</span>
            </div>

            {/* Manager and Creator info for admins */}
            {userRole === 'Admin' && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                fontSize: '0.85em',
                marginBottom: '5px',
                color: 'var(--text-secondary)'
              }}>
                <span>
                  <strong>Manager:</strong> {leaderboard.manager_lagnname || 'Unknown'} 
                  ({leaderboard.manager_first_name} {leaderboard.manager_last_name})
                </span>
                {leaderboard.created_by_first_name && (
                  <span>
                    <strong>Created by:</strong> {leaderboard.created_by_first_name} {leaderboard.created_by_last_name}
                  </span>
                )}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
                {formatMetrics(leaderboard.metrics)}
              </span>
              <span style={{ fontSize: '0.9em', color: 'var(--text-secondary)' }}>
                {formatDataPeriods(leaderboard.data_period)} data
              </span>
              <span style={{ fontSize: '0.9em', color: 'var(--text-secondary)' }}>
                {formatFrequency(leaderboard.cron_expr)} updates
              </span>
              <span style={{ fontSize: '0.9em', color: 'var(--text-secondary)' }}>
                Top {leaderboard.top_count}
              </span>
              <span style={{ fontSize: '0.9em', color: 'var(--text-secondary)' }}>
                {formatScope(leaderboard.scope)}
              </span>
              <span style={{
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '500',
                background: leaderboard.is_active ? 'var(--success-bg, #d4edda)' : 'var(--error-bg, #f8d7da)',
                color: leaderboard.is_active ? 'var(--success-color, #155724)' : 'var(--error-color, #721c24)'
              }}>
                {leaderboard.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={handleTestLeaderboard} 
              className="settings-button-secondary"
              disabled={sendingTest}
              title="Send test leaderboard to channel"
            >
              {sendingTest ? '...' : 'Test'}
            </button>
            <button 
              onClick={handleDuplicate} 
              className="settings-button-secondary"
              title="Duplicate leaderboard"
            >
              <FaCopy />
            </button>
            <button onClick={() => setEditing(true)} className="settings-button-secondary" style={{ padding: '6px 10px' }}>
              <FaEdit />
            </button>
            <button onClick={handleDelete} className="settings-button-secondary" style={{ padding: '6px 10px' }}>
              <FaTrash />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const InlineLeaderboardForm = ({ configuredGuilds, onSubmit, onCancel, availableManagers, userRole }) => {
  const [formData, setFormData] = useState({
    guild_id: '',
    channel_id: '',
    scope: 'rga_team',
    manager_id: '',
    leaderboard_type: 'activity',
    metrics: ['sales'],
    data_period: ['daily'],
    frequency: 'daily', // How often to send (hourly, daily, weekly, monthly)
    top_count: 10
  });
  const [availableChannels, setAvailableChannels] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(false);

  // Helper function to get dynamic manager label based on scope
  const getManagerLabel = (scope) => {
    switch (scope) {
      case 'mga_team': return 'MGA Manager';
      case 'rga_team': return 'RGA Manager';
      case 'family_tree': return 'Family Tree Manager';
      case 'agency_tree': return 'Agency Manager';
      case 'full_agency': return 'Full Agency Manager';
      default: return 'Manager (Team Owner)';
    }
  };

  // Filter managers based on scope
  const getFilteredManagers = (scope) => {
    if (!availableManagers || availableManagers.length === 0) return [];
    
    // Add logging for family_tree scope
    if (scope === 'family_tree') {
      console.log('Family Tree Options - All available managers:', availableManagers);
      const treeOptions = availableManagers.filter(manager => manager.clname === 'Tree');
      console.log('Family Tree Options - Filtered Tree managers:', treeOptions);
      return treeOptions;
    }
    
    switch (scope) {
      case 'mga_team':
        return availableManagers.filter(manager => manager.clname === 'MGA');
      case 'rga_team':
        return availableManagers.filter(manager => manager.clname === 'RGA');
      case 'family_tree':
      case 'agency_tree':
      case 'full_agency':
        // For these scopes, show all managers
        return availableManagers;
      default:
        return availableManagers.filter(manager => manager.clname === 'MGA');
    }
  };

  // Get available metrics based on leaderboard type
  const getAvailableMetrics = (leaderboardType) => {
    if (leaderboardType === 'production') {
      return [
        { key: 'net', label: 'Net Production' },
        { key: 'gross', label: 'Gross Production' }
      ];
    } else {
      // Default to activity metrics
      return [
        { key: 'calls', label: 'Calls' },
        { key: 'appts', label: 'Appointments' },
        { key: 'sits', label: 'Sits' },
        { key: 'sales', label: 'Sales' },
        { key: 'alp', label: 'ALP' },
        { key: 'refs', label: 'Referrals' },
        { key: 'refALP', label: 'Referral ALP' }
      ];
    }
  };

  // Get available data periods based on leaderboard type
  const getAvailableDataPeriods = (leaderboardType) => {
    if (leaderboardType === 'production') {
      return [
        { key: 'weekly', label: 'Weekly' },
        { key: 'mtd', label: 'Month to Date' },
        { key: 'ytd', label: 'Year to Date' }
      ];
    } else {
      // Default to activity periods
      return [
        { key: 'daily', label: 'Daily' },
        { key: 'weekly', label: 'Weekly' },
        { key: 'monthly', label: 'Monthly' }
      ];
    }
  };

  // Load channels when guild is selected
  useEffect(() => {
    if (!formData.guild_id) {
      setAvailableChannels([]);
      return;
    }

    const loadChannels = async () => {
      try {
        setLoadingChannels(true);
        const response = await api.get(`/discord/guilds/${formData.guild_id}/channels`);
        if (response.data && response.data.channels) {
          setAvailableChannels(response.data.channels);
        }
      } catch (error) {
        console.error('Error loading channels:', error);
        setAvailableChannels([]);
      } finally {
        setLoadingChannels(false);
      }
    };

    loadChannels();
  }, [formData.guild_id]);

  // Generate cron expression based on frequency
  const generateCronExpression = (frequency) => {
    switch (frequency) {
      case 'hourly':
        return '0 * * * *'; // Every hour at minute 0
      case 'daily':
        return '0 9 * * *'; // Every day at 9 AM
      case 'weekly':
        return '0 9 * * 1'; // Every Monday at 9 AM
      case 'weekly_friday':
        return '0 17 * * 5'; // Every Friday at 5 PM
      case 'monthly':
        return '0 9 1 * *'; // 1st of every month at 9 AM
      default:
        return '0 9 * * *';
    }
  };

  const handleMetricToggle = (metricKey) => {
    setFormData(prev => ({
      ...prev,
      metrics: prev.metrics.includes(metricKey)
        ? prev.metrics.filter(m => m !== metricKey)
        : [...prev.metrics, metricKey]
    }));
  };

  const handleDataPeriodToggle = (period) => {
    setFormData(prev => ({
      ...prev,
      data_period: prev.data_period.includes(period)
        ? prev.data_period.filter(p => p !== period)
        : [...prev.data_period, period]
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (formData.metrics.length === 0) {
      alert('Please select at least one metric to track');
      return;
    }

    if (formData.data_period.length === 0) {
      alert('Please select at least one data period');
      return;
    }

    const leaderboardData = {
      guild_id: formData.guild_id,
      channel_id: formData.channel_id,
      cron_expr: generateCronExpression(formData.frequency),
      metric_type: formData.leaderboard_type === 'production' ? 'production_leaderboard' : 'activity_leaderboard',
      leaderboard_type: formData.leaderboard_type,
      metrics: formData.metrics,
      data_period: Array.isArray(formData.data_period) ? formData.data_period : [formData.data_period],
      scope: formData.scope,
      top_count: formData.top_count
    };

    // Add manager_id if admin selected one
    if (userRole === 'Admin' && formData.manager_id) {
      leaderboardData.manager_id = formData.manager_id;
    }
    
    onSubmit(leaderboardData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-row">
        <div className="form-group">
          <label>Leaderboard Type:</label>
          <select
            value={formData.leaderboard_type}
            onChange={(e) => {
              const newType = e.target.value;
              setFormData({
                ...formData, 
                leaderboard_type: newType,
                metrics: newType === 'production' ? ['net'] : ['sales'], // Reset metrics when type changes
                data_period: newType === 'production' ? ['weekly'] : ['daily'], // Reset periods when type changes
                frequency: newType === 'production' ? 'weekly_friday' : formData.frequency // Set Friday 5pm for production
              });
            }}
            className="settings-row select"
          >
            <option value="activity">Daily Activity</option>
            <option value="production">Production Reports</option>
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Scope:</label>
          <select
            value={formData.scope}
            onChange={(e) => {
              const newScope = e.target.value;
              setFormData({
                ...formData, 
                scope: newScope,
                manager_id: '' // Reset manager when scope changes
              });
            }}
            className="settings-row select"
          >
            <option value="mga_team">MGA</option>
            <option value="rga_team">RGA</option>
            <option value="family_tree">Tree</option>
            <option value="full_agency">Organization</option>
          </select>
        </div>
      </div>

      {userRole === 'Admin' && (
        <div className="form-row">
          <div className="form-group">
            <label>{getManagerLabel(formData.scope)}:</label>
            <select 
              value={formData.manager_id}
              onChange={(e) => setFormData({...formData, manager_id: e.target.value})}
              className="settings-row select"
            >
              <option value="">Use my team (default)</option>
              {getFilteredManagers(formData.scope).map(manager => (
                <option key={manager.id} value={manager.id}>
                  {manager.lagnname}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label>Discord Server:</label>
          <select 
            value={formData.guild_id}
            onChange={(e) => {
              setFormData({...formData, guild_id: e.target.value, channel_id: ''});
            }}
            required
            className="settings-row select"
          >
            <option value="">Select a server...</option>
            {configuredGuilds.map(guild => (
              <option key={guild.guild_id} value={guild.guild_id}>
                {guild.guild_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Discord Channel:</label>
          <select 
            value={formData.channel_id}
            onChange={(e) => setFormData({...formData, channel_id: e.target.value})}
            required
            disabled={!formData.guild_id}
            className="settings-row select"
          >
            <option value="">Select a channel...</option>
            {availableChannels.map(channel => (
              <option key={channel.id} value={channel.id}>
                #{channel.name}
              </option>
            ))}
          </select>

        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Data Periods:</label>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', 
            gap: '8px',
            padding: '8px',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            backgroundColor: 'var(--bg-tertiary)'
          }}>
            {getAvailableDataPeriods(formData.leaderboard_type).map(period => (
              <label key={period.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9em' }}>
                <input
                  type="checkbox"
                  checked={formData.data_period.includes(period.key)}
                  onChange={() => handleDataPeriodToggle(period.key)}
                />
                {period.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Update Frequency:</label>
          <select
            value={formData.frequency}
            onChange={(e) => setFormData({...formData, frequency: e.target.value})}
            className="settings-row select"
            disabled={formData.leaderboard_type === 'production'}
          >
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly (Monday 9 AM)</option>
            <option value="weekly_friday">Weekly (Friday 5 PM)</option>
            <option value="monthly">Monthly</option>
          </select>
          {formData.leaderboard_type === 'production' && (
            <div style={{ fontSize: '0.8em', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Production leaderboards are automatically sent weekly on Friday at 5 PM
            </div>
          )}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Top Count:</label>
          <input
            type="number"
            value={formData.top_count}
            onChange={(e) => setFormData({...formData, top_count: parseInt(e.target.value) || 10})}
            min="1"
            max="50"
            required
            className="settings-row input"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Metrics to Track:</label>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
            gap: '8px',
            padding: '10px',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            backgroundColor: 'var(--bg-tertiary)'
          }}>
            {getAvailableMetrics(formData.leaderboard_type).map(metric => (
              <label key={metric.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9em' }}>
                <input
                  type="checkbox"
                  checked={formData.metrics.includes(metric.key)}
                  onChange={() => handleMetricToggle(metric.key)}
                />
                {metric.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button type="button" onClick={onCancel} className="settings-button-secondary">
          Cancel
        </button>
        <button type="submit" className="settings-button">
          Create Leaderboard
        </button>
      </div>
    </form>
  );
};

export default LeaderboardSettings; 