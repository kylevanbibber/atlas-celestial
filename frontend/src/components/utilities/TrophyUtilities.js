import React, { useContext, useState } from 'react';
import { TrophyCase } from '../widgets';
import ThemeContext from '../../context/ThemeContext';
import '../../pages/utilities/Utilities.css';

// Trophy Utilities page component
const TrophyUtilities = () => {
  const { theme } = useContext(ThemeContext);
  const [trophyView, setTrophyView] = useState('personal'); // 'personal' or 'team'
  
  return (
    <div className="settings-section">
      <div className="settings-header">
        <h1 className="settings-section-title">Trophy Case</h1>
        <div className="trophy-view-toggle-container">
          <div className="view-toggle">
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
          <p className="view-toggle-description">
            {trophyView === 'personal' ? 'View your personal production achievements' : 'View your team leadership achievements'}
          </p>
        </div>
      </div>
      
      <div className="settings-content">
        <div className={`trophy-settings-container ${theme}`}>
          <TrophyCase trophyView={trophyView} />
        </div>
      </div>
    </div>
  );
};

export default TrophyUtilities;
