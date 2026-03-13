import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import ScorecardTable from './ScorecardTable';
import ScorecardSGAView from './ScorecardSGAView';
import './Scorecard.css';

/**
 * ScorecardAlt - Alternative Scorecard Component for Other SGAs
 * 
 * This version shows Agency, MGA Breakdown, and RGA Breakdown all on one page
 * instead of using tabs to switch between them.
 * 
 * Each section has its own dropdown to select individual agencies or view "All".
 */
const ScorecardAlt = () => {
  // Get user data from auth context
  const { user } = useAuth();
  
  // Check if user is admin with teamRole="app" - treat as SGA
  const isAppAdmin = user?.Role === 'Admin' && user?.teamRole === 'app';
  
  // Use SGA role for app admins, otherwise use actual clname
  const userRole = isAppAdmin ? 'SGA' : user?.clname?.toUpperCase();
  
  const allowedRoles = ["MGA", "RGA", "SGA"];
  const showAllSections = allowedRoles.includes(userRole);
  
  // Independent state for each section's selected agency
  const [selectedMGA, setSelectedMGA] = useState('All');
  const [selectedRGA, setSelectedRGA] = useState('All');
  
  return (
    <div className="scorecard scorecard-alt">
      <style>{`
        .scorecard-alt {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }
        
        .scorecard-section {
          background: var(--card-background, #ffffff);
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .scorecard-section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 2px solid var(--border-color, #e0e0e0);
        }
        
        .scorecard-section-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--text-primary, #1a1a1a);
          margin: 0;
        }
        
        .scorecard-section-content {
          min-height: 400px;
        }
        
        @media (max-width: 768px) {
          .scorecard-alt {
            gap: 20px;
          }
          
          .scorecard-section {
            padding: 15px;
          }
          
          .scorecard-section-title {
            font-size: 1.25rem;
          }
        }
      `}</style>
      
      {showAllSections ? (
        <>
          {/* Agency Section */}
          <div className="scorecard-section">
            <div className="scorecard-section-header">
              <h2 className="scorecard-section-title">📊 Agency Overview</h2>
            </div>
            <div className="scorecard-section-content">
              <ScorecardTable userRole={userRole} activeTab="agency" />
            </div>
          </div>
          
          {/* MGA Breakdown Section */}
          <div className="scorecard-section">
            <div className="scorecard-section-header">
              <h2 className="scorecard-section-title">🏢 MGA Breakdown</h2>
            </div>
            <div className="scorecard-section-content">
              {selectedMGA !== 'All' ? (
                // Show specific MGA details with ScorecardTable
                <ScorecardTable 
                  key={`mga-${selectedMGA}`}
                  userRole={userRole} 
                  activeTab="mga"
                  selectedAgency={selectedMGA}
                  onSelectAgency={setSelectedMGA}
                />
              ) : (
                // Show all MGAs overview with ScorecardSGAView
                <ScorecardSGAView 
                  key="mga-all"
                  activeTab="mga"
                  selectedAgency={selectedMGA}
                  onSelectAgency={setSelectedMGA}
                />
              )}
            </div>
          </div>
          
          {/* RGA Breakdown Section */}
          <div className="scorecard-section">
            <div className="scorecard-section-header">
              <h2 className="scorecard-section-title">👥 RGA Breakdown</h2>
            </div>
            <div className="scorecard-section-content">
              {selectedRGA !== 'All' ? (
                // Show specific RGA details with ScorecardTable
                <ScorecardTable 
                  key={`rga-${selectedRGA}`}
                  userRole={userRole} 
                  activeTab="rga"
                  selectedAgency={selectedRGA}
                  onSelectAgency={setSelectedRGA}
                />
              ) : (
                // Show all RGAs overview with ScorecardSGAView
                <ScorecardSGAView 
                  key="rga-all"
                  activeTab="rga"
                  selectedAgency={selectedRGA}
                  onSelectAgency={setSelectedRGA}
                />
              )}
            </div>
          </div>
        </>
      ) : (
        // For non-SGA users, just show the agency view
        <div className="scorecard-section">
          <div className="scorecard-section-header">
            <h2 className="scorecard-section-title">📊 My Scorecard</h2>
          </div>
          <div className="scorecard-section-content">
            <ScorecardTable userRole={userRole} activeTab="agency" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ScorecardAlt;
