import React, { useState, useRef, useEffect } from 'react';
import { FiAward, FiStar, FiTarget, FiTrendingUp, FiChevronDown, FiChevronRight, FiLoader, FiUser, FiArrowUp, FiCamera, FiDownload } from 'react-icons/fi';
import html2canvas from 'html2canvas';
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
  exportFileName = null // Custom filename for export, defaults to title
}) => {

  const [expandedItems, setExpandedItems] = useState(new Set());
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isUserVisible, setIsUserVisible] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
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
      
      // Apply export-specific styles to the clone
      clonedElement.style.position = 'absolute';
      clonedElement.style.left = '-9999px';
      clonedElement.style.top = '0px';
      clonedElement.style.zIndex = '-1000';
      clonedElement.style.width = originalElement.offsetWidth + 'px';
      clonedElement.style.height = 'auto';
      clonedElement.style.maxHeight = 'none';
      clonedElement.style.overflow = 'visible';
      clonedElement.style.background = '#ffffff';
      
      // Ensure the header (with title) is visible and properly styled
      const clonedHeader = clonedElement.querySelector('.leaderboard-header');
      if (clonedHeader) {
        clonedHeader.style.display = 'flex';
        clonedHeader.style.justifyContent = 'space-between';
        clonedHeader.style.alignItems = 'center';
        clonedHeader.style.padding = '20px 24px 16px';
        clonedHeader.style.borderBottom = '1px solid #f3f4f6';
        clonedHeader.style.background = '#f8f9fa';
        
        // Ensure title is visible
        const clonedTitle = clonedHeader.querySelector('.leaderboard-title');
        if (clonedTitle) {
          clonedTitle.style.display = 'flex';
          clonedTitle.style.alignItems = 'center';
          clonedTitle.style.fontSize = '1.25rem';
          clonedTitle.style.fontWeight = '600';
          clonedTitle.style.color = '#1f2937';
          clonedTitle.style.margin = '0';
        }
      }
      
      // Find and modify the leaderboard content container
      const clonedContent = clonedElement.querySelector('.leaderboard-content');
      if (clonedContent) {
        clonedContent.style.padding = '5px 0';
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
          // First, let's see what we're working with
          console.log('🔍 Pre-removal debug:', {
            positionLimit,
            displayDataLength: displayData.length,
            reRankedDataLength: reRankedData.length,
            clonedListIsTheElement: clonedList === clonedElement
          });
          
          const leaderboardItems = clonedList.querySelectorAll('.leaderboard-item-container');
          console.log('🔍 Position limiting debug:', {
            positionLimit,
            totalItemsFound: leaderboardItems.length,
            itemsToKeep: positionLimit,
            itemsToRemove: leaderboardItems.length - positionLimit
          });
          
          // Convert NodeList to Array for easier manipulation
          const itemsArray = Array.from(leaderboardItems);
          
          // Remove items beyond the position limit
          itemsArray.forEach((item, index) => {
            if (index >= positionLimit) {
              console.log(`🗑️ Removing item at index ${index}`);
              item.remove();
            } else {
              console.log(`✅ Keeping item at index ${index}`);
            }
          });
          
          // Verify removal worked
          const remainingItems = clonedList.querySelectorAll('.leaderboard-item-container');
          console.log('✅ After removal:', {
            remainingItemsCount: remainingItems.length,
            expectedCount: positionLimit
          });
          
          // Double-check by also looking at direct children
          const directChildren = Array.from(clonedList.children);
          console.log('🔍 Direct children check:', {
            totalDirectChildren: directChildren.length,
            childrenWithItemContainer: directChildren.filter(child => 
              child.classList.contains('leaderboard-item-container')
            ).length
          });
        }
      }
      
      // Remove scroll buttons from clone since we don't need them in export
      const scrollButtons = clonedElement.querySelectorAll('.scroll-button');
      scrollButtons.forEach(button => button.remove());
      
      // Remove PNG export button from clone since we don't need it in export
      const exportButtons = clonedElement.querySelectorAll('.png-export-button');
      exportButtons.forEach(button => button.remove());
      
      // Remove export options menu from clone
      const exportOptionsMenus = clonedElement.querySelectorAll('.export-options-menu');
      exportOptionsMenus.forEach(menu => menu.remove());
      
      // Add the clone to the DOM temporarily
      document.body.appendChild(clonedElement);
      
      // Debug: Log the clone structure
      console.log('🔍 Clone structure debug:', {
        clonedElement: clonedElement,
        clonedElementClasses: clonedElement.className,
        hasLeaderboardList: !!clonedElement.querySelector('.leaderboard-list'),
        hasLeaderboardHeader: !!clonedElement.querySelector('.leaderboard-header'),
        hasLeaderboardTitle: !!clonedElement.querySelector('.leaderboard-title'),
        isFullContainer: clonedElement.classList.contains('leaderboard'),
        directChildren: Array.from(clonedElement.children).map(child => ({
          tagName: child.tagName,
          className: child.className,
          id: child.id
        }))
      });
      
      // Wait for layout to settle and fonts to load
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Get the actual content dimensions of the clone
      const contentWidth = clonedElement.offsetWidth;
      const contentHeight = clonedElement.offsetHeight;
      
      const exportedCount = positionLimit || displayData.length;
      console.log('📸 Capturing leaderboard with position limit:', {
        originalHeight: originalElement.offsetHeight,
        clonedHeight: contentHeight,
        contentWidth,
        totalDataLength: reRankedData.length,
        displayDataLength: displayData.length,
        exportedCount,
        positionLimit,
        hasHeader: !!clonedElement.querySelector('.leaderboard-header'),
        hasTitle: !!clonedElement.querySelector('.leaderboard-title'),
        hasLeaderboardList: !!clonedElement.querySelector('.leaderboard-list'),
        title: title
      });
      
      // Configure html2canvas options for the clone
      const options = {
        backgroundColor: '#ffffff',
        scale: 2, // Higher resolution
        useCORS: true,
        allowTaint: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: Math.max(contentWidth, 400),
        windowHeight: contentHeight,
        width: contentWidth,
        height: contentHeight,
        onclone: (clonedDoc) => {
          // Ensure fonts are loaded in the cloned document
          const clonedBody = clonedDoc.body;
          clonedBody.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
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
      
      console.log('📸 Canvas created with position limit:', {
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        blobSize: blob.size,
        exportedPositions: exportedCount
      });
      
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
  // Normalize to lowercase for comparison safety
  const normalizeName = (val) => (val ? String(val).toLowerCase().trim() : "");
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
              maxHeight: maxHeight, 
              overflowY: maxHeight === "none" ? 'visible' : 'auto' 
            }}
          >
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
                              <span className="item-name desktop-name">{displayName}</span>
                              <span className="item-name mobile-name">{mobileDisplayName}</span>
                            </div>
                            {showMGA && item.mgaLastName && ['all', 'sa', 'ga', 'mga', 'rga', 'sga', 'agt'].includes(hierarchyLevel) && (
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
                                    size="48px"
                                    mobileSize="32px"
                                    className="sub-item-profile-picture"
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
              <span className="stat-value">{reRankedData.length}</span>
            </div>
            {reRankedData.length > 0 && (
              <div className="stat">
                <span className="stat-label">Average:</span>
                <span className="stat-value">
                  {formatValue(
                    Math.round(
                      reRankedData.reduce((sum, item) => sum + (item[valueField] || 0), 0) / reRankedData.length
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