import React, { useState, useRef, useEffect } from 'react';
import { FiPhone, FiHeart, FiPlus, FiClock } from 'react-icons/fi';
import { FaHeart } from 'react-icons/fa';
import { NameFormats, getFirstInitial } from '../../../utils/nameFormatter';
import './TallySessionCard.css';

function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function formatFullDate(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  }) + ' at ' + d.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true
  });
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function buildReactorTooltip(reactors, reactionKey, nameFormatter) {
  const names = reactors?.[reactionKey];
  if (!names || names.length === 0) return '';
  const formatted = names.map(n => nameFormatter(n)).slice(0, 10);
  if (names.length > 10) formatted.push(`+${names.length - 10} more`);
  return formatted.join(', ');
}

const DIAL_MILESTONES = {
  50: { name: '50 Dials', emoji: '\u{1F4AA}' },
  100: { name: 'Century Club', emoji: '\u{1F4AF}' },
  150: { name: '150 Dials', emoji: '\u{1F525}' },
  200: { name: 'Double Century', emoji: '\u{1F3C6}' },
};

function getDialMilestone(totalDials) {
  if (totalDials >= 200) return DIAL_MILESTONES[200];
  if (totalDials >= 150) return DIAL_MILESTONES[150];
  if (totalDials >= 100) return DIAL_MILESTONES[100];
  if (totalDials >= 50) return DIAL_MILESTONES[50];
  return null;
}

const OTHER_REACTIONS = {
  like: { emoji: '\u{1F44D}', label: 'Like' },
  fire: { emoji: '\u{1F525}', label: 'Fire' },
  clap: { emoji: '\u{1F44F}', label: 'Clap' },
  money: { emoji: '\u{1F4B0}', label: 'Money' },
};

const TallySessionCard = ({ event, onReact, onProfileClick, activeUserIds = [] }) => {
  const { actor, data, timestamp, reactions } = event;
  const timeAgo = getTimeAgo(timestamp);
  const fullDate = formatFullDate(timestamp);
  const displayName = NameFormats.FIRST_LAST(actor.name);
  const initial = getFirstInitial(actor.name);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);

  const isOnline = activeUserIds.includes(actor.id);
  const milestone = getDialMilestone(data.totalDials || 0);

  const counts = reactions?.counts || {};
  const userReactions = reactions?.userReactions || [];
  const reactors = reactions?.reactors || {};
  const heartActive = userReactions.includes('heart');
  const heartCount = counts.heart || 0;

  useEffect(() => {
    if (!pickerOpen) return;
    const handleClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [pickerOpen]);

  const activeOtherReactions = Object.entries(OTHER_REACTIONS).filter(
    ([key]) => counts[key] > 0 || userReactions.includes(key)
  );

  const formatName = (lagnname) => {
    try { return NameFormats.FIRST_LAST(lagnname); }
    catch { return lagnname; }
  };

  return (
    <div className="tally-card">
      <div
        className={`tally-card-avatar ${isOnline ? 'online' : ''}`}
        onClick={() => onProfileClick && onProfileClick(actor)}
        role="button"
        tabIndex={0}
      >
        {actor.profilePic ? (
          <img src={actor.profilePic} alt={displayName} className="tally-card-avatar-img" />
        ) : (
          <div className="tally-card-avatar-fallback">{initial}</div>
        )}
      </div>
      <div className="tally-card-content">
        {milestone && (
          <div className="tally-card-milestone">
            <span className="tally-card-milestone-emoji">{milestone.emoji}</span>
            <span className="tally-card-milestone-name">{milestone.name}</span>
          </div>
        )}
        <div className="tally-card-header">
          <span className="tally-card-name">{displayName}</span>
          {actor.class && <span className="tally-card-badge">{actor.class}</span>}
          <span className="tally-card-time">{timeAgo}</span>
        </div>
        <div className="tally-card-body">
          <span className="tally-card-action">Completed a call session</span>
        </div>
        <div className="tally-card-stats">
          <span className="tally-card-dials">
            <FiPhone /> {data.totalDials || 0} dials
          </span>
          {data.sessionDuration > 0 && (
            <span className="tally-card-duration">
              <FiClock /> {formatDuration(data.sessionDuration)}
            </span>
          )}
          {(data.sessionCount || 0) >= 2 && (
            <span className="tally-card-daily-count">
              {data.sessionCount} sessions
            </span>
          )}
        </div>

        <div className="tally-card-reactions">
          <button
            className={`close-card-heart-btn ${heartActive ? 'active' : ''}`}
            onClick={() => onReact && onReact(event.id, 'heart')}
            title={buildReactorTooltip(reactors, 'heart', formatName) || 'Heart'}
          >
            {heartActive ? <FaHeart className="heart-icon filled" /> : <FiHeart className="heart-icon" />}
            {heartCount > 0 && <span className="reaction-count">{heartCount}</span>}
          </button>

          {activeOtherReactions.map(([key, { emoji }]) => {
            const count = counts[key] || 0;
            const isActive = userReactions.includes(key);
            return (
              <button
                key={key}
                className={`close-card-reaction-btn ${isActive ? 'active' : ''}`}
                onClick={() => onReact && onReact(event.id, key)}
                title={buildReactorTooltip(reactors, key, formatName)}
              >
                <span className="reaction-emoji">{emoji}</span>
                {count > 0 && <span className="reaction-count">{count}</span>}
              </button>
            );
          })}

          <div className="close-card-picker-wrapper" ref={pickerRef}>
            <button
              className="close-card-plus-btn"
              onClick={() => setPickerOpen(!pickerOpen)}
              title="Add reaction"
            >
              <FiPlus />
            </button>
            {pickerOpen && (
              <div className="close-card-picker">
                {Object.entries(OTHER_REACTIONS).map(([key, { emoji, label }]) => (
                  <button
                    key={key}
                    className={`close-card-picker-item ${userReactions.includes(key) ? 'active' : ''}`}
                    onClick={() => {
                      onReact && onReact(event.id, key);
                      setPickerOpen(false);
                    }}
                    title={label}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="tally-card-footer">
          <span className="tally-card-full-date">{fullDate}</span>
        </div>
      </div>
    </div>
  );
};

export default TallySessionCard;
