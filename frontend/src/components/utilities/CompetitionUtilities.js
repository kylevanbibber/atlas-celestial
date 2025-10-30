import React, { useState, useEffect, useContext } from 'react';
import { FiAward, FiEdit3, FiTrash2, FiPlus, FiSave, FiX, FiUsers, FiCalendar, FiTarget } from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api';
import Card from '../utils/Card';
import DataTable from '../utils/DataTable';
import ActionBar from '../utils/ActionBar';
import { toast } from 'react-hot-toast';
import './CompetitionUtilities.css';

const CompetitionUtilities = () => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [competitions, setCompetitions] = useState([]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'active', 'draft', 'completed'
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    prize: '',
    rules: '',
    start_date: '',
    end_date: '',
    competition_type: 'individual',
    metric_type: 'alp',
    target_value: '',
    min_participants: 1,
    max_participants: '',
    is_global: true,
    eligible_roles: [],
    eligible_users: [],
    progress_calculation_type: 'sum',
    status: 'draft'
  });

  // Load competitions
  const loadCompetitions = async () => {
    try {
      console.log('🔄 Loading competitions...');
      setLoading(true);
      const response = await api.get('/competitions');
      console.log('✅ API Response:', response);
      console.log('📊 Response data:', response.data);
      console.log('📈 Data length:', response.data?.length);
      setCompetitions(response.data || []);
      console.log('🎯 Competitions state set to:', response.data || []);
    } catch (error) {
      console.error('❌ Error loading competitions:', error);
      console.error('❌ Error details:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      toast.error('Failed to load competitions');
    } finally {
      setLoading(false);
      console.log('✅ Loading finished');
    }
  };

  useEffect(() => {
    console.log('🔐 Auth check:');
    console.log('👤 User:', user);
    console.log('🎫 Token in localStorage:', !!localStorage.getItem('auth_token'));
    console.log('🎫 Token value:', localStorage.getItem('auth_token')?.substring(0, 20) + '...');
    
    if (user) {
      loadCompetitions();
    } else {
      console.warn('⚠️ No user found - skipping competition load');
    }
  }, [user]);

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle array fields (roles, users)
  const handleArrayInputChange = (field, value) => {
    const arrayValue = value.split(',').map(v => v.trim()).filter(v => v);
    setFormData(prev => ({
      ...prev,
      [field]: arrayValue
    }));
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      prize: '',
      rules: '',
      start_date: '',
      end_date: '',
      competition_type: 'individual',
      metric_type: 'alp',
      target_value: '',
      min_participants: 1,
      max_participants: '',
      is_global: true,
      eligible_roles: [],
      eligible_users: [],
      progress_calculation_type: 'sum',
      status: 'draft'
    });
    setIsAddingNew(false);
    setEditingId(null);
  };

  // Handle save (create or update)
  const handleSave = async () => {
    try {
      setLoading(true);
      
      // Validation
      if (!formData.title || !formData.prize || !formData.rules || !formData.start_date || !formData.end_date) {
        toast.error('Please fill in all required fields');
        return;
      }

      if (new Date(formData.start_date) >= new Date(formData.end_date)) {
        toast.error('Start date must be before end date');
        return;
      }

      const payload = {
        ...formData,
        target_value: formData.target_value ? parseFloat(formData.target_value) : null,
        min_participants: parseInt(formData.min_participants) || 1,
        max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
      };

      if (editingId) {
        await api.put(`/competitions/${editingId}`, payload);
        toast.success('Competition updated successfully');
      } else {
        await api.post('/competitions', payload);
        toast.success('Competition created successfully');
      }

      resetForm();
      loadCompetitions();
    } catch (error) {
      console.error('Error saving competition:', error);
      toast.error(error.response?.data?.error || 'Error saving competition');
    } finally {
      setLoading(false);
    }
  };

  // Handle edit
  const handleEdit = (competition) => {
    setFormData({
      title: competition.title,
      description: competition.description || '',
      prize: competition.prize,
      rules: competition.rules,
      start_date: competition.start_date.split('T')[0],
      end_date: competition.end_date.split('T')[0],
      competition_type: competition.competition_type,
      metric_type: competition.metric_type,
      target_value: competition.target_value || '',
      min_participants: competition.min_participants,
      max_participants: competition.max_participants || '',
      is_global: competition.is_global,
      eligible_roles: competition.eligible_roles || [],
      eligible_users: competition.eligible_users || [],
      progress_calculation_type: competition.progress_calculation_type,
      status: competition.status
    });
    setEditingId(competition.id);
    setIsAddingNew(true);
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this competition? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/competitions/${id}`);
      toast.success('Competition deleted successfully');
      loadCompetitions();
    } catch (error) {
      console.error('Error deleting competition:', error);
      toast.error('Error deleting competition');
    } finally {
      setLoading(false);
    }
  };

  // Filter competitions based on active tab
  const filteredCompetitions = competitions.filter(competition => {
    if (activeTab === 'all') return true;
    return competition.status === activeTab;
  });
  
  console.log('🔍 Filtering competitions:');
  console.log('📊 Total competitions:', competitions.length);
  console.log('🎯 Active tab:', activeTab);
  console.log('✅ Filtered competitions:', filteredCompetitions.length);
  console.log('📋 Filtered data:', filteredCompetitions);

  // Define table columns (react-table format)
  const columns = [
    {
      Header: 'Title',
      accessor: 'title',
      width: 200,
      Cell: ({ value }) => (
        <div style={{ fontWeight: 'bold' }}>{value}</div>
      )
    },
    {
      Header: 'Status',
      accessor: 'status',
      width: 100,
      Cell: ({ value }) => {
        const statusColors = {
          draft: '#6b7280',
          active: '#10b981',
          completed: '#3b82f6',
          cancelled: '#ef4444'
        };
        return (
          <span style={{
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '500',
            backgroundColor: `${statusColors[value]}20`,
            color: statusColors[value]
          }}>
            {String(value || '').toUpperCase()}
          </span>
        );
      }
    },
    {
      Header: 'Dates',
      accessor: 'dates',
      width: 150,
      Cell: ({ row }) => (
        <div style={{ fontSize: '12px' }}>
          <div>{new Date(row.original.start_date).toLocaleDateString()}</div>
          <div>to {new Date(row.original.end_date).toLocaleDateString()}</div>
        </div>
      )
    },
    {
      Header: 'Participants',
      accessor: 'participant_count',
      width: 100,
      Cell: ({ value }) => Number(value || 0).toLocaleString()
    },
    {
      Header: 'Target',
      accessor: 'target_value',
      width: 120,
      Cell: ({ value }) => (value ? Number(value).toLocaleString() : 'No target')
    },
    {
      Header: 'Prize',
      accessor: 'prize',
      width: 200,
      Cell: ({ value }) => (
        <div style={{ 
          maxWidth: '180px', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {value}
        </div>
      )
    },
    {
      Header: 'Actions',
      accessor: 'actions',
      width: 120,
      Cell: ({ row }) => (
        <div className="actions-cell">
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => handleEdit(row.original)}
            title="Edit competition"
          >
            <FiEdit3 />
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => handleDelete(row.original.id)}
            title="Delete competition"
          >
            <FiTrash2 />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="competition-utilities">
      <div className="page-header">
        <div className="page-title">
          <FiAward className="page-icon" />
          <h2>Competition Management</h2>
        </div>
        <p>Create and manage competitions to motivate your team</p>
      </div>

      {/* Action Bar */}
      <ActionBar
        selectedRows={selectedRows}
        onAction={(action) => {
          if (action === 'add') {
            setIsAddingNew(true);
          }
        }}
        actions={[
          { key: 'add', label: 'Add Competition', icon: FiPlus, variant: 'primary' }
        ]}
      />

      {/* Status Tabs */}
      <div className="status-tabs">
        {[
          { key: 'all', label: 'All', count: competitions.length },
          { key: 'active', label: 'Active', count: competitions.filter(c => c.status === 'active').length },
          { key: 'draft', label: 'Draft', count: competitions.filter(c => c.status === 'draft').length },
          { key: 'completed', label: 'Completed', count: competitions.filter(c => c.status === 'completed').length }
        ].map(tab => (
          <button
            key={tab.key}
            className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Competition Form */}
      {isAddingNew && (
        <Card 
          title={editingId ? 'Edit Competition' : 'Create New Competition'}
          className="competition-form-card"
        >
          <div className="competition-form">
            <div className="form-row">
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="e.g., Monthly ALP Challenge"
                />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  className="form-control"
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Start Date *</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.start_date}
                  onChange={(e) => handleInputChange('start_date', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>End Date *</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.end_date}
                  onChange={(e) => handleInputChange('end_date', e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Competition Type</label>
                <select
                  className="form-control"
                  value={formData.competition_type}
                  onChange={(e) => handleInputChange('competition_type', e.target.value)}
                >
                  <option value="individual">Individual</option>
                  <option value="team">Team</option>
                  <option value="group">Group</option>
                </select>
              </div>
              <div className="form-group">
                <label>Metric Type</label>
                <select
                  className="form-control"
                  value={formData.metric_type}
                  onChange={(e) => handleInputChange('metric_type', e.target.value)}
                >
                  <option value="alp">ALP</option>
                  <option value="calls">Calls</option>
                  <option value="appointments">Appointments</option>
                  <option value="sales">Sales</option>
                  <option value="codes">Codes</option>
                  <option value="hires">Hires</option>
                  <option value="refs">Referrals</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Target Value</label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.target_value}
                  onChange={(e) => handleInputChange('target_value', e.target.value)}
                  placeholder="e.g., 5000"
                />
                <small className="form-help">Optional - leave blank for no target</small>
              </div>
              <div className="form-group">
                <label>Progress Calculation</label>
                <select
                  className="form-control"
                  value={formData.progress_calculation_type}
                  onChange={(e) => handleInputChange('progress_calculation_type', e.target.value)}
                >
                  <option value="sum">Sum</option>
                  <option value="average">Average</option>
                  <option value="max">Maximum</option>
                  <option value="min">Minimum</option>
                  <option value="count">Count</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Min Participants</label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.min_participants}
                  onChange={(e) => handleInputChange('min_participants', e.target.value)}
                  min="1"
                />
              </div>
              <div className="form-group">
                <label>Max Participants</label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.max_participants}
                  onChange={(e) => handleInputChange('max_participants', e.target.value)}
                  placeholder="Leave blank for unlimited"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                className="form-control"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows="3"
                placeholder="Brief description of the competition..."
              />
            </div>

            <div className="form-group">
              <label>Prize *</label>
              <textarea
                className="form-control"
                value={formData.prize}
                onChange={(e) => handleInputChange('prize', e.target.value)}
                rows="2"
                placeholder="e.g., $500 bonus + recognition trophy"
              />
            </div>

            <div className="form-group">
              <label>Rules *</label>
              <textarea
                className="form-control"
                value={formData.rules}
                onChange={(e) => handleInputChange('rules', e.target.value)}
                rows="4"
                placeholder="Enter competition rules, one per line&#10;• Track your ALP from start to end of month&#10;• All active agents eligible&#10;• Must maintain good standing"
              />
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.is_global}
                  onChange={(e) => handleInputChange('is_global', e.target.checked)}
                  style={{ marginRight: '8px' }}
                />
                Global Competition (visible to all users)
              </label>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetForm}
              >
                <FiX /> Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={loading}
              >
                <FiSave /> {editingId ? 'Update' : 'Create'} Competition
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Competitions Table (no card wrapper) */}
      <div className="competitions-table" style={{ marginTop: '10px' }}>
        <DataTable
          columns={columns}
          data={filteredCompetitions}
          loading={loading}
          onRowSelection={setSelectedRows}
          selectedRows={selectedRows}
          emptyMessage="No competitions found. Create your first competition to get started!"
          showActionBar={false}
          disablePagination={false}
          entityName="competition"
        />
      </div>

      {/* Removed "How Competitions Work" info card as requested */}
    </div>
  );
};

export default CompetitionUtilities;
