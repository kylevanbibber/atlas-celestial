import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';

/**
 * Reusable tooltip component
 * @param {Object} props Component props
 * @param {React.ReactNode} props.children Element that triggers the tooltip
 * @param {string} props.content Tooltip content
 * @param {string} props.position Position of tooltip (top, right, bottom, left)
 * @param {number} props.delay Delay before showing tooltip in ms
 */
const Tooltip = ({ 
  children, 
  content, 
  position = 'top', 
  delay = 300,
  className = ''
}) => {
  const [active, setActive] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [globalPosition, setGlobalPosition] = useState({ top: 0, left: 0 });
  const timeoutRef = useRef(null);
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);

  // Calculate position of tooltip
  const updatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;
    
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    
    let top, left;
    
    switch (position) {
      case 'top':
        top = -tooltipRect.height - 8;
        left = (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'right':
        top = (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.width + 8;
        break;
      case 'bottom':
        top = triggerRect.height + 8;
        left = (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = (triggerRect.height - tooltipRect.height) / 2;
        left = -tooltipRect.width - 8;
        break;
      default:
        top = -tooltipRect.height - 8;
        left = (triggerRect.width - tooltipRect.width) / 2;
    }
    
    // Calculate global position for the portal
    const globalLeft = triggerRect.left + window.scrollX + left;
    const globalTop = triggerRect.top + window.scrollY + top;
    
    setCoords({ top, left });
    setGlobalPosition({ top: globalTop, left: globalLeft });
  };

  // Handle mouse enter
  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setActive(true);
      // Wait for next tick for tooltip to render before calculating position
      setTimeout(updatePosition, 0);
    }, delay);
  };

  // Handle mouse leave
  const handleMouseLeave = () => {
    clearTimeout(timeoutRef.current);
    setActive(false);
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Update position if window resizes
  useEffect(() => {
    if (active) {
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition);
      };
    }
  }, [active]);

  // Render tooltip into the document body using portal
  const renderTooltip = () => {
    if (!active) return null;
    
    return ReactDOM.createPortal(
      <div 
        className={`tooltip tooltip-${position} ${className}`}
        style={{ 
          position: 'absolute',
          top: globalPosition.top, 
          left: globalPosition.left,
          zIndex: 9999
        }}
        ref={tooltipRef}
      >
        {content}
      </div>,
      document.body
    );
  };

  return (
    <>
      <div 
        className="tooltip-container" 
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        ref={triggerRef}
      >
        {children}
      </div>
      {renderTooltip()}
    </>
  );
};

export default Tooltip; 