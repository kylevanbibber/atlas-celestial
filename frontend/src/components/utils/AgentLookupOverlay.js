import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";
import AgentViewer from "./AgentViewer";
import "./AgentLookupOverlay.css";

const AgentLookupOverlay = ({ agentData, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const wrapperRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  }, []);

  useEffect(() => {
    const scrollContainer = document.querySelector('.page-content');
    if (scrollContainer) scrollContainer.style.overflow = 'hidden';

    const timer = setTimeout(() => setIsVisible(true), 10);

    const handleEscape = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleEscape);

    return () => {
      if (scrollContainer) scrollContainer.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 250);
  };

  return createPortal(
    <div className={`agent-lookup-overlay-backdrop ${isVisible ? 'visible' : ''}`} onClick={handleClose}>
      <div
        ref={wrapperRef}
        className={`agent-lookup-overlay-wrapper ${isVisible ? 'visible' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onMouseMove={handleMouseMove}
      >
        <div className="agent-lookup-overlay-border" />
        <div className="agent-lookup-overlay-inner">
          <button className="agent-lookup-overlay-close" onClick={handleClose}>
            <FiX size={20} />
          </button>
          <div className="agent-lookup-overlay-content">
            <AgentViewer agentData={agentData} onClose={handleClose} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AgentLookupOverlay;
