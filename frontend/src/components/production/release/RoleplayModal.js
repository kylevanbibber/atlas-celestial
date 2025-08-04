import React from "react";
import "./RoleplayModal.css";

const RoleplayModal = ({ isOpen, onClose, content }) => {
  if (!isOpen) return null;

  return (
    <div className="roleplay-modal-backdrop" onClick={onClose}>
      <div className="roleplay-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="roleplay-modal-header">
          <h3>Roleplay Information</h3>
          <button className="roleplay-modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="roleplay-modal-body">
          <div dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      </div>
    </div>
  );
};

export default RoleplayModal; 