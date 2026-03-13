import React, { useState, useEffect } from "react";
import { FiUser, FiMail, FiPhone, FiCalendar, FiUsers, FiAward, FiMapPin } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import api from "../../api";
import { TrophyCase } from "../widgets";
import "./AgentProfile.css";

// Helper function to parse lagnname (Last, First Middle Suffix) and return formatted name (First Middle Last Suffix)
const parseAndFormatName = (lagnname) => {
  if (!lagnname) return '';
  
  // Split on comma to separate last name from rest
  const parts = lagnname.split(',').map(p => p.trim());
  
  if (parts.length === 0) return lagnname;
  
  const lastName = parts[0] || '';
  const restOfName = parts[1] || '';
  
  // Split the rest into first, middle, suffix
  const restParts = restOfName.split(/\s+/).filter(p => p.length > 0);
  
  const firstName = restParts[0] || '';
  const middleAndSuffix = restParts.slice(1);
  
  // Common suffixes
  const suffixes = ['Jr', 'Jr.', 'Sr', 'Sr.', 'II', 'III', 'IV', 'V', 'VI'];
  const suffix = middleAndSuffix.find(part => suffixes.includes(part)) || '';
  const middle = middleAndSuffix.filter(part => !suffixes.includes(part)).join(' ');
  
  // Format as: First Middle Last Suffix
  return [firstName, middle, lastName, suffix]
    .filter(p => p.length > 0)
    .join(' ');
};

