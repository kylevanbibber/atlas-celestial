import React, { useState, useRef, useEffect } from 'react';
import { FiHeart, FiPlus } from 'react-icons/fi';
import { FaHeart } from 'react-icons/fa';
import { NameFormats, getFirstInitial } from '../../../utils/nameFormatter';
import './MilestoneCard.css';

function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return new Date(timestamp).toLocaleDateString();
}

function formatFullDate(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });
}

function buildReactorTooltip(reactors, reactionKey, nameFormatter) {
  const names = reactors?.[reactionKey];
  if (!names || names.length === 0) return '';
  const formatted = names.map(n => nameFormatter(n)).slice(0, 10);
  if (names.length > 10) formatted.push(`+${names.length - 10} more`);
  return formatted.join(', ');
}

const OTHER_REACTIONS = {
  like: { emoji: '\u{1F44D}', label: 'Like' },
  fire: { emoji: '\u{1F525}', label: 'Fire' },
  clap: { emoji: '\u{1F44F}', label: 'Clap' },
  money: { emoji: '\u{1F4B0}', label: 'Money' },
};

const MILESTONE_CONFIG = {
  record_week: {
    icon: '\u{1F3C6}',
    label: 'New Record Week',
    accent: 'gold',
  },
  first_4k_week: {
    icon: '\u{2B50}',
    label: 'First $4K+ Week',
    accent: 'blue',
  },
  '8k_week': {
    icon: '\u{1F525}',
    label: 'Wall of Fame',
    accent: 'fire',
  },
};

const MilestoneCard = ({ event, onReact, onProfileClick, activeUserIds = [] }) => {
  const { actor, data, timestamp, reactions } = event;
  const config = MILESTONE_CONFIG[event.type] || MILESTONE_CONFIG.record_week;
  const timeAgo = getTimeAgo(timestamp);
  const fullDate = formatFullDate(timestamp);
  const displayName = NameFormats.FIRST_LAST(actor.name);
  const initial = getFirstInitial(actor.name);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);

  const isOnline = activeUserIds.includes(actor.id);

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

  const amount = data.amount ? `$${Number(data.amount).toLocaleString()}` : '';

  return (
    <div className={`milestone-card milestone-${config.accent}`}>
      <div className="milestone-card-banner">
        <span className="milestone-card-icon">{config.icon}</span>
        <span className="milestone-card-label">{config.label}</span>
      </div>

      <div className="milestone-card-main">
        <div
          className={`milestone-card-avatar ${isOnline ? 'online' : ''}`}
          onClick={() => onProfileClick && onProfileClick(actor)}
          role="button"
          tabIndex={0}
        >
          {actor.profilePic ? (
            <img src={actor.profilePic} alt={displayName} className="milestone-card-avatar-img" />
          ) : (
            <div className="milestone-card-avatar-fallback">{initial}</div>
          )}
        </div>

        <div className="milestone-card-content">
          <div className="milestone-card-header">
            <span className="milestone-card-name">{displayName}</span>
            {actor.class && <span className="milestone-card-badge">{actor.class}</span>}
            <span className="milestone-card-time">{timeAgo}</span>
          </div>

          <div className="milestone-card-amount">{amount}</div>

          {event.type === 'record_week' && data.previousRecord > 0 && (
            <div className="milestone-card-detail">
              Previous record: ${Number(data.previousRecord).toLocaleString()}
            </div>
          )}

          <div className="milestone-card-week">Week of {data.weekDate}</div>

          <div className="milestone-card-reactions">
            <button
              className={`milestone-card-heart-btn ${heartActive ? 'active' : ''}`}
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
                  className={`milestone-card-reaction-btn ${isActive ? 'active' : ''}`}
                  onClick={() => onReact && onReact(event.id, key)}
                  title={buildReactorTooltip(reactors, key, formatName)}
                >
                  <span className="reaction-emoji">{emoji}</span>
                  {count > 0 && <span className="reaction-count">{count}</span>}
                </button>
              );
            })}

            <div className="milestone-card-picker-wrapper" ref={pickerRef}>
              <button
                className="milestone-card-plus-btn"
                onClick={() => setPickerOpen(!pickerOpen)}
                title="Add reaction"
              >
                <FiPlus />
              </button>
              {pickerOpen && (
                <div className="milestone-card-picker">
                  {Object.entries(OTHER_REACTIONS).map(([key, { emoji, label }]) => (
                    <button
                      key={key}
                      className={`milestone-card-picker-item ${userReactions.includes(key) ? 'active' : ''}`}
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

          <div className="milestone-card-footer">
            <span className="milestone-card-full-date">{fullDate}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MilestoneCard;
