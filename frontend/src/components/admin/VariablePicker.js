import React from 'react';
import './VariablePicker.css';

const VariablePicker = ({ variables, onSelect, onClose }) => {
  const categorizeVariables = () => {
    const categories = {
      'User Information': [],
      'Hierarchy': [],
      'Other': []
    };

    variables.forEach(variable => {
      if (['lagnname', 'email', 'phone'].includes(variable.variable_key)) {
        categories['User Information'].push(variable);
      } else if (['clname', 'esid', 'teamRole'].includes(variable.variable_key)) {
        categories['Hierarchy'].push(variable);
      } else {
        categories['Other'].push(variable);
      }
    });

    return categories;
  };

  const categories = categorizeVariables();

  return (
    <div className="variable-picker-overlay" onClick={onClose}>
      <div className="variable-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Insert Variable</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <p className="helper-text">
            Click on a variable to insert it at the cursor position
          </p>
          
          {Object.entries(categories).map(([category, vars]) => {
            if (vars.length === 0) return null;
            
            return (
              <div key={category} className="variable-category">
                <h4>{category}</h4>
                <div className="variable-list">
                  {vars.map(variable => (
                    <div
                      key={variable.id}
                      className="variable-item"
                      onClick={() => onSelect(variable.variable_key)}
                    >
                      <div className="variable-key">
                        {`{{${variable.variable_key}}}`}
                      </div>
                      <div className="variable-name">
                        {variable.variable_name}
                      </div>
                      {variable.description && (
                        <div className="variable-description">
                          {variable.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default VariablePicker;


