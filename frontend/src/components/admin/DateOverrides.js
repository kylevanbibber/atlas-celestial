import React, { useState, useEffect } from 'react';
import { FiCalendar, FiEdit3, FiTrash2, FiPlus, FiSave, FiX } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import Card from '../utils/Card';
import DataTable from '../utils/DataTable';
import ActionBar from '../utils/ActionBar';
import { OverlaySpinner } from '../utils/LoadingSpinner';
import './DateOverrides.css';

const DateOverrides = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dateOverrides, setDateOverrides] = useState([]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  
  // Form state
  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    start_date: '',
    end_date: '',
    schedule_type: 'mon-sun'
  });

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Load date overrides
  const loadDateOverrides = async () => {
    try {
      setLoading(true);
      const response = await api.get('/date-overrides');
      setDateOverrides(response.data || []);
    } catch (error) {
      console.error('Error loading date overrides:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDateOverrides();
  }, []);

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle save (create or update)
  const handleSave = async () => {
    try {
      setLoading(true);
      
      const payload = {
        ...formData,
        created_by: user?.userId
      };

      if (editingId) {
        await api.put(`/date-overrides/${editingId}`, payload);
      } else {
        await api.post('/date-overrides', payload);
      }

      // Reset form and reload data
      setFormData({
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        start_date: '',
        end_date: '',
        schedule_type: 'mon-sun'
      });
      setIsAddingNew(false);
      setEditingId(null);
      loadDateOverrides();
    } catch (error) {
      console.error('Error saving date override:', error);
      alert(error.response?.data?.error || 'Error saving date override');
    } finally {
      setLoading(false);
    }
  };

  // Handle edit
  const handleEdit = (override) => {
    setFormData({
      year: override.year,
      month: override.month,
      start_date: override.start_date.split('T')[0], // Convert to YYYY-MM-DD format
      end_date: override.end_date.split('T')[0],
      schedule_type: override.schedule_type || 'mon-sun'
    });
    setEditingId(override.id);
    setIsAddingNew(true);
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this date override?')) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/date-overrides/${id}`);
      loadDateOverrides();
    } catch (error) {
      console.error('Error deleting date override:', error);
      alert('Error deleting date override');
    } finally {
      setLoading(false);
    }
  };

  // Handle mass delete
  const handleMassDelete = async () => {
    if (!selectedRows.length) return;
    
    if (!window.confirm(`Are you sure you want to delete ${selectedRows.length} date override(s)?`)) {
      return;
    }

    try {
      setLoading(true);
      const deletePromises = selectedRows.map(id => api.delete(`/date-overrides/${id}`));
      await Promise.all(deletePromises);
      setSelectedRows([]);
      loadDateOverrides();
    } catch (error) {
      console.error('Error deleting date overrides:', error);
      alert('Error deleting date overrides');
    } finally {
      setLoading(false);
    }
  };

  // Cancel editing
  const handleCancel = () => {
    setFormData({
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      start_date: '',
      end_date: '',
      schedule_type: 'mon-sun'
    });
    setIsAddingNew(false);
    setEditingId(null);
  };

  // Validate form
  const isFormValid = () => {
    return formData.year && 
           formData.month && 
           formData.start_date && 
           formData.end_date &&
           new Date(formData.start_date) < new Date(formData.end_date);
  };

  // Format date for display
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Table columns
  const columns = [
    { 
      Header: 'Year', 
      accessor: 'year', 
      width: 80,
      type: 'number'
    },
    { 
      Header: 'Month', 
      accessor: 'month', 
      width: 120,
      Cell: ({ value }) => monthNames[value - 1] || value
    },
    { 
      Header: 'Start Date', 
      accessor: 'start_date', 
      width: 120,
      Cell: ({ value }) => formatDate(value)
    },
    { 
      Header: 'End Date', 
      accessor: 'end_date', 
      width: 120,
      Cell: ({ value }) => formatDate(value)
    },
    {
      Header: 'Schedule',
      accessor: 'schedule_type',
      width: 100,
      Cell: ({ value }) => {
        const displayValue = value === 'wed-tue' ? 'Wed-Tue' : 'Mon-Sun';
        return (
          <span className={`schedule-badge ${value}`}>
            {displayValue}
          </span>
        );
      }
    },
    {
      Header: 'Duration',
      accessor: 'duration',
      width: 100,
      Cell: ({ row }) => {
        const start = new Date(row.original.start_date);
        const end = new Date(row.original.end_date);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        return `${days} days`;
      }
    },
    { 
      Header: 'Created By', 
      accessor: 'created_by_name', 
      width: 150
    },
    { 
      Header: 'Created', 
      accessor: 'created_at', 
      width: 120,
      Cell: ({ value }) => new Date(value).toLocaleDateString()
    },
    {
      Header: 'Actions',
      accessor: 'actions',
      width: 100,
      disableSortBy: true,
      Cell: ({ row }) => (
        <div className="actions-cell">
          <button
            className="btn btn-sm btn-outline"
            onClick={() => handleEdit(row.original)}
            title="Edit"
          >
            <FiEdit3 size={14} />
          </button>
          <button
            className="btn btn-sm btn-outline btn-danger"
            onClick={() => handleDelete(row.original.id)}
            title="Delete"
          >
            <FiTrash2 size={14} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="date-overrides">
      <div className="page-header">
        <div className="page-title">
          <FiCalendar className="page-icon" />
          <h2>Date Overrides</h2>
        </div>
        <p>Manage custom date ranges for production goal months that don't align with calendar months.</p>
      </div>

      {/* Add/Edit Form */}
      {isAddingNew && (
        <Card title={editingId ? "Edit Date Override" : "Add Date Override"}>
          <div className="date-override-form">
            <div className="form-row">
              <div className="form-group">
                <label>Year</label>
                <input
                  type="number"
                  min="2020"
                  max="2030"
                  value={formData.year}
                  onChange={(e) => handleInputChange('year', parseInt(e.target.value))}
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label>Month</label>
                <select
                  value={formData.month}
                  onChange={(e) => handleInputChange('month', parseInt(e.target.value))}
                  className="form-control"
                >
                  {monthNames.map((name, index) => (
                    <option key={index + 1} value={index + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Start Date</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleInputChange('start_date', e.target.value)}
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => handleInputChange('end_date', e.target.value)}
                  className="form-control"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Schedule Type</label>
                <select
                  value={formData.schedule_type}
                  onChange={(e) => handleInputChange('schedule_type', e.target.value)}
                  className="form-control"
                >
                  <option value="mon-sun">Monday - Sunday</option>
                  <option value="wed-tue">Wednesday - Tuesday</option>
                </select>
                <small className="form-help">
                  Choose the week layout for calendar display and working day calculations
                </small>
              </div>
            </div>
            <div className="form-actions">
              <button
                className="btn btn-secondary"
                onClick={handleCancel}
                disabled={loading}
              >
                <FiX />
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={loading || !isFormValid()}
              >
                <FiSave />
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Action Bar */}
      <ActionBar
        selectedCount={selectedRows.length}
        totalCount={dateOverrides.length}
        entityName="date overrides"
        onSelectAll={(selectAll) => {
          setSelectedRows(selectAll ? dateOverrides.map(item => item.id) : []);
        }}
      >
        <button
          className="btn btn-primary"
          onClick={() => setIsAddingNew(true)}
          disabled={loading}
        >
          <FiPlus />
          Add Date Override
        </button>
        {selectedRows.length > 0 && (
          <button
            className="btn btn-danger"
            onClick={handleMassDelete}
            disabled={loading}
          >
            <FiTrash2 />
            Delete Selected ({selectedRows.length})
          </button>
        )}
      </ActionBar>

      {/* Data Table */}
      <div className="date-overrides-table" style={{ position: 'relative' }}>
        <DataTable
          columns={columns}
          data={dateOverrides}
          disableCellEditing={true}
          showActionBar={false}
          selectedRows={selectedRows}
          onSelectedRowsChange={setSelectedRows}
          enableRowSelection={true}
          disablePagination={true}
          bandedRows={true}
          emptyMessage="No date overrides configured. Add one to override default month boundaries."
        />
        {loading && (
          <OverlaySpinner text="Loading date overrides..." />
        )}
      </div>

      {/* Info Card */}
      <Card title="How Date Overrides Work">
        <div className="info-content">
          <p>Date overrides allow you to set custom date ranges for specific months when they don't align with traditional calendar months.</p>
          <p><strong>Example:</strong> October 2025 might run from September 24, 2025 to October 31, 2025 for business purposes.</p>
          <p>When a date override exists for a month, ProductionGoals will use those dates instead of the standard month boundaries for:</p>
          <ul>
            <li>Working days calculation</li>
            <li>Calendar display</li>
            <li>Goal period definitions</li>
            <li>Activity data filtering</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default DateOverrides;
