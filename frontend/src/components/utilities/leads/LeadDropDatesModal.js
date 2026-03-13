import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../../api';
import { toast } from 'react-hot-toast';
import DataTable from '../../utils/DataTable';
import { FaPencilAlt, FaTrash } from 'react-icons/fa';
import './LeadDropDatesModal.css';

const LeadDropDatesModal = ({ isOpen, onClose, targetMonth }) => {
  const [dropDates, setDropDates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingDropDate, setEditingDropDate] = useState(null);
  const [formData, setFormData] = useState({
    drop_date: '',
    drop_name: '',
    allotment_month: targetMonth || '',
    notes: ''
  });

  const fetchDropDates = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/pnp/lead-drop-dates');
      if (response.data.success) {
        setDropDates(response.data.dropDates);
      }
    } catch (error) {
      console.error('Error fetching drop dates:', error);
      toast.error('Failed to load drop dates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchDropDates();
      setFormData(prev => ({ ...prev, allotment_month: targetMonth || '' }));
    }
  }, [isOpen, targetMonth, fetchDropDates]);

  const handleAddDropDate = async (e) => {
    e.preventDefault();
    
    if (!formData.drop_date || !formData.allotment_month) {
      toast.error('Drop date and allotment month are required');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/pnp/lead-drop-dates', formData);
      
      if (response.data.success) {
        toast.success('Drop date added successfully');
        setFormData({
          drop_date: '',
          drop_name: '',
          allotment_month: targetMonth || '',
          notes: ''
        });
        setShowAddForm(false);
        fetchDropDates();
      }
    } catch (error) {
      console.error('Error adding drop date:', error);
      toast.error('Failed to add drop date');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDropDate = useCallback(async (id) => {
    if (!window.confirm('Are you sure you want to delete this drop date?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.delete(`/pnp/lead-drop-dates/${id}`);
      
      if (response.data.success) {
        toast.success('Drop date deleted');
        fetchDropDates();
      }
    } catch (error) {
      console.error('Error deleting drop date:', error);
      toast.error('Failed to delete drop date');
    } finally {
      setLoading(false);
    }
  }, [fetchDropDates]);

  const handleEditDropDate = useCallback((dropDate) => {
    // Format the date for the input (YYYY-MM-DD)
    const date = new Date(dropDate.drop_date);
    const formattedDate = date.toISOString().split('T')[0];
    
    setEditingDropDate(dropDate);
    setFormData({
      drop_date: formattedDate,
      drop_name: dropDate.drop_name || '',
      allotment_month: dropDate.allotment_month,
      notes: dropDate.notes || ''
    });
    setShowAddForm(true);
  }, []);

  const handleUpdateDropDate = async (e) => {
    e.preventDefault();
    
    if (!formData.drop_date || !formData.allotment_month) {
      toast.error('Drop date and allotment month are required');
      return;
    }

    try {
      setLoading(true);
      const response = await api.put(`/pnp/lead-drop-dates/${editingDropDate.id}`, formData);
      
      if (response.data.success) {
        toast.success('Drop date updated successfully');
        setFormData({
          drop_date: '',
          drop_name: '',
          allotment_month: targetMonth || '',
          notes: ''
        });
        setShowAddForm(false);
        setEditingDropDate(null);
        fetchDropDates();
      }
    } catch (error) {
      console.error('Error updating drop date:', error);
      toast.error('Failed to update drop date');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelForm = () => {
    setShowAddForm(false);
    setEditingDropDate(null);
    setFormData({
      drop_date: '',
      drop_name: '',
      allotment_month: targetMonth || '',
      notes: ''
    });
  };

  const columns = useMemo(() => [
    {
      Header: 'Drop Date',
      accessor: 'drop_date',
      Cell: ({ value }) => {
        // Parse date without timezone conversion to avoid date shifting
        const [year, month, day] = value.split('T')[0].split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return date.toLocaleDateString('en-US', { 
          weekday: 'short',
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
      },
      width: 180
    },
    {
      Header: 'Drop Name',
      accessor: 'drop_name',
      Cell: ({ value }) => value || '-',
      width: 150
    },
    {
      Header: 'Allotment Month',
      accessor: 'allotment_month',
      Cell: ({ value }) => {
        const [year, month] = value.split('-');
        const date = new Date(year, parseInt(month) - 1, 1);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      },
      width: 150
    },
    {
      Header: 'Notes',
      accessor: 'notes',
      Cell: ({ value }) => value || '-',
      width: 200
    },
    {
      Header: 'Actions',
      accessor: 'actions',
      id: 'actions',
      isEditable: false,
      disableFilters: true,
      Cell: ({ row }) => (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEditDropDate(row.original);
            }}
            style={{
              padding: '6px 10px',
              backgroundColor: '#00558c',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s'
            }}
            title="Edit drop date"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#003d66'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#00558c'}
          >
            <FaPencilAlt size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteDropDate(row.original.id);
            }}
            style={{
              padding: '6px 10px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s'
            }}
            title="Delete drop date"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#bb2d3b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc3545'}
          >
            <FaTrash size={14} />
          </button>
        </div>
      ),
      width: 120,
      filterable: false
    }
  ], [handleEditDropDate, handleDeleteDropDate]);

  if (!isOpen) return null;

  return (
    <div className="lead-drop-dates-modal-overlay" onClick={onClose}>
      <div className="lead-drop-dates-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="lead-drop-dates-modal-header">
          <h2>Manage Lead Drop Dates</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="lead-drop-dates-modal-body">
          {/* Add Drop Date Button */}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              style={{
                marginBottom: '16px',
                padding: '8px 16px',
                backgroundColor: '#00558c',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              + Add Drop Date
            </button>
          )}

          {/* Add/Edit Drop Date Form */}
          {showAddForm && (
            <form onSubmit={editingDropDate ? handleUpdateDropDate : handleAddDropDate} className="add-drop-date-form">
              <h3>{editingDropDate ? 'Edit Drop Date' : 'Add New Drop Date'}</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Drop Date *</label>
                  <input
                    type="date"
                    value={formData.drop_date}
                    onChange={(e) => setFormData({ ...formData, drop_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Drop Name</label>
                  <input
                    type="text"
                    placeholder="e.g., January Drop 1"
                    value={formData.drop_name}
                    onChange={(e) => setFormData({ ...formData, drop_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Allotment Month *</label>
                  <input
                    type="month"
                    value={formData.allotment_month}
                    onChange={(e) => setFormData({ ...formData, allotment_month: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  placeholder="Optional notes about this drop"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#00558c',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  {loading 
                    ? (editingDropDate ? 'Updating...' : 'Adding...') 
                    : (editingDropDate ? 'Update Drop Date' : 'Add Drop Date')
                  }
                </button>
              </div>
            </form>
          )}

          {/* Drop Dates Table */}
          <div className="drop-dates-table">
            {loading && !showAddForm ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div>Loading drop dates...</div>
              </div>
            ) : (
              <DataTable
                columns={columns}
                data={dropDates}
                defaultSortBy="drop_date"
                defaultSortOrder="asc"
                showActionBar={false}
                disablePagination={false}
                enableColumnFilters={true}
                tableId="lead-drop-dates-table"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadDropDatesModal;

