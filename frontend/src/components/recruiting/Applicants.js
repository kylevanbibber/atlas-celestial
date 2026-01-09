import React, { useState, useRef, useEffect } from 'react';
import { FaRegCopy, FaCheck, FaEllipsisV, FaDownload, FaQrcode, FaTrash, FaVideo } from 'react-icons/fa';
import QRCode from 'qrcode';
import Modal from '../utils/Modal';
import RightDetails from '../utils/RightDetails';
import ContextMenu from '../utils/ContextMenu';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import toast from 'react-hot-toast';
import './Applicants.css';

const Applicants = () => {
  const { user } = useAuth();
  const userId = user?.userId;
  const userRole = user?.Role || user?.clname;
  const isAdmin = userRole === "Admin" || userId === "101";
  const isManager = ['SA', 'GA', 'MGA', 'RGA'].includes(userRole);
  
  // State management
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [qrCopied, setQrCopied] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [activeTab, setActiveTab] = useState('applicants');
  const [teamUserIds, setTeamUserIds] = useState([]);
  
  // Custom videos state
  const [customVideos, setCustomVideos] = useState([]);
  const [availableTeams, setAvailableTeams] = useState([]);
  const [videoLoading, setVideoLoading] = useState(false);
  const [showCustomizeForm, setShowCustomizeForm] = useState(false);
  const [videoForm, setVideoForm] = useState({
    target_mga: '',
    video_url: '',
    video_type: 'youtube'
  });
  
  // Modal states
  const [finalTimeModalVisible, setFinalTimeModalVisible] = useState(false);
  const [callbackTimeModalVisible, setCallbackTimeModalVisible] = useState(false);
  const [hiredModalVisible, setHiredModalVisible] = useState(false);
  
  // RightDetails state
  const [showRightDetails, setShowRightDetails] = useState(false);
  const [rightDetailsData, setRightDetailsData] = useState(null);
  
  // Selected applicant and form data
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [finalDate, setFinalDate] = useState('');
  const [finalTime, setFinalTime] = useState('');
  const [callbackDate, setCallbackDate] = useState('');
  const [callbackTime, setCallbackTime] = useState('');
  const [residentState, setResidentState] = useState('');
  const [enrolled, setEnrolled] = useState('');
  const [course, setCourse] = useState('');
  const [expectedCompleteDate, setExpectedCompleteDate] = useState('');

  // Context menu state
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuApplicant, setContextMenuApplicant] = useState(null);

  const affiliateLink = userId === "26911" 
    ? `https://agents.ariaslife.com/careers`
    : `https://agents.ariaslife.com/careers?hm=${userId}`;

  // Fetch team hierarchy data for managers
  const fetchTeamData = async () => {
    if (!isManager && !isAdmin) return;
    
    try {
      const response = await api.post('/auth/searchByUserId', { 
        userId: userId 
      });

      if (response.data.success) {
        const userIds = response.data.data.map(user => user.id);
        // Include current user in team view
        const allTeamIds = userIds.includes(parseInt(userId)) ? userIds : [...userIds, parseInt(userId)];
        setTeamUserIds(allTeamIds);
      } else {
        console.error('Failed to fetch team hierarchy:', response.data.message);
      }
    } catch (err) {
      console.error('Error fetching team data:', err);
    }
  };

  // Load team data on component mount for managers
  useEffect(() => {
    if (isManager || isAdmin) {
      fetchTeamData();
    }
  }, [userId, isManager, isAdmin]);

  // Load applicants on component mount
  useEffect(() => {
    loadApplicants();
  }, [showTeam, userId, teamUserIds]);

  // Generate QR code on component mount
  useEffect(() => {
    generateQRCode();
  }, [userId]);

  const loadApplicants = async () => {
    try {
      setLoading(true);
      setError(''); // Clear any previous errors
      
      let endpoint;
      if (isAdmin) {
        // Admins see all recruits or team recruits
        endpoint = showTeam ? '/recruitment/recruits' : `/recruitment/recruits/agent/${userId}`;
      } else if (isManager && showTeam && teamUserIds.length > 0) {
        // Managers see their team's recruits
        endpoint = `/recruitment/recruits/team`;
        const response = await api.post(endpoint, { userIds: teamUserIds });
        setApplicants(Array.isArray(response.data) ? response.data : []);
        return;
      } else {
        // Regular users or managers viewing personal recruits
        endpoint = `/recruitment/recruits/agent/${userId}`;
      }
      
      const response = await api.get(endpoint);
      
      // Ensure response.data is an array
      setApplicants(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error loading applicants:', error);
      setError('Failed to load applicants');
      setApplicants([]); // Reset to empty array on error
    } finally {
      setLoading(false);
    }
  };

  // Filter applicants by step
  const getApplicantsByStep = (step) => {
    if (!Array.isArray(applicants)) return [];
    return applicants.filter(applicant => applicant.step === step);
  };

  // Format utilities
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return '';
    const date = new Date(dateTimeString);
    return date.toLocaleString('en-US', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatApplicantName = (first, middle, last, suffix) => {
    return [first, middle, last, suffix].filter(Boolean).join(' ');
  };

  // Actions
  const handleCopy = () => {
    navigator.clipboard.writeText(affiliateLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    });
  };

  // QR Code functions
  const generateQRCode = async () => {
    try {
      const qrUrl = await QRCode.toDataURL(affiliateLink, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeUrl(qrUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const handleCopyQR = async () => {
    try {
      // Convert data URL to blob
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      
      // Copy to clipboard
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      
      setQrCopied(true);
      setTimeout(() => setQrCopied(false), 4000);
    } catch (error) {
      console.error('Error copying QR code:', error);
      // Fallback: copy the affiliate link text instead
      navigator.clipboard.writeText(affiliateLink).then(() => {
        setQrCopied(true);
        setTimeout(() => setQrCopied(false), 4000);
      });
    }
  };

  const handleDownloadQR = () => {
    if (!qrCodeUrl) return;
    
    const link = document.createElement('a');
    link.download = `recruiting-qr-code-${userId}.png`;
    link.href = qrCodeUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleToggleView = () => {
    setShowTeam(prevState => !prevState);
  };

  const handleShowDetails = (applicant) => {
    // Format the applicant name for display
    const fullName = formatApplicantName(
      applicant.recruit_first,
      applicant.recruit_middle,
      applicant.recruit_last,
      applicant.recruit_suffix
    );
    
    // Format the date for display
    const formattedDateAdded = formatDateTime(applicant.date_added);
    
    // Prepare data for the right details panel
    const detailsData = {
      ...applicant,
      fullName,
      formattedDateAdded,
      __isApplicantDetails: true
    };
    
    setRightDetailsData(detailsData);
    setShowRightDetails(true);
  };

  const handleAdvanceStep = async (applicantId, newStep) => {
    try {
      await api.put(`/recruitment/recruits/${applicantId}/step`, { step: newStep });
      loadApplicants(); // Reload data
    } catch (error) {
      console.error('Error updating step:', error);
      setError('Failed to update applicant step');
    }
  };

  const handleMoveToApplicants = async (applicantId) => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      'Are you sure you want to move this applicant back to the main applicants list? This will reset their status to "Careers Form".'
    );
    
    if (!confirmed) return;

    try {
      await api.put(`/recruitment/recruits/${applicantId}/step`, { step: 'Careers Form' });
      loadApplicants(); // Reload data
    } catch (error) {
      console.error('Error moving applicant:', error);
      setError('Failed to move applicant back to applicants list');
    }
  };

  const handleUpdateFinalTime = async () => {
    if (!selectedApplicant || !finalDate || !finalTime) return;
    
    try {
      const finalDateTime = `${finalDate} ${finalTime}`;
      await api.put(`/recruitment/recruits/${selectedApplicant.id}/final-time`, { 
        final_time: finalDateTime 
      });
      await handleAdvanceStep(selectedApplicant.id, "Final");
      setFinalTimeModalVisible(false);
      resetFinalTimeForm();
    } catch (error) {
      console.error('Error updating final time:', error);
      setError('Failed to update final time');
    }
  };

  const handleUpdateCallbackTime = async () => {
    if (!selectedApplicant || !callbackDate || !callbackTime) return;
    
    try {
      const callbackDateTime = `${callbackDate} ${callbackTime}`;
      await api.put(`/recruitment/recruits/${selectedApplicant.id}/callback-time`, { 
        callback_time: callbackDateTime 
      });
      await handleAdvanceStep(selectedApplicant.id, "Callback - Career Form");
      setCallbackTimeModalVisible(false);
      resetCallbackTimeForm();
    } catch (error) {
      console.error('Error updating callback time:', error);
      setError('Failed to update callback time');
    }
  };

  const handleSaveHiredInfo = async () => {
    if (!selectedApplicant) return;
    
    try {
      await api.put(`/recruitment/recruits/${selectedApplicant.id}/pre-lic`, {
        resident_state: residentState,
        enrolled,
        course,
        expected_complete_date: expectedCompleteDate
      });
      // Backend now automatically sets step to "Licensing" and completes checklist items
      setHiredModalVisible(false);
      resetHiredForm();
      loadApplicants(); // Reload to show updated data
    } catch (error) {
      console.error('Error saving hired info:', error);
      setError('Failed to save hired information');
    }
  };

  // Reset form functions
  const resetFinalTimeForm = () => {
    setFinalDate('');
    setFinalTime('');
    setSelectedApplicant(null);
  };

  const resetCallbackTimeForm = () => {
    setCallbackDate('');
    setCallbackTime('');
    setSelectedApplicant(null);
  };

  const resetHiredForm = () => {
    setResidentState('');
    setEnrolled('');
    setCourse('');
    setExpectedCompleteDate('');
    setSelectedApplicant(null);
  };

  // Quick action handlers
  const handleQuickAction = (applicant, action) => {
    setSelectedApplicant(applicant);
    
    switch (action) {
      case 'booked-final':
        setFinalTimeModalVisible(true);
        break;
      case 'callback':
        setCallbackTimeModalVisible(true);
        break;
      case 'hired':
        setHiredModalVisible(true);
        break;
      case 'not-interested':
        handleAdvanceStep(applicant.id, 'Not Interested');
        break;
      case 'no-answer':
        handleAdvanceStep(applicant.id, 'No Answer - Career Form');
        break;
      default:
        break;
    }
  };

  // Context menu handlers
  const showContextMenu = (e, applicant) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuApplicant(applicant);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuVisible(true);
  };

  const hideContextMenu = () => {
    setContextMenuVisible(false);
    setContextMenuApplicant(null);
  };

  const getContextMenuOptions = (applicant) => {
    const options = [
      {
        label: 'Book Final',
        onClick: () => handleQuickAction(applicant, 'booked-final'),
        className: 'primary-action'
      },
      {
        label: 'Schedule Callback',
        onClick: () => handleQuickAction(applicant, 'callback'),
        className: 'secondary-action'
      },
      {
        label: 'Hired',
        onClick: () => handleQuickAction(applicant, 'hired'),
        className: 'primary-action'
      },
      {
        label: 'Not Interested',
        onClick: () => handleQuickAction(applicant, 'not-interested'),
        className: 'secondary-action'
      },
      {
        label: 'No Answer',
        onClick: () => handleQuickAction(applicant, 'no-answer'),
        className: 'secondary-action'
      }
    ];

    // Add "Move to Applicants" option if the applicant is not already in Careers Form
    if (applicant.step && applicant.step !== 'Careers Form') {
      options.push({
        label: 'Move to Applicants',
        onClick: () => handleMoveToApplicants(applicant.id),
        className: 'move-action'
      });
    }

    return options;
  };

  // Render applicant table
  const renderApplicantTable = (applicantList, showActions = true) => (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th>Recruiting Agent</th>
            <th>Applicant</th>
            <th>Res State</th>
            <th>Date</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Source</th>
            {showActions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {applicantList.map((applicant) => (
            <tr 
              key={applicant.id} 
              className="clickable-row"
              onClick={() => handleShowDetails(applicant)}
              onContextMenu={(e) => showContextMenu(e, applicant)}
            >
              <td>{applicant.lagnname}</td>
              <td>{formatApplicantName(applicant.recruit_first, applicant.recruit_middle, applicant.recruit_last, applicant.recruit_suffix)}</td>
              <td>{applicant.resident_state}</td>
              <td>{formatDateTime(applicant.date_added)}</td>
              <td>{applicant.phone}</td>
              <td>{applicant.email}</td>
              <td>{applicant.referral_source}</td>
              {showActions && (
                <td onClick={(e) => showContextMenu(e, applicant)}>
                  <FaEllipsisV className="action-icon" />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Custom video management functions
  const loadCustomVideos = async () => {
    if (!isManager) return;
    
    try {
      setVideoLoading(true);
      const [videosRes, teamsRes] = await Promise.all([
        api.get('/careers-videos'),
        api.get('/careers-videos/available-teams')
      ]);
      
      if (videosRes.data.success) {
        setCustomVideos(videosRes.data.videos || []);
      }
      
      if (teamsRes.data.success) {
        setAvailableTeams(teamsRes.data.teams || []);
      }
    } catch (error) {
      console.error('Error loading custom videos:', error);
      toast.error('Failed to load custom videos');
    } finally {
      setVideoLoading(false);
    }
  };

  const handleVideoSubmit = async (e) => {
    e.preventDefault();
    
    if (!videoForm.video_url) {
      toast.error('Please enter a video URL');
      return;
    }
    
    // Sanitize and validate URL
    let url = String(videoForm.video_url).trim();
    if (url && !/^https?:\/\//i.test(url)) {
      url = `https://${url}`; // ensure protocol
    }
    // Validate URL is YouTube or Vimeo
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
    const isVimeo = url.includes('vimeo.com');
    
    if (!isYouTube && !isVimeo) {
      toast.error('Please enter a valid YouTube or Vimeo URL');
      return;
    }
    
    try {
      setVideoLoading(true);
      const payload = {
        target_mga: videoForm.target_mga || null,
        video_url: url,
        video_type: isYouTube ? 'youtube' : 'vimeo'
      };
      const response = await api.post('/careers-videos', payload);
      
      if (response.data.success) {
        toast.success(response.data.action === 'created' ? 'Video added successfully!' : 'Video updated successfully!');
        setVideoForm({ target_mga: '', video_url: '', video_type: 'youtube' });
        loadCustomVideos();
      }
    } catch (error) {
      console.error('Error saving video:', error?.response?.data || error?.message || error);
      toast.error(error?.response?.data?.error || error?.response?.data?.message || 'Failed to save video');
    } finally {
      setVideoLoading(false);
    }
  };

  const handleDeleteVideo = async (videoId) => {
    if (!window.confirm('Are you sure you want to delete this custom video?')) {
      return;
    }
    
    try {
      setVideoLoading(true);
      const response = await api.delete(`/careers-videos/${videoId}`);
      
      if (response.data.success) {
        toast.success('Video deleted successfully!');
        loadCustomVideos();
      }
    } catch (error) {
      console.error('Error deleting video:', error);
      toast.error('Failed to delete video');
    } finally {
      setVideoLoading(false);
    }
  };

  const extractVideoId = (url, type) => {
    if (type === 'youtube') {
      const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
      return match ? match[1] : null;
    } else if (type === 'vimeo') {
      const match = url.match(/vimeo\.com\/(?:.*\/)?(\d+)/);
      return match ? match[1] : null;
    }
    return null;
  };

  // Load custom videos for managers on mount
  useEffect(() => {
    if (isManager) {
      loadCustomVideos();
    }
  }, [isManager]);

  if (loading) {
    return <div className="padded-content">Loading applicants...</div>;
  }

  return (
    <div className="padded-content">
      {/* Error display */}
      {error && (
        <div className="settings-alert settings-alert-error">
          {error}
        </div>
      )}

      {/* Affiliate Link Section */}
      <div className="affiliate-link-section">
        <p style={{ fontSize: '14px', display: 'inline-flex', alignItems: 'center', marginBottom: '10px' }}>
          My Affiliate Link 
          <span onClick={handleCopy} style={{ marginLeft: '10px', cursor: 'pointer' }}>
            {copied ? <FaCheck color="green" /> : <FaRegCopy />}
          </span>
        </p>
        <a href={affiliateLink} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginBottom: '10px' }}>
          {affiliateLink}
        </a>
        <p style={{ fontSize: '14px', display: 'inline-flex', alignItems: 'center', marginBottom: '10px' }}>
          <FaQrcode style={{ marginRight: '8px' }} /> QR Code
        </p>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', justifyContent: 'center', marginBottom: '15px' }}>
          <button 
            onClick={handleCopyQR}
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer',
              fontSize: '14px',
              color: qrCopied ? 'green' : '#666',
              padding: '5px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
            title="Copy QR Code"
          >
            {qrCopied ? <FaCheck /> : <FaRegCopy />}
            {qrCopied ? 'Copied!' : 'Copy QR'}
          </button>
          <button 
            onClick={handleDownloadQR}
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer',
              fontSize: '14px',
              color: '#666',
              padding: '5px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
            title="Download QR Code"
          >
            <FaDownload />
            Download QR
          </button>
        </div>
        
        {/* Customize Form Button for Managers */}
        {isManager && (
          <div style={{ textAlign: 'center', marginTop: '15px' }}>
            <button
              onClick={() => setShowCustomizeForm(!showCustomizeForm)}
              className="primary-button"
              style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: '0 auto'
              }}
            >
              <FaVideo />
              {showCustomizeForm ? 'Close' : 'Customize Form'}
            </button>
          </div>
        )}
      </div>

      {/* Custom Video Form - Shows when button is clicked */}
      {showCustomizeForm && isManager && (
        <div style={{ marginBottom: '30px' }}>
          <div style={{ 
            background: 'var(--card-bg)', 
            padding: '20px', 
            borderRadius: '8px', 
            border: '1px solid var(--border-color)'
          }}>
            <h3>Custom Careers Page Video</h3>
            <p style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
              Set a custom YouTube or Vimeo video to display on your careers page. 
              When someone visits your affiliate link, they'll see this video instead of the default.
            </p>

            {/* Video Form */}
            <div style={{ 
              background: 'var(--card-bg)', 
              padding: '20px', 
              borderRadius: '8px', 
              marginBottom: '30px',
              border: '1px solid var(--border-color)'
            }}>
              <h4>Add/Update Custom Video</h4>
              <form onSubmit={handleVideoSubmit}>
                {availableTeams.length > 0 && (
                  <div className="form-group" style={{ marginBottom: '15px' }}>
                    <label>Apply To:</label>
                    <select
                      value={videoForm.target_mga}
                      onChange={(e) => setVideoForm({ ...videoForm, target_mga: e.target.value })}
                      className="settings-row select"
                      style={{ width: '100%' }}
                      
                    >
                      <option value="">Select Targeting Level...</option>
                      {availableTeams.map((team, index) => (
                        <option key={`${team.value}-${index}`} value={team.value}>
                          {team.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <label>Video URL:</label>
                  <input
                    type="url"
                    value={videoForm.video_url}
                    onChange={(e) => setVideoForm({ ...videoForm, video_url: e.target.value })}
                    placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..."
                    className="settings-row input"
                    style={{ width: '100%' }}
                    required
                  />
                  <small style={{ color: 'var(--text-secondary)', marginTop: '5px', display: 'block' }}>
                    Enter a YouTube or Vimeo URL
                  </small>
                </div>

                <button 
                  type="submit" 
                  className="primary-button"
                  disabled={videoLoading}
                >
                  {videoLoading ? 'Saving...' : 'Save Video'}
                </button>
              </form>
            </div>

            {/* Current Videos List */}
            <div>
              <h4>Your Custom Videos</h4>
              {videoLoading && <p>Loading videos...</p>}
              
              {!videoLoading && customVideos.length === 0 && (
                <p style={{ color: 'var(--text-secondary)' }}>
                  No custom videos configured yet. Add one above to get started!
                </p>
              )}

              {!videoLoading && customVideos.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {customVideos.map(video => (
                    <div 
                      key={video.id} 
                      style={{ 
                        background: 'var(--card-bg)', 
                        padding: '20px', 
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                        <div>
                          <h5 style={{ margin: '0 0 5px 0' }}>
                            {video.target_mga 
                              ? (video.target_mga.startsWith('RGA:') 
                                  ? `RGA`
                                  : video.target_mga.startsWith('TREE:')
                                  ? `Tree`
                                  : video.target_mga.startsWith('MGA:')
                                  ? `MGA`
                                  : video.target_mga)
                              : 'Default'}
                          </h5>
                          <p style={{ margin: '0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {video.video_type === 'youtube' ? 'YouTube' : 'Vimeo'} Video
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteVideo(video.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#e74c3c',
                            cursor: 'pointer',
                            padding: '5px 10px',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                          title="Delete video"
                        >
                          <FaTrash /> Delete
                        </button>
                      </div>

                      {/* Video Preview */}
                      <div style={{ marginTop: '10px' }}>
                        {video.video_type === 'youtube' && extractVideoId(video.video_url, 'youtube') && (
                          <iframe
                            width="100%"
                            height="315"
                            src={`https://www.youtube.com/embed/${extractVideoId(video.video_url, 'youtube')}`}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            title="Video preview"
                            style={{ borderRadius: '8px' }}
                          />
                        )}
                        {video.video_type === 'vimeo' && extractVideoId(video.video_url, 'vimeo') && (
                          <iframe
                            src={`https://player.vimeo.com/video/${extractVideoId(video.video_url, 'vimeo')}`}
                            width="100%"
                            height="315"
                            frameBorder="0"
                            allow="autoplay; fullscreen; picture-in-picture"
                            allowFullScreen
                            title="Video preview"
                            style={{ borderRadius: '8px' }}
                          />
                        )}
                      </div>

                      <p style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                        URL: {video.video_url}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toggle View - Only show for managers/admins */}
      {(isManager || isAdmin) && (
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <button
            onClick={handleToggleView}
            className="primary-button"
          >
            {showTeam 
              ? (isAdmin ? 'Show My Applicants' : 'Show My Applicants') 
              : (isAdmin ? 'Show All Applicants' : 'Show Team Applicants')
            }
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="settings-tabs">
        <button 
          className={`settings-tab ${activeTab === 'applicants' ? 'active' : ''}`} 
          onClick={() => setActiveTab('applicants')}
        >
          Applicants ({getApplicantsByStep('Careers Form').length})
        </button>
        <button 
          className={`settings-tab ${activeTab === 'no-answer' ? 'active' : ''}`} 
          onClick={() => setActiveTab('no-answer')}
        >
          No Answer ({getApplicantsByStep('No Answer - Career Form').length})
        </button>
        <button 
          className={`settings-tab ${activeTab === 'callback' ? 'active' : ''}`} 
          onClick={() => setActiveTab('callback')}
        >
          Callback ({getApplicantsByStep('Callback - Career Form').length})
        </button>
        <button 
          className={`settings-tab ${activeTab === 'booked-final' ? 'active' : ''}`} 
          onClick={() => setActiveTab('booked-final')}
        >
          Booked Final ({getApplicantsByStep('Final').length})
        </button>
        <button 
          className={`settings-tab ${activeTab === 'not-interested' ? 'active' : ''}`} 
          onClick={() => setActiveTab('not-interested')}
        >
          Not Interested ({getApplicantsByStep('Not Interested').length})
        </button>
        <button 
          className={`settings-tab ${activeTab === 'hired' ? 'active' : ''}`} 
          onClick={() => setActiveTab('hired')}
        >
          Hired ({getApplicantsByStep('Licensing').length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'applicants' && (
          <div>
            <h3>Career Form Applicants</h3>
            {renderApplicantTable(getApplicantsByStep('Careers Form'))}
          </div>
        )}
        
        {activeTab === 'no-answer' && (
          <div>
            <h3>No Answer - Career Form</h3>
            {renderApplicantTable(getApplicantsByStep('No Answer - Career Form'))}
          </div>
        )}
        
        {activeTab === 'callback' && (
          <div>
            <h3>Callback Scheduled</h3>
            {renderApplicantTable(getApplicantsByStep('Callback - Career Form'))}
          </div>
        )}
        
        {activeTab === 'booked-final' && (
          <div>
            <h3>Booked Final</h3>
            {renderApplicantTable(getApplicantsByStep('Final'))}
          </div>
        )}
        
        {activeTab === 'not-interested' && (
          <div>
            <h3>Not Interested</h3>
            {renderApplicantTable(getApplicantsByStep('Not Interested'), false)}
          </div>
        )}
        
        {activeTab === 'hired' && (
          <div>
            <h3>Hired - Licensing</h3>
            {renderApplicantTable(getApplicantsByStep('Licensing'), false)}
          </div>
        )}
      </div>



      {/* Final Time Modal */}
      <Modal
        isOpen={finalTimeModalVisible}
        onClose={() => setFinalTimeModalVisible(false)}
        title="Set Final Time"
      >
        <div className="form-group">
          <label>Date:</label>
          <input
            type="date"
            value={finalDate}
            onChange={(e) => setFinalDate(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Time:</label>
          <input
            type="time"
            value={finalTime}
            onChange={(e) => setFinalTime(e.target.value)}
          />
        </div>
        <div className="form-actions">
          <button className="primary-button" onClick={handleUpdateFinalTime}>
            Save
          </button>
          <button className="secondary-button" onClick={() => setFinalTimeModalVisible(false)}>
            Cancel
          </button>
        </div>
      </Modal>

      {/* Callback Time Modal */}
      <Modal
        isOpen={callbackTimeModalVisible}
        onClose={() => setCallbackTimeModalVisible(false)}
        title="Set Callback Time"
      >
        <div className="form-group">
          <label>Date:</label>
          <input
            type="date"
            value={callbackDate}
            onChange={(e) => setCallbackDate(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Time:</label>
          <input
            type="time"
            value={callbackTime}
            onChange={(e) => setCallbackTime(e.target.value)}
          />
        </div>
        <div className="form-actions">
          <button className="primary-button" onClick={handleUpdateCallbackTime}>
            Save
          </button>
          <button className="secondary-button" onClick={() => setCallbackTimeModalVisible(false)}>
            Cancel
          </button>
        </div>
      </Modal>

      {/* Hired Modal */}
      <Modal
        isOpen={hiredModalVisible}
        onClose={() => setHiredModalVisible(false)}
        title="Pre-Licensing Information"
      >
        <div className="form-group">
          <label>Resident State:</label>
          <select value={residentState} onChange={(e) => setResidentState(e.target.value)}>
            <option value="">Select State</option>
            <option value="AL">Alabama</option>
            <option value="AK">Alaska</option>
            <option value="AZ">Arizona</option>
            <option value="AR">Arkansas</option>
            <option value="CA">California</option>
            <option value="CO">Colorado</option>
            <option value="CT">Connecticut</option>
            <option value="DE">Delaware</option>
            <option value="FL">Florida</option>
            <option value="GA">Georgia</option>
            <option value="HI">Hawaii</option>
            <option value="ID">Idaho</option>
            <option value="IL">Illinois</option>
            <option value="IN">Indiana</option>
            <option value="IA">Iowa</option>
            <option value="KS">Kansas</option>
            <option value="KY">Kentucky</option>
            <option value="LA">Louisiana</option>
            <option value="ME">Maine</option>
            <option value="MD">Maryland</option>
            <option value="MA">Massachusetts</option>
            <option value="MI">Michigan</option>
            <option value="MN">Minnesota</option>
            <option value="MS">Mississippi</option>
            <option value="MO">Missouri</option>
            <option value="MT">Montana</option>
            <option value="NE">Nebraska</option>
            <option value="NV">Nevada</option>
            <option value="NH">New Hampshire</option>
            <option value="NJ">New Jersey</option>
            <option value="NM">New Mexico</option>
            <option value="NY">New York</option>
            <option value="NC">North Carolina</option>
            <option value="ND">North Dakota</option>
            <option value="OH">Ohio</option>
            <option value="OK">Oklahoma</option>
            <option value="OR">Oregon</option>
            <option value="PA">Pennsylvania</option>
            <option value="RI">Rhode Island</option>
            <option value="SC">South Carolina</option>
            <option value="SD">South Dakota</option>
            <option value="TN">Tennessee</option>
            <option value="TX">Texas</option>
            <option value="UT">Utah</option>
            <option value="VT">Vermont</option>
            <option value="VA">Virginia</option>
            <option value="WA">Washington</option>
            <option value="WV">West Virginia</option>
            <option value="WI">Wisconsin</option>
            <option value="WY">Wyoming</option>
          </select>
        </div>
        <div className="form-group">
          <label>Enrolled:</label>
          <select value={enrolled} onChange={(e) => setEnrolled(e.target.value)}>
            <option value="">Select</option>
            <option value="y">Yes</option>
            <option value="n">No</option>
          </select>
        </div>
        <div className="form-group">
          <label>Course:</label>
          <input
            type="text"
            value={course}
            onChange={(e) => setCourse(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Expected Completion Date:</label>
          <input
            type="date"
            value={expectedCompleteDate}
            onChange={(e) => setExpectedCompleteDate(e.target.value)}
          />
        </div>
        <div className="form-actions">
          <button className="primary-button" onClick={handleSaveHiredInfo}>
            Save
          </button>
          <button className="secondary-button" onClick={() => setHiredModalVisible(false)}>
            Cancel
          </button>
        </div>
      </Modal>
      
      {/* Right Details Panel */}
      {showRightDetails && rightDetailsData && (
        <RightDetails
          fromPage="Applicants"
          data={rightDetailsData}
          onClose={() => {
            setShowRightDetails(false);
            setRightDetailsData(null);
          }}
          onSave={async (updatedData) => {
            // Handle saving updated applicant data
            try {
              if (updatedData.id) {
                await api.put(`/recruitment/recruits/${updatedData.id}`, updatedData);
              }
              // Reload the data to reflect changes
              await loadApplicants();
              return true;
            } catch (error) {
              console.error('Error saving applicant data:', error);
              setError('Failed to save applicant changes');
              return false;
            }
          }}
          // Pass action handlers for ApplicantDetails
          onQuickAction={handleQuickAction}
          onMoveToApplicants={handleMoveToApplicants}
          onAdvanceStep={handleAdvanceStep}
          // Pass modal handlers
          onShowFinalModal={(applicant) => {
            setSelectedApplicant(applicant);
            setFinalTimeModalVisible(true);
          }}
          onShowCallbackModal={(applicant) => {
            setSelectedApplicant(applicant);
            setCallbackTimeModalVisible(true);
          }}
          onShowHiredModal={(applicant) => {
            setSelectedApplicant(applicant);
            setHiredModalVisible(true);
          }}
        />
      )}

      {/* Context Menu */}
      {contextMenuVisible && contextMenuApplicant && (
        <ContextMenu
          options={getContextMenuOptions(contextMenuApplicant)}
          style={{
            position: 'fixed',
            top: contextMenuPosition.y,
            left: contextMenuPosition.x,
            zIndex: 1000
          }}
          onClose={hideContextMenu}
        />
      )}
    </div>
  );
};

export default Applicants; 