import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { PDFDocument } from 'pdf-lib/dist/pdf-lib.esm.js';

const AgentSigning = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const sigCanvas = useRef();
  const [agentData, setAgentData] = useState(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [error, setError] = useState('');
  const [signatureProvided, setSignatureProvided] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [agentEmail, setAgentEmail] = useState('');

  // Decode token payload
  useEffect(() => {
    if (!token) {
      setError('Invalid or expired link - no token provided.');
      return;
    }

    try {
      // Add padding if needed for base64 decoding
      let decodedToken = token.replace(/-/g, '+').replace(/_/g, '/');
      while (decodedToken.length % 4) {
        decodedToken += '=';
      }
      
      const json = atob(decodedToken);
      const data = JSON.parse(json);
      
      console.log('AgentSigning - Decoded token data:', data);
      
      // Validate required fields - require agentName and agentID
      if (!data.agentName) {
        console.error('AgentSigning - Missing agentName in token data');
        throw new Error('Invalid token data - missing agent name');
      }
      
      if (!data.agentID) {
        console.error('AgentSigning - Missing agentID in token data');
        throw new Error('Invalid token data - missing agent ID');
      }
      
      console.log('AgentSigning - Token validation successful');
      setAgentData(data);
      
      // Pre-fill agent email if available
      if (data.email) {
        setAgentEmail(data.email);
      }
    } catch (error) {
      console.error('Token parsing error:', error);
      console.error('Token value:', token);
      setError('Invalid or expired link - unable to parse token.');
    }
  }, [token]);

  // Load, fill, and flatten the PDF once we have agentData
  useEffect(() => {
    if (!agentData) return;

    (async () => {
      try {
        const pdfPath = `${window.location.origin}/pdfs/agent-pages.pdf`;
        const res = await fetch(pdfPath);
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching PDF`);
        const bytes = await res.arrayBuffer();

        const pdfDoc = await PDFDocument.load(bytes);
        const form = pdfDoc.getForm();
        const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        // Safely set form fields with fallbacks
        const setFieldSafely = (fieldName, value) => {
          try {
            const field = form.getTextField(fieldName);
            field.setText(value || '');
          } catch (error) {
            console.warn(`Could not set field ${fieldName}:`, error);
          }
        };

        // Map agentData to PDF fields - these field names may need to be adjusted based on actual PDF
        setFieldSafely('Agent Name', agentData.agentName);
        setFieldSafely('AgentName', agentData.agentName);
        setFieldSafely('Name', agentData.agentName);
        setFieldSafely('Agent ID', agentData.agentID);
        setFieldSafely('AgentID', agentData.agentID);
        setFieldSafely('ID', agentData.agentID);
        setFieldSafely('Date of Birth', agentData.dateOfBirth);
        setFieldSafely('DOB', agentData.dateOfBirth);
        setFieldSafely('Address', agentData.address);
        setFieldSafely('Street Address', agentData.address);
        setFieldSafely('City', agentData.city);
        setFieldSafely('State', agentData.state);
        setFieldSafely('Zip', agentData.zip);
        setFieldSafely('Zip Code', agentData.zip);
        setFieldSafely('Phone', agentData.phoneNumber);
        setFieldSafely('Phone Number', agentData.phoneNumber);
        setFieldSafely('Email', agentData.email);
        setFieldSafely('Email Address', agentData.email);
        setFieldSafely('SSN', agentData.socialSecurityNumber);
        setFieldSafely('Social Security Number', agentData.socialSecurityNumber);
        setFieldSafely('Emergency Contact', agentData.emergencyContactName);
        setFieldSafely('Emergency Contact Name', agentData.emergencyContactName);
        setFieldSafely('Emergency Phone', agentData.emergencyContactPhone);
        setFieldSafely('Emergency Contact Phone', agentData.emergencyContactPhone);
        setFieldSafely('Start Date', agentData.startDate);
        setFieldSafely('Manager', agentData.managerName);
        setFieldSafely('Manager Name', agentData.managerName);
        setFieldSafely('Supervisor', agentData.managerName);
        setFieldSafely('Date', today);
        setFieldSafely('Current Date', today);
        setFieldSafely('Today', today);

        form.flatten();

        const filledBytes = await pdfDoc.save();
        const blob = new Blob([filledBytes], { type: 'application/pdf' });
        setPdfUrl(URL.createObjectURL(blob));
      } catch (err) {
        console.error('PDF processing error:', err);
        setError('Failed to load or fill document.');
      }
    })();
  }, [agentData]);

  // Clear signature
  const clearSignature = () => {
    sigCanvas.current.clear();
    setSignatureProvided(false);
  };

  // Overlay signature and POST
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!signatureProvided) {
      setError('Please sign first.');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const filledBytes = await fetch(pdfUrl).then(r => r.arrayBuffer());
      const pdfDoc = await PDFDocument.load(filledBytes);
      const [page] = pdfDoc.getPages();
      const pngData = sigCanvas.current.toDataURL();
      const sigImage = await pdfDoc.embedPng(pngData);
      const { width, height } = sigImage.scale(0.35);

      // Position signature - may need adjustment based on PDF layout
      page.drawImage(sigImage, {
        x: page.getWidth() - width - 170 - 200, // Move left by 200px from right
        y: -10 + 75, // Move up by 75px from bottom
        width,
        height,
      });

      const finalBytes = await pdfDoc.save();
      const formData = new FormData();
      const pdfBlob = new Blob([finalBytes], { type: 'application/pdf' });
      formData.append('file', pdfBlob, 'signed-agent-document.pdf');
      formData.append('token', token);
      formData.append('documentType', 'agent');
      if (agentEmail) {
        formData.append('agentEmail', agentEmail);
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/signing-session/sign`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        setSubmitted(true);
      } else {
        throw new Error(result.message || 'Failed to send document');
      }
    } catch (err) {
      console.error('Error submitting document:', err);
      setError('Submission failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#f8f9fa',
      padding: '2rem 1rem'
    },
    content: {
      maxWidth: '1200px',
      margin: '0 auto',
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      overflow: 'hidden'
    },
    header: {
      backgroundColor: '#007bff',
      color: 'white',
      padding: '2rem',
      textAlign: 'center'
    },
    signingContainer: {
      display: 'flex',
      flexDirection: 'row',
      gap: '2rem',
      padding: '2rem'
    },
    documentPreview: {
      flex: 2,
      minHeight: '600px'
    },
    signatureSection: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem'
    },
    signaturePadContainer: {
      border: '2px solid #ddd',
      borderRadius: '8px',
      padding: '1rem',
      backgroundColor: '#f8f9fa'
    },
    signatureCanvas: {
      border: '1px solid #ccc',
      borderRadius: '4px',
      width: '100%',
      backgroundColor: 'white'
    },
    buttonGroup: {
      display: 'flex',
      gap: '1rem',
      marginTop: '1rem'
    },
    button: {
      padding: '0.75rem 1.5rem',
      border: 'none',
      borderRadius: '4px',
      fontSize: '1rem',
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    clearButton: {
      backgroundColor: '#6c757d',
      color: 'white'
    },
    submitButton: {
      backgroundColor: '#28a745',
      color: 'white',
      flex: 1
    },
    submitButtonDisabled: {
      backgroundColor: '#ccc',
      color: '#666',
      cursor: 'not-allowed'
    },
    emailInput: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem'
    },
    input: {
      padding: '0.75rem',
      border: '1px solid #ddd',
      borderRadius: '4px',
      fontSize: '1rem'
    },
    errorMessage: {
      backgroundColor: '#f8d7da',
      color: '#721c24',
      padding: '2rem',
      textAlign: 'center',
      border: '1px solid #f5c6cb',
      borderRadius: '4px',
      margin: '2rem'
    },
    successContainer: {
      backgroundColor: '#d4edda',
      color: '#155724',
      padding: '4rem 2rem',
      textAlign: 'center',
      border: '1px solid #c3e6cb'
    },
    loading: {
      padding: '4rem 2rem',
      textAlign: 'center',
      fontSize: '1.2rem',
      color: '#666'
    }
  };

  if (error) return (
    <div style={styles.container}>
      <div style={styles.errorMessage}>
        <h2>Error</h2>
        <p>{error}</p>
        <button 
          onClick={() => window.location.href = '/'} 
          style={{...styles.button, backgroundColor: '#007bff', color: 'white', marginTop: '1rem'}}
        >
          Go to Home
        </button>
      </div>
    </div>
  );
  
  if (!pdfUrl) return (
    <div style={styles.container}>
      <div style={styles.loading}>Loading document…</div>
    </div>
  );
  
  if (submitted) return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.successContainer}>
          <h2>Document Successfully Signed!</h2>
          <p>Your signed agent documentation has been sent to the home office.</p>
          <p>Thank you for completing the signing process.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.header}>
          <h1>Agent Documentation</h1>
          <p>Please review the document and sign below</p>
          {agentData && (
            <div style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
              <p>Agent: <strong>{agentData.agentName}</strong></p>
              {agentData.agentID && <p>ID: <strong>{agentData.agentID}</strong></p>}
            </div>
          )}
        </div>
        
        <div style={styles.signingContainer}>
          <div style={styles.documentPreview}>
            <h3>Review Document</h3>
            <iframe 
              src={pdfUrl} 
              title="PDF Preview" 
              width="100%" 
              height="600px"
              style={{ border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
          
          <div style={styles.signatureSection}>
            <h3>Sign Below</h3>
            <div style={styles.signaturePadContainer}>
              <SignatureCanvas
                ref={sigCanvas}
                canvasProps={{
                  width: 400,
                  height: 200,
                  className: 'signature-canvas',
                  style: styles.signatureCanvas
                }}
                onEnd={() => setSignatureProvided(true)}
              />
            </div>
            
            <div style={styles.emailInput}>
              <label htmlFor="agentEmail">
                <strong>Email (optional)</strong><br/>
                <small>Receive a copy of your signed document</small>
              </label>
              <input
                type="email"
                id="agentEmail"
                value={agentEmail}
                onChange={(e) => setAgentEmail(e.target.value)}
                placeholder="Enter your email address"
                style={styles.input}
              />
            </div>
            
            <div style={styles.buttonGroup}>
              <button 
                onClick={clearSignature} 
                style={{...styles.button, ...styles.clearButton}}
              >
                Clear
              </button>
              <button 
                onClick={handleSubmit} 
                disabled={!signatureProvided || submitting} 
                style={{
                  ...styles.button,
                  ...styles.submitButton,
                  ...(!signatureProvided || submitting ? styles.submitButtonDisabled : {})
                }}
              >
                {submitting ? 'Submitting…' : 'Submit Signature'}
              </button>
            </div>
            
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentSigning;
