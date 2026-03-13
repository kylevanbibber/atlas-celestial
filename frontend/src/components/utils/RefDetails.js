import React, { useState, useEffect } from "react";
import { DateTime } from "luxon";
import Select from "react-select";
import DynamicField from "./DynamicField";
import InteractionItem from "./InteractionItem";
import "./RightDetails.css";
import api from "../../api";

const RefDetails = ({ data, columns = [], onClose, onSave }) => {
  const [formData, setFormData] = useState(data || {});
  const [linkedinExpanded, setLinkedinExpanded] = useState(false);
  const [interactions, setInteractions] = useState([]);
  const [interactionFilter, setInteractionFilter] = useState([]);
  const [filteredInteractions, setFilteredInteractions] = useState([]);

  useEffect(() => {
    setFormData(data || {});
    if (data && data.id) {
      fetchInteractions();
    }
  }, [data]);

  useEffect(() => {
    if (interactionFilter.length === 0) {
      setFilteredInteractions(interactions);
    } else {
      const filterValues = interactionFilter.map((opt) => opt.value);
      setFilteredInteractions(
        interactions.filter((i) => filterValues.includes(i.interaction_type))
      );
    }
  }, [interactions, interactionFilter]);

  const fetchInteractions = async () => {
    if (data && data.id) {
      try {
        const response = await api.get(`/interactions/${data.id}`);
        setInteractions(response.data);
      } catch (error) {
        console.error("Error fetching interactions:", error);
      }
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

  const handleBlur = (e, key) => {
    e.stopPropagation();
    if (onSave) onSave(formData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (onSave) await onSave(formData);
  };

  const handleContainerClick = (e) => {
    // Only close if clicking directly on the container background
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleContentClick = (e) => {
    // Prevent clicks on the content from closing the panel
    e.stopPropagation();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const hours = date.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(-2)} ${displayHours}:${date.getMinutes().toString().padStart(2, '0')} ${ampm}`;
  };

  const displayColumns = columns.filter((col) => col.accessor !== "selection" && col.accessor !== "massSelection");

  const statusColumn = displayColumns.find((col) => col.accessor === "status");
  const assignedColumn = displayColumns.find((col) => col.accessor === "assigned_to");

  const mainFields = displayColumns.filter(
    (col) =>
      col.accessor !== "status" &&
      !["linkedin", "linkedin_bio", "more_linkedin_info", "name", "assigned_to"].includes(col.accessor)
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
        onBlur={(e) => handleBlur(e, col.accessor)}
        onClick={(e) => e.stopPropagation()}
      />
    );
  };

  const interactionOptions = Array.from(
    new Set(interactions.map((i) => i.interaction_type))
  ).map((type) => ({ value: type, label: type }));

  return (
    <div className="right-details-container" onClick={handleContainerClick}>
      <div className="right-details-content" onClick={handleContentClick}>
        <div className="right-details-topbar">
          <span className="page-chip">Reference</span>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="right-details-header">
          <div className="header-top">
            <input
              type="text"
              value={formData.name || ""}
              onChange={(e) => handleChange("name", e.target.value)}
              onBlur={(e) => handleBlur(e, "name")}
              onClick={(e) => e.stopPropagation()}
              className="person-name-input"
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                border: "none",
                background: "transparent",
                width: "100%",
                padding: "0",
                margin: "0"
              }}
            />
          </div>
        </div>

        {/* Status and Assigned Row */}
        {(statusColumn || assignedColumn) && (
          <div className="status-assigned-row" style={{ display: "flex", gap: "20px", marginBottom: "10px" }}>
            {statusColumn && (
              <div style={{ flex: 1 }}>
                <DynamicField
                  column={statusColumn}
                  value={formData[statusColumn.accessor]}
                  onChange={(val) => handleImmediateChange(statusColumn.accessor, val)}
                />
              </div>
            )}
            {assignedColumn && (
              <div style={{ flex: 1 }}>
                <DynamicField
                  column={assignedColumn}
                  value={formData[assignedColumn.accessor]}
                  onChange={(val) => handleImmediateChange(assignedColumn.accessor, val)}
                />
              </div>
            )}
          </div>
        )}

        {/* Date Info Row */}
        <div className="date-info-row" style={{ display: "flex", gap: "20px", marginBottom: "20px", color: "#666", fontSize: "14px" }}>
          {formData.date_created && (
            <div>Created: {formatDate(formData.date_created)}</div>
          )}
          {formData.last_updated && (
            <div>Updated: {formatDate(formData.last_updated)}</div>
          )}
        </div>

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

            {displayColumns.some((col) => col.accessor === "linkedin") && (
              <>
                <div className="right-details-field">
                  <div className="field-label">
                    <label htmlFor="linkedin">LinkedIn</label>
                  </div>
                  <div className="field-value" style={{ display: "flex", alignItems: "center" }}>
                    {renderField("linkedin")}
                    <button
                      type="button"
                      className="toggle-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLinkedinExpanded(!linkedinExpanded);
                      }}
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: "16px",
                        color: "#666",
                        marginLeft: "8px",
                        transform: linkedinExpanded ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease-in-out",
                      }}
                      title={linkedinExpanded ? "Collapse" : "Expand"}
                    >
                      &gt;
                    </button>
                  </div>
                </div>
                {linkedinExpanded && (
                  <>
                    <div className="right-details-field sub-field">
                      <div className="field-label">
                        <label htmlFor="linkedin_bio">LinkedIn Bio</label>
                      </div>
                      <div className="field-value">{renderField("linkedin_bio")}</div>
                    </div>
                    <div className="right-details-field sub-field">
                      <div className="field-label">
                        <label htmlFor="more_linkedin_info">More LinkedIn Info</label>
                      </div>
                      <div className="field-value">{renderField("more_linkedin_info")}</div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Interactions Section */}
          <div className="interactions-section" style={{ marginTop: "2rem" }}>
            <div className="interactions-header">
              <h3>Interactions</h3>
              <div className="interactions-filter">
                <Select
                  isMulti
                  options={interactionOptions}
                  value={interactionFilter}
                  onChange={setInteractionFilter}
                  placeholder="Filter by type..."
                />
              </div>
            </div>
            <div className="interactions-list">
              {filteredInteractions.map((interaction) => (
                <InteractionItem
                  key={interaction.id}
                  interaction={interaction}
                  onDelete={() => {
                    setInteractions(prev => prev.filter(i => i.id !== interaction.id));
                  }}
                />
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RefDetails; 