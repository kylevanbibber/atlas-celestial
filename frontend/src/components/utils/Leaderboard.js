import React, { useState, useRef, useEffect } from 'react';
import { FiAward, FiStar, FiTarget, FiTrendingUp, FiChevronDown, FiChevronRight, FiLoader, FiUser, FiArrowUp, FiCamera, FiDownload, FiMaximize2, FiMinimize2 } from 'react-icons/fi';
import html2canvas from 'html2canvas';
import { NameFormats, getFirstInitial } from '../../utils/nameFormatter';
import './Leaderboard.css';
import './ProfilePicture.css';

// Profile Picture Component
const ProfilePicture = ({ src, name, size = "60px", mobileSize = "40px", className = "", onClick = null }) => {
  const [imageError, setImageError] = useState(false);
  const firstInitial = getFirstInitial(name);

  const handleClick = (e) => {
    if (onClick) {
      e.stopPropagation(); // Prevent row click event
      onClick();
    }
  };

  const commonProps = {
    onClick: handleClick,
    className: `${className} ${onClick ? 'clickable-profile' : ''}`,
    style: { 
      '--desktop-size': size,
      '--mobile-size': mobileSize,
      width: size,
      height: size,
      minWidth: size,
      minHeight: size,
      maxWidth: size,
      maxHeight: size,
      borderRadius: '50%',
      cursor: onClick ? 'pointer' : 'default'
    }
  };

  if (!src || imageError) {
    return (
      <div 
        {...commonProps}
        className={`profile-picture-fallback ${commonProps.className}`}
        style={{
          ...commonProps.style,
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
      {...commonProps}
      src={src}
      alt={`${name} profile`}
      style={{
        ...commonProps.style,
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
  mobileNameFormat = "FIRST_LAST_INITIAL", // Name format for mobile screens (e.g., "John S." instead of "John Smith")
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
  showScrollButtons = true, // Show scroll to user/top buttons
  // Allowed names (lagnname) set/array to include in leaderboard
  allowedNames = null,
  // Allowed user IDs set/array to include (for sources with user linkage)
  allowedIds = null,
  // Field name containing the raw lagnname format; defaults to nameField
  rawNameField = null,
  // PNG Export functionality
  enablePngExport = true, // Show PNG export button
  exportFileName = null, // Custom filename for export, defaults to title
  // Profile click functionality
  onProfileClick = null, // Callback when profile picture is clicked: (item) => void
  // Row click functionality
  onRowClick = null // Callback when row is clicked: (item) => void
}) => {

  const [expandedItems, setExpandedItems] = useState(new Set());
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isUserVisible, setIsUserVisible] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [isHeightExpanded, setIsHeightExpanded] = useState(false);
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

  // Toggle height expansion
  const toggleHeightExpansion = (e) => {
    e.stopPropagation(); // Prevent event from bubbling up to parent
    setIsHeightExpanded(!isHeightExpanded);
  };

  // PNG Export functionality
  const handlePngExport = async (e, positionLimit = null) => {
    e.stopPropagation();
    
    if (isExportingImage || !leaderboardRef.current) return;
    
    // Close export options menu
    setShowExportOptions(false);
    
    setIsExportingImage(true);
    
    try {
      // Generate filename with position info
      const timestamp = new Date().toISOString().slice(0, 10);
      const positionSuffix = positionLimit ? `-top-${positionLimit}` : '';
      const filename = exportFileName || `${title.replace(/[^a-zA-Z0-9]/g, '-')}${positionSuffix}-${timestamp}`;
      
      // Create a clone of the entire leaderboard container for export
      const originalElement = leaderboardRef.current;
      const leaderboardContainer = originalElement.closest('.leaderboard');
      const clonedElement = leaderboardContainer ? leaderboardContainer.cloneNode(true) : originalElement.cloneNode(true);
      
      // Use the full container width to prevent clipping
      const containerWidth = leaderboardContainer ? leaderboardContainer.offsetWidth : originalElement.offsetWidth;
      const exportWidth = Math.max(containerWidth, 700);
      
      // CRITICAL: Kill ALL transitions/animations on every element in the clone FIRST
      // so that style changes below apply instantly instead of animating
      const allClonedElements = clonedElement.querySelectorAll('*');
      allClonedElements.forEach(el => {
        el.style.transition = 'none';
        el.style.animation = 'none';
      });
      clonedElement.style.transition = 'none';
      clonedElement.style.animation = 'none';
      
      // Apply export-specific styles to the outer .leaderboard container
      clonedElement.style.position = 'absolute';
      clonedElement.style.left = '-9999px';
      clonedElement.style.top = '0px';
      clonedElement.style.zIndex = '-1000';
      clonedElement.style.width = exportWidth + 'px';
      clonedElement.style.height = 'auto';
      clonedElement.style.maxHeight = 'none';
      clonedElement.style.overflow = 'visible';
      clonedElement.style.background = '#ffffff';
      clonedElement.style.borderRadius = '12px';
      clonedElement.style.border = '1px solid #e5e7eb';
      
      // Fix all leaderboard items - remove overflow:hidden, transforms, and ensure proper layout
      const allClonedItems = clonedElement.querySelectorAll('.leaderboard-item');
      allClonedItems.forEach(item => {
        item.style.overflow = 'visible';
        item.style.transform = 'none';
        item.style.transition = 'none';
        // For table rows (tr), keep table-row display; for divs, use flex
        if (item.tagName === 'TR') {
          item.style.display = 'table-row';
        } else {
          item.style.display = 'flex';
          item.style.alignItems = 'center';
          item.style.padding = '8px 20px';
        }
        item.style.position = 'relative';
        item.style.background = '#ffffff';
        item.style.borderBottom = '1px solid #f0f0f0';
      });
      
      // Shrink profile pictures & fix centering for export
      const allProfilePics = clonedElement.querySelectorAll('.profile-picture-fallback, .item-profile-picture, img[class*="profile"]');
      allProfilePics.forEach(pic => {
        pic.style.width = '40px';
        pic.style.height = '40px';
        pic.style.minWidth = '40px';
        pic.style.minHeight = '40px';
        pic.style.maxWidth = '40px';
        pic.style.maxHeight = '40px';
        pic.style.borderRadius = '50%';
        // For fallback divs with initials, switch to line-height centering
        if (pic.classList.contains('profile-picture-fallback')) {
          pic.style.display = 'block';
          pic.style.textAlign = 'center';
          pic.style.lineHeight = '36px'; // 40px - 2*2px border
          pic.style.fontSize = '16px';
          pic.style.fontWeight = 'bold';
        }
      });
      
      // Fix rank number centering - switch from flex to line-height
      const allRankNumbers = clonedElement.querySelectorAll('.rank-number');
      allRankNumbers.forEach(rn => {
        rn.style.display = 'block';
        rn.style.textAlign = 'center';
        rn.style.padding = '0';
        rn.style.margin = '0';
        // Check if it has a border (gold/silver/bronze) - adjust line-height
        if (rn.classList.contains('rank-gold') || rn.classList.contains('rank-silver') || rn.classList.contains('rank-bronze')) {
          rn.style.lineHeight = '24px'; // 28px - 2*2px border
        } else {
          rn.style.lineHeight = '28px';
        }
        rn.style.width = '28px';
        rn.style.height = '28px';
        rn.style.fontSize = '0.8rem';
        rn.style.borderRadius = '50%';
      });
      
      // Fix rank movement indicators centering
      const allMovementIndicators = clonedElement.querySelectorAll('.rank-movement-indicator');
      allMovementIndicators.forEach(mi => {
        mi.style.display = 'block';
        mi.style.textAlign = 'center';
        mi.style.lineHeight = '1.3';
        mi.style.fontSize = '0.6rem';
        mi.style.padding = '1px 3px';
        mi.style.marginTop = '1px';
      });
      
      // Fix achievement badges centering
      const allAchievementBadges = clonedElement.querySelectorAll('.achievement-badge');
      allAchievementBadges.forEach(ab => {
        ab.style.display = 'inline-block';
        ab.style.lineHeight = '1.4';
        ab.style.verticalAlign = 'middle';
        ab.style.padding = '2px 6px';
        ab.style.fontSize = '0.65rem';
        ab.style.whiteSpace = 'nowrap';
      });
      
      // Add spacing between MGA badges and names
      const allMgaLines = clonedElement.querySelectorAll('.mga-line, .badge-only-line');
      allMgaLines.forEach(ml => {
        ml.style.marginTop = '3px';
        ml.style.gap = '6px';
      });
      
      // Fix overflow on leaderboard-content container
      const clonedContentContainer = clonedElement.querySelector('.leaderboard-content');
      if (clonedContentContainer) {
        clonedContentContainer.style.overflow = 'visible';
        clonedContentContainer.style.padding = '2px 0';
        clonedContentContainer.style.background = '#ffffff';
      }
      
      // Ensure the header is properly styled with VISIBLE text
      const clonedHeader = clonedElement.querySelector('.leaderboard-header');
      if (clonedHeader) {
        clonedHeader.style.display = 'flex';
        clonedHeader.style.justifyContent = 'space-between';
        clonedHeader.style.alignItems = 'center';
        clonedHeader.style.padding = '16px 20px 12px';
        clonedHeader.style.borderBottom = '2px solid #e5e7eb';
        clonedHeader.style.background = '#f8f9fa';
      }
      
      // Force title to be dark and visible
      const clonedTitle = clonedElement.querySelector('.leaderboard-title');
      if (clonedTitle) {
        clonedTitle.style.color = '#1f2937';
        clonedTitle.style.fontSize = '1.15rem';
        clonedTitle.style.fontWeight = '700';
      }
      // Also fix the title icon color
      const titleIcon = clonedElement.querySelector('.title-icon');
      if (titleIcon) {
        titleIcon.style.color = '#3b82f6';
      }
      
      // Find and modify the leaderboard list in the clone
      const clonedList = clonedElement.querySelector('.leaderboard-list') || 
                        (clonedElement.classList.contains('leaderboard-list') ? clonedElement : null);
      
      if (clonedList) {
        clonedList.style.maxHeight = 'none';
        clonedList.style.height = 'auto';
        clonedList.style.overflow = 'visible';
        clonedList.style.overflowY = 'visible';
        clonedList.style.display = 'flex';
        clonedList.style.flexDirection = 'column';
        
        // If positionLimit is specified, remove items beyond that limit
        if (positionLimit && positionLimit > 0) {
          const leaderboardItems = clonedList.querySelectorAll('.leaderboard-item-container');
          const itemsArray = Array.from(leaderboardItems);
          itemsArray.forEach((item, index) => {
            if (index >= positionLimit) {
              item.remove();
            }
          });
        }
      }
      
      // Remove UI controls from clone (not needed in export)
      clonedElement.querySelectorAll('.scroll-button, .scroll-controls, .png-export-button, .export-options-menu, .export-options-container').forEach(el => el.remove());
      
      // Also remove the "Showing top X of Y" text from export
      const showingCount = clonedElement.querySelector('.showing-count');
      if (showingCount) showingCount.remove();
      
      // Add the clone to the DOM temporarily
      document.body.appendChild(clonedElement);
      
      // Wait for layout to settle (transitions are killed so 100ms is enough)
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Get the actual content dimensions of the clone using scrollHeight for full content
      const contentWidth = clonedElement.offsetWidth;
      const contentHeight = Math.max(clonedElement.offsetHeight, clonedElement.scrollHeight);
      
      // Configure html2canvas options for the clone
      const options = {
        backgroundColor: '#ffffff',
        scale: 2, // Higher resolution
        useCORS: true,
        allowTaint: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: Math.max(contentWidth + 20, 800),
        windowHeight: contentHeight + 20,
        width: contentWidth,
        height: contentHeight,
        onclone: (clonedDoc) => {
          // html2canvas clones the ENTIRE document and parses ALL elements' CSS.
          // Modern browsers resolve CSS variables to color(srgb ...) syntax which
          // html2canvas can't parse. We inject a global sanitization stylesheet to
          // replace all unsupported color functions with safe fallbacks.
          const sanitizeStyle = clonedDoc.createElement('style');
          sanitizeStyle.textContent = `
            /* Global: strip all properties that could contain unsupported 
               color() / color-mix() functions that crash html2canvas */
            * {
              box-shadow: none !important;
              text-shadow: none !important;
              filter: none !important;
              border-image: none !important;
              transition: none !important;
              animation: none !important;
            }
            
            /* === LEADERBOARD EXPORT THEME === */
            .leaderboard {
              background: #ffffff !important;
              overflow: visible !important;
              border: 1px solid #e5e7eb !important;
              border-radius: 12px !important;
            }
            .leaderboard-header {
              background: #f8f9fa !important;
              border-bottom: 2px solid #e5e7eb !important;
              padding: 16px 20px 12px !important;
            }
            .leaderboard-title {
              color: #1f2937 !important;
              font-size: 1.15rem !important;
              font-weight: 700 !important;
            }
            .title-icon {
              color: #3b82f6 !important;
            }
            .leaderboard-content {
              overflow: visible !important;
              background: #ffffff !important;
              padding: 2px 0 !important;
            }
            .leaderboard-list {
              overflow: visible !important;
              max-height: none !important;
              background: #ffffff !important;
            }
            
            /* Item layout - table rows */
            .leaderboard-table {
              width: 100% !important;
              border-collapse: collapse !important;
              background: #ffffff !important;
            }
            .leaderboard-table th {
              padding: 0 8px 10px !important;
              text-align: left !important;
              font-size: 0.75rem !important;
              font-weight: 500 !important;
              color: #6b7280 !important;
              border-bottom: 1px solid #e5e7eb !important;
              background: transparent !important;
            }
            .leaderboard-table .leaderboard-th-value {
              text-align: right !important;
              padding-right: 16px !important;
            }
            .leaderboard-table .leaderboard-th-mga {
              display: table-cell !important;
            }
            tr.leaderboard-item {
              display: table-row !important;
              overflow: visible !important;
              transform: none !important;
              padding: 0 !important;
            }
            .leaderboard-table td {
              padding: 10px 8px !important;
              background: #ffffff !important;
              border-bottom: 1px solid #f0f0f0 !important;
              vertical-align: middle !important;
            }
            .leaderboard-td-rank {
              padding-left: 16px !important;
              width: 50px !important;
            }
            .leaderboard-td-value {
              text-align: right !important;
              padding-right: 16px !important;
            }
            .leaderboard-td-mga {
              display: table-cell !important;
            }
            .leaderboard-agent-info {
              display: flex !important;
              align-items: center !important;
              gap: 10px !important;
            }
            .leaderboard-mga-badge {
              display: inline-block !important;
              padding: 2px 8px !important;
              background: rgba(59, 130, 246, 0.12) !important;
              color: #3b82f6 !important;
              border-radius: 4px !important;
              font-size: 0.75rem !important;
            }
            /* Top 3 highlights */
            tr.rank-1 td:first-child {
              border-left: 4px solid #fbbf24 !important;
            }
            tr.rank-2 td:first-child {
              border-left: 4px solid #9ca3af !important;
            }
            tr.rank-3 td:first-child {
              border-left: 4px solid #d97706 !important;
            }
            tr.current-user td {
              background: #fef9e7 !important;
            }
            tr.current-user td:first-child {
              border-left: 4px solid #f59e0b !important;
            }
            .leaderboard-mobile-mga {
              display: none !important;
            }
            .leaderboard-mobile-achievement {
              display: none !important;
            }
            /* Expanded row */
            .leaderboard-expanded-row td {
              background: #fafbfc !important;
              padding: 16px 24px !important;
            }
            
            /* Ensure ALL inner containers don't clip content */
            .item-content,
            .item-main,
            .item-name-container,
            .name-info,
            .name-line,
            .mga-line,
            .badge-only-line,
            .item-indicators,
            .item-secondary,
            .item-achievement,
            .rank-content,
            .leaderboard-item-container,
            .leaderboard-agent-info {
              overflow: visible !important;
            }
            
            /* Force dark text colors */
            .item-name {
              color: #1f2937 !important;
              font-size: 0.95rem !important;
              overflow: visible !important;
              white-space: nowrap !important;
            }
            .mga-info, .sub-mga-info {
              color: #6b7280 !important;
            }
            .secondary-value {
              color: #6b7280 !important;
            }
            
            /* ============================================
               PROFILE PICTURES - use line-height centering
               html2canvas mishandles flex centering in circles
               ============================================ */
            .profile-picture-fallback,
            .item-profile-picture,
            img.item-profile-picture {
              width: 40px !important;
              height: 40px !important;
              min-width: 40px !important;
              min-height: 40px !important;
              max-width: 40px !important;
              max-height: 40px !important;
              border-radius: 50% !important;
            }
            /* Fallback initials: switch from flex to line-height centering */
            .profile-picture-fallback {
              display: block !important;
              text-align: center !important;
              line-height: 36px !important; /* 40px - 2*2px border */
              font-size: 16px !important;
              font-weight: bold !important;
              color: white !important;
              background-color: #6b7280 !important;
            }
            
            /* ============================================
               RANK AREA
               ============================================ */
            .item-rank {
              width: 40px !important;
              height: auto !important;
              margin-right: 12px !important;
              flex-shrink: 0 !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
            }
            .rank-content {
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              gap: 2px !important;
            }
            
            /* Rank number circles - use line-height centering instead of flex */
            .rank-number {
              display: block !important;
              text-align: center !important;
              width: 28px !important;
              height: 28px !important;
              line-height: 28px !important;
              font-size: 0.8rem !important;
              font-weight: 600 !important;
              color: #6b7280 !important;
              background: #f3f4f6 !important;
              border-radius: 50% !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .rank-number.rank-gold {
              background: linear-gradient(135deg, #fbbf24, #f59e0b) !important;
              color: white !important;
              font-weight: 700 !important;
              border: 2px solid #f59e0b !important;
              line-height: 24px !important; /* 28px - 2*2px border */
            }
            .rank-number.rank-silver {
              background: linear-gradient(135deg, #e5e7eb, #9ca3af) !important;
              color: white !important;
              font-weight: 700 !important;
              border: 2px solid #9ca3af !important;
              line-height: 24px !important;
            }
            .rank-number.rank-bronze {
              background: linear-gradient(135deg, #d97706, #b45309) !important;
              color: white !important;
              font-weight: 700 !important;
              border: 2px solid #b45309 !important;
              line-height: 24px !important;
            }
            
            /* ============================================
               RANK MOVEMENT INDICATORS - line-height centering
               ============================================ */
            .rank-movement-indicator {
              display: block !important;
              text-align: center !important;
              font-size: 0.6rem !important;
              font-weight: 700 !important;
              padding: 1px 3px !important;
              border-radius: 3px !important;
              line-height: 1.3 !important;
              white-space: nowrap !important;
              margin-top: 1px !important;
              color: white !important;
            }
            .rank-movement-indicator[data-direction="up"] {
              background: linear-gradient(135deg, #10b981, #059669) !important;
            }
            .rank-movement-indicator[data-direction="down"] {
              background: linear-gradient(135deg, #ef4444, #dc2626) !important;
            }
            .rank-movement-indicator[data-direction="new"] {
              background: linear-gradient(135deg, #3b82f6, #2563eb) !important;
            }
            .rank-movement-indicator[data-direction="same"] {
              background: #f3f4f6 !important;
              color: #6b7280 !important;
            }
            
            /* ============================================
               MGA / ROLE BADGES - more spacing from names
               ============================================ */
            .mga-line {
              margin-top: 3px !important;
              display: flex !important;
              align-items: center !important;
              gap: 6px !important;
            }
            .badge-only-line {
              margin-top: 3px !important;
              display: flex !important;
              align-items: center !important;
            }
            .user-role-badge {
              display: inline-block !important;
              overflow: visible !important;
              line-height: 1.4 !important;
              vertical-align: middle !important;
              padding: 1px 4px !important;
              font-size: 0.6rem !important;
              border-radius: 3px !important;
            }
            .mga-info {
              font-size: 0.7rem !important;
              line-height: 1.4 !important;
            }
            
            /* ============================================
               ACHIEVEMENT BADGES - line-height centering
               ============================================ */
            .achievement-badge {
              display: inline-block !important;
              background: linear-gradient(135deg, #fbbf24, #c77206) !important;
              color: white !important;
              font-size: 0.65rem !important;
              font-weight: 500 !important;
              padding: 2px 6px !important;
              border-radius: 4px !important;
              line-height: 1.4 !important;
              vertical-align: middle !important;
              white-space: nowrap !important;
            }
            .item-indicators {
              margin-top: -15px !important;
              display: flex !important;
              flex-direction: column !important;
              align-items: flex-end !important;
              gap: 2px !important;
            }
            
            /* ============================================
               ITEM LAYOUT - ensure proper flex alignment
               ============================================ */
            .item-content {
              flex: 1 !important;
              display: flex !important;
              flex-direction: column !important;
              gap: 4px !important;
              min-width: 0 !important;
            }
            .item-main {
              display: flex !important;
              flex-direction: row !important;
              justify-content: space-between !important;
              align-items: center !important;
              width: 100% !important;
            }
            .item-name-container {
              display: flex !important;
              flex-direction: row !important;
              align-items: center !important;
              gap: 10px !important;
              flex: 1 !important;
              min-width: 0 !important;
            }
            .name-info {
              display: flex !important;
              flex-direction: column !important;
              flex: 1 !important;
              min-width: 0 !important;
              justify-content: center !important;
            }
            .name-line {
              display: flex !important;
              flex-direction: row !important;
              align-items: center !important;
            }
            
            /* ============================================
               PODIUM BARS
               ============================================ */
            .podium-bar.rank-1 {
              background: linear-gradient(135deg, #fbbf24, #f59e0b) !important;
            }
            .podium-bar.rank-2 {
              background: linear-gradient(135deg, #9ca3af, #6b7280) !important;
            }
            .podium-bar.rank-3 {
              background: linear-gradient(135deg, #d97706, #b45309) !important;
            }
            
            /* Top 3 item backgrounds */
            .leaderboard-item.rank-1 {
              background: #fffdf5 !important;
              border-left: 4px solid #fbbf24 !important;
            }
            .leaderboard-item.rank-2 {
              background: #fafbfc !important;
              border-left: 4px solid #9ca3af !important;
            }
            .leaderboard-item.rank-3 {
              background: #fffcf5 !important;
              border-left: 4px solid #d97706 !important;
            }
            
            /* Current user highlight */
            .leaderboard-item.current-user {
              background: #fef9e7 !important;
              border-left: 4px solid #f59e0b !important;
              transform: none !important;
            }
            
            /* Sub-items */
            .leaderboard-sub-item {
              background: #fdfdfd !important;
              padding: 6px 16px !important;
              gap: 10px !important;
              border: 1px solid #f0f0f0 !important;
            }
            .sub-item-rank {
              display: block !important;
              text-align: center !important;
              width: 24px !important;
              height: 24px !important;
              min-width: 24px !important;
              line-height: 24px !important;
              font-size: 0.7rem !important;
              border-radius: 50% !important;
              background: #f3f4f6 !important;
              color: #6b7280 !important;
            }
            .sub-item-profile-picture,
            img.sub-item-profile-picture {
              width: 32px !important;
              height: 32px !important;
              min-width: 32px !important;
              min-height: 32px !important;
              max-width: 32px !important;
              max-height: 32px !important;
              border-radius: 50% !important;
            }
            .sub-item-profile-picture.profile-picture-fallback {
              line-height: 28px !important; /* 32px - 2*2px border */
              font-size: 14px !important;
            }
          `;
          clonedDoc.head.appendChild(sanitizeStyle);
          
          // Set font on body
          clonedDoc.body.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        }
      };
      
      // Capture the screenshot of the clone
      const canvas = await html2canvas(clonedElement, options);
      
      // Remove the clone from DOM
      document.body.removeChild(clonedElement);
      
      // Convert canvas to blob
      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/png', 1.0);
      });
      
      const exportedCount = positionLimit || displayData.length;
      
      // Try to copy to clipboard first (modern browsers)
      let copiedToClipboard = false;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                    window.navigator.standalone || 
                    document.referrer.includes('android-app://');
      
      // Desktop: Try clipboard first
      if (navigator.clipboard && ClipboardItem && !isMobile) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': blob
            })
          ]);
          copiedToClipboard = true;
          
          // Show success message with position info
          const positionText = positionLimit ? ` (top ${positionLimit})` : '';
          const message = document.createElement('div');
          message.textContent = `Leaderboard image${positionText} copied to clipboard!`;
          message.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            font-weight: 500;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            animation: slideIn 0.3s ease-out;
          `;
          
          // Add animation styles
          const style = document.createElement('style');
          style.textContent = `
            @keyframes slideIn {
              from { transform: translateX(100%); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
          `;
          document.head.appendChild(style);
          document.body.appendChild(message);
          
          // Remove after 3 seconds
          setTimeout(() => {
            message.remove();
            style.remove();
          }, 3000);
          
        } catch (clipboardError) {
          console.log('Clipboard copy failed, falling back to other methods:', clipboardError);
        }
      }
      
      // PWA/Mobile: Use Web Share API or File System Access API
      if (!copiedToClipboard) {
        const positionText = positionLimit ? ` (top ${positionLimit})` : '';
        
        // Try Web Share API first (great for PWAs)
        if (navigator.share && isMobile) {
          try {
            const file = new File([blob], `${filename}.png`, { type: 'image/png' });
            
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                title: `${title}${positionText}`,
                text: `Leaderboard${positionText}`,
                files: [file]
              });
              
              // Show success message
              const message = document.createElement('div');
              message.textContent = `Leaderboard image${positionText} shared successfully!`;
              message.style.cssText = `
                position: fixed;
                top: 20px;
                left: 20px;
                right: 20px;
                background: #10b981;
                color: white;
                padding: 12px 16px;
                border-radius: 6px;
                font-weight: 500;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                text-align: center;
                font-size: 14px;
              `;
              document.body.appendChild(message);
              setTimeout(() => message.remove(), 3000);
              return;
            }
          } catch (shareError) {
            console.log('Web Share API failed, trying other methods:', shareError);
          }
        }
        
        // Try File System Access API (Chrome PWAs)
        if (window.showSaveFilePicker && isPWA) {
          try {
            const fileHandle = await window.showSaveFilePicker({
              suggestedName: `${filename}.png`,
              types: [{
                description: 'PNG Images',
                accept: { 'image/png': ['.png'] }
              }]
            });
            
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            
            // Show success message
            const message = document.createElement('div');
            message.textContent = `Leaderboard image${positionText} saved successfully!`;
            message.style.cssText = `
              position: fixed;
              top: 20px;
              left: 20px;
              right: 20px;
              background: #10b981;
              color: white;
              padding: 12px 16px;
              border-radius: 6px;
              font-weight: 500;
              z-index: 10000;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
              text-align: center;
              font-size: 14px;
            `;
            document.body.appendChild(message);
            setTimeout(() => message.remove(), 3000);
            return;
          } catch (fileSystemError) {
            console.log('File System Access API failed, falling back to download:', fileSystemError);
          }
        }
        
        // Fallback: Create a download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.png`;
        
        if (isMobile || isPWA) {
          // For mobile/PWA: Show a modal with download instructions
          const modal = document.createElement('div');
          modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          `;
          
          const modalContent = document.createElement('div');
          modalContent.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 24px;
            max-width: 400px;
            width: 100%;
            text-align: center;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          `;
          
          modalContent.innerHTML = `
            <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px;">Save Leaderboard Image</h3>
            <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px; line-height: 1.4;">
              Tap the download button below to save the leaderboard image${positionText} to your device.
            </p>
            <div style="display: flex; gap: 12px; justify-content: center;">
              <button id="downloadBtn" style="
                background: #3b82f6;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-weight: 500;
                font-size: 14px;
                cursor: pointer;
              ">Download Image</button>
              <button id="cancelBtn" style="
                background: #f3f4f6;
                color: #374151;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-weight: 500;
                font-size: 14px;
                cursor: pointer;
              ">Cancel</button>
            </div>
          `;
          
          modal.appendChild(modalContent);
          document.body.appendChild(modal);
          
          // Handle download button
          const downloadBtn = modal.querySelector('#downloadBtn');
          const cancelBtn = modal.querySelector('#cancelBtn');
          
          downloadBtn.onclick = () => {
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            document.body.removeChild(modal);
            URL.revokeObjectURL(url);
            
            // Show success message
            const message = document.createElement('div');
            message.textContent = `Leaderboard image${positionText} downloaded!`;
            message.style.cssText = `
              position: fixed;
              top: 20px;
              left: 20px;
              right: 20px;
              background: #3b82f6;
              color: white;
              padding: 12px 16px;
              border-radius: 6px;
              font-weight: 500;
              z-index: 10000;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
              text-align: center;
              font-size: 14px;
            `;
            document.body.appendChild(message);
            setTimeout(() => message.remove(), 3000);
          };
          
          cancelBtn.onclick = () => {
            document.body.removeChild(modal);
            URL.revokeObjectURL(url);
          };
          
          // Close on backdrop click
          modal.onclick = (e) => {
            if (e.target === modal) {
              document.body.removeChild(modal);
              URL.revokeObjectURL(url);
            }
          };
          
        } else {
          // Desktop: Direct download
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          // Show download message
          const message = document.createElement('div');
          message.textContent = `Leaderboard image${positionText} downloaded!`;
          message.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #3b82f6;
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            font-weight: 500;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          `;
          document.body.appendChild(message);
          setTimeout(() => message.remove(), 3000);
        }
      }
      
    } catch (error) {
      console.error('Error exporting leaderboard image:', error);
      
      // Show error message
      const message = document.createElement('div');
      message.textContent = 'Failed to export leaderboard image. Please try again.';
      message.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 12px 16px;
        border-radius: 6px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      `;
      document.body.appendChild(message);
      setTimeout(() => message.remove(), 3000);
    } finally {
      setIsExportingImage(false);
    }
  };

  // Handle export button click - show options if more than 10 entries
  const handleExportButtonClick = (e) => {
    e.stopPropagation();
    
    if (reRankedData.length > 10) {
      setShowExportOptions(!showExportOptions);
    } else {
      // Export directly if 10 or fewer entries
      handlePngExport(e);
    }
  };

  // Close export options when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showExportOptions && !event.target.closest('.export-options-container')) {
        setShowExportOptions(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showExportOptions]);

  // Process data with proper tie handling if no rank field is provided
  const processedData = data.map(item => item[rankField]).some(rank => rank === undefined) 
    ? calculateRanksWithTies(data, valueField)
    : data;

  // If an allowedNames Set/array is provided, filter items whose name is not in the allowed list
  // Normalize to lowercase for comparison safety and normalize multiple spaces
  const normalizeName = (val) => (val ? String(val).replace(/\s+/g, ' ').toLowerCase().trim() : "");
  const toSet = (input, mapper = (v) => v) => {
    if (!input) return null;
    if (input instanceof Set) return input;
    if (Array.isArray(input)) return new Set(input.map(mapper));
    return null;
  };
  const allowedNameSet = toSet(allowedNames, normalizeName);
  const allowedIdSet = toSet(allowedIds, (v) => String(v));
  const getItemId = (item) => {
    const idCandidate = item.user_id ?? item.userId ?? item.id;
    return idCandidate !== undefined && idCandidate !== null ? String(idCandidate) : null;
  };
  const getItemRawName = (item) => normalizeName(item[rawNameField || nameField]);
  const processedAndAllowed = processedData.filter(item => {
    // If allowedIdSet is provided and we have an ID on the item, enforce it
    if (allowedIdSet) {
      const itemId = getItemId(item);
      if (itemId && !allowedIdSet.has(itemId)) return false;
    }
    // If allowedNameSet is provided, enforce name membership using raw name
    if (allowedNameSet) {
      const rawName = getItemRawName(item);
      if (!allowedNameSet.has(rawName)) return false;
    }
    return true;
  });
  
  // Filter out inactive users (where Active = 'n' or managerActive = 'n')
  // This removes users from activeusers table who are marked as inactive
  const filteredData = processedAndAllowed.filter(item => {
    // If Active field exists and is 'n', exclude the user
    if (item.Active && item.Active.toLowerCase() === 'n') {
      return false;
    }
    
    // If managerActive field exists and is 'n', exclude the user  
    if (item.managerActive && item.managerActive.toLowerCase() === 'n') {
      return false;
    }
    
    // Include the user if they pass the active filters
    return true;
  });
  
  // Recalculate ranks after filtering since some users may have been removed
  // Always recalculate ranks to ensure consecutive ranking after filtering
  const reRankedData = calculateRanksWithTies(filteredData, valueField);
  
  const displayData = showCount ? reRankedData.slice(0, showCount) : reRankedData;

  // Table column configuration
  const showMgaColumn = showMGA && ['all', 'sa', 'ga', 'mga', 'rga', 'sga', 'agt'].includes(hierarchyLevel);
  const tableColCount = 3 + (showMgaColumn ? 1 : 0); // Rank + Agent + (MGA) + Value

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
          {showCount && reRankedData.length > showCount && (
            <span className="showing-count">
              Showing top {showCount} of {reRankedData.length}
            </span>
          )}
          <div className="header-controls-buttons">
            {maxHeight !== "none" && displayData.length > 10 && (
              <button 
                className="scroll-button expand-height-button"
                onClick={toggleHeightExpansion}
                title={isHeightExpanded ? "Collapse to fit" : "Expand to show all"}
              >
                {isHeightExpanded ? (
                  <FiMinimize2 className="scroll-icon" />
                ) : (
                  <FiMaximize2 className="scroll-icon" />
                )}
              </button>
            )}
            {enablePngExport && (
              <div className="export-options-container">
                <button 
                  className="png-export-button"
                  onClick={handleExportButtonClick}
                  disabled={isExportingImage || displayData.length === 0}
                  title={reRankedData.length > 10 ? "Export leaderboard (choose positions)" : "Copy leaderboard as image"}
                >
                  {isExportingImage ? (
                    <FiLoader className="export-spinner" />
                  ) : (
                    <FiDownload className="export-icon" />
                  )}
                  {reRankedData.length > 10 && (
                    <svg 
                      className="dropdown-arrow" 
                      width="12" 
                      height="12" 
                      viewBox="0 0 12 12" 
                      fill="currentColor"
                    >
                      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
                
                {showExportOptions && reRankedData.length > 10 && (
                  <div className="export-options-menu">
                    <div className="export-options-header">
                      Export positions:
                    </div>
                    <button 
                      className="export-option"
                      onClick={(e) => handlePngExport(e, 10)}
                      disabled={isExportingImage}
                    >
                      Top 10
                    </button>
                    <button 
                      className="export-option"
                      onClick={(e) => handlePngExport(e, 25)}
                      disabled={isExportingImage}
                    >
                      Top 25
                    </button>
                    <button 
                      className="export-option"
                      onClick={(e) => handlePngExport(e, 50)}
                      disabled={isExportingImage}
                    >
                      Top 50
                    </button>
                    <button 
                      className="export-option"
                      onClick={(e) => handlePngExport(e, 100)}
                      disabled={isExportingImage}
                    >
                      Top 100
                    </button>
                    <button 
                      className="export-option export-all"
                      onClick={(e) => handlePngExport(e)}
                      disabled={isExportingImage}
                    >
                      All positions ({reRankedData.length})
                    </button>
                  </div>
                )}
              </div>
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
              maxHeight: isHeightExpanded ? 'none' : maxHeight, 
              overflowY: (isHeightExpanded || maxHeight === "none") ? 'visible' : 'auto' 
            }}
          >
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th className="leaderboard-th leaderboard-th-rank">Rank</th>
                  <th className="leaderboard-th leaderboard-th-agent">Agent</th>
                  {showMgaColumn && (
                    <th className="leaderboard-th leaderboard-th-mga">MGA</th>
                  )}
                  <th className="leaderboard-th leaderboard-th-value">Value</th>
                </tr>
              </thead>
              <tbody>
                {displayData.map((item, index) => {
                  const rank = item[rankField] || (index + 1);
                  const rawName = item[nameField] || "Unknown";
                  const displayName = NameFormats[nameFormat] ? NameFormats[nameFormat](rawName) : rawName;
                  const mobileDisplayName = NameFormats[mobileNameFormat] ? NameFormats[mobileNameFormat](rawName) : displayName;
                  const profilePicture = item[profilePictureField];
                  const value = item[valueField];
                  const secondaryValue = secondaryValueField ? item[secondaryValueField] : null;
                  const itemKey = `${index}-${rawName}`;
                  const isExpanded = expandedItems.has(itemKey);
                  const hasSubData = expandedData[itemKey];
                  const isExpandable = allowExpansion && (item.level !== 'AGENT');
                  const isUser = isCurrentUser(item);
                  
                  return (
                    <React.Fragment key={index}>
                      <tr
                        ref={isUser ? currentUserRef : null}
                        className={`leaderboard-item leaderboard-item-container ${getRankClass(rank)} ${
                          (onItemClick || isExpandable || onRowClick) ? 'clickable' : ''
                        } ${isUser ? 'current-user' : ''}`}
                        onClick={() => {
                          if (isExpandable) {
                            handleToggleExpansion(item, index);
                          } else if (onItemClick) {
                            onItemClick(item);
                          } else if (onRowClick) {
                            onRowClick(item);
                          }
                        }}
                      >
                        {/* Rank Cell */}
                        <td className="leaderboard-td leaderboard-td-rank">
                          <div className="rank-content">
                            {isExpandable && (
                              <span className="expand-chevron">
                                {hasSubData?.loading ? (
                                  <FiLoader className="expand-spinner" />
                                ) : isExpanded ? (
                                  <FiChevronDown />
                                ) : (
                                  <FiChevronRight />
                                )}
                              </span>
                            )}
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
                        </td>

                        {/* Agent Cell */}
                        <td className="leaderboard-td leaderboard-td-agent">
                          <div className="leaderboard-agent-info">
                            {showProfilePicture && (
                              <ProfilePicture 
                                src={profilePicture} 
                                name={rawName}
                                size="40px"
                                mobileSize="32px"
                                className="item-profile-picture"
                                onClick={onProfileClick ? () => onProfileClick(item) : null}
                              />
                            )}
                            <div className="name-info">
                              <div className="name-line">
                                <span className="item-name desktop-name">{displayName}</span>
                                <span className="item-name mobile-name">{mobileDisplayName}</span>
                                {showLevelBadge && item.clname && (
                                  <span 
                                    className="user-role-badge"
                                    style={getLevelBadgeStyles(item.clname)}
                                  >
                                    {item.clname}
                                  </span>
                                )}
                              </div>
                              {/* MGA shown on mobile only (desktop has its own column) */}
                              {showMgaColumn && item.mgaLastName && (
                                <div className="mga-line leaderboard-mobile-mga">
                                  <span className="mga-info">{item.mgaLastName}</span>
                                </div>
                              )}
                              {/* MGA shown inline when no separate MGA column */}
                              {!showMgaColumn && showMGA && item.mgaLastName && ['all', 'sa', 'ga', 'mga', 'rga', 'sga', 'agt'].includes(hierarchyLevel) && (
                                <div className="mga-line">
                                  <span className="mga-info">{item.mgaLastName}</span>
                                </div>
                              )}
                              {/* Achievement badge shown under name on mobile */}
                              {variant === "detailed" && formatAchievementBadge(item) && value > 0 && (
                                <div className="item-achievement leaderboard-mobile-achievement">
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
                          </div>
                        </td>

                        {/* MGA Column (desktop only) */}
                        {showMgaColumn && (
                          <td className="leaderboard-td leaderboard-td-mga">
                            {item.mgaLastName ? (
                              <span className="leaderboard-mga-badge">{item.mgaLastName}</span>
                            ) : (
                              <span className="leaderboard-mga-empty">-</span>
                            )}
                          </td>
                        )}

                        {/* Value Cell */}
                        <td className="leaderboard-td leaderboard-td-value">
                          <span 
                            className="item-value"
                            style={getValueColors(value, valueColorRanges)}
                          >
                            {formatValue(value)}
                          </span>
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
                                <div className="item-achievement leaderboard-desktop-achievement">
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
                        </td>
                      </tr>

                      {/* Expanded sub-items */}
                      {isExpanded && hasSubData && hasSubData.data && (
                        <tr className="leaderboard-expanded-row">
                          <td colSpan={tableColCount} className="leaderboard-td-expanded">
                            <div className="expanded-content">
                              {hasSubData.data.map((subItem, subIndex) => {
                                const subRawName = subItem[nameField] || "Unknown";
                                const subDisplayName = NameFormats[nameFormat] ? NameFormats[nameFormat](subRawName) : subRawName;
                                const subMobileDisplayName = NameFormats[mobileNameFormat] ? NameFormats[mobileNameFormat](subRawName) : subDisplayName;
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
                                            size="36px"
                                            mobileSize="28px"
                                            className="sub-item-profile-picture"
                                            onClick={onProfileClick ? () => onProfileClick(subItem) : null}
                                          />
                                        )}
                                        <div className="sub-name-info">
                                          <div className="sub-name-line">
                                            <span className="sub-item-name desktop-name">{subDisplayName}</span>
                                            <span className="sub-item-name mobile-name">{subMobileDisplayName}</span>
                                          </div>
                                          {showMGA && subItem.mgaLastName && ['all', 'sa', 'ga', 'mga', 'rga', 'sga', 'agt'].includes(hierarchyLevel) && (
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
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default Leaderboard; 