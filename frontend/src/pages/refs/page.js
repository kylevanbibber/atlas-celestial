import React, { useState, useEffect, useContext } from "react";
import Card from "../../components/utils/Card";
import DataTable from "../../components/utils/DataTable";
import ImportModal from "../../components/utils/ImportModal";
import MassReassignMenu from "../../components/utils/MassReassignMenu";
import globeBg from "../../img/globe_bg_watermark.png";
import * as XLSX from 'xlsx';
import api from "../../api";
import { AuthContext } from "../../context/AuthContext";
import { FiCalendar } from 'react-icons/fi';
import RefDetails from "../../components/utils/RefDetails";

const RefsPage = () => {
  const [tableData, setTableData] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [archivedView, setArchivedView] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showMassReassignMenu, setShowMassReassignMenu] = useState(false);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [detailsData, setDetailsData] = useState(null);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);
      await Promise.all([fetchUsers(), fetchRefs()]);
      setIsLoading(false);
    };
    initializeData();
  }, [archivedView]);

  const fetchRefs = async () => {
    try {
      // Get the logged-in user's lagnname from activeusers table
      const userResponse = await api.get(`/auth/activeusers/${user.id}`);
      
      if (!userResponse.data || !userResponse.data.lagnname) {
        console.error('No lagnname found in activeusers data');
        return;
      }

      const lagnname = userResponse.data.lagnname;

      // Get refs filtered by the same lagnname criteria
      const response = await api.get('/refs', {
        params: {
          archive: archivedView ? 1 : 0,
          lagnname: lagnname
        }
      });

      // Map the assigned_to IDs to their corresponding lagnnames
      const mappedData = response.data.map(ref => {
        const assignedUser = users.find(u => u.id === ref.assigned_to);
        return {
          ...ref,
          assigned_to_display: assignedUser ? assignedUser.first_name : ''
        };
      });

      setTableData(mappedData);
    } catch (error) {
      console.error("Error fetching refs:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      // Get the logged-in user's lagnname from activeusers table
      const userResponse = await api.get(`/auth/activeusers/${user.id}`);
      console.log('User data from activeusers:', userResponse.data);
      
      if (!userResponse.data || !userResponse.data.lagnname) {
        console.error('No lagnname found in activeusers data');
        return;
      }

      const lagnname = userResponse.data.lagnname;
      console.log('Current user lagnname:', lagnname);

      // Then get all users with matching lagnname in sa, ga, mga, or rga fields
      // and where Active = 'y' and managerActive = 'y'
      const response = await api.get('/auth/activeusers', {
        params: {
          lagnname: lagnname,
          active: 'y',
          managerActive: 'y'
        }
      });
      
      console.log('Raw response from activeusers:', response.data);
      
      // Transform the data to use lagnname for display but ID for value
      // and sort alphabetically by lagnname
      const transformedUsers = response.data
        .map(user => ({
          id: user.id, // Using the actual user ID as the value
          first_name: user.lagnname, // Using lagnname for display
          last_name: '' // Not needed since we're only using lagnname
        }))
        .sort((a, b) => a.first_name.localeCompare(b.first_name)); // Sort alphabetically by lagnname
      
      console.log('Transformed users for dropdown:', transformedUsers);
      setUsers(transformedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const columns = [
    {
      Header: "",
      accessor: "massSelection",
      massSelection: true,
      width: 40,
    },
    {
      Header: "Name",
      accessor: "name",
    },
    {
      Header: "Phone",
      accessor: "phone",
    },
    {
      Header: "Email",
      accessor: "email",
    },
    {
      Header: "Type",
      accessor: "type",
      type: "select",
      width: 120,
      DropdownOptions: [
        "Personal Ref",
        "Union Catchup",
        "CSK",
        "FWK",
        "POS",
        "AD&D",
        "Beneficiary",
        "Emergency Contact"
      ],
      dropdownBackgroundColor: (value) => {
        switch (value) {
          case "Personal Ref":
            return "#3498db";
          case "Union Catchup":
            return "#2ecc71";
          case "CSK":
            return "#f1c40f";
          case "FWK":
            return "#e74c3c";
          case "POS":
            return "#95a5a6";
          case "AD&D":
            return "#27ae60";
          case "Beneficiary":
            return "#9b59b6";
          case "Emergency Contact":
            return "#e67e22";
          default:
            return "#fff";
        }
      }
    },
    {
      Header: "Referred By",
      accessor: "referred_by",
      type: "autocomplete",
      width: 150,
      autocompleteOptions: users,
      autocompleteValueField: "id",
      autocompleteDisplayField: "first_name",
      autocompleteChipColor: (row) => row.archive ? "#F08080" : "#e0e0e0",
    },
    {
      Header: "Created By",
      accessor: "created_by",
      width: 150,
      Cell: ({ value }) => {
        const creator = users.find(u => u.id === value);
        return (
          <div style={{
            backgroundColor: "#e0e0e0",
            color: "#000",
            padding: "2px 8px",
            borderRadius: "12px",
            fontSize: "12px",
            display: "inline-block"
          }}>
            {creator ? creator.first_name : ''}
          </div>
        );
      }
    },
    {
      Header: "Assigned To",
      accessor: "assigned_to",
      chipDropdown: true,
      width: 150,
      chipDropdownOptions: users,
      chipDropdownValueField: "id",
      chipDropdownDisplay: (user) => `${user.first_name} ${user.last_name}`.trim(),
      chipDropdownChipColor: (row) => row.active === "n" ? "#F08080" : row.chip_color || "#e0e0e0",
    },
    {
      Header: "Date Created",
      accessor: "date_created",
      type: "date",
      Cell: ({ value }) => {
        if (!value) return '';
        // If it's already in the correct format, return as is
        if (typeof value === 'string' && value.match(/^\d{1,2}\/\d{1,2}\/\d{2} \d{1,2}:\d{2} [AP]M$/)) {
          return value;
        }
        // Otherwise parse and format
        const date = new Date(value);
        const hours = date.getHours();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(-2)} ${displayHours}:${date.getMinutes().toString().padStart(2, '0')} ${ampm}`;
      }
    },
    {
      Header: "Last Updated",
      accessor: "last_updated",
      type: "date",
      Cell: ({ value }) => {
        if (!value) return '';
        // If it's already in the correct format, return as is
        if (typeof value === 'string' && value.match(/^\d{1,2}\/\d{1,2}\/\d{2} \d{1,2}:\d{2} [AP]M$/)) {
          return value;
        }
        // Otherwise parse and format
        const date = new Date(value);
        const hours = date.getHours();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(-2)} ${displayHours}:${date.getMinutes().toString().padStart(2, '0')} ${ampm}`;
      }
    },
    {
      Header: "Notes",
      accessor: "notes",
      type: "textarea",
    },
    {
      Header: (
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <FiCalendar />
          <span>Scheduled</span>
        </div>
      ),
      accessor: "scheduled",
      width: 150,
      datePicker: true,
      type: "date"
    },
    {
      Header: "Status",
      accessor: "status",
      type: "select",
      width: 120,
      DropdownOptions: [
        "New",
        "Contacted",
        "Scheduled",
        "No Show",
        "No Sale",
        "Sale"
      ],
      dropdownBackgroundColor: (value) => {
        switch (value) {
          case "New":
            return "#3498db";
          case "Contacted":
            return "#2ecc71";
          case "Scheduled":
            return "#f1c40f";
          case "No Show":
            return "#e74c3c";
          case "No Sale":
            return "#95a5a6";
          case "Sale":
            return "#27ae60";
          default:
            return "#fff";
        }
      }
    },
  ];

  const handleCellUpdate = async (id, field, value) => {
    try {
      console.log('handleCellUpdate called with:', { id, field, value });
      
      // If updating date fields, format them
      if (field === 'date_created' || field === 'last_updated' || field === 'scheduled') {
        console.log('Processing date field:', field);
        console.log('Original date value:', value);
        
        const date = new Date(value);
        console.log('Parsed date object:', date);
        
        if (isNaN(date.getTime())) {
          console.error('Invalid date value:', value);
          return;
        }
        
        const hours = date.getHours();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        // Format as m/d/yy h:mm am/pm (single digits for month and day)
        value = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(-2)} ${displayHours}:${date.getMinutes().toString().padStart(2, '0')} ${ampm}`;
        console.log('Formatted date value:', value);
      }
      
      console.log('Sending update to API:', { id, field, value });
      const response = await api.put(`/refs/${id}`, { [field]: value });
      console.log('API response:', response.data);
      
      setTableData((prev) =>
        prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
      );
    } catch (error) {
      console.error("Error updating ref:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config
      });
    }
  };

  const handleSelectionChange = (selectedIds) => {
    setSelectedRows(selectedIds);
  };

  const handleMassStatusChange = async (newStatus, selectedIds) => {
    try {
      await api.put('/refs/updateArchive', {
        ids: selectedIds,
        archiveValue: newStatus === 'Archived' ? 1 : 0
      });
      setTableData(prev =>
        prev.map(row =>
          selectedIds.includes(row.id.toString()) ? { ...row, status: newStatus } : row
        )
      );
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleMassReassign = async (newUserId) => {
    try {
      console.log('Reassigning to user ID:', newUserId);
      console.log('Selected rows:', selectedRows);
      
      const updatePromises = selectedRows.map(id =>
        api.put(`/refs/${id}`, { assigned_to: newUserId })
      );
      await Promise.all(updatePromises);
      
      console.log('Reassignment successful');
      setTableData(prev =>
        prev.map(row =>
          selectedRows.includes(row.id.toString()) ? { ...row, assigned_to: newUserId } : row
        )
      );
      setShowMassReassignMenu(false);
    } catch (error) {
      console.error("Error reassigning refs:", error);
    }
  };

  const handleAddNew = async () => {
    try {
      const now = new Date();
      const hours = now.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      const formattedDate = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear().toString().slice(-2)} ${displayHours}:${now.getMinutes().toString().padStart(2, '0')} ${ampm}`;
      
      const newRef = {
        name: "",
        phone: "",
        email: "",
        type: "Personal Ref",
        assigned_to: user.id,
        referred_by: null,
        created_by: user.id,
        date_created: formattedDate,
        last_updated: formattedDate,
        notes: "",
        scheduled: null,
        status: "New",
        archive: 0
      };

      const response = await api.post('/refs', newRef);

      // Map the user data for display and ensure dates are set
      const newRow = {
        ...response.data,
        ...newRef, // Include all the fields we sent, including dates
        assigned_to_display: user.first_name,
        created_by_display: user.first_name
      };

      setTableData(prev => [...prev, newRow]);
    } catch (error) {
      console.error("Error creating new ref:", error);
    }
  };

  const handleImport = () => {
    setIsImportModalOpen(true);
  };

  const handleImportData = async (importedData) => {
    try {
      await api.post('/refs/import', importedData);
      fetchRefs(); // Refresh the data after import
    } catch (error) {
      console.error("Error importing data:", error);
    }
  };

  const handleExport = () => {
    const dataToExport = selectedRows.length > 0
      ? tableData.filter(row => selectedRows.includes(row.id.toString()))
      : tableData.filter(row => archivedView ? row.archive : !row.archive);
    
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Refs");
    XLSX.writeFile(wb, "refs.xlsx");
  };

  const handleDelete = async () => {
    try {
      const deletePromises = selectedRows.map(id =>
        api.delete(`/refs/${id}`)
      );
      await Promise.all(deletePromises);
      setTableData(prev => prev.filter(row => !selectedRows.includes(row.id.toString())));
      setSelectedRows([]);
    } catch (error) {
      console.error("Error deleting refs:", error);
    }
  };

  const handleArchive = async () => {
    try {
      await api.put('/refs/updateArchive', {
        ids: selectedRows,
        archiveValue: 1
      });
      setTableData(prev =>
        prev.map(row =>
          selectedRows.includes(row.id.toString())
            ? { ...row, archive: true }
            : row
        )
      );
      setSelectedRows([]);
    } catch (error) {
      console.error("Error archiving refs:", error);
    }
  };

  const handleSendEmail = () => {
    const selectedRefs = tableData.filter(row => selectedRows.includes(row.id.toString()));
    const emailList = selectedRefs.map(ref => ref.email).join(', ');
    window.location.href = `mailto:${emailList}`;
  };

  const handleToggleArchivedView = () => {
    setArchivedView(!archivedView);
    setSelectedRows([]);
  };

  const handleRefresh = () => {
    fetchRefs();
  };

  const filteredData = tableData.filter(row => archivedView ? row.archive : !row.archive);

  const handleOpenDetails = (row) => {
    setDetailsData(row);
  };

  const handleAddInteraction = (row) => {
    // Implement interaction functionality
    console.log('Add interaction for:', row);
  };

  const handleArchiveRef = async (id) => {
    try {
      await api.put('/refs/updateArchive', {
        ids: [id],
        archiveValue: 1
      });
      setTableData(prev =>
        prev.map(row =>
          row.id === id
            ? { ...row, archive: true }
            : row
        )
      );
    } catch (error) {
      console.error("Error archiving ref:", error);
    }
  };

  const handleDeleteRef = async (id) => {
    try {
      await api.delete(`/refs/${id}`);
      setTableData(prev => prev.filter(row => row.id !== id));
    } catch (error) {
      console.error("Error deleting ref:", error);
    }
  };

  return (
    <div>
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            <div className="card-container">
              <Card
                title="Total Refs"
                value={`${tableData.length}`}
                subText="Active References"
                donut={true}
                percentage={100}
                donutColor="#4caf50"
              />
              <Card
                title="Archived"
                value={`${tableData.filter(row => row.archive).length}`}
                subText="Archived References"
                donut={true}
                percentage={100}
                donutColor="#ff9800"
              />
              <Card
                title="Assigned"
                value={`${tableData.filter(row => row.assigned_to).length}`}
                subText="Assigned References"
                donut={true}
                percentage={100}
                donutColor="#3f51b5"
              />
              <Card
                title="References"
                value={`${tableData.length}`}
                subText="Total References"
                donut={true}
                percentage={100}
                donutColor="#4caf50"
                backgroundImage={globeBg}
              />
            </div>
          </div>
          
          <div style={{ padding: "20px" }}>
            <h2>Refs</h2>
            <DataTable
              columns={columns}
              data={filteredData}
              onCellUpdate={handleCellUpdate}
              onSelectionChange={handleSelectionChange}
              onMassStatusChange={handleMassStatusChange}
              entityName="reference"
              archivedView={archivedView}
              onAddNew={handleAddInteraction}
              onImport={handleImport}
              onExport={handleExport}
              onDelete={handleDeleteRef}
              onArchive={handleArchiveRef}
              onSendEmail={handleSendEmail}
              onToggleArchivedView={handleToggleArchivedView}
              onRefresh={handleRefresh}
              onMassReassign={() => setShowMassReassignMenu(true)}
              enableRowContextMenu={true}
              onOpenDetails={handleOpenDetails}
              getRowContextMenuOptions={(row) => [
                { label: "View Details", action: () => handleOpenDetails(row) },
                { label: "Add Interaction", action: () => handleAddInteraction(row) },
                { label: archivedView ? "Unarchive" : "Archive", action: () => handleArchiveRef(row.id) },
                { label: "Delete", action: () => handleDeleteRef(row.id) }
              ]}
            />

            {isImportModalOpen && (
              <ImportModal
                onClose={() => setIsImportModalOpen(false)}
                onImport={handleImportData}
              />
            )}

            {showMassReassignMenu && (
              <MassReassignMenu
                leads={tableData}
                users={users}
                selectedLeadIds={selectedRows}
                onReassign={handleMassReassign}
                onClose={() => setShowMassReassignMenu(false)}
              />
            )}

            {detailsData && (
              <RefDetails
                data={detailsData}
                columns={columns}
                onClose={() => setDetailsData(null)}
                onSave={async (updatedData) => {
                  try {
                    await api.put(`/refs/${updatedData.id}`, updatedData);
                    setTableData(prev =>
                      prev.map(row =>
                        row.id === updatedData.id ? updatedData : row
                      )
                    );
                    setDetailsData(null);
                  } catch (error) {
                    console.error("Error updating ref:", error);
                  }
                }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default RefsPage; 