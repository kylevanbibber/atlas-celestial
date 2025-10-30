import React, { useState, useEffect } from "react";
import { FaLock, FaLockOpen, FaDownload, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { useAuth } from "../../../context/AuthContext";
import RoleplayModal from "./RoleplayModal";
import { useProgress } from "./ProgressContext";
import api from "../../../api";
import DataTable from "../../utils/DataTable";
import LoadingSpinner, { InlineSpinner, ButtonSpinner, PageSpinner } from "../../utils/LoadingSpinner";
import { formatUTCForDisplay } from "../../../utils/dateUtils";
import "./Checklist.css";

const Checklist = () => {
  const [responses, setResponses] = useState({});
  const { progress, setProgress } = useProgress();
  const [remainingItems, setRemainingItems] = useState(0);
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
  const [tableData, setTableData] = useState([]);
  const [firstPackSent, setFirstPackSent] = useState(false);

  // Get user data from auth context
  const { user } = useAuth();
  const userId = user?.userId;
  const userRole = user?.clname;
  
  // Check if user is admin with teamRole="app" - should have admin access
  const isAppAdmin = user?.Role === 'Admin' && user?.teamRole === 'app';

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
    contract_2nd: "45",        // Expected correct answer for "contract_2nd"
    bonus_90d: "750",          // Expected correct answer for "bonus_90d"
    bonus_after_90d: "250",    // Expected correct answer for "bonus_after_90d"
  };

  // Transform sections into table data
  const transformDataToTable = () => {
    const data = [];
    let id = 1;

    Object.entries(sections).forEach(([sectionName, questions]) => {
      // Skip Expectations section if user is not released
      if (sectionName === "Expectations" && !isReleased) {
        return;
      }
      // Add section header row
      data.push({
        id: id++,
        isSectionHeader: true,
        section: sectionName,
        question: `📋 ${sectionName.replace(/([A-Z])/g, " $1").trim()}`,
        key: null,
        response: "",
        type: "section_header",
      });

      if (sectionName === "Numbers") {
        // Group Numbers section into trainee/trainer pairs
        const numbersPairs = [
          { label: "Ride Days", trainee: "ride_days_trainee", trainer: "ride_days_trainer" },
          { label: "Presentations Done", trainee: "pres_done_trainee", trainer: "pres_done_trainer" },
          { label: "Referral Presentations Done", trainee: "ref_pres_done_trainee", trainer: "ref_pres_done_trainer" },
          { label: "Referrals Sold", trainee: "ref_sold_trainee", trainer: "ref_sold_trainer" },
          { label: "Referrals Collected", trainee: "ref_collected_trainee", trainer: "ref_collected_trainer" },
          { label: "Sales Made", trainee: "sales_done_trainee", trainer: "sales_done_trainer" },
          { label: "ALP Written", trainee: "alp_written_trainee", trainer: "alp_written_trainer" },
          { label: "Appointments Set", trainee: "appts_set_trainee", trainer: "appts_set_trainer" },
          { label: "Recruits Collected", trainee: "recruits_trainee", trainer: "recruits_trainer" },
        ];

        numbersPairs.forEach(pair => {
          data.push({
            id: id++,
            isSectionHeader: false,
            section: sectionName,
            question: pair.label,
            traineeKey: pair.trainee,
            trainerKey: pair.trainer,
            key: null, // No single key for numbers pairs
            response: "",
            type: "numbers_pair",
          });
        });
      } else {
        // Add question rows for other sections
        Object.entries(questions).forEach(([key, question]) => {
          data.push({
            id: id++,
            isSectionHeader: false,
            section: sectionName,
            question: question,
            key: key,
            response: responses[key] || "",
            type: getFieldType(key),
          });
        });
      }
    });

    return data;
  };

  // Determine field type based on key
  const getFieldType = (key) => {
    if (key === "practice_pres" || key === "refs_25") return "range";
    if (key === "contract_2nd" || key === "bonus_90d" || key === "bonus_after_90d") return "validated_number";
    if (key === "reviewed_by") return "select";
    if (key === "start_wkdy" || key === "start_wknd") return "time";
    if (key === "build_team" || key === "know_team" || key === "ready_release") return "radio_yes_no";
    if (Object.keys(sections.RolePlay).includes(key)) return "roleplay";
    if (Object.keys(sections.Numbers).includes(key) || 
        Object.keys(sections.Expectations).includes(key) && 
        !["start_wkdy", "start_wknd"].includes(key)) return "number";
    return "checkbox";
  };

  // Get border color for validated fields
  const getBorderColor = (key) => {
    if (responses[key] === correctAnswers[key]) {
      return "#28a745";
    } else if (responses[key] && responses[key] !== correctAnswers[key]) {
      return "#dc3545";
    }
    return "var(--border-color)";
  };

  // Get validation icon
  const getValidationIcon = (key) => {
    if (responses[key] === correctAnswers[key]) {
      return <FaCheckCircle style={{ color: "#28a745", marginLeft: "8px" }} />;
    } else if (responses[key] && responses[key] !== correctAnswers[key]) {
      return <FaTimesCircle style={{ color: "#dc3545", marginLeft: "8px" }} />;
    }
    return null;
  };

  // Define table columns
  const columns = [
    {
      Header: "Question",
      accessor: "question",
      width: 400,
      Cell: ({ value, row }) => {
        if (row.original.isSectionHeader) {
          return (
            <div style={{ 
              fontWeight: 'bold', 
              fontSize: '1.1rem', 
              color: 'var(--hover-color)',
              padding: '8px 0',
              borderBottom: '2px solid var(--hover-color)',
              marginBottom: '4px'
            }}>
              {value}
            </div>
          );
        }

        // Make roleplay questions clickable
        if (row.original.type === "roleplay") {
          return (
            <span 
              onClick={() => openModal(row.original.key)}
              style={{
                cursor: 'pointer',
                color: 'var(--hover-color)',
                textDecoration: 'underline',
                textDecorationStyle: 'dotted'
              }}
              onMouseEnter={(e) => {
                e.target.style.textDecorationStyle = 'solid';
              }}
              onMouseLeave={(e) => {
                e.target.style.textDecorationStyle = 'dotted';
              }}
            >
              {value}
            </span>
          );
        }

        return <span>{value}</span>;
      }
    },
    {
      Header: "Response",
      accessor: "response",
      width: 100,
      Cell: ({ value, row, updateCell }) => {
        if (row.original.isSectionHeader) {
          // Show Trainee/Trainer labels for Numbers section
          if (row.original.section === "Numbers") {
            return (
              <div style={{ 
                display: "flex", 
                gap: "16px", 
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.875rem",
                fontWeight: "600",
                color: "var(--text-secondary)",
                padding: '8px 0'
              }}>
                <div style={{ flex: 1, textAlign: "center" }}>Trainee</div>
                <div style={{ flex: 1, textAlign: "center" }}>Trainer</div>
              </div>
            );
          }
          return <div style={{ padding: '8px 0' }}></div>;
        }

        if (row.original.type === "numbers_pair") {
          const { traineeKey, trainerKey } = row.original;
          const traineeValue = responses[traineeKey] || "";
          const trainerValue = responses[trainerKey] || "";

          const handleTraineeChange = (newValue) => {
            setResponses(prev => ({ ...prev, [traineeKey]: newValue }));
            updateCell(row.original.id, "trainee_response", newValue);
            updateProgress({ [traineeKey]: newValue });
          };

          const handleTrainerChange = (newValue) => {
            setResponses(prev => ({ ...prev, [trainerKey]: newValue }));
            updateCell(row.original.id, "trainer_response", newValue);
            updateProgress({ [trainerKey]: newValue });
          };

          return (
            <div style={{ display: "flex", gap: "16px", alignItems: "center", justifyContent: "center" }}>
              <div style={{ flex: 1 }}>
                <input
                  type="number"
                  min="0"
                  value={traineeValue || ""}
                  onChange={(e) => handleTraineeChange(e.target.value)}
                  style={{ 
                    width: "100%", 
                    padding: "4px 8px",
                    borderRadius: "4px",
                    border: "1px solid var(--border-color)",
                    textAlign: "center"
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <input
                  type="number"
                  min="0"
                  value={trainerValue || ""}
                  onChange={(e) => handleTrainerChange(e.target.value)}
                  style={{ 
                    width: "100%", 
                    padding: "4px 8px",
                    borderRadius: "4px",
                    border: "1px solid var(--border-color)",
                    textAlign: "center"
                  }}
                />
              </div>
            </div>
          );
        }

        const { key, type } = row.original;
        const currentValue = responses[key] || "";

        const handleChange = (newValue) => {
          setResponses(prev => ({ ...prev, [key]: newValue }));
          updateCell(row.original.id, "response", newValue);
          updateProgress({ [key]: newValue });
        };

        switch (type) {
          case "checkbox":
            return (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={currentValue || false}
                  onChange={() => handleChange(!currentValue)}
                  style={{ width: "20px", height: "20px" }}
                />
              </div>
            );

          case "range":
            const maxValue = key === "practice_pres" ? 10 : 25;
            return (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                <div className="progress-visualization" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    type="button"
                    className="increment-button"
                    onClick={() => handleChange(Math.max((currentValue || 0) - 1, 0))}
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "4px",
                      border: "1px solid var(--border-color)",
                      background: "var(--bg-primary)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                      fontWeight: "bold"
                    }}
                  >
                    -
                  </button>
                  <div style={{ 
                    position: "relative", 
                    display: "flex", 
                    alignItems: "center",
                    border: "1px solid var(--border-color)",
                    borderRadius: "4px",
                    padding: "4px 8px",
                    background: "white",
                    fontSize: "14px"
                  }}>
                    <input
                      type="number"
                      min="0"
                      max={maxValue}
                      value={currentValue || 0}
                      onChange={(e) => {
                        const newValue = Math.min(Math.max(parseInt(e.target.value) || 0, 0), maxValue);
                        handleChange(newValue);
                      }}
                      style={{
                        border: "none",
                        outline: "none",
                        width: "20px",
                        textAlign: "right",
                        fontSize: "14px",
                        background: "transparent",
                        padding: "0",
                        margin: "0"
                      }}
                    />
                    <span style={{ 
                      color: "var(--text-secondary)", 
                      marginLeft: "4px",
                      fontSize: "14px"
                    }}>
                      / {maxValue}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="increment-button"
                    onClick={() => handleChange(Math.min((currentValue || 0) + 1, maxValue))}
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "4px",
                      border: "1px solid var(--border-color)",
                      background: "var(--bg-primary)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                      fontWeight: "bold"
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            );

          case "validated_number":
            const isCorrect = responses[key] === correctAnswers[key];
            const isIncorrect = responses[key] && responses[key] !== correctAnswers[key];
            
            let backgroundColor = "transparent";
            if (isCorrect) {
              backgroundColor = "rgba(40, 167, 69, 0.1)"; // Light green
            } else if (isIncorrect) {
              backgroundColor = "rgba(220, 53, 69, 0.1)"; // Light red
            }

            return (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                                  <div style={{ 
                    display: "flex", 
                    alignItems: "center",
                    backgroundColor: backgroundColor,
                    padding: "4px 8px",
                    borderRadius: "4px",
                    transition: "background-color 0.2s ease"
                  }}>
                  <input
                    type="number"
                    min="0"
                    value={currentValue || ""}
                    onChange={(e) => handleChange(e.target.value)}
                    style={{
                      width: "80px",
                      borderRadius: "4px",
                      borderWidth: "2px",
                      borderColor: getBorderColor(key),
                      padding: "4px 8px",
                      background: "transparent",
                      textAlign: "center"
                    }}
                  />
                  {key === "contract_2nd" && <span style={{ marginLeft: "8px" }}>days</span>}
                </div>
              </div>
            );

          case "select":
            return (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                <select
                  value={currentValue || ""}
                  onChange={(e) => handleChange(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="">Select Reviewer</option>
                  {reviewerOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            );

          case "time":
            return (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                <input
                  type="time"
                  value={currentValue || ""}
                  onChange={(e) => handleChange(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
            );

          case "radio_yes_no":
            return (
              <div style={{ display: "flex", gap: "16px", alignItems: "center", justifyContent: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name={`${key}_radio`}
                    value="y"
                    checked={currentValue === "y"}
                    onChange={() => handleChange("y")}
                    style={{ marginRight: "4px" }}
                  />
                  Yes
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name={`${key}_radio`}
                    value="n"
                    checked={currentValue === "n"}
                    onChange={() => handleChange("n")}
                    style={{ marginRight: "4px" }}
                  />
                  No
                </label>
              </div>
            );

          case "roleplay":
            return (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={currentValue || false}
                  onChange={() => handleChange(!currentValue)}
                  style={{ width: "20px", height: "20px" }}
                />
              </div>
            );

          case "number":
            return (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                <input
                  type="number"
                  min="0"
                  value={currentValue || ""}
                  onChange={(e) => handleChange(e.target.value)}
                  style={{ width: "80px", padding: "4px 8px", textAlign: "center" }}
                />
              </div>
            );

          default:
            return (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                <input
                  type="text"
                  value={currentValue || ""}
                  onChange={(e) => handleChange(e.target.value)}
                  style={{ width: "100%", textAlign: "center" }}
                />
              </div>
            );
        }
      },
    },
  ];

  // Update table data when responses change
  useEffect(() => {
    setTableData(transformDataToTable());
  }, [responses, isReleased]);

  // Define the keys to include in progress calculation
  const progressKeys = [
    ...Object.keys(sections.Preparation),
    ...Object.keys(sections.RolePlay),
    ...Object.keys(sections.VideoReview),
  ];
  
  // Exclude optional fields from progress calculation
  const excludeKeys = ["reviewed_by", "know_more"];
  const filteredProgressKeys = progressKeys.filter((key) => !excludeKeys.includes(key));
  
  // Total items in Preparation section with increments for practice_pres and refs_25
  const totalProgressItems = filteredProgressKeys.length + 10 + 25; // Add 10 for practice_pres and 25 for refs_25

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
    weekStart.setDate(now.getDate() - currentDay - 1);
    weekStart.setUTCHours(5, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setUTCHours(4, 59, 59, 999);

    return { weekStart, weekEnd };
  };

  const getNextMonday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilMonday = (8 - dayOfWeek) % 7 || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);

    const month = String(nextMonday.getMonth() + 1).padStart(2, '0');
    const day = String(nextMonday.getDate()).padStart(2, '0');
    const year = String(nextMonday.getFullYear()).slice(-2);

    return `${month}/${day}/${year}`;
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
        
        if (userRole === "Admin" || isAppAdmin) {
          // Admin and app admin can see all unreleased users
          response = await api.get("/release/get-unreleased-users-checklist");
        } else {
          // For managers (RGA, MGA, SGA), fetch their agents using the correct endpoint
          response = await api.post("/auth/searchByUserId", { userId });
        }

        if (response.data.success) {
          const fetchedAgents = response.data.data;
          setAgents(fetchedAgents);
        } else {
          
        }
      } catch (err) {
        
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgents();
  }, [userRole, userId]);

const handleAgentSelection = async (event) => {
  const selectedId = event.target.value;

  if (!selectedId) {
    
    // Clear data when no agent is selected
    setSelectedAgent("");
    setResponses({});
    setReviewerOptions([]);
    setIsReleaseScheduled(false);
    setOnReleaseList(false);
    setReleaseScheduledDate(null);
    setTotalRowsThisWeek(0);
    return;
  }

  setIsLoading(true);
  
  // Clear previous agent's data immediately
  setResponses({});
  setReviewerOptions([]);
  setIsReleaseScheduled(false);
  setOnReleaseList(false);
  setReleaseScheduledDate(null);
  setTotalRowsThisWeek(0);
  
  const selectedAgentData = agents.find(agent => agent.id === parseInt(selectedId, 10));

  if (!selectedAgentData) {
    
    setIsLoading(false);
    return;
  }

  

  setSelectedAgent(selectedAgentData);
  setReviewerOptions(
    [selectedAgentData.sa, selectedAgentData.ga, selectedAgentData.mga, selectedAgentData.rga].filter(Boolean)
  );
  
  
  
  // Fetch checklist data for the selected agent
  await fetchChecklistData(selectedAgentData.id);
  
  // Check if the selected agent is on the release list
  await checkReleaseScheduled(selectedAgentData.id);
  
  setIsLoading(false);
};

  const checkReleaseScheduled = async (targetUserId) => {
    if (!targetUserId) {
      
      return;
    }

    

    try {
      const response = await api.get('/release/check-release-scheduled', { params: { userId: targetUserId } });
      const result = response.data;

      const { weekStart, weekEnd } = getCurrentWeekRange();
      
      setIsReleaseScheduled(result.isScheduled);
      setReleaseScheduledDate(result.release_scheduled);
      
      // Set onReleaseList based on whether user is in JA_Release table
      setOnReleaseList(result.success);

      if (result.allRowsResult) {
        // Spots taken: release_scheduled is null AND passed is null AND time_submitted within current week (Saturday–Saturday)
        const rowsThisWeek = result.allRowsResult.filter((row) => {
          const submissionDate = new Date(row.time_submitted);
          const withinWeek = submissionDate >= weekStart && submissionDate <= weekEnd;
          const notScheduled = row.release_scheduled == null;
          const notPassed = row.passed == null;
          return withinWeek && notScheduled && notPassed;
        });

        setTotalRowsThisWeek(rowsThisWeek.length);
      } else {
        setTotalRowsThisWeek(0);
      }

      return result;
    } catch (error) {
      
      setTotalRowsThisWeek(0);
      setOnReleaseList(false);
      return { success: false };
    }
  };

  // Check if the agent has 1st Pack sent in leads_released
  const checkFirstPackStatus = async (targetUserId) => {
    try {
      const resp = await api.get('/release/leads-released');
      const rows = resp?.data?.data || [];
      const hasFirstPack = rows.some(r =>
        String(r.userId) === String(targetUserId) &&
        (r.type === '1st Pack' || r.type === 'First Pack') &&
        (r.sent == 1 || r.sent === '1')
      );
      setFirstPackSent(hasFirstPack);
    } catch (e) {
      setFirstPackSent(false);
    }
  };

  // Auto-load data for AGT users only
  useEffect(() => {
    if (!userRole || !userId) return;
    if (userRole === "AGT") {
      
      setIsLoading(true);
      fetchChecklistData(userId);
      checkReleaseScheduled(userId);
      checkFirstPackStatus(userId);
    }
  }, [userRole, userId]);

  // Only auto-load manager's own data if no agent is selected
  useEffect(() => {
    if (!userRole || !userId) return;
    if (userRole === "AGT") return; // AGT users handled above
    
    // Only run this for managers when no specific agent is selected
    if (!selectedAgent) {
      
      fetchChecklistData(userId);
      checkReleaseScheduled(userId);
      checkFirstPackStatus(userId);
    }
  }, [userRole, userId, selectedAgent]); // Include selectedAgent to re-run when cleared

  // Check if the current user (either selected agent or manager) is released
  useEffect(() => {
    const targetUserId = selectedAgent?.id || userId;
    if (!targetUserId) return;
    
    const checkReleased = async () => {
      
      try {
        const response = await api.get('/release/check-released', { params: { userId: targetUserId } });
        const result = response.data;

        if (result.success) {
          setIsReleased(result.isReleased);
        }
      } catch (error) {
        
      }
    };

    checkReleased();
  }, [selectedAgent?.id, userId]); // Re-run when agent selection changes

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
      // Check specific fields against the correct answers
      if (key === "contract_2nd") {
        return responses[key] === correctAnswers[key];
      }
      if (key === "bonus_90d") {
        return responses[key] === correctAnswers[key];
      }
      if (key === "bonus_after_90d") {
        return responses[key] === correctAnswers[key];
      }
      
      // Check radio button fields (yes/no questions)
      if (key === "build_team" || key === "know_team" || key === "ready_release") {
        return responses[key] === "y";
      }
  
      // For other items, simply check if they are completed (true or have a value)
      return responses[key];
    }).length;
  
    // Add progress for practice presentations and refs collected
    completedItems += Math.min(responses.practice_pres || 0, 10);
    completedItems += Math.min(responses.refs_25 || 0, 25);
  
    // Calculate remaining items
    const remaining = totalProgressItems - completedItems;
    const progressPercentage = (completedItems / totalProgressItems) * 100;
    
    const targetUser = selectedAgent ? 
      (selectedAgent.lagnname || `${selectedAgent.first_name} ${selectedAgent.last_name}`) : 
      'Current User';
    
    
    setRemainingItems(remaining);
    setProgress(progressPercentage);
  };

  const fetchChecklistData = async (targetUserId) => {
    if (!targetUserId) {
      return;
    }
    
    
    
    try {
      const response = await api.get('/release/get-checklist', { params: { userId: targetUserId } });
      const data = response.data;

      if (data.success && data.checklist) {
        setResponses(data.checklist);
        setIsReleased(data.checklist.released === 1);
      } else {
        // Clear responses if no checklist data is found
        setResponses({});
        setIsReleased(false);
      }
    } catch (error) {
      // Clear responses on error
      setResponses({});
      setIsReleased(false);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProgress = async (updates) => {
    const targetUserId = selectedAgent?.id || userId;
    
    try {
      setIsSaving(true);
      await api.post('/release/update-progress', {
        userId: targetUserId,
        updates,
      });
    } catch (error) {
    } finally {
      setIsSaving(false);
    }
  };

  const handleScheduleReleaseCall = async () => {
    const targetUserId = selectedAgent?.id || userId;
    const agentName = selectedAgent ? (selectedAgent.lagnname || `${selectedAgent.first_name} ${selectedAgent.last_name}`) : 'your';
    
    try {
      setIsSaving(true);
      const response = await api.post('/release/schedule-release', {
        userId: targetUserId,
      });

      if (response.data.success) {
        setOnReleaseList(true);
        alert(`Release call request submitted successfully for ${agentName}! Check back over the weekend to see the scheduled time for the upcoming week.`);
      } else {
        alert('Error scheduling release call: ' + response.data.message);
      }
    } catch (error) {
      alert('Error scheduling release call');
    } finally {
      setIsSaving(false);
    }
  };

  // Removed legacy useEffect that was causing conflicts

  useEffect(() => {
    calculateProgress();
  }, [responses]);

  // Handle cell updates from DataTable
  const handleCellUpdate = (id, field, value) => {
    // The cell update is already handled in the Cell component
    // This is just a placeholder to satisfy DataTable requirements
  };

  // Show loading state if user data is not available
  if (!user || !userId || !userRole || isLoading) {
    return <PageSpinner text="Loading checklist data..." />;
  }

  return (
    <div className="checklist-container">
      {/* Agent Selection Dropdown for managers/admins */}
      {userRole !== "AGT" && (
        <div className="agent-selection">
          <label htmlFor="agent-select">Select Agent:</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <select
              id="agent-select"
              value={selectedAgent?.id || ""}
              onChange={handleAgentSelection}
              aria-label="Select an agent to view their checklist"
              disabled={isLoading}
            >
              <option value="">-- Select an Agent --</option>
              {agents
                .filter(agent => agent.released === 0) // Only show unreleased agents
                .sort((a, b) => (a.lagnname || a.last_name || '').localeCompare(b.lagnname || b.last_name || '')) // Sort by last name
                .map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.lagnname || `${agent.first_name} ${agent.last_name}`}
                  </option>
                ))}
            </select>
            {isLoading && selectedAgent && (
              <InlineSpinner />
            )}
          </div>
        </div>
      )}

      {/* Release Schedule Information - Full Details for AGT */}
      {userRole === "AGT" && isReleaseScheduled && (
        <div className="release-schedule-info">
          <div className="scheduled-info" style={{ textAlign: 'center' }}>
            <p><strong>🎯 Your Release Call is Scheduled!</strong></p>
            <p style={{ fontSize: '1rem', marginTop: '8px', marginBottom: '15px' }}>
              <strong>Release Date:</strong> {formatUTCForDisplay(releaseScheduledDate)}
            </p>
            <div style={{ marginTop: '15px', padding: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
              <p><strong>📞 Zoom Meeting Info:</strong></p>
              <p>
                <a href="https://zoom.us/j/6233180376" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--link-color)', textDecoration: 'underline' }}>
                  Join Zoom Meeting
                </a>
              </p>
              <p><strong>Meeting ID:</strong> 623 318 0376</p>
              <p><strong>Password:</strong> 1234</p>
            </div>
            <div style={{ marginTop: '10px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              <p>📋 <a href="https://aagencies-my.sharepoint.com/:b:/g/personal/kvanbibber_ariasagencies_com/Edr14iXcerVHoroIJvQd5gMB-BCqDoRpg-tzI2vVElfbDg" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--link-color)', textDecoration: 'underline' }}>
                Review Release Questions <FaDownload style={{ marginLeft: '4px' }} />
              </a></p>
            </div>
          </div>
        </div>
      )}

      {/* Minimal request UI (no % complete, no checklist), only if not already scheduled */}
      {!isReleaseScheduled && (
        <div className="release-progress-bar-container">
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            marginBottom: '15px'
          }}>
            {/* Left: spots remaining */}
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textAlign: 'left', flex: '0 0 auto' }}>
              📅  {Math.max(0, 24 - totalRowsThisWeek)}/24 spots remaining
            </div>

            {/* Center: button */}
            <button
              onClick={handleScheduleReleaseCall}
              disabled={!((userRole === "AGT") || (["SA", "GA", "MGA", "RGA"].includes(userRole) && selectedAgent) || (isAppAdmin && selectedAgent)) || !firstPackSent || onReleaseList || isSaving}
              className="unlocked-link"
              style={{ 
                fontSize: '1rem', 
                padding: '8px 16px', 
                minHeight: '40px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                flex: '0 0 auto'
              }}
            >
              {isSaving ? <ButtonSpinner /> : 'Request to be Scheduled'}
            </button>

            {/* Right: countdown timer */}
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textAlign: 'right', flex: '0 0 auto' }}>
              {countdown ? `⏰ Time remaining: ${countdown}` : ''}
            </div>
          </div>
        </div>
      )}

      {/* Release Call Information Section for AGT users */}
      {userRole === "AGT" && (
        <div style={{ 
          marginTop: '20px',
          padding: '20px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)'
        }}>
          <h3 style={{ 
            marginTop: 0,
            marginBottom: '12px',
            color: 'var(--text-primary)',
            fontSize: '1.1rem'
          }}>
            📞 About Your Release Call
          </h3>
          <p style={{ 
            marginBottom: '15px',
            lineHeight: '1.6',
            color: 'var(--text-primary)',
            fontSize: '0.95rem'
          }}>
            Your release call is a pivotal milestone in your journey with us. This is when you transition from training 
            to operating independently as a licensed agent. During this call, you'll demonstrate your knowledge of our 
            systems, products, and processes. Successfully completing your release call means you're ready to build your 
            own business and start making an impact in the field. Review the release questions below to prepare for your call.
          </p>
          <div style={{ 
            textAlign: 'center',
            padding: '12px',
            backgroundColor: 'var(--bg-primary)',
            borderRadius: '6px'
          }}>
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              📋 <a 
                href="https://aagencies-my.sharepoint.com/:b:/g/personal/kvanbibber_ariasagencies_com/Edr14iXcerVHoroIJvQd5gMB-BCqDoRpg-tzI2vVElfbDg" 
                target="_blank" 
                rel="noopener noreferrer" 
                style={{ 
                  color: 'var(--link-color)', 
                  textDecoration: 'underline',
                  fontWeight: '500'
                }}
              >
                Review Release Questions <FaDownload style={{ marginLeft: '4px' }} />
              </a>
            </p>
          </div>
        </div>
      )}

      {/* Roleplay Modal */}
      <RoleplayModal
        isOpen={isModalOpen}
        onClose={closeModal}
        content={activeModalContent}
      />

      {/* Checklist table removed for the stripped-down version */}
      
      {/* Saving indicator */}
      {isSaving && (
        <div style={{ 
          position: 'fixed', 
          bottom: '20px', 
          right: '20px', 
          background: 'var(--button-primary-bg)', 
          color: 'var(--button-primary-text)', 
          padding: '8px 16px', 
          borderRadius: '4px', 
          boxShadow: '0 2px 4px var(--shadow-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 1000
        }}>
          <ButtonSpinner />
          Saving...
        </div>
      )}
    </div>
  );
};

export default Checklist; 