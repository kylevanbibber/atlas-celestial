import React, { useState, useEffect } from 'react';
import { FaPlus, FaTrash, FaServer } from 'react-icons/fa';
import api from '../../api';

const ServerSettings = ({ 
  discordStatus, 
  onLoadData, 
  rateLimitStatus 
}) => {
  const [guilds, setGuilds] = useState([]);
  const [configuredGuilds, setConfiguredGuilds] = useState([]);
  const [botGuildIds, setBotGuildIds] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Modal states
  const [showGuildModal, setShowGuildModal] = useState(false);
  const [selectedGuild, setSelectedGuild] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [channels, setChannels] = useState([]);

  useEffect(() => {
    if (discordStatus.linked) {
      loadServerData();
    }
  }, [discordStatus.linked]);

  const loadServerData = async () => {
    try {
      setLoading(true);
      
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

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
        Loading server settings...
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>Available Servers</h3>
        {guilds.filter(g => !configuredGuilds.some(c => c.guild_id === g.id)).map(guild => (
          <div key={guild.id} style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
            border: '1px solid var(--border-color)', borderRadius: '6px', marginBottom: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
              {guild.icon_url ? (
                <img src={guild.icon_url} alt={`${guild.name} icon`} style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
              ) : (
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#5865f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                  {guild.name.charAt(0)}
                </div>
              )}
              <span>{guild.name}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleAddBotAndConfigure(guild)}
                className="settings-button"
                title="Add bot to server and add to team servers"
              >
                <FaPlus /> Add Bot
              </button>
              <button
                onClick={() => handleConfigureGuildInline(guild)}
                className="settings-button-secondary"
                title="Add to team servers without adding bot"
              >
                <FaServer /> Add to Team Servers
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
            <div key={`${cfg.guild_id}-${cfg.channel_id || 'noChannel'}`} style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
              border: '1px solid var(--border-color)', borderRadius: '6px', marginBottom: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                {fullGuild.icon_url ? (
                  <img src={fullGuild.icon_url} alt={`${cfg.guild_name} icon`} style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                ) : (
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#5865f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                    {cfg.guild_name.charAt(0)}
                  </div>
                )}
                <div>
                  <div>{cfg.guild_name}</div>
                  {cfg.channel_id && <div style={{ fontSize: '0.9em', color: 'var(--text-secondary)' }}>#{cfg.channel_name}</div>}
                  <div style={{ fontSize: '0.8em', color: isBotInServer ? 'var(--success-color, #155724)' : 'var(--text-secondary)' }}>
                    {loading ? 'Checking...' : (isBotInServer ? 'Bot Added' : 'Bot Not Added')}
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="checkbox"
                    checked={!!cfg.is_primary}
                    onChange={() => handleTogglePrimary(cfg)}
                  /> Primary Server
                </label>
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                {isBotInServer ? (
                  <button
                    onClick={() => handleRemoveBot(cfg.guild_id)}
                    className="settings-button-secondary"
                    title="Remove bot from server but keep in team servers"
                  >
                    <FaTrash /> Remove Bot Only
                  </button>
                ) : (
                  <button
                    onClick={() => handleAddBot({id: cfg.guild_id})}
                    className="settings-button"
                    title="Add bot to server"
                  >
                    <FaPlus /> Add Bot
                  </button>
                )}
                
                <button
                  onClick={() => handleRemoveConfig(cfg)}
                  className="settings-button-secondary"
                  title="Remove server from team servers"
                >
                  <FaTrash /> Remove Server
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

export default ServerSettings; 