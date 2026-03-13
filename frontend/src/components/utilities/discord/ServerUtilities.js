import React, { useState, useEffect } from 'react';
import { FaPlus, FaTrash, FaServer } from 'react-icons/fa';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../api';

const ServerUtilities = ({ 
  discordStatus, 
  onLoadData, 
  rateLimitStatus 
}) => {
  const { user } = useAuth();
  const [guilds, setGuilds] = useState([]);
  const [configuredGuilds, setConfiguredGuilds] = useState([]);
  const [botGuildIds, setBotGuildIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [discordError, setDiscordError] = useState(null);
  
  // Modal states
  const [showGuildModal, setShowGuildModal] = useState(false);
  const [selectedGuild, setSelectedGuild] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [channels, setChannels] = useState([]);

  useEffect(() => {
    // Only load data if user is authenticated and Discord is linked
    if (user && discordStatus.linked) {
      loadServerData();
    }
  }, [user, discordStatus.linked]);

  const loadServerData = async () => {
    // Double-check user is authenticated before making any API calls
    if (!user) {
      console.log('[ServerUtilities] Skipping data load - user not authenticated');
      return;
    }
    
    try {
      setLoading(true);
      setDiscordError(null);
      
      // Load user's Discord servers with caching
      const guildsRes = await api.getCached('/discord/guilds');
      setGuilds(guildsRes.data.guilds);

      // Load which servers the bot is in
      const botGuildsRes = await api.getCached('/discord/bot/guilds');
      setBotGuildIds(botGuildsRes.data.guild_ids);

      // Load configured servers
      const configuredRes = await api.getCached('/discord/guilds/configured');
      setConfiguredGuilds(configuredRes.data.guilds);
    } catch (error) {
      console.error('Error loading server data:', error);
      
      // Don't trigger logout on Discord API errors - they're not auth token issues
      // Handle specific Discord authentication errors
      if (error.response?.status === 401) {
        const errorMessage = error.response?.data?.error || 'Discord not linked';
        if (errorMessage.includes('Discord not linked') || errorMessage.includes('token expired') || errorMessage.includes('token invalid')) {
          // Set empty state for guilds since Discord isn't linked
          setGuilds([]);
          setBotGuildIds([]);
          // Keep configured guilds as they might exist from previous linking
          setDiscordError('Your Discord account is not linked. Please link your Discord account in the Discord Settings section to manage servers.');
        }
      }
    } finally {
      setLoading(false);
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

      // Update local state
      const newConfig = {
        guild_id: selectedGuild.id,
        guild_name: selectedGuild.name,
        channel_id: selectedChannel.id,
        channel_name: selectedChannel.name,
        bot_added: 0,
        is_primary: 0
      };
      
      setConfiguredGuilds(prev => [...prev, newConfig]);
      setGuilds(prev => prev.filter(g => g.id !== selectedGuild.id));

      setShowGuildModal(false);
      setSelectedGuild(null);
      setSelectedChannel(null);
      setChannels([]);
    } catch (error) {
      console.error('Error configuring guild:', error);
    }
  };

  // configure a new guild inline (without bot)
  const handleConfigureGuildInline = async (guild) => {
    try {
      await api.post('/discord/guilds/configure', {
        guild_id: guild.id,
        guild_name: guild.name,
        channel_id: '',       // no channel selection here
        channel_name: '',
        bot_added: 0,         // Always start without bot
        is_primary: 0         // Not primary by default
      });
      
      // Update local state instead of reloading all data
      const newConfig = {
        guild_id: guild.id,
        guild_name: guild.name,
        channel_id: '',
        channel_name: '',
        bot_added: 0,
        is_primary: 0
      };
      
      setConfiguredGuilds(prev => [...prev, newConfig]);
      setGuilds(prev => prev.filter(g => g.id !== guild.id));
    } catch (err) {
      console.error('Error configuring guild inline:', err);
    }
  };

  // Add bot to server and add to guild_configs
  const handleAddBotAndConfigure = async (guild) => {
    try {
      // First add to guild_configs with bot_added=1
      await api.post('/discord/guilds/configure', {
        guild_id: guild.id,
        guild_name: guild.name,
        channel_id: '',
        channel_name: '',
        bot_added: 1,
        is_primary: 0
      });
      
      // Update local state
      const newConfig = {
        guild_id: guild.id,
        guild_name: guild.name,
        channel_id: '',
        channel_name: '',
        bot_added: 1,
        is_primary: 0
      };
      
      setConfiguredGuilds(prev => [...prev, newConfig]);
      setGuilds(prev => prev.filter(g => g.id !== guild.id));
      
      // Then open Discord OAuth URL
      handleAddBot(guild);
    } catch (err) {
      console.error('Error configuring guild with bot:', err);
    }
  };

  // Add bot to server
  const handleAddBot = (guild) => {
    // Generate Discord OAuth URL to add the bot to the server
    const params = new URLSearchParams({
      client_id: process.env.REACT_APP_DISCORD_CLIENT_ID || '1396858666287628389',
      permissions: process.env.REACT_APP_DISCORD_PERMISSIONS || '8',
      scope: 'bot applications.commands',
      guild_id: guild.id
    });
    
    // Open Discord OAuth URL
    window.open(`https://discord.com/api/oauth2/authorize?${params.toString()}`, '_blank');
    
    // Set a timeout to refresh data after a delay
    // This gives time for the bot to join the server and update the database
    setTimeout(() => {
      // Check if the bot has been added to the server
      api.get('/discord/bot/guilds')
        .then(res => {
          const currentBotGuilds = res.data.guild_ids || [];
          if (currentBotGuilds.includes(guild.id)) {
            // Update local state to show bot has been added
            setBotGuildIds(prev => [...prev, guild.id]);
            
            // Update the configured guilds to show bot_added = 1
            setConfiguredGuilds(prev => 
              prev.map(cfg => 
                cfg.guild_id === guild.id 
                  ? { ...cfg, bot_added: 1 } 
                  : cfg
              )
            );
          }
        })
        .catch(err => {
          console.error('Error checking bot guilds:', err);
        });
    }, 5000); // 5 second delay
    
    // Also set up polling to check for changes every few seconds
    // This handles cases where the user takes longer to authorize
    let pollCount = 0;
    const maxPolls = 6; // Poll up to 6 times (30 seconds total)
    
    const pollInterval = setInterval(() => {
      pollCount++;
      if (pollCount > maxPolls) {
        clearInterval(pollInterval);
        return;
      }
      
      // Check if the bot has been added to the server
      api.get('/discord/bot/guilds')
        .then(res => {
          const currentBotGuilds = res.data.guild_ids || [];
          if (currentBotGuilds.includes(guild.id)) {
            // Update local state to show bot has been added
            setBotGuildIds(prev => [...prev, guild.id]);
            
            // Update the configured guilds to show bot_added = 1
            setConfiguredGuilds(prev => 
              prev.map(cfg => 
                cfg.guild_id === guild.id 
                  ? { ...cfg, bot_added: 1 } 
                  : cfg
              )
            );
            
            clearInterval(pollInterval);
          }
        })
        .catch(err => {
          console.error('Error checking bot guilds during polling:', err);
        });
    }, 5000); // Check every 5 seconds
  };

  // Remove bot from server and update guild_configs
  const handleRemoveBot = async (guildId) => {
    try {
      const removeResponse = await api.delete(`/discord/guilds/${guildId}/bot`);
      
      // Update local state
      setConfiguredGuilds(prev => 
        prev.map(guild => 
          guild.guild_id === guildId 
            ? { ...guild, bot_added: 0 } 
            : guild
        )
      );
      
      // Check if we hit rate limits
      if (removeResponse.data.rate_limited) {
        // Show a message to the user about rate limiting
        alert("The bot configurations were updated, but Discord's rate limits prevented immediate bot removal. The bot will be removed shortly.");
      }
      
      // Update botGuildIds state to remove this guild
      setBotGuildIds(prev => prev.filter(id => id !== guildId));
      
    } catch (error) {
      console.error('Error removing bot from guild:', error);
      alert("There was an error removing the bot. Please try again later.");
    }
  };

  // Toggle only is_primary on an existing config
  const handleTogglePrimary = async (cfg) => {
    try {
      // Ensure we have a valid endpoint - if channelId is empty, use a different endpoint pattern
      const channelId = cfg.channel_id || '';
      const newIsPrimary = cfg.is_primary ? 0 : 1;
      
      let endpoint;
      if (channelId === '') {
        endpoint = `/discord/guilds/${cfg.guild_id}/channels/none`; // Use 'none' as a placeholder
      } else {
        endpoint = `/discord/guilds/${cfg.guild_id}/channels/${channelId}`;
      }
      
      await api.put(endpoint, { is_primary: newIsPrimary });
      
      // Update local state
      setConfiguredGuilds(prev => {
        // If setting a new primary, unset any existing primary
        if (newIsPrimary === 1) {
          prev = prev.map(guild => ({ ...guild, is_primary: 0 }));
        }
        
        // Set the new value for this guild
        return prev.map(guild => 
          guild.guild_id === cfg.guild_id && guild.channel_id === cfg.channel_id 
            ? { ...guild, is_primary: newIsPrimary } 
            : guild
        );
      });
    } catch (err) {
      console.error('Error toggling is_primary:', err);
    }
  };

  // inline removal: delete row or clear bot flag
  const handleRemoveConfig = async (cfg) => {
    // Ask for confirmation
    const confirmMessage = cfg.bot_added 
      ? `This will remove the server from your team servers AND remove the bot from the Discord server. Continue?` 
      : `This will remove the server from your team servers. Continue?`;
      
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    try {
      // channelless → this is just your inline bot row, so clear via bot DELETE
      if (!cfg.channel_id) {
        await api.delete(`/discord/guilds/${cfg.guild_id}/bot`);
      } 
      // normal config → remove the row
      else {
        await api.delete(
          `/discord/guilds/${cfg.guild_id}/channels/${cfg.channel_id}`
        );
      }
      
      // Update local state
      setConfiguredGuilds(prev => 
        prev.filter(guild => 
          !(guild.guild_id === cfg.guild_id && guild.channel_id === (cfg.channel_id || ''))
        )
      );
      
      // If bot was added, update botGuildIds
      if (cfg.bot_added) {
        setBotGuildIds(prev => prev.filter(id => id !== cfg.guild_id));
      }
      
      // Check if this guild is already in the available guilds list
      const existingGuild = guilds.find(g => g.id === cfg.guild_id);
      
      if (!existingGuild) {
        // If the guild is not in our available guilds list, check if it's still accessible
        try {
          // First try to see if we have the guild details from the Discord API
          const guildDetails = await api.get(`/discord/guilds/${cfg.guild_id}`);
          
          if (guildDetails.data && guildDetails.data.guild) {
            // If we got the guild details, add it to the available guilds
            setGuilds(prev => [...prev, guildDetails.data.guild]);
          } else {
            // If we didn't get the guild details, create a basic entry
            const guildToAdd = {
              id: cfg.guild_id,
              name: cfg.guild_name,
              icon_url: null
            };
            setGuilds(prev => [...prev, guildToAdd]);
          }
        } catch (fetchErr) {
          console.error('Error fetching guild after removal:', fetchErr);
          // If we can't fetch the guild, create a basic entry
          const guildToAdd = {
            id: cfg.guild_id,
            name: cfg.guild_name,
            icon_url: null
          };
          setGuilds(prev => [...prev, guildToAdd]);
        }
      }
    } catch (err) {
      console.error('Error removing config:', err);
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

  // Don't render anything if user isn't authenticated
  if (!user) {
    return null;
  }

  // Don't render server utilities if Discord isn't linked
  if (!discordStatus.linked) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px 20px', 
        color: 'var(--text-secondary)' 
      }}>
        <p>Connect your Discord account to manage server settings.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px 20px', 
        color: 'var(--text-secondary)',
        fontSize: '16px',
        lineHeight: '1.5'
      }}>
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--border-color)',
            borderTop: '3px solid var(--primary-color, #007BFF)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
        </div>
        Loading server settings...
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '100%',
      padding: '0 4px'
    }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @media (max-width: 768px) {
          .server-settings-container {
            padding: 0 8px;
          }
          
          .server-card {
            margin-bottom: 16px;
          }
          
          .server-actions {
            flex-direction: column;
            gap: 8px;
          }
          
          .server-actions button {
            width: 100%;
            min-width: auto;
          }
        }
        
        @media (max-width: 480px) {
          .server-settings-container {
            padding: 0 4px;
          }
          
          .server-info {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
          
          .server-icon {
            align-self: center;
          }
        }
      `}</style>
      {/* Discord Error Message */}
      {discordError && (
        <div style={{
          padding: '16px',
          marginBottom: '24px',
          backgroundColor: 'var(--alert-bg, #fff3cd)',
          border: '1px solid var(--alert-border, #ffeaa7)',
          borderRadius: '8px',
          color: 'var(--alert-text, #856404)',
          fontSize: '14px',
          lineHeight: '1.5'
        }}>
          <div style={{ 
            fontWeight: '600', 
            marginBottom: '8px',
            fontSize: '16px'
          }}>
            Discord Connection Required
          </div>
          <div>{discordError}</div>
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>Available Servers</h3>
        {guilds.filter(g => !configuredGuilds.some(c => c.guild_id === g.id)).map(guild => (
          <div key={guild.id} className="server-card" style={{
            display: 'flex', 
            flexDirection: 'column',
            gap: '12px', 
            padding: '16px',
            border: '1px solid var(--border-color)', 
            borderRadius: '8px', 
            marginBottom: '12px',
            backgroundColor: 'var(--card-bg, #ffffff)'
          }}>
            {/* Server Info Row */}
            <div className="server-info" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              flex: 1,
              minHeight: '48px'
            }}>
                              {guild.icon_url ? (
                  <img src={guild.icon_url} alt={`${guild.name} icon`} className="server-icon" style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '50%',
                    flexShrink: 0
                  }} />
                ) : (
                  <div className="server-icon" style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '50%', 
                    backgroundColor: '#5865f2', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: 'white', 
                    fontWeight: 'bold',
                    fontSize: '18px',
                    flexShrink: 0
                  }}>
                    {guild.name.charAt(0)}
                  </div>
                )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  color: 'var(--text-primary)',
                  marginBottom: '4px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {guild.name}
                </div>
              </div>
            </div>
            
            {/* Action Buttons Row */}
            <div className="server-actions" style={{ 
              display: 'flex', 
              gap: '8px',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => handleAddBotAndConfigure(guild)}
                className="settings-button"
                title="Add bot to server and add to team servers"
                style={{
                  flex: '1 1 auto',
                  minWidth: '120px',
                  height: '40px',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <FaPlus size={14} /> Add Bot
              </button>
              <button
                onClick={() => handleConfigureGuildInline(guild)}
                className="settings-button-secondary"
                title="Add to team servers without adding bot"
                style={{
                  flex: '1 1 auto',
                  minWidth: '120px',
                  height: '40px',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <FaServer size={14} /> Add to Team
              </button>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>Configured Servers</h3>
        {configuredGuilds.map(cfg => {
          const fullGuild = guilds.find(g => g.id === cfg.guild_id) || {};
          const isBotInServer = botGuildIds.includes(cfg.guild_id) || cfg.bot_added;
          
          return (
            <div key={`${cfg.guild_id}-${cfg.channel_id || 'noChannel'}`} className="server-card" style={{
              display: 'flex', 
              flexDirection: 'column',
              gap: '12px', 
              padding: '16px',
              border: '1px solid var(--border-color)', 
              borderRadius: '8px', 
              marginBottom: '12px',
              backgroundColor: 'var(--card-bg, #ffffff)'
            }}>
              {/* Server Info Row */}
              <div className="server-info" style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                flex: 1,
                minHeight: '48px'
              }}>
                {fullGuild.icon_url ? (
                  <img src={fullGuild.icon_url} alt={`${cfg.guild_name} icon`} className="server-icon" style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '50%',
                    flexShrink: 0
                  }} />
                ) : (
                  <div className="server-icon" style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '50%', 
                    backgroundColor: '#5865f2', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: 'white', 
                    fontWeight: 'bold',
                    fontSize: '18px',
                    flexShrink: 0
                  }}>
                    {cfg.guild_name.charAt(0)}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    color: 'var(--text-primary)',
                    marginBottom: '4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {cfg.guild_name}
                  </div>
                  {cfg.channel_id && (
                    <div style={{ 
                      fontSize: '14px', 
                      color: 'var(--text-secondary)',
                      marginBottom: '2px'
                    }}>
                      #{cfg.channel_name}
                    </div>
                  )}
                  <div style={{ 
                    fontSize: '12px', 
                    color: isBotInServer ? 'var(--success-color, #155724)' : 'var(--text-secondary)',
                    fontWeight: isBotInServer ? '600' : '400'
                  }}>
                    {loading ? 'Checking...' : (isBotInServer ? '✓ Bot Added' : '✗ Bot Not Added')}
                  </div>
                </div>
              </div>
              
              {/* Primary Server Toggle */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                padding: '8px 0',
                borderTop: '1px solid var(--border-color)',
                borderBottom: '1px solid var(--border-color)'
              }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={!!cfg.is_primary}
                    onChange={() => handleTogglePrimary(cfg)}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                  /> 
                  Primary Server
                </label>
              </div>
              
              {/* Action Buttons Row */}
              <div className="server-actions" style={{ 
                display: 'flex', 
                gap: '8px',
                flexWrap: 'wrap'
              }}>
                {isBotInServer ? (
                  <button
                    onClick={() => handleRemoveBot(cfg.guild_id)}
                    className="settings-button-secondary"
                    title="Remove bot from server but keep in team servers"
                    style={{
                      flex: '1 1 auto',
                      minWidth: '120px',
                      height: '40px',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <FaTrash size={14} /> Remove Bot
                  </button>
                ) : (
                  <button
                    onClick={() => handleAddBot({id: cfg.guild_id})}
                    className="settings-button"
                    title="Add bot to server"
                    style={{
                      flex: '1 1 auto',
                      minWidth: '120px',
                      height: '40px',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <FaPlus size={14} /> Add Bot
                  </button>
                )}
                
                <button
                  onClick={() => handleRemoveConfig(cfg)}
                  className="settings-button-secondary"
                  title="Remove server from team servers"
                  style={{
                    flex: '1 1 auto',
                    minWidth: '120px',
                    height: '40px',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <FaTrash size={14} /> Remove Server
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Guild Modal */}
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
    </div>
  );
};

// GuildModal component
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

export default ServerUtilities; 