import React, { useState } from "react";
import "./MassReassignMenu.css";

const MassReassignMenu = ({ leads = [], users = [], selectedLeadIds = [], onReassign, onClose }) => {
  const [selectedUser, setSelectedUser] = useState("");

  const selectedLeads = leads.filter(
    (lead) => selectedLeadIds.includes(lead.id.toString())
  );
  const totalSelected = selectedLeads.length;

  const selectedLeadsBreakdown = selectedLeads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {});

  const currentUserBreakdown = selectedUser
    ? leads
        .filter((lead) => lead.assigned_to === parseInt(selectedUser, 10))
        .reduce((acc, lead) => {
          acc[lead.status] = (acc[lead.status] || 0) + 1;
          return acc;
        }, {})
    : {};

  const toReassignBreakdown = selectedUser
    ? selectedLeads
        .filter((lead) => lead.assigned_to !== parseInt(selectedUser, 10))
        .reduce((acc, lead) => {
          acc[lead.status] = (acc[lead.status] || 0) + 1;
          return acc;
        }, {})
    : { ...selectedLeadsBreakdown };

  const statuses = Array.from(
    new Set([
      ...Object.keys(selectedLeadsBreakdown),
      ...Object.keys(toReassignBreakdown),
      ...Object.keys(currentUserBreakdown),
    ])
  );

  const totalSelectedBreakdown = statuses.reduce(
    (sum, status) => sum + (selectedLeadsBreakdown[status] || 0),
    0
  );

  const currentTotal = statuses.reduce(
    (sum, status) => sum + (currentUserBreakdown[status] || 0),
    0
  );
  const toAddTotal = statuses.reduce(
    (sum, status) => sum + (toReassignBreakdown[status] || 0),
    0
  );
  const newTotal = currentTotal + toAddTotal;

  const handleReassign = () => {
    if (selectedUser) {
      onReassign(selectedUser);
      onClose();
    }
  };

  return (
    <div className="mass-reassign-menu">
      <h3>Mass Reassign</h3>
      <div className="summary">
        <h4>Selected Leads Breakdown</h4>
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {statuses.map((status) => (
              <tr key={status}>
                <td>{status}</td>
                <td>{selectedLeadsBreakdown[status] || 0}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td>Total</td>
              <td>{totalSelectedBreakdown}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="reassign-control">
        <label htmlFor="reassignUser">Reassign to: </label>
        <select
          id="reassignUser"
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
        >
          <option value="">Select a user</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.first_name} {/* Using lagnname for display */}
            </option>
          ))}
        </select>
      </div>
      {selectedUser && (
        <div className="user-breakdown">
          <h4>Breakdown for Selected User</h4>
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Current</th>
                <th>+ (Reassign)</th>
                <th>New Total</th>
              </tr>
            </thead>
            <tbody>
              {statuses.map((status) => {
                const current = currentUserBreakdown[status] || 0;
                const toAdd = toReassignBreakdown[status] || 0;
                return (
                  <tr key={status}>
                    <td>{status}</td>
                    <td>{current}</td>
                    <td>{toAdd > 0 ? `+${toAdd}` : toAdd}</td>
                    <td>{current + toAdd}</td>
                  </tr>
                );
              })}
              <tr className="total-row">
                <td>Total</td>
                <td>{currentTotal}</td>
                <td>{toAddTotal > 0 ? `+${toAddTotal}` : toAddTotal}</td>
                <td>{newTotal}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <div className="actions">
        <button onClick={handleReassign} disabled={!selectedUser}>
          Reassign
        </button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
};

export default MassReassignMenu;
