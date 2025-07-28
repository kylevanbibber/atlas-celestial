import React, { useState, useEffect } from 'react';
import { FaPlus, FaTrash, FaEdit, FaClock, FaServer, FaHashtag, FaCopy } from 'react-icons/fa';
import api from '../../api';

const ReminderSettings = ({ reminders, setReminders, configuredGuilds }) => {
  const [showReminderModal, setShowReminderModal] = useState(false);

  const handleCreateReminder = async (formData) => {
    try {
      const response = await api.post('/discord/reminders', formData);

      // Get the new reminder with its ID from the response
      const newReminder = response.data.reminder || {
        ...formData,
        id: Date.now(), // Fallback ID if the API doesn't return the created reminder
        is_active: true
      };

      // Update local state
      setReminders(prev => [...prev, newReminder]);
      setShowReminderModal(false);
    } catch (error) {
      console.error('Error creating reminder:', error);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Scheduled Reminders</h3>
        <button onClick={() => setShowReminderModal(true)} className="settings-button">
          <FaPlus /> Add Reminder
        </button>
      </div>

      {reminders.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '40px' }}>
          No reminders configured yet.
        </p>
      ) : (
        <div>
          {reminders.map((reminder) => (
            <ReminderItem 
              key={reminder.id} 
              reminder={reminder} 
              onUpdate={setReminders}
              configuredGuilds={configuredGuilds}
            />
          ))}
        </div>
      )}

      {showReminderModal && (
        <ReminderModal 
          configuredGuilds={configuredGuilds}
          onSubmit={handleCreateReminder}
          onClose={() => setShowReminderModal(false)}
        />
      )}
    </div>
  );
};

