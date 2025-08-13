// src/components/utils/ContextMenu.js
import React, { useEffect, useRef, useState } from 'react';
import { FiChevronRight } from 'react-icons/fi';
import './ContextMenu.css';

const ContextMenu = ({ options, onClose, style, className, searchable, searchPlaceholder, onSearchChange, searchValue, roleFilter, onRoleFilterChange, roleOptions }) => {
  const menuRef = useRef(null);
  const [activeSubmenu, setActiveSubmenu] = useState(null);
  const [activeNestedSubmenu, setActiveNestedSubmenu] = useState(null);
  const [submenuPosition, setSubmenuPosition] = useState({ top: 0, left: 0 });
  const [nestedSubmenuPosition, setNestedSubmenuPosition] = useState({ top: 0, left: 0 });
  const submenuTimeoutRef = useRef(null);
  const nestedSubmenuTimeoutRef = useRef(null);
  
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
      if (submenuTimeoutRef.current) {
        clearTimeout(submenuTimeoutRef.current);
      }
      if (nestedSubmenuTimeoutRef.current) {
        clearTimeout(nestedSubmenuTimeoutRef.current);
      }
    };
  }, [onClose]);

  const handleSubmenuClick = (option, index, event) => {
    if (option.submenu) {
      // Calculate position using the shared function
      const position = calculateSubmenuPosition(event.currentTarget);
      setSubmenuPosition(position);
      setActiveSubmenu(index);
      
      // Clear any existing timeout
      if (submenuTimeoutRef.current) {
        clearTimeout(submenuTimeoutRef.current);
      }
    } else {
      if (!option.disabled) {
        option.onClick();
        if (!option.preventClose) {
          onClose();
        }
      }
    }
  };

  const calculateSubmenuPosition = (targetElement) => {
    const rect = targetElement.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();
    
    return {
      top: rect.top,
      left: menuRect.left - 200 // Position to the left with some spacing
    };
  };

  const handleSubmenuMouseEnter = (index, event) => {
    if (submenuTimeoutRef.current) {
      clearTimeout(submenuTimeoutRef.current);
    }
    
    // Calculate position on hover as well
    const position = calculateSubmenuPosition(event.currentTarget);
    setSubmenuPosition(position);
    setActiveSubmenu(index);
  };

  const handleSubmenuMouseLeave = () => {
    // Add a delay before closing the submenu
    submenuTimeoutRef.current = setTimeout(() => {
      setActiveSubmenu(null);
    }, 300); // 300ms delay
  };

  const handleSubmenuAreaMouseEnter = () => {
    // Cancel the timeout if mouse enters the submenu area
    if (submenuTimeoutRef.current) {
      clearTimeout(submenuTimeoutRef.current);
    }
  };

  const handleSubmenuAreaMouseLeave = () => {
    // Close submenu when leaving the submenu area
    submenuTimeoutRef.current = setTimeout(() => {
      setActiveSubmenu(null);
    }, 150); // Shorter delay when leaving submenu
  };

  // Nested submenu handlers
  const handleNestedSubmenuClick = (subOption, subIndex, event, submenuElement) => {
    if (subOption.submenu) {
      const rect = event.currentTarget.getBoundingClientRect();
      const submenuRect = submenuElement.getBoundingClientRect();
      
      // Position nested submenu to the left of the current submenu
      setNestedSubmenuPosition({
        top: rect.top,
        left: submenuRect.left - 200 // Position to the left
      });
      setActiveNestedSubmenu(subIndex);
      
      // Clear any existing timeout
      if (nestedSubmenuTimeoutRef.current) {
        clearTimeout(nestedSubmenuTimeoutRef.current);
      }
    } else {
      if (!subOption.disabled) {
        subOption.onClick();
        onClose();
      }
    }
  };

  const handleNestedSubmenuMouseEnter = (subIndex, event, submenuElement) => {
    if (nestedSubmenuTimeoutRef.current) {
      clearTimeout(nestedSubmenuTimeoutRef.current);
    }
    
    const rect = event.currentTarget.getBoundingClientRect();
    const submenuRect = submenuElement.getBoundingClientRect();
    
    setNestedSubmenuPosition({
      top: rect.top,
      left: submenuRect.left - 200
    });
    setActiveNestedSubmenu(subIndex);
  };

  const handleNestedSubmenuMouseLeave = () => {
    nestedSubmenuTimeoutRef.current = setTimeout(() => {
      setActiveNestedSubmenu(null);
    }, 300);
  };

  const handleNestedSubmenuAreaMouseEnter = () => {
    if (nestedSubmenuTimeoutRef.current) {
      clearTimeout(nestedSubmenuTimeoutRef.current);
    }
  };

  const handleNestedSubmenuAreaMouseLeave = () => {
    nestedSubmenuTimeoutRef.current = setTimeout(() => {
      setActiveNestedSubmenu(null);
    }, 150);
  };

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
            className={`menu-item ${option.className || ''} ${option.disabled ? 'disabled' : ''} ${option.submenu ? 'has-submenu' : ''}`}
            onClick={(e) => handleSubmenuClick(option, index, e)}
            onMouseEnter={(e) => option.submenu ? handleSubmenuMouseEnter(index, e) : null}
            onMouseLeave={() => option.submenu ? handleSubmenuMouseLeave() : null}
          >
            {option.icon && <span className="menu-icon">{option.icon}</span>}
            <span>{option.label}</span>
            {option.submenu && <FiChevronRight className="submenu-arrow" />}
          </div>
        ))}
      </div>
      
      {/* Render submenu */}
      {activeSubmenu !== null && options[activeSubmenu]?.submenu && (
        <div
          className="context-submenu"
          style={{
            position: 'fixed',
            top: submenuPosition.top,
            left: submenuPosition.left,
            zIndex: 1300
          }}
          onMouseEnter={handleSubmenuAreaMouseEnter}
          onMouseLeave={handleSubmenuAreaMouseLeave}
        >
          <div className="context-menu-items">
            {options[activeSubmenu].submenu.map((subOption, subIndex) => (
              <div
                key={subIndex}
                className={`menu-item ${subOption.className || ''} ${subOption.disabled ? 'disabled' : ''} ${subOption.submenu ? 'has-submenu' : ''}`}
                onClick={(e) => {
                  const submenuElement = e.currentTarget.closest('.context-submenu');
                  handleNestedSubmenuClick(subOption, subIndex, e, submenuElement);
                }}
                onMouseEnter={(e) => {
                  const submenuElement = e.currentTarget.closest('.context-submenu');
                  if (subOption.submenu) {
                    handleNestedSubmenuMouseEnter(subIndex, e, submenuElement);
                  }
                }}
                onMouseLeave={() => subOption.submenu ? handleNestedSubmenuMouseLeave() : null}
              >
                {subOption.icon && <span className="menu-icon">{subOption.icon}</span>}
                <span>{subOption.label}</span>
                {subOption.submenu && <FiChevronRight className="submenu-arrow" />}
              </div>
            ))}
          </div>
          
          {/* Render nested submenu */}
          {activeNestedSubmenu !== null && options[activeSubmenu].submenu[activeNestedSubmenu]?.submenu && (
            <div
              className="context-submenu context-nested-submenu"
              style={{
                position: 'fixed',
                top: nestedSubmenuPosition.top,
                left: nestedSubmenuPosition.left,
                zIndex: 1400
              }}
              onMouseEnter={handleNestedSubmenuAreaMouseEnter}
              onMouseLeave={handleNestedSubmenuAreaMouseLeave}
            >
              <div className="context-menu-items">
                {options[activeSubmenu].submenu[activeNestedSubmenu].submenu.map((nestedOption, nestedIndex) => (
                  <div
                    key={nestedIndex}
                    className={`menu-item ${nestedOption.className || ''} ${nestedOption.disabled ? 'disabled' : ''}`}
                    onClick={() => {
                      if (!nestedOption.disabled) {
                        nestedOption.onClick();
                        onClose();
                      }
                    }}
                  >
                    {nestedOption.icon && <span className="menu-icon">{nestedOption.icon}</span>}
                    <span>{nestedOption.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContextMenu;
