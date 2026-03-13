import React, { useState, useEffect, useRef } from "react";
import { DateTime } from "luxon";
import Select from "react-select";
import TabBar from "./TabBar";
import DynamicField from "./DynamicField";
import InteractionContextMenu from "./InteractionContextMenu";
import InteractionItem from "./InteractionItem";
import ContextMenuPortal from "./ContextMenuPortal";
// import GoogleCalendarTest from "../../google/GoogleCalendar";
// import Email from "../../google/Email";
import SearchSelectInput from "./SearchSelectInput"; 
import "./RightDetails.css";
import api from "../../api";

const PeopleDetails = ({ data, columns = [], onClose, onSave, showToast = (msg, type) => console.log(msg, type) }) => {
  const [formData, setFormData] = useState(data || {});
  const [linkedinExpanded, setLinkedinExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("Home");
  const isPeopleParent = true;
  const [interactions, setInteractions] = useState([]);
  const [interactionFilter, setInteractionFilter] = useState([]);
  const [filteredInteractions, setFilteredInteractions] = useState([]);
  const [showInteractionMenu, setShowInteractionMenu] = useState(false);
  const [interactionMenuPosition, setInteractionMenuPosition] = useState({ x: 0, y: 0 });
  
  const [companies, setCompanies] = useState([]);
  const [editingCompany, setEditingCompany] = useState(false);

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

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await api.get("/companies");
        setCompanies(response.data);
      } catch (error) {
        console.error("Error fetching companies:", error);
      }
    };
    fetchCompanies();
  }, []);

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

  const statusColumn = displayColumns.find((col) => col.accessor === "status");
  const assignedColumn = displayColumns.find((col) => col.accessor === "assigned_to");

  const mainFields = displayColumns.filter(
    (col) =>
      col.accessor !== "status" &&
      !["linkedin", "linkedin_bio", "more_linkedin_info", "name", "vip", "company", "assigned_to"].includes(col.accessor)
  );

  // Render a field based on its type.
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

  const interactionOptions = Array.from(
    new Set(interactions.map((i) => i.interaction_type))
  ).map((type) => ({ value: type, label: type }));

  return (
    <div className="right-details-container">
      <div className="right-details-topbar">
        <span className="page-chip">People</span>
        <button className="close-button" onClick={onClose}>
          ×
        </button>
      </div>

      <TabBar>
        <span className={`tab ${activeTab === "Home" ? "active" : ""}`} onClick={() => setActiveTab("Home")}>Home</span>
        <span className={`tab ${activeTab === "Emails" ? "active" : ""}`} onClick={() => setActiveTab("Emails")}>Emails</span>
        <span className={`tab ${activeTab === "Calendar" ? "active" : ""}`} onClick={() => setActiveTab("Calendar")}>Calendar</span>
        <span className={`tab ${activeTab === "Interactions" ? "active" : ""}`} onClick={() => setActiveTab("Interactions")}>Interactions</span>
      </TabBar>

      <div className="right-details-header">
        <div className="header-top" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 className="person-name" style={{ margin: 0 }}>
            {data?.name || "Unnamed"}
          </h2>
          <label className="vip-checkbox" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <input
              type="checkbox"
              checked={!!formData.vip}
              onChange={(e) => handleImmediateChange("vip", e.target.checked)}
            />
            VIP
          </label>
        </div>
        <div className="date-info">
          {createdAt && <div className="created-at">Added {createdAt.toLocaleString()}</div>}
          {updatedAt && <div className="updated-at">Last updated {updatedAt.toLocaleString()}</div>}
        </div>
      </div>
      {activeTab === "Home" && (
        <>
          {/* Status and Assigned Row */}
          {(statusColumn || assignedColumn) && (
            <div className="status-center-row" style={{ display: "flex", gap: "20px", justifyContent: "center", alignItems: "center" }}>
              {statusColumn && (
                <DynamicField
                  column={statusColumn}
                  value={formData[statusColumn.accessor]}
                  onChange={(val) => handleImmediateChange(statusColumn.accessor, val)}
                />
              )}
              {assignedColumn && (
                <DynamicField
                  column={assignedColumn}
                  value={formData[assignedColumn.accessor]}
                  onChange={(val) => handleImmediateChange(assignedColumn.accessor, val)}
                />
              )}
            </div>
          )}

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
                        onClick={() => setLinkedinExpanded(!linkedinExpanded)}
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
          </form>
        </>
      )}

      {activeTab === "Emails" && (
        <div className="emails-section">
          {/* <Email personId={data?.id} /> */}
          <div>Email functionality not available in this app</div>
        </div>
      )}

      {activeTab === "Calendar" && (
        <div className="calendar-section">
          {/* <GoogleCalendarTest personId={data?.id} /> */}
          <div>Calendar functionality not available in this app</div>
        </div>
      )}

      {activeTab === "Interactions" && (
        <div className="interactions-section">
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
      )}
    </div>
  );
};

export default PeopleDetails; 