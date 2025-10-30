import React from 'react';
import './Pipeline.css';

const PipelineStageCard = ({ stage, count, active, onClick }) => {
  const darkenColor = (color) => {
    // Simple color darkening for gradient effect
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const factor = 0.8;
    
    const newR = Math.floor(r * factor);
    const newG = Math.floor(g * factor);
    const newB = Math.floor(b * factor);
    
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  };

  return (
    <div
      className={`pipeline-stage-card ${active ? 'active' : ''}`}
      onClick={onClick}
      style={{
        '--stage-color': stage.stage_color || '#3498db',
        '--stage-color-dark': darkenColor(stage.stage_color || '#3498db')
      }}
    >
      <div className="pipeline-stage-card-title">{stage.stage_name}</div>
      <div className="pipeline-stage-card-count">{count}</div>
      <div className="pipeline-stage-card-label">
        {count === 1 ? 'Recruit' : 'Recruits'}
      </div>
    </div>
  );
};

export default PipelineStageCard;

