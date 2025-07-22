// Export utilities for report components

// Prepare report for PDF export by expanding all data and removing height restrictions
export const prepareForExport = async (
  setIsPreparedForExport,
  {
    leaderboardData = [],
    expandedLeaderboardData = {},
    handleExpandItem = null,
    showTeamAggregation = false,
    selectedFilterValue = 'all'
  } = {}
) => {
  setIsPreparedForExport(true);
  
  try {
    // Case 1: If we're showing team aggregation, expand all teams to show their members
    if (showTeamAggregation && selectedFilterValue === 'all' && leaderboardData.length > 0 && handleExpandItem) {
      
      // Expand all teams in leaderboard
      const expandPromises = leaderboardData.map(async (teamItem, index) => {
        const itemKey = `${teamItem.name}_${index}`;
        if (!expandedLeaderboardData[itemKey]) {
          await handleExpandItem(teamItem, itemKey);
        }
      });
      
      await Promise.all(expandPromises);
      
      // Wait for all expansions to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Case 2: For all scenarios, remove height restrictions to show all leaderboard entries
    // The maxHeight prop will be set to "none" when isPreparedForExport is true
    // This ensures all entries are visible regardless of the current view mode
    
    // Wait a bit more for DOM updates to complete, especially for large leaderboards
    await new Promise(resolve => setTimeout(resolve, 200));
    
  } catch (error) {
    console.error('Error preparing for export:', error);
    // Don't fail the export if preparation fails
  }
};

// Reset export preparation state
export const resetExportPreparation = (setIsPreparedForExport) => {
  setIsPreparedForExport(false);
  // Note: We don't collapse the leaderboard here to avoid jarring UX
  // The expanded state will remain for user convenience
};

// Create a reusable export function with reset capability
export const createExportFunction = (setIsPreparedForExport, config = {}) => {
  const exportFn = async () => {
    await prepareForExport(setIsPreparedForExport, config);
  };
  
  // Add reset function to the export function for Reports component to call
  exportFn.reset = () => resetExportPreparation(setIsPreparedForExport);
  
  return exportFn;
}; 