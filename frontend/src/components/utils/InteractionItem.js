import React from 'react';
import { DateTime } from 'luxon';

const InteractionItem = ({ interaction, onDelete }) => {
  const date = new Date(interaction.created_at);
  const formattedDate = DateTime.fromJSDate(date).toFormat('MM/dd/yy h:mm a');

  return (
    <div className="interaction-item">
      <div className="interaction-header">
        <span className="interaction-type">{interaction.interaction_type}</span>
        <span className="interaction-date">{formattedDate}</span>
        <button
          className="delete-button"
          onClick={() => onDelete(interaction.id)}
          style={{
            background: 'none',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
            padding: '4px 8px',
            fontSize: '12px'
          }}
        >
          ×
        </button>
      </div>
      <div className="interaction-content">
        {interaction.notes}
      </div>
    </div>
  );
};

export default InteractionItem; 