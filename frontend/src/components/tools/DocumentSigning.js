import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const DocumentSigning = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    clientName: '',
    dateOfBirthMonth: '',
    dateOfBirthDay: '',
    dateOfBirthYear: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    phoneAreaCode: '',
    phonePrefix: '',
    phoneLineNumber: '',
    beneficiary: '',
    relationshipToInsured: ''
  });

  const [generatedUrl, setGeneratedUrl] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Date dropdown data
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1).padStart(2, '0'),
    label: new Date(2000, i, 1).toLocaleString('default', { month: 'long' })
  }));
  const days = Array.from({ length: 31 }, (_, i) => ({
    value: String(i + 1).padStart(2, '0'),
    label: String(i + 1)
  }));
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => ({
    value: String(currentYear - i),
    label: String(currentYear - i)
  }));

  const handlePhoneNumberChange = (e, part) => {
    const value = e.target.value.replace(/\D/g, '');
    const maxLen = part === 'areaCode' || part === 'prefix' ? 3 : 4;
    if (value.length <= maxLen) {
      setFormData(prev => ({
        ...prev,
        [`phone${part.charAt(0).toUpperCase() + part.slice(1)}`]: value
      }));
    }
    // auto-tab
    if (value.length === maxLen) {
      e.target.nextElementSibling?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      // Debug: Log user object to see available properties
      console.log('DocumentSigning - User object:', user);
      
      // Get agent information from user context with better fallbacks
      const agentName = user?.firstName && user?.lastName ? 
        `${user.firstName} ${user.lastName}` : 
        user?.firstName || 
        user?.screen_name || 
        user?.username ||
        user?.name ||
        'Agent Name'; // Final fallback
      const agentEmail = user?.email || '';

      console.log('DocumentSigning - Agent info:', { agentName, agentEmail });

      const signingData = {
        clientName: formData.clientName,
        dateOfBirth: `${formData.dateOfBirthYear}-${formData.dateOfBirthMonth}-${formData.dateOfBirthDay}`,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip: formData.zip,
        phoneNumber: `${formData.phoneAreaCode}${formData.phonePrefix}${formData.phoneLineNumber}`,
        beneficiary: formData.beneficiary,
        relationshipToInsured: formData.relationshipToInsured,
        agentEmail: agentEmail,
        agentName: agentName,
        issuedAt: new Date().toISOString()
      };

      console.log('DocumentSigning - Token data:', signingData);

      // base64-URL-safe encode
      const token = btoa(JSON.stringify(signingData))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const url = `${window.location.origin}/client-sign/${token}`;
      setGeneratedUrl(url);
      setSuccess('Signing URL generated!');
    } catch {
      setError('Failed to generate URL.');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '2rem', color: '#333' }}>AD&D Gift Certificate</h2>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Client Name */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="clientName" style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Client Name *
          </label>
          <input
            id="clientName"
            type="text"
            value={formData.clientName}
            onChange={e => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
            required
            style={{
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          />
        </div>

        {/* Date of Birth */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>Date of Birth *</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select
              value={formData.dateOfBirthMonth}
              onChange={e => setFormData(prev => ({ ...prev, dateOfBirthMonth: e.target.value }))}
              required
              style={{
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem',
                flex: 1
              }}
            >
              <option value="">Month</option>
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select
              value={formData.dateOfBirthDay}
              onChange={e => setFormData(prev => ({ ...prev, dateOfBirthDay: e.target.value }))}
              required
              style={{
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem',
                flex: 1
              }}
            >
              <option value="">Day</option>
              {days.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
            <select
              value={formData.dateOfBirthYear}
              onChange={e => setFormData(prev => ({ ...prev, dateOfBirthYear: e.target.value }))}
              required
              style={{
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem',
                flex: 1
              }}
            >
              <option value="">Year</option>
              {years.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
            </select>
          </div>
        </div>

        {/* Address */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="address" style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Street Address *
          </label>
          <input
            id="address"
            type="text"
            value={formData.address}
            onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
            required
            style={{
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          />
        </div>

        {/* City, State, Zip */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 2 }}>
            <label htmlFor="city" style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>
              City *
            </label>
            <input
              id="city"
              type="text"
              value={formData.city}
              onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))}
              required
              style={{
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <label htmlFor="state" style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>
              State *
            </label>
            <input
              id="state"
              type="text"
              value={formData.state}
              onChange={e => setFormData(prev => ({ ...prev, state: e.target.value }))}
              required
              maxLength={2}
              style={{
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <label htmlFor="zip" style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Zip Code *
            </label>
            <input
              id="zip"
              type="text"
              value={formData.zip}
              onChange={e => setFormData(prev => ({ ...prev, zip: e.target.value.replace(/\D/g, '') }))}
              maxLength={10}
              required
              style={{
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            />
          </div>
        </div>

        {/* Phone Number */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>Phone Number *</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              placeholder="Area Code"
              maxLength={3}
              value={formData.phoneAreaCode}
              onChange={e => handlePhoneNumberChange(e, 'areaCode')}
              required
              style={{
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem',
                flex: 1
              }}
            />
            <input
              placeholder="Prefix"
              maxLength={3}
              value={formData.phonePrefix}
              onChange={e => handlePhoneNumberChange(e, 'prefix')}
              required
              style={{
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem',
                flex: 1
              }}
            />
            <input
              placeholder="Line Number"
              maxLength={4}
              value={formData.phoneLineNumber}
              onChange={e => handlePhoneNumberChange(e, 'lineNumber')}
              required
              style={{
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem',
                flex: 1
              }}
            />
          </div>
        </div>

        {/* Beneficiary */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="beneficiary" style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Beneficiary *
          </label>
          <input
            id="beneficiary"
            type="text"
            value={formData.beneficiary}
            onChange={e => setFormData(prev => ({ ...prev, beneficiary: e.target.value }))}
            required
            style={{
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          />
        </div>

        {/* Relationship to Insured */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="relationshipToInsured" style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Relationship to Insured *
          </label>
          <input
            id="relationshipToInsured"
            type="text"
            value={formData.relationshipToInsured}
            onChange={e => setFormData(prev => ({ ...prev, relationshipToInsured: e.target.value }))}
            required
            style={{
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          />
        </div>

        <button 
          type="submit" 
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            padding: '1rem 2rem',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1rem',
            cursor: 'pointer',
            marginTop: '1rem'
          }}
        >
          Generate Signing URL
        </button>
      </form>

      {error && (
        <div style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '1rem',
          borderRadius: '4px',
          marginTop: '1rem',
          border: '1px solid #f5c6cb'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          backgroundColor: '#d4edda',
          color: '#155724',
          padding: '1rem',
          borderRadius: '4px',
          marginTop: '1rem',
          border: '1px solid #c3e6cb'
        }}>
          {success}
        </div>
      )}

      {generatedUrl && (
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '1.5rem',
          borderRadius: '4px',
          marginTop: '1rem',
          border: '1px solid #dee2e6'
        }}>
          <h4 style={{ marginBottom: '1rem', color: '#333' }}>Copy & send this link to your client:</h4>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              readOnly 
              value={generatedUrl} 
              style={{ 
                flex: 1, 
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '0.9rem',
                backgroundColor: '#fff'
              }} 
            />
            <button 
              onClick={() => navigator.clipboard.writeText(generatedUrl)}
              style={{
                backgroundColor: '#28a745',
                color: 'white',
                padding: '0.75rem 1.5rem',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentSigning; 