const AgentProfile = ({ data, onClose }) => {
  const [agentData, setAgentData] = useState(data || {});
  const [activeTab, setActiveTab] = useState("Overview");
  const [trophyView, setTrophyView] = useState('personal'); // 'personal' or 'team' for Trophy Case tab
  const { user } = useAuth();

  // Update agentData when data prop changes
  useEffect(() => {
    if (data) {
      setAgentData(data);
    }
  }, [data]);

  // Fetch full profile data when key fields are missing (e.g. email, phone)
  // Many callers pass partial data from leaderboards/feeds that lack contact info
  useEffect(() => {
    const fetchFullProfile = async () => {
      if (!agentData || !agentData.lagnname) return;
      // Skip if we already have email or phone — data is complete
      if (agentData.email || agentData.phone) return;

      try {
        const response = await api.get(`/users/profile/${encodeURIComponent(agentData.lagnname)}`);
        if (response.data && response.data.success) {
          setAgentData(prev => ({ ...prev, ...response.data.data }));
        }
      } catch (error) {
        // Silently fail — we still show whatever data we have
        console.debug('Failed to fetch full agent profile:', error);
      }
    };

    fetchFullProfile();
  }, [agentData.lagnname]);

  // Log profile view for analytics
  useEffect(() => {
    const logProfileView = async () => {
      if (!user || !agentData || !agentData.id) return;
      
      // Don't log if viewing yourself
      if (agentData.id === user.userId || agentData.lagnname === user.lagnname) {
        return;
      }
      
      try {
        await api.post('/users/log-profile-view', {
          viewerId: user.userId,
          viewerName: user.lagnname,
          viewedAgentId: agentData.id,
          viewedAgentName: agentData.lagnname,
          viewedAgentClname: agentData.clname,
          searchQuery: agentData.searchQuery || '',
          searchSource: 'global_search'
        });
      } catch (error) {
        // Silently fail - logging is not critical
        console.debug('Failed to log profile view:', error);
      }
    };
    
    logProfileView();
  }, [user, agentData]);

  // Check if the viewed agent is in the logged-in user's hierarchy
  const isInHierarchy = () => {
    if (!user || !agentData) return false;
    
    // Admin and app users can see all info
    if (user.Role === 'Admin' || user.teamRole === 'app') return true;
    
    // If viewing yourself
    if (agentData.id === user.userId || agentData.lagnname === user.lagnname) {
      return true;
    }
    
    const viewedAgentName = agentData.lagnname;
    const currentUserName = user.lagnname;
    
    // Build upline arrays considering MGAs table data for MGAs/RGAs
    let userUpline = [user.sa, user.ga, user.mga, user.rga].filter(Boolean);
    let viewedAgentUpline = [agentData.sa, agentData.ga, agentData.mga, agentData.rga].filter(Boolean);
    
    // For MGAs and RGAs, also include MGAs table upline data
    if (agentData.clname === 'MGA' || agentData.clname === 'RGA') {
      if (agentData.mga_rga) viewedAgentUpline.push(agentData.mga_rga);
      if (agentData.mga_legacy) viewedAgentUpline.push(agentData.mga_legacy);
      if (agentData.mga_tree) viewedAgentUpline.push(agentData.mga_tree);
    }
    
    // If current user is MGA or RGA, include their MGAs table upline
    if (user.clname === 'MGA' || user.clname === 'RGA') {
      if (user.mga_rga) userUpline.push(user.mga_rga);
      if (user.mga_legacy) userUpline.push(user.mga_legacy);
      if (user.mga_tree) userUpline.push(user.mga_tree);
    }
    
    // Remove duplicates
    userUpline = [...new Set(userUpline)];
    viewedAgentUpline = [...new Set(viewedAgentUpline)];
    
    // If the viewed agent is in the user's upline, they're in hierarchy
    if (userUpline.includes(viewedAgentName)) {
      return true;
    }
    
    // If the viewed agent's upline includes the current user, they're in hierarchy (downline)
    if (viewedAgentUpline.includes(currentUserName)) {
      return true;
    }
    
    // If they share any upline, they're in the same hierarchy
    const sharedUpline = userUpline.some(upline => viewedAgentUpline.includes(upline));
    if (sharedUpline) {
      return true;
    }
    
    return false;
  };

  const canViewContactInfo = isInHierarchy();

  const getRoleDisplay = (clname) => {
    const roleMap = {
      'RGA': 'Regional General Agent',
      'MGA': 'Managing General Agent',
      'GA': 'General Agent',
      'SA': 'Senior Agent',
      'AGT': 'Agent'
    };
    return roleMap[clname] || clname;
  };

  const getStatusBadge = (managerActive) => {
    const isActive = managerActive === 'y';
    return (
      <span className={`agent-status-badge ${isActive ? 'active' : 'inactive'}`}>
        {isActive ? 'Active' : 'Inactive'}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const calculateTenure = (startDate) => {
    if (!startDate) return null;
    
    const start = new Date(startDate);
    const now = new Date();
    
    let years = now.getFullYear() - start.getFullYear();
    let months = now.getMonth() - start.getMonth();
    
    if (months < 0) {
      years--;
      months += 12;
    }
    
    if (years === 0 && months === 0) {
      return 'Less than 1 month';
    } else if (years === 0) {
      return `${months} month${months !== 1 ? 's' : ''}`;
    } else if (months === 0) {
      return `${years} year${years !== 1 ? 's' : ''}`;
    } else {
      return `${years} year${years !== 1 ? 's' : ''}, ${months} month${months !== 1 ? 's' : ''}`;
    }
  };

  // Get the display name - use displayName from backend if available, otherwise format the lagnname
  const getDisplayName = () => {
    if (agentData.displayName) return agentData.displayName;
    if (agentData.lagnname) return parseAndFormatName(agentData.lagnname);
    return agentData.rept_name || 'Unknown Agent';
  };

  const displayName = getDisplayName();

  return (
    <div className="agent-profile-container">
      <div className="agent-profile-topbar">
        <span className="page-chip">Agent Profile</span>
        <button className="close-button" onClick={onClose}>
          ×
        </button>
      </div>

      {/* Header Section with Banner */}
      {agentData.header_pic && (
        <div 
          className="agent-profile-header-banner"
          style={{ backgroundImage: `url(${agentData.header_pic})` }}
        />
      )}
      
      {/* Header Section */}
      <div className={`agent-profile-header ${agentData.header_pic ? 'with-banner' : ''}`}>
        <div className="agent-profile-avatar">
          {agentData.profpic ? (
            <img src={agentData.profpic} alt={displayName} className="agent-profile-pic" />
          ) : (
            <div className="agent-avatar-placeholder">
              <FiUser size={48} />
            </div>
          )}
        </div>
        <div className="agent-profile-header-info">
          <h2 className="agent-profile-name">{displayName}</h2>
          <div className="agent-role-status">
            <span className="agent-role">{getRoleDisplay(agentData.clname)}</span>
            {getStatusBadge(agentData.managerActive)}
          </div>
          {canViewContactInfo && agentData.agtnum && (
            <div className="agent-number">Agent #: {agentData.agtnum}</div>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="agent-profile-tabs">
        <button
          className={`agent-tab ${activeTab === "Overview" ? "active" : ""}`}
          onClick={() => setActiveTab("Overview")}
        >
          Overview
        </button>
        <button
          className={`agent-tab ${activeTab === "Hierarchy" ? "active" : ""}`}
          onClick={() => setActiveTab("Hierarchy")}
        >
          Hierarchy
        </button>
        <button
          className={`agent-tab ${activeTab === "Licenses" ? "active" : ""}`}
          onClick={() => setActiveTab("Licenses")}
        >
          Licenses
        </button>
        <button
          className={`agent-tab ${activeTab === "Trophy Case" ? "active" : ""}`}
          onClick={() => setActiveTab("Trophy Case")}
        >
          Trophy Case
        </button>
      </div>

      {/* Content Section */}
      <div className="agent-profile-content">
            {activeTab === "Overview" && (
              <div className="agent-overview">
                {canViewContactInfo && (agentData.email || agentData.phone) && (
                  <div className="agent-info-section">
                    <h3 className="section-title">Contact Information</h3>
                    <div className="agent-info-grid">
                      {agentData.email && (
                        <div className="agent-info-item">
                          <FiMail className="info-icon" />
                          <div className="info-content">
                            <span className="info-label">Email</span>
                            <a href={`mailto:${agentData.email}`} className="info-value link">
                              {agentData.email}
                            </a>
                          </div>
                        </div>
                      )}
                      {agentData.phone && (
                        <div className="agent-info-item">
                          <FiPhone className="info-icon" />
                          <div className="info-content">
                            <span className="info-label">Phone</span>
                            <a href={`tel:${agentData.phone}`} className="info-value link">
                              {agentData.phone}
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="agent-info-section">
                  <h3 className="section-title">Career Information</h3>
                  <div className="agent-info-grid">
                    {agentData.esid && (
                      <div className="agent-info-item">
                        <FiCalendar className="info-icon" />
                        <div className="info-content">
                          <span className="info-label">Start Date</span>
                          <span className="info-value">
                            {formatDate(agentData.esid)}
                            {calculateTenure(agentData.esid) && (
                              <span className="tenure-badge">{calculateTenure(agentData.esid)}</span>
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                    {agentData.clname && (
                      <div className="agent-info-item">
                        <FiAward className="info-icon" />
                        <div className="info-content">
                          <span className="info-label">Position</span>
                          <span className="info-value">{getRoleDisplay(agentData.clname)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {agentData.bio && (
                  <div className="agent-info-section">
                    <h3 className="section-title">About</h3>
                    <div className="agent-bio">
                      {agentData.bio}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "Hierarchy" && (
              <div className="agent-hierarchy">
                <div className="agent-info-section">
                  <h3 className="section-title">Upline Structure</h3>
                  <div className="hierarchy-tree">
                    {/* Show MGAs table RGA if available (for MGAs and RGAs) */}
                    {(agentData.clname === 'MGA' || agentData.clname === 'RGA') && agentData.mga_rga && (
                      <div className="hierarchy-item">
                        <FiUsers className="hierarchy-icon" />
                        <div className="hierarchy-content">
                          <span className="hierarchy-label">RGA</span>
                          <span className="hierarchy-value">{agentData.mga_rga}</span>
                        </div>
                      </div>
                    )}
                    {/* Show legacy upline if available (for MGAs and RGAs) */}
                    {(agentData.clname === 'MGA' || agentData.clname === 'RGA') && agentData.mga_legacy && (
                      <div className="hierarchy-item">
                        <FiUsers className="hierarchy-icon" />
                        <div className="hierarchy-content">
                          <span className="hierarchy-label">Legacy</span>
                          <span className="hierarchy-value">{agentData.mga_legacy}</span>
                        </div>
                      </div>
                    )}
                    {/* Show tree upline if available (for MGAs and RGAs) */}
                    {(agentData.clname === 'MGA' || agentData.clname === 'RGA') && agentData.mga_tree && (
                      <div className="hierarchy-item">
                        <FiUsers className="hierarchy-icon" />
                        <div className="hierarchy-content">
                          <span className="hierarchy-label">Tree</span>
                          <span className="hierarchy-value">{agentData.mga_tree}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Standard activeusers hierarchy fields */}
                    {agentData.rga && !(agentData.clname === 'MGA' || agentData.clname === 'RGA') && (
                      <div className="hierarchy-item">
                        <FiUsers className="hierarchy-icon" />
                        <div className="hierarchy-content">
                          <span className="hierarchy-label">RGA</span>
                          <span className="hierarchy-value">{agentData.rga}</span>
                        </div>
                      </div>
                    )}
                    {agentData.mga && (
                      <div className="hierarchy-item">
                        <FiUsers className="hierarchy-icon" />
                        <div className="hierarchy-content">
                          <span className="hierarchy-label">MGA</span>
                          <span className="hierarchy-value">{agentData.mga}</span>
                        </div>
                      </div>
                    )}
                    {agentData.ga && (
                      <div className="hierarchy-item">
                        <FiUsers className="hierarchy-icon" />
                        <div className="hierarchy-content">
                          <span className="hierarchy-label">GA</span>
                          <span className="hierarchy-value">{agentData.ga}</span>
                        </div>
                      </div>
                    )}
                    {agentData.sa && (
                      <div className="hierarchy-item">
                        <FiUsers className="hierarchy-icon" />
                        <div className="hierarchy-content">
                          <span className="hierarchy-label">SA</span>
                          <span className="hierarchy-value">{agentData.sa}</span>
                        </div>
                      </div>
                    )}
                    {!agentData.rga && !agentData.mga && !agentData.ga && !agentData.sa && 
                     !agentData.mga_rga && !agentData.mga_legacy && !agentData.mga_tree && (
                      <div className="agent-info-empty">
                        No hierarchy information available
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "Licenses" && (
              <div className="agent-licenses">
                <div className="agent-info-section">
                  <h3 className="section-title">Licensed States</h3>
                  {agentData.licenses && agentData.licenses.length > 0 ? (
                    <div className="licenses-grid">
                      {agentData.licenses.map((license, index) => (
                        <div key={index} className="license-item">
                          <FiMapPin className="license-icon" />
                          <div className="license-content">
                            <span className="license-state">{license.state}</span>
                            {license.resident_state && (
                              <span className="license-badge">Resident</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="agent-info-empty">
                      No license information available
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "Trophy Case" && (
              <div className="agent-trophy-case">
                <div className="trophy-view-toggle">
                  <button 
                    className={`view-toggle-btn ${trophyView === 'personal' ? 'active' : ''}`}
                    onClick={() => setTrophyView('personal')}
                  >
                    Personal
                  </button>
                  <button 
                    className={`view-toggle-btn ${trophyView === 'team' ? 'active' : ''}`}
                    onClick={() => setTrophyView('team')}
                  >
                    Team
                  </button>
                </div>
                <TrophyCase 
                  trophyView={trophyView} 
                  targetLagnname={agentData.lagnname}
                />
              </div>
            )}
      </div>
    </div>
  );
};

export default AgentProfile;

