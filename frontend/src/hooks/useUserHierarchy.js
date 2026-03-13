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
  const [loadingStages, setLoadingStages] = useState({
    structure: false,
    licenses: false,
    pnp: false
  });

  // 🔧 CLEAR CACHE ON MOUNT (for debugging)
  useEffect(() => {
    console.log('🔧 [DEBUG] Clearing hierarchy cache for debugging');
    sessionStorage.removeItem(HIERARCHY_CACHE_KEY);
  }, []); // Only run once on mount
  
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

  // Helper to check if data has licenses/PNP
  const checkDataCompleteness = useCallback((data) => {
    if (!data?.raw || data.raw.length === 0) {
      return { licensesLoaded: false, pnpLoaded: false };
    }

    // Check if at least one user has licenses data
    const hasLicenses = data.raw.some(u => u.licenses !== undefined && u.licenses !== null);
    
    // Check if at least one user has PNP data
    const hasPnp = data.raw.some(u => u.pnp_data !== undefined && u.pnp_data !== null);

    return {
      licensesLoaded: hasLicenses || data.licensesLoaded === true,
      pnpLoaded: hasPnp || data.pnpLoaded === true
    };
  }, []);

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

  // ⚡ PROGRESSIVE LOADING: Fetch hierarchy data in stages for faster initial render
  const fetchHierarchy = useCallback(async (forceRefresh = false) => {
    if (!user?.userId) {
      setHierarchyData(null);
      return null;
    }

    // 🔧 CACHE TEMPORARILY DISABLED FOR DEBUGGING
    console.log(`🔧 [DEBUG] Cache disabled - forcing fresh fetch`);

    setHierarchyLoading(true);
    const startTime = Date.now();
    
    try {
      // 🚀 STAGE 1: Fetch basic hierarchy structure (fastest - no JOINs to licenses/PNP)
      console.log(`\n⏱️ [FRONTEND] Progressive Loading Started at ${new Date().toLocaleTimeString()}`);
      console.log(`🚀 [FRONTEND Stage 1/3] Fetching hierarchy structure for ${user.lagnname}...`);
      setLoadingStages({ structure: true, licenses: false, pnp: false });
      
      const stage1RequestStart = Date.now();
      const isStaff = user.teamRole === 'app' ||
        ['Admin', 'SuperAdmin'].includes(user.Role) ||
        ['SA', 'GA', 'MGA', 'RGA', 'SGA'].includes(user.clname);
      const resp = await api.post('/auth/searchByUserId', { userId: user.userId, includeInactive: isStaff });
      const stage1NetworkTime = Date.now() - stage1RequestStart;
      const stage1Time = Date.now() - startTime;
      
      const backendTime = resp.data?._timing?.backendMs || 'unknown';
      const networkTime = stage1NetworkTime - (typeof backendTime === 'number' ? backendTime : 0);
      
      console.log(`✅ [FRONTEND Stage 1/3] Response received after ${stage1NetworkTime}ms`);
      console.log(`   ⏱️  Backend processing: ${backendTime}ms`);
      console.log(`   ⏱️  Network latency: ${networkTime}ms`);
      console.log(`   ⏱️  Total elapsed: ${stage1Time}ms`);
      
      if (!resp.data?.success) {
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
        // setCachedData(emptyHierarchy); // 🔧 CACHE DISABLED
        setHierarchyLoading(false);
        setLoadingStages({ structure: false, licenses: false, pnp: false });
        return emptyHierarchy;
      }
      
      const hierarchy = Array.isArray(resp.data.data) ? resp.data.data : [];
      
      // Prepare initial hierarchy data (structure only)
      const hierarchyInfo = {
        raw: hierarchy,
        teamIds: hierarchy.map(u => u.id).filter(Boolean),
        teamNames: hierarchy.map(u => u.lagnname).filter(Boolean),
        allIds: [user.userId, ...hierarchy.map(u => u.id).filter(Boolean)],
        allNames: [user.lagnname, ...hierarchy.map(u => u.lagnname).filter(Boolean)].filter(Boolean),
        lastFetched: Date.now(),
        licensesLoaded: false,
        pnpLoaded: false
      };

      // 🎯 Set initial data immediately - UI can render with basic info now!
      const renderStart = Date.now();
      setHierarchyData(hierarchyInfo);
      setLoadingStages({ structure: false, licenses: true, pnp: false });
      const renderTime = Date.now() - renderStart;
      
      console.log(`🎨 [FRONTEND Stage 1/3] UI rendering triggered after ${renderTime}ms`);
      console.log(`   👥 ${hierarchyInfo.teamIds.length} team members ready to display`);
      console.log(`   🔍 Hierarchy structure:`, {
        totalUsers: hierarchyInfo.raw.length,
        allIds: hierarchyInfo.allIds,
        sampleUser: hierarchyInfo.raw[0]
      });
      console.log(`   ⏱️  Time to interactive: ${stage1Time + renderTime}ms\n`);
      
      // 🚀 STAGE 2: Fetch licenses in parallel (doesn't block UI)
      console.log(`🚀 [FRONTEND Stage 2/3] Fetching licenses for ${hierarchyInfo.allIds.length} users...`);
      console.log(`   📤 Request payload:`, { userIds: hierarchyInfo.allIds });
      const stage2RequestStart = Date.now();
      
      api.post('/auth/hierarchy/licenses', { userIds: hierarchyInfo.allIds })
        .then(licenseResp => {
          console.log(`   📥 License response received:`, licenseResp.data);
          const stage2NetworkTime = Date.now() - stage2RequestStart;
          const stage2Time = Date.now() - startTime;
          
          const backendTime = licenseResp.data?._timing?.backendMs || 'unknown';
          const networkTime = stage2NetworkTime - (typeof backendTime === 'number' ? backendTime : 0);
          
          console.log(`✅ [FRONTEND Stage 2/3] Response received after ${stage2NetworkTime}ms`);
          console.log(`   ⏱️  Backend processing: ${backendTime}ms`);
          console.log(`   ⏱️  Network latency: ${networkTime}ms`);
          console.log(`   ⏱️  Total elapsed since start: ${stage2Time}ms`);
          
          if (licenseResp.data?.success && licenseResp.data.data) {
            // Merge licenses into hierarchy data
            const updatedRaw = hierarchyInfo.raw.map(user => ({
              ...user,
              licenses: licenseResp.data.data[user.id] || []
            }));
            
            const updatedHierarchyInfo = {
              ...hierarchyInfo,
              raw: updatedRaw,
              licensesLoaded: true
            };
            
            const licenseRenderStart = Date.now();
            setHierarchyData(updatedHierarchyInfo);
            setLoadingStages(prev => ({ ...prev, licenses: false, pnp: true }));
            const licenseRenderTime = Date.now() - licenseRenderStart;
            
            console.log(`🎨 [FRONTEND Stage 2/3] UI updated with licenses after ${licenseRenderTime}ms`);
            console.log(`   📜 ${Object.keys(licenseResp.data.data).length} users have license data\n`);
            
            // 🚀 STAGE 3: Fetch PNP data in parallel (doesn't block UI)
            console.log(`🚀 [FRONTEND Stage 3/3] Fetching PNP data for ${hierarchyInfo.allIds.length} users...`);
            const pnpPayload = { 
              users: hierarchyInfo.raw.map(u => ({ id: u.id, lagnname: u.lagnname, esid: u.esid }))
            };
            console.log(`   📤 Request payload:`, pnpPayload);
            const stage3RequestStart = Date.now();
            
            api.post('/auth/hierarchy/pnp', pnpPayload)
              .then(pnpResp => {
                console.log(`   📥 PNP response received:`, pnpResp.data);
                const stage3NetworkTime = Date.now() - stage3RequestStart;
                const stage3Time = Date.now() - startTime;
                
                const backendTime = pnpResp.data?._timing?.backendMs || 'unknown';
                const networkTime = stage3NetworkTime - (typeof backendTime === 'number' ? backendTime : 0);
                
                console.log(`✅ [FRONTEND Stage 3/3] Response received after ${stage3NetworkTime}ms`);
                console.log(`   ⏱️  Backend processing: ${backendTime}ms`);
                console.log(`   ⏱️  Network latency: ${networkTime}ms`);
                console.log(`   ⏱️  Total elapsed since start: ${stage3Time}ms`);
                
                if (pnpResp.data?.success && pnpResp.data.data) {
                  // Merge PNP data into hierarchy
                  const finalRaw = updatedRaw.map(user => ({
                    ...user,
                    pnp_data: pnpResp.data.data[user.id] || null
                  }));
                  
                  const finalHierarchyInfo = {
                    ...updatedHierarchyInfo,
                    raw: finalRaw,
                    pnpLoaded: true
                  };
                  
                  // Cache the complete data
                  const pnpRenderStart = Date.now();
                  // setCachedData(finalHierarchyInfo); // 🔧 CACHE DISABLED
                  setHierarchyData(finalHierarchyInfo);
                  setLoadingStages({ structure: false, licenses: false, pnp: false });
                  const pnpRenderTime = Date.now() - pnpRenderStart;
                  
                  console.log(`🎨 [FRONTEND Stage 3/3] UI updated with PNP data after ${pnpRenderTime}ms`);
                  console.log(`   📊 ${Object.keys(pnpResp.data.data).length} users have PNP data`);
                  console.log(`   💾 Complete hierarchy cached\n`);
                  
                  console.group(`🎉 [FRONTEND] Progressive Loading Complete!`);
                  console.log('⏱️  Performance Breakdown:');
                  console.log(`   Stage 1 (Structure):  ${stage1Time}ms → UI rendered at ${stage1Time}ms`);
                  console.log(`   Stage 2 (Licenses):   ${stage2Time - stage1Time}ms → UI updated at ${stage2Time}ms`);
                  console.log(`   Stage 3 (PNP):        ${stage3Time - stage2Time}ms → UI updated at ${stage3Time}ms`);
                  console.log(`   ─────────────────────────────────────────`);
                  console.log(`   Total Time: ${stage3Time}ms`);
                  console.log(`   Time to Interactive: ${stage1Time}ms ⚡`);
                  console.log(`   User Perceived Speed: ${Math.round((1 - stage1Time / stage3Time) * 100)}% faster!`);
                  console.groupEnd();
                } else {
                  console.warn('[useUserHierarchy] ⚠️ PNP fetch unsuccessful, using data without PNP');
                  console.warn('   Response:', pnpResp);
                  // setCachedData(updatedHierarchyInfo); // 🔧 CACHE DISABLED
                  setLoadingStages({ structure: false, licenses: false, pnp: false });
                }
              })
              .catch(pnpError => {
                console.error('[useUserHierarchy] ❌ PNP fetch failed:', pnpError);
                console.error('   Error details:', {
                  message: pnpError.message,
                  response: pnpError.response?.data,
                  status: pnpError.response?.status
                });
                // setCachedData(updatedHierarchyInfo); // 🔧 CACHE DISABLED
                setLoadingStages({ structure: false, licenses: false, pnp: false });
              });
              
          } else {
            console.warn('[useUserHierarchy] ⚠️ License fetch unsuccessful, using data without licenses');
            console.warn('   Response:', licenseResp);
            // setCachedData(hierarchyInfo); // 🔧 CACHE DISABLED
            setLoadingStages({ structure: false, licenses: false, pnp: false });
          }
        })
        .catch(licenseError => {
          console.error('[useUserHierarchy] ❌ License fetch failed:', licenseError);
          console.error('   Error details:', {
            message: licenseError.message,
            response: licenseError.response?.data,
            status: licenseError.response?.status
          });
          // setCachedData(hierarchyInfo); // 🔧 CACHE DISABLED
          setLoadingStages({ structure: false, licenses: false, pnp: false });
        });
      
      // Return the initial structure data immediately
      return hierarchyInfo;
      
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
      setLoadingStages({ structure: false, licenses: false, pnp: false });
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
    loadingStages, // ⚡ NEW: Exposes loading progress for progressive rendering
    refreshHierarchy,
    isCacheValid: isCacheValid(),
    getHierarchyForComponent,
    logCacheStatus
  };
};

export default useUserHierarchy;
