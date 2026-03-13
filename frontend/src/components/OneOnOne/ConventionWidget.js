import React, { useState } from 'react';
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

const ConventionWidget = ({
  conventionQualification,
  formatCurrency
}) => {
  const [requirementsExpanded, setRequirementsExpanded] = useState(false);

  // Helper function to determine if role has multiple qualification paths
  const hasMultipleQualificationPaths = (userRole) => {
    return ['SA', 'GA', 'MGA', 'RGA'].includes(userRole);
  };

  return (
    <div className="oneonone-section qualification-section">
      <div className="section-header">
        <h2>Convention Qualification</h2>
      </div>
      
      <div className="qualification-content">
        <div className="qualification-summary">
    
          
          <div className="qualification-details">
            
            {/* Qualification Paths - Show for multi-path roles */}
            {hasMultipleQualificationPaths(conventionQualification.userRole) && conventionQualification.qualificationPaths && conventionQualification.qualificationPaths.length > 0 && (
              <div className="qualification-paths-detail">
                <div className="paths-header">Qualification Paths:</div>
                {conventionQualification.qualificationPaths.map((path, index) => (
                  <div key={index} className={`path-item ${path.met ? 'met' : 'not-met'}`}>
                    <div className="path-name">
                      {path.met ? <FaCheckCircle className="path-icon success" /> : <FaTimesCircle className="path-icon error" />} {path.name}
                    </div>
                    <div className="path-progress">
                      {path.isCombined ? (
                        <div className="combined-progress">
                          <div className="combined-text">
                            {formatCurrency(path.current)} / {formatCurrency(path.required)}
                            {path.met && <span className="met-indicator"> (Met!)</span>}
                          </div>
                          <div className="segmented-progress-bar">
                            <div className="progress-segment-container">
                              <div 
                                className="progress-segment personal"
                                style={{ 
                                  width: `${Math.min(100, (path.personalPortion / path.required) * 100)}%`
                                }}
                                title={`Personal: ${formatCurrency(path.personalPortion)}`}
                              ></div>
                              <div 
                                className="progress-segment f6"
                                style={{ 
                                  width: `${Math.min(100 - Math.min(100, (path.personalPortion / path.required) * 100), (path.f6Portion / path.required) * 100)}%`
                                }}
                                title={`F6 Agent: ${formatCurrency(path.f6Portion)}`}
                              ></div>
                            </div>
                          </div>
                          <div className="segment-legend">
                            <span className="legend-item">
                              <span className="legend-color personal"></span>Personal: {formatCurrency(path.personalPortion)}
                            </span>
                            <span className="legend-item">
                              <span className="legend-color f6"></span>F6: {formatCurrency(path.f6Portion)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <>
                          {formatCurrency(path.current)} / {formatCurrency(path.required)}
                          {path.met && <span className="met-indicator"> (Met!)</span>}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Progress - Only show for single-path roles (AGT) */}
            {!hasMultipleQualificationPaths(conventionQualification.userRole) && (
              <div className="qualification-item">
                <span className="label">Progress:</span>
                <span className="value">
                  {formatCurrency(conventionQualification.currentAlp)} / {formatCurrency(conventionQualification.requiredAlp)}
                  {!conventionQualification.isQualified && (
                    <span className="remaining-amount"> ({formatCurrency(conventionQualification.remainingAlp)} remaining)</span>
                  )}
                </span>
              </div>
            )}
            
            {/* Requirements - Collapsible */}
            {conventionQualification.requirements && conventionQualification.requirements.length > 0 && (
              <div className="qualification-requirements">
                <div 
                  className="requirements-header collapsible" 
                  onClick={() => setRequirementsExpanded(!requirementsExpanded)}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <span>
                    {conventionQualification.requirements.length === 1 ? 'Requirement:' : 'Requirements:'} 
                    <span className="collapse-indicator" style={{ marginLeft: '0.5rem' }}>
                      {requirementsExpanded ? '▼' : '▶'}
                    </span>
                  </span>
                </div>
                {requirementsExpanded && (
                  <div className="requirements-content">
                    {conventionQualification.requirements.map((requirement, index) => (
                      <div key={index} className={`requirement-item ${conventionQualification.closestRequirementIndex === index ? 'closest' : ''}`}>
                        {requirement}
                      </div>
                    ))}
                    {conventionQualification.additionalRequirements && conventionQualification.additionalRequirements.length > 0 && (
                      conventionQualification.additionalRequirements.map((requirement, index) => (
                        <div key={`additional-${index}`} className="requirement-item additional">
                          {requirement}
                        </div>
                      ))
                    )}
                    <div className="requirements-footnote">
                      All the requirements in this document are based on December 31, 2025 reports.
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="qualification-item combined-info">
              <span className="label">Contract Info:</span>
              <span className="value">
                Hired: {conventionQualification.hireDate ? new Date(conventionQualification.hireDate).toLocaleDateString() : 'N/A'}
                <br />
                Duration: {conventionQualification.monthsContracted >= 12 ? '12+' : conventionQualification.monthsContracted} months
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConventionWidget;

