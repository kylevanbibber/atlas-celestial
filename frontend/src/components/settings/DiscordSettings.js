import React, { useState, useEffect } from 'react';
import { FaDiscord, FaPlus, FaTrash, FaEdit, FaClock, FaTrophy, FaServer, FaHashtag } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';

const DiscordSettings = () => {
  const { user, token } = useAuth();
  const [discordStatus, setDiscordStatus] = useState({ linked: false, discord_id: null });
  const [guilds, setGuilds] = useState([]);
  const [configuredGuilds, setConfiguredGuilds] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [leaderboards, setLeaderboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('servers');

  // Form states
  const [showGuildModal, setShowGuildModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [selectedGuild, setSelectedGuild] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [channels, setChannels] = useState([]);
  console.log('DISCORD CLIENT ID:', process.env.REACT_APP_DISCORD_CLIENT_ID);
  
  useEffect(() => {
    loadDiscordData();
  }, []);

  const loadDiscordData = async () => {
    try {
      setLoading(true);
      
      // Load Discord status
      const statusRes = await api.get('/discord/status');
      setDiscordStatus(statusRes.data);

      if (statusRes.data.linked) {
        // Load user's Discord servers
        const guildsRes = await api.get('/discord/guilds');
        setGuilds(guildsRes.data.guilds);

        // Load configured servers
        const configuredRes = await api.get('/discord/guilds/configured');
        setConfiguredGuilds(configuredRes.data.guilds);

        // Load reminders
        const remindersRes = await api.get('/discord/reminders');
        setReminders(remindersRes.data.reminders);

        // Load leaderboards
        const leaderboardsRes = await api.get('/discord/leaderboards');
        setLeaderboards(leaderboardsRes.data.leaderboards);
      }
    } catch (error) {
      console.error('Error loading Discord data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkDiscord = () => {
    const base = api.defaults.baseURL.replace(/\/$/, '');
    // Always include JWT token in state
    const url = `${base}/discord/link?token=${encodeURIComponent(token)}`;
    console.log('Redirecting to:', url);
    window.location.href = url;
  };

  const handleUnlinkDiscord = async () => {
    try {
      // Send unlink request to backend
      await api.post('/discord/unlink');
      // Reload status and related data from server
      await loadDiscordData();
    } catch (error) {
      console.error('Error unlinking Discord:', error);
    }
  };

  const handleConfigureGuild = async () => {
    try {
      await api.post('/discord/guilds/configure', {
        guild_id: selectedGuild.id,
        guild_name: selectedGuild.name,
        channel_id: selectedChannel.id,
        channel_name: selectedChannel.name
      });

      setShowGuildModal(false);
      setSelectedGuild(null);
      setSelectedChannel(null);
      setChannels([]);
      loadDiscordData();
    } catch (error) {
      console.error('Error configuring guild:', error);
    }
  };

  const handleRemoveGuild = async (guildId, channelId) => {
    try {
      await api.delete(`/discord/guilds/${guildId}/channels/${channelId}`);
      loadDiscordData();
    } catch (error) {
      console.error('Error removing guild:', error);
    }
  };

  const handleGuildSelect = async (guild) => {
    setSelectedGuild(guild);
    try {
      const channelsRes = await api.get(`/discord/guilds/${guild.id}/channels`);
      setChannels(channelsRes.data.channels);
    } catch (error) {
      console.error('Error loading channels:', error);
    }
  };

  const handleCreateReminder = async (formData) => {
    try {
      await api.post('/discord/reminders', {
        guild_id: formData.guild_id,
        channel_id: formData.channel_id,
        cron_expr: formData.cron_expr,
        message: formData.message
      });

      setShowReminderModal(false);
      loadDiscordData();
    } catch (error) {
      console.error('Error creating reminder:', error);
    }
  };

  const handleCreateLeaderboard = async (formData) => {
    try {
      await api.post('/discord/leaderboards', {
        guild_id: formData.guild_id,
        channel_id: formData.channel_id,
        cron_expr: formData.cron_expr,
        metric_type: formData.metric_type,
        top_count: formData.top_count
      });

      setShowLeaderboardModal(false);
      loadDiscordData();
    } catch (error) {
      console.error('Error creating leaderboard:', error);
    }
  };

  if (loading) {
    return (
      <div className="settings-section">
        <div className="settings-card">
          <div className="settings-card-title">Discord Integration</div>
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            Loading Discord settings...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-section">
      <div className="settings-card">
        <div className="settings-card-title">
          <FaDiscord style={{ marginRight: '10px', color: '#5865f2' }} />
          Discord Integration
        </div>

        {!discordStatus.linked ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
              Connect your Discord account to enable bot features.
            </p>
            <button
              onClick={handleLinkDiscord}
              className="settings-button"
              disabled={!token}
              title={token ? 'Link Discord Account' : 'Logging in...'}
            >
              <FaDiscord /> Link Discord Account
            </button>
          </div>
        ) : (
          <div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              padding: '15px', 
              background: 'var(--success-bg, #d4edda)', 
              borderRadius: '6px',
              marginBottom: '20px'
            }}>
              <FaDiscord style={{ color: '#28a745' }} />
              <span>Discord account linked</span>
              <button onClick={handleUnlinkDiscord} className="settings-button-secondary" style={{ marginLeft: 'auto' }}>
                Unlink
              </button>
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
              <button 
                className={`settings-button ${activeTab === 'servers' ? '' : 'settings-button-secondary'}`}
                style={{ 
                  border: 'none', 
                  borderRadius: '0', 
                  borderBottom: activeTab === 'servers' ? '2px solid var(--button-primary-bg)' : 'none',
                  marginRight: '10px'
                }}
                onClick={() => setActiveTab('servers')}
              >
                <FaServer /> Servers
              </button>
              <button 
                className={`settings-button ${activeTab === 'reminders' ? '' : 'settings-button-secondary'}`}
                style={{ 
                  border: 'none', 
                  borderRadius: '0', 
                  borderBottom: activeTab === 'reminders' ? '2px solid var(--button-primary-bg)' : 'none',
                  marginRight: '10px'
                }}
                onClick={() => setActiveTab('reminders')}
              >
                <FaClock /> Reminders
              </button>
              <button 
                className={`settings-button ${activeTab === 'leaderboards' ? '' : 'settings-button-secondary'}`}
                style={{ 
                  border: 'none', 
                  borderRadius: '0', 
                  borderBottom: activeTab === 'leaderboards' ? '2px solid var(--button-primary-bg)' : 'none'
                }}
                onClick={() => setActiveTab('leaderboards')}
              >
                <FaTrophy /> Leaderboards
              </button>
            </div>

            {activeTab === 'servers' && (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Servers</h3>
      {guilds.filter(g => !configuredGuilds.some(c => c.guild_id === g.id)).length > 0 && (
        <button
          onClick={() => setShowGuildModal(true)}
          className="settings-button"
        >
          <FaPlus /> Add to Server
        </button>
      )}
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
      {guilds
        .filter(g => !configuredGuilds.some(c => c.guild_id === g.id))
        .map(guild => (
          <div
            key={guild.id}
            style={{
              padding: '12px',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {guild.icon_url ? (
                  <img src={guild.icon_url} alt={`${guild.name} icon`} style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                ) : (
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#5865f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                    {guild.name.charAt(0)}
                  </div>
                )}
                <span>{guild.name}</span>
            </div>
            <a
              href={`https://discord.com/oauth2/authorize?client_id=${process.env.REACT_APP_DISCORD_CLIENT_ID}&scope=bot&permissions=8&guild_id=${guild.id}`}
              className="settings-button"
            >
              Add Bot
            </a>
          </div>
        ))
      }

      {configuredGuilds.map(cfg => {
        const fullGuild = guilds.find(g => g.id === cfg.guild_id);
        return (
        <div
          key={`${cfg.guild_id}-${cfg.channel_id}`}
          style={{
            padding: '12px',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {fullGuild && fullGuild.icon_url ? (
                <img src={fullGuild.icon_url} alt={`${cfg.guild_name} icon`} style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
              ) : (
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#5865f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                  {cfg.guild_name.charAt(0)}
                </div>
              )}
              <span>
                {cfg.guild_name} — #{cfg.channel_name}
              </span>
          </div>
          <button
            onClick={() => handleRemoveGuild(cfg.guild_id, cfg.channel_id)}
            className="settings-button-secondary"
          >
            <FaTrash />
          </button>
        </div>
      )})}
    </div>
  </div>
)}

            {activeTab === 'reminders' && (
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
                        onUpdate={loadDiscordData}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'leaderboards' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Scheduled Leaderboards</h3>
                  <button onClick={() => setShowLeaderboardModal(true)} className="settings-button">
                    <FaPlus /> Add Leaderboard
                  </button>
                </div>

                {leaderboards.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '40px' }}>
                    No leaderboards configured yet.
                  </p>
                ) : (
                  <div>
                    {leaderboards.map((leaderboard) => (
                      <LeaderboardItem 
                        key={leaderboard.id} 
                        leaderboard={leaderboard} 
                        onUpdate={loadDiscordData}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showGuildModal && (
        <GuildModal 
          guilds={guilds}
          configuredGuilds={configuredGuilds}
          selectedGuild={selectedGuild}
          selectedChannel={selectedChannel}
          channels={channels}
          onGuildSelect={handleGuildSelect}
          onChannelSelect={setSelectedChannel}
          onSubmit={handleConfigureGuild}
          onClose={() => setShowGuildModal(false)}
        />
      )}

      {showReminderModal && (
        <ReminderModal 
          configuredGuilds={configuredGuilds}
          onSubmit={handleCreateReminder}
          onClose={() => setShowReminderModal(false)}
        />
      )}

      {showLeaderboardModal && (
        <LeaderboardModal 
          configuredGuilds={configuredGuilds}
          onSubmit={handleCreateLeaderboard}
          onClose={() => setShowLeaderboardModal(false)}
        />
      )}
    </div>
  );
};

// Sub-components using existing styles
const ReminderItem = ({ reminder, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    cron_expr: reminder.cron_expr,
    message: reminder.message,
    is_active: reminder.is_active
  });

  const handleUpdate = async () => {
    try {
      await api.put(`/discord/reminders/${reminder.id}`, formData);
      setEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating reminder:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/discord/reminders/${reminder.id}`);
      onUpdate();
    } catch (error) {
      console.error('Error deleting reminder:', error);
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
          <input
            type="text"
            value={formData.cron_expr}
            onChange={(e) => setFormData({...formData, cron_expr: e.target.value})}
            placeholder="Cron expression (e.g., 0 9 * * *)"
            className="settings-row input"
          />
          <textarea
            value={formData.message}
            onChange={(e) => setFormData({...formData, message: e.target.value})}
            placeholder="Message to send"
            className="settings-row textarea"
          />
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
            <span style={{ 
              fontFamily: 'Courier New, monospace', 
              background: 'var(--bg-tertiary)', 
              padding: '2px 6px', 
              borderRadius: '3px', 
              fontSize: '12px' 
            }}>
              {reminder.cron_expr}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>{reminder.message}</span>
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
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
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

const LeaderboardItem = ({ leaderboard, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    cron_expr: leaderboard.cron_expr,
    metric_type: leaderboard.metric_type,
    top_count: leaderboard.top_count,
    is_active: leaderboard.is_active
  });

  const handleUpdate = async () => {
    try {
      await api.put(`/discord/leaderboards/${leaderboard.id}`, formData);
      setEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating leaderboard:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/discord/leaderboards/${leaderboard.id}`);
      onUpdate();
    } catch (error) {
      console.error('Error deleting leaderboard:', error);
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
          <input
            type="text"
            value={formData.cron_expr}
            onChange={(e) => setFormData({...formData, cron_expr: e.target.value})}
            placeholder="Cron expression"
            className="settings-row input"
          />
          <select
            value={formData.metric_type}
            onChange={(e) => setFormData({...formData, metric_type: e.target.value})}
            className="settings-row select"
          >
            <option value="daily_sales">Daily Sales</option>
            <option value="weekly_sales">Weekly Sales</option>
            <option value="monthly_sales">Monthly Sales</option>
          </select>
          <input
            type="number"
            value={formData.top_count}
            onChange={(e) => setFormData({...formData, top_count: parseInt(e.target.value)})}
            min="1"
            max="20"
            className="settings-row input"
          />
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
            <span style={{ 
              fontFamily: 'Courier New, monospace', 
              background: 'var(--bg-tertiary)', 
              padding: '2px 6px', 
              borderRadius: '3px', 
              fontSize: '12px' 
            }}>
              {leaderboard.cron_expr}
            </span>
            <span style={{ textTransform: 'capitalize', color: 'var(--text-primary)' }}>
              {leaderboard.metric_type.replace('_', ' ')}
            </span>
            <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
              Top {leaderboard.top_count}
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
          <div style={{ display: 'flex', gap: '8px' }}>
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

const GuildModal = ({ guilds, configuredGuilds, selectedGuild, selectedChannel, channels, onGuildSelect, onChannelSelect, onSubmit, onClose }) => {
  const availableGuilds = guilds.filter(guild => 
    !configuredGuilds.some(cg => cg.guild_id === guild.id)
  );

  return (
    <div className="settings-dialog-backdrop">
      <div className="settings-dialog">
        <div className="settings-dialog-title">Configure Discord Server</div>
        
        <div className="settings-dialog-content">
          <div className="settings-row">
            <label>Select Server:</label>
            <div className="guild-selection-list" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                {availableGuilds.length > 0 ? availableGuilds.map(guild => (
                    <div 
                        key={guild.id}
                        onClick={() => onGuildSelect(guild)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '10px',
                            cursor: 'pointer',
                            backgroundColor: selectedGuild?.id === guild.id ? 'var(--button-primary-bg-hover)' : 'transparent',
                            borderBottom: '1px solid var(--border-color)'
                        }}
                    >
                        {guild.icon_url ? (
                            <img src={guild.icon_url} alt="" style={{width: '32px', height: '32px', borderRadius: '50%', marginRight: '10px'}} />
                        ) : (
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', marginRight: '10px', backgroundColor: '#5865f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '14px' }}>
                                {guild.name.charAt(0)}
                            </div>
                        )}
                        <span>{guild.name}</span>
                    </div>
                )) : <div style={{padding: '20px', textAlign: 'center', color: 'var(--text-secondary)'}}>No available servers to configure.</div>}
            </div>
          </div>

          {selectedGuild && (
            <div className="settings-row" style={{ marginTop: '20px' }}>
              <label>Select Channel:</label>
              <select 
                value={selectedChannel?.id || ''} 
                onChange={(e) => {
                  const channel = channels.find(c => c.id === e.target.value);
                  onChannelSelect(channel);
                }}
                className="settings-row select"
              >
                <option value="">Choose a channel...</option>
                {channels.map(channel => (
                  <option key={channel.id} value={channel.id}>
                    #{channel.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="settings-dialog-actions">
          <button onClick={onClose} className="settings-button-secondary">
            Cancel
          </button>
          <button onClick={onSubmit} className="settings-button" disabled={!selectedGuild || !selectedChannel}>
            Configure Server
          </button>
        </div>
      </div>
    </div>
  );
};

const ReminderModal = ({ configuredGuilds, onSubmit, onClose }) => {
  const [formData, setFormData] = useState({
    guild_id: '',
    channel_id: '',
    cron_expr: '',
    message: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="settings-dialog-backdrop">
      <div className="settings-dialog">
        <div className="settings-dialog-title">Create Reminder</div>
        
        <form onSubmit={handleSubmit} className="settings-dialog-content">
          <div className="settings-row">
            <label>Server & Channel:</label>
            <select 
              value={`${formData.guild_id}-${formData.channel_id}`}
              onChange={(e) => {
                const [guild_id, channel_id] = e.target.value.split('-');
                setFormData({...formData, guild_id, channel_id});
              }}
              required
              className="settings-row select"
            >
              <option value="">Choose server and channel...</option>
              {configuredGuilds.map(guild => (
                <option key={`${guild.guild_id}-${guild.channel_id}`} value={`${guild.guild_id}-${guild.channel_id}`}>
                  {guild.guild_name} - #{guild.channel_name}
                </option>
              ))}
            </select>
          </div>

          <div className="settings-row">
            <label>Cron Expression:</label>
            <input
              type="text"
              value={formData.cron_expr}
              onChange={(e) => setFormData({...formData, cron_expr: e.target.value})}
              placeholder="e.g., 0 9 * * * (daily at 9 AM)"
              required
              className="settings-row input"
            />
          </div>

          <div className="settings-row">
            <label>Message:</label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({...formData, message: e.target.value})}
              placeholder="Message to send"
              required
              className="settings-row textarea"
            />
          </div>

          <div className="settings-dialog-actions">
            <button type="submit" className="settings-button">
              Create Reminder
            </button>
            <button type="button" onClick={onClose} className="settings-button-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const LeaderboardModal = ({ configuredGuilds, onSubmit, onClose }) => {
  const [formData, setFormData] = useState({
    guild_id: '',
    channel_id: '',
    cron_expr: '',
    metric_type: 'daily_sales',
    top_count: 10
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="settings-dialog-backdrop">
      <div className="settings-dialog">
        <div className="settings-dialog-title">Create Leaderboard</div>
        
        <form onSubmit={handleSubmit} className="settings-dialog-content">
          <div className="settings-row">
            <label>Server & Channel:</label>
            <select 
              value={`${formData.guild_id}-${formData.channel_id}`}
              onChange={(e) => {
                const [guild_id, channel_id] = e.target.value.split('-');
                setFormData({...formData, guild_id, channel_id});
              }}
              required
              className="settings-row select"
            >
              <option value="">Choose server and channel...</option>
              {configuredGuilds.map(guild => (
                <option key={`${guild.guild_id}-${guild.channel_id}`} value={`${guild.guild_id}-${guild.channel_id}`}>
                  {guild.guild_name} - #{guild.channel_name}
                </option>
              ))}
            </select>
          </div>

          <div className="settings-row">
            <label>Schedule (Cron Expression):</label>
            <input
              type="text"
              value={formData.cron_expr}
              onChange={(e) => setFormData({...formData, cron_expr: e.target.value})}
              placeholder="e.g., 0 17 * * * (daily at 5 PM)"
              required
              className="settings-row input"
            />
          </div>

          <div className="settings-row">
            <label>Metric Type:</label>
            <select
              value={formData.metric_type}
              onChange={(e) => setFormData({...formData, metric_type: e.target.value})}
              className="settings-row select"
            >
              <option value="daily_sales">Daily Sales</option>
              <option value="weekly_sales">Weekly Sales</option>
              <option value="monthly_sales">Monthly Sales</option>
            </select>
          </div>

          <div className="settings-row">
            <label>Top Count:</label>
            <input
              type="number"
              value={formData.top_count}
              onChange={(e) => setFormData({...formData, top_count: parseInt(e.target.value)})}
              min="1"
              max="20"
              required
              className="settings-row input"
            />
          </div>

          <div className="settings-dialog-actions">
            <button type="submit" className="settings-button">
              Create Leaderboard
            </button>
            <button type="button" onClick={onClose} className="settings-button-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DiscordSettings; 