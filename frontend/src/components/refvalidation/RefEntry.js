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
  const [selectedTab, setSelectedTab] = useState("All");
  const [adminNames, setAdminNames] = useState([]);
  const [trueRefFilter, setTrueRefFilter] = useState("all");
  const [currentUserData, setCurrentUserData] = useState(null);
  const [savingNewRow, setSavingNewRow] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  // Debug logging for unsavedChanges state
  useEffect(() => {
    console.log("RefEntry - unsavedChanges state changed:", {
      unsavedChanges,
      timestamp: new Date().toISOString(),
      stackTrace: new Error().stack
    });
  }, [unsavedChanges]);

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
                  const rowIdToDelete = row.original.id || row.original.uuid;
                  console.log("RefEntry - Delete button clicked:", {
                    rowOriginal: row.original,
                    rowIdToDelete,
                    rowOriginalId: row.original.id,
                    rowOriginalUuid: row.original.uuid
                  });
                  const confirmDelete = window.confirm("Are you sure you want to delete this row?");
                  if (confirmDelete) {
                    handleDeleteRow(rowIdToDelete);
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
        DropdownOptions: ["", ...Array.from(new Set(agentOptions.map(agent => agent.lagnname)))],
        dropdownBackgroundColor: (value) => {
          return value ? "#f8f9fa" : "#e9ecef"; // Light background for selected, grey for blank
        },
        // Add custom cell renderer to log dropdown changes
        Cell: ({ value, row, column }) => {
          console.log("RefEntry - Agent dropdown cell rendering:", {
            currentValue: value,
            rowId: row.original.uuid || row.original.id,
            agentOptions: agentOptions.map(a => ({ id: a.id, lagnname: a.lagnname }))
          });
          return value || "";
        },
        // Add onChange handler for debugging
        onDropdownChange: (rowId, field, newValue) => {
          console.log("RefEntry - Agent dropdown changed:", {
            rowId,
            field,
            newValue,
            timestamp: new Date().toISOString()
          });
          
          // Find the agent that matches the selected name
          const matchedAgent = agentOptions.find(agent => agent.lagnname === newValue);
          console.log("RefEntry - Matched agent for dropdown selection:", {
            selectedName: newValue,
            matchedAgent,
            allAgents: agentOptions
          });
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
      setSelectedTab("All");
    }
  }, [visibleAdminTabs, selectedTab]);

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

          // Ensure a valid default tab; prefer 'All'
          if (!sortedTabs.includes(selectedTab)) {
            setSelectedTab("All");
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
            // Trust the agent_id from database, but find the matching agent for display purposes
            const matchedAgent = agentOptions.find(agent => agent.id === row.agent_id);

            return {
              ...row,
              // Keep the original agent_id from database - don't override it
              agent_id: row.agent_id,
              // Use the matched agent's lagnname for display, fallback to stored lagnname
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
    // Log every single cell update call
    console.log("RefEntry - handleCellUpdate ENTRY POINT:", {
      rowId,
      field,
      value,
      valueType: typeof value,
      timestamp: new Date().toISOString(),
      isAgentField: field === "agentName"
    });
    
    try {
      console.log("RefEntry - handleCellUpdate called:", {
        rowId,
        field,
        value,
        valueType: typeof value
      });
      
      console.log("RefEntry - Current tableData:", tableData.map(row => ({
        uuid: row.uuid,
        id: row.id,
        mappedId: row.uuid || row.id || 'NO_ID'
      })));
      
      // Find the row to update - check both uuid and id fields
      const rowToUpdate = tableData.find(row => 
        row.uuid === rowId || 
        row.id === rowId || 
        (row.uuid || row.id) === rowId
      );
      
      if (!rowToUpdate) {
        console.error("RefEntry - Row not found for update:", rowId);
        console.error("RefEntry - Available rows:", tableData.map(row => ({
          uuid: row.uuid,
          id: row.id,
          mappedId: row.uuid || row.id,
          client_name: row.client_name
        })));
        return;
      }

      console.log("RefEntry - Found row to update:", {
        uuid: rowToUpdate.uuid,
        id: rowToUpdate.id,
        currentFieldValue: rowToUpdate[field],
        newFieldValue: value,
        fullRowBefore: rowToUpdate
      });

      // Update local state optimistically
      setTableData(prevData => {
        return prevData.map(row => {
          // Check all possible ID matches
          const isMatchingRow = row.uuid === rowId || 
                               row.id === rowId || 
                               (row.uuid || row.id) === rowId;
          
          if (isMatchingRow) {
            const updatedRow = { ...row, [field]: value };

            console.log("RefEntry - Updating row field:", {
              field,
              oldValue: row[field],
              newValue: value,
              rowId: row.uuid || row.id
            });

            // Business logic: if trial is set to "Y", automatically set true_ref to "N"
            if (field === "trial" && value === "Y") {
              console.log("RefEntry - Auto-setting true_ref to 'N' because trial is 'Y'");
              updatedRow.true_ref = "N";
            }

            // Special handling for agent selection
            if (field === "agentName") {
              console.log("RefEntry - Processing agent selection:", {
                selectedAgentName: value,
                availableAgents: agentOptions.map(a => ({ id: a.id, lagnname: a.lagnname }))
              });
              
              const matchedAgent = agentOptions.find(agent => agent.lagnname === value);
              if (matchedAgent) {
                console.log("RefEntry - Found matching agent:", {
                  agentId: matchedAgent.id,
                  lagnname: matchedAgent.lagnname,
                  fullAgent: matchedAgent
                });
                updatedRow.agent_id = matchedAgent.id;
                updatedRow.lagnname = matchedAgent.lagnname;
                
                console.log("RefEntry - Updated row with agent data:", {
                  agent_id: updatedRow.agent_id,
                  lagnname: updatedRow.lagnname,
                  agentName: updatedRow.agentName
                });
              } else {
                console.warn("RefEntry - No matching agent found for:", value);
                console.log("RefEntry - Available agent options:", agentOptions);
              }
            }

            // Mark existing rows as modified (new rows already don't have IDs)
            if (row.id) {
              console.log("RefEntry - Marking existing row as modified:", row.id);
              updatedRow.isModified = true;
            } else {
              console.log("RefEntry - Row is new (no ID), not marking as modified");
            }

            console.log("RefEntry - Final updated row:", {
              uuid: updatedRow.uuid,
              id: updatedRow.id,
              agent_id: updatedRow.agent_id,
              lagnname: updatedRow.lagnname,
              agentName: updatedRow.agentName,
              isModified: updatedRow.isModified,
              fullUpdatedRow: updatedRow
            });

            return updatedRow;
          }
          return row;
        });
      });

      // Mark as having unsaved changes (no longer need to check if row is saved)
      console.log("RefEntry - Setting unsavedChanges to true");
      setUnsavedChanges(true);
      console.log("RefEntry - Cell updated in frontend state, marked as unsaved");

    } catch (error) {
      console.error("RefEntry - Error updating cell:", error);
      console.error("RefEntry - Error details:", {
        rowId,
        field,
        value,
        message: error.message,
        stack: error.stack
      });
      // Revert optimistic update on error
      setTableData(prevData => [...prevData]);
      alert("Failed to update cell. Please try again.");
    }
  };

  // Check if a row has all required fields filled
  const isRowComplete = (row) => {
    const hasAgent = row.agent_id && row.agent_id !== null;
    const hasLagnname = row.lagnname && row.lagnname.trim() !== "";
    
    return hasAgent && hasLagnname;
  };

  // Check if there are any incomplete unsaved rows
  const hasIncompleteRows = () => {
    const unsavedRows = tableData.filter(row => !row.id || row.isModified);
    return unsavedRows.some(row => !isRowComplete(row));
  };

  // Add new row
  const handleAddNew = () => {
    console.log("RefEntry - handleAddNew called");
    console.log("RefEntry - canAddRow():", canAddRow());
    console.log("RefEntry - selectedMonth:", selectedMonth);
    console.log("RefEntry - currentMonth:", currentMonth);
    
    if (!canAddRow()) {
      console.warn("RefEntry - Cannot add row for selected month:", selectedMonth);
      alert("You can only add new records for the current month or previous month.");
      return;
    }
    
    // Use activeusers data if available, fallback to auth context
    const adminName = currentUserData?.screen_name || user?.firstName || user?.screen_name || "Unknown Admin";
    const adminId = currentUserData?.admin_id || user?.userId || null;
    
    console.log("RefEntry - Creating new row with admin data:", {
      currentUserData,
      adminName,
      adminId,
      fallbackUserId: user?.userId,
      fallbackFirstName: user?.firstName,
      selectedMonth,
      currentTableDataLength: tableData.length
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
      created_at: new Date().toISOString(),
      admin_name: adminName,
      admin_id: adminId,
    };

    console.log("RefEntry - New row created:", JSON.stringify(newRow, null, 2));

    // Add to frontend state only - don't save to backend immediately like old system
    setTableData(prev => {
      const newData = [newRow, ...prev];
      console.log("RefEntry - Table data updated with new row:");
      console.log("RefEntry - Previous table data length:", prev.length);
      console.log("RefEntry - New table data length:", newData.length);
      console.log("RefEntry - New row added at index 0:", newData[0]);
      return newData;
    });
    
    // Mark as having unsaved changes
    console.log("RefEntry - Setting unsavedChanges to true for new row");
    setUnsavedChanges(true);
    console.log("RefEntry - handleAddNew completed successfully");
  };

  // Delete row
  const handleDeleteRow = async (rowId) => {
    console.log("RefEntry - handleDeleteRow called with rowId:", rowId);
    console.log("RefEntry - Current tableData for delete:", tableData.map(row => ({
      uuid: row.uuid,
      id: row.id,
      originalId: row.id,
      client_name: row.client_name
    })));
    
    // Find the row to delete - check multiple ID fields
    const rowToDelete = tableData.find(row => 
      row.uuid === rowId || 
      row.id === rowId ||
      String(row.id) === String(rowId) ||  // Handle number vs string comparison
      String(row.uuid) === String(rowId)
    );

    console.log("RefEntry - Row search result:", {
      searchingFor: rowId,
      searchingForType: typeof rowId,
      foundRow: rowToDelete,
      availableRows: tableData.map(row => ({
        uuid: row.uuid,
        id: row.id,
        idType: typeof row.id,
        uuidType: typeof row.uuid
      }))
    });

    if (!rowToDelete) {
      console.error("RefEntry - Row does not exist:", rowId);
      console.error("RefEntry - Available row IDs:", tableData.map(row => ({ 
        uuid: row.uuid, 
        id: row.id,
        client_name: row.client_name 
      })));
      return;
    }

    console.log("RefEntry - Found row to delete:", {
      uuid: rowToDelete.uuid,
      id: rowToDelete.id,
      client_name: rowToDelete.client_name
    });

    const deleteId = rowToDelete.uuid || rowToDelete.id;

    if (!deleteId) {
      console.log("RefEntry - Row has no ID, removing from frontend only");
      // Row has no ID, just remove from frontend
      setTableData(prev => prev.filter(row => 
        row.uuid !== rowId && 
        row.id !== rowId &&
        String(row.id) !== String(rowId) &&
        String(row.uuid) !== String(rowId)
      ));
      return;
    }

    try {
      console.log("RefEntry - Attempting to delete row with ID:", deleteId);
      const response = await api.delete(`/refvalidation/delete/${deleteId}`);
      const data = response.data;

      if (data.success) {
        console.log("RefEntry - Successfully deleted row from backend");
        setTableData(prev => prev.filter(row => 
          row.uuid !== rowId && 
          row.id !== rowId &&
          String(row.id) !== String(rowId) &&
          String(row.uuid) !== String(rowId) &&
          row.uuid !== deleteId &&
          row.id !== deleteId
        ));
        console.log("RefEntry - Row removed from frontend state");
      } else {
        console.error("RefEntry - Failed to delete row:", data.message);
      }
    } catch (error) {
      console.error("RefEntry - Error deleting row:", error);
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
    
    const canAdd = selectedMonth === currentMonth || selectedMonth === prevMonthFormatted;
    
    console.log("RefEntry - canAddRow check:", {
      selectedMonth,
      currentMonth,
      prevMonthFormatted,
      canAdd
    });
    
    return canAdd;
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

  // Handle saving all changes
  const handleSaveChanges = async () => {
    if (!unsavedChanges) {
      console.log("RefEntry - No unsaved changes to save");
      return;
    }

    try {
      console.log("RefEntry - Starting save process...");
      console.log("RefEntry - Current tableData:", tableData);
      setSavingNewRow(true);

      // Get all rows that need to be saved (new rows and modified existing rows)
      const rowsToSave = tableData.filter(row => !row.id || row.isModified);
      
      console.log("RefEntry - All table data:", JSON.stringify(tableData, null, 2));
      console.log("RefEntry - Filtered rows to save:", JSON.stringify(rowsToSave, null, 2));
      console.log("RefEntry - Number of rows to save:", rowsToSave.length);
      
      if (rowsToSave.length === 0) {
        console.log("RefEntry - No rows to save");
        setUnsavedChanges(false);
        return;
      }

      // Validate rows before saving
      const invalidRows = [];
      rowsToSave.forEach((row, index) => {
        const errors = [];
        
        // Check required fields
        if (!row.agent_id || row.agent_id === null) {
          errors.push("Agent must be selected");
        }
        
        if (!row.lagnname || row.lagnname.trim() === "") {
          errors.push("Agent name (lagnname) is missing");
        }
        
        if (errors.length > 0) {
          invalidRows.push({
            index: index + 1,
            uuid: row.uuid,
            errors: errors,
            row: row
          });
        }
      });
      
      if (invalidRows.length > 0) {
        console.error("RefEntry - Validation failed for rows:", invalidRows);
        
        // Create a user-friendly error message
        const incompleteCount = invalidRows.length;
        const pluralRow = incompleteCount === 1 ? "row" : "rows";
        const pluralNeed = incompleteCount === 1 ? "needs" : "need";
        
        let errorMessage = `Cannot save - ${incompleteCount} ${pluralRow} ${pluralNeed} to be completed:\n\n`;
        
        invalidRows.forEach(invalid => {
          errorMessage += `Row ${invalid.index} is missing:\n`;
          invalid.errors.forEach(error => {
            errorMessage += `  • ${error}\n`;
          });
          errorMessage += "\n";
        });
        
        errorMessage += "Please complete all required fields:\n";
        errorMessage += "• Select an agent from the dropdown\n";
        errorMessage += "• Make sure agent information is properly filled\n\n";
        errorMessage += "Then click 'Save Changes' again.";
        
        alert(errorMessage);
        return;
      }

      console.log("RefEntry - All rows passed validation");

      // Log each row being saved with detailed info
      rowsToSave.forEach((row, index) => {
        console.log(`RefEntry - Row ${index + 1} to save:`, {
          uuid: row.uuid,
          id: row.id,
          agent_id: row.agent_id,
          lagnname: row.lagnname,
          agentName: row.agentName,
          true_ref: row.true_ref,
          client_name: row.client_name,
          isModified: row.isModified,
          fullRow: row
        });
      });

      console.log("RefEntry - About to send POST request to /refvalidation/save");
      console.log("RefEntry - Request payload:", JSON.stringify(rowsToSave, null, 2));

      const response = await api.post("/refvalidation/save", rowsToSave);
      const data = response.data;

      console.log("RefEntry - Received response from save:", data);
      console.log("RefEntry - Response success:", data.success);
      console.log("RefEntry - Response message:", data.message);
      console.log("RefEntry - Saved rows from response:", data.savedRows);

      if (data.success && data.savedRows) {
        console.log("RefEntry - Successfully saved", data.savedRows.length, "rows");
        
        // Log the saved rows details
        data.savedRows.forEach((savedRow, index) => {
          console.log(`RefEntry - Saved row ${index + 1} from response:`, {
            uuid: savedRow.uuid,
            id: savedRow.id,
            agent_id: savedRow.agent_id,
            lagnname: savedRow.lagnname,
            fullSavedRow: savedRow
          });
        });
        
        // Update table data with saved rows (which now have IDs)
        setTableData(prevData => {
          const savedDataMap = new Map(data.savedRows.map(row => [row.uuid, row]));
          
          console.log("RefEntry - savedDataMap:", savedDataMap);
          
          const updatedData = prevData.map(row => {
            if (savedDataMap.has(row.uuid)) {
              const mergedRow = { ...row, ...savedDataMap.get(row.uuid), isModified: false };
              console.log("RefEntry - Updating row:", {
                originalUuid: row.uuid,
                originalId: row.id,
                savedData: savedDataMap.get(row.uuid),
                mergedRow: mergedRow
              });
              return mergedRow;
            }
            return row;
          });
          
          console.log("RefEntry - Updated table data after save:", updatedData);
          return updatedData;
        });

        setUnsavedChanges(false);
        console.log("RefEntry - All changes saved successfully, unsavedChanges set to false");
      } else {
        console.error("RefEntry - Save failed:", data);
        throw new Error(data.message || "Failed to save changes");
      }
    } catch (error) {
      console.error("RefEntry - Error saving changes:", error);
      console.error("RefEntry - Error details:", {
        message: error.message,
        stack: error.stack,
        response: error.response?.data
      });
      alert("Failed to save changes. Please try again.");
    } finally {
      console.log("RefEntry - Save process completed, setting savingNewRow to false");
      setSavingNewRow(false);
    }
  };

  // Handle canceling all unsaved changes
  const handleCancelChanges = () => {
    if (!unsavedChanges) {
      console.log("RefEntry - No unsaved changes to cancel");
      return;
    }

    if (window.confirm("Are you sure you want to cancel all unsaved changes? This action cannot be undone.")) {
      console.log("RefEntry - Canceling all unsaved changes");
      
      // Remove all unsaved rows and revert modifications
      setTableData(prevData => {
        return prevData.filter(row => row.id); // Keep only saved rows (with IDs)
      });
      
      setUnsavedChanges(false);
      console.log("RefEntry - All unsaved changes canceled");
      
      // Refresh data from server to get clean state
      handleRefresh();
    }
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

      {/* Add New Row Restriction Message */}
      {!canAddRow() && (
        <div style={{
          backgroundColor: "#fff3cd",
          border: "1px solid #ffeaa7",
          color: "#856404",
          padding: "10px",
          marginBottom: "15px",
          borderRadius: "5px",
          fontSize: "14px"
        }}>
          <strong>Note:</strong> You can only add new records for the current month ({new Date().toISOString().slice(0, 7)}) or previous month. 
          Please switch to a valid month to add new records.
        </div>
      )}

      {/* Saving New Row Indicator */}
      {savingNewRow && (
        <div style={{
          backgroundColor: "#d1ecf1",
          border: "1px solid #bee5eb",
          color: "#0c5460",
          padding: "10px",
          marginBottom: "15px",
          borderRadius: "5px",
          fontSize: "14px"
        }}>
          <strong>Saving...</strong> Adding new row to database. Please wait.
        </div>
      )}

      {/* DataTable */}
      {(() => {
        const canAdd = canAddRow();
        console.log("RefEntry - Rendering DataTable with:", {
          canAddRow: canAdd,
          savingNewRow,
          addNewButtonEnabled: canAdd && !savingNewRow,
          onAddNewDefined: !!handleAddNew,
          selectedMonth,
          currentMonth,
          filteredDataLength: filteredData.length,
          unsavedChanges,
          saveChangesButtonEnabled: unsavedChanges,
          onSaveChangesDefined: !!(unsavedChanges ? handleSaveChanges : undefined),
          actionBarButtons: {
            addNew: canAdd && !savingNewRow,
            import: false,
            export: false,
            delete: true,
            saveChanges: unsavedChanges,
            cancelChanges: unsavedChanges,
            refresh: true
          }
        });
        
        return (
          <DataTable
            columns={columns}
            data={filteredData}
            onCellUpdate={handleCellUpdate}
            onAddNew={canAdd && !savingNewRow ? handleAddNew : undefined}
            onDelete={handleDelete}
            onRefresh={handleRefresh}
            onSaveChanges={unsavedChanges ? handleSaveChanges : undefined}
            onCancelChanges={unsavedChanges ? handleCancelChanges : undefined}
            entityName="refvalidation record"
            defaultSortBy="date_app_checked"
            defaultSortOrder="desc"
            disablePagination={false}
            autoSave={false}
            actionBarButtons={{
              addNew: canAdd && !savingNewRow,
              import: false,
              export: false,
              delete: true,
              saveChanges: unsavedChanges,
              cancelChanges: unsavedChanges,
              refresh: true
            }}
            rowColorFunction={(row) => {
              if (row.true_ref === "Y") return "#d4edda";
              if (row.true_ref === "N") return "#f8d7da";
              return "#fff";
            }}
          />
        );
      })()}

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