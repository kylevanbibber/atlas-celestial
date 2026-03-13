import React, { useState, useRef, useEffect } from 'react';
import { FiDollarSign, FiHeart, FiPlus } from 'react-icons/fi';
import { FaHeart } from 'react-icons/fa';
import { NameFormats, getFirstInitial } from '../../../utils/nameFormatter';
import './CloseCard.css';

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

function buildReactorTooltip(reactors, reactionKey, nameFormatter) {
  const names = reactors?.[reactionKey];
  if (!names || names.length === 0) return '';
  const formatted = names.map(n => nameFormatter(n)).slice(0, 10);
  if (names.length > 10) formatted.push(`+${names.length - 10} more`);
  return formatted.join(', ');
}

const DAILY_MILESTONES = {
  3: { name: 'Hat Trick', emoji: '\u{1F3A9}' },
  4: { name: '4 Piece Dinner', emoji: '\u{1F357}' },
  5: { name: 'Five Alive', emoji: '\u{1F590}' },
  6: { name: 'Half Dozen', emoji: '\u{1F95A}' },
  7: { name: 'Seventh Heaven', emoji: '\u{2601}\u{FE0F}' },
  8: { name: 'Octane', emoji: '\u{26FD}' },
  9: { name: 'On Cloud 9', emoji: '\u{1F324}\u{FE0F}' },
  10: { name: 'Dime Piece', emoji: '\u{1F48E}' },
};

const LEAD_TYPE_LABELS = {
  union: 'Union',
  credit_union: 'Credit Union',
  association: 'Association',
  pos: 'POS',
  ref: 'Referral',
  child_safe: 'Child Safe',
  free_will_kit: 'Free Will Kit',
  other: 'Other'
};

const OTHER_REACTIONS = {
  like: { emoji: '\u{1F44D}', label: 'Like' },
  fire: { emoji: '\u{1F525}', label: 'Fire' },
  clap: { emoji: '\u{1F44F}', label: 'Clap' },
  money: { emoji: '\u{1F4B0}', label: 'Money' },
};

const CloseCard = ({ event, onReact, onProfileClick, activeUserIds = [], isFirstBlood = false }) => {
  const { actor, data, timestamp, reactions } = event;
  const timeAgo = getTimeAgo(timestamp);
  const fullDate = formatFullDate(timestamp);
  const displayName = NameFormats.FIRST_LAST(actor.name);
  const initial = getFirstInitial(actor.name);
  const [imageExpanded, setImageExpanded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);

  const isOnline = activeUserIds.includes(actor.id);
  const dailySaleNumber = data.dailySaleNumber || 0;
  const dailyAlpTotal = data.dailyAlpTotal || 0;
  const milestone = DAILY_MILESTONES[dailySaleNumber] || (dailySaleNumber > 10 ? { name: `${dailySaleNumber} Sales Today`, emoji: '\u{1F525}' } : null);

  const counts = reactions?.counts || {};
  const userReactions = reactions?.userReactions || [];
  const reactors = reactions?.reactors || {};
  const heartActive = userReactions.includes('heart');
  const heartCount = counts.heart || 0;

  // Close picker on outside click
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

  // Other reactions that have counts (to show as pills)
  const activeOtherReactions = Object.entries(OTHER_REACTIONS).filter(
    ([key]) => counts[key] > 0 || userReactions.includes(key)
  );

  const formatName = (lagnname) => {
    try { return NameFormats.FIRST_LAST(lagnname); }
    catch { return lagnname; }
  };

  return (
    <div className="close-card">
      <div
        className={`close-card-avatar ${isOnline ? 'online' : ''}`}
        onClick={() => onProfileClick && onProfileClick(actor)}
        role="button"
        tabIndex={0}
      >
        {actor.profilePic ? (
          <img src={actor.profilePic} alt={displayName} className="close-card-avatar-img" />
        ) : (
          <div className="close-card-avatar-fallback">{initial}</div>
        )}
      </div>
      <div className="close-card-content">
        {isFirstBlood && (
          <div className="close-card-first-blood">
            <span className="close-card-milestone-emoji">🩸</span>
            <span className="close-card-milestone-name">First Blood</span>
          </div>
        )}
        {milestone && (
          <div className="close-card-milestone">
            <span className="close-card-milestone-emoji">{milestone.emoji}</span>
            <span className="close-card-milestone-name">{milestone.name}</span>
          </div>
        )}
        <div className="close-card-header">
          <span className="close-card-name">{displayName}</span>
          {actor.class && <span className="close-card-badge">{actor.class}</span>}
          <span className="close-card-time">{timeAgo}</span>
        </div>
        <div className="close-card-body">
          <span className="close-card-action">Closed a sale</span>
          {data.leadType && (
            <span className="close-card-lead-type">
              {LEAD_TYPE_LABELS[data.leadType] || data.leadType}
            </span>
          )}
        </div>
        <div className="close-card-stats">
          <span className="close-card-alp">
            <FiDollarSign /> {data.alp.toLocaleString()} ALP
          </span>
          {data.refs > 0 && (
            <span className="close-card-refs">
              {data.refs} ref{data.refs !== 1 ? 's' : ''}
            </span>
          )}
          {dailySaleNumber >= 2 && (
            <span className="close-card-daily-alp">
              Day Total: ${dailyAlpTotal.toLocaleString()}
            </span>
          )}
        </div>

        {data.imageUrl && (
          <div className="close-card-image-wrapper">
            <img
              src={data.imageUrl}
              alt="Close proof"
              className={`close-card-image ${imageExpanded ? 'expanded' : ''}`}
              onClick={() => setImageExpanded(!imageExpanded)}
            />
          </div>
        )}

        <div className="close-card-reactions">
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

        <div className="close-card-footer">
          <span className="close-card-full-date">{fullDate}</span>
        </div>
      </div>
    </div>
  );
};

export default CloseCard;
