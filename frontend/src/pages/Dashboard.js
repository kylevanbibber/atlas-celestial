import React, { useState } from "react";
import Card from "../components/utils/Card";
import DataTable from "../components/utils/DataTable";
import ActionBar from "../components/utils/ActionBar";
import ImportModal from "../components/utils/ImportModal";
import MassReassignMenu from "../components/utils/MassReassignMenu";
import globeBg from "../img/globe_bg_watermark.png"; // Import the image
import * as XLSX from 'xlsx';

const Dashboard = () => {
  const [tableData, setTableData] = useState([
    {
      id: 1,
      name: "John Doe",
      email: "john@example.com",
      status: "Active",
      role: "Agent",
      lastLogin: "2024-04-25",
      archived: false,
      assigned_to: "1",
    },
    {
      id: 2,
      name: "Jane Smith",
      email: "jane@example.com",
      status: "Inactive",
      role: "Manager",
      lastLogin: "2024-04-24",
      archived: false,
      assigned_to: "2",
    },
    {
      id: 3,
      name: "Bob Johnson",
      email: "bob@example.com",
      status: "Active",
      role: "Agent",
      lastLogin: "2024-04-23",
      archived: false,
      assigned_to: "1",
    },
  ]);

  const [selectedRows, setSelectedRows] = useState([]);
  const [archivedView, setArchivedView] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showMassReassignMenu, setShowMassReassignMenu] = useState(false);

  const users = [
    { id: "1", name: "John Doe" },
    { id: "2", name: "Jane Smith" },
    { id: "3", name: "Bob Johnson" },
  ];

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
      Header: "Email",
      accessor: "email",
    },
    {
      Header: "Status",
      accessor: "status",
      type: "select",
      options: [
        { value: "Active", label: "Active" },
        { value: "Inactive", label: "Inactive" },
      ],
    },
    {
      Header: "Role",
      accessor: "role",
      type: "select",
      options: [
        { value: "Agent", label: "Agent" },
        { value: "Manager", label: "Manager" },
      ],
    },
    {
      Header: "Assigned To",
      accessor: "assigned_to",
      type: "select",
      options: users.map(user => ({
        value: user.id,
        label: user.name,
      })),
    },
    {
      Header: "Last Login",
      accessor: "lastLogin",
    },
  ];

  const handleCellUpdate = async (id, field, value) => {
    setTableData((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const handleSelectionChange = (selectedIds) => {
    setSelectedRows(selectedIds);
  };

  const handleMassStatusChange = (newStatus, selectedIds) => {
    setTableData(prev =>
      prev.map(row =>
        selectedIds.includes(row.id.toString()) ? { ...row, status: newStatus } : row
      )
    );
  };

  const handleMassReassign = (newUserId) => {
    setTableData(prev =>
      prev.map(row =>
        selectedRows.includes(row.id.toString()) ? { ...row, assigned_to: newUserId } : row
      )
    );
    setShowMassReassignMenu(false);
  };

  const handleAddNew = () => {
    const newId = Math.max(...tableData.map(row => row.id)) + 1;
    const newRow = {
      id: newId,
      name: "",
      email: "",
      status: "Active",
      role: "Agent",
      lastLogin: new Date().toISOString().split('T')[0],
      archived: false,
      assigned_to: "",
    };
    setTableData(prev => [...prev, newRow]);
  };

  const handleImport = () => {
    setIsImportModalOpen(true);
  };

  const handleImportData = (importedData) => {
    const newData = importedData.map((row, index) => ({
      ...row,
      id: Math.max(...tableData.map(r => r.id)) + index + 1,
      archived: false,
    }));
    setTableData(prev => [...prev, ...newData]);
  };

  const handleExport = () => {
    // If no rows are selected, export all rows
    const dataToExport = selectedRows.length > 0
      ? tableData.filter(row => selectedRows.includes(row.id.toString()))
      : tableData.filter(row => archivedView ? row.archived : !row.archived);
    
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");
    XLSX.writeFile(wb, "users.xlsx");
  };

  const handleDelete = () => {
    setTableData(prev => prev.filter(row => !selectedRows.includes(row.id.toString())));
    setSelectedRows([]);
  };

  const handleArchive = () => {
    setTableData(prev =>
      prev.map(row =>
        selectedRows.includes(row.id.toString())
          ? { ...row, archived: true }
          : row
      )
    );
    setSelectedRows([]);
  };

  const handleSendEmail = () => {
    const selectedUsers = tableData.filter(row => selectedRows.includes(row.id.toString()));
    const emailList = selectedUsers.map(user => user.email).join(', ');
    window.location.href = `mailto:${emailList}`;
  };

  const handleToggleArchivedView = () => {
    setArchivedView(!archivedView);
    setSelectedRows([]);
  };

  const handleRefresh = () => {
    // In a real application, this would fetch fresh data from the server
    console.log("Refreshing data");
  };

  const filteredData = tableData.filter(row => archivedView ? row.archived : !row.archived);

  return (
    <div className="dashboard-container padded-content-sm">
      <div className="dashboard-cards-wrapper">
        <div className="card-container">
          <Card
            title="Overviews"
            value="1,200 / 1,500"
            subText="Show / Set"
            donut={true}
            percentage={80}
            donutColor="#4caf50"
            className="dashboard-card"
          />
          <Card
            title="Finals"
            value="900 / 1,000"
            subText="Show / Set"
            donut={true}
            percentage={90}
            donutColor="#3f51b5"
            className="dashboard-card"
          />
          <Card
            title="Hires"
            value="300 / 400"
            subText="Hires / Finals"
            donut={true}
            percentage={75}
            donutColor="#ff9800"
            className="dashboard-card"
          />
          <Card
            title="Dashboard"
            value="1,200 / 1,500"
            subText="Show / Set"
            donut={true}
            percentage={80}
            donutColor="#4caf50"
            backgroundImage={globeBg}
            className="dashboard-card"
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
