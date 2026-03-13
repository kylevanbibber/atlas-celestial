import React, { useState } from 'react';
import { FaPlay, FaPlus, FaTrash, FaEdit, FaClock, FaVolumeUp, FaYoutube, FaMicrophone, FaFlask } from 'react-icons/fa';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../api';

const MotivationCallUtilities = ({ 
  discordStatus, 
  onLoadData
}) => {
  const { user } = useAuth();
  const [motivationCalls, setMotivationCalls] = useState([]);
  const [availableGuilds, setAvailableGuilds] = useState([]);
  const [voiceChannels, setVoiceChannels] = useState({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCall, setEditingCall] = useState(null);
  const [loading, setLoading] = useState(false);
  const [testingCall, setTestingCall] = useState(null);
  const [formData, setFormData] = useState({
    guild_id: '',
    guild_name: '',
    voice_channel_id: '',
    voice_channel_name: '',
    cron_expr: '0 9 * * 1-5', // Default: 9 AM weekdays
    youtube_playlist_url: '',
    title: '',
    description: '',
    volume: 1.0,
    is_active: true
  });

  // Load data when component mounts or when requested
  React.useEffect(() => {
    // Only load data if user is authenticated and Discord is linked
    if (user && discordStatus.linked) {
      loadMotivationCallsData();
    }
  }, [user, discordStatus.linked]);

  const loadMotivationCallsData = async () => {
    try {
      setLoading(true);
      
      // Load motivation calls and guilds in parallel
      const [motivationCallsRes, guildsRes] = await Promise.all([
        api.get('/discord/motivation-calls'),
        api.get('/discord/guilds')
      ]);

      setMotivationCalls(motivationCallsRes.data.motivationCalls || []);
      setAvailableGuilds(guildsRes.data.guilds || []);
      
    } catch (error) {
      console.error('Error loading motivation calls data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVoiceChannels = async (guildId) => {
    if (!guildId || voiceChannels[guildId]) return; // Already loaded
    
    try {
      const response = await api.get(`/discord/guilds/${guildId}/voice-channels`);
      setVoiceChannels(prev => ({
        ...prev,
        [guildId]: response.data.voiceChannels || []
      }));
    } catch (error) {
      console.error(`Error loading voice channels for guild ${guildId}:`, error);
      setVoiceChannels(prev => ({
        ...prev,
        [guildId]: []
      }));
    }
  };

  const handleGuildChange = (guildId) => {
    const guild = availableGuilds.find(g => g.id === guildId);
    setFormData(prev => ({
      ...prev,
      guild_id: guildId,
      guild_name: guild ? guild.name : '',
      voice_channel_id: '',
      voice_channel_name: ''
    }));

    if (guildId) {
      loadVoiceChannels(guildId);
    }
  };

  const handleVoiceChannelChange = (channelId) => {
    const channels = voiceChannels[formData.guild_id] || [];
    const channel = channels.find(c => c.id === channelId);
    setFormData(prev => ({
      ...prev,
      voice_channel_id: channelId,
      voice_channel_name: channel ? channel.name : ''
    }));
  };

  const handleCreateCall = async (e) => {
    e.preventDefault();
    
    if (!formData.guild_id || !formData.voice_channel_id || !formData.cron_expr || 
        !formData.youtube_playlist_url || !formData.title) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      
      if (editingCall) {
        await api.put(`/discord/motivation-calls/${editingCall.id}`, formData);
      } else {
        await api.post('/discord/motivation-calls', formData);
      }

      // Reset form and reload data
      resetForm();
      await loadMotivationCallsData();
      
      if (onLoadData) {
        onLoadData(); // Trigger parent to reload bot jobs
      }

    } catch (error) {
      console.error('Error saving motivation call:', error);
      alert('Failed to save motivation call: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleEditCall = (call) => {
    setEditingCall(call);
    setFormData({
      guild_id: call.guild_id,
      guild_name: call.guild_name,
      voice_channel_id: call.voice_channel_id,
      voice_channel_name: call.voice_channel_name,
      cron_expr: call.cron_expr,
      youtube_playlist_url: call.youtube_playlist_url,
      title: call.title,
      description: call.description || '',
      volume: call.volume || 1.0,
      is_active: call.is_active
    });
    setShowCreateForm(true);
    
    // Load voice channels for the guild
    if (call.guild_id) {
      loadVoiceChannels(call.guild_id);
    }
  };

  const handleDeleteCall = async (callId) => {
    if (!window.confirm('Are you sure you want to delete this motivation call?')) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/discord/motivation-calls/${callId}`);
      await loadMotivationCallsData();
      
      if (onLoadData) {
        onLoadData(); // Trigger parent to reload bot jobs
      }
    } catch (error) {
      console.error('Error deleting motivation call:', error);
      alert('Failed to delete motivation call: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleTestCall = async (call) => {
    if (!window.confirm(`Test motivation call "${call.title}"?\n\nThe bot will join ${call.voice_channel_name} and play the video immediately.`)) {
      return;
    }

    try {
      setTestingCall(call.id);
      console.log(`Testing motivation call: ${call.title}`);
      
      const response = await api.post(`/discord/motivation-calls/${call.id}/test`);
      
      if (response.data.success) {
        alert(`✅ Test started!\n\n${response.data.message}\n\nCheck your Discord voice channel to hear the motivation call!`);
      }
    } catch (error) {
      console.error('Error testing motivation call:', error);
      const errorMessage = error.response?.data?.error || error.message;
      alert(`❌ Test failed: ${errorMessage}\n\nMake sure:\n• The bot is online\n• The bot has access to the voice channel\n• The YouTube URL is valid`);
    } finally {
      setTestingCall(null);
    }
  };

  const resetForm = () => {
    setFormData({
      guild_id: '',
      guild_name: '',
      voice_channel_id: '',
      voice_channel_name: '',
      cron_expr: '0 9 * * 1-5',
      youtube_playlist_url: '',
      title: '',
      description: '',
      volume: 1.0,
      is_active: true
    });
    setEditingCall(null);
    setShowCreateForm(false);
  };

  const formatCronExpression = (cronExpr) => {
    // Basic cron description - you could use a library like cron-parser for more detailed descriptions
    const parts = cronExpr.split(' ');
    if (parts.length === 5) {
      const [minute, hour, day, month, weekday] = parts;
      let description = `${hour}:${minute.padStart(2, '0')}`;
      
      if (weekday === '*') {
        description += ' daily';
      } else if (weekday === '1-5') {
        description += ' on weekdays';
      } else if (weekday === '0,6') {
        description += ' on weekends';
      }
      
      return description;
    }
    return cronExpr;
  };

  // Don't render anything if user isn't authenticated
  if (!user) {
    return null;
  }

  if (!discordStatus.linked) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <FaMicrophone size={48} style={{ color: 'var(--text-secondary)', marginBottom: '16px' }} />
        <p style={{ color: 'var(--text-secondary)' }}>
          Link your Discord account to set up motivation calls
        </p>
      </div>
    );
  }

  return (
    <div className="settings-section">
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px' 
      }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FaMicrophone />
          Motivation Calls
        </h3>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="settings-button"
          disabled={loading}
        >
          <FaPlus /> {showCreateForm ? 'Cancel' : 'Add Motivation Call'}
        </button>
      </div>

      {showCreateForm && (
        <div className="settings-form" style={{ marginBottom: '24px' }}>
          <h4>{editingCall ? 'Edit Motivation Call' : 'Create New Motivation Call'}</h4>
          <form onSubmit={handleCreateCall}>
            <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <label>Server *</label>
                <select
                  value={formData.guild_id}
                  onChange={(e) => handleGuildChange(e.target.value)}
                  required
                >
                  <option value="">Select a server...</option>
                  {availableGuilds.map(guild => (
                    <option key={guild.id} value={guild.id}>
                      {guild.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Voice Channel *</label>
                <select
                  value={formData.voice_channel_id}
                  onChange={(e) => handleVoiceChannelChange(e.target.value)}
                  required
                  disabled={!formData.guild_id}
                >
                  <option value="">Select a voice channel...</option>
                  {(voiceChannels[formData.guild_id] || []).map(channel => (
                    <option key={channel.id} value={channel.id}>
                      🔊 {channel.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Morning Motivation"
                  required
                />
              </div>

              <div>
                <label>Schedule (Cron Expression) *</label>
                <input
                  type="text"
                  value={formData.cron_expr}
                  onChange={(e) => setFormData(prev => ({ ...prev, cron_expr: e.target.value }))}
                  placeholder="0 9 * * 1-5"
                  required
                  title="Format: minute hour day month weekday (e.g., '0 9 * * 1-5' for 9 AM weekdays)"
                />
                <small>Examples: '0 9 * * 1-5' (9 AM weekdays), '0 8 * * *' (8 AM daily)</small>
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <label>YouTube Playlist/Video URL *</label>
              <input
                type="url"
                value={formData.youtube_playlist_url}
                onChange={(e) => setFormData(prev => ({ ...prev, youtube_playlist_url: e.target.value }))}
                placeholder="https://www.youtube.com/watch?v=... or https://www.youtube.com/playlist?list=..."
                required
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginTop: '16px' }}>
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description..."
                rows="3"
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: '1fr 1fr', marginTop: '16px' }}>
              <div>
                <label>Volume</label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={formData.volume}
                  onChange={(e) => setFormData(prev => ({ ...prev, volume: parseFloat(e.target.value) }))}
                />
                <small>{Math.round(formData.volume * 100)}%</small>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                />
                <label htmlFor="is_active">Active</label>
              </div>
            </div>

            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--info-bg, #e3f2fd)', borderRadius: '6px', fontSize: '0.9em' }}>
              <strong>💡 Tip:</strong> After creating your motivation call, use the <FaFlask style={{ display: 'inline', margin: '0 2px' }}/> "Test Now" button to immediately test it without waiting for the scheduled time!
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
              <button type="submit" className="settings-button" disabled={loading}>
                <FaPlay /> {editingCall ? 'Update Call' : 'Create Call'}
              </button>
              <button type="button" onClick={resetForm} className="settings-button secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>}

      {motivationCalls.length === 0 && !loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          <FaMicrophone size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
          <p>No motivation calls configured</p>
          <p>Create your first motivation call to start daily team motivation!</p>
        </div>
      ) : (
        <div className="settings-list">
          {motivationCalls.map(call => (
            <div key={call.id} className="settings-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <FaYoutube style={{ color: '#ff0000' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    {call.title}
                    {!call.is_active && <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal' }}> (Inactive)</span>}
                  </div>
                  <div style={{ fontSize: '0.9em', color: 'var(--text-secondary)' }}>
                    🏠 {call.guild_name} • 🔊 {call.voice_channel_name}
                  </div>
                  <div style={{ fontSize: '0.8em', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    <FaClock /> {formatCronExpression(call.cron_expr)} • <FaVolumeUp /> {Math.round((call.volume || 1.0) * 100)}%
                  </div>
                  {call.description && (
                    <div style={{ fontSize: '0.8em', color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>
                      {call.description}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleTestCall(call)}
                  className="settings-button small"
                  title="Test Now - Join voice channel and play video"
                  disabled={testingCall === call.id || !call.is_active}
                  style={{ 
                    backgroundColor: testingCall === call.id ? 'var(--warning-bg, #ffc107)' : undefined,
                    opacity: !call.is_active ? 0.6 : 1
                  }}
                >
                  {testingCall === call.id ? <FaClock /> : <FaFlask />}
                </button>
                <button
                  onClick={() => handleEditCall(call)}
                  className="settings-button small"
                  title="Edit Motivation Call"
                >
                  <FaEdit />
                </button>
                <button
                  onClick={() => handleDeleteCall(call.id)}
                  className="settings-button small danger"
                  title="Delete Motivation Call"
                >
                  <FaTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MotivationCallUtilities;
