import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api";
import DataTable from "../utils/DataTable";
import "../../App.css";

const AdminLicensing = () => {
  const { user } = useAuth();
  const [licenses, setLicenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Format date for display
  const formatDateForDisplay = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  // Define columns for DataTable
  const columns = React.useMemo(() => [
    {
      Header: "ID",
      accessor: "id",
      width: 80,
    },
    {
      Header: "User ID",
      accessor: "userId",
      width: 100,
    },
    {
      Header: "Agent Name",
      accessor: "lagnname",
      width: 200,
    },
    {
      Header: "State",
      accessor: "state",
      width: 80,
    },
    {
      Header: "Expiry Date",
      accessor: "expiry_date",
      width: 120,
      Cell: ({ value }) => formatDateForDisplay(value),
    },
    {
      Header: "Resident State",
      accessor: "resident_state",
      width: 120,
      Cell: ({ value }) => value === 1 ? "Yes" : "No",
    },
    {
      Header: "License Number",
      accessor: "license_number",
      width: 150,
    },
  ], []);

  // Prepare data for DataTable
  const dataTableData = React.useMemo(() => {
    return licenses.map(license => ({
      ...license,
      id: license.id || Math.random().toString(36),
    }));
  }, [licenses]);

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

    fetchLicenses();
  }, []);

  // Handle cell updates
  const handleCellUpdate = async (rowId, field, value) => {
    try {
      // Find the license to update
      const licenseToUpdate = licenses.find(license => license.id === rowId);
      if (!licenseToUpdate) return;

      // Update local state optimistically
      setLicenses(prevLicenses => 
        prevLicenses.map(license => 
          license.id === rowId 
            ? { ...license, [field]: value }
            : license
        )
      );

      // Save to backend
      const updatedLicense = {
        ...licenseToUpdate,
        [field]: value
      };

      await api.post("/admin/licensing/save", [updatedLicense]);
    } catch (error) {
      console.error("Error updating license:", error);
      // Revert optimistic update on error
      setLicenses(prevLicenses => [...prevLicenses]);
    }
  };

  // Handle adding new license
  const handleAddNew = () => {
    const newLicense = {
      id: null,
      userId: "",
      lagnname: "",
      state: "",
      expiry_date: new Date().toISOString().split('T')[0], // Today's date
      resident_state: 0,
      license_number: "",
    };

    setLicenses(prev => [newLicense, ...prev]);
  };

  // Handle deleting license
  const handleDelete = async (ids) => {
    const idsArray = Array.isArray(ids) ? ids : [ids];
    
    for (const id of idsArray) {
      try {
        await api.delete(`/admin/licensing/delete/${id}`);
        setLicenses(prev => prev.filter(license => license.id !== id));
      } catch (error) {
        console.error("Error deleting license:", error);
      }
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    window.location.reload();
  };

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

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Admin Licensing</h2>
      <p style={{ marginBottom: "1rem", color: "#666" }}>
        Manage all user licenses from the licensed_states table.
      </p>
      
      <DataTable
        columns={columns}
        data={dataTableData}
        onCellUpdate={handleCellUpdate}
        onAddNew={handleAddNew}
        onDelete={handleDelete}
        onRefresh={handleRefresh}
        entityName="license"
        defaultSortBy="id"
        defaultSortOrder="desc"
        disablePagination={false}
        actionBarButtons={{
          addNew: true,
          import: false,
          export: true,
          delete: true,
          archive: false,
          sendEmail: false,
          toggleArchived: false,
          refresh: true,
          reassign: false
        }}
      />
    </div>
  );
};

export default AdminLicensing; 