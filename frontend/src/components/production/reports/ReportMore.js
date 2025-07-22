import React, { useState, useEffect } from 'react';
import api from '../../../api';
import './MoreReport.css';

const ReportMore = ({ user, onDataUpdate }) => {
  const [mgaData, setMgaData] = useState({});
  const [error, setError] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(0); // Tracks the week offset
  const [dateRange, setDateRange] = useState(""); // To display "Saturday - Friday"
  const [showNoDataBar, setShowNoDataBar] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true); // Track if the component is collapsed
  const [countdown, setCountdown] = useState("");
  const [loading, setLoading] = useState(false); // Track loading state
  const [pendingUpdates, setPendingUpdates] = useState({}); // Track pending updates
  
  const [formData, setFormData] = useState({
    MGA: user?.agnname || user?.lagnname || "",
    MORE_Date: "",
    External_Sets: 0,
    External_Shows: 0,
    Internal_Sets: 0,
    Internal_Shows: 0,
    Personal_Sets: 0,
    Personal_Shows: 0,
    Total_Set: 0,
    Total_Show: 0,
    Group_Invite: 0,
    Finals_Set: 0,
    Finals_Show: 0,
    Non_PR_Hires: 0,
    PR_Hires: 0,
    Total_Hires: 0,
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => !prev);
  };

  const calculateCountdown = (weekOffset = 0) => {
    const now = new Date();
    
    // Convert current time to EST
    const currentEST = new Date(
      now.toLocaleString("en-US", { timeZone: "America/New_York" })
    );
    
    // Calculate the Friday of the selected week
    const startOfWeek = new Date(currentEST);
    startOfWeek.setDate(
      startOfWeek.getDate() + weekOffset * 7 - startOfWeek.getDay() + 5
    ); // Move to the correct Friday
    startOfWeek.setHours(15, 15, 0, 0); // Set deadline time to 3:15 PM EST
    
    // Calculate the difference in milliseconds
    const diff = startOfWeek - currentEST;
    
    if (diff <= 0) {
      setCountdown("Deadline passed");
      return;
    }
    
    // Convert to days, hours, minutes, seconds
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    // Dynamically build the countdown string, omitting zero values except seconds
    const countdownArray = [];
    if (days > 0) countdownArray.push(`${days}d`);
    if (hours > 0 || days > 0) countdownArray.push(`${hours}h`);
    if (minutes > 0 || hours > 0 || days > 0) countdownArray.push(`${minutes}m`);
    countdownArray.push(`${seconds}s`); // Always show seconds
    
    setCountdown(countdownArray.join(" "));
  };

  const fetchFormData = async (MGA, MORE_Date) => {
    try {
      // Fetch data for the specific week and all weeks
      const [currentWeekResponse, allDataResponse] = await Promise.all([
        api.get(`/more/fetch-more-data/${MGA}/${MORE_Date}`),
        api.get('/more/all-amore-data'),
      ]);

      if (currentWeekResponse.data.success && currentWeekResponse.data.data) {
        const fetchedData = currentWeekResponse.data.data;

        const updatedData = Object.keys(fetchedData).reduce((acc, key) => {
          acc[key] = fetchedData[key] === 0 ? 0 : fetchedData[key];
          return acc;
        }, {});

        setFormData((prev) => ({
          ...prev,
          ...updatedData,
          MGA: MGA, // Ensure MGA is preserved
          MORE_Date: MORE_Date, // Keep backend format yyyy-mm-dd
        }));
        setShowNoDataBar(false); // Hide the no data bar if data is fetched
      } else {
        // Clear the form and show the no data bar
        setFormData((prev) => ({
          ...prev,
          MGA: MGA, // Ensure MGA is preserved
          MORE_Date: MORE_Date,
          External_Sets: null,
          External_Shows: null,
          Internal_Sets: null,
          Internal_Shows: null,
          Personal_Sets: null,
          Personal_Shows: null,
          Total_Set: null,
          Total_Show: null,
          Group_Invite: null,
          Finals_Set: null,
          Finals_Show: null,
          Non_PR_Hires: null,
          PR_Hires: null,
          Total_Hires: null,
        }));
        setShowNoDataBar(true); // Show the no data bar
      }

      // Calculate the reporting streak from all weeks' data
      if (allDataResponse.data.success && allDataResponse.data.data) {
        calculateReportingStreak(allDataResponse.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch data for the selected week:", err);
      setError("Failed to fetch data for the selected week.");
      setShowNoDataBar(true); // Show the no data bar on error
    }
  };

  const handleNoRecruit = async () => {
    const currentMGA = formData.MGA || user?.agnname || user?.lagnname;
    const rga = user?.rga || currentMGA;
    const legacy = user?.legacy || currentMGA;
    const tree = user?.tree || currentMGA;

    const zeroData = {
      External_Sets: 0,
      External_Shows: 0,
      Internal_Sets: 0,
      Internal_Shows: 0,
      Personal_Sets: 0,
      Personal_Shows: 0,
      Total_Set: 0,
      Total_Show: 0,
      Group_Invite: 0,
      Finals_Set: 0,
      Finals_Show: 0,
      Non_PR_Hires: 0,
      PR_Hires: 0,
      Total_Hires: 0,
      RGA: rga,
      Legacy: legacy,
      Tree: tree,
    };

    const isOnTime = currentWeek === 0 && countdown !== "Deadline passed";

    // Update the local formData state
    setFormData((prev) => ({
      ...prev,
      ...zeroData,
    }));

    // Send the data to the backend
    try {
      if (formData.MGA && formData.MORE_Date) {
        await updateData(formData.MGA, formData.MORE_Date, zeroData, isOnTime);
        alert(`Recruiting numbers have been recorded as 0${isOnTime ? ' on time.' : '.'}`);
        onDataUpdate && onDataUpdate(); // Refresh parent data
      } else {
        alert("MGA or recruiting date is missing. Unable to record data.");
      }
    } catch (error) {
      console.error("Error recording recruiting numbers as 0:", error.message);
      alert("Failed to record recruiting numbers as 0. Please try again.");
    }
  };

  const updateData = async (MGA, MORE_Date, updates, onTime = false) => {
    setLoading(true);
    try {
      const currentMGA = MGA || user?.agnname || user?.lagnname;
      const userRole = user?.clname || 'MGA';
      const RGA = user?.rga || currentMGA;
      const Legacy = user?.legacy || currentMGA;
      const Tree = user?.tree || currentMGA;

      const payload = {
        MGA: currentMGA,
        MORE_Date,
        updates,
        userRole,
        on_time: onTime,
        rga: RGA,
        legacy: Legacy,
        tree: Tree,
      };

      console.log("Payload being sent:", payload);
      await api.post('/more/update-more-data', payload);

    } catch (error) {
      console.error("Error updating data:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const parsedValue = parseInt(value || 0, 10);

    setFormData((prev) => {
      const updatedFormData = {
        ...prev,
        [name]: parsedValue,
      };

      // Ensure Total Sets = External Sets + Internal Sets + Personal Sets
      updatedFormData.Total_Set =
        (parseInt(updatedFormData.External_Sets || 0, 10) +
          parseInt(updatedFormData.Internal_Sets || 0, 10) +
          parseInt(updatedFormData.Personal_Sets || 0, 10)) || 0;

      // Ensure Total Shows = External Shows + Internal Shows + Personal Shows
      updatedFormData.Total_Show =
        (parseInt(updatedFormData.External_Shows || 0, 10) +
          parseInt(updatedFormData.Internal_Shows || 0, 10) +
          parseInt(updatedFormData.Personal_Shows || 0, 10)) || 0;

      // Validate PR Hires
      if (name === "PR_Hires" || name === "Total_Hires") {
        const totalHires = parseInt(updatedFormData.Total_Hires || 0, 10);
        const prHires = parseInt(updatedFormData.PR_Hires || 0, 10);

        if (prHires > totalHires) {
          alert("PR Hires cannot be greater than Total Hires");
          updatedFormData.PR_Hires = prev.PR_Hires || 0;
        } else {
          updatedFormData.Non_PR_Hires = totalHires - prHires;
        }
      } else {
        updatedFormData.Non_PR_Hires =
          (parseInt(updatedFormData.Total_Hires || 0, 10) -
            parseInt(updatedFormData.PR_Hires || 0, 10)) || 0;
      }

      setPendingUpdates((prevUpdates) => ({
        ...prevUpdates,
        [name]: parsedValue,
      }));

      return updatedFormData;
    });
  };

  const handleSubmit = async () => {
    if (!formData.MGA || !formData.MORE_Date) {
      alert("MGA or MORE_Date is missing; cannot submit.");
      return;
    }

    setLoading(true);
    try {
      const isOnTime = currentWeek === 0 && countdown !== "Deadline passed";
      const currentMGA = formData.MGA || user?.agnname || user?.lagnname;
      await api.post('/more/update-more-data', {
        MGA: currentMGA,
        MORE_Date: formData.MORE_Date,
        updates: pendingUpdates,
        userRole: user?.clname,
        on_time: isOnTime,
        rga: user?.rga || currentMGA,
        legacy: user?.legacy || currentMGA,
        tree: user?.tree || currentMGA,
      });

      setPendingUpdates({});
      setShowNoDataBar(false);
      alert("Recruiting numbers updated successfully.");
      onDataUpdate && onDataUpdate(); // Refresh parent data
    } catch (error) {
      console.error("Error submitting data:", error.message);
      alert("Failed to update recruiting numbers.");
    } finally {
      setLoading(false);
    }
  };

  const calculateReportingStreak = (allWeeksData) => {
    // Use the correct user identifier (MGA field from formData)
    const currentMGA = formData.MGA || user?.agnname || user?.lagnname;
    const filteredData = allWeeksData.filter((week) => week.MGA === currentMGA);
    const sortedWeeks = filteredData.sort((a, b) => new Date(b.MORE_Date) - new Date(a.MORE_Date));

    let streak = 0;
    for (const week of sortedWeeks) {
      if (week.on_time === 1 || week.on_time === true) {
        streak++;
      } else {
        break;
      }
    }

    setMgaData((prev) => ({ ...prev, streak }));
  };

  const calculateDateRange = (weekOffset = 0) => {
    const now = new Date();
    const currentDay = now.getDay();
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - currentDay - 1 + weekOffset * 7);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const formatToMMDDYY = (date) => {
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const yy = String(date.getFullYear()).slice(-2);
      return `${mm}/${dd}/${yy}`;
    };
    
    const formatToYYYYMMDD = (date) => {
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const yyyy = date.getFullYear();
      return `${yyyy}-${mm}-${dd}`;
    };
    
    const formattedRange = `${formatToMMDDYY(startOfWeek)} - ${formatToMMDDYY(endOfWeek)}`;
    const formattedFriday = formatToYYYYMMDD(endOfWeek);
    
    return { formattedRange, formattedFriday };
  };

  const updateWeek = (offsetChange) => {
    setCurrentWeek((prev) => prev + offsetChange);
  };

  const handleFocus = (e) => {
    e.target.select();
  };

  // Effects
  useEffect(() => {
    const updateCountdown = () => {
      calculateCountdown(currentWeek);
    };
    
    const interval = setInterval(updateCountdown, 1000);
    updateCountdown();
    
    return () => clearInterval(interval);
  }, [currentWeek]);

  useEffect(() => {
    const updateDateRange = async () => {
      const { formattedRange, formattedFriday } = calculateDateRange(currentWeek);
      setDateRange(formattedRange);
      setFormData((prev) => ({
        ...prev,
        MORE_Date: formattedFriday,
      }));
      
      const currentMGA = formData.MGA || user?.agnname || user?.lagnname;
      if (currentMGA) {
        await fetchFormData(currentMGA, formattedFriday);
      }
    };
    
    updateDateRange();
  }, [currentWeek, formData.MGA]);

  useEffect(() => {
    const fetchMgaData = async () => {
      try {
        const userMGA = user?.agnname || user?.lagnname;
        if (userMGA) {
          setFormData((prevFormData) => ({
            ...prevFormData,
            MGA: userMGA,
          }));

          setMgaData({
            lagnname: userMGA,
            rga: user?.rga || userMGA,
            legacy: user?.legacy || userMGA,
            tree: user?.tree || "",
          });
        }
      } catch (err) {
        console.error("Failed to fetch MGA data:", err.message);
        setError(err.message || "Unexpected error occurred.");
      }
    };

    fetchMgaData();
  }, [user]);

  return (
    <div >
      
      <div className="more-form-container">
        {showNoDataBar ? (
          <div className="warning-message-container">
            <div className="warning-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="warning-icon-svg"
              >
                <circle cx="12" cy="12" r="12" fill="#ffe4a1" />
                <circle cx="12" cy="12" r="9" fill="#ffffff" />
                <text
                  x="12"
                  y="16"
                  textAnchor="middle"
                  fontSize="14"
                  fill="#ffb300"
                  fontWeight="bold"
                >
                  !
                </text>
              </svg>
            </div>
            <div className="warning-message-content">
              <h5>Notice</h5>
              <p>
                {countdown === "Deadline passed"
                  ? "The deadline has passed to report recruiting numbers on time this week. You can still report your numbers now for your own records."
                  : <>
                      You have <strong>{countdown}</strong> to report recruiting numbers on time this week{" "}
                      {mgaData.streak > 0
                        ? `and keep your ${mgaData.streak} ${mgaData.streak === 1 ? "week" : "weeks"} streak.`
                        : "and start a new streak."}
                    </>}
              </p>

              <div className="more-button-group">
                <button className="more-toggle-collapse-button" onClick={toggleCollapse}>
                  {isCollapsed ? "Report MORE Numbers" : "Hide Report MORE"}
                </button>
                <button
                  className="no-recruit-notice-button"
                  onClick={() => handleNoRecruit()}
                >
                  I Didn't Recruit
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="success-message-container">
            <div className="success-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="success-icon-svg"
              >
                <circle cx="12" cy="12" r="12" fill="#d4edda" />
                <circle cx="12" cy="12" r="9" fill="#ffffff" />
                <text
                  x="12"
                  y="16"
                  textAnchor="middle"
                  fontSize="14"
                  fill="#28a745"
                  fontWeight="bold"
                >
                  🔥
                </text>
              </svg>
            </div>
            <div className="success-message-content">
              <h5>
                Keep up the consistency{" "}
                <strong>
                  {(() => {
                    const fullName = user?.agnname || user?.lagnname || "";
                    const firstName = fullName.split(" ")[0]; // Get first name (first part)
                    return firstName?.toLowerCase()?.replace(/^./, (char) => char.toUpperCase()) || "Agent";
                  })()}
                </strong>
              </h5>
              {mgaData.streak > 0 && (
                <p>
                  Your current reporting streak is{" "}
                  <strong>
                    {mgaData.streak} {mgaData.streak === 1 ? "week" : "weeks"}
                  </strong>
                  . Report before 3:15 PM EST on Fridays to maintain your streak.
                </p>
              )}
              <div className="more-button-group">
                <button
                  className="success-more-toggle-collapse-button"
                  onClick={toggleCollapse}
                >
                  {isCollapsed ? "Review MORE" : "Hide MORE"}
                </button>
              </div>
            </div>
          </div>
        )}

        {!isCollapsed && (
          <>
            <div className="more-date-navigation">
              <button className="more-week-button" onClick={() => updateWeek(-1)}>
                &lt;
              </button>
              <div className="date-range-container">
                <span className="recruiting-week-label">Recruiting Week:</span>
                <select
                  className="week-selector"
                  value={currentWeek}
                  onChange={(e) => setCurrentWeek(parseInt(e.target.value, 10))}
                >
                  {[...Array(100)]
                    .map((_, index) => -index)
                    .concat(0, 1)
                    .map((offset) => {
                      const { formattedRange } = calculateDateRange(offset);
                      return (
                        <option key={offset} value={offset}>
                          {formattedRange}
                        </option>
                      );
                    })}
                </select>

                <div className="week-indicator-wrapper">
                  <span className="week-indicator">
                    {currentWeek === 0 && "This Week"}
                    {currentWeek === -1 && "Last Week"}
                    {currentWeek === 1 && "Next Week"}
                  </span>
                  <div className={`more-spinner ${loading ? "visible" : ""}`}></div>
                </div>
              </div>
              <button className="more-week-button" onClick={() => updateWeek(1)}>
                &gt;
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginTop: "10px", marginBottom: "10px" }}>
              <button
                style={{
                  padding: "10px 20px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  backgroundColor: "#00548c",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                  transition: "background 0.3s",
                }}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? "Submitting..." : "Submit MORE"}
              </button>
            </div>

            <div className="horizontal-table">
              <table className="morebonus-table">
                <thead>
                  <tr>
                    <th style={{ backgroundColor: "#00548c" }} colSpan="2" className="more-table-header">Vendor Data</th>
                    <th style={{ backgroundColor: "#ED722F" }} colSpan="2" className="more-table-header">Resume Data</th>
                    <th style={{ backgroundColor: "#B25271" }} colSpan="2" className="more-table-header">Personal Data</th>
                    <th style={{ backgroundColor: "#bbbbbb" }} colSpan="3" className="more-table-header">Overview Data</th>
                    <th style={{ backgroundColor: "#319b43bb" }} colSpan="2" className="more-table-header">Finals Data</th>
                    <th style={{ backgroundColor: "#00548c" }} colSpan="3" className="more-table-header">Hires Data</th>
                  </tr>
                  <tr>
                    <th style={{ backgroundColor: "#319b43bb" }} className="more-table-header">External Sets</th>
                    <th style={{ backgroundColor: "#319b43bb" }} className="more-table-header">External Shows</th>
                    <th style={{ backgroundColor: "#319b43bb" }} className="more-table-header">Internal Sets</th>
                    <th style={{ backgroundColor: "#319b43bb" }} className="more-table-header">Internal Shows</th>
                    <th style={{ backgroundColor: "#319b43bb" }} className="more-table-header">Personal Sets</th>
                    <th style={{ backgroundColor: "#319b43bb" }} className="more-table-header">Personal Shows</th>
                    <th style={{ backgroundColor: "#319b43bb" }} className="more-table-header">Total Sets</th>
                    <th style={{ backgroundColor: "#319b43bb" }} className="more-table-header">Total Shows</th>
                    <th style={{ backgroundColor: "#319b43bb" }} className="more-table-header">Group Invite</th>
                    <th style={{ backgroundColor: "#319b43bb" }} className="more-table-header">Finals Set</th>
                    <th style={{ backgroundColor: "#319b43bb" }} className="more-table-header">Finals Show</th>
                    <th style={{ backgroundColor: "#319b43bb" }} className="more-table-header">Total Hires</th>
                    <th style={{ backgroundColor: "#319b43bb" }} className="more-table-header">PR Hires</th>
                    <th style={{ backgroundColor: "#319b43bb" }} className="more-table-header">Non PR Hires</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {[
                      "External_Sets",
                      "External_Shows",
                      "Internal_Sets",
                      "Internal_Shows",
                      "Personal_Sets",
                      "Personal_Shows",
                      "Total_Set",
                      "Total_Show",
                      "Group_Invite",
                      "Finals_Set",
                      "Finals_Show",
                      "Total_Hires",
                      "PR_Hires",
                      "Non_PR_Hires",
                    ].map((name) => (
                      <td key={name}>
                        <input
                          className="more-form-input"
                          type="number"
                          name={name}
                          value={formData[name] === null ? "" : formData[name]}
                          onChange={handleChange}
                          onFocus={handleFocus}
                        />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReportMore; 