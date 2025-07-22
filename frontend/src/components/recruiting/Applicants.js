import React, { useState, useRef, useEffect } from 'react';
import { FaRegCopy, FaCheck, FaEllipsisV } from 'react-icons/fa';
import Modal from '../utils/Modal';
import RightDetails from '../utils/RightDetails';
import ContextMenu from '../utils/ContextMenu';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
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
  const [showTeam, setShowTeam] = useState(false);
  const [activeTab, setActiveTab] = useState('applicants');
  const [teamUserIds, setTeamUserIds] = useState([]);
  
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

  const affiliateLink = `https://ariaslife.com/careers/?hm=${userId}`;

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
      await handleAdvanceStep(selectedApplicant.id, "Pre-Lic");
      setHiredModalVisible(false);
      resetHiredForm();
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
        <br />
        <a href={affiliateLink} target="_blank" rel="noopener noreferrer">
          {affiliateLink}
        </a>
      </div>

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
          Hired ({getApplicantsByStep('Pre-Lic').length})
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
            <h3>Hired</h3>
            {renderApplicantTable(getApplicantsByStep('Pre-Lic'), false)}
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