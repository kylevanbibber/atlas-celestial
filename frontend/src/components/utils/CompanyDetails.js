import React, { useState, useEffect } from 'react';
import { DateTime } from 'luxon';
import TabBar from './TabBar';
import DynamicField from './DynamicField';
import './RightDetails.css';
import api from '../../api';

const CompanyDetails = ({ data, columns = [], onClose, onSave }) => {
  const [formData, setFormData] = useState(data || {});
  const [activeTab, setActiveTab] = useState("Home");
  const [users, setUsers] = useState([]);

  useEffect(() => {
    setFormData(data || {});
    fetchUsers();
  }, [data]);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/auth/activeusers');
      setUsers(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleImmediateChange = (key, value) => {
    const newData = { ...formData, [key]: value };
    setFormData(newData);
    if (onSave) onSave(newData);
  };

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleBlur = (key) => {
    if (onSave) onSave(formData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (onSave) await onSave(formData);
  };

  const createdAt = data?.created_at ? new Date(data.created_at) : null;
  const updatedAt = data?.updated_at ? new Date(data.updated_at) : null;

  const displayColumns = columns.filter((col) => col.accessor !== "selection");

  const mainFields = displayColumns.filter(
    (col) =>
      !["name", "assigned_to"].includes(col.accessor)
  );

  const renderField = (fieldName) => {
    const col = displayColumns.find((c) => c.accessor === fieldName);
    if (!col) return null;

    if (col.accessor === "assigned_to") {
      return (
        <DynamicField
          column={col}
          value={formData[col.accessor]}
          onChange={(value) => handleImmediateChange(col.accessor, value)}
        />
      );
    }

    if (col.DropdownOptions) {
      return (
        <DynamicField
          column={col}
          value={formData[col.accessor]}
          onChange={(value) => handleImmediateChange(col.accessor, value)}
        />
      );
    }

    return (
      <input
        type="text"
        value={formData[col.accessor] || ""}
        onChange={(e) => handleChange(col.accessor, e.target.value)}
        onBlur={() => handleBlur(col.accessor)}
      />
    );
  };

  return (
    <div className="right-details-container">
      <div className="right-details-topbar">
        <span className="page-chip">Company</span>
        <button className="close-button" onClick={onClose}>
          ×
        </button>
      </div>

      <TabBar>
        <span className={`tab ${activeTab === "Home" ? "active" : ""}`} onClick={() => setActiveTab("Home")}>Home</span>
        <span className={`tab ${activeTab === "People" ? "active" : ""}`} onClick={() => setActiveTab("People")}>People</span>
      </TabBar>

      <div className="right-details-header">
        <div className="header-top" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 className="company-name" style={{ margin: 0 }}>
            {data?.name || "Unnamed Company"}
          </h2>
        </div>
        <div className="date-info">
          {createdAt && <div className="created-at">Added {createdAt.toLocaleString()}</div>}
          {updatedAt && <div className="updated-at">Last updated {updatedAt.toLocaleString()}</div>}
        </div>
      </div>

      {activeTab === "Home" && (
        <form className="right-details-form" onSubmit={handleSubmit}>
          <div className="fields-section">
            {mainFields.map((col) => (
              <div key={col.accessor} className="right-details-field">
                <div className="field-label">
                  <label htmlFor={col.accessor}>{col.Header || col.accessor}</label>
                </div>
                <div className="field-value">{renderField(col.accessor)}</div>
              </div>
            ))}
          </div>
        </form>
      )}

      {activeTab === "People" && (
        <div className="people-section">
          {/* Implement people list here */}
        </div>
      )}
    </div>
  );
};

export default CompanyDetails; 