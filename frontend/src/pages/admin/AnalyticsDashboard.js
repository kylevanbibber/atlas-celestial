import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FiActivity, FiUsers, FiEye, FiSearch, FiTrendingUp, FiBarChart2, FiWifi, FiRefreshCw } from 'react-icons/fi';
import api from '../../api';
import './AnalyticsDashboard.css';

// WebSocket URL configuration - matches API configuration
const getWebSocketUrl = () => {
  if (process.env.NODE_ENV === "production") {
    return "wss://atlas-celest-backend-3bb2fea96236.herokuapp.com/ws/notifications";
  } else {
    return "ws://localhost:5001/ws/notifications";
  }
};

const AnalyticsDashboard = () => {
  const { user, token } = useAuth();
  const searchContainerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Data states
  const [overviewStats, setOverviewStats] = useState(null);
  const [mostViewedPages, setMostViewedPages] = useState([]);
  const [mostActiveUsers, setMostActiveUsers] = useState([]);
  const [topSearches, setTopSearches] = useState([]);
  const [agentProfileViews, setAgentProfileViews] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserInfo, setSelectedUserInfo] = useState(null);
  const [userPages, setUserPages] = useState([]);
  const [userSearches, setUserSearches] = useState([]);
  const [userTimeline, setUserTimeline] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);

  // Live active users state
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [activeUsersList, setActiveUsersList] = useState([]);
  const [showActiveUsersList, setShowActiveUsersList] = useState(false);
  const wsRef = useRef(null);

  // Check access
  const hasAccess = user?.lagnname?.toUpperCase().includes('VANBIBBER') || user?.Role === 'Admin';

  // Fetch the active users list (with names/pics) from REST endpoint
  const fetchActiveUsersList = useCallback(async () => {
    try {
      const response = await api.get('/analytics/active-users');
      if (response.data.success) {
        setActiveUsersCount(response.data.count);
        setActiveUsersList(response.data.users || []);
      }
    } catch (error) {
      console.error('Error fetching active users:', error);
    }
  }, []);

  // WebSocket connection for real-time active user count
  useEffect(() => {
    if (!hasAccess || !token) return;

    const wsUrl = getWebSocketUrl();
    let ws;
    
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Authenticate
        ws.send(JSON.stringify({ type: 'auth', token }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'active_users_count') {
            setActiveUsersCount(data.count);
            // Refresh the full list when count changes
            fetchActiveUsersList();
          } else if (data.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (err) {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        // Fall back to REST
        fetchActiveUsersList();
      };
    } catch (err) {
      fetchActiveUsersList();
    }

    return () => {
      if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close(1000, 'Analytics unmount');
      }
    };
  }, [hasAccess, token, fetchActiveUsersList]);

  useEffect(() => {
    if (hasAccess) {
      loadData();
      fetchActiveUsersList();
    }
  }, [hasAccess, fetchActiveUsersList]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setUserSearchResults([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadOverviewStats(),
        loadMostViewedPages(),
        loadMostActiveUsers(),
        loadTopSearches(),
        loadAgentProfileViews()
      ]);
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOverviewStats = async () => {
    try {
      const response = await api.get('/analytics/stats/overview');
      if (response.data.success) {
        setOverviewStats(response.data.data);
      }
    } catch (error) {
      console.error('Error loading overview stats:', error);
    }
  };

  const loadMostViewedPages = async () => {
    try {
      const response = await api.get('/analytics/pages/most-viewed?limit=20');
      if (response.data.success) {
        setMostViewedPages(response.data.data);
      }
    } catch (error) {
      console.error('Error loading most viewed pages:', error);
    }
  };

  const loadMostActiveUsers = async () => {
    try {
      const response = await api.get('/analytics/users/most-active?limit=20');
      if (response.data.success) {
        setMostActiveUsers(response.data.data);
      }
    } catch (error) {
      console.error('Error loading most active users:', error);
    }
  };

  const loadTopSearches = async () => {
    try {
      const response = await api.get('/analytics/searches/top-queries?limit=20');
      if (response.data.success) {
        setTopSearches(response.data.data);
      }
    } catch (error) {
      console.error('Error loading top searches:', error);
    }
  };

  const loadAgentProfileViews = async () => {
    try {
      const response = await api.get('/analytics/agent-profiles/views?limit=20');
      if (response.data.success) {
        setAgentProfileViews(response.data.data);
      }
    } catch (error) {
      console.error('Error loading agent profile views:', error);
    }
  };

  const loadUserDetails = async (userId, userInfo = null) => {
    try {
      setSelectedUser(userId);
      setSelectedUserInfo(userInfo);
      const [pagesRes, searchesRes, timelineRes] = await Promise.all([
        api.get(`/analytics/users/${userId}/pages`),
        api.get(`/analytics/users/${userId}/searches`),
        api.get(`/analytics/users/${userId}/timeline?days=30`)
      ]);
      
      if (pagesRes.data.success) setUserPages(pagesRes.data.data);
      if (searchesRes.data.success) setUserSearches(searchesRes.data.data);
      if (timelineRes.data.success) setUserTimeline(timelineRes.data.data);
      
      setActiveTab('userDetail');
      setUserSearchQuery('');
      setUserSearchResults([]);
    } catch (error) {
      console.error('Error loading user details:', error);
    }
  };

  const searchUsers = async (query) => {
    if (!query || query.trim().length < 2) {
      setUserSearchResults([]);
      return;
    }
    
    try {
      const response = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
      if (response.data && Array.isArray(response.data)) {
        setUserSearchResults(response.data.slice(0, 10)); // Limit to 10 results
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setUserSearchResults([]);
    }
  };

  const handleUserSearchChange = (e) => {
    const query = e.target.value;
    setUserSearchQuery(query);
    searchUsers(query);
  };

  const selectUserFromSearch = (user) => {
    loadUserDetails(user.id, {
      lagnname: user.lagnname,
      displayName: user.displayName,
      clname: user.clname
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatDateShort = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  };

  if (!hasAccess) {
    return (
      <div className="analytics-dashboard">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>This page is restricted to authorized administrators only.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="analytics-dashboard">
        <div className="analytics-loading">Loading analytics data...</div>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      <div className="analytics-header">
        <h1>Analytics Dashboard</h1>
        <p className="analytics-subtitle">User behavior and platform usage insights</p>
      </div>

      <div className="analytics-tabs">
        <button 
          className={`analytics-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <FiBarChart2 /> Overview
        </button>
        <button 
          className={`analytics-tab ${activeTab === 'pages' ? 'active' : ''}`}
          onClick={() => setActiveTab('pages')}
        >
          <FiEye /> Pages
        </button>
        <button 
          className={`analytics-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <FiUsers /> Users
        </button>
        <button 
          className={`analytics-tab ${activeTab === 'searches' ? 'active' : ''}`}
          onClick={() => setActiveTab('searches')}
        >
          <FiSearch /> Searches
        </button>
        <button 
          className={`analytics-tab ${activeTab === 'profiles' ? 'active' : ''}`}
          onClick={() => setActiveTab('profiles')}
        >
          <FiActivity /> Agent Profiles
        </button>
        {selectedUser && (
          <button 
            className={`analytics-tab ${activeTab === 'userDetail' ? 'active' : ''}`}
            onClick={() => setActiveTab('userDetail')}
          >
            <FiTrendingUp /> User Detail
          </button>
        )}
      </div>

      <div className="analytics-content">
        {activeTab === 'overview' && overviewStats && (
          <div className="overview-tab">
            <div className="stats-grid">
              <div className="stat-card live-stat-card" onClick={() => setShowActiveUsersList(!showActiveUsersList)}>
                <div className="stat-icon live-icon"><FiWifi /></div>
                <div className="stat-info">
                  <div className="stat-value">
                    {activeUsersCount}
                    <span className="live-pulse" />
                  </div>
                  <div className="stat-label">Online Now</div>
                </div>
                <button className="refresh-active-btn" onClick={(e) => { e.stopPropagation(); fetchActiveUsersList(); }} title="Refresh">
                  <FiRefreshCw size={14} />
                </button>
              </div>
              <div className="stat-card">
                <div className="stat-icon"><FiUsers /></div>
                <div className="stat-info">
                  <div className="stat-value">{overviewStats.totalActiveUsers}</div>
                  <div className="stat-label">Total Active Users</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon"><FiEye /></div>
                <div className="stat-info">
                  <div className="stat-value">{overviewStats.totalPageViews?.toLocaleString()}</div>
                  <div className="stat-label">Total Page Views</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon"><FiSearch /></div>
                <div className="stat-info">
                  <div className="stat-value">{overviewStats.totalSearches?.toLocaleString()}</div>
                  <div className="stat-label">Total Searches</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon"><FiActivity /></div>
                <div className="stat-info">
                  <div className="stat-value">{overviewStats.activeUsersLast24h}</div>
                  <div className="stat-label">Active (24h)</div>
                </div>
              </div>
            </div>

            {/* Active Users List Dropdown */}
            {showActiveUsersList && (
              <div className="active-users-panel">
                <div className="active-users-header">
                  <h3><FiWifi /> Users Online ({activeUsersCount})</h3>
                  <button onClick={() => setShowActiveUsersList(false)} className="close-panel-btn">&times;</button>
                </div>
                <div className="active-users-list">
                  {activeUsersList.length > 0 ? activeUsersList.map((u) => (
                    <div key={u.id} className="active-user-row" onClick={() => loadUserDetails(u.id, { lagnname: u.lagnname, clname: u.clname })}>
                      {u.profpic ? (
                        <img src={u.profpic} alt="" className="active-user-pic" />
                      ) : (
                        <div className="active-user-pic-placeholder"><FiUsers size={14} /></div>
                      )}
                      <div className="active-user-info">
                        <span className="active-user-name">{u.lagnname}</span>
                        <span className="active-user-role">{u.clname}</span>
                      </div>
                      <span className="online-dot" />
                    </div>
                  )) : (
                    <div className="no-active-users">No users currently online</div>
                  )}
                </div>
              </div>
            )}
            
            <div className="overview-tables">
              <div className="overview-section">
                <h3>Top 5 Pages</h3>
                <div className="mini-table">
                  {mostViewedPages.slice(0, 5).map((page, idx) => (
                    <div key={idx} className="mini-row">
                      <span className="mini-label">{page.label || page.path}</span>
                      <span className="mini-value">{page.totalVisits} views</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="overview-section">
                <h3>Top 5 Active Users</h3>
                <div className="mini-table">
                  {mostActiveUsers.slice(0, 5).map((u, idx) => (
                    <div key={idx} className="mini-row">
                      <span className="mini-label">{u.lagnname}</span>
                      <span className="mini-value">{u.totalPageViews} views</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pages' && (
          <div className="pages-tab">
            <h2>Most Viewed Pages</h2>
            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th>Page</th>
                    <th>Path</th>
                    <th>Total Visits</th>
                    <th>Unique Users</th>
                    <th>Last Accessed</th>
                  </tr>
                </thead>
                <tbody>
                  {mostViewedPages.map((page, idx) => (
                    <tr key={idx}>
                      <td><strong>{page.label || 'Untitled'}</strong></td>
                      <td className="path-cell">{page.path}</td>
                      <td>{page.totalVisits}</td>
                      <td>{page.uniqueUsers}</td>
                      <td>{formatDate(page.lastAccessed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="users-tab">
            <h2>Most Active Users</h2>
            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Page Views</th>
                    <th>Unique Pages</th>
                    <th>Searches</th>
                    <th>Last Active</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mostActiveUsers.map((u, idx) => (
                    <tr key={idx}>
                      <td><strong>{u.lagnname}</strong></td>
                      <td>{u.clname}</td>
                      <td>{u.totalPageViews}</td>
                      <td>{u.uniquePagesVisited}</td>
                      <td>{u.searchCount}</td>
                      <td>{formatDate(u.lastActive)}</td>
                      <td>
                        <button 
                          className="view-detail-btn"
                          onClick={() => loadUserDetails(u.userId, {
                            lagnname: u.lagnname,
                            clname: u.clname
                          })}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'searches' && (
          <div className="searches-tab">
            <h2>Top Search Queries</h2>
            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th>Query</th>
                    <th>Total Searches</th>
                    <th>Unique Users</th>
                    <th>Last Searched</th>
                  </tr>
                </thead>
                <tbody>
                  {topSearches.map((search, idx) => (
                    <tr key={idx}>
                      <td><strong>"{search.query}"</strong></td>
                      <td>{search.totalSearches}</td>
                      <td>{search.uniqueUsers}</td>
                      <td>{formatDate(search.lastSearched)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'profiles' && (
          <div className="profiles-tab">
            <h2>Agent Profile Views</h2>
            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Role</th>
                    <th>Total Views</th>
                    <th>Unique Viewers</th>
                    <th>Last Viewed</th>
                  </tr>
                </thead>
                <tbody>
                  {agentProfileViews.map((profile, idx) => (
                    <tr key={idx}>
                      <td><strong>{profile.viewed_agent_name}</strong></td>
                      <td>{profile.viewed_agent_clname}</td>
                      <td>{profile.totalViews}</td>
                      <td>{profile.uniqueViewers}</td>
                      <td>{formatDate(profile.lastViewed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'userDetail' && selectedUser && (
          <div className="user-detail-tab">
            <div className="user-detail-header">
              <div className="user-detail-info">
                <h2>User Activity Detail</h2>
                {selectedUserInfo && (
                  <div className="current-user-display">
                    <span className="current-user-label">Viewing:</span>
                    <span className="current-user-name">{selectedUserInfo.displayName || selectedUserInfo.lagnname}</span>
                    {selectedUserInfo.clname && (
                      <span className="current-user-role">({selectedUserInfo.clname})</span>
                    )}
                  </div>
                )}
              </div>
              
              <div className="user-search-container" ref={searchContainerRef}>
                <div className="user-search-input-wrapper">
                  <FiSearch className="user-search-icon" />
                  <input
                    type="text"
                    className="user-search-input"
                    placeholder="Search for any user..."
                    value={userSearchQuery}
                    onChange={handleUserSearchChange}
                  />
                </div>
                {userSearchResults.length > 0 && (
                  <div className="user-search-results">
                    {userSearchResults.map((user, idx) => (
                      <div 
                        key={idx} 
                        className="user-search-result-item"
                        onClick={() => selectUserFromSearch(user)}
                      >
                        <span className="user-search-result-name">
                          {user.displayName || user.lagnname}
                        </span>
                        {user.clname && (
                          <span className="user-search-result-role">{user.clname}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="user-detail-section">
              <h3>Activity Timeline (Last 30 Days)</h3>
              <div className="timeline-chart">
                {userTimeline.length > 0 ? (
                  <div className="timeline-bars">
                    {userTimeline.map((day, idx) => (
                      <div key={idx} className="timeline-bar-item">
                        <div 
                          className="timeline-bar" 
                          style={{ height: `${Math.min((day.totalVisits / Math.max(...userTimeline.map(d => d.totalVisits))) * 100, 100)}%` }}
                          title={`${day.date}: ${day.totalVisits} visits`}
                        />
                        <div className="timeline-label">{formatDateShort(day.date)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No activity data available</p>
                )}
              </div>
            </div>

            <div className="user-detail-section">
              <h3>Pages Visited</h3>
              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Page</th>
                      <th>Path</th>
                      <th>Visit Count</th>
                      <th>Last Visited</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userPages.map((page, idx) => (
                      <tr key={idx}>
                        <td><strong>{page.label || 'Untitled'}</strong></td>
                        <td className="path-cell">{page.path}</td>
                        <td>{page.visitCount}</td>
                        <td>{formatDate(page.lastVisited)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="user-detail-section">
              <h3>Search History</h3>
              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Query</th>
                      <th>Search Count</th>
                      <th>Last Searched</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userSearches.map((search, idx) => (
                      <tr key={idx}>
                        <td><strong>"{search.query}"</strong></td>
                        <td>{search.searchCount}</td>
                        <td>{formatDate(search.lastSearched)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;

