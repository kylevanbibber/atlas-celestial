import React, { useState } from 'react';
import api from '../../api';

const OnboardingItemDetails = ({ data, onClose, recruitSummary }) => {
  const pipelineId = localStorage.getItem('onboardingPipelineId');
  const [courseDraft, setCourseDraft] = useState(recruitSummary?.course || '');
  const [courseSaving, setCourseSaving] = useState(false);
  const [expectedDateDraft, setExpectedDateDraft] = useState(
    recruitSummary?.expected_complete_date ? String(recruitSummary.expected_complete_date).slice(0, 10) : ''
  );
  const [expectedDateSaving, setExpectedDateSaving] = useState(false);

  if (!data) return null;

  // Save course
  const handleCourseSave = async () => {
    if (courseDraft !== recruitSummary?.course) {
      try {
        setCourseSaving(true);
        await api.put(`/recruitment/recruits/${pipelineId}`, { course: courseDraft });
      } finally {
        setCourseSaving(false);
      }
    }
  };

  // Save expected date
  const handleDateSave = async (newDate) => {
    try {
      setExpectedDateSaving(true);
      await api.put(`/recruitment/recruits/${pipelineId}`, { expected_complete_date: newDate });
    } finally {
      setExpectedDateSaving(false);
    }
  };

  // Use recommended date (7 days from today)
  const handleUseRecommended = async () => {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const dateStr = sevenDaysFromNow.toISOString().split('T')[0];
    setExpectedDateDraft(dateStr);
    await handleDateSave(dateStr);
  };

  // Helper function to render text with clickable links and inline inputs for placeholders
  const renderTextWithLinks = (text) => {
    if (!text) return null;
    
    const lines = text.split('\n');
    
    const renderLine = (line, lineIdx) => {
      // Check for placeholders and split the line into segments
      const placeholderRegex = /(\{\{course\}\}|\{\{expected_complete_date\}\})/g;
      const segments = [];
      let lastIndex = 0;
      let match;

      while ((match = placeholderRegex.exec(line)) !== null) {
        // Add text before placeholder
        if (match.index > lastIndex) {
          segments.push({ type: 'text', content: line.substring(lastIndex, match.index) });
        }
        // Add placeholder
        segments.push({ type: 'placeholder', content: match[0] });
        lastIndex = match.index + match[0].length;
      }

      // Add remaining text
      if (lastIndex < line.length) {
        segments.push({ type: 'text', content: line.substring(lastIndex) });
      }

      // If no placeholders, process for links
      if (segments.length === 0) {
        segments.push({ type: 'text', content: line });
      }

      return (
        <React.Fragment key={`line-${lineIdx}`}>
          {segments.map((seg, idx) => {
            if (seg.type === 'placeholder') {
              // Render input for course
              if (seg.content === '{{course}}') {
                return (
                  <span key={`seg-${idx}`} style={{ display: 'inline-block', margin: '0 4px' }}>
                    <input
                      type="text"
                      value={courseDraft}
                      onChange={(e) => setCourseDraft(e.target.value)}
                      onBlur={handleCourseSave}
                      placeholder="Enter your course"
                      style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: 4,
                        padding: '4px 8px',
                        fontSize: '14px',
                        backgroundColor: 'var(--card-bg)',
                        color: 'var(--text-primary)',
                        minWidth: '200px'
                      }}
                    />
                    {courseSaving && <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 4 }}>Saving...</span>}
                  </span>
                );
              }
              // Render date input for expected_complete_date
              else if (seg.content === '{{expected_complete_date}}') {
                return (
                  <span key={`seg-${idx}`} style={{ display: 'inline-block', margin: '0 4px' }}>
                    <input
                      type="date"
                      value={expectedDateDraft}
                      onChange={async (e) => {
                        const newVal = e.target.value;
                        setExpectedDateDraft(newVal);
                        await handleDateSave(newVal);
                      }}
                      style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: 4,
                        padding: '4px 8px',
                        fontSize: '14px',
                        backgroundColor: 'var(--card-bg)',
                        color: 'var(--text-primary)'
                      }}
                    />
                    <button
                      onClick={handleUseRecommended}
                      style={{
                        backgroundColor: '#28a745',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600,
                        marginLeft: 4
                      }}
                    >
                      Use Recommended
                    </button>
                    {expectedDateSaving && <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 4 }}>Saving...</span>}
                  </span>
                );
              }
            } else if (seg.type === 'text') {
              // Process text for URLs
              const urlRegex = /(https?:\/\/[^\s]+)|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})|(www\.[^\s]+)/gi;
              const textSegments = [];
              let textLastIndex = 0;
              let urlMatch;

              while ((urlMatch = urlRegex.exec(seg.content)) !== null) {
                if (urlMatch.index > textLastIndex) {
                  textSegments.push(seg.content.substring(textLastIndex, urlMatch.index));
                }
                textSegments.push({ type: 'link', text: urlMatch[0] });
                textLastIndex = urlMatch.index + urlMatch[0].length;
              }

              if (textLastIndex < seg.content.length) {
                textSegments.push(seg.content.substring(textLastIndex));
              }

              return (
                <React.Fragment key={`seg-${idx}`}>
                  {textSegments.map((textSeg, textIdx) => {
                    if (typeof textSeg === 'string') {
                      return <span key={`text-${textIdx}`}>{textSeg}</span>;
                    }
                    let href = textSeg.text;
                    if (textSeg.text.includes('@')) {
                      href = `mailto:${textSeg.text}`;
                    } else if (textSeg.text.startsWith('www.')) {
                      href = `https://${textSeg.text}`;
                    }
                    return (
                      <a
                        key={`link-${textIdx}`}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#00558c', textDecoration: 'underline' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {textSeg.text}
                      </a>
                    );
                  })}
                </React.Fragment>
              );
            }
            return null;
          })}
        </React.Fragment>
      );
    };

    return (
      <>
        {lines.map((line, i) => (
          <React.Fragment key={`ln-${i}`}>
            {renderLine(line, i)}
            {i < lines.length - 1 && <br />}
          </React.Fragment>
        ))}
      </>
    );
  };

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        marginBottom: '12px',
        paddingBottom: '12px',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <h2 style={{ 
          margin: 0, 
          color: 'var(--text-primary)', 
          fontSize: '20px', 
          fontWeight: 600 
        }}>
          {data.item_name}
        </h2>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '28px',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            padding: '0',
            lineHeight: '1',
            marginLeft: '12px'
          }}
          title="Close"
        >
          ×
        </button>
      </div>
      
      {/* Expected Time Badge */}
      {data.expected_time && (
        <div style={{ 
          display: 'inline-block',
          fontSize: '13px', 
          color: 'var(--text-secondary)', 
          backgroundColor: 'rgba(0, 85, 140, 0.08)',
          border: '1px solid rgba(0, 85, 140, 0.2)',
          padding: '4px 12px',
          borderRadius: '16px',
          fontWeight: 500,
          marginBottom: '16px'
        }}>
          Expected Time: {data.expected_time}
        </div>
      )}
      
      {/* Description */}
      {data.item_description && (
        <div style={{ 
          color: 'var(--text-primary)', 
          marginBottom: data.instructions ? '20px' : '0',
          fontSize: '15px',
          lineHeight: '1.6',
          whiteSpace: 'pre-line'
        }}>
          {renderTextWithLinks(data.item_description)}
        </div>
      )}
      
      {/* Instructions */}
      {data.instructions && (
        <>
          {data.item_description && (
            <hr style={{ 
              border: 'none', 
              borderTop: '1px solid var(--border-color)', 
              margin: '20px 0' 
            }} />
          )}
          <div style={{ 
            color: 'var(--text-primary)', 
            lineHeight: '1.6',
            fontSize: '15px',
            whiteSpace: 'pre-line'
          }}>
            {renderTextWithLinks(data.instructions)}
          </div>
        </>
      )}
      
      {/* Pre-Licensing Progress Section */}
      {data.item_name === 'Pre-Licensing Course' && recruitSummary?.prelic_progress && (
        <>
          <hr style={{ 
            border: 'none', 
            borderTop: '1px solid var(--border-color)', 
            margin: '24px 0 16px 0' 
          }} />
          <div style={{ 
            backgroundColor: 'rgba(0, 85, 140, 0.05)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '16px',
            marginTop: '16px'
          }}>
            <h3 style={{ 
              margin: '0 0 12px 0', 
              fontSize: '16px', 
              fontWeight: 600,
              color: 'var(--text-primary)'
            }}>
              Course Progress
            </h3>
            <div style={{ display: 'grid', gap: '8px' }}>
              {recruitSummary.prelic_progress.date_enrolled && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Date Enrolled:</span>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                    {new Date(recruitSummary.prelic_progress.date_enrolled).toLocaleDateString('en-US')}
                  </span>
                </div>
              )}
              {recruitSummary.prelic_progress.time_spent && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Time Spent:</span>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                    {recruitSummary.prelic_progress.time_spent}
                  </span>
                </div>
              )}
              {recruitSummary.prelic_progress.ple_complete_pct !== null && recruitSummary.prelic_progress.ple_complete_pct !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Completion:</span>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                    {recruitSummary.prelic_progress.ple_complete_pct}%
                  </span>
                </div>
              )}
              {recruitSummary.prelic_progress.prepared_to_pass && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Prepared to Pass:</span>
                  <span style={{ 
                    fontWeight: 600, 
                    color: recruitSummary.prelic_progress.prepared_to_pass === 'PREPARED' ? '#28a745' : 'var(--text-primary)'
                  }}>
                    {recruitSummary.prelic_progress.prepared_to_pass}
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default OnboardingItemDetails;

