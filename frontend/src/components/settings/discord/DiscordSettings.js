import React, { useState, useEffect } from 'react';
import { FaDiscord, FaPlus, FaTrash, FaEdit, FaClock, FaTrophy, FaServer, FaHashtag, FaCopy } from 'react-icons/fa';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../api';
import ServerSettings from './ServerSettings';
import ReminderSettings from './ReminderSettings';
import LeaderboardSettings from './LeaderboardSettings';

const DiscordSettings = () => {
  const { user, token } = useAuth();
  const [discordStatus, setDiscordStatus] = useState({ linked: false, discord_id: null });
  const [configuredGuilds, setConfiguredGuilds] = useState([]); // Still needed for reminders and leaderboards
  const [reminders, setReminders] = useState([]);
  const [leaderboards, setLeaderboards] = useState([]);
  const [availableManagers, setAvailableManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('servers');
  const [rateLimitStatus, setRateLimitStatus] = useState(null);

  // Form states

  
  useEffect(() => {
    loadDiscordData();
  }, []);

  const loadDiscordData = async () => {
    try {
      setLoading(true);
      
      // Load Discord status
      const statusRes = await api.getCached('/discord/status');
      setDiscordStatus(statusRes.data);

      if (statusRes.data.linked) {
        // Load configured servers (needed for reminders and leaderboards)
        const configuredRes = await api.getCached('/discord/guilds/configured');
        setConfiguredGuilds(configuredRes.data.guilds);

        // Load reminders
        const remindersRes = await api.getCached('/discord/reminders');
        setReminders(remindersRes.data.reminders);

        // Load leaderboards
        const leaderboardsRes = await api.getCached('/discord/leaderboards');
        setLeaderboards(leaderboardsRes.data.leaderboards);
// Load available managers for all users
try {
  const managersRes = await api.get('/discord/managers');
  setAvailableManagers(managersRes.data.managers);
} catch (error) {
  console.warn('Could not load managers:', error);
}

        // Load rate limit status
        try {
          const rateLimitRes = await api.get('/discord/rate-limit-status');
          setRateLimitStatus(rateLimitRes.data);
        } catch (error) {
          console.warn('Could not load rate limit status:', error);
        }
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

  // Removed sync bot functionality - no longer needed

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

        {rateLimitStatus && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            padding: '10px 15px', 
            background: rateLimitStatus.isLimited ? 'var(--error-bg, #f8d7da)' : 'var(--info-bg, #d1ecf1)', 
            borderRadius: '6px',
            marginBottom: '15px',
            fontSize: '0.9em'
          }}>
            <span style={{ 
              color: rateLimitStatus.isLimited ? 'var(--error-color, #721c24)' : 'var(--info-color, #0c5460)'
            }}>
              Discord API: {rateLimitStatus.remaining} requests remaining
              {rateLimitStatus.isLimited && ` (resets in ${Math.ceil(rateLimitStatus.timeUntilReset / 1000)}s)`}
            </span>
          </div>
        )}

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
              <ServerSettings 
                discordStatus={discordStatus}
                onLoadData={loadDiscordData}
                rateLimitStatus={rateLimitStatus}
              />
            )}

            {activeTab === 'reminders' && (
              <ReminderSettings 
                reminders={reminders}
                setReminders={setReminders}
                configuredGuilds={configuredGuilds}
              />
            )}

            {activeTab === 'leaderboards' && (
              <LeaderboardSettings 
                leaderboards={leaderboards}
                setLeaderboards={setLeaderboards}
                configuredGuilds={configuredGuilds}
                availableManagers={availableManagers}
                userRole={user && user.Role}
              />
            )}
          </div>
        )}
      </div>

      {/* Modals */}

    </div>
  );
};

export default DiscordSettings; 