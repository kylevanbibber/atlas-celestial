import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { 
  FiSearch, FiX, FiHome, FiTrendingUp, FiClipboard, FiUserPlus, 
  FiSettings, FiUser, FiMoon, FiSun, FiMessageSquare, FiBell,
  FiAward, FiList, FiCheckSquare, FiBarChart2, FiShield, FiLink, FiClock, FiStar, FiTrash2
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import './GlobalSearch.css';

const GlobalSearch = ({ theme, toggleTheme, onOpenAgentProfile }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentPages, setRecentPages] = useState([]);
  const [frequentPages, setFrequentPages] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [agentResults, setAgentResults] = useState([]);
  const [searchingAgents, setSearchingAgents] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();

  // Detect mobile
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check user permissions
  const isAdmin = hasPermission('admin');
  const canViewDashboard = user?.canViewDashboard !== false;

  // Define searchable items with keywords for better matching
  const allItems = [
    // Pages
    { category: 'Pages', label: 'Dashboard', icon: <FiHome />, path: '/dashboard', show: canViewDashboard,
      keywords: ['home', 'overview', 'summary', 'stats', 'metrics', 'analytics', 'alp', 'apps', 'hires', 'codes', 
        'commits', 'goals', 'premium', 'production', 'team', 'agency', 'refunds', 'pending', 'issued', 'submitted'] },
    
    // Dashboard Sections
    { category: 'Dashboard', label: 'Team Overview', icon: <FiHome />, path: '/dashboard?section=team', show: canViewDashboard,
      keywords: ['team', 'agents', 'hierarchy', 'downline'] },
    { category: 'Dashboard', label: 'Agency Stats', icon: <FiBarChart2 />, path: '/dashboard?section=agency', show: canViewDashboard,
      keywords: ['agency', 'stats', 'numbers', 'performance'] },
    { category: 'Pages', label: 'Production', icon: <FiTrendingUp />, path: '/production', show: true,
      keywords: ['sales', 'apps', 'activity', 'performance', 'numbers', 'business', 'alp', 'premium', 
        'hires', 'codes', 'scorecard', 'leaderboard', 'goals'] },
    { category: 'Pages', label: 'Resources', icon: <FiClipboard />, path: '/resources', show: true,
      keywords: ['training', 'documents', 'files', 'reports', 'help', 'materials'] },
    { category: 'Pages', label: 'Recruiting', icon: <FiUserPlus />, path: '/recruiting', show: true,
      keywords: ['hiring', 'agents', 'team', 'onboarding', 'candidates', 'recruit', 'pipeline', 'interviews', 'prospects'] },
    
    // Recruiting Sections
    { category: 'Recruiting', label: 'Pipeline', icon: <FiUserPlus />, path: '/recruiting?section=pipeline', show: true,
      keywords: ['candidates', 'prospects', 'funnel', 'stages', 'tracking', 'aob', 'onboarding', 'sync agent appointments', 'agent appointments'] },
    { category: 'Recruiting', label: 'Applicants', icon: <FiUserPlus />, path: '/recruiting?section=applicants', show: true,
      keywords: ['applications', 'candidates', 'new', 'hiring'] },
    { category: 'Recruiting', label: 'Interviews', icon: <FiUserPlus />, path: '/recruiting?section=interviews', show: true,
      keywords: ['schedule', 'meetings', 'calendar'] },
    { category: 'Recruiting', label: 'Onboarding', icon: <FiUserPlus />, path: '/recruiting?section=onboarding', show: true,
      keywords: ['new hire', 'training', 'setup', 'getting started'] },
    { category: 'Pages', label: 'Utilities', icon: <FiSettings />, path: '/utilities', show: true,
      keywords: ['settings', 'preferences', 'configuration', 'options', 'profile'] },
    
    // Production Sections
    { category: 'Production', label: 'Daily Activity', icon: <FiCheckSquare />, path: '/production?section=daily-activity', show: true,
      keywords: ['calls', 'appointments', 'demos', 'presentations', 'sits', 'refs', 'referrals', 'tracking', 'log', 'enter',
        'dials', 'contacts', 'sets', 'shows', 'closes', 'apps', 'alp', 'premium', 'recruits', 'interviews', 'sales', 'numbers', 'activity'] },
    { category: 'Production', label: 'Scorecard', icon: <FiBarChart2 />, path: '/production?section=scorecard', show: true,
      keywords: ['stats', 'performance', 'metrics', 'numbers', 'weekly', 'monthly', 'summary', 'alp', 'apps', 'hires', 
        'codes', 'premium', 'issued', 'submitted', 'pending', 'refunds', 'chargebacks', 'persistency', 'retention', 'sales'] },
    { category: 'Production', label: 'Leaderboard', icon: <FiAward />, path: '/production?section=leaderboard', show: true,
      keywords: ['ranking', 'top', 'competition', 'winners', 'best', 'agents', 'standings', 'compare', 'alp', 'apps',
        'hires', 'codes', 'performers', 'leaders', 'team', 'sales'] },
    { category: 'Production', label: 'Goals', icon: <FiTrendingUp />, path: '/production?section=goals', show: true,
      keywords: ['target', 'achievement', 'bonus', 'objective', 'quota', 'milestone', 'progress', 'commits', 'commitment',
        'alp', 'apps', 'hires', 'codes', 'weekly', 'monthly', 'annual', 'incentive', 'contest', 'sales'] },
    { category: 'Production', label: 'Verification', icon: <FiShield />, path: '/production?section=verification', show: true,
      keywords: ['verify', 'approve', 'check', 'confirm', 'validate', 'review', 'pending', 'apps', 'submitted', 'accuracy', 'sales'] },
    { category: 'Production', label: 'Codes & VIPs', icon: <FiList />, path: '/production?section=vips', show: true,
      keywords: ['codes', 'vip', 'special', 'agent codes', 'writing numbers', 'splits', 'override', 'commission'] },
    
    // Resources Sections
    { category: 'Resources', label: 'Reports', icon: <FiClipboard />, path: '/resources?active=reports', show: true,
      keywords: ['data', 'export', 'download', 'analysis', 'document', 'spreadsheet', 'csv', 'excel'] },
    { category: 'Resources', label: 'Release Training', icon: <FiList />, path: '/resources?active=release', show: true,
      keywords: ['updates', 'new features', 'changelog', 'whats new', 'tutorial', 'learn', 'video', 'guide', 'how to'] },
    { category: 'Resources', label: 'Refs', icon: <FiUserPlus />, path: '/resources?active=refs', show: true,
      keywords: ['referrals', 'references', 'contacts'] },
    { category: 'Resources', label: 'Leads', icon: <FiUserPlus />, path: '/resources?active=leads', show: true,
      keywords: ['prospects', 'contacts', 'potential', 'customers', 'clients', 'list', 'callbacks', 'follow up'] },
    { category: 'Resources', label: 'Licensing', icon: <FiShield />, path: '/resources?active=licensing', show: true,
      keywords: ['license', 'state', 'appointment', 'carrier', 'certification', 'exam', 'globe', 'ailicm', 'nipr'] },
    { category: 'Resources', label: '2026 Awards Guide', icon: <FiAward />, url: '/pdfs/Arias_Awards_2026.jpg', show: true,
      keywords: ['awards', '2026', 'arias', 'guide', 'recognition', 'achievements', 'clubs', 'platinum', 'gold', 'silver', 'bronze', 'diamond', 'rookie', 'veteran', 'mga', 'rga', 'ga', 'top producers', 'legacy', 'mvp', 'inspiring'] },
    { category: 'Resources', label: 'Feedback', icon: <FiMessageSquare />, path: '/resources?active=feedback', show: true,
      keywords: ['bug', 'report', 'feature', 'request', 'issue', 'problem', 'suggestion'] },
    
    // Settings Sections
    { category: 'Settings', label: 'Account Settings', icon: <FiUser />, path: '/utilities?section=account', show: true,
      keywords: ['profile', 'password', 'email', 'phone', 'name', 'photo', 'picture', 'avatar', 'personal', 'change', 'update'] },
    { category: 'Settings', label: 'Trophy Case', icon: <FiAward />, path: '/utilities?section=trophy', show: true,
      keywords: ['awards', 'achievements', 'badges', 'recognition', 'accomplishments', 'medals', 'rings', 'trips', 'incentives', 'contest'] },
    { category: 'Settings', label: 'Hierarchy', icon: <FiUserPlus />, path: '/utilities?section=hierarchy', show: true,
      keywords: ['team', 'upline', 'downline', 'organization', 'structure', 'manager', 'agents', 'rga', 'mga', 'ga', 'sa', 'agt'] },
    { category: 'Settings', label: 'Notifications', icon: <FiBell />, path: '/utilities?section=notifications', show: true,
      keywords: ['alerts', 'emails', 'push', 'reminders', 'messages', 'preferences', 'subscribe', 'unsubscribe'] },
    { category: 'Settings', label: 'Discord', icon: <FiLink />, path: '/utilities?section=discord', show: true,
      keywords: ['bot', 'integration', 'webhook', 'chat', 'server', 'connect', 'link', 'notifications', 'channel'] },
    { category: 'Settings', label: 'Licensing Settings', icon: <FiShield />, path: '/resources?active=licensing', show: true,
      keywords: ['states', 'appointments', 'carriers', 'licenses', 'certifications', 'globe', 'ailicm'] },
    
    // Quick Actions
    { category: 'Actions', label: 'Report MORE', icon: <FiClipboard />, path: '/resources?active=reports&report=more', show: true,
      keywords: ['report hires', 'more', 'report more', 'report recruiting', 'recruiting', 'hires', 'recruiting report'] },
    { category: 'Actions', label: 'Report Activity', icon: <FiBarChart2 />, path: '/resources?active=reports&report=activity', show: true,
      keywords: ['report numbers', 'activity', 'daily activity', 'sales', 'calls', 'numbers report', 'activity report'] },
    { category: 'Actions', label: 'Submit Feedback', icon: <FiMessageSquare />, path: '/resources?active=feedback', show: true,
      keywords: ['bug', 'report', 'feature', 'request', 'issue', 'problem', 'suggestion', 'idea', 'help'] },
    { category: 'Actions', label: theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode', icon: theme === 'light' ? <FiMoon /> : <FiSun />, action: 'toggleTheme', show: true,
      keywords: ['theme', 'appearance', 'color', 'night', 'day', 'display'] },
    
    // Admin only
    { category: 'Admin', label: 'Admin Hierarchy', icon: <FiSettings />, path: '/admin/hierarchy', show: isAdmin,
      keywords: ['manage', 'organization', 'structure', 'teams', 'permissions'] },
    { category: 'Admin', label: 'Login Logs', icon: <FiUser />, path: '/admin/login-logs', show: isAdmin,
      keywords: ['audit', 'security', 'access', 'history', 'sessions', 'activity'] },
    { category: 'Admin', label: 'Email Campaigns', icon: <FiMessageSquare />, path: '/admin/email-campaigns', show: isAdmin,
      keywords: ['marketing', 'newsletter', 'bulk', 'send', 'communication'] },
  ].filter(item => item.show);

  // Fetch user's navigation recommendations
  const fetchRecommendations = useCallback(async () => {
    try {
      console.log('[GlobalSearch] Fetching recommendations...');
      const response = await api.get('/navigation/recommendations');
      console.log('[GlobalSearch] API response:', response.data);
      
      if (response.data.success) {
        // Map recent pages to allItems format
        const mapToItem = (page) => {
          const matchingItem = allItems.find(item => item.path === page.path);
          console.log('[GlobalSearch] Mapping page:', page.path, '-> Found match:', !!matchingItem);
          if (matchingItem) {
            return { ...matchingItem, fromHistory: true };
          }
          // Create a generic item for pages not in allItems
          return {
            category: 'History',
            label: page.label || page.path,
            icon: <FiClock />,
            path: page.path,
            fromHistory: true
          };
        };

        // Ensure we have arrays (backend might return object or array)
        const recentArray = Array.isArray(response.data.recent) ? response.data.recent : [];
        const frequentArray = Array.isArray(response.data.frequent) ? response.data.frequent : [];
        
        const mappedRecent = recentArray.map(mapToItem).filter(Boolean);
        const mappedFrequent = frequentArray.map(mapToItem).filter(Boolean);
        
        console.log('[GlobalSearch] Mapped recent:', mappedRecent.length, 'items');
        console.log('[GlobalSearch] Mapped frequent:', mappedFrequent.length, 'items');
        
        setRecentPages(mappedRecent);
        setFrequentPages(mappedFrequent);
      } else {
        console.log('[GlobalSearch] API returned success: false');
      }
      
      // Also fetch recent searches
      const searchResponse = await api.get('/navigation/searches');
      if (searchResponse.data.success) {
        setRecentSearches(searchResponse.data.searches || []);
      }
    } catch (error) {
      console.error('[GlobalSearch] Failed to fetch recommendations:', error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItems.length]);

  // Log navigation to the backend
  const logNavigation = useCallback(async (path, label) => {
    try {
      await api.post('/navigation/log', { path, label });
    } catch (error) {
      // Silently fail - logging is not critical
      console.debug('Failed to log navigation:', error);
    }
  }, []);

  // Log search query to the backend
  const logSearch = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.trim().length < 2) return;
    try {
      await api.post('/navigation/search', { query: searchQuery });
    } catch (error) {
      console.debug('Failed to log search:', error);
    }
  }, []);

  // Clear search history
  const clearSearchHistory = useCallback(async () => {
    try {
      await api.delete('/navigation/searches');
      setRecentSearches([]);
    } catch (error) {
      console.debug('Failed to clear search history:', error);
    }
  }, []);

  // Search for agents
  const searchAgents = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setAgentResults([]);
      return;
    }
    
    setSearchingAgents(true);
    try {
      const response = await api.get(`/users/search?q=${encodeURIComponent(searchQuery)}`);
      if (response.data.users) {
        // Limit to top 5 results
        setAgentResults(response.data.users.slice(0, 5));
      }
    } catch (error) {
      console.debug('Failed to search agents:', error);
      setAgentResults([]);
    } finally {
      setSearchingAgents(false);
    }
  }, []);

  // Fetch recommendations when search opens
  useEffect(() => {
    if (isOpen) {
      fetchRecommendations();
    }
  }, [isOpen, fetchRecommendations]);

  // Search agents when query changes
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (query.trim().length >= 2) {
        searchAgents(query);
      } else {
        setAgentResults([]);
      }
    }, 300); // Debounce for 300ms

    return () => clearTimeout(debounceTimer);
  }, [query, searchAgents]);

  // Filter items based on query (searches label, category, and keywords)
  const getFilteredItems = () => {
    if (query.trim()) {
      // Search mode - filter by query
      const pageResults = allItems.map(item => {
        const q = query.toLowerCase();
        const matchesLabel = item.label.toLowerCase().includes(q);
        const matchesCategory = item.category.toLowerCase().includes(q);
        const matchedKeyword = item.keywords?.find(kw => kw.toLowerCase().includes(q));
        
        if (matchesLabel || matchesCategory || matchedKeyword) {
          return { ...item, matchedKeyword: !matchesLabel && !matchesCategory ? matchedKeyword : null };
        }
        return null;
      }).filter(Boolean);

      // Add agent results to the filtered items
      const agentItems = agentResults.map(agent => ({
        category: 'Agents',
        label: agent.displayName || agent.lagnname || agent.rept_name || 'Unknown Agent',
        sublabel: agent.clname ? `${agent.clname} • ${agent.agtnum || 'No Agent #'}` : agent.agtnum,
        icon: <FiUser />,
        isAgent: true,
        agentData: {
          ...agent,
          searchQuery: query // Store the search query that found this agent
        }
      }));

      return [...agentItems, ...pageResults];
    }
    
    // No query - show personalized recommendations
    const items = [];
    
    // Add recent searches (if any)
    if (recentSearches.length > 0) {
      recentSearches.slice(0, 3).forEach(search => {
        items.push({
          category: 'Recent Searches',
          label: search.query,
          icon: <FiSearch />,
          isSearchHistory: true,
          searchQuery: search.query
        });
      });
      // Add clear option
      items.push({
        category: 'Recent Searches',
        label: 'Clear search history',
        icon: <FiTrash2 />,
        action: 'clearSearchHistory',
        className: 'clear-action'
      });
    }
    
    // Add recent pages (if any)
    if (recentPages.length > 0) {
      recentPages.slice(0, 3).forEach(page => {
        items.push({ ...page, category: 'Recent Pages' });
      });
    }
    
    // Add frequently visited (if any, and not already in recent)
    if (frequentPages.length > 0) {
      const recentPaths = new Set(recentPages.map(p => p.path));
      frequentPages
        .filter(page => !recentPaths.has(page.path))
        .slice(0, 3)
        .forEach(page => {
          items.push({ ...page, category: 'Recommended' });
        });
    }
    
    // If no history yet, show default suggestions
    if (items.length === 0) {
      return allItems.slice(0, 6);
    }
    
    // Add a few quick actions
    const quickActions = allItems.filter(item => item.category === 'Actions').slice(0, 2);
    quickActions.forEach(action => items.push(action));
    
    return items;
  };
  
  const filteredItems = getFilteredItems();

  // Group items by category (with custom order for recommendations)
  const categoryOrder = ['Agents', 'Recent Searches', 'Recent Pages', 'Recommended', 'History', 'Actions', 'Admin', 'Settings', 'Resources', 'Recruiting', 'Production', 'Dashboard', 'Pages'];
  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});
  
  // Sort categories by predefined order
  const sortedGroupedItems = Object.fromEntries(
    Object.entries(groupedItems).sort(([a], [b]) => {
      const indexA = categoryOrder.indexOf(a);
      const indexB = categoryOrder.indexOf(b);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    })
  );

  // Flatten for keyboard navigation
  const flatItems = filteredItems;

  // Click outside is now handled by backdrop onClick, so this listener is removed

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && flatItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(flatItems[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
    }
  };

  // Handle item selection
  const handleSelect = (item) => {
    // Log the search query if there was one
    if (query.trim().length >= 2) {
      logSearch(query);
    }
    
    // Handle agent profile click
    if (item.isAgent && item.agentData) {
      if (onOpenAgentProfile) {
        onOpenAgentProfile({
          ...item.agentData,
          __isAgentProfile: true
        });
      }
      setIsOpen(false);
      setQuery('');
      setAgentResults([]);
      return;
    }
    
    // Handle search history item click (re-run that search)
    if (item.isSearchHistory) {
      setQuery(item.searchQuery);
      return; // Don't close, let user see results
    }
    
    // Handle clear search history action
    if (item.action === 'clearSearchHistory') {
      clearSearchHistory();
      return;
    }
    
    if (item.action === 'toggleTheme') {
      toggleTheme();
    } else if (item.url) {
      // Handle external URLs or documents
      window.open(item.url, '_blank');
    } else if (item.path) {
      // Log navigation for recommendations
      logNavigation(item.path, item.label);
      navigate(item.path);
    }
    setIsOpen(false);
    setQuery('');
    setAgentResults([]);
  };

  // Toggle search open/close
  const handleToggle = () => {
    if (isOpen) {
      setIsOpen(false);
      setQuery('');
      setAgentResults([]);
    } else {
      setIsOpen(true);
    }
  };

  return (
    <div className={`global-search ${isOpen ? 'open' : ''}`} ref={containerRef}>
      <button 
        className="global-search-toggle"
        onClick={handleToggle}
        title="Search (Ctrl+K)"
      >
        {isOpen ? <FiX size={18} /> : <FiSearch size={18} />}
      </button>

      {isOpen && (
        // Use portal for both mobile and desktop to enable centered modal on desktop
        createPortal(
          <>
            <div className="global-search-backdrop" onClick={() => { setIsOpen(false); setQuery(''); }} />
            <div 
              className={`global-search-dropdown ${isMobile ? 'mobile-portal' : 'desktop-portal'}`}
              onClick={(e) => e.stopPropagation()}
            >
                <div className="global-search-input-wrapper">
                  <FiSearch className="global-search-icon" />
                  <input
                    ref={inputRef}
                    type="text"
                    className="global-search-input"
                    placeholder="Search pages, settings, actions, agents..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  {query && (
                    <button 
                      className="global-search-clear"
                      onClick={() => setQuery('')}
                    >
                      <FiX size={14} />
                    </button>
                  )}
                </div>

                <div className="global-search-results">
                  {Object.keys(sortedGroupedItems).length === 0 ? (
                    <div className="global-search-empty">
                      No results found for "{query}"
                    </div>
                  ) : (
                    Object.entries(sortedGroupedItems).map(([category, items]) => (
                      <div key={category} className="global-search-category">
                        <div className="global-search-category-label">
                          {category === 'Recent Searches' && <FiSearch size={12} />}
                          {category === 'Recent Pages' && <FiClock size={12} />}
                          {category === 'Recommended' && <FiStar size={12} />}
                          {category}
                        </div>
                        {items.map((item, idx) => {
                          const flatIndex = flatItems.indexOf(item);
                          return (
                            <div
                              key={`${category}-${idx}`}
                              className={`global-search-item ${flatIndex === selectedIndex ? 'selected' : ''} ${item.className || ''}`}
                              onClick={() => handleSelect(item)}
                              onMouseEnter={() => setSelectedIndex(flatIndex)}
                            >
                              <span className="global-search-item-icon">{item.icon}</span>
                              <div className="global-search-item-text">
                                <span className="global-search-item-label">{item.label}</span>
                                {item.sublabel && (
                                  <span className="global-search-item-match">{item.sublabel}</span>
                                )}
                                {item.matchedKeyword && !item.sublabel && (
                                  <span className="global-search-item-match">matches "{item.matchedKeyword}"</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>

                {!isMobile && (
                  <div className="global-search-footer">
                    <span><kbd>↑↓</kbd> navigate</span>
                    <span><kbd>↵</kbd> select</span>
                    <span><kbd>esc</kbd> close</span>
                  </div>
                )}
              </div>
            </>,
            document.body
          )
      )}
    </div>
  );
};

export default GlobalSearch;

