import React, { useState, useEffect, useMemo } from "react";
import { FaLock, FaLockOpen, FaDownload, FaSpinner, FaCheckCircle, FaTimesCircle, FaEye } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import RoleplayModal from "./RoleplayModal";
import { useProgress } from "./ProgressContext";
import DataTable from "../utils/DataTable";
import api from "../../api";
import "./Checklist.css";

const Checklist = () => {
  const [responses, setResponses] = useState({});
  const { progress, setProgress } = useProgress();
  const [countdown, setCountdown] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModalContent, setActiveModalContent] = useState("");
  const [isReleaseScheduled, setIsReleaseScheduled] = useState(false);
  const [onReleaseList, setOnReleaseList] = useState(false);
  const [releaseScheduledDate, setReleaseScheduledDate] = useState(null);
  const [isReleased, setIsReleased] = useState(false);
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [reviewerOptions, setReviewerOptions] = useState([]);
  const [totalRowsThisWeek, setTotalRowsThisWeek] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Get user data from auth context
  const { user } = useAuth();
  const userId = user?.userId;
  const userRole = user?.clname;

  const roleplayContent = {
    "entrance_start": (
      <>
        <h4>Group Benefits Review</h4>
        <p>Hi, Joe! Can you hear and see me okay? Alright, awesome!</p>
        <p><strong>Build rapport using F.O.R.M. (1-2 minutes)</strong></p>
        <ul>
          <li><strong>Family:</strong> I see that you live in CITY, how long have you lived there?</li>
          <li><strong>Occupation:</strong> Joe, what do you do for your job? How do you like doing that?</li>
          <li><strong>Recreation:</strong> So, when you're not working so hard, what do you like to do for fun?</li>
          <li><strong>Me:</strong> Relate to them any way that you can and show interest in the member.</li>
        </ul>
      </>
    ),
    "referral_open": (
      <>
        <h4>Referral Opening</h4>
        <p>This is the referral opening script content...</p>
      </>
    ),
    "texting_referral": (
      <>
        <h4>Texting/Setting Referral from Home</h4>
        <p>This is the texting referral script content...</p>
      </>
    ),
    "closing_rebuttals": (
      <>
        <h4>Closing & 2 Rebuttals</h4>
        <p>This is the closing and rebuttals script content...</p>
      </>
    ),
    "personal_recruit": (
      <>
        <h4>Personal Recruiting</h4>
        <p>This is the personal recruiting script content...</p>
      </>
    ),
  };

  const sections = {
    Preparation: {
      arias_training: "*Arias Organization Optional Training Completed",
      booking_done: "*Phones Video Filmed and Reviewed",
      video_done: "*Final Video Filmed and Reviewed",
      leadership_track: "*Understand Leadership Track",
      sale_1k: "*At least 1 sale, $1,000 ALP",
      practice_pres: "*10 Practice Presentations",
      refs_25: "*25 Refs Collected in Impact",
      build_team: "*Do you want to build a team?",
      know_team: "*Do you know how to build a team?",
      contract_2nd: "How long to activate your second contract?",
      bonus_90d: "How much is the recruiting bonus? (first 90 days)",
      bonus_after_90d: "How much is the recruiting bonus? (after 90 days)",
      ready_release: "*Do you feel ready to be released at this point?",
      know_more: "What would you like to know more about at this point?",
    },
    RolePlay: {
      entrance_start: "*Entrance From Beginning",
      referral_open: "*Referral Opening",
      texting_referral: "*Texting/Setting Referral from Home",
      closing_rebuttals: "*Closing & 2 Rebuttals",
      personal_recruit: "*Personal Recruiting",
    },
    VideoReview: {
      reviewed_by: "Reviewed By",
      on_script: "*On Script",
      warmup_conf: "*Effective Confident Warm-Up",
      create_need: "*Strong Ability to Create Need",
      sale_cemented: "*Cemented the Sale",
      would_sell: "*Would the Person Sell You",
    },
    Numbers: {
      ride_days_trainee: "Ride Days (Trainee)",
      ride_days_trainer: "Ride Days (Trainer)",
      pres_done_trainee: "Presentations Done (Trainee)",
      pres_done_trainer: "Presentations Done (Trainer)",
      ref_pres_done_trainee: "Referral Presentations Done (Trainee)",
      ref_pres_done_trainer: "Referral Presentations Done (Trainer)",
      ref_sold_trainee: "Referrals Sold (Trainee)",
      ref_sold_trainer: "Referrals Sold (Trainer)",
      ref_collected_trainee: "Referrals Collected (Trainee)",
      ref_collected_trainer: "Referrals Collected (Trainer)",
      sales_done_trainee: "Sales Made (Trainee)",
      sales_done_trainer: "Sales Made (Trainer)",
      alp_written_trainee: "ALP Written (Trainee)",
      alp_written_trainer: "ALP Written (Trainer)",
      appts_set_trainee: "Appointments Set (Trainee)",
      appts_set_trainer: "Appointments Set (Trainer)",
      recruits_trainee: "Recruits Collected (Trainee)",
      recruits_trainer: "Recruits Collected (Trainer)",
    },
    Expectations: {
      appts_weekly: "Weekly Appointments Set",
      pres_weekly: "Weekly Presentations",
      refs_per_home: "Referrals Collected Per Home",
      alp_week: "ALP Per Week",
      start_wkdy: "What time do you start? (Weekdays)",
      start_wknd: "What time do you start? (Weekends)",
    },
  };

  const correctAnswers = {
    contract_2nd: "45",
    bonus_90d: "750",
    bonus_after_90d: "250",
  };

  // Create table data from sections
  const tableData = useMemo(() => {
    const data = [];
    
    Object.entries(sections).forEach(([sectionName, questions]) => {
      // Add section header row
      data.push({
        id: `section-${sectionName}`,
        section: sectionName,
        task: `📋 ${sectionName}`,
        completed: null,
        response: null,
        type: 'section-header',
        isSectionHeader: true,
      });

      // Add question rows
      Object.entries(questions).forEach(([key, question]) => {
        const questionType = getQuestionType(key, sectionName);
        
        data.push({
          id: key,
          section: sectionName,
          task: question,
          completed: questionType === 'checkbox' ? (responses[key] || false) : null,
          response: responses[key] || '',
          type: questionType,
          key: key,
          options: getQuestionOptions(key, sectionName),
        });
      });
    });

    return data;
  }, [responses, reviewerOptions]);

  // Determine question type based on key and section
  const getQuestionType = (key, section) => {
    if (key === 'practice_pres' || key === 'refs_25') return 'slider';
    if (key === 'reviewed_by') return 'dropdown';
    if (key === 'know_more') return 'textarea';
    if (key === 'start_wkdy' || key === 'start_wknd') return 'time';
    if (key === 'contract_2nd' || key === 'bonus_90d' || key === 'bonus_after_90d') return 'number';
    if (section === 'RolePlay') return 'roleplay';
    if (section === 'Numbers') return 'number';
    if (section === 'Expectations' && !key.includes('start_')) return 'number';
    return 'checkbox';
  };

  // Get options for dropdown questions
  const getQuestionOptions = (key, section) => {
    if (key === 'reviewed_by') return reviewerOptions;
    return null;
  };

  // Define table columns
  const columns = useMemo(() => [
    {
      Header: "Task",
      accessor: "task",
      width: 300,
      Cell: ({ row, value }) => {
        if (row.original.isSectionHeader) {
          return (
            <div className="section-header-cell">
              <strong>{value}</strong>
            </div>
          );
        }
        return <span>{value}</span>;
      }
    },
    {
      Header: "Completed",
      accessor: "completed",
      width: 100,
      Cell: ({ row, value }) => {
        if (row.original.isSectionHeader) return null;
        if (row.original.type !== 'checkbox') return null;
        
        return (
          <input
            type="checkbox"
            checked={value || false}
            onChange={(e) => handleCheckboxChange(row.original.key, e.target.checked)}
            className="table-checkbox"
          />
        );
      }
    },
    {
      Header: "Response / Action",
      accessor: "response",
      width: 300,
      Cell: ({ row, value }) => {
        if (row.original.isSectionHeader) return null;
        
        return renderResponseCell(row.original, value);
      }
    }
  ], [responses, reviewerOptions]);

  // Render different response cell types
  const renderResponseCell = (rowData, value) => {
    const { type, key, options } = rowData;

    switch (type) {
      case 'slider':
        const maxValue = key === 'practice_pres' ? 10 : 25;
        return (
          <div className="slider-container">
            <input
              type="range"
              min="0"
              max={maxValue}
              value={value || 0}
              onChange={(e) => handleInputChange(key, parseInt(e.target.value))}
              className="table-slider"
            />
            <span className="slider-value">{value || 0} / {maxValue}</span>
          </div>
        );

      case 'roleplay':
        return (
          <div className="roleplay-container">
            <input
              type="checkbox"
              checked={responses[key] || false}
              onChange={(e) => handleCheckboxChange(key, e.target.checked)}
              className="table-checkbox"
            />
            <button
              onClick={() => openModal(key)}
              className="view-script-button"
            >
              <FaEye /> View Script
            </button>
          </div>
        );

      case 'dropdown':
        return (
          <select
            value={value || ''}
            onChange={(e) => handleInputChange(key, e.target.value)}
            className="table-select"
          >
            <option value="">Select Reviewer</option>
            {options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'textarea':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => handleInputChange(key, e.target.value)}
            onBlur={() => handleInputBlur(key)}
            className="table-textarea"
            placeholder="Please share what you'd like to know more about..."
            rows="2"
          />
        );

      case 'time':
        return (
          <input
            type="time"
            value={value || ''}
            onChange={(e) => handleInputChange(key, e.target.value)}
            onBlur={() => handleInputBlur(key)}
            className="table-time"
          />
        );

      case 'number':
        const isValidated = correctAnswers[key];
        const borderColor = isValidated ? getBorderColor(key) : 'var(--border-color)';
        const validationIcon = isValidated ? getValidationIcon(key) : null;
        
        return (
          <div className="number-input-container">
            <input
              type="number"
              min="0"
              value={value || ''}
              onChange={(e) => handleInputChange(key, e.target.value)}
              onBlur={() => handleInputBlur(key)}
              className="table-number"
              style={{ borderColor }}
            />
            {key === 'contract_2nd' && <span className="input-suffix">days</span>}
            {validationIcon}
          </div>
        );

      default:
        return null;
    }
  };

  // Function to determine the border color based on the value
  const getBorderColor = (key) => {
    if (responses[key] === correctAnswers[key]) {
      return "var(--success-color)";
    } else if (responses[key] && responses[key] !== correctAnswers[key]) {
      return "var(--error-color)";
    }
    return "var(--border-color)";
  };

  // Function to get validation icon
  const getValidationIcon = (key) => {
    if (responses[key] === correctAnswers[key]) {
      return <FaCheckCircle style={{ color: "var(--success-color)", marginLeft: "8px" }} />;
    } else if (responses[key] && responses[key] !== correctAnswers[key]) {
      return <FaTimesCircle style={{ color: "var(--error-color)", marginLeft: "8px" }} />;
    }
    return null;
  };

  // Define the keys to include in progress calculation
  const progressKeys = [
    ...Object.keys(sections.Preparation),
    ...Object.keys(sections.RolePlay),
    ...Object.keys(sections.VideoReview),
  ];
  
  // Exclude optional fields from progress calculation
  const excludeKeys = ["know_more", "reviewed_by"];
  const filteredProgressKeys = progressKeys.filter((key) => !excludeKeys.includes(key));
  
  // Total items in Preparation section with increments for practice_pres and refs_25
  const totalProgressItems = filteredProgressKeys.length + 10 + 25;

  const openModal = (content) => {
    const modalContent = roleplayContent[content] || content;
    setActiveModalContent(modalContent);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setActiveModalContent("");
  };

  // Calculate next Friday midnight in EST
  const getNextFridayMidnight = () => {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const daysUntilFriday = (6 - dayOfWeek + 7) % 7 || 7;
    const nextFridayMidnightUTC = new Date(now);
    nextFridayMidnightUTC.setUTCDate(now.getUTCDate() + daysUntilFriday);
    nextFridayMidnightUTC.setUTCHours(5, 1, 0, 0);
    return nextFridayMidnightUTC;
  };

  const getCurrentWeekRange = () => {
    const now = new Date();
    const currentDay = now.getDay();

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((currentDay + 1) % 7));
    weekStart.setUTCHours(5, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setUTCHours(23, 59, 59, 999);

    return { weekStart, weekEnd };
  };

  // Fetch agents if user is not a regular agent
  useEffect(() => {
    if (!userRole || !userId) return;
    if (userRole === "AGT") {
      setIsLoading(false);
      return;
    }

    const fetchAgents = async () => {
      try {
        setIsLoading(true);
        let response;
        if (userRole === "Admin") {
          response = await api.get("/release/get-unreleased-users-checklist");
        } else {
          response = await api.post("/users/search", { userId });
        }

        if (response.data.success) {
          setAgents(response.data.data);
        } else {
          console.error("Failed to fetch agents:", response.data.message);
        }
      } catch (err) {
        console.error("Error fetching agents list:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgents();
  }, [userRole, userId]);

const handleAgentSelection = async (event) => {
  const selectedId = event.target.value;

  if (!selectedId) {
    console.warn("No agent selected.");
    return;
  }

  setIsLoading(true);
  const selectedAgentData = agents.find(agent => agent.id === parseInt(selectedId, 10));

  if (!selectedAgentData) {
    console.error("Selected agent data not found.");
    setIsLoading(false);
    return;
  }

  setOnReleaseList(false);
  setSelectedAgent(selectedAgentData);
  setReviewerOptions(
    [selectedAgentData.sa, selectedAgentData.ga, selectedAgentData.mga, selectedAgentData.rga].filter(Boolean)
  );
  
  await fetchChecklistData(selectedAgentData.id);
  const releaseStatus = await checkReleaseScheduled(selectedAgentData.id);
  setOnReleaseList(releaseStatus.success);
  
  setIsLoading(false);
};

  const checkReleaseScheduled = async (agentId) => {
    const userIdToUse = agentId || userId;

    try {
      const response = await api.get('/release/check-release-scheduled', { params: { userId: userIdToUse } });
      const result = response.data;

      const { weekStart, weekEnd } = getCurrentWeekRange();
      
      setIsReleaseScheduled(result.isScheduled);
      setReleaseScheduledDate(result.release_scheduled);

      if (result.allRowsResult) {
        const rowsThisWeek = result.allRowsResult.filter((row) => {
          const submissionDate = new Date(row.time_submitted);
          return submissionDate >= weekStart && submissionDate <= weekEnd && row.release_scheduled === null;
        });

        setTotalRowsThisWeek(rowsThisWeek.length);
      }

      return result;
    } catch (error) {
      console.error("Error checking release schedule status:", error);
      return { success: false };
    }
  };

  // Auto-load data for AGT users
  useEffect(() => {
    if (!userRole || !userId) return;
    if (userRole === "AGT") {
      setIsLoading(true);
      fetchChecklistData(userId);
      checkReleaseScheduled(userId);
    }
  }, [userRole, userId]);

  // Initialize countdown timer
  useEffect(() => {
    const targetTime = getNextFridayMidnight();

    const updateCountdown = () => {
      const now = new Date();
      const timeDifference = targetTime - now;

      if (timeDifference <= 0) {
        setCountdown("Time's up!");
        return;
      }

      const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeDifference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((timeDifference / (1000 * 60)) % 60);
      const seconds = Math.floor((timeDifference / 1000) % 60);

      setCountdown(`${days > 0 ? `${days}d ` : ""}${hours}h ${minutes}m ${seconds}s`);
    };

    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, []);

  const calculateProgress = () => {
    let completedItems = filteredProgressKeys.filter((key) => {
      if (key === "contract_2nd") {
        return responses[key] === correctAnswers[key];
      }
      if (key === "bonus_90d") {
        return responses[key] === correctAnswers[key];
      }
      if (key === "bonus_after_90d") {
        return responses[key] === correctAnswers[key];
      }
      return responses[key];
    }).length;

    completedItems += Math.min(responses.practice_pres || 0, 10);
    completedItems += Math.min(responses.refs_25 || 0, 25);

    setProgress((completedItems / totalProgressItems) * 100);
  };

  const fetchChecklistData = async (agentId) => {
    const userIdToUse = agentId || userId;
    
    try {
      const response = await api.get('/release/get-checklist', { params: { userId: userIdToUse } });
      const data = response.data;

      if (data.success && data.checklist) {
        setResponses(data.checklist);
        setIsReleased(data.checklist.released === 1);
      }
    } catch (error) {
      console.error("Error fetching checklist data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProgress = async (updates) => {
    const userIdToUse = selectedAgent?.id || userId;
    
    try {
      setIsSaving(true);
      await api.post('/release/update-progress', {
        userId: userIdToUse,
        updates,
      });
    } catch (error) {
      console.error("Error updating progress:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCheckboxChange = (key, newValue) => {
    setResponses({ ...responses, [key]: newValue });
    updateProgress({ [key]: newValue });
  };

  const handleInputChange = (key, value) => {
    setResponses({ ...responses, [key]: value });
    updateProgress({ [key]: value });
  };

  const handleInputBlur = (key) => {
    const value = responses[key];
    updateProgress({ [key]: value });
  };

  const handleScheduleReleaseCall = async () => {
    try {
      setIsSaving(true);
      const response = await api.post('/release/schedule-release', {
        userId: userId,
      });

      if (response.data.success) {
        setOnReleaseList(true);
        alert('Release call scheduled successfully!');
      } else {
        alert('Error scheduling release call: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error scheduling release call:', error);
      alert('Error scheduling release call');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    fetchChecklistData();
  }, [userId]);

  useEffect(() => {
    calculateProgress();
  }, [responses]);

  // Show loading state if user data is not available
  if (!user || !userId || !userRole || isLoading) {
    return (
      <div className="route-loading" role="alert" aria-busy="true">
        <div className="spinner"></div>
        <p>Loading checklist data...</p>
      </div>
    );
  }

  return (
    <div className="checklist-container">
      {/* Agent Selection Dropdown for managers/admins */}
      {userRole !== "AGT" && (
        <div className="agent-selection">
          <label htmlFor="agent-select">Select Agent:</label>
          <select
            id="agent-select"
            value={selectedAgent?.id || ""}
            onChange={handleAgentSelection}
            aria-label="Select an agent to view their checklist"
          >
            <option value="">-- Select an Agent --</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.first_name} {agent.last_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Release Schedule Information */}
      {userRole === "AGT" && (
        <div className="release-schedule-info">
          {totalRowsThisWeek < 10 ? (
            onReleaseList ? (
              isReleaseScheduled ? (
                <div className="scheduled-info">
                  <p><strong>🎯 Zoom Meeting Info:</strong></p>
                  <p>
                    <a href="https://zoom.us/j/6233180376" target="_blank" rel="noopener noreferrer">
                      Join Zoom Meeting
                    </a>
                  </p>
                  <p><strong>Meeting ID:</strong> 623 318 0376</p>
                  <p><strong>Password:</strong> 1234</p>
                </div>
              ) : (
                <p>✅ Your request to join the release call was successful. Please check back Saturday for your release call time.</p>
              )
            ) : (
              <button
                onClick={handleScheduleReleaseCall}
                disabled={progress < 100 || onReleaseList || isSaving}
                className={progress === 100 && !onReleaseList ? "unlocked-link" : "locked-link"}
                aria-label={progress === 100 ? "Schedule your release call" : "Complete all sections to unlock scheduling"}
              >
                <span className="link-icon">
                  {isSaving ? <FaSpinner className="spinner" /> : (progress === 100 ? <FaLockOpen /> : <FaLock />)}
                </span>
                {isSaving ? "Scheduling..." : (progress === 100 ? "Schedule Release Call" : "Complete All Sections to Unlock")}
              </button>
            )
          ) : (
            <p className="full-release-message">
              ⚠️ Release calls are full for this week. Please request scheduling for next week.
            </p>
          )}
        </div>
      )}

      {/* Progress Bar */}
      <div className="progress-bar-container">
        <div className="progress-percentage">
          {Math.round(progress)}% Complete
        </div>
        <div className="checklist-progress-bar" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
          <div className="checklist-progress-bar-fill" style={{ width: `${progress}%` }}></div>
        </div>
        {countdown && (
          <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            ⏰ Time remaining: {countdown}
          </div>
        )}
      </div>

      {/* Roleplay Modal */}
      <RoleplayModal
        isOpen={isModalOpen}
        onClose={closeModal}
        content={activeModalContent}
      />

      {/* Checklist Table */}
      <div className="checklist-table-container">
        <DataTable
          columns={columns}
          data={tableData}
          disablePagination={true}
          showActionBar={false}
          disableCellEditing={true}
          stickyHeader={true}
          rowClassNames={Object.fromEntries(
            tableData
              .filter(row => row.isSectionHeader)
              .map(row => [row.id, 'section-header-row'])
          )}
        />
      </div>
      
      {/* Saving indicator */}
      {isSaving && (
        <div style={{ 
          position: 'fixed', 
          bottom: '20px', 
          right: '20px', 
          background: 'var(--primary-color)', 
          color: 'white', 
          padding: '8px 16px', 
          borderRadius: 'var(--radius-md)', 
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 1000
        }}>
          <FaSpinner className="spinner" />
          Saving...
        </div>
      )}
    </div>
  );
};

export default Checklist; 