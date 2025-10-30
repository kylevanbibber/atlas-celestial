import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useUserHierarchy } from "../../hooks/useUserHierarchy";
import api from "../../api";
import DataTable from "../utils/DataTable";
import { FiSearch, FiPlus, FiX, FiCheck } from "react-icons/fi";
import { toast } from 'react-hot-toast';
import { US_STATES } from '../../constants';
import "../../App.css";

const AdminLicensing = () => {
  const { user } = useAuth();
  const { hierarchyData, hierarchyLoading, getHierarchyForComponent } = useUserHierarchy();
  const [licenses, setLicenses] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Add license modal state
  const [showAddLicenseModal, setShowAddLicenseModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [newLicense, setNewLicense] = useState({
    state: '',
    license_number: '',
    expiry_date: '',
    resident_state: false
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  // Check if user has elevated permissions (can see all data)
  const hasElevatedPermissions = useMemo(() => {
    if (!user) return false;
    const teamRole = user.teamRole || '';
    const role = user.Role || '';
    const clname = user.clname || '';
    
    return teamRole === 'app' || role === 'Admin' || clname === 'SGA';
  }, [user]);

  // Check if user is an AGT (agent) who can only see themselves
  const isAgtUser = useMemo(() => {
    if (!user) return false;
    const clname = user.clname || '';
    return clname === 'AGT';
  }, [user]);

  // Get allowed IDs from cached hierarchy data
  const allowedIds = useMemo(() => {
    if (hasElevatedPermissions) return []; // Elevated users see all data
    if (isAgtUser) return [user?.userId || user?.id].filter(Boolean); // AGT users only see themselves
    return getHierarchyForComponent('ids');
  }, [hasElevatedPermissions, isAgtUser, getHierarchyForComponent, user?.userId, user?.id]);
  
  const allowedIdsSet = useMemo(() => new Set(allowedIds.map(id => String(id))), [allowedIds]);

  // Format date for display
  const formatDateForDisplay = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  // Handle opening add license modal for specific agent
  const handleAddLicenseForAgent = useCallback((agentRow) => {
    setSelectedAgent({
      userId: agentRow.userId,
      lagnname: agentRow.lagnname,
      mga: agentRow.mga
    });
    setNewLicense({
      state: '',
      license_number: '',
      expiry_date: '',
      resident_state: false
    });
    setFormErrors({});
    setShowAddLicenseModal(true);
  }, []);

  // Define grouped table columns (hide raw id/userId; show agent and states summary)
  const columns = React.useMemo(() => [
    {
      Header: "Agent",
      accessor: "lagnname",
      width: 240,
    },
    {
      Header: "MGA",
      accessor: "mga",
      width: 200,
    },
    {
      Header: "States",
      accessor: "statesSummary",
      width: 240,
    },
 
    {
      Header: "Total Licenses",
      accessor: "licenseCount",
      width: 140,
    },
    {
      Header: "Actions",
      accessor: "actions",
      width: 120,
      Cell: ({ row }) => (
        <button
          onClick={() => handleAddLicenseForAgent(row.original)}
          className="btn btn-sm btn-outline-primary"
          style={{ 
            fontSize: '12px',
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
          title={`Add license for ${row.original.lagnname}`}
        >
          <FiPlus size={14} />
          Add License
        </button>
      )
    },
  ], [handleAddLicenseForAgent]);

  // Prepare grouped data: one row per agent (userId), with expandable details
  const dataTableData = React.useMemo(() => {
    const byUser = new Map();
    licenses.forEach(lic => {
      if (!byUser.has(lic.userId)) {
        byUser.set(lic.userId, {
          id: `group-${lic.userId}`,
          userId: lic.userId,
          lagnname: lic.lagnname,
          mga: lic.mga || '',
          licenses: [],
        });
      }
      byUser.get(lic.userId).licenses.push(lic);
    });

    let rows = Array.from(byUser.values()).map(group => {
      const states = group.licenses.map(l => l.state).filter(Boolean);
      const uniqueStates = Array.from(new Set(states));
      const hasResident = group.licenses.some(l => l.resident_state === 1);
      const mga = group.mga || group.licenses.find(l => l.mga)?.mga || '';
      return {
        id: group.id,
        userId: group.userId,
        lagnname: group.lagnname,
        mga,
        statesSummary: uniqueStates.join(', '),
        hasResident,
        licenseCount: group.licenses.length,
        __group__: group, // attach original group for expanded renderer
      };
    });

    // Apply hierarchy filtering for non-elevated users
    if (!hasElevatedPermissions) {
      rows = rows.filter(r => 
        r.userId !== undefined && 
        r.userId !== null && 
        allowedIdsSet.has(String(r.userId))
      );
    }

    // Apply client-side search by agent name, MGA, or state
    if (!searchQuery) return rows;
    const q = searchQuery.trim().toLowerCase();
    return rows.filter(r => {
      const nameMatch = (r.lagnname || '').toLowerCase().includes(q);
      const mgaMatch = (r.mga || '').toLowerCase().includes(q);
      const stateMatch = (r.statesSummary || '').toLowerCase().includes(q);
      return nameMatch || mgaMatch || stateMatch;
    });
  }, [licenses, searchQuery, hasElevatedPermissions, allowedIdsSet]);
  // Search handlers
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setIsSearching(!!value);
  };


  useEffect(() => {
    const fetchLicenses = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await api.get("/admin/licensing/all");
        const data = response.data;
        
        if (data.success) {
          setLicenses(data.data);
        } else {
          setError(data.message || "Failed to fetch licenses");
        }
      } catch (error) {
        console.error("Error fetching licenses:", error);
        setError("Failed to load licensing data");
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch when we have hierarchy data for non-elevated users, or anytime for elevated/AGT users
    if (hasElevatedPermissions || isAgtUser || (hierarchyData && allowedIds.length > 0)) {
      fetchLicenses();
    }
  }, [hasElevatedPermissions, isAgtUser, hierarchyData, allowedIds]);

  // Handle cell updates (not used for grouped parent rows)
  const handleCellUpdate = async (rowId, field, value) => {
    try {
      // This table groups by user; edits should be performed in the expanded detail table (future enhancement)
      return;
    } catch (error) {
      console.error("Error updating license:", error);
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setNewLicense(prev => ({
      ...prev,
      [name]: newValue
    }));
    
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Validate form
  const validateForm = () => {
    const errors = {};
    
    if (!newLicense.state) {
      errors.state = 'State is required';
    }
    
    if (newLicense.expiry_date) {
      const date = new Date(newLicense.expiry_date);
      if (isNaN(date.getTime())) {
        errors.expiry_date = 'Invalid date format';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle saving new license
  const handleSaveLicense = async () => {
    if (!validateForm()) return;
    
    try {
      setSubmitLoading(true);
      
      const licenseData = {
        userId: selectedAgent.userId,
        lagnname: selectedAgent.lagnname,
        state: newLicense.state,
        license_number: newLicense.license_number || '',
        expiry_date: newLicense.expiry_date || null,
        resident_state: newLicense.resident_state ? 1 : 0
      };
      
      await api.post('/licenses', licenseData);
      toast.success(`License added for ${selectedAgent.lagnname}`);
      
      // Refresh licenses
      const response = await api.get("/admin/licensing/all");
      if (response.data.success) {
        setLicenses(response.data.data);
      }
      
      // Close modal
      setShowAddLicenseModal(false);
      setSelectedAgent(null);
      
    } catch (error) {
      console.error('Error adding license:', error);
      toast.error('Failed to add license');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Handle closing modal
  const handleCloseModal = () => {
    setShowAddLicenseModal(false);
    setSelectedAgent(null);
    setNewLicense({
      state: '',
      license_number: '',
      expiry_date: '',
      resident_state: false
    });
    setFormErrors({});
  };

  // Handle adding new license (general - opens modal without specific agent)
  const handleAddNew = () => {
    // For now, we'll disable the general add new since we want agent-specific additions
    toast.info('Please use the "Add License" button next to a specific agent');
  };

  // Handle deleting license (disabled in grouped view; enable per-license delete in expanded rows later)
  const handleDelete = async () => {};

  // Handle refresh
  const handleRefresh = () => {
    window.location.reload();
  };

  // Show loading state while hierarchy loads for non-elevated, non-AGT users
  if (hierarchyLoading && !hasElevatedPermissions && !isAgtUser && !hierarchyData) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading user permissions and licensing data...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading licensing data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p style={{ color: "red" }}>{error}</p>
      </div>
    );
  }

  // Expanded renderer: show per-agent license details
  const renderExpandedRow = (row) => {
    const group = row.__group__;
    if (!group) return null;
    return (
      <div style={{ padding: '8px 4px' }}>
        <table className="table" style={{ width: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: 120 }}>State</th>
              <th style={{ width: 160 }}>Expiry</th>
              <th style={{ width: 120 }}>Resident</th>
              <th>License #</th>
            </tr>
          </thead>
          <tbody>
            {group.licenses.map(lic => (
              <tr key={lic.id} data-rowid={lic.id}>
                <td>{lic.state || '-'}</td>
                <td>{formatDateForDisplay(lic.expiry_date)}</td>
                <td>{lic.resident_state === 1 ? 'Yes' : 'No'}</td>
                <td>{lic.license_number || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ padding: "1rem" }}>
   
      {/* Search Bar */}
      <div style={{ marginBottom: '16px' }}>
        <div className="reports-search">
          <div className="search-input-wrapper">
            <FiSearch className="search-icon" style={{ 
              color: isSearching ? '#00558c' : undefined,
              opacity: isSearching ? 0.8 : undefined 
            }} />
            <input
              type="text"
              placeholder="Search by agent name, MGA, or state..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="search-input"
              style={{ 
                borderColor: isSearching ? '#00558c' : undefined,
                transition: 'border-color 0.2s ease'
              }}
            />
            {isSearching && (
              <div style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#00558c',
                fontSize: '12px'
              }}>
                Searching...
              </div>
            )}
          </div>
        </div>
      </div>
      
      <DataTable
        columns={columns}
        data={dataTableData}
        onCellUpdate={handleCellUpdate}
        onAddNew={handleAddNew}
        onDelete={handleDelete}
        onRefresh={handleRefresh}
        entityName="license"
        defaultSortBy="lagnname"
        defaultSortOrder="asc"
        disablePagination={false}
        enableRowExpansion={true}
        renderExpandedRow={renderExpandedRow}
        actionBarButtons={{
          addNew: false, // Disable general add new, use row-specific buttons
          import: false,
          export: true,
          delete: false,
          archive: false,
          sendEmail: false,
          toggleArchived: false,
          refresh: true,
          reassign: false
        }}
      />

      {/* Add License Modal */}
      {showAddLicenseModal && (
        <div className="modal-overlay" style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="modal-content" style={{ 
            backgroundColor: 'white', 
            padding: '24px', 
            borderRadius: '8px', 
            width: '500px', 
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '20px',
              borderBottom: '1px solid #dee2e6',
              paddingBottom: '12px'
            }}>
              <h3 style={{ margin: 0, color: '#343a40' }}>
                Add License for {selectedAgent?.lagnname}
              </h3>
              <button 
                onClick={handleCloseModal}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  fontSize: '20px', 
                  cursor: 'pointer',
                  color: '#6c757d'
                }}
              >
                <FiX />
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                State *
              </label>
              <select 
                name="state"
                value={newLicense.state}
                onChange={handleInputChange}
                style={{ 
                  width: '100%', 
                  padding: '8px 12px', 
                  border: formErrors.state ? '1px solid #dc3545' : '1px solid #ced4da',
                  borderRadius: '4px'
                }}
              >
                <option value="">Select State</option>
                {US_STATES.map(state => (
                  <option key={state.code} value={state.code}>
                    {state.code} - {state.name}
                  </option>
                ))}
              </select>
              {formErrors.state && (
                <div style={{ color: '#dc3545', fontSize: '12px', marginTop: '4px' }}>
                  {formErrors.state}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                License Number
              </label>
              <input 
                type="text"
                name="license_number"
                value={newLicense.license_number}
                onChange={handleInputChange}
                placeholder="Enter license number (optional)"
                style={{ 
                  width: '100%', 
                  padding: '8px 12px', 
                  border: '1px solid #ced4da',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Expiry Date
              </label>
              <input 
                type="date"
                name="expiry_date"
                value={newLicense.expiry_date}
                onChange={handleInputChange}
                style={{ 
                  width: '100%', 
                  padding: '8px 12px', 
                  border: formErrors.expiry_date ? '1px solid #dc3545' : '1px solid #ced4da',
                  borderRadius: '4px'
                }}
              />
              {formErrors.expiry_date && (
                <div style={{ color: '#dc3545', fontSize: '12px', marginTop: '4px' }}>
                  {formErrors.expiry_date}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox"
                  name="resident_state"
                  checked={newLicense.resident_state}
                  onChange={handleInputChange}
                />
                <span style={{ fontWeight: '500' }}>Resident State</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={handleCloseModal}
                disabled={submitLoading}
                style={{ 
                  padding: '8px 16px', 
                  border: '1px solid #6c757d', 
                  backgroundColor: 'white',
                  color: '#6c757d',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveLicense}
                disabled={submitLoading || !newLicense.state}
                style={{ 
                  padding: '8px 16px', 
                  border: 'none', 
                  backgroundColor: submitLoading || !newLicense.state ? '#6c757d' : '#007bff',
                  color: 'white',
                  borderRadius: '4px',
                  cursor: submitLoading || !newLicense.state ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {submitLoading ? (
                  <>
                    <div style={{ 
                      width: '14px', 
                      height: '14px', 
                      border: '2px solid transparent',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Adding...
                  </>
                ) : (
                  <>
                    <FiCheck />
                    Add License
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AdminLicensing; 