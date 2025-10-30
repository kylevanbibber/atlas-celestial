import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { PDFDocument } from 'pdf-lib/dist/pdf-lib.esm.js';

const ClientSigning = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const sigCanvas = useRef();
  const [clientData, setClientData] = useState(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [error, setError] = useState('');
  const [signatureProvided, setSignatureProvided] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [clientEmail, setClientEmail] = useState('');

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
      
      console.log('ClientSigning - Decoded token data:', data);
      
      // Validate required fields - only require clientName
      if (!data.clientName) {
        console.error('ClientSigning - Missing clientName in token data');
        throw new Error('Invalid token data - missing client name');
      }
      
      // agentName is not required, but log if it's missing
      if (!data.agentName) {
        console.warn('ClientSigning - agentName is empty in token data');
      }
      
      console.log('ClientSigning - Token validation successful');
      setClientData(data);
    } catch (error) {
      console.error('Token parsing error:', error);
      console.error('Token value:', token);
      setError('Invalid or expired link - unable to parse token.');
    }
  }, [token]);

  // Load, fill, and flatten the PDF once we have clientData
  useEffect(() => {
    if (!clientData) return;

    (async () => {
      try {
        // Select PDF based on document type from token
        const pdfFileName = clientData.documentType === 'ny' 
          ? '2k-ADD-NIL.pdf' 
          : 'gift-certificate-fillable.pdf';
        const pdfPath = `${window.location.origin}/pdfs/${pdfFileName}`;
        console.log('ClientSigning - Loading PDF:', pdfPath, 'Document type:', clientData.documentType);
        
        const res = await fetch(pdfPath);
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching PDF: ${pdfPath}`);
        const bytes = await res.arrayBuffer();

        const pdfDoc = await PDFDocument.load(bytes);
        const form = pdfDoc.getForm();
        const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        // Log all available form fields for debugging
        const fields = form.getFields();
        console.log(`ClientSigning - PDF loaded: ${pdfFileName}`);
        console.log(`ClientSigning - Total form fields found: ${fields.length}`);
        
        if (fields.length === 0) {
          console.warn(`⚠️ ${pdfFileName} has NO FILLABLE FORM FIELDS!`);
          console.warn('This PDF might be a static form that cannot be filled programmatically.');
          console.warn('You may need:');
          console.warn('1. A fillable version of this PDF');
          console.warn('2. To use a different PDF with form fields');
          console.warn('3. To create form fields in the PDF using Adobe Acrobat');
        } else {
          console.log('ClientSigning - Available form fields:');
          fields.forEach((field, index) => {
            const fieldName = field.getName();
            const fieldType = field.constructor.name;
            console.log(`  ${index + 1}. "${fieldName}" (${fieldType})`);
          });
        }

        // Safely set form fields with fallbacks
        const setFieldSafely = (fieldName, value) => {
          try {
            const field = form.getTextField(fieldName);
            field.setText(value || '');
          } catch (error) {
            console.warn(`Could not set field ${fieldName}:`, error);
          }
        };

        // Map clientData to PDF fields based on document type
        if (clientData.documentType === 'ny') {
          // Handle NY AD&D form
          console.log('ClientSigning - Processing NY AD&D form');
          
          if (fields.length === 0) {
            // Static PDF - use coordinate-based text overlay
            console.log('ClientSigning - Using coordinate-based text overlay for static PDF');
            const [page] = pdfDoc.getPages();
            const { width, height } = page.getSize();
            
            // You'll need to adjust these coordinates based on your PDF layout
            const fontSize = 10;
            page.drawText(clientData.clientName || '', { x: 150, y: height - 120, size: fontSize });
            page.drawText(clientData.dateOfBirth || '', { x: 150, y: height - 140, size: fontSize });
            page.drawText(clientData.address || '', { x: 150, y: height - 160, size: fontSize });
            page.drawText(clientData.city || '', { x: 150, y: height - 180, size: fontSize });
            page.drawText(clientData.state || '', { x: 300, y: height - 180, size: fontSize });
            page.drawText(clientData.zip || '', { x: 350, y: height - 180, size: fontSize });
            page.drawText(clientData.phoneNumber || '', { x: 150, y: height - 200, size: fontSize });
            page.drawText(clientData.beneficiary || '', { x: 150, y: height - 220, size: fontSize });
            page.drawText(clientData.relationshipToInsured || '', { x: 150, y: height - 240, size: fontSize });
            page.drawText(clientData.agentName || '', { x: 150, y: height - 260, size: fontSize });
            page.drawText(today || '', { x: 150, y: height - 280, size: fontSize });
            
            console.log('ClientSigning - Text overlayed on static PDF');
          } else {
            // Fillable PDF - use form fields with actual field names
            console.log('ClientSigning - Using form fields for fillable 2k-ADD-NIL.pdf');
            
            // Map client data to actual PDF field names
            setFieldSafely('name1', clientData.clientName);        // Primary name field
            setFieldSafely('name', clientData.clientName);         // Secondary name field
            setFieldSafely('dob1', clientData.dateOfBirth);        // Primary DOB field  
            setFieldSafely('dob', clientData.dateOfBirth);         // Secondary DOB field
            setFieldSafely('street', clientData.address);          // Street address
            setFieldSafely('city', clientData.city);               // City
            setFieldSafely('state', clientData.state);             // State
            setFieldSafely('zip', clientData.zip);                 // Zip code
            setFieldSafely('phone', clientData.phoneNumber);       // Phone number
            setFieldSafely('ben', clientData.beneficiary);         // Beneficiary name
            setFieldSafely('relation', clientData.relationshipToInsured); // Relationship
            setFieldSafely('spon_name', clientData.agentName);     // Sponsor/Agent name
            setFieldSafely('agent', clientData.agentName);         // Agent field
            setFieldSafely('sig_sponsor', clientData.agentName);   // Sponsor signature field
            setFieldSafely('sig_agent', clientData.agentName);     // Agent signature field
            setFieldSafely('date_delivered', today);               // Date delivered
            setFieldSafely('agency', 'Arias Organization');        // Agency name
            setFieldSafely('agency_phone', '412-235-2385');        // Agency phone
            setFieldSafely('relation_to_insured', 'Agent');        // Agent relationship
            
            console.log('ClientSigning - All fields mapped for 2k-ADD-NIL.pdf');
          }
        } else {
          // Field mapping for gift certificate form (default)
          console.log('ClientSigning - Filling gift certificate form fields');
          setFieldSafely('arne', clientData.clientName);
          setFieldSafely('Insureds Name', clientData.clientName);
          setFieldSafely('Date of Birth', clientData.dateOfBirth);
          setFieldSafely('lnsureds Date of Birth', clientData.dateOfBirth);
          setFieldSafely('Street Address', clientData.address);
          setFieldSafely('City', clientData.city);
          setFieldSafely('State', clientData.state);
          setFieldSafely('Zip', clientData.zip);
          setFieldSafely('Phone', clientData.phoneNumber);
          setFieldSafely('Beneficiary', clientData.beneficiary);
          setFieldSafely('Relationship to Insured_2', clientData.relationshipToInsured);
          setFieldSafely('Relationship to Insured', 'Agent');
          setFieldSafely('Agency', 'Arias Organization');
          setFieldSafely('Agency Phone', '412-235-2385');
          setFieldSafely('Agent', clientData.agentName);
          setFieldSafely('Sponsors Name', clientData.agentName);
          setFieldSafely('Text1', clientData.agentName);
          setFieldSafely('Text2', clientData.agentName);
          setFieldSafely('Date Certificate Delivered', today);
        }

        form.flatten();

        const filledBytes = await pdfDoc.save();
        const blob = new Blob([filledBytes], { type: 'application/pdf' });
        setPdfUrl(URL.createObjectURL(blob));
      } catch (err) {
        console.error('PDF processing error:', err);
        setError('Failed to load or fill document.');
      }
    })();
  }, [clientData]);

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

      page.drawImage(sigImage, {
        x: page.getWidth() - width - 170 - 200, // Move left by 200px
        y: -10 + 75, // Move up by 75px
        width,
        height,
      });

      const finalBytes = await pdfDoc.save();
      const formData = new FormData();
      const pdfBlob = new Blob([finalBytes], { type: 'application/pdf' });
      formData.append('file', pdfBlob, 'signed-document.pdf');
      formData.append('token', token);
      if (clientEmail) {
        formData.append('clientEmail', clientEmail);
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
          <p>Your signed document has been sent to the home office.</p>
          <p>Thank you for completing the signing process.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.header}>
          <h1>{clientData?.documentType === 'ny' ? '2K ADD NIL Certificate' : 'AD&D Gift Certificate'}</h1>
          <p>Please review the document and sign below</p>
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
              <label htmlFor="clientEmail">
                <strong>Email (optional)</strong><br/>
                <small>Receive a copy of your signed document</small>
              </label>
              <input
                type="email"
                id="clientEmail"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
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

export default ClientSigning; 