import React, { useState, useEffect, useMemo } from "react";
import { FaTrash, FaRegCopy, FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from "../../context/AuthContext";
import api from "../../api";
import DataTable from "../utils/DataTable";
import "../../App.css";

const RefEntry = () => {
  const { user } = useAuth();
  const [tableData, setTableData] = useState([]);
  const [agentOptions, setAgentOptions] = useState([]);
  const currentMonth = new Date().toISOString().slice(0, 7); // Format YYYY-MM
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [monthOptions, setMonthOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState(user?.firstName || "All");
  const [adminNames, setAdminNames] = useState([]);
  const [trueRefFilter, setTrueRefFilter] = useState("all");
  const [currentUserData, setCurrentUserData] = useState(null);

  // Format date for display
  const formatDateForDisplay = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  // Define columns for DataTable - moved before any early returns
  const columns = useMemo(() => {
    const cols = [
      {
        Header: "Actions",
        accessor: "actions",
        width: 100,
        Cell: ({ row }) => {
          const [deleteHover, setDeleteHover] = React.useState(false);
          const [copyHover, setCopyHover] = React.useState(false);
          
          return (
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const confirmDelete = window.confirm("Are you sure you want to delete this row?");
                  if (confirmDelete) {
                    handleDeleteRow(row.original.id || row.original.uuid);
                  }
                }}
                onMouseEnter={() => setDeleteHover(true)}
                onMouseLeave={() => setDeleteHover(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: deleteHover ? "#a71e2a" : "#dc3545",
                  fontSize: "12px",
                  transition: "color 0.2s ease",
                  padding: "4px",
                }}
                title="Delete Row"
              >
                <FaTrash />
              </button>
              <FaRegCopy
                onClick={(e) => {
                  e.stopPropagation();
                  const firstName = row.original.client_name ? row.original.client_name.split(",")[0].trim() : "";
                  const copyText = `${firstName} ${row.original.zip_code || ""}`;
                  navigator.clipboard.writeText(copyText)
                    .then(() => console.log(`Copied: ${copyText}`))
                    .catch(err => console.error("Failed to copy text:", err));
                }}
                onMouseEnter={() => setCopyHover(true)}
                onMouseLeave={() => setCopyHover(false)}
                style={{
                  cursor: "pointer",
                  fontSize: "16px",
                  color: copyHover ? "#333" : "#666",
                  transition: "color 0.2s ease",
                  padding: "2px",
                }}
                title="Copy First Name & Zip"
              />
            </div>
          );
        },
      },
      {
        Header: "True Ref",
        accessor: "true_ref",
        width: 100,
        DropdownOptions: ["", "Y", "N"],
        dropdownBackgroundColor: (value) => {
          switch (value) {
            case "Y":
              return "#d4edda"; // Light green - True referral
            case "N":
              return "#f8d7da"; // Light red - Not a true referral
            default:
              return "#e9ecef"; // Grey - No selection
          }
        }
      },
      {
        Header: "Ref Detail",
        accessor: "ref_detail",
        width: 200,
      },
      {
        Header: "Agent Name",
        accessor: "agentName",
        width: 150,
        DropdownOptions: ["", ...agentOptions.map(agent => agent.lagnname)],
        dropdownBackgroundColor: (value) => {
          return value ? "#f8f9fa" : "#e9ecef"; // Light background for selected, grey for blank
        }
      },
      {
        Header: "Client Name",
        accessor: "client_name",
        width: 200,
      },
      {
        Header: "Zip Code",
        accessor: "zip_code",
        width: 100,
      },
      {
        Header: "Existing Policy",
        accessor: "existing_policy",
        width: 120,
        DropdownOptions: ["", "Y", "N"],
        dropdownBackgroundColor: (value) => {
          switch (value) {
            case "Y":
              return "#d4edda"; // Light green - Has existing policy
            case "N":
              return "#f8d7da"; // Light red - No existing policy
            default:
              return "#e9ecef"; // Grey - No selection
          }
        }
      },
      {
        Header: "Trial",
        accessor: "trial",
        width: 80,
        DropdownOptions: ["", "Y", "N"],
        dropdownBackgroundColor: (value) => {
          switch (value) {
            case "Y":
              return "#d4edda"; // Light green - Trial period
            case "N":
              return "#f8d7da"; // Light red - Not a trial
            default:
              return "#e9ecef"; // Grey - No selection
          }
        }
      },
      {
        Header: "Date App Checked",
        accessor: "date_app_checked",
        width: 140,
        Cell: ({ value }) => formatDateForDisplay(value),
      },
      {
        Header: "Notes",
        accessor: "notes",
        width: 200,
      },
    ];

    return cols;
  }, [agentOptions]);

  // Prepare data for DataTable (ensure each row has an id) - moved before any early returns
  const dataTableData = useMemo(() => {
    return tableData.map(row => ({
      ...row,
      id: row.uuid || row.id || Math.random().toString(36),
    }));
  }, [tableData]);

  // Filter data based on search and filters - moved before any early returns
  const filteredData = useMemo(() => {
    return dataTableData.filter(row => {
      // Apply admin tab filter
      const passesAdminFilter = selectedTab === "All" || row.admin_name === selectedTab;

      // Apply true_ref filter
      const passesRefFilter = trueRefFilter === "all" || 
        (trueRefFilter === "blank" && (!row.true_ref || row.true_ref === "")) ||
        row.true_ref === trueRefFilter;

      return passesAdminFilter && passesRefFilter;
    });
  }, [dataTableData, selectedTab, trueRefFilter]);

  // Filter admin tabs to only show current user + admins who have data in selected month
  const visibleAdminTabs = useMemo(() => {
    if (adminNames.length === 0) return [];

    const currentUserName = currentUserData?.screen_name || user?.firstName || user?.screen_name || "Unknown";
    
    // Get unique admin names from current table data
    const adminsWithData = [...new Set(tableData.map(row => row.admin_name).filter(Boolean))];
    
    // Always include "All" and current user, plus admins who have data
    const tabs = ["All"];
    
    // Add current user if not already included
    if (!tabs.includes(currentUserName)) {
      tabs.push(currentUserName);
    }
    
    // Add admins who have data in this month
    adminsWithData.forEach(adminName => {
      if (!tabs.includes(adminName)) {
        tabs.push(adminName);
      }
    });
    
    // Sort alphabetically but keep "All" first and current user second
    const sortedTabs = [
      "All",
      currentUserName,
      ...tabs.filter(tab => tab !== "All" && tab !== currentUserName).sort()
    ];
    
    return sortedTabs;
  }, [adminNames, tableData, currentUserData?.screen_name, user?.firstName, user?.screen_name]);

  // Update selected tab if it's no longer visible
  useEffect(() => {
    if (visibleAdminTabs.length > 0 && !visibleAdminTabs.includes(selectedTab)) {
      const currentUserName = currentUserData?.screen_name || user?.firstName || user?.screen_name || "Unknown";
      setSelectedTab(visibleAdminTabs.includes(currentUserName) ? currentUserName : "All");
    }
  }, [visibleAdminTabs, selectedTab, currentUserData?.screen_name, user?.firstName, user?.screen_name]);

  // Fetch current user's activeusers data
  useEffect(() => {
    const fetchCurrentUserData = async () => {
      if (!user?.userId) return;
      
      try {
        console.log("RefEntry - Fetching current user data...");
        const response = await api.get("/refvalidation/current-user", {
          params: { userId: user.userId }
        });
        const data = response.data;
        console.log("RefEntry - Current user data response:", data);

        if (data.success) {
          setCurrentUserData(data.data);
          console.log("RefEntry - Current user data loaded:", data.data);
        } else {
          console.warn("RefEntry - Failed to fetch current user data:", data.message);
          // Fallback to auth context data
          setCurrentUserData({
            admin_id: user.userId,
            screen_name: user.firstName || user.screen_name || "Unknown Admin"
          });
        }
      } catch (error) {
        console.error("RefEntry - Error fetching current user data:", error);
        // Fallback to auth context data
        setCurrentUserData({
          admin_id: user.userId,
          screen_name: user.firstName || user.screen_name || "Unknown Admin"
        });
      }
    };

    fetchCurrentUserData();
  }, [user?.userId, user?.firstName, user?.screen_name]);

  // Fetch active users for agent dropdown
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        console.log("RefEntry - Fetching agents...");
        const response = await api.get("/refvalidation/active-users");
        const data = response.data;
        console.log("RefEntry - Agents response:", data);
        
        if (data.success && Array.isArray(data.data)) {
          const sortedAgents = data.data.sort((a, b) => a.lagnname.localeCompare(b.lagnname));
          setAgentOptions(sortedAgents);
          console.log("RefEntry - Agents loaded:", sortedAgents.length);
        }
      } catch (error) {
        console.error("RefEntry - Error fetching agent names:", error);
        // Set empty array to prevent infinite loading
        setAgentOptions([]);
      }
    };

    fetchAgents();
  }, []);

  // Fetch month options
  useEffect(() => {
    const fetchMonthOptions = async () => {
      try {
        console.log("RefEntry - Fetching month options...");
        const response = await api.get("/refvalidation/month-options");
        const data = response.data;
        console.log("RefEntry - Month options response:", data);

        if (data.success) {
          setMonthOptions(data.data);
          console.log("RefEntry - Month options loaded:", data.data.length);
        }
      } catch (error) {
        console.error("RefEntry - Error fetching month options:", error);
        // Set default current month to prevent infinite loading
        setMonthOptions([{
          value: currentMonth,
          label: new Date(`${currentMonth}-01T00:00:00`).toLocaleDateString('default', { month: 'long', year: 'numeric' })
        }]);
      }
    };

    fetchMonthOptions();
  }, [currentMonth]);

  // Fetch admin tabs
  useEffect(() => {
    const fetchAdminTabs = async () => {
      try {
        console.log("RefEntry - Fetching admin tabs...");
        const response = await api.get("/refvalidation/admin-tabs");
        const data = response.data;
        console.log("RefEntry - Admin tabs response:", data);

        if (data.success) {
          let tabs = data.data;

          // Ensure the logged-in user's tab is included
          const userName = user?.firstName || "Unknown";
          if (!tabs.includes(userName)) {
            tabs.push(userName);
          }

          // Sort alphabetically but keep "All" first
          const sortedTabs = ["All", ...tabs.filter(tab => tab !== "All").sort()];
          setAdminNames(sortedTabs);
          console.log("RefEntry - Admin tabs loaded:", sortedTabs);

          // Set default tab to current user
          if (!sortedTabs.includes(selectedTab)) {
            setSelectedTab(sortedTabs.includes(userName) ? userName : "All");
          }
        }
      } catch (error) {
        console.error("RefEntry - Error fetching admin tabs:", error);
        // Set default tabs to prevent infinite loading
        const userName = user?.firstName || "Unknown";
        setAdminNames(["All", userName]);
      }
    };

    fetchAdminTabs();
  }, [user?.firstName]);

  // Fetch refvalidation data
  useEffect(() => {
    console.log("RefEntry - Check loading conditions:", {
      agentOptionsLength: agentOptions.length,
      selectedMonth,
      adminNamesLength: adminNames.length,
      visibleTabsLength: visibleAdminTabs.length,
      willFetch: selectedMonth && adminNames.length > 0
    });
    
    // Allow fetching even if no agents (empty table scenario)
    if (!selectedMonth || adminNames.length === 0) return;

    const fetchReferrals = async () => {
      setIsLoading(true);
      try {
        const params = {
          month: selectedMonth,
          admin_name: "all", // Always fetch all data for the month
          true_ref: "all" // Always fetch all true_ref values, filter client-side
        };

        const response = await api.get("/refvalidation/all", { params });
        const data = response.data;

        if (data.success) {
          const updatedData = data.data.map((row) => {
            const matchedAgent = agentOptions.find(agent => agent.lagnname === row.lagnname);

            return {
              ...row,
              agent_id: matchedAgent ? matchedAgent.id : row.agent_id || null,
              agentName: matchedAgent ? matchedAgent.lagnname : row.lagnname || "",
              created_at: row.created_at ? row.created_at.slice(0, 7) : currentMonth,
            };
          });

          setTableData(updatedData);
        }
      } catch (error) {
        console.error("Error fetching referral data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReferrals();
  }, [selectedMonth, adminNames, currentMonth]); // Removed selectedTab and trueRefFilter since we filter client-side now

  // Handle cell updates from DataTable
  const handleCellUpdate = async (rowId, field, value) => {
    try {
      // Update local state optimistically
      setTableData(prevData => {
        return prevData.map(row => {
          if (row.uuid === rowId || row.id === rowId) {
            const updatedRow = { ...row, [field]: value };

            // Business logic: if trial is set to "Y", automatically set true_ref to "N"
            if (field === "trial" && value === "Y") {
              updatedRow.true_ref = "N";
            }

            // Special handling for agent selection
            if (field === "agentName") {
              const matchedAgent = agentOptions.find(agent => agent.lagnname === value);
              if (matchedAgent) {
                updatedRow.agent_id = matchedAgent.id;
                updatedRow.lagnname = matchedAgent.lagnname;
                // Note: matchedAgent.admin_id is now available from activeusers table
                // You can choose to store this as additional info if needed:
                // updatedRow.agent_admin_id = matchedAgent.admin_id;
              }
            }

            return updatedRow;
          }
          return row;
        });
      });

      // Save to backend
      const rowToUpdate = tableData.find(row => row.uuid === rowId || row.id === rowId);
      if (rowToUpdate) {
        const updatedRow = {
          ...rowToUpdate,
          [field]: value,
          lagnname: field === "agentName" ? value : rowToUpdate.lagnname,
        };

        // Apply business logic for backend too
        if (field === "trial" && value === "Y") {
          updatedRow.true_ref = "N";
        }

        // Special handling for agent selection in backend save
        if (field === "agentName") {
          const matchedAgent = agentOptions.find(agent => agent.lagnname === value);
          if (matchedAgent) {
            updatedRow.agent_id = matchedAgent.id;
            updatedRow.lagnname = matchedAgent.lagnname;
            // Note: matchedAgent.admin_id is now available if needed:
            // updatedRow.agent_admin_id = matchedAgent.admin_id;
          }
        }

        await api.post("/refvalidation/save", [updatedRow]);
      }
    } catch (error) {
      console.error("Error updating cell:", error);
      // Revert optimistic update on error
      setTableData(prevData => [...prevData]);
    }
  };

  // Add new row
  const handleAddNew = () => {
    // Use activeusers data if available, fallback to auth context
    const adminName = currentUserData?.screen_name || user?.firstName || user?.screen_name || "Unknown Admin";
    const adminId = currentUserData?.admin_id || user?.userId || null;
    
    console.log("RefEntry - Creating new row with:", {
      currentUserData,
      adminName,
      adminId,
      fallbackUserId: user?.userId,
      fallbackFirstName: user?.firstName
    });

    const today = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });

    const newRow = {
      uuid: uuidv4(),
      id: null,
      true_ref: "",
      ref_detail: "",
      agentName: "",
      lagnname: "",
      agent_id: null,
      client_name: "",
      zip_code: "",
      existing_policy: "",
      trial: "",
      date_app_checked: today,
      notes: "",
      created_at: currentMonth,
      admin_name: adminName,
      admin_id: adminId,
    };

    setTableData(prev => [newRow, ...prev]);

    // Update admin names if this admin isn't already in the tabs
    setAdminNames(prevAdmins => {
      if (!prevAdmins.includes(adminName)) {
        return ["All", ...prevAdmins.filter(admin => admin !== "All"), adminName].sort();
      }
      return prevAdmins;
    });
  };

  // Delete row
  const handleDeleteRow = async (rowId) => {
    const rowToDelete = tableData.find(row => row.uuid === rowId || row.id === rowId);

    if (!rowToDelete) {
      console.error("Row does not exist:", rowId);
      return;
    }

    const deleteId = rowToDelete.uuid || rowToDelete.id;

    if (!deleteId) {
      // Row has no ID, just remove from frontend
      setTableData(prev => prev.filter(row => row.uuid !== rowId));
      return;
    }

    try {
      const response = await api.delete(`/refvalidation/delete/${deleteId}`);
      const data = response.data;

      if (data.success) {
        setTableData(prev => prev.filter(row => row.uuid !== rowId && row.id !== rowId));
      } else {
        console.error("Failed to delete row:", data.message);
      }
    } catch (error) {
      console.error("Error deleting row:", error);
    }
  };

  // Handle delete from DataTable (can be single ID or array of IDs)
  const handleDelete = async (ids) => {
    const idsArray = Array.isArray(ids) ? ids : [ids];
    
    for (const id of idsArray) {
      await handleDeleteRow(id);
    }
  };

  // Check if user can add rows (current month or previous month only)
  const canAddRow = () => {
    const prevMonth = new Date();
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const prevMonthFormatted = prevMonth.toISOString().slice(0, 7);
    
    return selectedMonth === currentMonth || selectedMonth === prevMonthFormatted;
  };

  // Handle refresh
  const handleRefresh = () => {
    // Re-fetch data
    window.location.reload();
  };

  // Navigate to previous month (back in time)
  const goToPreviousMonth = () => {
    const currentIndex = monthOptions.findIndex(option => option.value === selectedMonth);
    if (currentIndex < monthOptions.length - 1) {
      setSelectedMonth(monthOptions[currentIndex + 1].value);
    }
  };

  // Navigate to next month (forward in time)
  const goToNextMonth = () => {
    const currentIndex = monthOptions.findIndex(option => option.value === selectedMonth);
    if (currentIndex > 0) {
      setSelectedMonth(monthOptions[currentIndex - 1].value);
    }
  };

  // Check if navigation buttons should be disabled
  const canGoToPrevious = () => {
    const currentIndex = monthOptions.findIndex(option => option.value === selectedMonth);
    return currentIndex < monthOptions.length - 1;
  };

  const canGoToNext = () => {
    const currentIndex = monthOptions.findIndex(option => option.value === selectedMonth);
    return currentIndex > 0;
  };

  // Arrow button styles matching existing app patterns
  const arrowButtonStyle = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'grey',
    fontSize: '20px',
    padding: '8px 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '36px',
    height: '34px',
    borderRadius: '4px',
  };

  const arrowButtonHoverStyle = {
    ...arrowButtonStyle,
    color: 'black',
  };

  const arrowButtonDisabledStyle = {
    ...arrowButtonStyle,
    color: '#ccc',
    cursor: 'not-allowed',
  };

  if (isLoading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading...</p>
      </div>
    );
  }



  return (
    <div style={{ padding: "1rem" }}>
      
      {/* Filters */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* True Ref Filter */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: "180px" }}>
          <label style={{ marginBottom: "5px",  textAlign: "left" }}>Filter by True Ref:</label>
          <select
            value={trueRefFilter}
            onChange={(e) => setTrueRefFilter(e.target.value)}
            style={{
              padding: "6px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              fontSize: "14px",
            }}
          >
            <option value="all">All</option>
            <option value="blank">Blank</option>
            <option value="Y">Y</option>
            <option value="N">N</option>
          </select>
        </div>

        {/* Month Filter with Navigation */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: "250px" }}>
          <label style={{ marginBottom: "5px",  textAlign: "left" }}>View Month:</label>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            {/* Previous Month Button */}
            <button
              onClick={goToPreviousMonth}
              disabled={!canGoToPrevious()}
              style={canGoToPrevious() ? arrowButtonStyle : arrowButtonDisabledStyle}
              title="Previous Month"
              onMouseEnter={(e) => {
                if (canGoToPrevious()) {
                  e.target.style.color = arrowButtonHoverStyle.color;
                }
              }}
              onMouseLeave={(e) => {
                if (canGoToPrevious()) {
                  e.target.style.color = arrowButtonStyle.color;
                }
              }}
            >
              <FaArrowLeft />
            </button>

            {/* Month Dropdown */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                padding: "6px 8px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                fontSize: "14px",
                flex: 1,
                height: "34px",
              }}
            >
              {monthOptions.map(month => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>

            {/* Next Month Button */}
            <button
              onClick={goToNextMonth}
              disabled={!canGoToNext()}
              style={canGoToNext() ? arrowButtonStyle : arrowButtonDisabledStyle}
              title="Next Month"
              onMouseEnter={(e) => {
                if (canGoToNext()) {
                  e.target.style.color = arrowButtonHoverStyle.color;
                }
              }}
              onMouseLeave={(e) => {
                if (canGoToNext()) {
                  e.target.style.color = arrowButtonStyle.color;
                }
              }}
            >
              <FaArrowRight />
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "15px", borderBottom: "2px solid #ccc", flexWrap: "wrap" }}>
        {visibleAdminTabs.map(admin => (
          <button
            key={admin}
            onClick={() => setSelectedTab(admin)}
            style={{
              padding: "8px 16px",
              border: "none",
              backgroundColor: selectedTab === admin ? "var(--primary-color)" : "#ddd",
              color: selectedTab === admin ? "#fff" : "#000",
              cursor: "pointer",
              borderRadius: "5px 5px 0 0",
              fontSize: "14px",
            }}
          >
            {admin}
          </button>
        ))}
      </div>

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={filteredData}
        onCellUpdate={handleCellUpdate}
        onAddNew={canAddRow() ? handleAddNew : null}
        onDelete={handleDelete}
        onRefresh={handleRefresh}
        entityName="refvalidation record"
        defaultSortBy="created_at"
        defaultSortOrder="desc"
        disablePagination={false}
        actionBarButtons={{
          addNew: canAddRow(),
          import: false,
          export: false,
          delete: true,
          archive: false,
          sendEmail: false,
          toggleArchived: false,
          refresh: true,
          reassign: false
        }}
        rowClassNames={
          // Apply row colors based on true_ref value
          filteredData.reduce((acc, row) => {
            if (row.true_ref === "Y") {
              acc[row.id] = "true-ref-y";
            } else if (row.true_ref === "N") {
              acc[row.id] = "true-ref-n";
            }
            return acc;
          }, {})
        }
      />

      {/* Row color styles */}
      <style>
        {`
          .data-table .true-ref-y td {
            background-color: #D9EAD3 !important;
          }
          .data-table .true-ref-n td {
            background-color: #F4CCCC !important;
          }
          .data-table .true-ref-y:hover td {
            background-color: #c3e6c3 !important;
          }
          .data-table .true-ref-n:hover td {
            background-color: #f0b3b3 !important;
          }
        `}
      </style>
    </div>
  );
};

export default RefEntry;