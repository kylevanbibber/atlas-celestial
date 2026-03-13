import React from 'react';
import './ContextMenu.css';

const InteractionContextMenu = ({ x, y, onClose, onAdd }) => {
  return (
    <div
      className="context-menu"
      style={{
        position: 'fixed',
        top: y,
        left: x,
        zIndex: 1000
      }}
    >
      <div className="context-menu-item" onClick={() => {
        onAdd('Call');
        onClose();
      }}>
        Call
      </div>
      <div className="context-menu-item" onClick={() => {
        onAdd('Email');
        onClose();
      }}>
        Email
      </div>
      <div className="context-menu-item" onClick={() => {
        onAdd('Meeting');
        onClose();
      }}>
        Meeting
      </div>
      <div className="context-menu-item" onClick={() => {
        onAdd('Note');
        onClose();
      }}>
        Note
      </div>
    </div>
  );
};

export default InteractionContextMenu; 