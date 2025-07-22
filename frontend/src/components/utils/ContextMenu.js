// src/components/utils/ContextMenu.js
import React, { useEffect, useRef } from 'react';
import './ContextMenu.css';

const ContextMenu = ({ options, onClose, style, className, searchable, searchPlaceholder, onSearchChange, searchValue, roleFilter, onRoleFilterChange, roleOptions }) => {
  const menuRef = useRef(null);
  
  useEffect(() => {
    // Add click-outside listener
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };
    
    // Add the event listener
    document.addEventListener('mousedown', handleClickOutside);
    
    // Clean up the event listener on component unmount
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className={`context-menu ${className || ''}`}
      style={style}
    >
      {searchable && (
        <div className="context-menu-search">
          <input
            type="text"
            placeholder={searchPlaceholder || "Search..."}
            value={searchValue || ''}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            className="context-menu-search-input"
            onClick={(e) => e.stopPropagation()}
          />
          {roleOptions && roleOptions.length > 0 && (
            <div className="context-menu-role-filters">
              <button
                className={`role-filter-btn ${!roleFilter ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRoleFilterChange && onRoleFilterChange('');
                }}
              >
                All
              </button>
              {roleOptions.map((role) => (
                <button
                  key={role}
                  className={`role-filter-btn ${roleFilter === role ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRoleFilterChange && onRoleFilterChange(role);
                  }}
                >
                  {role}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className={`context-menu-items ${searchable ? 'with-search' : ''}`}>
        {options.map((option, index) => (
          <div
            key={index}
            className={`menu-item ${option.className || ''} ${option.disabled ? 'disabled' : ''}`}
            onClick={() => {
              if (!option.disabled) {
                option.onClick();
                if (!option.preventClose) {
                  onClose();
                }
              }
            }}
          >
            {option.icon && <span className="menu-icon">{option.icon}</span>}
            <span>{option.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContextMenu;
