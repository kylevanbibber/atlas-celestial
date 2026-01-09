import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUser } from 'react-icons/fa';
import api from '../../api';
import RightDetails from '../../components/utils/RightDetails';
import '../../components/recruiting/Pipeline/PipelineChecklist.css';

// Format lagnname like "Last First [Middle] [Suffix]" → "First Last"
function formatCodedToName(raw) {
  if (!raw) return '—';
  const titleCase = (str) => String(str)
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  let s = String(raw).trim().replace(/\s+/g, ' ');

  let first = '';
  let last = '';

  if (s.includes(',')) {
    // Handle "Last, First [Middle] [Suffix]"
    const parts = s.split(',');
    last = parts[0]?.trim() || '';
    const right = (parts[1] || '').trim().split(/\s+/);
    first = right[0] || '';
  } else {
    // Handle "Last First [Middle] [Suffix]"
    const parts = s.split(' ');
    if (parts.length >= 2) {
      last = parts[0];
      first = parts[1];
    } else {
      return titleCase(s);
    }
  }

  if (!first || !last) return titleCase(s);
  return `${titleCase(first)} ${titleCase(last)}`.trim();
}

const OnboardingHome = () => {
  const navigate = useNavigate();
  const pipelineId = localStorage.getItem('onboardingPipelineId');
  const email = localStorage.getItem('onboardingEmail');

  // Set page title
  useEffect(() => {
    document.title = 'Onboarding';
    return () => {
      document.title = 'Atlas';
    };
  }, []);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]); // checklist definitions
  const [stages, setStages] = useState([]); // stage definitions (ordered)
  const [progress, setProgress] = useState([]); // progress records
  const [error, setError] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploadingItems, setUploadingItems] = useState({});
  const fileInputRefs = useRef({});
  const [expandedStages, setExpandedStages] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);
  const [previewModal, setPreviewModal] = useState({ open: false, attachment: null });
  const [recruitSummary, setRecruitSummary] = useState(null);
  const [courseDraft, setCourseDraft] = useState('');
  const [courseSaving, setCourseSaving] = useState(false);
  const [courseEditing, setCourseEditing] = useState(false);
  const [expectedDateEditing, setExpectedDateEditing] = useState(false);
  const [expectedDateDraft, setExpectedDateDraft] = useState('');
  const [expectedDateSaving, setExpectedDateSaving] = useState(false);
  const [xcelLink, setXcelLink] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [npn, setNpn] = useState('');
  const [savingLicense, setSavingLicense] = useState(false);

  useEffect(() => {
    console.log('[OnboardingHome] Checking auth:', {
      pipelineId,
      hasToken: !!localStorage.getItem('token'),
      tokenPreview: localStorage.getItem('token')?.substring(0, 20) + '...'
    });
    
    if (!pipelineId) {
      console.log('[OnboardingHome] No pipeline ID, redirecting to login');
      navigate('/onboarding/login', { replace: true });
    }
  }, [pipelineId, navigate]);

  useEffect(() => {
    const run = async () => {
      if (!pipelineId) return;
      setLoading(true);
      setError('');
      try {
        const [itemsResp, progResp, attResp, stagesResp, summaryResp, xcelResp] = await Promise.all([
          api.get(`/recruitment/recruits/${pipelineId}/checklist/items`),
          api.get(`/recruitment/recruits/${pipelineId}/checklist`),
          api.get(`/pipeline-attachments/recruit/${pipelineId}`),
          api.get(`/recruitment/stages`),
          api.get(`/recruitment/recruits/${pipelineId}/summary`),
          api.get(`/recruitment/recruits/${pipelineId}/xcel-link`)
        ]);
        const itemList = itemsResp.data?.data || [];
        const progList = progResp.data?.data || [];
        const atts = attResp.data?.data || attResp.data?.attachments || [];
        const stageList = stagesResp.data?.data || [];
        setItems(itemList);
        setProgress(progList);
        setAttachments(atts);
        setStages(stageList);
        const sumData = summaryResp.data?.data || null;
        setRecruitSummary(sumData);
        const xcelData = xcelResp.data?.xcel_link || 'https://partners.xcelsolutions.com/ariasevanson';
        setXcelLink(xcelData);
        // Initialize drafts
        if (sumData) {
          setCourseDraft(sumData.course || '');
          const d = sumData.expected_complete_date ? String(sumData.expected_complete_date).slice(0, 10) : '';
          setExpectedDateDraft(d);
          // Initialize license info from summary data
          setLicenseNumber(sumData.resident_license_number || '');
          setNpn(sumData.npn || '');
        }
        // auto-expand first stage
        if (stageList.length) {
          const firstStageId = stageList[0].id;
          setExpandedStages({ [firstStageId]: true });
        }
      } catch (e) {
        setError('Failed to load checklist');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [pipelineId]);

  const progressByItemId = useMemo(() => {
    const map = new Map();
    (progress || []).forEach(p => map.set(p.checklist_item_id, p));
    return map;
  }, [progress]);

  const isSystemControlled = (name = '') => {
    const s = String(name).toLowerCase();
    return s.includes('receive agent number') || s.includes('activate agent number') || s.includes('agent number');
  };

  const needsProof = (item) => {
    const text = `${item.item_name || ''} ${item.item_description || ''}`.toLowerCase();
    return text.includes('attach proof') || text.includes('license approval') || text.includes('receive license approval');
  };

  const isPreLicCourseItem = (item) => {
    const name = (item.item_name || '').toLowerCase();
    return name.includes('pre-lic') && name.includes('course');
  };

  // Helper to check if item is Attend Training
  const isAttendTrainingItem = (item) => {
    const name = (item.item_name || '').toLowerCase();
    return name.includes('attend') && name.includes('training');
  };

  // Helper to check if item is Receive License Approval
  const isReceiveLicenseItem = (item) => {
    const name = (item.item_name || '').toLowerCase();
    return name.includes('receive') && name.includes('license');
  };

  // Helper to get custom button text
  const getButtonText = (item) => {
    const itemName = (item.item_name || '').toLowerCase();
    if (itemName.includes('background check')) return 'Schedule';
    if (itemName.includes('licensing test') || itemName.includes('schedule') && itemName.includes('test')) return 'Schedule';
    if (itemName.includes('purchase') && itemName.includes('license')) return 'Purchase';
    return 'Start';
  };

  const getItemAttachments = (itemId) => attachments.filter(a => a.checklist_item_id === itemId);

  const handleSaveLicenseInfo = async () => {
    try {
      setSavingLicense(true);
      await api.put(`/recruitment/recruits/${pipelineId}`, {
        resident_license_number: licenseNumber,
        npn: npn
      });
    } catch (err) {
      console.error('Error saving license info:', err);
      alert('Failed to save license information');
    } finally {
      setSavingLicense(false);
    }
  };

  const handleToggle = async (item) => {
    if (isSystemControlled(item.item_name)) return;
    if (needsProof(item) && getItemAttachments(item.id).length === 0) {
      // require proof before checking
      return;
    }
    try {
      const current = progressByItemId.get(item.id);
      const newCompleted = current ? !current.completed : true;
      await api.post(`/recruitment/recruits/${pipelineId}/checklist`, {
        checklist_item_id: item.id,
        completed: newCompleted
      });
      // refresh progress locally without refetch
      setProgress(prev => {
        const existing = prev.find(p => p.checklist_item_id === item.id);
        if (existing) {
          return prev.map(p => p.checklist_item_id === item.id ? { ...p, completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null } : p);
        }
        return [...prev, { checklist_item_id: item.id, completed: newCompleted, stage_name: item.stage_name, item_name: item.item_name }];
      });
    } catch (e) {
      // ignore UI error for now
    }
  };

  const triggerFileInput = (itemId) => {
    if (fileInputRefs.current[itemId]) fileInputRefs.current[itemId].click();
  };

  const openAttachmentPreview = (att) => {
    try {
      const base = 'https://svk.2cc.mytemp.website/atlas/public_html/svk.2cc.mytemp.website/atlas';
      const fname = att?.file_path || att?.file_name || '';
      const url = `${base}/${fname}`;
      // Log the exact URL/type we will attempt to render
      // This helps diagnose broken previews (404, CORS, content-type, etc.)
      // eslint-disable-next-line no-console
      console.log('[Onboarding] Previewing attachment:', {
        id: att?.id,
        url,
        file_type: att?.file_type,
        file_name: att?.file_name,
        file_path: att?.file_path
      });
    } catch (_) {}
    setPreviewModal({ open: true, attachment: att });
  };
  const closeAttachmentPreview = () => setPreviewModal({ open: false, attachment: null });

  const handleFileSelect = async (item, event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      setUploadingItems(prev => ({ ...prev, [item.id]: true }));
      const formData = new FormData();
      formData.append('file', file);
      formData.append('recruit_id', pipelineId);
      formData.append('checklist_item_id', item.id);
      formData.append('file_category', 'proof');
      formData.append('description', `Proof for: ${item.item_name}`);
      const resp = await api.post('/pipeline-attachments/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (resp.data?.success) {
        // refresh attachments list
        const attResp = await api.get(`/pipeline-attachments/recruit/${pipelineId}`);
        const atts = attResp.data?.data || attResp.data?.attachments || [];
        setAttachments(atts);
      }
    } catch (e) {
      // error surfaced silently
    } finally {
      setUploadingItems(prev => ({ ...prev, [item.id]: false }));
      if (fileInputRefs.current[item.id]) fileInputRefs.current[item.id].value = '';
    }
  };

  // derive next steps: items not completed
  const getStageItems = (stageName) => {
    return (items || []).filter(i => i.stage_name === stageName);
  };

  const getStageCompletion = (stageName) => {
    const stageItems = getStageItems(stageName);
    if (stageItems.length === 0) return { completed: 0, total: 0, percentage: 0 };
    const completed = stageItems.filter(i => progressByItemId.get(i.id)?.completed).length;
    return { completed, total: stageItems.length, percentage: Math.round((completed / stageItems.length) * 100) };
  };

  const openInstructions = (item) => {
    setSelectedItem({ ...item, __isOnboardingItem: true });
  };

  const closeDetails = () => {
    setSelectedItem(null);
  };

  // Extract first URL from text (description or instructions)
  const extractFirstLink = (item) => {
    const text = `${item.item_description || ''} ${item.instructions || ''}`;
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const match = text.match(urlRegex);
    return match ? match[0] : null;
  };

  // Get icon for checklist item based on name/type
  const getItemIcon = (item) => {
    const name = item.item_name?.toLowerCase() || '';
    if (name.includes('background') || name.includes('check')) return '🔍';
    if (name.includes('license') || name.includes('licensing')) return '📋';
    if (name.includes('exam') || name.includes('test')) return '📝';
    if (name.includes('contract') || name.includes('sign')) return '✍️';
    if (name.includes('photo') || name.includes('picture')) return '📷';
    if (name.includes('upload') || name.includes('submit')) return '📤';
    if (name.includes('training') || name.includes('course')) return '🎓';
    if (name.includes('appointment') || name.includes('schedule')) return '📅';
    if (name.includes('document') || name.includes('form')) return '📄';
    if (name.includes('payment') || name.includes('fee')) return '💳';
    if (name.includes('orientation') || name.includes('onboard')) return '👋';
    return '📌'; // default
  };

  const formatInstructions = (text) => {
    if (!text) return '';
    // Replace literal \n with actual newlines
    return text.replace(/\\n/g, '\n');
  };

  // Render text with clickable links (URLs/emails) and preserved line breaks
  const renderTextWithLinks = (rawText) => {
    if (!rawText) return null;
    const text = formatInstructions(rawText);
    const lines = text.split('\n');
    const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;

    const renderLine = (line, lineIdx) => {
      const segments = line.split(linkRegex);
      return (
        <React.Fragment key={`line-${lineIdx}`}>
          {segments.map((seg, idx) => {
            if (!seg) return null;
            const isLink = linkRegex.test(seg);
            // Reset lastIndex due to global regex usage in test
            linkRegex.lastIndex = 0;
            if (!isLink) return <React.Fragment key={`t-${idx}`}>{seg}</React.Fragment>;

            // Determine href
            let href = seg;
            if (seg.includes('@') && !seg.startsWith('http')) {
              href = `mailto:${seg}`;
            } else if (seg.startsWith('www.')) {
              href = `https://${seg}`;
            }
            return (
              <a
                key={`a-${idx}`}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#00558c', textDecoration: 'underline' }}
                onClick={(e) => e.stopPropagation()}
              >
                {seg}
              </a>
            );
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
    <div className="onboarding-root onboarding-home">
      {/* Page Content */}
      <div style={{ maxWidth: 980, margin: '24px auto', padding: '0 16px' }}>
        {/* Summary card: Enrollment + Manager contact */}
        {recruitSummary && (
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            padding: '16px 20px',
            marginBottom: 16,
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
          }}>
            {/* Onboarding Started Date on top with info button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Onboarding Started</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {recruitSummary.enrollment_date ? new Date(recruitSummary.enrollment_date).toLocaleDateString('en-US') : '—'}
                </div>
              </div>
              <button
                onClick={() => setShowTutorial(true)}
                title="How to use this checklist"
                style={{
                  background: 'rgba(0, 85, 140, 0.1)',
                  border: '1px solid rgba(0, 85, 140, 0.3)',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#00558c',
                  fontSize: 16,
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 85, 140, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 85, 140, 0.1)';
                }}
              >
                ?
              </button>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '10px 0 12px' }} />

            {/* Blurb */}
            <div style={{ color: 'var(--text-primary)' }}>
              <strong>Reach out to your manager</strong> when you complete a step or if you need help!
            </div>

            {/* Row: Avatar + Manager Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
              {recruitSummary.manager?.profpic ? (
                <img 
                  src={recruitSummary.manager.profpic}
                  alt="Manager"
                  style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                />
              ) : (
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: 18
                }}>
                  <FaUser />
                </div>
              )}
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Manager Name</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatCodedToName(recruitSummary.manager?.lagnname)}</div>
              </div>
            </div>

            <div style={{ height: 10 }} />

            {/* Row: Manager Email + Phone */}
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Manager Email</div>
                {recruitSummary.manager?.email ? (
                  <a href={`mailto:${recruitSummary.manager.email}`} style={{ color: 'var(--link-color)', fontWeight: 600 }}>{recruitSummary.manager.email}</a>
                ) : (
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>—</div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Manager Phone</div>
                {recruitSummary.manager?.phone ? (
                  <a href={`tel:${recruitSummary.manager.phone}`} style={{ color: 'var(--link-color)', fontWeight: 600 }}>{recruitSummary.manager.phone}</a>
                ) : (
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>—</div>
                )}
              </div>
            </div>

            {/* (Enrollment Date moved to top) */}
          </div>
        )}
        {/* Header removed per request */}
        {/* Staged checklist like RightDetails */}
        <div className="pipeline-checklist-container">
          {loading ? (
            <div className="checklist-loading">Loading checklist...</div>
          ) : error ? (
            <div className="checklist-loading" style={{ color: 'red' }}>{error}</div>
          ) : (
            <div className="checklist-stages">
            {stages.map(stage => {
              const stageItems = getStageItems(stage.stage_name);
              if (stageItems.length === 0) return null;
              const isExpanded = !!expandedStages[stage.id];
              const completion = getStageCompletion(stage.stage_name);
              return (
                <div key={stage.id} className={`checklist-stage`}>
                  <div className="checklist-stage-header" onClick={() => setExpandedStages(prev => ({ ...prev, [stage.id]: !isExpanded }))}>
                    <div className="stage-header-left">
                      <div className="stage-indicator" style={{ backgroundColor: stage.stage_color || '#00558c' }}></div>
                      <h4>{stage.stage_name}</h4>
                    </div>
                    <div className="stage-header-right">
                      <div className="stage-progress-bar">
                        <div className="stage-progress-fill" style={{ width: `${completion.percentage}%` }} />
                      </div>
                      <div className="stage-completion">{completion.completed}/{completion.total}</div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="checklist-items">
                      {stageItems.map(item => {
                        const isCompleted = !!progressByItemId.get(item.id)?.completed;
                        const itemAttachments = getItemAttachments(item.id);
                        const requiresProof = needsProof(item);
                        const disabled = isSystemControlled(item.item_name) || (requiresProof && itemAttachments.length === 0);
                        const firstLink = extractFirstLink(item);
                        const itemIcon = getItemIcon(item);
                        
                        return (
                          <div 
                            key={item.id} 
                            className={`checklist-item ${isCompleted ? 'completed' : ''}`}
                            onClick={() => openInstructions(item)}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className="checklist-item-main">
                              <div className="checklist-item-info" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', width: '100%' }}>
                                {/* Icon on the left */}
                                <div style={{ 
                                  fontSize: '24px', 
                                  lineHeight: '1',
                                  flexShrink: 0,
                                  marginTop: '2px'
                                }}>
                                  {itemIcon}
                                </div>
                                
                                {/* Main content in the middle */}
                                <div className="checklist-item-text" style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                    <label style={{ cursor: 'pointer', fontWeight: 500 }}>
                                    {item.item_name}
                                  </label>
                                    {item.expected_time && (
                                      <span style={{ 
                                        fontSize: '12px', 
                                        color: 'var(--text-secondary)', 
                                        backgroundColor: 'var(--card-bg)',
                                        border: '1px solid var(--border-color)',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontWeight: 500
                                      }}>
                                        {item.expected_time}
                                      </span>
                                    )}
                                  </div>
                                  {item.item_description && (
                                    <p className="item-description">{item.item_description}</p>
                                  )}

                                  {isPreLicCourseItem(item) && (
                                    <>
                                      {/* Show course/date editor OR prepared_to_pass status */}
                                      {(!recruitSummary?.course || !recruitSummary?.expected_complete_date || courseEditing || expectedDateEditing) ? (
                                        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                                          {/* Edit button - spans 2 rows */}
                                          {!courseEditing && !expectedDateEditing && (
                                            <button
                                              title="Edit course and date"
                                              onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setCourseEditing(true); 
                                                setExpectedDateEditing(true);
                                                setCourseDraft(recruitSummary?.course || ''); 
                                                setExpectedDateDraft(recruitSummary?.expected_complete_date ? String(recruitSummary.expected_complete_date).slice(0, 10) : '');
                                              }}
                                              style={{
                                                background: 'none',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 6,
                                                padding: '8px 6px',
                                                cursor: 'pointer',
                                                color: 'var(--text-primary)',
                                                fontSize: '16px',
                                                alignSelf: 'stretch',
                                                display: 'flex',
                                                alignItems: 'center'
                                              }}
                                            >✎</button>
                                          )}
                                          
                                          {/* Course and Date fields container */}
                                          <div style={{ display: 'grid', gap: 8, flex: 1 }}>
                                            {/* Course display / editor */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                              {!courseEditing ? (
                                                <>
                                                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Course:</div>
                                                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{recruitSummary?.course || '—'}</div>
                                                </>
                                              ) : (
                                                <>
                                                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Course:</div>
                                                  <input
                                                    type="text"
                                                    value={courseDraft}
                                                    onChange={(e) => setCourseDraft(e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    placeholder="Enter your course"
                                                    style={{
                                                      border: '1px solid var(--border-color)',
                                                      borderRadius: 6,
                                                      padding: '6px 8px',
                                                      flex: 1,
                                                      minWidth: 220,
                                                      backgroundColor: 'var(--card-bg)',
                                                      color: 'var(--text-primary)'
                                                    }}
                                                  />
                                                </>
                                              )}
                                            </div>

                                            {/* Expected completion date */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                                              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Expected Complete Date:</div>
                                        {!expectedDateEditing ? (
                                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {recruitSummary?.expected_complete_date ? new Date(recruitSummary.expected_complete_date).toLocaleDateString('en-US') : '—'}
                                          </div>
                                        ) : (
                                          <>
                                            <input
                                              type="date"
                                              value={expectedDateDraft}
                                              onClick={(e) => e.stopPropagation()}
                                              onChange={(e) => setExpectedDateDraft(e.target.value)}
                                              style={{
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 6,
                                                padding: '6px 8px',
                                                backgroundColor: 'var(--card-bg)',
                                                color: 'var(--text-primary)'
                                              }}
                                            />
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const sevenDaysFromNow = new Date();
                                                sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
                                                const dateStr = sevenDaysFromNow.toISOString().split('T')[0];
                                                setExpectedDateDraft(dateStr);
                                              }}
                                              style={{
                                                backgroundColor: '#28a745',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: 6,
                                                padding: '6px 12px',
                                                cursor: 'pointer',
                                                fontSize: '13px',
                                                fontWeight: 600,
                                                whiteSpace: 'nowrap'
                                              }}
                                            >
                                              Use Recommended
                                            </button>
                                            <button
                                              disabled={expectedDateSaving || courseSaving}
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                try {
                                                  // Save both course and date
                                                  setCourseSaving(true);
                                                  setExpectedDateSaving(true);
                                                  
                                                  await Promise.all([
                                                    api.put(`/recruitment/recruits/${pipelineId}`, { course: courseDraft }),
                                                    api.put(`/recruitment/recruits/${pipelineId}`, { expected_complete_date: expectedDateDraft })
                                                  ]);
                                                  
                                                  // Re-fetch summary to get updated prelic_progress
                                                  const summaryResp = await api.get(`/recruitment/recruits/${pipelineId}/summary`);
                                                  const sumData = summaryResp.data?.data || null;
                                                  setRecruitSummary(sumData);
                                                  
                                                  setCourseEditing(false);
                                                  setExpectedDateEditing(false);
                                                } finally {
                                                  setCourseSaving(false);
                                                  setExpectedDateSaving(false);
                                                }
                                              }}
                                              style={{
                                                backgroundColor: '#00558c',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: 6,
                                                padding: '6px 10px',
                                                cursor: 'pointer'
                                              }}
                                            >{(expectedDateSaving || courseSaving) ? 'Saving...' : 'Save'}</button>
                                            <button
                                              onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setCourseEditing(false);
                                                setExpectedDateEditing(false); 
                                              }}
                                              style={{
                                                background: 'none',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 6,
                                                padding: '6px 10px',
                                                cursor: 'pointer',
                                                color: 'var(--text-primary)'
                                              }}
                                            >Cancel</button>
                                          </>
                                        )}
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        /* Show course progress status once course/date are filled */
                                        recruitSummary?.prelic_progress && (
                                          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                                            <strong>Course Progress:</strong> {recruitSummary.prelic_progress.ple_complete_pct !== null && recruitSummary.prelic_progress.ple_complete_pct !== undefined ? `${recruitSummary.prelic_progress.ple_complete_pct}%` : 'In Progress'}
                                          </div>
                                        )
                                      )}
                                    </>
                                  )}

                                  {/* License Number and NPN inputs for Receive License Approval */}
                                  {isReceiveLicenseItem(item) && (
                                    <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                                      {/* License Number */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>License Number:</div>
                                        <input
                                          type="text"
                                          value={licenseNumber}
                                          onChange={(e) => setLicenseNumber(e.target.value)}
                                          onBlur={handleSaveLicenseInfo}
                                          onClick={(e) => e.stopPropagation()}
                                          placeholder="Enter license number"
                                          style={{
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 6,
                                            padding: '6px 8px',
                                            flex: 1,
                                            minWidth: 180,
                                            backgroundColor: 'var(--card-bg)',
                                            color: 'var(--text-primary)'
                                          }}
                                        />
                                      </div>
                                      
                                      {/* NPN */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>NPN:</div>
                                        <input
                                          type="text"
                                          value={npn}
                                          onChange={(e) => setNpn(e.target.value)}
                                          onBlur={handleSaveLicenseInfo}
                                          onClick={(e) => e.stopPropagation()}
                                          placeholder="Enter NPN"
                                          style={{
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 6,
                                            padding: '6px 8px',
                                            flex: 1,
                                            minWidth: 180,
                                            backgroundColor: 'var(--card-bg)',
                                            color: 'var(--text-primary)'
                                          }}
                                        />
                                        {savingLicense && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Saving...</span>}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Right side: Checkbox and Start button */}
                                <div style={{ 
                                  display: 'flex', 
                                  flexDirection: 'column', 
                                  alignItems: 'flex-end', 
                                  gap: '8px',
                                  flexShrink: 0
                                }}>
                                  {/* Checkbox */}
                                  <div 
                                    className={`checklist-checkbox ${isCompleted ? 'checked' : ''} ${disabled ? 'disabled' : ''}`} 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      !disabled && handleToggle(item);
                                    }} 
                                    role="button"
                                    style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
                                  />
                                  
                                  {/* Start button if there's a link */}
                                  {firstLink && (
                                    <a
                                      href={firstLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      style={{
                                        padding: '6px 12px',
                                        backgroundColor: '#00558c',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        textDecoration: 'none',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      {getButtonText(item)}
                                    </a>
                                  )}
                                  
                                  {/* Optional Training button for Attend Training */}
                                  {isAttendTrainingItem(item) && (
                                    <a
                                      href="https://ariaslife.mykajabi.com/"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      style={{
                                        padding: '6px 12px',
                                        backgroundColor: '#6c757d',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        textDecoration: 'none',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      Optional Training
                                    </a>
                                  )}
                                  
                                  {/* Enroll button for Pre-Licensing Course - show if both course and expected_complete_date are blank */}
                                  {isPreLicCourseItem(item) && (!recruitSummary?.course && !recruitSummary?.expected_complete_date) && (
                                    <a
                                      href={xcelLink || 'https://partners.xcelsolutions.com/ariasevanson'}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      style={{
                                        padding: '6px 12px',
                                        backgroundColor: '#00558c',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        textDecoration: 'none',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      Enroll
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                            {/* Upload proof section hidden for now */}
                            {false && requiresProof && (
                              <div className="checklist-item-attachments" onClick={(e) => e.stopPropagation()}>
                                <input
                                  ref={el => fileInputRefs.current[item.id] = el}
                                  type="file"
                                  style={{ display: 'none' }}
                                  onChange={(e) => handleFileSelect(item, e)}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.heic,.svg"
                                />
                                <div className="attachments-header">
                                  <span>Attachments ({itemAttachments.length})</span>
                                  <button onClick={(e) => { e.stopPropagation(); triggerFileInput(item.id); }} disabled={!!uploadingItems[item.id]} className="upload-btn">
                                    {uploadingItems[item.id] ? 'Uploading...' : 'Upload Proof'}
                                  </button>
                                </div>
                                {itemAttachments.length > 0 && (
                                  <div className="attachments-list">
                                    {itemAttachments.map(att => (
                                      <div key={att.id} className="attachment-item">
                        <div className="attachment-info clickable" onClick={(e) => { e.stopPropagation(); openAttachmentPreview(att); }}>
                                          <span className="attachment-name">{att.file_name || att.file_path}</span>
                                          <span className="attachment-size">{(att.file_size / 1024).toFixed(1)} KB</span>
                                        </div>
                                        <div className="attachment-actions">
                          <a className="attachment-action-btn" href={`/api/pipeline-attachments/download/${att.id}`} target="_blank" rel="noreferrer" title="Open in new tab" onClick={(e) => e.stopPropagation()}>↗</a>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          )}
        </div>
      </div>
      
      {/* Right Details Panel */}
      {selectedItem && (
        <RightDetails
          data={selectedItem}
          onClose={closeDetails}
          recruitSummary={recruitSummary}
        />
      )}

      {/* Attachment Preview Modal */}
      {previewModal.open && previewModal.attachment && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={closeAttachmentPreview}
        >
          <div 
            style={{
              backgroundColor: '#fff',
              borderRadius: '8px',
              padding: '20px',
              width: '95%',
              maxWidth: '900px',
              height: '85vh',
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 'bold' }}>{previewModal.attachment.file_name || previewModal.attachment.file_path}</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <a
                  href={`/api/pipeline-attachments/download/${previewModal.attachment.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="attachment-action-btn"
                  title="Open in new tab"
                >↗</a>
                <button
                  onClick={closeAttachmentPreview}
                  style={{
                    background: 'none',
                    border: '1px solid #ddd',
                    borderRadius: 6,
                    padding: '6px 10px',
                    cursor: 'pointer'
                  }}
                >Close</button>
              </div>
            </div>

            <div style={{
              width: '100%',
              height: 'calc(85vh - 60px)',
              backgroundColor: '#f7f7f7',
              border: '1px solid #eee',
              borderRadius: 8,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {(() => {
                const att = previewModal.attachment;
                // Use backend proxy to resolve the correct file location and headers
                const url = `/api/pipeline-attachments/download/${att.id}`;
                const type = (att.file_type || '').toLowerCase();
                const name = (att.file_name || att.file_path || '').toLowerCase();
                const isImage = type.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic|svg)$/.test(name);
                const isPdf = type === 'application/pdf' || name.endsWith('.pdf');
                const isDoc = /msword|officedocument/.test(type) || /\.(docx?|xlsx?)$/.test(name);
                const isText = type.startsWith('text/') || name.endsWith('.txt');

                if (isImage) {
                  return <img src={url} alt={att.file_name || 'attachment'} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />;
                }
                if (isPdf) {
                  return <iframe title="pdf-preview" src={url} style={{ width: '100%', height: '100%', border: 'none' }} />;
                }
                if (isDoc) {
                  const viewer = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`;
                  return <iframe title="doc-preview" src={viewer} style={{ width: '100%', height: '100%', border: 'none' }} />;
                }
                if (isText) {
                  return <iframe title="text-preview" src={url} style={{ width: '100%', height: '100%', border: 'none' }} />;
                }
                return (
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <div>Preview not available for this file type.</div>
                    <div style={{ marginTop: 10 }}>
                      <a href={url} target="_blank" rel="noreferrer">Open in new tab</a>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Interactive Tutorial Overlay */}
      {showTutorial && (() => {
        const tutorialSteps = [
          {
            title: "Welcome to Your Onboarding!",
            description: "Let's take a quick tour of your onboarding checklist. Click 'Next' to continue.",
            target: null,
            position: 'center'
          },
          {
            title: "Manager Contact",
            description: "This is your manager's contact information. Reach out to them anytime you need help or have questions!",
            target: '.onboarding-home > div > div:first-child',
            position: 'bottom'
          },
          {
            title: "Onboarding Stages",
            description: "Your onboarding is organized into stages. Click on a stage header to expand or collapse it. Complete stages in order for the best experience.",
            target: '.pipeline-stage-header',
            position: 'right'
          },
          {
            title: "Checklist Items",
            description: "Each stage contains checklist items. You'll see an icon, title, expected time, and description for each task.",
            target: '.checklist-item',
            position: 'right'
          },
          {
            title: "View Details",
            description: "Click anywhere on a checklist item to see detailed instructions, links, and resources in a side panel.",
            target: '.checklist-item',
            position: 'right'
          },
          {
            title: "Mark Complete",
            description: "When you finish a task, click the checkbox on the right. This automatically notifies your manager that you've completed the step!",
            target: '.checklist-checkbox',
            position: 'left'
          },
          {
            title: "You're All Set!",
            description: "You're ready to start your onboarding journey. Remember, your manager is here to help if you need anything!",
            target: null,
            position: 'center'
          }
        ];

        const currentStep = tutorialSteps[tutorialStep];
        let targetElement = null;
        let targetRect = null;

        if (currentStep.target) {
          targetElement = document.querySelector(currentStep.target);
          if (targetElement) {
            targetRect = targetElement.getBoundingClientRect();
          }
        }

        const isMobile = window.innerWidth < 768;

        const getTooltipPosition = () => {
          // On mobile, always position at bottom of screen for consistency
          if (isMobile) {
            return {
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              transform: 'none',
              borderRadius: '16px 16px 0 0',
              maxWidth: '100%',
              margin: 0
            };
          }

          if (!targetRect || currentStep.position === 'center') {
            return {
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)'
            };
          }

          const tooltipStyle = { position: 'absolute' };
          const offset = 20;
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;

          // Check if there's enough space for the preferred position
          const spaceRight = viewportWidth - targetRect.right;
          const spaceLeft = targetRect.left;
          const spaceBottom = viewportHeight - targetRect.bottom;
          const spaceTop = targetRect.top;

          let position = currentStep.position;

          // Auto-adjust position if not enough space
          if (position === 'right' && spaceRight < 420) {
            position = spaceLeft > 420 ? 'left' : 'bottom';
          }
          if (position === 'left' && spaceLeft < 420) {
            position = spaceRight > 420 ? 'right' : 'bottom';
          }
          if (position === 'bottom' && spaceBottom < 300) {
            position = 'top';
          }
          if (position === 'top' && spaceTop < 300) {
            position = 'bottom';
          }

          switch (position) {
            case 'bottom':
              tooltipStyle.top = targetRect.bottom + offset + window.scrollY;
              tooltipStyle.left = Math.max(16, Math.min(targetRect.left + (targetRect.width / 2), viewportWidth - 216));
              tooltipStyle.transform = 'translateX(-50%)';
              break;
            case 'top':
              tooltipStyle.bottom = viewportHeight - targetRect.top + offset;
              tooltipStyle.left = Math.max(16, Math.min(targetRect.left + (targetRect.width / 2), viewportWidth - 216));
              tooltipStyle.transform = 'translateX(-50%)';
              break;
            case 'right':
              tooltipStyle.top = targetRect.top + (targetRect.height / 2) + window.scrollY;
              tooltipStyle.left = targetRect.right + offset;
              tooltipStyle.transform = 'translateY(-50%)';
              break;
            case 'left':
              tooltipStyle.top = targetRect.top + (targetRect.height / 2) + window.scrollY;
              tooltipStyle.right = viewportWidth - targetRect.left + offset;
              tooltipStyle.transform = 'translateY(-50%)';
              break;
            default:
              tooltipStyle.top = '50%';
              tooltipStyle.left = '50%';
              tooltipStyle.transform = 'translate(-50%, -50%)';
          }

          return tooltipStyle;
        };

        const handleNext = () => {
          if (tutorialStep < tutorialSteps.length - 1) {
            setTutorialStep(tutorialStep + 1);
          } else {
            setShowTutorial(false);
            setTutorialStep(0);
          }
        };

        const handlePrev = () => {
          if (tutorialStep > 0) {
            setTutorialStep(tutorialStep - 1);
          }
        };

        const handleSkip = () => {
          setShowTutorial(false);
          setTutorialStep(0);
        };

        // Auto-scroll to target element on mobile
        if (targetElement && isMobile) {
          setTimeout(() => {
            const elementTop = targetElement.getBoundingClientRect().top + window.scrollY;
            const offset = 100; // Space from top
            window.scrollTo({
              top: elementTop - offset,
              behavior: 'smooth'
            });
          }, 100);
        }

        return (
          <>
            {/* Dark overlay */}
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                zIndex: 9998,
                pointerEvents: 'none'
              }}
            />

            {/* Highlight spotlight */}
            {targetRect && (
              <div
                style={{
                  position: 'absolute',
                  top: targetRect.top + window.scrollY - (isMobile ? 4 : 8),
                  left: Math.max(0, targetRect.left - (isMobile ? 4 : 8)),
                  width: Math.min(window.innerWidth, targetRect.width + (isMobile ? 8 : 16)),
                  height: targetRect.height + (isMobile ? 8 : 16),
                  border: isMobile ? '2px solid #00558c' : '3px solid #00558c',
                  borderRadius: isMobile ? 6 : 8,
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75), 0 0 20px rgba(0, 85, 140, 0.5)',
                  zIndex: 9999,
                  pointerEvents: 'none',
                  animation: 'pulse 2s infinite'
                }}
              />
            )}

            {/* Tooltip */}
            <div
              className={isMobile ? 'tutorial-tooltip-mobile' : ''}
              style={{
                ...getTooltipPosition(),
                backgroundColor: 'var(--card-bg)',
                boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
                padding: isMobile ? '20px' : '24px',
                maxWidth: isMobile ? '100%' : 400,
                width: isMobile ? '100%' : 'auto',
                zIndex: 10000,
                border: '2px solid #00558c'
              }}
            >
              {/* Step indicator */}
              <div style={{
                fontSize: isMobile ? 11 : 12,
                fontWeight: 600,
                color: '#00558c',
                marginBottom: isMobile ? 6 : 8,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Step {tutorialStep + 1} of {tutorialSteps.length}
              </div>

              {/* Title */}
              <h3 style={{
                margin: '0 0 12px 0',
                fontSize: isMobile ? 18 : 20,
                fontWeight: 600,
                color: 'var(--text-primary)'
              }}>
                {currentStep.title}
              </h3>

              {/* Description */}
              <p style={{
                margin: '0 0 20px 0',
                fontSize: isMobile ? 14 : 15,
                lineHeight: 1.6,
                color: 'var(--text-primary)'
              }}>
                {currentStep.description}
              </p>

              {/* Navigation buttons */}
              <div style={{
                display: 'flex',
                gap: isMobile ? 12 : 8,
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: isMobile ? 'wrap' : 'nowrap'
              }}>
                <button
                  onClick={handleSkip}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: isMobile ? 15 : 14,
                    cursor: 'pointer',
                    padding: isMobile ? '12px 16px' : '8px 12px',
                    textDecoration: 'underline',
                    minHeight: isMobile ? 44 : 'auto',
                    touchAction: 'manipulation'
                  }}
                >
                  Skip Tour
                </button>

                <div style={{ display: 'flex', gap: isMobile ? 12 : 8 }}>
                  {tutorialStep > 0 && (
                    <button
                      onClick={handlePrev}
                      style={{
                        backgroundColor: 'transparent',
                        color: '#00558c',
                        border: '1px solid #00558c',
                        borderRadius: 6,
                        padding: isMobile ? '12px 20px' : '8px 16px',
                        fontSize: isMobile ? 15 : 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                        minHeight: isMobile ? 44 : 'auto',
                        touchAction: 'manipulation'
                      }}
                    >
                      Back
                    </button>
                  )}
                  <button
                    onClick={handleNext}
                    style={{
                      backgroundColor: '#00558c',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      padding: isMobile ? '12px 24px' : '8px 20px',
                      fontSize: isMobile ? 15 : 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      minHeight: isMobile ? 44 : 'auto',
                      touchAction: 'manipulation'
                    }}
                  >
                    {tutorialStep === tutorialSteps.length - 1 ? 'Finish' : 'Next'}
                  </button>
                </div>
              </div>
            </div>

            {/* Add pulse animation and mobile styles */}
            <style>{`
              @keyframes pulse {
                0%, 100% {
                  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.75), 0 0 20px rgba(0, 85, 140, 0.5);
                }
                50% {
                  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.75), 0 0 30px rgba(0, 85, 140, 0.8);
                }
              }
              
              /* Safe area insets for iOS devices with notches */
              @supports (padding: max(0px)) {
                @media (max-width: 767px) {
                  .tutorial-tooltip-mobile {
                    padding-bottom: max(20px, env(safe-area-inset-bottom)) !important;
                  }
                }
              }
            `}</style>
          </>
        );
      })()}
    </div>
  );
};

export default OnboardingHome;


