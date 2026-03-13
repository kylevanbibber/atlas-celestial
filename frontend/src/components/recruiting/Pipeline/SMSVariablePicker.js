import React, { useState, useEffect } from 'react';
import api from '../../../api';
import toast from 'react-hot-toast';
import { FiX, FiSearch } from 'react-icons/fi';
import './PipelineSettings.css';

const SMSVariablePicker = ({ onInsert, onClose }) => {
  const [variables, setVariables] = useState({});
  const [checklistVariables, setChecklistVariables] = useState([]);
  const [stateReqVariables, setStateReqVariables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('recruit');

  useEffect(() => {
    fetchVariables();
  }, []);

  const fetchVariables = async () => {
    try {
      setLoading(true);
      
      // Fetch all variable types
      const [varsResponse, checklistResponse, stateReqResponse] = await Promise.all([
        api.get('/sms-template-variables/variables'),
        api.get('/sms-template-variables/checklist-variables'),
        api.get('/sms-template-variables/state-requirement-variables')
      ]);

      if (varsResponse.data.success) {
        setVariables(varsResponse.data.variables);
      }
      
      if (checklistResponse.data.success) {
        setChecklistVariables(checklistResponse.data.variables);
      }
      
      if (stateReqResponse.data.success) {
        setStateReqVariables(stateReqResponse.data.variables);
      }
    } catch (error) {
      console.error('Error fetching variables:', error);
      toast.error('Failed to load variables');
    } finally {
      setLoading(false);
    }
  };

  const handleInsertVariable = (variableKey) => {
    onInsert(`{{${variableKey}}}`);
    toast.success('Variable inserted');
  };

  const filterVariables = (vars) => {
    if (!searchTerm) return vars;
    const term = searchTerm.toLowerCase();
    return vars.filter(v => 
      v.label.toLowerCase().includes(term) || 
      v.key.toLowerCase().includes(term)
    );
  };

  const renderVariableList = (vars, category) => {
    const filtered = filterVariables(vars);
    
    if (filtered.length === 0) {
      return <p style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>No variables found</p>;
    }

    return (
      <div className="variable-list">
        {filtered.map((variable) => (
          <div
            key={variable.key}
            className="variable-item"
            onClick={() => handleInsertVariable(variable.key)}
          >
            <div className="variable-info">
              <div className="variable-label">{variable.label}</div>
              <div className="variable-key">{'{{' + variable.key + '}}'}</div>
              {variable.example && (
                <div className="variable-example">Example: {variable.example}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const tabs = [
    { id: 'recruit', label: 'Recruit Info' },
    { id: 'dates', label: 'Dates' },
    { id: 'licensing', label: 'Licensing' },
    { id: 'onboarding', label: 'Onboarding' },
    { id: 'compliance', label: 'Compliance' },
    { id: 'profile', label: 'Profile' },
    { id: 'agent', label: 'Agent' },
    { id: 'checklist', label: 'Checklist Items' },
    { id: 'state_req', label: 'State Requirements' },
    { id: 'system', label: 'System' }
  ];

  return (
    <div className="variable-picker-overlay" onClick={onClose}>
      <div className="variable-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="variable-picker-header">
          <h3>Insert Variable</h3>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="variable-picker-search">
          <FiSearch />
          <input
            type="text"
            placeholder="Search variables..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="variable-picker-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`variable-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="variable-picker-content">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <p>Loading variables...</p>
            </div>
          ) : (
            <>
              {activeTab === 'checklist' && renderVariableList(checklistVariables, 'checklist')}
              {activeTab === 'state_req' && renderVariableList(stateReqVariables, 'state_req')}
              {variables[activeTab] && renderVariableList(variables[activeTab], activeTab)}
            </>
          )}
        </div>

        <div className="variable-picker-footer">
          <p className="variable-hint">
            Click on a variable to insert it into your template. Variables will be replaced with actual data when sending messages.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SMSVariablePicker;

