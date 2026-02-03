/**
 * Org Metrics Breakdown Modal Component
 * Displays detailed breakdown of org metrics by MGA/agent
 */

import React, { useContext } from 'react';
import ThemeContext from '../../context/ThemeContext';
import { formatNumber } from '../../utils/dashboardHelpers';

const OrgMetricsBreakdownModal = ({ 
  showBreakdownModal, 
  setShowBreakdownModal, 
  breakdownData,
  refSalesBreakdown,
  timePeriod 
}) => {
  const { theme } = useContext(ThemeContext);

  if (!showBreakdownModal) {
    return null;
  }

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}
      onClick={() => setShowBreakdownModal(false)}
    >
      <div 
        style={{
          background: theme === 'dark' ? '#1e1e1e' : 'white',
          color: theme === 'dark' ? '#f0f0f0' : '#000',
          borderRadius: '8px',
          padding: '1.5rem',
          maxWidth: '800px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: theme === 'dark' ? '0 4px 6px rgba(0, 0, 0, 0.4)' : '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: theme === 'dark' ? '#f0f0f0' : '#000' }}>
            Org Metrics Breakdown
          </h3>
          <button
            onClick={() => setShowBreakdownModal(false)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: theme === 'dark' ? '#aaa' : '#666'
            }}
          >
            ×
          </button>
        </div>
        
        <div style={{ marginBottom: '1rem', color: theme === 'dark' ? '#aaa' : '#666', fontSize: '0.875rem' }}>
          {breakdownData.length} {breakdownData.length === 1 ? 'MGA' : 'MGAs'} • {
            timePeriod === 'thisMonth' ? 'This Month' :
            timePeriod === 'lastMonth' ? 'Last Month' :
            timePeriod === 'ytd' ? 'Year-to-Date' : 'Current Period'
          }
        </div>

        {breakdownData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: theme === 'dark' ? '#888' : '#999' }}>
            No data available
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ 
                  borderBottom: theme === 'dark' ? '2px solid #444' : '2px solid #ddd', 
                  background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa'
                }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: theme === 'dark' ? '#f0f0f0' : '#000' }}>MGA</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: theme === 'dark' ? '#f0f0f0' : '#000' }}>Hires</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: theme === 'dark' ? '#f0f0f0' : '#000' }}>Codes</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: theme === 'dark' ? '#f0f0f0' : '#000' }}>VIPs</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: theme === 'dark' ? '#f0f0f0' : '#000' }}>Ref Sales</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const grouped = {};
                  const selfRows = [];
                  const directMGAs = [];
                  
                  breakdownData.forEach(row => {
                    if (row.isSelf) {
                      selfRows.push(row);
                    } else if (row.isFirstYearRollup && row.uplineMGA) {
                      if (!grouped[row.uplineMGA]) {
                        grouped[row.uplineMGA] = [];
                      }
                      grouped[row.uplineMGA].push(row);
                    } else {
                      directMGAs.push(row);
                    }
                  });
                  
                  directMGAs.sort((a, b) => {
                    const totalA = a.hires + a.codes + a.vips + (a.refSales || 0);
                    const totalB = b.hires + b.codes + b.vips + (b.refSales || 0);
                    return totalB - totalA;
                  });
                  
                  const displayRows = [];
                  let rowIndex = 0;
                  
                  selfRows.forEach(row => {
                    displayRows.push(
                      <tr 
                        key={`self-${rowIndex}`}
                        style={{ 
                          borderBottom: theme === 'dark' ? '1px solid #444' : '1px solid #eee',
                          background: rowIndex % 2 === 0 ? (theme === 'dark' ? '#1e1e1e' : 'white') : (theme === 'dark' ? '#2a2a2a' : '#f8f9fa'),
                          fontWeight: '600',
                          color: theme === 'dark' ? '#f0f0f0' : '#000'
                        }}
                      >
                        <td style={{ padding: '0.75rem' }}>{row.lagnname} (You)</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatNumber(row.hires)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatNumber(row.codes)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatNumber(row.vips)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatNumber(row.refSales || 0)}</td>
                      </tr>
                    );
                    rowIndex++;
                  });
                  
                  directMGAs.forEach(mga => {
                    displayRows.push(
                      <tr 
                        key={`mga-${rowIndex}`}
                        style={{ 
                          borderBottom: theme === 'dark' ? '1px solid #444' : '1px solid #eee',
                          background: rowIndex % 2 === 0 ? (theme === 'dark' ? '#1e1e1e' : 'white') : (theme === 'dark' ? '#2a2a2a' : '#f8f9fa'),
                          color: theme === 'dark' ? '#f0f0f0' : '#000'
                        }}
                      >
                        <td style={{ padding: '0.75rem', fontWeight: '500' }}>{mga.lagnname}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatNumber(mga.hires)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatNumber(mga.codes)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatNumber(mga.vips)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatNumber(mga.refSales || 0)}</td>
                      </tr>
                    );
                    rowIndex++;
                    
                    const rollups = grouped[mga.lagnname] || [];
                    rollups.forEach(rollup => {
                      displayRows.push(
                        <tr 
                          key={`rollup-${rowIndex}`}
                          style={{ 
                            borderBottom: theme === 'dark' ? '1px solid #444' : '1px solid #eee',
                            background: rowIndex % 2 === 0 ? (theme === 'dark' ? '#1e1e1e' : 'white') : (theme === 'dark' ? '#2a2a2a' : '#f8f9fa')
                          }}
                        >
                          <td style={{ padding: '0.75rem', paddingLeft: '2rem', fontStyle: 'italic', color: theme === 'dark' ? '#aaa' : '#666' }}>
                            ↳ {rollup.lagnname}*
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', color: theme === 'dark' ? '#aaa' : '#666' }}>{formatNumber(rollup.hires)}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', color: theme === 'dark' ? '#aaa' : '#666' }}>{formatNumber(rollup.codes)}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', color: theme === 'dark' ? '#aaa' : '#666' }}>{formatNumber(rollup.vips)}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', color: theme === 'dark' ? '#aaa' : '#666' }}>{formatNumber(rollup.refSales || 0)}</td>
                        </tr>
                      );
                      rowIndex++;
                    });
                  });
                  
                  return displayRows;
                })()}
                <tr style={{ 
                  borderTop: theme === 'dark' ? '2px solid #444' : '2px solid #ddd', 
                  fontWeight: 'bold', 
                  background: theme === 'dark' ? '#2a2a2a' : '#f0f8ff',
                  color: theme === 'dark' ? '#f0f0f0' : '#000'
                }}>
                  <td style={{ padding: '0.75rem' }}>TOTAL</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    {formatNumber(breakdownData.reduce((sum, r) => sum + r.hires, 0))}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    {formatNumber(breakdownData.reduce((sum, r) => sum + r.codes, 0))}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    {formatNumber(breakdownData.reduce((sum, r) => sum + r.vips, 0))}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    {formatNumber(breakdownData.reduce((sum, r) => sum + (r.refSales || 0), 0))}
                  </td>
                </tr>
              </tbody>
            </table>
            
            {breakdownData.some(row => row.isFirstYearRollup) && (
              <div style={{ 
                marginTop: '1rem', 
                padding: '0.75rem', 
                background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa', 
                borderRadius: '4px',
                fontSize: '0.875rem',
                color: theme === 'dark' ? '#aaa' : '#666'
              }}>
                <strong>*</strong> First-year MGA rolling up to their upline
              </div>
            )}

            {/* Ref Sales Agent Breakdown */}
            {refSalesBreakdown.length > 0 && (
              <div style={{ marginTop: '2rem' }}>
                <h4 style={{ 
                  marginBottom: '1rem', 
                  color: theme === 'dark' ? '#f0f0f0' : '#000',
                  fontSize: '1rem',
                  fontWeight: '600'
                }}>
                  Ref Sales by Agent
                </h4>
                {refSalesBreakdown.map((mgaData, mgaIdx) => (
                  <div key={mgaIdx} style={{ marginBottom: '1.5rem' }}>
                    <h5 style={{ 
                      marginBottom: '0.5rem', 
                      color: theme === 'dark' ? '#aaa' : '#666',
                      fontSize: '0.875rem',
                      fontWeight: '600'
                    }}>
                      {mgaData.mga}
                    </h5>
                    {mgaData.agents.length === 0 ? (
                      <div style={{ 
                        padding: '1rem', 
                        textAlign: 'center', 
                        color: theme === 'dark' ? '#666' : '#999',
                        fontStyle: 'italic'
                      }}>
                        No ref sales for this MGA
                      </div>
                    ) : (
                      <table style={{ 
                        width: '100%', 
                        borderCollapse: 'collapse',
                        fontSize: '0.875rem'
                      }}>
                        <thead>
                          <tr style={{ 
                            borderBottom: theme === 'dark' ? '2px solid #444' : '2px solid #ddd',
                            background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa'
                          }}>
                            <th style={{ padding: '0.5rem', textAlign: 'left', color: theme === 'dark' ? '#f0f0f0' : '#000' }}>Agent</th>
                            <th style={{ padding: '0.5rem', textAlign: 'right', color: theme === 'dark' ? '#f0f0f0' : '#000' }}>Ref Sales</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mgaData.agents.map((agent, agentIdx) => (
                            <tr 
                              key={agentIdx}
                              style={{ 
                                borderBottom: theme === 'dark' ? '1px solid #444' : '1px solid #eee',
                                background: agentIdx % 2 === 0 ? (theme === 'dark' ? '#1e1e1e' : 'white') : (theme === 'dark' ? '#2a2a2a' : '#f8f9fa'),
                                color: theme === 'dark' ? '#f0f0f0' : '#000'
                              }}
                            >
                              <td style={{ padding: '0.5rem' }}>{agent.lagnname}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right' }}>{agent.refSales}</td>
                            </tr>
                          ))}
                          <tr style={{ 
                            borderTop: theme === 'dark' ? '2px solid #444' : '2px solid #ddd',
                            fontWeight: 'bold',
                            background: theme === 'dark' ? '#2a2a2a' : '#f0f8ff',
                            color: theme === 'dark' ? '#f0f0f0' : '#000'
                          }}>
                            <td style={{ padding: '0.5rem' }}>TOTAL</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                              {mgaData.agents.reduce((sum, agent) => sum + parseInt(agent.refSales || 0), 0)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrgMetricsBreakdownModal;
