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
    // Always call onClick if it exists and the item is not disabled
    if (!option.disabled && option.onClick) {
      option.onClick();
      if (!option.preventClose) {
        onClose();
      }
    }
    
    // If item has submenu, also show it (but onClick already navigated)
    if (option.submenu) {
      // Calculate position using the shared function
      const position = calculateSubmenuPosition(event.currentTarget);
      setSubmenuPosition(position);
      setActiveSubmenu(index);
      
      // Clear any existing timeout
      if (submenuTimeoutRef.current) {
        clearTimeout(submenuTimeoutRef.current);
      }
    }
  };

  const calculateSubmenuPosition = (targetElement) => {
    const rect = targetElement.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();
    
    // Check available space to the right and left
    const spaceToRight = window.innerWidth - menuRect.right;
    const spaceToLeft = menuRect.left;
    const submenuWidth = 180; // Approximate submenu width
    
    // Position to the right if there's space, otherwise to the left
    let leftPosition;
    if (spaceToRight >= submenuWidth) {
      // Position to the right, adjacent to the main menu
      leftPosition = menuRect.right + 8; // 8px gap
    } else if (spaceToLeft >= submenuWidth) {
      // Position to the left, adjacent to the main menu
      leftPosition = menuRect.left - submenuWidth - 8; // 8px gap
    } else {
      // Not enough space on either side, overlap slightly
      leftPosition = menuRect.right - 20;
    }
    
    return {
      top: rect.top,
      left: leftPosition
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
      
      // Check available space for nested submenu positioning
      const spaceToRight = window.innerWidth - submenuRect.right;
      const spaceToLeft = submenuRect.left;
      const nestedSubmenuWidth = 150; // Approximate nested submenu width
      
      let leftPosition;
      if (spaceToRight >= nestedSubmenuWidth) {
        // Position to the right, adjacent to the submenu
        leftPosition = submenuRect.right + 8; // 8px gap
      } else if (spaceToLeft >= nestedSubmenuWidth) {
        // Position to the left, adjacent to the submenu
        leftPosition = submenuRect.left - nestedSubmenuWidth - 8; // 8px gap
      } else {
        // Not enough space, overlap slightly
        leftPosition = submenuRect.right - 20;
      }
      
      
      setNestedSubmenuPosition({
        top: rect.top,
        left: leftPosition
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
    
    // Use the same smart positioning logic as click handler
    const spaceToRight = window.innerWidth - submenuRect.right;
    const spaceToLeft = submenuRect.left;
    const nestedSubmenuWidth = 150;
    
    let leftPosition;
    if (spaceToRight >= nestedSubmenuWidth) {
      leftPosition = submenuRect.right + 8;
    } else if (spaceToLeft >= nestedSubmenuWidth) {
      leftPosition = submenuRect.left - nestedSubmenuWidth - 8;
    } else {
      leftPosition = submenuRect.right - 20;
    }
    
    setNestedSubmenuPosition({
      top: rect.top,
      left: leftPosition
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