// Sub-components using existing styles
const ReminderItem = ({ reminder, onUpdate, configuredGuilds }) => {
  // Parse the cron expression to determine schedule type
  const parseCronToSchedule = (cronExpr) => {
    const parts = cronExpr.split(' ');
    if (parts.length !== 5) return { type: 'recurring', recurringType: 'daily' };
    
    const [minute, hour, day, month, dayOfWeek] = parts;
    
    // Specific date = one-time/later
    if (day !== '*' && month !== '*') {
      return {
        type: 'later',
        scheduleTime: getDateTimeFromCron(cronExpr)
      };
    }
    
    // Hourly
    if (minute !== '*' && hour === '*' && day === '*' && month === '*' && dayOfWeek === '*') {
      return {
        type: 'recurring',
        recurringType: 'hourly',
        recurringMinute: minute
      };
    }
    
    // Daily
    if (hour !== '*' && day === '*' && month === '*' && dayOfWeek === '*') {
      // Format hour and minute with leading zeros
      const formattedHour = hour.padStart(2, '0');
      const formattedMinute = minute.padStart(2, '0');
      
      return {
        type: 'recurring',
        recurringType: 'daily',
        recurringTime: `${formattedHour}:${formattedMinute}`
      };
    }
    
    // Weekly
    if (hour !== '*' && day === '*' && month === '*' && dayOfWeek !== '*') {
      // Format hour and minute with leading zeros
      const formattedHour = hour.padStart(2, '0');
      const formattedMinute = minute.padStart(2, '0');
      
      return {
        type: 'recurring',
        recurringType: 'weekly',
        recurringDay: dayOfWeek,
        recurringTime: `${formattedHour}:${formattedMinute}`
      };
    }
    
    // Monthly
    if (hour !== '*' && day !== '*' && month === '*' && dayOfWeek === '*') {
      // Format hour and minute with leading zeros
      const formattedHour = hour.padStart(2, '0');
      const formattedMinute = minute.padStart(2, '0');
      
      return {
        type: 'recurring',
        recurringType: 'monthly',
        recurringDay: day,
        recurringTime: `${formattedHour}:${formattedMinute}`
      };
    }
    
    // Default to daily at the specified time, or 9am if not specified
    const formattedHour = hour !== '*' ? hour.padStart(2, '0') : '09';
    const formattedMinute = minute !== '*' ? minute.padStart(2, '0') : '00';
    
    return {
      type: 'recurring',
      recurringType: 'daily',
      recurringTime: `${formattedHour}:${formattedMinute}`
    };
  };
  
  // Convert cron to datetime string for input
  const getDateTimeFromCron = (cronExpr) => {
    try {
      const parts = cronExpr.split(' ');
      if (parts.length !== 5) return '';
      
      const [minute, hour, day, month] = parts;
      
      // Format all parts with leading zeros
      const formattedMinute = minute.padStart(2, '0');
      const formattedHour = hour.padStart(2, '0');
      const formattedDay = day.padStart(2, '0');
      const formattedMonth = month.padStart(2, '0');
      
      // Get current year (or next year if the date is already past)
      const now = new Date();
      let year = now.getFullYear();
      const cronDate = new Date(year, parseInt(formattedMonth) - 1, parseInt(formattedDay), parseInt(formattedHour), parseInt(formattedMinute));
      
      if (cronDate < now) {
        year++;
        cronDate.setFullYear(year);
      }
      
      // Format as YYYY-MM-DDTHH:MM
      return `${year}-${formattedMonth}-${formattedDay}T${formattedHour}:${formattedMinute}`;
    } catch (e) {
      console.error("Error parsing cron to datetime:", e);
      // Default to tomorrow at 9am if there's an error
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      const year = tomorrow.getFullYear();
      const month = (tomorrow.getMonth() + 1).toString().padStart(2, '0');
      const day = tomorrow.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}T09:00`;
    }
  };
  
  // Initialize form data based on the cron expression
  const scheduleInfo = parseCronToSchedule(reminder.cron_expr);

  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    guild_id: reminder.guild_id,
    channel_id: reminder.channel_id,
    message: reminder.message,
    is_active: reminder.is_active === 1 || reminder.is_active === true,
    scheduleType: scheduleInfo.type,
    scheduleTime: scheduleInfo.scheduleTime || '',
    recurringType: scheduleInfo.recurringType || 'daily',
    recurringDay: scheduleInfo.recurringDay || '1',
    recurringTime: scheduleInfo.recurringTime || '09:00',
    recurringMinute: scheduleInfo.recurringMinute || '0'
  });
  const [sending, setSending] = useState(false);
  const [availableChannels, setAvailableChannels] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(false);

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

  // For debugging
  useEffect(() => {
    if (editing) {
      console.log('Editing reminder with cron:', reminder.cron_expr);
      console.log('Parsed schedule info:', scheduleInfo);
      console.log('Form data initialized as:', formData);
    }
  }, [editing]);

  // Check if a one-time reminder is in the past
  const isOneTimePast = () => {
    try {
      const parts = reminder.cron_expr.split(' ');
      if (parts.length !== 5) return false;
      
      const [minute, hour, day, month, dayOfWeek] = parts;
      
      // Check if it's a one-time reminder (specific date)
      if (day === '*' || month === '*') return false;
      
      // Check current date vs reminder date
      const now = new Date();
      const reminderDate = new Date(
        now.getFullYear(), 
        parseInt(month) - 1, 
        parseInt(day), 
        parseInt(hour), 
        parseInt(minute)
      );
      
      // If past, show as sent
      return reminderDate < now;
    } catch (e) {
      return false;
    }
  };

  // Helper function to make cron expression more readable
  const formatCronExpression = (cronExpr) => {
    // Parse the cron expression to show user-friendly text
    const parts = cronExpr.split(' ');
    if (parts.length !== 5) return cronExpr;
    
    const [minute, hour, day, month, dayOfWeek] = parts;
    
    // Format minute and hour with leading zeros for display
    const formattedMinute = minute.padStart(2, '0');
    const formattedHour = hour.padStart(2, '0');
    
    // Check for common patterns
    if (hour === '*' && minute !== '*' && day === '*' && month === '*' && dayOfWeek === '*') {
      return `Every hour at ${formattedMinute} minutes past the hour`;
    }
    
    if (hour !== '*' && day === '*' && month === '*' && dayOfWeek === '*') {
      return `Daily at ${formattedHour}:${formattedMinute}`;
    }
    
    if (hour !== '*' && day === '*' && month === '*' && dayOfWeek !== '*') {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = days[parseInt(dayOfWeek)];
      return `Weekly on ${dayName} at ${formattedHour}:${formattedMinute}`;
    }
    
    if (hour !== '*' && day !== '*' && month === '*' && dayOfWeek === '*') {
      return `Monthly on day ${day} at ${formattedHour}:${formattedMinute}`;
    }
    
    if (minute === '0' && hour === '*' && day === '*' && month === '*' && dayOfWeek === '*') {
      return 'Every hour';
    }
    
    // For one-time schedules, try to show the actual date
    if (day !== '*' && month !== '*') {
      try {
        // Format day and month with leading zeros
        const formattedDay = day.padStart(2, '0');
        const formattedMonth = month.padStart(2, '0');
        
        const now = new Date();
        const scheduledDate = new Date(now.getFullYear(), parseInt(formattedMonth) - 1, parseInt(formattedDay), parseInt(formattedHour), parseInt(formattedMinute));
        
        // If in past, adjust year
        if (scheduledDate < now) {
          scheduledDate.setFullYear(now.getFullYear() + 1);
        }
        
        // Format as Month Day, Year at HH:MM
        const options = { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        };
        
        return `Scheduled for ${scheduledDate.toLocaleDateString(undefined, options)}`;
      } catch (e) {
        // Fall back to cron expression if date parsing fails
        console.error("Error formatting date from cron:", e);
      }
    }
    
    return cronExpr;
  };

  const handleUpdate = async () => {
    try {
      // Convert the user-friendly schedule to cron expression
      let cronExpr = '';
      
      if (formData.scheduleType === 'later') {
        // Convert the scheduled time to cron
        const scheduledDate = new Date(formData.scheduleTime);
        const minute = scheduledDate.getMinutes();
        const hour = scheduledDate.getHours();
        const day = scheduledDate.getDate();
        const month = scheduledDate.getMonth() + 1; // getMonth() returns 0-11
        const dayOfWeek = scheduledDate.getDay(); // 0 = Sunday
        
        cronExpr = `${minute} ${hour} ${day} ${month} ${dayOfWeek}`;
      } else if (formData.scheduleType === 'recurring') {
        if (formData.recurringType === 'hourly') {
          // For hourly, set the minute when the job should run every hour
          cronExpr = `${formData.recurringMinute || 0} * * * *`;
        } else {
          const [hour, minute] = formData.recurringTime.split(':');
          
          if (formData.recurringType === 'daily') {
            cronExpr = `${minute} ${hour} * * *`;
          } else if (formData.recurringType === 'weekly') {
            cronExpr = `${minute} ${hour} * * ${formData.recurringDay}`;
          } else if (formData.recurringType === 'monthly') {
            cronExpr = `${minute} ${hour} ${formData.recurringDay} * *`;
          }
        }
      }
      
      // If no valid cron was created, use the original one
      if (!cronExpr) {
        cronExpr = reminder.cron_expr;
      }

      // Get guild and channel names
      let guildName = reminder.guild_name;
      let channelName = reminder.channel_name;

      // If the server or channel has changed, get the new names
      if (formData.guild_id !== reminder.guild_id || formData.channel_id !== reminder.channel_id) {
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
        cron_expr: cronExpr,
        message: formData.message,
        is_active: formData.is_active
      };
      
      await api.put(`/discord/reminders/${reminder.id}`, updatedData);
      setEditing(false);
      
      // Update the reminder in the parent component's state
      onUpdate(prev => prev.map(r => 
        r.id === reminder.id ? { ...r, ...updatedData } : r
      ));
    } catch (error) {
      console.error('Error updating reminder:', error);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this reminder?')) {
      return;
    }
    
    try {
      await api.delete(`/discord/reminders/${reminder.id}`);
      
      // Remove the reminder from the parent component's state
      onUpdate(prev => prev.filter(r => r.id !== reminder.id));
    } catch (error) {
      console.error('Error deleting reminder:', error);
    }
  };
  
  const handleTestReminder = async () => {
    if (!reminder.id) return;
    
    try {
      setSending(true);
      await api.post(`/discord/reminders/${reminder.id}/test`);
      alert('Test message sent successfully!');
    } catch (error) {
      console.error('Error sending test reminder:', error);
      alert(`Failed to send test message: ${error.response?.data?.error || error.message}`);
    } finally {
      setSending(false);
    }
  };
  
  const renderScheduleOptions = () => {
    switch (formData.scheduleType) {
      case 'later':
        return (
          <div className="settings-row">
            <label>Send at specific time:</label>
            <input
              type="datetime-local"
              value={formData.scheduleTime}
              onChange={(e) => setFormData({...formData, scheduleTime: e.target.value})}
              required
              className="settings-row input"
            />
            <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)', marginTop: '5px' }}>
              Choose when you want this message to be sent (one-time).
            </div>
          </div>
        );
        
      case 'recurring':
        return (
          <div>
            <div className="settings-row">
              <label>Recurring type:</label>
              <select 
                value={formData.recurringType}
                onChange={(e) => setFormData({...formData, recurringType: e.target.value})}
                className="settings-row select"
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            
            {formData.recurringType === 'hourly' ? (
              <div className="settings-row">
                <label>Minutes past the hour:</label>
                <select
                  value={formData.recurringMinute || '0'}
                  onChange={(e) => setFormData({...formData, recurringMinute: e.target.value})}
                  className="settings-row select"
                >
                  {Array.from({length: 60}, (_, i) => i).map(minute => (
                    <option key={minute} value={minute}>{minute}</option>
                  ))}
                </select>
                <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)', marginTop: '5px' }}>
                  This message will be sent every hour at {formData.recurringMinute || '0'} minutes past the hour.
                </div>
              </div>
            ) : (
              <>
                <div className="settings-row">
                  <label>Time:</label>
                  <input
                    type="time"
                    value={formData.recurringTime}
                    onChange={(e) => setFormData({...formData, recurringTime: e.target.value})}
                    required
                    className="settings-row input"
                  />
                </div>
                
                {formData.recurringType === 'weekly' && (
                  <div className="settings-row">
                    <label>Day of week:</label>
                    <select 
                      value={formData.recurringDay}
                      onChange={(e) => setFormData({...formData, recurringDay: e.target.value})}
                      className="settings-row select"
                    >
                      <option value="1">Monday</option>
                      <option value="2">Tuesday</option>
                      <option value="3">Wednesday</option>
                      <option value="4">Thursday</option>
                      <option value="5">Friday</option>
                      <option value="6">Saturday</option>
                      <option value="0">Sunday</option>
                    </select>
                  </div>
                )}
                
                {formData.recurringType === 'monthly' && (
                  <div className="settings-row">
                    <label>Day of month:</label>
                    <select 
                      value={formData.recurringDay}
                      onChange={(e) => setFormData({...formData, recurringDay: e.target.value})}
                      className="settings-row select"
                    >
                      {Array.from({length: 31}, (_, i) => i + 1).map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)', marginTop: '5px' }}>
                  This message will be sent {formData.recurringType === 'daily' ? 'every day' : 
                    formData.recurringType === 'weekly' ? 'every week' : 'every month'} at {formData.recurringTime}.
                </div>
              </>
            )}
          </div>
        );
        
      default:
        return null;
    }
  };

  // Determine the reminder status badge
  let statusBadge;
  if (isOneTimePast()) {
    statusBadge = (
      <span style={{
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '500',
        background: 'var(--info-bg, #d1ecf1)',
        color: 'var(--info-color, #0c5460)'
      }}>
        Sent
      </span>
    );
  } else {
    statusBadge = (
      <span style={{
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '500',
        background: reminder.is_active ? 'var(--success-bg, #d4edda)' : 'var(--error-bg, #f8d7da)',
        color: reminder.is_active ? 'var(--success-color, #155724)' : 'var(--error-color, #721c24)'
      }}>
        {reminder.is_active ? 'Active' : 'Inactive'}
      </span>
    );
  }

  const handleDuplicate = async () => {
    try {
      // Create a new reminder with the same data as this one
      // Generate cron expression based on the schedule type
      let cronExpr = reminder.cron_expr;

      // Get the guild and channel names
      const selectedGuild = configuredGuilds.find(g => 
        g.guild_id === reminder.guild_id
      );

      const response = await api.post('/discord/reminders', {
        guild_id: reminder.guild_id,
        guild_name: reminder.guild_name || (selectedGuild?.guild_name || 'Unknown Server'),
        channel_id: reminder.channel_id,
        channel_name: reminder.channel_name || 'Unknown Channel',
        cron_expr: cronExpr,
        message: reminder.message
      });

      // Get the new reminder with its ID from the response
      const newReminder = response.data.reminder || {
        ...reminder,
        id: Date.now(), // Fallback ID if the API doesn't return the created reminder
        is_active: true
      };

      // Update local state
      onUpdate(prev => [...prev, newReminder]);
      
      // Show a brief success message
      alert('Reminder duplicated successfully');
    } catch (error) {
      console.error('Error duplicating reminder:', error);
      alert('Failed to duplicate reminder');
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '15px',
      marginBottom: '10px',
      background: 'var(--bg-secondary)',
      borderRadius: '6px',
      border: '1px solid var(--border-color)'
    }}>
      {editing ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="settings-row">
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

          <div className="settings-row">
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

          <div className="settings-row">
            <label>Schedule Type:</label>
            <select 
              value={formData.scheduleType}
              onChange={(e) => setFormData({...formData, scheduleType: e.target.value})}
              className="settings-row select"
            >
              <option value="later">One-time</option>
              <option value="recurring">Recurring</option>
            </select>
          </div>

          {renderScheduleOptions()}
          
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Message:</label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({...formData, message: e.target.value})}
              placeholder="Message to send"
              className="settings-row textarea"
              rows={3}
            />
          </div>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
            />
            Active
          </label>
          
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
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
              <span>{reminder.guild_name || 'Unknown Server'}</span>
              <FaHashtag style={{ fontSize: '0.9em' }} />
              <span>{reminder.channel_name || 'Unknown Channel'}</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FaClock style={{ color: 'var(--text-secondary)' }} />
              <span style={{ 
                fontFamily: 'Courier New, monospace', 
                background: 'var(--bg-tertiary)', 
                padding: '2px 6px', 
                borderRadius: '3px', 
                fontSize: '13px' 
              }}>
                {formatCronExpression(reminder.cron_expr)}
              </span>
              {statusBadge}
            </div>
            <div style={{ 
              padding: '8px 10px',
              background: 'var(--bg-tertiary)',
              borderRadius: '4px',
              fontSize: '14px',
              whiteSpace: 'pre-wrap'
            }}>
              {reminder.message}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={handleTestReminder} 
              className="settings-button-secondary"
              disabled={sending}
              title="Send test message to channel"
            >
              {sending ? '...' : 'Test'}
            </button>
            <button 
              onClick={handleDuplicate} 
              className="settings-button-secondary"
              title="Duplicate reminder"
            >
              <FaCopy />
            </button>
            <button 
              onClick={() => setEditing(true)} 
              className="settings-button-secondary"
              title="Edit reminder"
            >
              <FaEdit />
            </button>
            <button 
              onClick={handleDelete} 
              className="settings-button-secondary"
              title="Delete reminder"
            >
              <FaTrash />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const ReminderModal = ({ configuredGuilds, onSubmit, onClose }) => {
  const [formData, setFormData] = useState({
    guild_id: '',
    channel_id: '',
    scheduleType: 'now', // 'now', 'later', 'recurring'
    scheduleTime: '', // For 'later' - date and time
    recurringType: 'daily', // 'hourly', 'daily', 'weekly', 'monthly'
    recurringTime: '09:00', // Time for recurring
    recurringDay: '1', // Day of week/month for recurring
    recurringMinute: '0', // Minutes past the hour for hourly recurring
    message: ''
  });
  const [sending, setSending] = useState(false);
  const [availableChannels, setAvailableChannels] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(false);

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

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Convert the user-friendly schedule to cron expression
    let cronExpr = '';
    
    if (formData.scheduleType === 'now') {
      // Send immediately - we'll handle this differently
      cronExpr = '0 * * * *'; // Every hour as fallback, but we'll send immediately
    } else if (formData.scheduleType === 'later') {
      // Convert the scheduled time to cron
      const scheduledDate = new Date(formData.scheduleTime);
      const minute = scheduledDate.getMinutes();
      const hour = scheduledDate.getHours();
      const day = scheduledDate.getDate();
      const month = scheduledDate.getMonth() + 1; // getMonth() returns 0-11
      const dayOfWeek = scheduledDate.getDay(); // 0 = Sunday
      
      cronExpr = `${minute} ${hour} ${day} ${month} ${dayOfWeek}`;
    } else if (formData.scheduleType === 'recurring') {
      if (formData.recurringType === 'hourly') {
        // For hourly, specify the minute when the job should run every hour
        cronExpr = `${formData.recurringMinute || 0} * * * *`;
      } else {
        const [hour, minute] = formData.recurringTime.split(':');
        
        if (formData.recurringType === 'daily') {
          cronExpr = `${minute} ${hour} * * *`;
        } else if (formData.recurringType === 'weekly') {
          cronExpr = `${minute} ${hour} * * ${formData.recurringDay}`;
        } else if (formData.recurringType === 'monthly') {
          cronExpr = `${minute} ${hour} ${formData.recurringDay} * *`;
        }
      }
    }
    
    const reminderData = {
      guild_id: formData.guild_id,
      channel_id: formData.channel_id,
      cron_expr: cronExpr,
      message: formData.message,
      scheduleType: formData.scheduleType // Pass this to backend for immediate sending
    };
    
    onSubmit(reminderData);
  };
  
  const handleTestMessage = async () => {
    // Validate form data
    if (!formData.guild_id || !formData.channel_id || !formData.message) {
      alert('Please select a server and channel and enter a message to test');
      return;
    }
    
    try {
      setSending(true);
      
      // Send test message directly to the channel
      const response = await api.post('/discord/test-message', {
        guild_id: formData.guild_id,
        channel_id: formData.channel_id,
        message: `[TEST] ${formData.message}`
      });
      
      alert('Test message sent successfully!');
    } catch (error) {
      console.error('Error sending test message:', error);
      alert(`Failed to send test message: ${error.response?.data?.error || error.message}`);
    } finally {
      setSending(false);
    }
  };

  const renderScheduleOptions = () => {
    switch (formData.scheduleType) {
      case 'now':
        return (
          <div className="settings-row">
            <label>Send immediately when created</label>
            <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)', marginTop: '5px' }}>
              The message will be sent right away and then scheduled for future reminders.
            </div>
          </div>
        );
        
      case 'later':
        return (
          <div className="settings-row">
            <label>Send at specific time:</label>
            <input
              type="datetime-local"
              value={formData.scheduleTime}
              onChange={(e) => setFormData({...formData, scheduleTime: e.target.value})}
              required
              className="settings-row input"
            />
            <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)', marginTop: '5px' }}>
              Choose when you want this message to be sent (one-time).
            </div>
          </div>
        );
        
      case 'recurring':
        return (
          <div>
            <div className="settings-row">
              <label>Recurring type:</label>
              <select 
                value={formData.recurringType}
                onChange={(e) => setFormData({...formData, recurringType: e.target.value})}
                className="settings-row select"
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            
            {formData.recurringType === 'hourly' ? (
              <div className="settings-row">
                <label>Minutes past the hour:</label>
                <select
                  value={formData.recurringMinute}
                  onChange={(e) => setFormData({...formData, recurringMinute: e.target.value})}
                  className="settings-row select"
                >
                  {Array.from({length: 60}, (_, i) => i).map(minute => (
                    <option key={minute} value={minute}>{minute}</option>
                  ))}
                </select>
                <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)', marginTop: '5px' }}>
                  This message will be sent every hour at {formData.recurringMinute} minutes past the hour.
                </div>
              </div>
            ) : (
              <>
                <div className="settings-row">
                  <label>Time:</label>
                  <input
                    type="time"
                    value={formData.recurringTime}
                    onChange={(e) => setFormData({...formData, recurringTime: e.target.value})}
                    required
                    className="settings-row input"
                  />
                </div>
                
                {formData.recurringType === 'weekly' && (
                  <div className="settings-row">
                    <label>Day of week:</label>
                    <select 
                      value={formData.recurringDay}
                      onChange={(e) => setFormData({...formData, recurringDay: e.target.value})}
                      className="settings-row select"
                    >
                      <option value="1">Monday</option>
                      <option value="2">Tuesday</option>
                      <option value="3">Wednesday</option>
                      <option value="4">Thursday</option>
                      <option value="5">Friday</option>
                      <option value="6">Saturday</option>
                      <option value="0">Sunday</option>
                    </select>
                  </div>
                )}
                
                {formData.recurringType === 'monthly' && (
                  <div className="settings-row">
                    <label>Day of month:</label>
                    <select 
                      value={formData.recurringDay}
                      onChange={(e) => setFormData({...formData, recurringDay: e.target.value})}
                      className="settings-row select"
                    >
                      {Array.from({length: 31}, (_, i) => i + 1).map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)', marginTop: '5px' }}>
                  This message will be sent {formData.recurringType === 'daily' ? 'every day' : 
                    formData.recurringType === 'weekly' ? 'every week' : 'every month'} at {formData.recurringTime}.
                </div>
              </>
            )}
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="settings-dialog-backdrop">
      <div className="settings-dialog">
        <div className="settings-dialog-title">Create Reminder</div>
        
        <form onSubmit={handleSubmit} className="settings-dialog-content">
          <div className="settings-row">
            <label>Server:</label>
            <select 
              value={formData.guild_id}
              onChange={(e) => {
                setFormData({
                  ...formData, 
                  guild_id: e.target.value,
                  channel_id: '' // Reset channel selection when server changes
                });
              }}
              required
              className="settings-row select"
            >
              <option value="">Choose server...</option>
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

          <div className="settings-row">
            <label>Channel:</label>
            <select 
              value={formData.channel_id}
              onChange={(e) => setFormData({...formData, channel_id: e.target.value})}
              required
              className="settings-row select"
              disabled={!formData.guild_id || loadingChannels}
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

          <div className="settings-row">
            <label>When to send:</label>
            <select 
              value={formData.scheduleType}
              onChange={(e) => setFormData({...formData, scheduleType: e.target.value})}
              className="settings-row select"
            >
              <option value="now">Send Now</option>
              <option value="later">Send Later (One-time)</option>
              <option value="recurring">Send Recurring</option>
            </select>
          </div>

          {renderScheduleOptions()}

          <div className="settings-row">
            <label>Message:</label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({...formData, message: e.target.value})}
              placeholder="Message to send"
              required
              className="settings-row textarea"
              rows={4}
            />
          </div>

          <div className="settings-dialog-actions">
            <button type="button" onClick={onClose} className="settings-button-secondary">
              Cancel
            </button>
            <button 
              type="button" 
              onClick={handleTestMessage}
              className="settings-button-secondary"
              disabled={sending || !formData.guild_id || !formData.channel_id || !formData.message}
            >
              {sending ? 'Sending...' : 'Test Message'}
            </button>
            <button type="submit" className="settings-button">
              Create Reminder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReminderSettings; 