/**
 * Commit History Modal Component
 * Displays the history of commitments (hires, codes, vips)
 */

import React, { useContext } from 'react';
import ThemeContext from '../../context/ThemeContext';
import { formatNumber } from '../../utils/dashboardHelpers';

const CommitHistoryModal = ({ 
  showHistoryModal, 
  setShowHistoryModal, 
  historyModalType, 
  commitHistory 
}) => {
  const { theme } = useContext(ThemeContext);

  if (!showHistoryModal || !historyModalType) {
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
      onClick={() => setShowHistoryModal(false)}
    >
      <div 
        style={{
          background: theme === 'dark' ? '#1e1e1e' : 'white',
          color: theme === 'dark' ? '#f0f0f0' : '#000',
          borderRadius: '8px',
          padding: '1.5rem',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: theme === 'dark' ? '0 4px 6px rgba(0, 0, 0, 0.4)' : '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, textTransform: 'capitalize', color: theme === 'dark' ? '#f0f0f0' : '#000' }}>
            {historyModalType} Commitment History
          </h3>
          <button
            onClick={() => setShowHistoryModal(false)}
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
          {commitHistory[historyModalType]?.length} total {commitHistory[historyModalType]?.length === 1 ? 'entry' : 'entries'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {commitHistory[historyModalType]?.map((entry, index) => {
            const isLatest = index === 0;
            const prevEntry = index < commitHistory[historyModalType].length - 1 ? commitHistory[historyModalType][index + 1] : null;
            const change = prevEntry ? entry.amount - prevEntry.amount : null;
            
            return (
              <div 
                key={entry.id}
                style={{
                  padding: '1rem',
                  border: isLatest ? '2px solid var(--primary-color, #007bff)' : (theme === 'dark' ? '1px solid #444' : '1px solid #ddd'),
                  borderRadius: '6px',
                  background: isLatest ? (theme === 'dark' ? '#2a3a4a' : '#f0f8ff') : (theme === 'dark' ? '#2a2a2a' : 'white'),
                  color: theme === 'dark' ? '#f0f0f0' : '#000',
                  position: 'relative'
                }}
              >
                {isLatest && (
                  <div 
                    style={{
                      position: 'absolute',
                      top: '-10px',
                      right: '10px',
                      background: 'var(--primary-color, #007bff)',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold'
                    }}
                  >
                    CURRENT
                  </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                    {formatNumber(entry.amount)}
                    {change !== null && (
                      <span style={{ 
                        marginLeft: '0.5rem', 
                        fontSize: '0.875rem', 
                        color: change > 0 ? '#28a745' : change < 0 ? '#dc3545' : '#666',
                        fontWeight: 'normal'
                      }}>
                        ({change > 0 ? '+' : ''}{formatNumber(change)})
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: theme === 'dark' ? '#aaa' : '#666' }}>
                    {(() => {
                      const timestamp = entry.created_at;
                      
                      let date;
                      if (typeof timestamp === 'string') {
                        const parts = timestamp.split(/[- :]/);
                        date = new Date(
                          parseInt(parts[0]), 
                          parseInt(parts[1]) - 1, 
                          parseInt(parts[2]), 
                          parseInt(parts[3]) + 3,
                          parseInt(parts[4]), 
                          parseInt(parts[5])
                        );
                      } else {
                        date = new Date(timestamp);
                      }
                      
                      return date.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      }) + ' ET';
                    })()}
                  </div>
                </div>
                
                <div style={{ fontSize: '0.75rem', color: theme === 'dark' ? '#aaa' : '#666' }}>
                  {entry.lagnname}
                  {entry.clname && ` • ${entry.clname}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CommitHistoryModal;
