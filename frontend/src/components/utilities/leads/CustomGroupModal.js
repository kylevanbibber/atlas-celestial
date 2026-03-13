import React, { useState, useEffect, useMemo, useCallback, useContext } from 'react';
import { AuthContext } from '../../../context/AuthContext';
import api from '../../../api';
import DataTable from '../../utils/DataTable';
import { toast } from 'react-hot-toast';
import './CustomGroupModal.css';

const CustomGroupModal = ({ isOpen, onClose, onSave, groupToEdit, targetMonth }) => {
  const { user } = useContext(AuthContext);
  
  const [formData, setFormData] = useState({
    groupName: '',
    targetMonth: targetMonth || '',
    leadsPerMonth: '',
    leadsPerDrop: '',
    refsRequired: '',
    leadTypes: '',
    description: '',
    color: '#6c757d'
  });
  
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [allAgents, setAllAgents] = useState([]);
  const [allotmentGroups, setAllotmentGroups] = useState({});
  const [loading, setLoading] = useState(false);

  // Fetch all agents and their current allotment groups
  const fetchAgents = async () => {
    setLoading(true);
    try {
      // Fetch all active users
      const agentsResponse = await api.get('/admin/getAllUsers');
      const agents = agentsResponse.data.users || [];
      
      // If we have a target month, fetch allotment data to see current grouping
      let groupData = {};
      if (formData.targetMonth) {
        try {
          const allotmentResponse = await api.get(`/pnp/allotment?targetMonth=${formData.targetMonth}`);
          const allotmentData = allotmentResponse.data.data || [];
          
          // Build a map of agent_id to their current group
          allotmentData.forEach(item => {
            if (item.agentId && item.allotmentGroup) {
              groupData[item.agentId] = item.allotmentGroup;
            }
          });
        } catch (error) {
          console.warn('Could not fetch allotment data:', error);
        }
      }
      
      setAllAgents(agents);
      setAllotmentGroups(groupData);
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast.error('Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  // Filter agents: show active by default, show inactive only if search matches
  const filteredAgents = useMemo(() => {
    if (!allAgents.length) return [];
    
    const term = searchQuery.toLowerCase().trim();
    
    return allAgents.filter(agent => {
      const isActive = agent.Active === 'y' && agent.managerActive === 'y';
      const matchesSearch = !term || 
        agent.lagnname?.toLowerCase().includes(term) ||
        agent.rept_name?.toLowerCase().includes(term) ||
        agent.mga?.toLowerCase().includes(term);
      
      // Show active agents always, show inactive only if search matches
      return matchesSearch && (isActive || term);
    }).map(agent => ({
      ...agent,
      isInactive: agent.Active !== 'y' || agent.managerActive !== 'y',
      currentGroup: allotmentGroups[agent.id] || 'Not in allotment'
    }));
  }, [allAgents, searchQuery, allotmentGroups]);

  useEffect(() => {
    if (isOpen) {
      if (groupToEdit) {
        setFormData({
          groupName: groupToEdit.groupName || '',
          targetMonth: groupToEdit.targetMonth || targetMonth || '',
          leadsPerMonth: groupToEdit.leadsPerMonth || '',
          leadsPerDrop: groupToEdit.leadsPerDrop || '',
          refsRequired: groupToEdit.refsRequired || '',
          leadTypes: groupToEdit.leadTypes || '',
          description: groupToEdit.description || '',
          color: groupToEdit.color || '#6c757d'
        });
        
        // Load members if editing
        if (groupToEdit.id) {
          loadGroupMembers(groupToEdit.id);
        } else if (groupToEdit.members) {
          setSelectedAgents(groupToEdit.members.map(m => m.agentId));
        }
      } else {
        // Reset for new group
        setFormData({
          groupName: '',
          targetMonth: targetMonth || '',
          leadsPerMonth: '',
          leadsPerDrop: '',
          refsRequired: '',
          leadTypes: '',
          description: '',
          color: '#6c757d'
        });
        setSelectedAgents([]);
      }
      
      // Fetch agents when modal opens
      fetchAgents();
    }
  }, [isOpen, groupToEdit, targetMonth]);
  
  // Re-fetch agents when target month changes
  useEffect(() => {
    if (isOpen && formData.targetMonth) {
      fetchAgents();
    }
  }, [formData.targetMonth, isOpen]);

  const loadGroupMembers = async (groupId) => {
    try {
      const response = await api.get(`/pnp/custom-groups/${groupId}/members`);
      if (response.data.success) {
        setSelectedAgents(response.data.members.map(m => m.agent_id));
      }
    } catch (error) {
      console.error('Error loading group members:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleAgent = useCallback((agentId) => {
    setSelectedAgents(prev => 
      prev.includes(agentId)
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  }, []);
  
  const toggleAllFiltered = useCallback((filteredIds) => {
    setSelectedAgents(prev => {
      const allSelected = filteredIds.every(id => prev.includes(id));
      
      if (allSelected) {
        // Deselect all filtered
        return prev.filter(id => !filteredIds.includes(id));
      } else {
        // Select all filtered
        return [...new Set([...prev, ...filteredIds])];
      }
    });
  }, []);

  // DataTable columns
  const agentColumns = useMemo(() => [
    {
      Header: ({ data }) => {
        const filteredIds = data.map(row => row.id);
        const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedAgents.includes(id));
        return (
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => toggleAllFiltered(filteredIds)}
            style={{ cursor: 'pointer' }}
          />
        );
      },
      accessor: 'selected',
      Cell: ({ row }) => (
        <input
          type="checkbox"
          checked={selectedAgents.includes(row.original.id)}
          onChange={() => toggleAgent(row.original.id)}
          style={{ cursor: 'pointer' }}
        />
      ),
      width: 50,
      disableSortBy: true
    },
    {
      Header: 'Agent Name',
      accessor: 'lagnname',
      Cell: ({ value, row }) => (
        <span style={{ 
          color: row.original.isInactive ? '#999' : 'inherit',
          fontStyle: row.original.isInactive ? 'italic' : 'normal'
        }}>
          {value}
          {row.original.isInactive && (
            <span style={{ 
              marginLeft: '8px', 
              fontSize: '10px', 
              color: '#721c24',
              backgroundColor: '#f8d7da',
              padding: '1px 6px',
              borderRadius: '3px'
            }}>
              Inactive
            </span>
          )}
        </span>
      )
    },
    {
      Header: 'MGA',
      accessor: 'mga',
      Cell: ({ value }) => (
        <span style={{ fontSize: '13px' }}>
          {value || 'N/A'}
        </span>
      )
    },
    {
      Header: 'Current Group',
      accessor: 'currentGroup',
      Cell: ({ value, row }) => {
        if (!value || value === 'Not in allotment') {
          return <span style={{ color: '#999', fontSize: '12px' }}>—</span>;
        }
        
        const groupColors = {
          1: '#d4edda',
          2: '#d1ecf1',
          3: '#fff3cd',
          4: '#f8d7da',
          5: '#d6d8db'
        };
        
        return (
          <span style={{
            backgroundColor: groupColors[value] || '#e9ecef',
            padding: '2px 8px',
            borderRadius: '3px',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            Group {value}
          </span>
        );
      },
      width: 120
    },
    {
      Header: 'Role',
      accessor: 'clname',
      Cell: ({ value }) => (
        <span style={{
          fontSize: '11px',
          padding: '2px 6px',
          borderRadius: '3px',
          backgroundColor: '#e9ecef',
          fontWeight: '600'
        }}>
          {value}
        </span>
      ),
      width: 80
    }
  ], [selectedAgents]);

  // Row class names for styling
  const rowClassNames = useMemo(() => {
    const classNames = {};
    filteredAgents.forEach(agent => {
      if (agent.isInactive) {
        classNames[agent.id] = 'inactive-agent-row';
      }
    });
    return classNames;
  }, [filteredAgents]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.groupName || !formData.targetMonth || !formData.leadsPerMonth || !formData.leadsPerDrop) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (selectedAgents.length === 0) {
      toast.error('Please select at least one agent');
      return;
    }

    setSaving(true);

    try {
      let groupId = groupToEdit?.id;

      // Create or update group
      if (groupId) {
        await api.put(`/pnp/custom-groups/${groupId}`, formData);
        toast.success('Group updated successfully');
      } else {
        const response = await api.post('/pnp/custom-groups', formData);
        groupId = response.data.groupId;
        toast.success('Group created successfully');
      }

      // Update members
      // First, load existing members if editing
      if (groupToEdit?.id) {
        const existingResponse = await api.get(`/pnp/custom-groups/${groupId}/members`);
        const existingMemberIds = existingResponse.data.members.map(m => m.agent_id);

        // Remove members that are no longer selected
        for (const existingId of existingMemberIds) {
          if (!selectedAgents.includes(existingId)) {
            await api.delete(`/pnp/custom-groups/${groupId}/members/${existingId}`);
          }
        }

        // Add new members
        const newMemberIds = selectedAgents.filter(id => !existingMemberIds.includes(id));
        if (newMemberIds.length > 0) {
          await api.post(`/pnp/custom-groups/${groupId}/members`, { agentIds: newMemberIds });
        }
      } else {
        // New group, add all members
        await api.post(`/pnp/custom-groups/${groupId}/members`, { agentIds: selectedAgents });
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving custom group:', error);
      toast.error(error.response?.data?.message || 'Error saving custom group');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="custom-group-modal-overlay" onClick={onClose}>
      <div className="custom-group-modal" onClick={(e) => e.stopPropagation()}>
        <div className="custom-group-modal-header">
          <h3>{groupToEdit ? 'Edit Custom Group' : 'Create Custom Group'}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="custom-group-modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>Group Name *</label>
              <input
                type="text"
                name="groupName"
                value={formData.groupName}
                onChange={handleChange}
                placeholder="e.g., 200k Group"
                required
              />
            </div>

            <div className="form-group">
              <label>Target Month *</label>
              <input
                type="month"
                name="targetMonth"
                value={formData.targetMonth}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Leads Per Month *</label>
              <input
                type="number"
                name="leadsPerMonth"
                value={formData.leadsPerMonth}
                onChange={handleChange}
                placeholder="e.g., 500"
                required
              />
            </div>

            <div className="form-group">
              <label>Leads Per Drop *</label>
              <input
                type="number"
                name="leadsPerDrop"
                value={formData.leadsPerDrop}
                onChange={handleChange}
                placeholder="e.g., 250"
                required
              />
            </div>

            <div className="form-group">
              <label>Refs Required</label>
              <input
                type="number"
                name="refsRequired"
                value={formData.refsRequired}
                onChange={handleChange}
                placeholder="e.g., 6"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Lead Types</label>
            <input
              type="text"
              name="leadTypes"
              value={formData.leadTypes}
              onChange={handleChange}
              placeholder="e.g., POS / HC / Premium Leads"
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Optional description for this group"
              rows="2"
            />
          </div>

          <div className="form-group">
            <label>Color</label>
            <input
              type="color"
              name="color"
              value={formData.color}
              onChange={handleChange}
            />
          </div>

          <div className="form-group agents-selection">
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '12px'
            }}>
              <label style={{ margin: 0 }}>
                Select Agents * 
                <span style={{ 
                  marginLeft: '8px', 
                  fontWeight: 'normal', 
                  color: '#666',
                  fontSize: '12px'
                }}>
                  ({selectedAgents.length} selected)
                </span>
              </label>
              <input
                type="text"
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="agent-search"
                style={{ 
                  maxWidth: '250px',
                  margin: 0
                }}
              />
            </div>
            
            {loading ? (
              <div style={{ 
                padding: '40px', 
                textAlign: 'center', 
                color: '#666' 
              }}>
                Loading agents...
              </div>
            ) : (
              <div className="agents-table-container">
                <DataTable
                  columns={agentColumns}
                  data={filteredAgents}
                  defaultSortBy="lagnname"
                  defaultSortOrder="asc"
                  showActionBar={false}
                  rowClassNames={rowClassNames}
                  entityName="custom-group-agents"
                  customStyles={{
                    maxHeight: '400px',
                    overflow: 'auto'
                  }}
                />
              </div>
            )}
            
            {searchQuery && (
              <div style={{ 
                marginTop: '8px', 
                fontSize: '12px', 
                color: '#666',
                fontStyle: 'italic'
              }}>
                Showing {filteredAgents.length} agents
                {searchQuery && ' (including inactive if matched)'}
              </div>
            )}
          </div>

          <div className="custom-group-modal-footer">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" className="btn-save" disabled={saving}>
              {saving ? 'Saving...' : (groupToEdit ? 'Update Group' : 'Create Group')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomGroupModal;

