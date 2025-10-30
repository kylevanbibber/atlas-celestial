import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const HIERARCHY_CACHE_KEY = 'user_hierarchy_cache';
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * Custom hook for managing cached user hierarchy data
 * @returns {object} { hierarchyData, hierarchyLoading, refreshHierarchy, isCacheValid }
 */
export const useUserHierarchy = () => {
  const { user } = useAuth();
  const [hierarchyData, setHierarchyData] = useState(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  
  // Check if cached data is still valid
  const isCacheValid = useCallback(() => {
    try {
      const cached = sessionStorage.getItem(HIERARCHY_CACHE_KEY);
      if (!cached) return false;
      
      const parsedCache = JSON.parse(cached);
      const now = Date.now();
      
      return (
        parsedCache.userId === user?.userId &&
        parsedCache.timestamp &&
        (now - parsedCache.timestamp) < CACHE_DURATION
      );
    } catch (error) {
      console.warn('[useUserHierarchy] Cache validation error:', error);
      return false;
    }
  }, [user?.userId]);

  // Get cached data
  const getCachedData = useCallback(() => {
    try {
      const cached = sessionStorage.getItem(HIERARCHY_CACHE_KEY);
      if (!cached) return null;
      
      const parsedCache = JSON.parse(cached);
      return parsedCache.data;
    } catch (error) {
      console.warn('[useUserHierarchy] Cache retrieval error:', error);
      return null;
    }
  }, []);

  // Set cached data
  const setCachedData = useCallback((data) => {
    try {
      const cacheObject = {
        userId: user?.userId,
        timestamp: Date.now(),
        data: data
      };
      sessionStorage.setItem(HIERARCHY_CACHE_KEY, JSON.stringify(cacheObject));
      console.log(`[useUserHierarchy] 💾 Cached hierarchy data for ${user?.lagnname || 'unknown user'} in session storage`);
    } catch (error) {
      console.warn('[useUserHierarchy] ❌ Failed to cache data:', error);
    }
  }, [user?.userId, user?.lagnname]);

  // Fetch hierarchy data from API
  const fetchHierarchy = useCallback(async (forceRefresh = false) => {
    if (!user?.userId) {
      setHierarchyData(null);
      return null;
    }

    // Check cache first (unless forcing refresh)
    if (!forceRefresh && isCacheValid()) {
      const cached = getCachedData();
      if (cached) {
        setHierarchyData(cached);
        
        // 📊 DETAILED CACHE USAGE LOGGING
        console.group(`[useUserHierarchy] 📋 Using Cached Hierarchy for ${user.lagnname}`);
        console.log('🕐 Cache Age:', Math.round((Date.now() - cached.lastFetched) / 1000 / 60), 'minutes old');
        console.log('👥 Team Count:', cached.teamIds?.length || 0);
        console.log('📝 Team Names:', cached.teamNames || []);
        console.log('🆔 All IDs:', cached.allIds || []);
        console.log('📄 All Names:', cached.allNames || []);
        console.log('⏰ Last Fetched:', new Date(cached.lastFetched).toLocaleString());
        console.log('💾 Cache Data Structure:', {
          hasRaw: !!cached.raw,
          teamIdsCount: cached.teamIds?.length || 0,
          teamNamesCount: cached.teamNames?.length || 0,
          allIdsCount: cached.allIds?.length || 0,
          allNamesCount: cached.allNames?.length || 0
        });
        console.groupEnd();
        
        return cached;
      }
    }

    setHierarchyLoading(true);
    try {
      console.log(`[useUserHierarchy] 🔄 Fetching fresh hierarchy for ${user.lagnname}...`);
      const resp = await api.post('/auth/searchByUserId', { userId: user.userId });
      
      if (resp.data?.success) {
        const hierarchy = Array.isArray(resp.data.data) ? resp.data.data : [];
        
        // Prepare hierarchy data for caching
        const hierarchyInfo = {
          raw: hierarchy,
          teamIds: hierarchy.map(u => u.id).filter(Boolean),
          teamNames: hierarchy.map(u => u.lagnname).filter(Boolean),
          allIds: [user.userId, ...hierarchy.map(u => u.id).filter(Boolean)],
          allNames: [user.lagnname, ...hierarchy.map(u => u.lagnname).filter(Boolean)].filter(Boolean),
          lastFetched: Date.now()
        };

        // Cache the data
        setCachedData(hierarchyInfo);
        setHierarchyData(hierarchyInfo);
        
        // 📊 DETAILED FRESH FETCH LOGGING
        console.group(`[useUserHierarchy] ✅ Fetched and Cached Fresh Hierarchy for ${user.lagnname}`);
        console.log('🔄 Fetch Reason:', forceRefresh ? 'Force Refresh' : 'Cache Expired/Missing');
        console.log('👥 Team Members Found:', hierarchyInfo.teamIds.length);
        console.log('📝 Team Names:', hierarchyInfo.teamNames);
        console.log('🆔 All Accessible IDs:', hierarchyInfo.allIds);
        console.log('📄 All Accessible Names:', hierarchyInfo.allNames);
        console.log('⏰ Cached At:', new Date().toLocaleString());
        console.log('🗃️ Raw Hierarchy Response:', hierarchyInfo.raw);
        console.log('💾 Cache Structure Created:', {
          rawCount: hierarchyInfo.raw.length,
          teamIdsCount: hierarchyInfo.teamIds.length,
          teamNamesCount: hierarchyInfo.teamNames.length,
          allIdsCount: hierarchyInfo.allIds.length,
          allNamesCount: hierarchyInfo.allNames.length,
          includesCurrentUser: hierarchyInfo.allIds.includes(user.userId)
        });
        console.log('⏳ Next Auto-Refresh In:', `${CACHE_DURATION / 1000 / 60} minutes`);
        console.groupEnd();
        
        return hierarchyInfo;
      } else {
        console.warn(`[useUserHierarchy] ⚠️ API returned unsuccessful response for ${user.lagnname}`);
        const emptyHierarchy = {
          raw: [],
          teamIds: [],
          teamNames: [],
          allIds: [user.userId],
          allNames: [user.lagnname].filter(Boolean),
          lastFetched: Date.now()
        };
        setHierarchyData(emptyHierarchy);
        setCachedData(emptyHierarchy);
        return emptyHierarchy;
      }
    } catch (error) {
      console.warn('[useUserHierarchy] Failed to fetch hierarchy:', error);
      const errorHierarchy = {
        raw: [],
        teamIds: [],
        teamNames: [],
        allIds: user.userId ? [user.userId] : [],
        allNames: [user.lagnname].filter(Boolean),
        lastFetched: Date.now()
      };
      setHierarchyData(errorHierarchy);
      return errorHierarchy;
    } finally {
      setHierarchyLoading(false);
    }
  }, [user?.userId, user?.lagnname, isCacheValid, getCachedData, setCachedData]);

  // Refresh hierarchy data (force fetch)
  const refreshHierarchy = useCallback(() => {
    console.log(`[useUserHierarchy] 🔄 Force refreshing hierarchy for ${user.lagnname}`);
    return fetchHierarchy(true);
  }, [fetchHierarchy, user?.lagnname]);

  // Auto-fetch on mount and when user changes
  useEffect(() => {
    // Check if data is already cached from login before fetching
    if (user?.userId && isCacheValid()) {
      const cached = getCachedData();
      if (cached) {
        setHierarchyData(cached);
        
        // 📊 PRELOAD SUCCESS LOGGING
        console.group(`[useUserHierarchy] 🚀 Using Pre-Cached Hierarchy for ${user.lagnname}`);
        console.log('⚡ Performance Boost: Data was preloaded at login!');
        console.log('🕐 Cache Age:', Math.round((Date.now() - cached.lastFetched) / 1000 / 60), 'minutes old');
        console.log('👥 Team Count:', cached.teamIds?.length || 0);
        console.log('📄 All Names:', cached.allNames || []);
        console.log('🎯 No API call needed - instant component load');
        console.log('🛠️ Debug commands: window.__USER_HIERARCHY_DEBUG__');
        console.groupEnd();
        return;
      }
    }
    
    // If not cached or invalid, fetch fresh data
    fetchHierarchy();
    
    // Announce debug availability on first mount
    if (user?.lagnname) {
      console.log(`[useUserHierarchy] 🚀 Hierarchy caching initialized for ${user.lagnname}. Debug commands available via window.__USER_HIERARCHY_DEBUG__`);
    }
  }, [fetchHierarchy, user?.lagnname, user?.userId, isCacheValid, getCachedData]);

  // Expose debug functions to window for console access
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__USER_HIERARCHY_DEBUG__ = {
        logCacheStatus: () => {
          console.group('[useUserHierarchy] 🔍 Global Cache Status Check');
          console.log('👤 Current User:', user?.lagnname || 'No user');
          console.log('🆔 User ID:', user?.userId || 'No user ID');
          console.log('💾 Has Cached Data:', !!hierarchyData);
          console.log('⏳ Is Loading:', hierarchyLoading);
          console.log('✅ Cache Valid:', isCacheValid());
          
          if (hierarchyData) {
            console.log('📊 Cache Data:', {
              lastFetched: new Date(hierarchyData.lastFetched).toLocaleString(),
              ageInMinutes: Math.round((Date.now() - hierarchyData.lastFetched) / 1000 / 60),
              teamCount: hierarchyData.teamIds?.length || 0,
              totalAccessibleUsers: hierarchyData.allIds?.length || 0,
              teamNames: hierarchyData.teamNames,
              allNames: hierarchyData.allNames,
              fullDataStructure: hierarchyData
            });
          }
          
          // Check session storage directly
          try {
            const stored = sessionStorage.getItem(HIERARCHY_CACHE_KEY);
            if (stored) {
              const parsed = JSON.parse(stored);
              console.log('🗄️ Session Storage Direct Access:', parsed);
            } else {
              console.log('🗄️ Session Storage: Empty');
            }
          } catch (error) {
            console.log('🗄️ Session Storage Error:', error);
          }
          
          console.log('🔧 Available Debug Commands:');
          console.log('  window.__USER_HIERARCHY_DEBUG__.logCacheStatus() - Show this info');
          console.log('  window.__USER_HIERARCHY_DEBUG__.clearCache() - Clear cache manually');
          console.log('  window.__USER_HIERARCHY_DEBUG__.refreshCache() - Force refresh cache');
          console.groupEnd();
        },
        clearCache: () => {
          try {
            sessionStorage.removeItem(HIERARCHY_CACHE_KEY);
            console.log('[useUserHierarchy] 🗑️ Manually cleared hierarchy cache');
          } catch (error) {
            console.error('[useUserHierarchy] ❌ Failed to clear cache:', error);
          }
        },
        refreshCache: refreshHierarchy,
        getCachedData: () => {
          try {
            const stored = sessionStorage.getItem(HIERARCHY_CACHE_KEY);
            return stored ? JSON.parse(stored) : null;
          } catch {
            return null;
          }
        }
      };
    }
  }, [user, hierarchyData, hierarchyLoading, isCacheValid, refreshHierarchy]);

  // Cleanup debug functions on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        delete window.__USER_HIERARCHY_DEBUG__;
      }
    };
  }, []);

  // Clear cache on logout (when user becomes null)
  useEffect(() => {
    if (!user) {
      try {
        const hadCachedData = !!sessionStorage.getItem(HIERARCHY_CACHE_KEY);
        sessionStorage.removeItem(HIERARCHY_CACHE_KEY);
        if (hadCachedData) {
          console.log('[useUserHierarchy] 🗑️ Cleared hierarchy cache on logout');
        }
      } catch (error) {
        console.warn('[useUserHierarchy] ❌ Failed to clear cache:', error);
      }
      setHierarchyData(null);
    }
  }, [user]);

  // Provide a method to get specific data formats that components need
  const getHierarchyForComponent = useCallback((format = 'names') => {
    if (!hierarchyData) {
      console.log(`[useUserHierarchy] 📋 Component requested '${format}' but no hierarchy data available`);
      return [];
    }
    
    let result;
    switch (format) {
      case 'names':
        result = hierarchyData.allNames;
        break;
      case 'ids': 
        result = hierarchyData.allIds;
        break;
      case 'teamIds':
        result = hierarchyData.teamIds;
        break;
      case 'teamNames':
        result = hierarchyData.teamNames;
        break;
      case 'raw':
        result = hierarchyData.raw;
        break;
      default:
        result = hierarchyData.allNames;
        console.warn(`[useUserHierarchy] ⚠️ Unknown format '${format}' requested, defaulting to 'names'`);
    }
    
    console.log(`[useUserHierarchy] 📤 Component requested '${format}' format:`, {
      format: format,
      resultCount: Array.isArray(result) ? result.length : (result ? 1 : 0),
      result: result,
      cacheAge: hierarchyData.lastFetched ? `${Math.round((Date.now() - hierarchyData.lastFetched) / 1000 / 60)}min` : 'unknown'
    });
    
    return result;
  }, [hierarchyData]);

  // Debug function to log current cache status
  const logCacheStatus = useCallback(() => {
    console.group('[useUserHierarchy] 🔍 Current Cache Status');
    console.log('👤 Current User:', user?.lagnname || 'No user');
    console.log('🆔 User ID:', user?.userId || 'No user ID');
    console.log('💾 Has Cached Data:', !!hierarchyData);
    console.log('⏳ Is Loading:', hierarchyLoading);
    console.log('✅ Cache Valid:', isCacheValid());
    
    if (hierarchyData) {
      console.log('📊 Cache Data:', {
        lastFetched: new Date(hierarchyData.lastFetched).toLocaleString(),
        ageInMinutes: Math.round((Date.now() - hierarchyData.lastFetched) / 1000 / 60),
        teamCount: hierarchyData.teamIds?.length || 0,
        totalAccessibleUsers: hierarchyData.allIds?.length || 0,
        teamNames: hierarchyData.teamNames,
        allNames: hierarchyData.allNames
      });
    } else {
      console.log('📭 No cached data available');
    }
    
    // Check session storage directly
    try {
      const stored = sessionStorage.getItem(HIERARCHY_CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        console.log('🗄️ Session Storage:', {
          exists: true,
          userId: parsed.userId,
          timestamp: new Date(parsed.timestamp).toLocaleString(),
          ageInMinutes: Math.round((Date.now() - parsed.timestamp) / 1000 / 60)
        });
      } else {
        console.log('🗄️ Session Storage: No data found');
      }
    } catch (error) {
      console.log('🗄️ Session Storage: Error reading -', error.message);
    }
    
    console.groupEnd();
  }, [user, hierarchyData, hierarchyLoading, isCacheValid]);

  return {
    hierarchyData,
    hierarchyLoading,
    refreshHierarchy,
    isCacheValid: isCacheValid(),
    getHierarchyForComponent,
    logCacheStatus
  };
};

export default useUserHierarchy;
