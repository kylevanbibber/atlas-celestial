import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'react-hot-toast';
import api from '../../../api';
import PipelineProgress from './PipelineProgress';
import PipelineSettings from './PipelineSettings';
import './Pipeline.css';

const Pipeline = () => {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState('progress'); // 'progress' | 'settings'
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Determine if user has admin/manager access to settings
  const canAccessSettings = user?.Role === 'Admin' || ['SA', 'GA', 'MGA', 'RGA'].includes(user?.clname);

  // Handle onboarding sync
  const handleSyncOnboarding = async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    const loadingToast = toast.loading('Syncing pending agents...');
    
    try {
      const response = await api.get('/pending-agent-sync/sync-all');
      
      if (response.data.success) {
        const { created, linked, skipped, errors } = response.data;
        
        toast.success(
          `Sync complete! ${created} created, ${linked} linked, ${skipped} skipped${errors > 0 ? `, ${errors} errors` : ''}`,
          { 
            id: loadingToast,
            duration: 5000 
          }
        );
        
        // Optionally refresh the pipeline view
        // You might want to trigger a refresh of PipelineProgress here
      } else {
        toast.error('Sync failed: ' + response.data.message, { id: loadingToast });
      }
    } catch (error) {
      console.error('Error syncing onboarding:', error);
      toast.error('Error syncing pending agents. Please try again.', { id: loadingToast });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div >
      {/* Header with navigation */}
      <div className="pipeline-header">
        <h1>Recruiting Pipeline</h1>
        
        <div className="pipeline-header-actions">
          {canAccessSettings && (
            <div className="pipeline-nav">
              <button
                className={activeView === 'progress' ? 'active' : ''}
                onClick={() => setActiveView('progress')}
              >
                Pipeline Progress
              </button>
              <button
                className={activeView === 'settings' ? 'active' : ''}
                onClick={() => setActiveView('settings')}
              >
                Settings
              </button>
            </div>
          )}
          
          {canAccessSettings && (
            <button
              className="sync-onboarding-btn"
              onClick={handleSyncOnboarding}
              disabled={isSyncing}
              title="Sync pending agents and create pipeline records with auto-completed checklists"
            >
              {isSyncing ? (
                <>
                  <span className="sync-spinner">⟳</span> Syncing...
                </>
              ) : (
                <>
                  🔄 Sync Onboarding
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="pipeline-content">
        {activeView === 'progress' ? (
          <PipelineProgress />
        ) : (
          <PipelineSettings />
        )}
      </div>
    </div>
  );
};

export default Pipeline;

