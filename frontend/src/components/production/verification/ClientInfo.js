import React, { useState, useEffect, useRef, useContext } from 'react';
import { AuthContext } from '../../../context/AuthContext';
import ClientEmailInput from './ClientEmailInput';
import api from '../../../api';
import './ClientInfo.css';

const ClientInfo = ({ setClientInfo, setAgentInfo, setSelectedAgentId }) => {
  const [agentName, setAgentName] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentInfoLoaded, setAgentInfoLoaded] = useState(false);
  const [allAgents, setAllAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [clientEmail, setClientEmail] = useState({ handle: '', website: '', domain: 'com' });
  const [clientName, setClientName] = useState('');
  
  const { user } = useContext(AuthContext);
  const userRole = user?.Role;

  const areaCodeRef = useRef(null);
  const prefixRef = useRef(null);
  const lineNumberRef = useRef(null);

  const [phoneNumber, setPhoneNumber] = useState({
    areaCode: '',
    prefix: '',
    lineNumber: ''
  });

  // Update parent state when agent info changes
  useEffect(() => {
    setAgentInfo({
      agentName: agentName,
      agentEmail: agentEmail,
    });
  }, [agentName, agentEmail, setAgentInfo]);

  useEffect(() => {
    setClientInfo((prev) => ({
      ...prev,
      name: clientName,
      email: clientEmail,
      phoneNumber: phoneNumber,
    }));
  }, [clientName, clientEmail, phoneNumber, setClientInfo]);

  const fetchAgentInfo = async (userId) => {
    try {
      // Note: userId is automatically added by AuthContext interceptor, but we can still include it explicitly
      const response = await api.post('/verify/searchByUserId', { userId });
      const data = response.data;
  
      if (data.success && data.data && data.data.length > 0) {
        const agentData = data.data;
        const defaultAgent = data.agnName;
        
        setAgentName(defaultAgent);
        const defaultAgentInfo = agentData.find(agent => agent.lagnname === defaultAgent) || {};
        setAgentEmail(defaultAgentInfo.email || '');
        setSelectedAgentId(defaultAgentInfo.id);
  
        setAllAgents(agentData);
        setSelectedAgent(defaultAgent);
      } else {
        console.error('Agent info not found or invalid data format');
      }
      setAgentInfoLoaded(true);
    } catch (error) {
      console.error('Error fetching agent info:', error);
      setAgentInfoLoaded(true);
    }
  };

  useEffect(() => {
    if (user?.userId) {
      fetchAgentInfo(user.userId);
    } else {
      console.error('User ID not found');
      setAgentInfoLoaded(true);
    }
  }, [user]);

  const handleAgentChange = (e) => {
    const selected = e.target.value;
    setSelectedAgent(selected);
  
    const selectedAgentInfo = allAgents.find(agent => agent.lagnname === selected) || {};
    setAgentName(selectedAgentInfo.lagnname || '');
    setAgentEmail(selectedAgentInfo.email || '');
    setSelectedAgentId(selectedAgentInfo.id);
  };
  
  const handlePhoneNumberChange = (e, field, nextRef, prevRef) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= e.target.maxLength) {
      setPhoneNumber(prev => ({ ...prev, [field]: value }));
    }

    if (value.length === e.target.maxLength && nextRef) {
      nextRef.current.focus();
    }

    if (e.key === 'Backspace' && value.length === 0 && prevRef) {
      prevRef.current.focus();
    }
  };

  return (
    <div className="client-info-group">
      <h4>Client Information</h4>
      <div className="input-row">
        <div className="input-group">
          <label htmlFor="client_name">Name on Application Package</label>
          <input
            className="client-name-input"
            type="text"
            id="client_name"
            name="client_name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            autoComplete="off"
            required
          />
        </div>
        <div className="input-group">
          <label htmlFor="phone-number">Client Phone Number</label>
          <div className="phone-number-container">
            <input
              type="text"
              id="area-code"
              ref={areaCodeRef}
              maxLength="3"
              required
              autoComplete="off"
              value={phoneNumber.areaCode}
              onChange={(e) => handlePhoneNumberChange(e, 'areaCode', prefixRef)}
              onKeyDown={(e) => handlePhoneNumberChange(e, 'areaCode', prefixRef)}
            />
            <input
              type="text"
              id="prefix"
              ref={prefixRef}
              maxLength="3"
              required
              autoComplete="off"
              value={phoneNumber.prefix}
              onChange={(e) => handlePhoneNumberChange(e, 'prefix', lineNumberRef, areaCodeRef)}
              onKeyDown={(e) => handlePhoneNumberChange(e, 'prefix', lineNumberRef, areaCodeRef)}
            />
            <input
              type="text"
              id="line-number"
              ref={lineNumberRef}
              maxLength="4"
              required
              autoComplete="off"
              value={phoneNumber.lineNumber}
              onChange={(e) => handlePhoneNumberChange(e, 'lineNumber', null, prefixRef)}
              onKeyDown={(e) => handlePhoneNumberChange(e, 'lineNumber', null, prefixRef)}
            />
          </div>
        </div>
      </div>

      <ClientEmailInput
        emailHandle={clientEmail.handle}
        emailWebsite={clientEmail.website}
        emailDomain={clientEmail.domain}
        setClientEmail={setClientEmail}
      />

      {agentInfoLoaded && (
        <div className="agent-info-group">
          <hr />
          <h4>Agent Information</h4>

          <div className="input-row">
            <div className="input-group">
              <label htmlFor="agent_name">Agent Name</label>
              <select
                id="agent_name"
                value={selectedAgent}
                onChange={handleAgentChange}
                className="agent-select"
              >
                {allAgents.map((agent, index) => (
                  <option key={index} value={agent.lagnname}>
                    {agent.lagnname}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label htmlFor="agent_email">Agent Email</label>
              <input
                type="email"
                id="agent_email"
                name="agent_email"
                value={agentEmail}
                onChange={(e) => setAgentEmail(e.target.value)}
                className="agent-input"
              />
            </div>
          </div>
        </div>
      )}

      {!agentInfoLoaded && <p>Loading agent information...</p>}
    </div>
  );
};

export default ClientInfo; 