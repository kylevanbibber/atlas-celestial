import React, { useState, useRef, useEffect } from 'react';
import { FiAward, FiStar, FiTarget, FiTrendingUp, FiChevronDown, FiChevronRight, FiLoader, FiUser, FiArrowUp } from 'react-icons/fi';
import { NameFormats, getFirstInitial } from '../../utils/nameFormatter';
import './Leaderboard.css';
import './ProfilePicture.css';

// Profile Picture Component
const ProfilePicture = ({ src, name, size = "60px", mobileSize = "40px", className = "" }) => {
  const [imageError, setImageError] = useState(false);
  const firstInitial = getFirstInitial(name);

  if (!src || imageError) {
    return (
      <div 
        className={`profile-picture-fallback ${className}`}
        style={{ 
          '--desktop-size': size,
          '--mobile-size': mobileSize,
          borderRadius: '50%',
          backgroundColor: '#6b7280',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold'
        }}
      >
        {firstInitial || <FiUser className="profile-icon" />}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} profile`}
      className={`profile-picture ${className}`}
      style={{ 
        '--desktop-size': size,
        '--mobile-size': mobileSize,
        borderRadius: '50%',
        objectFit: 'cover'
      }}
      onError={() => setImageError(true)}
    />
  );
};

// Utility function to calculate ranks with tie handling
const calculateRanksWithTies = (data, valueField) => {
  if (!data || data.length === 0) return data;
  
  // Sort data by value in descending order
  const sortedData = [...data].sort((a, b) => {
    const aValue = a[valueField] || 0;
    const bValue = b[valueField] || 0;
    return bValue - aValue;
  });
  
  let currentRank = 1;
  let previousValue = null;
  let skipCount = 0;
  
  return sortedData.map((item, index) => {
    const currentValue = item[valueField] || 0;
    
    if (previousValue !== null && currentValue !== previousValue) {
      currentRank += skipCount;
      skipCount = 1;
    } else if (previousValue !== null && currentValue === previousValue) {
      skipCount++;
    } else {
      skipCount = 1;
    }
    
    previousValue = currentValue;
    
    return {
      ...item,
      rank: currentRank
    };
  });
};

const Leaderboard = ({
  data = [],
  title = "Leaderboard",
  rankField = "rank",
  nameField = "name",
  valueField = "value",
  secondaryValueField = null,
  showCount = null, // null means show all
  emptyMessage = "No data available",
  className = "",
  variant = "default", // "default", "compact", "detailed"
  showTrophies = true,
  formatValue = (value) => value,
  formatSecondaryValue = (value, item) => value,
  formatMovementIndicator = (item) => null,
  formatAchievementBadge = (item) => null,
  onItemClick = null,
  loading = false,
  // New props for expandable rows
  allowExpansion = false,
  onExpandItem = null, // async function to load sub-items
  expandedData = {}, // { itemId: { loading: false, data: [] } }
  maxHeight = "600px", // Make scrollable
  // Name formatting options
  nameFormat = "FIRST_LAST", // "FIRST_LAST", "FIRST_MIDDLE_LAST", "FIRST_LAST_SUFFIX", "FULL"
  showProfilePicture = true,
  profilePictureField = "profile_picture",
  // New props for hierarchy levels and MGA display
  hierarchyLevel = null, // 'all', 'sa', 'ga', 'mga'
  showMGA = false, // Show MGA field below name
  showLevelBadge = false, // Show level badge
  // New props for customizing achievement colors
  achievementColors = {
    hotStreak: "#ff6b35", // Orange-red for hot streaks
    champion: "#ffd700", // Gold for champions
    risingStar: "#00d4aa", // Teal for rising stars
    bigMover: "#6366f1", // Indigo for big movers
    climbing: "#10b981", // Green for climbing
    consistent: "#8b5cf6", // Purple for consistent
    default: "#6b7280" // Gray for default
  },
  // New props for dynamic value color ranges
  valueColorRanges = null, // { high: { min: number, colors: { bg, text } }, medium: { min: number, colors: { bg, text } }, low: { colors: { bg, text } } }
  periodType = null, // Used to determine which ranges to apply (week, month, year)
  // New props for current user highlighting and scroll functionality
  currentUser = null, // { name: string, lagnname: string } - current logged in user
  showScrollButtons = true // Show scroll to user/top buttons
}) => {

  const [expandedItems, setExpandedItems] = useState(new Set());
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isUserVisible, setIsUserVisible] = useState(false);
  const leaderboardRef = useRef(null);
  const currentUserRef = useRef(null);

  // Get level badge styles based on clname
  const getLevelBadgeStyles = (clname) => {
    const styles = {
      backgroundColor: 'lightgrey',
      border: '2px solid grey'
    };

    switch (clname) {
      case 'SA':
        styles.backgroundColor = 'rgb(178, 82, 113)';
        styles.border = '2px solid rgb(138, 62, 93)';
        break;
      case 'GA':
        styles.backgroundColor = 'rgb(237, 114, 47)';
        styles.border = '2px solid rgb(197, 94, 37)';
        break;
      case 'MGA':
        styles.backgroundColor = 'rgb(104, 182, 117)';
        styles.border = '2px solid rgb(84, 152, 97)';
        break;
      case 'RGA':
        styles.backgroundColor = '#00558c';
        styles.border = '2px solid #004372';
        break;
      case 'AGT':
      default:
        styles.backgroundColor = 'lightgrey';
        styles.border = '2px solid grey';
        break;
    }

    return {
      ...styles,
      padding: "2px 4px",
      borderRadius: "4px",
      fontSize: "10px",
      color: 'white',
      fontWeight: '600',
      letterSpacing: '0.5px',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      display: 'inline-block',
      marginLeft: '8px'
    };
  };

  const handleToggleExpansion = async (item, index) => {
    const itemKey = `${index}-${item[nameField]}`;
    const newExpandedItems = new Set(expandedItems);
    
    if (expandedItems.has(itemKey)) {
      // Collapse the item
      newExpandedItems.delete(itemKey);
      setExpandedItems(newExpandedItems);
    } else {
      // Expand the item
      newExpandedItems.add(itemKey);
      setExpandedItems(newExpandedItems);
      
      // Load sub-items if onExpandItem is provided
      if (onExpandItem && !expandedData[itemKey]) {
        onExpandItem(item, itemKey);
      }
    }
  };

  const getRankIcon = (rank) => {
    if (!showTrophies) return null;
    
    switch (rank) {
      case 1:
        return <span className="rank-number rank-gold">{rank}</span>;
      case 2:
        return <span className="rank-number rank-silver">{rank}</span>;
      case 3:
        return <span className="rank-number rank-bronze">{rank}</span>;
      default:
        return <span className="rank-number">{rank}</span>;
    }
  };

  const getRankClass = (rank) => {
    switch (rank) {
      case 1: return "rank-1";
      case 2: return "rank-2"; 
      case 3: return "rank-3";
      default: return "";
    }
  };

  // Helper function to get achievement color based on achievement text
  const getAchievementColor = (achievementText, colors) => {
    if (!achievementText) return colors.default;
    
    const text = achievementText.toLowerCase();
    
    if (text.includes('🔥') || text.includes('hot streak')) return colors.hotStreak;
    if (text.includes('dethroned')) return colors.dethroned;
    if (text.includes('👑') || text.includes('champion')) return colors.champion;
    if (text.includes('📈') && (text.includes('rising up') || text.includes('rising star'))) return colors.risingStar;
    if (text.includes('🚀') || text.includes('big mover')) return colors.bigMover;
    if (text.includes('📈') && text.includes('climbing')) return colors.climbing;
    if (text.includes('⭐') || text.includes('consistent')) return colors.consistent;
    if (text.includes('🏆') || text.includes('record')) return colors.record;
    
    return colors.default;
  };

  // Helper function to get value colors based on dynamic ranges
  const getValueColors = (value, colorRanges) => {
    if (!colorRanges || value === null || value === undefined) {
      return {
        backgroundColor: '#d1fae5',
        color: '#059669'
      };
    }

    const numValue = Number(value) || 0;

    if (colorRanges.high && numValue >= colorRanges.high.min) {
      return colorRanges.high.colors;
    } else if (colorRanges.medium && numValue >= colorRanges.medium.min) {
      return colorRanges.medium.colors;
    } else {
      return colorRanges.low.colors;
    }
  };

  // Check if an item is the current user
  const isCurrentUser = (item) => {
    if (!currentUser || !item) return false;
    
    // Check by name (case-insensitive)
    if (currentUser.name && item[nameField]) {
      const currentUserName = currentUser.name.toLowerCase().trim();
      const itemName = item[nameField].toLowerCase().trim();
      if (currentUserName === itemName) return true;
    }
    
    // Check by lagnname (case-insensitive)
    if (currentUser.lagnname && item.name) {
      const currentUserLagnname = currentUser.lagnname.toLowerCase().trim();
      const itemName = item.name.toLowerCase().trim();
      if (currentUserLagnname === itemName) return true;
    }
    
    return false;
  };

  // Scroll to current user
  const scrollToCurrentUser = (e) => {
    e.stopPropagation(); // Prevent event from bubbling up to parent
    if (currentUserRef.current) {
      currentUserRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  };

  // Scroll to top
  const scrollToTop = (e) => {
    e.stopPropagation(); // Prevent event from bubbling up to parent
    if (leaderboardRef.current) {
      leaderboardRef.current.scrollTo({ 
        top: 0, 
        behavior: 'smooth' 
      });
    }
  };

  // Process data with proper tie handling if no rank field is provided
  const processedData = data.map(item => item[rankField]).some(rank => rank === undefined) 
    ? calculateRanksWithTies(data, valueField)
    : data;
  
  const displayData = showCount ? processedData.slice(0, showCount) : processedData;

  // Find current user in the data
  const currentUserIndex = displayData.findIndex(isCurrentUser);
  const hasCurrentUser = currentUserIndex !== -1;

  // Handle scroll events
  const handleScroll = () => {
    if (leaderboardRef.current) {
      const scrollTop = leaderboardRef.current.scrollTop;
      setScrollPosition(scrollTop);
      
      // Check if user is visible
      if (currentUserRef.current && hasCurrentUser) {
        const userElement = currentUserRef.current;
        const container = leaderboardRef.current;
        const userTop = userElement.offsetTop;
        const userBottom = userTop + userElement.offsetHeight;
        const containerTop = container.scrollTop;
        const containerBottom = containerTop + container.clientHeight;
        
        const isVisible = userTop >= containerTop && userBottom <= containerBottom;
        setIsUserVisible(isVisible);
      }
    }
  };

  // Add scroll event listener
  useEffect(() => {
    const leaderboardElement = leaderboardRef.current;
    if (leaderboardElement) {
      leaderboardElement.addEventListener('scroll', handleScroll);
      return () => leaderboardElement.removeEventListener('scroll', handleScroll);
    }
  }, [hasCurrentUser]);

  if (loading) {
    return (
      <div className={`leaderboard ${className}`}>
        <div className="leaderboard-header">
          <h3 className="leaderboard-title">{title}</h3>
        </div>
        <div className="leaderboard-loading">
          <div className="loading-placeholder">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="loading-item">
                <div className="loading-rank"></div>
                <div className="loading-content">
                  <div className="loading-name"></div>
                  <div className="loading-value"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`leaderboard ${variant} ${className}`}>
      <div className="leaderboard-header">
        <h3 className="leaderboard-title">
          <FiTrendingUp className="title-icon" />
          {title}
        </h3>
        <div className="leaderboard-header-controls">
          {showCount && data.length > showCount && (
            <span className="showing-count">
              Showing top {showCount} of {data.length}
            </span>
          )}
          {showScrollButtons && (
            <div className="scroll-controls">
              {hasCurrentUser && !isUserVisible && (
                <button 
                  className="scroll-button scroll-to-user"
                  onClick={scrollToCurrentUser}
                  title="Scroll to your position"
                >
                  <FiUser className="scroll-icon" />
                </button>
              )}
              {scrollPosition > 10 && (
                <button 
                  className="scroll-button scroll-to-top"
                  onClick={scrollToTop}
                  title="Scroll to top"
                >
                  <FiArrowUp className="scroll-icon" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="leaderboard-content">
        {displayData.length === 0 ? (
          <div className="leaderboard-empty">
            <FiAward className="empty-icon" />
            <p>{emptyMessage}</p>
          </div>
        ) : (
          <div 
            ref={leaderboardRef}
            className="leaderboard-list" 
            style={{ 
              maxHeight: maxHeight, 
              overflowY: maxHeight === "none" ? 'visible' : 'auto' 
            }}
          >
            {displayData.map((item, index) => {
              const rank = item[rankField] || (index + 1);
              const rawName = item[nameField] || "Unknown";
              const displayName = NameFormats[nameFormat] ? NameFormats[nameFormat](rawName) : rawName;
              const profilePicture = item[profilePictureField];
              const value = item[valueField];
              const secondaryValue = secondaryValueField ? item[secondaryValueField] : null;
              const itemKey = `${index}-${rawName}`;
              const isExpanded = expandedItems.has(itemKey);
              const hasSubData = expandedData[itemKey];
              const isExpandable = allowExpansion && (item.level !== 'AGENT');
              const isUser = isCurrentUser(item);
              
              return (
                <div key={index} className="leaderboard-item-container">
                  <div
                    ref={isUser ? currentUserRef : null}
                    className={`leaderboard-item ${getRankClass(rank)} ${
                      (onItemClick || isExpandable) ? 'clickable' : ''
                    } ${isUser ? 'current-user' : ''}`}
                    onClick={() => {
                      if (isExpandable) {
                        handleToggleExpansion(item, index);
                      } else if (onItemClick) {
                        onItemClick(item);
                      }
                    }}
                  >
                    <div className="item-rank">
                      <div className="rank-content">
                        {getRankIcon(rank)}
                        {formatMovementIndicator(item) && (
                          <span 
                            className="rank-movement-indicator"
                            data-direction={
                              formatMovementIndicator(item)?.startsWith('▲') ? 'up' :
                              formatMovementIndicator(item)?.startsWith('▼') ? 'down' :
                              formatMovementIndicator(item)?.startsWith('🆕') ? 'new' : 
                              'same'
                            }
                          >
                            {formatMovementIndicator(item)}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="item-content">
                      <div className="item-main">
                        <div className="item-name-container">
                          {showProfilePicture && (
                            <ProfilePicture 
                              src={profilePicture} 
                              name={rawName}
                              size="60px"
                              mobileSize="40px"
                              className="item-profile-picture"
                            />
                          )}
                          <div className="name-info">
                            <div className="name-line">
                              <span className="item-name">{displayName}</span>
                            </div>
                            {showMGA && item.mgaLastName && ['all', 'sa', 'ga'].includes(hierarchyLevel) && (
                              <div className="mga-line">
                                {showLevelBadge && item.clname && (
                                  <span 
                                    className="user-role-badge"
                                    style={getLevelBadgeStyles(item.clname)}
                                  >
                                    {item.clname}
                                  </span>
                                )}
                                <span className="mga-info">{item.mgaLastName}</span>
                              </div>
                            )}
                            {!showMGA && showLevelBadge && item.clname && (
                              <div className="badge-only-line">
                                <span 
                                  className="user-role-badge"
                                  style={getLevelBadgeStyles(item.clname)}
                                >
                                  {item.clname}
                                </span>
                              </div>
                            )}
                          </div>
                          {isExpandable && (
                            <div className="expand-icon">
                              {hasSubData?.loading ? (
                                <FiLoader className="expand-spinner" />
                              ) : isExpanded ? (
                                <FiChevronDown />
                              ) : (
                                <FiChevronRight />
                              )}
                            </div>
                          )}
                        </div>
                        <span 
                          className="item-value"
                          style={getValueColors(value, valueColorRanges)}
                        >
                          {formatValue(value)}
                        </span>
                      </div>
                      
                      {variant === "detailed" && (
                        <div className="item-indicators">
                          {secondaryValue !== null && (
                            <div className="item-secondary">
                              <span className="secondary-value">
                                {formatSecondaryValue(secondaryValue, item)}
                              </span>
                            </div>
                          )}
                          
                          {formatAchievementBadge(item) && value > 0 && (
                            <div className="item-achievement">
                              <span 
                                className="achievement-badge"
                                style={{
                                  '--custom-achievement-color': getAchievementColor(formatAchievementBadge(item), achievementColors)
                                }}
                              >
                                {formatAchievementBadge(item)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {rank <= 3 && (
                      <div className="podium-indicator">
                        <div className={`podium-bar rank-${rank}`}></div>
                      </div>
                    )}
                  </div>

                  {/* Expanded sub-items */}
                  {isExpanded && hasSubData && hasSubData.data && (
                    <div className="expanded-content">
                      {hasSubData.data.map((subItem, subIndex) => {
                        const subRawName = subItem[nameField] || "Unknown";
                        const subDisplayName = NameFormats[nameFormat] ? NameFormats[nameFormat](subRawName) : subRawName;
                        const subProfilePicture = subItem[profilePictureField];
                        
                        return (
                          <div
                            key={subIndex}
                            className="leaderboard-sub-item"
                            onClick={() => onItemClick && onItemClick(subItem)}
                          >
                            <div className="sub-item-rank">
                              <span className="sub-rank-number">{subItem.team_rank || subIndex + 1}</span>
                            </div>
                            
                            <div className="sub-item-content">
                              <div className="sub-item-main">
                                {showProfilePicture && (
                                  <ProfilePicture 
                                    src={subProfilePicture} 
                                    name={subRawName}
                                    size="48px"
                                    mobileSize="32px"
                                    className="sub-item-profile-picture"
                                  />
                                )}
                                <div className="sub-name-info">
                                  <div className="sub-name-line">
                                    <span className="sub-item-name">{subDisplayName}</span>
                                  </div>
                                  {showMGA && subItem.mgaLastName && ['all', 'sa', 'ga'].includes(hierarchyLevel) && (
                                    <div className="sub-mga-line">
                                      {showLevelBadge && subItem.clname && (
                                        <span 
                                          className="user-role-badge"
                                          style={getLevelBadgeStyles(subItem.clname)}
                                        >
                                          {subItem.clname}
                                        </span>
                                      )}
                                      <span className="sub-mga-info">{subItem.mgaLastName}</span>
                                    </div>
                                  )}
                                  {!showMGA && showLevelBadge && subItem.clname && (
                                    <div className="sub-badge-only-line">
                                      <span 
                                        className="user-role-badge"
                                        style={getLevelBadgeStyles(subItem.clname)}
                                      >
                                        {subItem.clname}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <span 
                                  className="sub-item-value"
                                  style={getValueColors(subItem[valueField], valueColorRanges)}
                                >
                                  {formatValue(subItem[valueField])}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      {hasSubData.data.length === 0 && (
                        <div className="expanded-empty">
                          <span>No agents found in this team</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {variant === "detailed" && displayData.length > 0 && (
        <div className="leaderboard-footer">
          <div className="leaderboard-stats">
            <div className="stat">
              <span className="stat-label">Total Participants:</span>
              <span className="stat-value">{data.length}</span>
            </div>
            {data.length > 0 && (
              <div className="stat">
                <span className="stat-label">Average:</span>
                <span className="stat-value">
                  {formatValue(
                    Math.round(
                      data.reduce((sum, item) => sum + (item[valueField] || 0), 0) / data.length
                    )
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaderboard; 