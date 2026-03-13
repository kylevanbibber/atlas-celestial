import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import api from "../../../api";
import "./ReleaseBar.css";

// Shared progress calculation function (move this function outside of components if needed)
const calculateProgress = (checklist) => {
  const { practice_pres = 0, refs_25 = 0, ...responses } = checklist;

  const progressKeys = [
    "arias_training",
    "video_done",
    "booking_done",
    "leadership_track",
    "sale_1k",
    "practice_pres",
    "refs_25",
    "build_team",
    "know_team",
    "contract_2nd",
    "bonus_90d",
    "bonus_after_90d",
    "ready_release",
    "know_more",
  ];

  const totalProgressItems = progressKeys.length + 10 + 25; // Add 10 for practice_pres and 25 for refs_25

  let completedItems = progressKeys.filter((key) => responses[key]).length;
  completedItems += Math.min(practice_pres, 10);
  completedItems += Math.min(refs_25, 25);

  return (completedItems / totalProgressItems) * 100;
};

const ReleaseBar = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [progress, setProgress] = useState(0);
  const [totalRowsThisWeek, setTotalRowsThisWeek] = useState(0);
  const [countdown, setCountdown] = useState("");
  
  // Configure total spots available per week (can be moved to config later)
  const TOTAL_SPOTS_PER_WEEK = 10;

  const handleReleaseBarClick = () => {
    navigate("/release");
  };

  const getNextFridayMidnight = () => {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const daysUntilFriday = (6 - dayOfWeek + 7) % 7 || 7;
    const nextFridayMidnightUTC = new Date(now);
    nextFridayMidnightUTC.setUTCDate(now.getUTCDate() + daysUntilFriday);
    nextFridayMidnightUTC.setUTCHours(5, 1, 0, 0);
    return nextFridayMidnightUTC;
  };

  useEffect(() => {
    const fetchUserProgressAndSpots = async () => {
      if (!user?.userId) return;
      
      const userId = user.userId;

      try {
        const response = await api.get('/release/get-checklist', { params: { userId } });
        const data = response.data;

        if (data.success && data.checklist) {
          const calculatedProgress = calculateProgress(data.checklist);
          setProgress(calculatedProgress);
        }

        const releaseResponse = await api.get('/release/check-release-scheduled', { params: { userId } });
        const releaseData = releaseResponse.data;

        if (releaseData.success) {
          const weekStart = getCurrentWeekRange().weekStart;
          const weekEnd = getCurrentWeekRange().weekEnd;
          const rowsThisWeek = releaseData.allRowsResult.filter((row) => {
            const submissionDate = new Date(row.time_submitted);
            return submissionDate >= weekStart && submissionDate <= weekEnd;
          });

          setTotalRowsThisWeek(rowsThisWeek.length);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchUserProgressAndSpots();
  }, [user]);

  const getCurrentWeekRange = () => {
    const now = new Date();
    const currentDay = now.getDay();
    const estOffset = -5 * 60;

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - currentDay - 1);
    weekStart.setUTCHours(5, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setUTCHours(4, 59, 59, 999);

    return { weekStart, weekEnd };
  };

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

  const getNextMonday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilMonday = (8 - dayOfWeek) % 7 || 7; // Days until next Monday
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
  
    // Format the date to MM/DD/YY
    const month = String(nextMonday.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(nextMonday.getDate()).padStart(2, '0');
    const year = String(nextMonday.getFullYear()).slice(-2); // Get last two digits of the year
  
    return `${month}/${day}/${year}`;
  };

  const remainingSpots = Math.max(0, TOTAL_SPOTS_PER_WEEK - totalRowsThisWeek);
  const spotsColor = remainingSpots <= 2 ? '#ff4444' : remainingSpots <= 5 ? '#ff8800' : '#4CAF50';

  return (
    <div className="release-bar" onClick={handleReleaseBarClick}>
      <div className="release-bar-content">
        
        {/* Spots Remaining Display */}
        <div className="release-bar-spots" style={{ marginBottom: '10px' }}>
          <p className="spots-title">
            Spots Remaining for {getNextMonday()}: 
            <span style={{ color: spotsColor, fontWeight: 'bold', marginLeft: '5px' }}>
              {remainingSpots} / {TOTAL_SPOTS_PER_WEEK}
            </span>
          </p>
        </div>

        {progress < 100 && (
          <div className="release-bar-instruction">To schedule your release call <button className="insured-button" style={{fontSize: '15px', border: 'none'}}>complete all tasks</button></div>
        )}

        <div className="release-bar-countdown" style={{marginBottom: '-15px'}}>
          <p className="countdown-title">Deadline to schedule for {getNextMonday()}: </p>
        </div>
          <p><strong>{countdown}</strong></p>
      </div>
    </div>
  );
};

export default ReleaseBar; 