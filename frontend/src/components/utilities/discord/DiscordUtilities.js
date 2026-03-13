import React, { useState, useEffect } from 'react';
import { FaDiscord, FaPlus, FaTrash, FaEdit, FaClock, FaTrophy, FaServer, FaHashtag, FaCopy } from 'react-icons/fa';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../api';
import ServerUtilities from './ServerUtilities';
import ReminderUtilities from './ReminderUtilities';
import LeaderboardUtilities from './LeaderboardUtilities';
import MotivationCallUtilities from './MotivationCallUtilities';

const DiscordUtilities = () => {
  const { user, token } = useAuth();
  const [discordStatus, setDiscordStatus] = useState({ linked: false, discord_id: null });
  const [configuredGuilds, setConfiguredGuilds] = useState([]); // Still needed for reminders and leaderboards
  const [reminders, setReminders] = useState([]);
  const [leaderboards, setLeaderboards] = useState([]);
  const [availableManagers, setAvailableManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('servers');
  
  const [discordTokenExpired, setDiscordTokenExpired] = useState(false);

  // Check if user has management-level access (MGA, RGA, SGA) or Admin role
  const hasManagementAccess = (user?.clname && ['MGA', 'RGA', 'SGA'].includes(user.clname)) || 
                              (user?.Role === 'Admin');

  // Form states

  
  useEffect(() => {
    // Only load Discord data if user is authenticated
    if (!user) {
      setLoading(false);
      return;
    }
    
    // Check if we're returning from Discord OAuth
    const urlParams = new URLSearchParams(window.location.search);
    const discordStatus = urlParams.get('discord');
    
    if (discordStatus === 'linked') {
      console.log('[Discord] Detected successful OAuth callback');
      // Clean up URL parameters
      window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    } else if (discordStatus === 'error') {
      console.log('[Discord] Detected failed OAuth callback');
      // Clean up URL parameters
      window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    }
    
    // Clean up any remaining Discord OAuth backup tokens after successful callback
    setTimeout(() => {
      localStorage.removeItem('discord_auth_backup');
      localStorage.removeItem('discord_oauth_timestamp');
    }, 5000); // Clean up after 5 seconds
    
    loadDiscordData();
  }, [user]);

  // Reset tab if user doesn't have management access and is on a restricted tab
  useEffect(() => {
    if (!hasManagementAccess && (activeTab === 'servers' || activeTab === 'reminders' || activeTab === 'leaderboards')) {
      setActiveTab('servers');
    }
  }, [hasManagementAccess, activeTab]);

  const loadDiscordData = async () => {
    try {
      setLoading(true);
      console.log('Loading Discord data...');
      
      // Load Discord status
      try {
        console.log('Calling /discord/status...');
        const statusRes = await api.getCached('/discord/status');
        console.log('Discord status response:', statusRes.data);
        setDiscordStatus(statusRes.data);

        if (statusRes.data.linked) {
          console.log('Discord linked, hasManagementAccess:', hasManagementAccess);
          // Only load advanced Discord data for management-level users
          if (hasManagementAccess) {
            // Load configured servers (needed for reminders and leaderboards)
            try {
              console.log('Calling /discord/guilds/configured...');
              const configuredRes = await api.getCached('/discord/guilds/configured');
              console.log('Configured guilds response:', configuredRes.data);
              setConfiguredGuilds(configuredRes.data.guilds);
            } catch (error) {
              console.warn('Could not load configured guilds:', error);
              // Don't throw - continue with other calls
            }

            // Load reminders
            try {
              console.log('Calling /discord/reminders...');
              const remindersRes = await api.getCached('/discord/reminders');
              console.log('Reminders response:', remindersRes.data);
              setReminders(remindersRes.data.reminders);
            } catch (error) {
              console.warn('Could not load reminders:', error);
              // Don't throw - continue with other calls
            }

            // Load leaderboards
            try {
              console.log('Calling /discord/leaderboards...');
              const leaderboardsRes = await api.getCached('/discord/leaderboards');
              console.log('Leaderboards response:', leaderboardsRes.data);
              setLeaderboards(leaderboardsRes.data.leaderboards);
            } catch (error) {
              console.warn('Could not load leaderboards:', error);
              // Don't throw - continue with other calls
            }

            // Load available managers
            try {
              console.log('Calling /discord/managers...');
              const managersRes = await api.get('/discord/managers');
              console.log('Managers response:', managersRes.data);
              setAvailableManagers(managersRes.data.managers);
            } catch (error) {
              console.warn('Could not load managers:', error);
            }

            
          }
        }
      } catch (error) {
        console.error('Error loading Discord status:', error);
        // Check if this is a Discord authentication error
        if (error.type === 'DISCORD_AUTH_FAILED' || error.message?.includes('Discord')) {
          console.warn('Discord token expired - setting Discord as unlinked');
          // Set Discord as unlinked so user can re-link
          setDiscordStatus({ linked: false, discord_id: null });
          setDiscordTokenExpired(true);
          // Don't throw - let component continue normally
        } else {
          // If Discord status fails for other reasons, set a default state to prevent further API calls
          setDiscordStatus({ linked: false, discord_id: null });
          throw error; // Re-throw only if it's a critical non-Discord auth error
        }
      }
    } catch (error) {
      console.error('Critical error in loadDiscordData:', error);
      // Only show error to user, don't re-throw to prevent app crash
    } finally {
      console.log('Discord data loading complete');
      setLoading(false);
    }
  };

  const handleLinkDiscord = () => {
    // Reset the expired token state since they're trying to re-link
    setDiscordTokenExpired(false);
    
    // Preserve authentication state before redirect
    console.log('[Discord] Preserving auth state before OAuth redirect');
    if (token) {
      localStorage.setItem('discord_auth_backup', token);
      localStorage.setItem('discord_oauth_timestamp', Date.now().toString());
    }
    
    const base = api.defaults.baseURL.replace(/\/$/, '');
    // Always include JWT token in state
    const url = `${base}/discord/link?token=${encodeURIComponent(token)}`;
    console.log('Redirecting to:', url);
    window.location.href = url;
  };

  const handleUnlinkDiscord = async () => {
    try {
      console.log('[Discord] Starting unlink process...');
      
      // Send unlink request to backend
      await api.post('/discord/unlink');
      
      console.log('[Discord] Successfully unlinked from backend, updating UI state...');
      
      // Immediately update local state for instant UI feedback
      setDiscordStatus({ linked: false, discord_id: null });
      setConfiguredGuilds([]);
      setReminders([]);
      setLeaderboards([]);
      setDiscordTokenExpired(false);
      
      // Clear any Discord OAuth backup tokens that might exist
      localStorage.removeItem('discord_auth_backup');
      localStorage.removeItem('discord_oauth_timestamp');
      
      console.log('[Discord] UI state updated, Discord is now unlinked');
      
    } catch (error) {
      console.error('Error unlinking Discord:', error);
      
      // If unlinking failed, reload data from server to get accurate state
      console.log('[Discord] Unlink failed, reloading data from server...');
      await loadDiscordData();
    }
  };

  // Removed sync bot functionality - no longer needed

  if (!user) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>
          Please log in to view Discord integration settings.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
        Loading Discord settings...
      </div>
    );
  }

  return (
    <div>

        

        {!discordStatus.linked ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            {discordTokenExpired && (
              <div style={{ 
                padding: '15px', 
                marginBottom: '20px',
                background: 'var(--warning-bg, #fff3cd)', 
                borderRadius: '6px',
                border: '1px solid var(--warning-border, #f0e68c)'
              }}>
                <p style={{ 
                  margin: 0, 
                  color: 'var(--warning-color, #856404)',
                  fontWeight: 'bold'
                }}>
                  Discord Token Expired
                </p>
                <p style={{ 
                  margin: '10px 0 0 0', 
                  color: 'var(--warning-color, #856404)',
                  fontSize: '0.9em'
                }}>
                  Your Discord connection has expired. Please re-link your Discord account to restore access to Discord features.
                </p>
              </div>
            )}
            <p style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
              {discordTokenExpired ? 'Re-connect' : 'Connect'} your Discord account to enable bot features.
            </p>
            <button
              onClick={handleLinkDiscord}
              className="settings-button"
              disabled={!token}
              title={token ? (discordTokenExpired ? 'Re-link Discord Account' : 'Link Discord Account') : 'Logging in...'}
            >
              <FaDiscord /> {discordTokenExpired ? 'Re-link' : 'Link'} Discord Account
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

            {hasManagementAccess ? (
              <>
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
                      borderBottom: activeTab === 'leaderboards' ? '2px solid var(--button-primary-bg)' : 'none',
                      marginRight: '10px'
                    }}
                    onClick={() => setActiveTab('leaderboards')}
                  >
                    <FaTrophy /> Leaderboards
                  </button>
                </div>

                {activeTab === 'servers' && (
                  <ServerUtilities 
                    discordStatus={discordStatus}
                    onLoadData={loadDiscordData}
                  />
                )}

                {activeTab === 'reminders' && (
                  <ReminderUtilities 
                    reminders={reminders}
                    setReminders={setReminders}
                    configuredGuilds={configuredGuilds}
                  />
                )}

                {activeTab === 'leaderboards' && (
                  <LeaderboardUtilities 
                    leaderboards={leaderboards}
                    setLeaderboards={setLeaderboards}
                    configuredGuilds={configuredGuilds}
                    availableManagers={availableManagers}
                    userRole={user && user.Role}
                  />
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                <p>Your Discord account is successfully linked.</p>
                <p>Advanced Discord features are available to management-level users.</p>
              </div>
            )}
          </div>
        )}

      {/* Modals */}

    </div>
  );
};

export default DiscordUtilities; 