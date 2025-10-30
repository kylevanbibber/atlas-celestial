import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { FiCheck, FiX, FiChevronDown, FiChevronRight, FiUpload, FiPaperclip, FiDownload, FiTrash2, FiUser, FiExternalLink } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import api from '../../../api';
import '../../utils/RightDetails.css';
import './PipelineChecklist.css';

const PipelineChecklistDetails = ({ data, onClose, onSave }) => {
  const { recruit, stages } = data;
  const { user } = useAuth();
  const [checklistItems, setChecklistItems] = useState([]);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedStages, setExpandedStages] = useState({});
  const [saving, setSaving] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploadingItems, setUploadingItems] = useState({});
  const [currentStep, setCurrentStep] = useState(recruit.step); // Track current step for re-rendering
  const fileInputRefs = useRef({});
  const [videoPanels, setVideoPanels] = useState({}); // { [itemId]: { expanded, platform, videoId, durationSec, maxWatchedSec } }
  const youTubePlayersRef = useRef({}); // { [itemId]: YT.Player }
  const vimeoPlayersRef = useRef({}); // { [itemId]: Vimeo.Player }
  const videoIntervalsRef = useRef({}); // { [itemId]: intervalId }
  const [scriptsLoaded, setScriptsLoaded] = useState({ youtube: false, vimeo: false });

  useEffect(() => {
    fetchChecklistData();
  }, [recruit.id]);

  const fetchChecklistData = async () => {
    try {
      setLoading(true);
      
      // Fetch checklist items with state-specific requirements applied
      const itemsResponse = await api.get(`/recruitment/recruits/${recruit.id}/checklist/items`);
      const items = itemsResponse.data.success ? itemsResponse.data.data : [];
      setChecklistItems(items);
      
      // Fetch recruit's progress
      const progressResponse = await api.get(`/recruitment/recruits/${recruit.id}/checklist`);
      const prog = progressResponse.data.success ? progressResponse.data.data : [];
      setProgress(prog);

      // Fetch attachments for this recruit
      const attachmentsResponse = await api.get(`/pipeline-attachments/recruit/${recruit.id}`);
      if (attachmentsResponse.data.success) {
        const atts = attachmentsResponse.data.data || [];
        setAttachments(atts);
      }
      
      // Auto-expand only the current stage (not completed previous stages)
      const expanded = {};
      const currentStage = stages.find(s => 
        s.stage_name.trim().toLowerCase() === (recruit.step || '').trim().toLowerCase()
      );
      
      if (currentStage) {
        expanded[currentStage.id] = true;
      }
      setExpandedStages(expanded);
    } catch (error) {
      console.error('Error fetching checklist data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      // Cleanup any active intervals and players on unmount
      Object.values(videoIntervalsRef.current || {}).forEach((id) => {
        if (id) clearInterval(id);
      });
      Object.values(youTubePlayersRef.current || {}).forEach((player) => {
        try { player && player.destroy && player.destroy(); } catch (_) {}
      });
      Object.values(vimeoPlayersRef.current || {}).forEach((player) => {
        try { player && player.unload && player.unload(); } catch (_) {}
      });
    };
  }, []);

  const ensureScriptLoaded = (url, globalCheck) => {
    return new Promise((resolve, reject) => {
      if (globalCheck && globalCheck()) {
        resolve();
        return;
      }
      const existing = document.querySelector(`script[src="${url}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Script load error')));
        return;
      }
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Script load error'));
      document.body.appendChild(script);
    });
  };

  const ensureYouTubeApi = async () => {
    if (scriptsLoaded.youtube) return;
    await ensureScriptLoaded('https://www.youtube.com/iframe_api', () => !!window.YT && !!window.YT.Player);
    if (!window.YT || !window.YT.Player) {
      await new Promise((resolve) => {
        window.onYouTubeIframeAPIReady = () => resolve();
      });
    }
    setScriptsLoaded((prev) => ({ ...prev, youtube: true }));
  };

  const ensureVimeoApi = async () => {
    if (scriptsLoaded.vimeo) return;
    await ensureScriptLoaded('https://player.vimeo.com/api/player.js', () => !!window.Vimeo);
    setScriptsLoaded((prev) => ({ ...prev, vimeo: true }));
  };

  const parseYouTubeId = (url) => {
    if (!url) return null;
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtu.be')) {
        return u.pathname.replace('/', '');
      }
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const m = u.pathname.match(/\/embed\/([^/?#]+)/);
      return m ? m[1] : null;
    } catch (_) {
      return null;
    }
  };

  const parseVimeoId = (url) => {
    if (!url) return null;
    try {
      const u = new URL(url);
      const m = u.pathname.match(/\/(\d+)/);
      return m ? m[1] : null;
    } catch (_) {
      return null;
    }
  };

  const getVideoMeta = (item) => {
    const url = item?.url || '';
    const name = (item?.item_name || '').toLowerCase();
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return { platform: 'youtube', videoId: parseYouTubeId(url) };
    }
    if (url.includes('vimeo.com')) {
      return { platform: 'vimeo', videoId: parseVimeoId(url) };
    }
    // Fallback on name hints (optional)
    if (name.includes('ail') && name.includes('video')) return { platform: 'youtube', videoId: parseYouTubeId(url) };
    if (name.includes('public') && name.includes('relations')) return { platform: 'vimeo', videoId: parseVimeoId(url) };
    return null;
  };

  const handleAutoCompleteItem = async (item) => {
    const currentProgress = getItemProgress(item.id);
    if (currentProgress?.completed === true) return;
    try {
      await api.post(`/recruitment/recruits/${recruit.id}/checklist`, {
        checklist_item_id: item.id,
        completed: true,
        completed_by: user.userId
      });
      // Update local state
      setProgress((prev) => {
        const existing = prev.find(p => p.checklist_item_id === item.id);
        if (existing) {
          return prev.map(p => p.checklist_item_id === item.id ? {
            ...p,
            completed: true,
            completed_by: user.userId,
            completed_by_name: user.lagnname,
            completed_at: new Date().toISOString()
          } : p);
        }
        return [...prev, {
          checklist_item_id: item.id,
          completed: true,
          completed_by: user.userId,
          completed_by_name: user.lagnname,
          completed_at: new Date().toISOString()
        }];
      });
      // Check and possibly advance stage
      checkAndAdvanceStage();
      toast.success('Video completed. Item marked complete.');
    } catch (e) {
      console.error('Error auto-completing video item:', e);
    }
  };

  const initYouTubePlayer = async (itemId, videoId, item) => {
    await ensureYouTubeApi();
    const elementId = `yt-player-${itemId}`;
    // Destroy previous if exists
    try { youTubePlayersRef.current[itemId]?.destroy?.(); } catch (_) {}

    const player = new window.YT.Player(elementId, {
      videoId,
      playerVars: {
        controls: 1,
        modestbranding: 1,
        rel: 0,
        disablekb: 1
      },
      events: {
        onReady: () => {
          // Start polling time
          const intervalId = setInterval(async () => {
            try {
              const current = player.getCurrentTime();
              const duration = player.getDuration();
              setVideoPanels((prev) => {
                const vp = prev[itemId] || {};
                const max = Math.max(vp.maxWatchedSec || 0, current || 0);
                return { ...prev, [itemId]: { ...vp, durationSec: duration || vp.durationSec || 0, maxWatchedSec: max } };
              });
              // Anti-seek forward
              const vpNow = videoPanels[itemId];
              const allowedMax = (vpNow?.maxWatchedSec || 0) + 1.0;
              if (current > allowedMax) {
                player.seekTo(vpNow?.maxWatchedSec || 0, true);
              }
              if (duration && (videoPanels[itemId]?.maxWatchedSec || 0) >= duration - 1) {
                clearInterval(intervalId);
                videoIntervalsRef.current[itemId] = null;
                handleAutoCompleteItem(item);
              }
            } catch (_) {}
          }, 500);
          videoIntervalsRef.current[itemId] = intervalId;
        },
        onStateChange: (e) => {
          // When ended
          if (e.data === window.YT.PlayerState.ENDED) {
            handleAutoCompleteItem(item);
          }
        }
      }
    });
    youTubePlayersRef.current[itemId] = player;
  };

  const initVimeoPlayer = async (itemId, videoId, item) => {
    await ensureVimeoApi();
    const container = document.getElementById(`vimeo-player-${itemId}`);
    // Destroy previous if exists
    try { await vimeoPlayersRef.current[itemId]?.unload?.(); } catch (_) {}
    const player = new window.Vimeo.Player(container, { id: videoId });
    vimeoPlayersRef.current[itemId] = player;

    let maxWatched = 0;
    player.on('timeupdate', async (data) => {
      const current = data.seconds || 0;
      const duration = data.duration || 0;
      if (current > maxWatched + 1) {
        // Revert forward seek
        try { await player.setCurrentTime(maxWatched); } catch (_) {}
        return;
      }
      maxWatched = Math.max(maxWatched, current);
      setVideoPanels((prev) => ({
        ...prev,
        [itemId]: { ...(prev[itemId] || {}), durationSec: duration, maxWatchedSec: maxWatched }
      }));
      if (duration && maxWatched >= duration - 1) {
        handleAutoCompleteItem(item);
      }
    });
    player.on('ended', () => {
      handleAutoCompleteItem(item);
    });
    player.on('seeked', async (data) => {
      if (data?.seconds && data.seconds > maxWatched + 1) {
        try { await player.setCurrentTime(maxWatched); } catch (_) {}
      }
    });
  };

  const toggleVideoPanel = async (item) => {
    const meta = getVideoMeta(item);
    if (!meta || !meta.videoId) {
      toast.error('Video unavailable for this item.');
      return;
    }
    setVideoPanels((prev) => ({
      ...prev,
      [item.id]: { ...(prev[item.id] || {}), expanded: !(prev[item.id]?.expanded), platform: meta.platform, videoId: meta.videoId }
    }));
    const willExpand = !(videoPanels[item.id]?.expanded);
    if (willExpand) {
      // Initialize player after panel opens in next tick so container exists
      setTimeout(() => {
        if (meta.platform === 'youtube') {
          initYouTubePlayer(item.id, meta.videoId, item);
        } else if (meta.platform === 'vimeo') {
          initVimeoPlayer(item.id, meta.videoId, item);
        }
      }, 0);
    } else {
      // Collapse: cleanup
      try {
        const pY = youTubePlayersRef.current[item.id];
        pY && pY.destroy && pY.destroy();
        youTubePlayersRef.current[item.id] = null;
      } catch (_) {}
      try {
        const pV = vimeoPlayersRef.current[item.id];
        pV && pV.unload && pV.unload();
        vimeoPlayersRef.current[item.id] = null;
      } catch (_) {}
      const intId = videoIntervalsRef.current[item.id];
      if (intId) clearInterval(intId);
      videoIntervalsRef.current[item.id] = null;
    }
  };

  const getItemProgress = (itemId) => {
    return progress.find(p => p.checklist_item_id === itemId);
  };

  const getStageCompletion = (stageName) => {
    const stageItems = checklistItems.filter(item => item.stage_name === stageName);
    if (stageItems.length === 0) return { completed: 0, total: 0, percentage: 0 };
    
    const completed = stageItems.filter(item => {
      const itemProgress = getItemProgress(item.id);
      return itemProgress?.completed; // Check truthy (works for 1, true, etc.)
    }).length;
    
    return {
      completed,
      total: stageItems.length,
      percentage: Math.round((completed / stageItems.length) * 100)
    };
  };

  const toggleStage = (stageId) => {
    setExpandedStages(prev => ({
      ...prev,
      [stageId]: !prev[stageId]
    }));
  };

  // Check if current stage is complete and advance to next stage
  const checkAndAdvanceStage = async (updatedProgress = null) => {
    console.log('=== CHECKING STAGE ADVANCEMENT ===');
    console.log('Current stage:', currentStep);
    
    // Use provided progress or current state
    const progressToCheck = updatedProgress || progress;
    console.log('Progress array length:', progressToCheck.length);
    
    // Get current stage items and their completion status
    const currentStageItems = checklistItems.filter(item => item.stage_name === currentStep);
    console.log('Current stage items:', currentStageItems.length);
    
    if (currentStageItems.length === 0) {
      console.log('❌ No items in current stage');
      return;
    }

    // Check each item in detail
    console.log('Checking each item:');
    const itemChecks = currentStageItems.map(item => {
      const itemProgress = progressToCheck.find(p => p.checklist_item_id === item.id);
      
      // For checkbox items: check completed flag
      // For other items (text, select, date, etc.): check if value exists
      let isComplete;
      const itemType = item.item_type || 'checkbox'; // Default to checkbox if not set
      
      if (itemType === 'checkbox' || !item.item_type) {
        // Checkbox or no type specified - check completed flag
        isComplete = itemProgress?.completed === true;
      } else {
        // For input fields (select, text, date, etc.), consider complete if they have a value
        isComplete = !!(itemProgress?.value && String(itemProgress.value).trim() !== '');
      }
      
      const isRequired = item.is_required;
      const blocks = isRequired && !isComplete;
      
      console.log(`  - "${item.item_name}" (${itemType})`);
      console.log(`    Required: ${isRequired}, Complete: ${isComplete}, Completed: ${itemProgress?.completed}, Value: "${itemProgress?.value || ''}", Blocks: ${blocks}`);
      
      return { item, itemProgress, isComplete, isRequired, blocks };
    });

    // Check if all required items are completed
    const blockingItems = itemChecks.filter(check => check.blocks);
    const allCompleted = blockingItems.length === 0;

    if (!allCompleted) {
      console.log('❌ Stage NOT complete. Blocking items:', blockingItems.map(b => b.item.item_name));
      return;
    }

    console.log('✅ All required items complete!');

    // Find next stage
    const currentStageIndex = stages.findIndex(s => s.stage_name === currentStep);
    if (currentStageIndex === -1) {
      console.log('❌ Current stage not found in stages array');
      return;
    }
    
    if (currentStageIndex >= stages.length - 1) {
      console.log('❌ Already at last stage');
      return;
    }

    const nextStage = stages[currentStageIndex + 1];
    console.log('➡️ Advancing to next stage:', nextStage.stage_name);

    try {
      // Update the recruit's stage in database
      await api.put(`/recruitment/recruits/${recruit.id}/step`, {
        step: nextStage.stage_name
      });

      // Update local state to trigger re-render
      recruit.step = nextStage.stage_name;
      setCurrentStep(nextStage.stage_name);

      // Collapse current stage and expand the new stage
      setExpandedStages({
        [nextStage.id]: true
      });

      // Notify parent to refresh the table
      if (onSave) {
        onSave();
      }

      console.log('✅ Successfully advanced to:', nextStage.stage_name);
      
      // Show success toast notification
      toast.success(`All required items complete! ${recruit.recruit_first} ${recruit.recruit_last} moved to ${nextStage.stage_name}`, {
        duration: 4000,
        icon: '🎉',
      });
    } catch (error) {
      console.error('❌ Error advancing stage:', error);
      toast.error('Error advancing to next stage. Please try again.');
    }
  };

  const handleToggleItem = async (item) => {
    const currentProgress = getItemProgress(item.id);
    const newCompleted = !currentProgress?.completed;

    // Prevent manual checking of system-controlled items
    if (isSystemControlled(item)) {
      toast.error('This item is automatically set by the system and cannot be manually checked.');
      return;
    }

    // Check if item requires proof and has no attachments when trying to check it
    if (newCompleted && needsProof(item)) {
      const itemAttachments = getItemAttachments(item.id);
      if (itemAttachments.length === 0) {
        toast.error('Please upload a file before marking this item as complete.');
        return;
      }
    }

    try {
      await api.post(`/recruitment/recruits/${recruit.id}/checklist`, {
        checklist_item_id: item.id,
        completed: newCompleted,
        completed_by: newCompleted ? user.userId : null
      });

      // Update local state
      const updatedProgressArray = await new Promise(resolve => {
        setProgress(prev => {
          const existing = prev.find(p => p.checklist_item_id === item.id);
          const newProgress = existing
            ? prev.map(p => 
                p.checklist_item_id === item.id 
                  ? { 
                      ...p, 
                      completed: newCompleted, 
                      completed_by: newCompleted ? user.userId : null, 
                      completed_by_name: newCompleted ? user.lagnname : null,
                      completed_at: newCompleted ? new Date().toISOString() : null 
                    }
                  : p
              )
            : [...prev, {
                checklist_item_id: item.id,
                completed: newCompleted,
                completed_by: newCompleted ? user.userId : null,
                completed_by_name: newCompleted ? user.lagnname : null,
                completed_at: newCompleted ? new Date().toISOString() : null
              }];
          
          // Resolve with the new progress after state update
          setTimeout(() => resolve(newProgress), 0);
          return newProgress;
        });
      });

      // Check if stage is complete and advance if needed (pass updated progress)
      if (newCompleted) {
        checkAndAdvanceStage(updatedProgressArray);
      }
    } catch (error) {
      console.error('Error updating checklist item:', error);
    }
  };

  const handleValueChange = async (item, value) => {
    try {
      setSaving(true);
      await api.post(`/recruitment/recruits/${recruit.id}/checklist`, {
        checklist_item_id: item.id,
        value: value,
        completed_by: user.userId
      });

      // Update local state
      setProgress(prev => {
        const existing = prev.find(p => p.checklist_item_id === item.id);
        if (existing) {
          return prev.map(p => 
            p.checklist_item_id === item.id 
              ? { ...p, value }
              : p
          );
        } else {
          return [...prev, {
            checklist_item_id: item.id,
            value,
            completed: false
          }];
        }
      });
    } catch (error) {
      console.error('Error updating checklist value:', error);
    } finally {
      setSaving(false);
    }
  };

  // Get attachments for a specific checklist item
  const getItemAttachments = (itemId) => {
    return attachments.filter(att => att.checklist_item_id === itemId);
  };

  // Check if item needs proof attachment
  const needsProof = (item) => {
    const itemText = `${item.item_name} ${item.item_description || ''}`.toLowerCase();
    return itemText.includes('attach proof') || 
           itemText.includes('receive license approval') ||
           itemText.includes('license approval');
  };

  // Check if item is system-controlled (cannot be manually checked)
  const isSystemControlled = (item) => {
    const itemName = item.item_name.toLowerCase();
    return itemName.includes('receive agent number') || 
           itemName.includes('activate agent number') ||
           itemName.includes('agent number');
  };

  // Handle file selection and upload
  const handleFileSelect = async (item, event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setUploadingItems(prev => ({ ...prev, [item.id]: true }));

      const formData = new FormData();
      formData.append('file', file);
      formData.append('recruit_id', recruit.id);
      formData.append('checklist_item_id', item.id);
      formData.append('file_category', 'proof');
      formData.append('description', `Proof for: ${item.item_name}`);

      const response = await api.post('/pipeline-attachments/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        // Refresh attachments
        const attachmentsResponse = await api.get(`/pipeline-attachments/recruit/${recruit.id}`);
        if (attachmentsResponse.data.success) {
          setAttachments(attachmentsResponse.data.data || []);
        }
        toast.success('File uploaded successfully!');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Error uploading file. Please try again.');
    } finally {
      setUploadingItems(prev => ({ ...prev, [item.id]: false }));
      if (fileInputRefs.current[item.id]) {
        fileInputRefs.current[item.id].value = '';
      }
    }
  };

  // Handle file download/view (prefer direct ariaslife.com URL when available)
  const handleFileDownload = async (attachment) => {
    try {
      const filePath = attachment?.file_url || attachment?.file_path;
      if (filePath) {
        const absoluteUrl = filePath.startsWith('http')
          ? filePath
          : `https://ariaslife.com/uploads/uploads/pipeline/${filePath}`;
        window.open(absoluteUrl, '_blank');
      } else if (attachment?.id) {
        // Fallback to API redirect if file_path not present
        window.open(`/api/pipeline-attachments/download/${attachment.id}`, '_blank');
      }
    } catch (error) {
      console.error('Error opening file:', error);
      toast.error('Error opening file. Please try again.');
    }
  };

  // Handle file deletion
  const handleFileDelete = async (attachmentId, itemId) => {
    if (!window.confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      const response = await api.delete(`/pipeline-attachments/${attachmentId}`);
      
      if (response.data.success) {
        setAttachments(prev => prev.filter(att => att.id !== attachmentId));
        toast.success('File deleted successfully!');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Error deleting file. Please try again.');
    }
  };

  // Trigger file input click
  const triggerFileInput = (itemId) => {
    if (fileInputRefs.current[itemId]) {
      fileInputRefs.current[itemId].click();
    }
  };

  const renderInput = (item) => {
    const itemProgress = getItemProgress(item.id);
    const value = itemProgress?.value || '';

    // Default to checkbox if item_type is null or undefined
    const itemType = item.item_type || 'checkbox';

    if (itemType === 'checkbox' || !item.item_type) {
      return null; // Checkbox is the main toggle
    } else if (itemType === 'text') {
      return (
        <input
          type="text"
          className="checklist-input"
          value={value}
          onChange={(e) => handleValueChange(item, e.target.value)}
          placeholder={item.item_description || ''}
        />
      );
    } else if (itemType === 'textarea') {
      return (
        <textarea
          className="checklist-textarea"
          value={value}
          onChange={(e) => handleValueChange(item, e.target.value)}
          placeholder={item.item_description || ''}
        />
      );
    } else if (itemType === 'select' && item.item_options) {
      // Parse JSON options
      let options = [];
      try {
        options = JSON.parse(item.item_options);
      } catch (e) {
        console.error('Error parsing item_options:', e);
        options = item.item_options.split(',').map(opt => opt.trim());
      }
      return (
        <select
          className="checklist-select"
          value={value}
          onChange={(e) => handleValueChange(item, e.target.value)}
        >
          <option value="">Select...</option>
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }
    return null;
  };

  const totalItems = checklistItems.length;
  const completedItems = checklistItems.filter(item => {
    const itemProgress = getItemProgress(item.id);
    return itemProgress?.completed; // Check truthy (works for 1, true, etc.)
  }).length;
  const overallPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div className="checklist-loading">
          <div className="pipeline-loading-spinner"></div>
          <span>Loading checklist...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      overflow: 'hidden',
      paddingTop: '8px'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        flexShrink: 0,
        padding: '24px 20px',
        paddingTop: '28px',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--card-bg)',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
          <FiUser style={{ fontSize: '24px', marginTop: '4px', color: 'var(--primary-color)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ 
              margin: 0, 
              marginTop: '35px',
              marginBottom: '8px', 
              fontSize: '1.35rem', 
              fontWeight: 600, 
              color: 'var(--text-primary)',
              lineHeight: '1.4'
            }}>
              {recruit.recruit_first} {recruit.recruit_last}
            </h2>
            <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
              📧 {recruit.email}
            </p>
            <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
              📞 {recruit.phone}
            </p>
            <div style={{ 
              display: 'inline-block',
              padding: '4px 12px', 
              fontSize: '13px', 
              fontWeight: 600, 
              color: 'white',
              background: 'var(--primary-color)', 
              borderRadius: '12px' 
            }}>
              Current: {currentStep}
            </div>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="close-button"
          style={{ flexShrink: 0 }}
        >
          <FiX />
        </button>
      </div>

      {/* Progress Summary Bar */}
      <div style={{
        padding: '16px',
        background: 'var(--secondary-background, #f5f7fa)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Overall Progress
          </div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {completedItems} / {totalItems} Complete
          </div>
        </div>
        <div className="progress-circle">
          <svg viewBox="0 0 36 36" style={{ width: '70px', height: '70px' }}>
            <g transform="rotate(-90 18 18)">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="var(--border-color, #e0e0e0)"
                strokeWidth="3"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="var(--primary-color, #00558c)"
                strokeWidth="3"
                strokeDasharray={`${overallPercentage}, 100`}
              />
            </g>
            <text x="18" y="20.35" style={{
              fill: 'var(--text-primary, #333)',
              fontSize: '8px',
              fontWeight: 'bold',
              textAnchor: 'middle',
              dominantBaseline: 'middle'
            }}>
              {overallPercentage}%
            </text>
          </svg>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        overflowX: 'hidden',
        padding: '16px',
        minHeight: 0,
        WebkitOverflowScrolling: 'touch'
      }}>
        {checklistItems.length === 0 && !loading && (
          <div style={{ 
            padding: '20px', 
            textAlign: 'center', 
            color: 'var(--text-secondary)' 
          }}>
            No checklist items found. Please contact your administrator.
          </div>
        )}
        
        <div className="checklist-stages" style={{ paddingBottom: '40px' }}>
        {stages.map(stage => {
          // Filter by stage_name instead of stage_id
          const stageItems = checklistItems.filter(item => item.stage_name === stage.stage_name);
          
          if (stageItems.length === 0) return null;

          const isCurrentStage = stage.stage_name === recruit.step;
          const isExpanded = expandedStages[stage.id];
          const completion = getStageCompletion(stage.stage_name);

          return (
            <div
              key={stage.id}
              className={`checklist-stage ${isCurrentStage ? 'current' : ''}`}
            >
              {/* Stage Header */}
              <div
                className="checklist-stage-header"
                onClick={() => toggleStage(stage.id)}
              >
                <div className="stage-header-left">
                  <div
                    className="stage-indicator"
                    style={{ backgroundColor: stage.stage_color || '#3498db' }}
                  />
                  <h4>{stage.stage_name}</h4>
                  {isCurrentStage && <span className="current-badge">Current</span>}
                </div>

                <div className="stage-header-right">
                  <div className="stage-progress-bar">
                    <div
                      className="stage-progress-fill"
                      style={{ width: `${completion.percentage}%` }}
                    />
                  </div>
                  <div className="stage-completion">
                    {completion.completed}/{completion.total}
                  </div>
                  {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
                </div>
              </div>

              {/* Stage Items */}
              {isExpanded && (
                <div className="checklist-items">
                  {stageItems.map(item => {
                    const itemProgress = getItemProgress(item.id);
                    const isCompleted = Boolean(itemProgress?.completed);
                    const itemAttachments = getItemAttachments(item.id);
                    const showAttachments = needsProof(item);
                    const needsFileUpload = needsProof(item) && itemAttachments.length === 0 && !isCompleted;
                    const systemControlled = isSystemControlled(item);
                    const isDisabled = needsFileUpload || systemControlled;
                    
                    return (
                      <div key={item.id} className={`checklist-item ${isCompleted ? 'completed' : ''}`}>
                        <div className="checklist-item-main">
                          <div className="checklist-item-info">
                            <div
                              className={`checklist-checkbox ${isCompleted ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}`}
                              onClick={() => handleToggleItem(item)}
                              title={systemControlled ? 'System controlled - cannot be manually checked' : needsFileUpload ? 'Upload a file before checking' : ''}
                              style={isDisabled ? { cursor: 'not-allowed', opacity: 0.5 } : {}}
                            >
                              {isCompleted && <FiCheck size={16} />}
                            </div>

                            <div className="checklist-item-text">
                              <label 
                                onClick={() => handleToggleItem(item)}
                                style={isDisabled ? { cursor: 'not-allowed', opacity: 0.7 } : {}}
                                title={systemControlled ? 'System controlled - cannot be manually checked' : needsFileUpload ? 'Upload a file before checking' : ''}
                              >
                                {item.item_name}
                                {item.is_required === 1 && <span className="required-star">*</span>}
                                {systemControlled && (
                                  <span className="state-badge" style={{ 
                                    backgroundColor: '#9c27b0',
                                    color: 'white',
                                    fontSize: '11px',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    marginLeft: '6px'
                                  }} title="Automatically set by the system">
                                    System
                                  </span>
                                )}
                                {item.state_specific && (
                                  <span className="state-badge state-specific" title={`Required only in ${recruit.resident_state}`}>
                                    {recruit.resident_state}
                                  </span>
                                )}
                                {item.state_modified && !item.state_specific && (
                                  <span className="state-badge state-modified" title="Modified for this state">
                                    Modified
                                  </span>
                                )}
                              </label>
                              {item.item_description && (
                                <p className="item-description">{item.item_description}</p>
                              )}
                              {(() => {
                                const meta = getVideoMeta(item);
                                const hasVideo = !!meta && !!meta.videoId;
                                return (
                                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                    {item.url && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.open(item.url, '_blank', 'noopener,noreferrer');
                                        }}
                                        className="url-button"
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          padding: '6px 12px',
                                          fontSize: '13px',
                                          color: '#fff',
                                          backgroundColor: '#00558c',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          transition: 'background-color 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.target.style.backgroundColor = '#003d66'}
                                        onMouseLeave={(e) => e.target.style.backgroundColor = '#00558c'}
                                        title="Open external link"
                                      >
                                        <FiExternalLink size={14} />
                                        Visit Link
                                      </button>
                                    )}
                                    {hasVideo && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); toggleVideoPanel(item); }}
                                        className="url-button"
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          padding: '6px 12px',
                                          fontSize: '13px',
                                          color: '#fff',
                                          backgroundColor: '#4a7c2c',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          transition: 'background-color 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.target.style.backgroundColor = '#3a611f'}
                                        onMouseLeave={(e) => e.target.style.backgroundColor = '#4a7c2c'}
                                        title="Watch video"
                                      >
                                        {videoPanels[item.id]?.expanded ? 'Hide Video' : 'Watch Video'}
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {renderInput(item)}

                          {/* Attachments Section */}
                          {showAttachments && (
                            <div className="checklist-item-attachments">
                              <input
                                ref={el => fileInputRefs.current[item.id] = el}
                                type="file"
                                onChange={(e) => handleFileSelect(item, e)}
                                style={{ display: 'none' }}
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                              />
                              
                              <div className="attachments-header">
                                <FiPaperclip style={{ fontSize: '14px', color: '#666' }} />
                                <span>Attachments ({itemAttachments.length})</span>
                                <button
                                  onClick={() => triggerFileInput(item.id)}
                                  disabled={uploadingItems[item.id]}
                                  className="upload-btn"
                                >
                                  {uploadingItems[item.id] ? (
                                    <>Uploading...</>
                                  ) : (
                                    <>
                                      <FiUpload style={{ marginRight: '4px' }} />
                                      Upload File
                                    </>
                                  )}
                                </button>
                              </div>

                              {itemAttachments.length > 0 && (
                                <div className="attachments-list">
                                  {itemAttachments.map(att => (
                                    <div key={att.id} className="attachment-item">
                                      <div
                                        className="attachment-info clickable"
                                        onClick={() => handleFileDownload(att)}
                                        title="View / Download"
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handleFileDownload(att);
                                          }
                                        }}
                                      >
                                        <FiPaperclip style={{ fontSize: '12px', color: '#666' }} />
                                        <span className="attachment-name">{att.file_name}</span>
                                        <span className="attachment-size">
                                          ({(att.file_size / 1024).toFixed(1)} KB)
                                        </span>
                                      </div>
                                      <div className="attachment-actions">
                                        <button
                                          onClick={() => handleFileDownload(att)}
                                          className="attachment-action-btn"
                                          title="Download"
                                        >
                                          <FiDownload />
                                        </button>
                                        <button
                                          onClick={() => handleFileDelete(att.id, item.id)}
                                          className="attachment-action-btn delete"
                                          title="Delete"
                                        >
                                          <FiTrash2 />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Video Dropdown */}
                        {videoPanels[item.id]?.expanded && (
                          <div style={{
                            marginTop: '10px',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '10px',
                            background: 'var(--secondary-background, #f7f9fc)'
                          }}>
                            {videoPanels[item.id]?.platform === 'youtube' && (
                              <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '6px' }}>
                                <div id={`yt-player-${item.id}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}></div>
                              </div>
                            )}
                            {videoPanels[item.id]?.platform === 'vimeo' && (
                              <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '6px' }}>
                                <div id={`vimeo-player-${item.id}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}></div>
                              </div>
                            )}
                            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                              Forward seeking is disabled. Item will auto-complete when the video is fully watched.
                            </div>
                          </div>
                        )}

                        {/* Item Meta */}
                        {isCompleted && itemProgress && (
                          <div className="checklist-item-meta">
                            <span className="completed-by">
                              Completed by: {itemProgress.completed_by_name || itemProgress.completed_by || 'Unknown'}
                            </span>
                            {itemProgress.completed_at && (
                              <span className="completed-date">
                                {new Date(itemProgress.completed_at).toLocaleDateString()}
                              </span>
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
      </div>
    </div>
  );
};

export default PipelineChecklistDetails;

