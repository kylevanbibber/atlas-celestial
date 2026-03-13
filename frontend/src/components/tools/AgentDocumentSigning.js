import React, { useState, useEffect, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { PDFDocument } from 'pdf-lib/dist/pdf-lib.esm.js';

const AgentDocumentSigning = () => {
  const sigCanvas = useRef();
  
  // PDF and document state
  const [pdfUrl, setPdfUrl] = useState('');
  const [basePdfUrl, setBasePdfUrl] = useState('');
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPdfBytes, setCurrentPdfBytes] = useState(null);
  const [error, setError] = useState('');
  const [pdfLoading, setPdfLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Wizard state
  const [hasStarted, setHasStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [fieldValues, setFieldValues] = useState({});
  const [signatureProvided, setSignatureProvided] = useState(false);
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  // Define the field mapping in correct document order based on actual PDF structure
  const fieldMapping = [
    // Page 2 - Initial field
    { name: 'inital_1', label: 'Your Initials', type: 'initials', required: true, page: 2 },
    
    // Page 5 - First signature 
    { name: 'signature', label: 'Your Signature', type: 'signature', required: true, page: 5 },
    
    // Page 7 - Second signature and printed name
    { name: 'signature 2', label: 'Your Signature', type: 'signature', required: true, page: 7 },
    { name: 'printed_name', label: 'Printed Name', type: 'text', required: true, page: 7 },
    
    // Page 8 - Third signature
    { name: 'signature_3', label: 'Your Signature', type: 'signature', required: true, page: 8 },
    
    // Page 9 - Agent information, contacts, and signatures
    { name: 'agent_name', label: 'Agent Name', type: 'text', required: true, page: 9 },
    { name: 'agent_phone', label: 'Agent Phone Number', type: 'tel', required: true, page: 9 },
    { name: 'agent_address', label: 'Agent Address', type: 'text', required: true, page: 9 },
    { name: 'name_1', label: 'Emergency Contact 1 - Name', type: 'text', required: true, page: 9 },
    { name: 'phone_1', label: 'Emergency Contact 1 - Phone', type: 'tel', required: true, page: 9 },
    { name: 'relation_1', label: 'Emergency Contact 1 - Relationship', type: 'text', required: true, page: 9 },
    { name: 'name_2', label: 'Emergency Contact 2 - Name', type: 'text', required: false, page: 9 },
    { name: 'phone_2', label: 'Emergency Contact 2 - Phone', type: 'tel', required: false, page: 9 },
    { name: 'relation_2', label: 'Emergency Contact 2 - Relationship', type: 'text', required: false, page: 9 },
    { name: 'signature_4', label: 'Your Signature', type: 'signature', required: true, page: 9 },
    { name: 'initials_2', label: 'Your Initials', type: 'initials', required: true, page: 9 },
    
    // Page 10 - Final information and signatures
    { name: 'agent_1', label: 'Agent Information (Additional)', type: 'text', required: false, page: 10 },
    { name: 'signature_5', label: 'Your Final Signature', type: 'signature', required: true, page: 10 },
    
    // Email for document copy
    { name: 'recruit_email', label: 'Your Email Address (to receive document copy)', type: 'email', required: true, page: 10 },
  ];

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load PDF on mount
  useEffect(() => {
    const loadPDF = async () => {
      try {
        setPdfLoading(true);
        const pdfPath = `${window.location.origin}/pdfs/agent-pages.pdf`;
        const res = await fetch(pdfPath);
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching PDF`);
        const bytes = await res.arrayBuffer();

        const loadedPdfDoc = await PDFDocument.load(bytes);
        setPdfDoc(loadedPdfDoc);
        setCurrentPdfBytes(bytes);

        // Create initial blob URL - start at page 1 with fit to width for reading
        const initialBlob = new Blob([bytes], { type: 'application/pdf' });
        const initialBaseUrl = URL.createObjectURL(initialBlob);
        setBasePdfUrl(initialBaseUrl);
        setPdfUrl(`${initialBaseUrl}#page=1&view=FitH`);
        
      } catch (err) {
        console.error('PDF loading error:', err);
        setError('Failed to load PDF document.');
      } finally {
        setPdfLoading(false);
      }
    };

    loadPDF();
  }, []);

  // Pre-fill date fields with today's date
  useEffect(() => {
    const initialValues = {
      date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD format
      date_2: new Date().toLocaleDateString('en-CA'),
      date_3: new Date().toLocaleDateString('en-CA'),
      date_4: new Date().toLocaleDateString('en-CA'),
    };
    
    setFieldValues(initialValues);
  }, []);

  // Update PDF whenever field values change
  useEffect(() => {
    if (currentPdfBytes && Object.keys(fieldValues).length > 0) {
      updatePdfDisplay(currentPdfBytes, fieldValues);
    }
  }, [fieldValues, currentPdfBytes]);

  const updatePdfDisplay = async (pdfBytes, values) => {
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const form = pdfDoc.getForm();

      // Process signature fields first to embed images
      const signaturePromises = [];
      
      Object.entries(values).forEach(([fieldName, value]) => {
        if (value) {
          const fieldConfig = fieldMapping.find(f => f.name === fieldName);
          
          if (fieldConfig?.type === 'signature' && value.startsWith('data:image')) {
            // Handle signature image embedding
            signaturePromises.push(
              (async () => {
                try {
                  // Convert base64 to bytes
                  const base64Data = value.split(',')[1];
                  const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                  
                  // Embed the PNG image
                  const signatureImage = await pdfDoc.embedPng(imageBytes);
                  
                  // Get the form field to find its position
                  const field = form.getTextField(fieldName);
                  const fieldWidget = field.acroField.getWidgets()[0];
                  const fieldRect = fieldWidget.getRectangle();
                  
                  // Get the page where this field is located
                  const pageIndex = fieldConfig.page - 1; // Convert to 0-based index
                  const page = pdfDoc.getPages()[pageIndex];
                  
                  if (page && fieldRect) {
                    // Calculate signature dimensions (maintain aspect ratio)
                    const fieldWidth = fieldRect.width;
                    const fieldHeight = fieldRect.height;
                    const imageAspectRatio = signatureImage.width / signatureImage.height;
                    
                    let sigWidth = fieldWidth * 0.8; // Leave some padding
                    let sigHeight = sigWidth / imageAspectRatio;
                    
                    // If height is too big, scale by height instead
                    if (sigHeight > fieldHeight * 0.8) {
                      sigHeight = fieldHeight * 0.8;
                      sigWidth = sigHeight * imageAspectRatio;
                    }
                    
                    // Center the signature in the field
                    const x = fieldRect.x + (fieldWidth - sigWidth) / 2;
                    const y = fieldRect.y + (fieldHeight - sigHeight) / 2;
                    
                    // Draw the signature image
                    page.drawImage(signatureImage, {
                      x: x,
                      y: y,
                      width: sigWidth,
                      height: sigHeight,
                      opacity: 1.0,
                    });
                    
                    // Clear the text field so it doesn't show behind the image
                    field.setText('');
                  }
                } catch (error) {
                  console.warn(`Could not embed signature image for field ${fieldName}:`, error);
                  // Fallback to text
                  try {
                    const field = form.getTextField(fieldName);
                    field.setText('[ELECTRONICALLY SIGNED]');
                  } catch (fallbackError) {
                    console.warn(`Could not set fallback text for field ${fieldName}:`, fallbackError);
                  }
                }
              })()
            );
          } else if (fieldConfig?.type !== 'signature') {
            // Handle text fields normally
            try {
              const field = form.getTextField(fieldName);
              field.setText(String(value));
            } catch (error) {
              console.warn(`Could not set field ${fieldName}:`, error);
            }
          }
        }
      });

      // Wait for all signature embeddings to complete
      await Promise.all(signaturePromises);

      const filledBytes = await pdfDoc.save();
      const blob = new Blob([filledBytes], { type: 'application/pdf' });
      const baseUrl = URL.createObjectURL(blob);
      setBasePdfUrl(baseUrl);
      
      // Set URL based on whether signing has started
      if (hasStarted) {
        const currentField = fieldMapping[currentStep];
        const urlWithPage = `${baseUrl}#page=${currentField?.page || 1}&view=FitH`;
        setPdfUrl(urlWithPage);
      } else {
        // Still in reading mode
        setPdfUrl(`${baseUrl}#page=1&view=FitH`);
      }
    } catch (error) {
      console.error('Error updating PDF:', error);
    }
  };

  // Update PDF scroll position when step changes (only during signing)
  useEffect(() => {
    if (hasStarted && basePdfUrl && fieldMapping[currentStep]) {
      const currentField = fieldMapping[currentStep];
      const urlWithPage = `${basePdfUrl}#page=${currentField.page}&view=FitH`;
      setPdfUrl(urlWithPage);
    }
  }, [currentStep, basePdfUrl, hasStarted]);

  // Update signature state when navigating to a field that already has a signature
  useEffect(() => {
    if (hasStarted && fieldMapping[currentStep]) {
      const currentField = fieldMapping[currentStep];
      if (currentField.type === 'signature') {
        const hasSignature = fieldValues[currentField.name] && fieldValues[currentField.name].startsWith('data:image');
        setSignatureProvided(hasSignature);
      }
    }
  }, [currentStep, hasStarted, fieldValues]);

  const handleStart = () => {
    setHasStarted(true);
    // Navigate to first field page when starting
    if (basePdfUrl) {
      const firstField = fieldMapping[0];
      const urlWithPage = `${basePdfUrl}#page=${firstField.page}&view=FitH`;
      setPdfUrl(urlWithPage);
    }
  };

  const handleFieldChange = (fieldName, value) => {
    setFieldValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleNext = () => {
    if (!hasStarted || !currentField) return;
    
    // Validate required fields
    if (currentField.required && !fieldValues[currentField.name]) {
      setError(`${currentField.label} is required.`);
      return;
    }
    
    setError('');
    setSignatureProvided(false); // Reset signature state for next field
    if (currentStep < fieldMapping.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    setError('');
    setSignatureProvided(false); // Reset signature state for previous field
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSignature = (signatureData) => {
    if (!hasStarted || !currentField) return;
    handleFieldChange(currentField.name, signatureData);
    setSignatureProvided(true);
  };

  const clearSignature = () => {
    if (sigCanvas.current) {
      sigCanvas.current.clear();
      setSignatureProvided(false);
      if (hasStarted && currentField) {
        handleFieldChange(currentField.name, '');
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && hasStarted && currentField) {
      e.preventDefault();
      
      // Check if current field is valid
      const isValid = currentField.type === 'signature' ? 
        signatureProvided : 
        currentField.required ? fieldValues[currentField.name] : true;
      
      if (!isValid) {
        setError(`${currentField.label} is required.`);
        return;
      }
      
      // Clear any existing errors
      setError('');
      
      // Determine action based on step
      const isLastStep = currentStep === fieldMapping.length - 1;
      if (isLastStep) {
        handleSubmit();
      } else {
        handleNext();
      }
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError('');

      // Create final PDF with all fields filled
      const pdfDoc = await PDFDocument.load(currentPdfBytes);
      const form = pdfDoc.getForm();

      // Process signature fields first to embed images
      const signaturePromises = [];
      
      Object.entries(fieldValues).forEach(([fieldName, value]) => {
        if (value) {
          const fieldConfig = fieldMapping.find(f => f.name === fieldName);
          
          if (fieldConfig?.type === 'signature' && value.startsWith('data:image')) {
            // Handle signature image embedding
            signaturePromises.push(
              (async () => {
                try {
                  // Convert base64 to bytes
                  const base64Data = value.split(',')[1];
                  const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                  
                  // Embed the PNG image
                  const signatureImage = await pdfDoc.embedPng(imageBytes);
                  
                  // Get the form field to find its position
                  const field = form.getTextField(fieldName);
                  const fieldWidget = field.acroField.getWidgets()[0];
                  const fieldRect = fieldWidget.getRectangle();
                  
                  // Get the page where this field is located
                  const pageIndex = fieldConfig.page - 1; // Convert to 0-based index
                  const page = pdfDoc.getPages()[pageIndex];
                  
                  if (page && fieldRect) {
                    // Calculate signature dimensions (maintain aspect ratio)
                    const fieldWidth = fieldRect.width;
                    const fieldHeight = fieldRect.height;
                    const imageAspectRatio = signatureImage.width / signatureImage.height;
                    
                    let sigWidth = fieldWidth * 0.8; // Leave some padding
                    let sigHeight = sigWidth / imageAspectRatio;
                    
                    // If height is too big, scale by height instead
                    if (sigHeight > fieldHeight * 0.8) {
                      sigHeight = fieldHeight * 0.8;
                      sigWidth = sigHeight * imageAspectRatio;
                    }
                    
                    // Center the signature in the field
                    const x = fieldRect.x + (fieldWidth - sigWidth) / 2;
                    const y = fieldRect.y + (fieldHeight - sigHeight) / 2;
                    
                    // Draw the signature image
                    page.drawImage(signatureImage, {
                      x: x,
                      y: y,
                      width: sigWidth,
                      height: sigHeight,
                      opacity: 1.0,
                    });
                    
                    // Clear the text field so it doesn't show behind the image
                    field.setText('');
                  }
                } catch (error) {
                  console.warn(`Could not embed signature image for field ${fieldName}:`, error);
                  // Fallback to text
                  try {
                    const field = form.getTextField(fieldName);
                    field.setText('[ELECTRONICALLY SIGNED]');
                  } catch (fallbackError) {
                    console.warn(`Could not set fallback text for field ${fieldName}:`, fallbackError);
                  }
                }
              })()
            );
          } else if (fieldConfig?.type !== 'signature') {
            // Handle text fields normally
            try {
              const field = form.getTextField(fieldName);
              field.setText(String(value));
            } catch (error) {
              console.warn(`Could not set field ${fieldName}:`, error);
            }
          }
        }
      });

      // Wait for all signature embeddings to complete
      await Promise.all(signaturePromises);

      const finalBytes = await pdfDoc.save();
      
      // Create form data for submission
      const formData = new FormData();
      const pdfBlob = new Blob([finalBytes], { type: 'application/pdf' });
      
      const tokenData = {
        agentName: fieldValues.agent_name || '',
        agentID: fieldValues.agent_1 || 'N/A',
        email: fieldValues.recruit_email || '',
        phoneNumber: fieldValues.agent_phone || '',
        address: fieldValues.agent_address || '',
        emergencyContact1: fieldValues.name_1 || '',
        emergencyPhone1: fieldValues.phone_1 || '',
        emergencyRelation1: fieldValues.relation_1 || '',
        emergencyContact2: fieldValues.name_2 || '',
        emergencyPhone2: fieldValues.phone_2 || '',
        emergencyRelation2: fieldValues.relation_2 || '',
        supervisorEmail: 'esign@ariasagencies.com',
        issuedAt: new Date().toISOString()
      };

      const token = btoa(JSON.stringify(tokenData))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      formData.append('file', pdfBlob, 'signed-agent-document.pdf');
      formData.append('token', token);
      formData.append('documentType', 'agent');
      formData.append('agentEmail', fieldValues.recruit_email || '');

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

  const renderFieldInput = () => {
    if (!hasStarted || !currentField) return null;
    const currentValue = fieldValues[currentField.name] || '';

    const inputStyle = {
      padding: isMobile ? '1rem' : '1rem',
      border: '2px solid #007bff',
      borderRadius: '8px',
      fontSize: isMobile ? '1rem' : '1.1rem',
      width: '100%',
      maxWidth: isMobile ? '100%' : '400px',
      boxSizing: 'border-box'
    };

    switch (currentField.type) {
                   case 'signature':
        return (
          <div style={{ textAlign: 'center', width: '100%' }}>
            <div style={{
              border: '2px solid #007bff',
              borderRadius: '8px',
              padding: isMobile ? '0.75rem' : '1rem',
              backgroundColor: '#f8f9fa',
              display: 'inline-block',
              position: 'relative',
              maxWidth: '100%',
              boxSizing: 'border-box'
            }}>
              <SignatureCanvas
                ref={sigCanvas}
                canvasProps={{
                  width: isMobile ? Math.min(window.innerWidth - 120, 300) : 400,
                  height: isMobile ? 120 : 150,
                  style: { 
                    backgroundColor: 'white', 
                    borderRadius: '4px',
                    display: 'block',
                    maxWidth: '100%'
                  }
                }}
                onEnd={() => {
                  const signatureData = sigCanvas.current.toDataURL();
                  handleSignature(signatureData);
                }}
              />
               {signatureProvided && (
                 <div style={{
                   position: 'absolute',
                   top: '8px',
                   right: '8px',
                   backgroundColor: '#28a745',
                   color: 'white',
                   padding: '4px 8px',
                   borderRadius: '12px',
                   fontSize: '0.75rem',
                   fontWeight: 'bold'
                 }}>
                   ✓ Signed
                 </div>
               )}
             </div>
             <div style={{ marginTop: '1rem' }}>
               <button onClick={clearSignature} style={{
                 padding: '0.5rem 1rem',
                 backgroundColor: '#6c757d',
                 color: 'white',
                 border: 'none',
                 borderRadius: '4px',
                 cursor: 'pointer'
               }}>
                 Clear Signature
               </button>
               {signatureProvided && (
                 <p style={{ 
                   fontSize: '0.9rem', 
                   color: '#28a745', 
                   marginTop: '0.5rem',
                   fontWeight: 'bold'
                 }}>
                   ✓ Signature will be embedded in the PDF
                 </p>
               )}
             </div>
           </div>
         );

      case 'initials':
        return (
          <input
            type="text"
            value={currentValue}
            onChange={(e) => handleFieldChange(currentField.name, e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            maxLength={3}
            placeholder="ABC"
            style={{ ...inputStyle, textAlign: 'center', fontSize: '1.5rem', maxWidth: '100px' }}
          />
        );

      case 'tel':
        return (
          <input
            type="tel"
            value={currentValue}
            onChange={(e) => handleFieldChange(currentField.name, e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="(123) 456-7890"
            style={inputStyle}
          />
        );

      case 'email':
        return (
          <input
            type="email"
            value={currentValue}
            onChange={(e) => handleFieldChange(currentField.name, e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="your.email@example.com"
            style={inputStyle}
          />
        );

      default:
        return (
          <input
            type="text"
            value={currentValue}
            onChange={(e) => handleFieldChange(currentField.name, e.target.value)}
            onKeyDown={handleKeyDown}
            style={inputStyle}
          />
        );
    }
  };

  const styles = {
    container: {
      padding: isMobile ? '1rem' : '2rem',
      maxWidth: isMobile ? '100%' : '1400px',
      margin: '0 auto'
    },
    mainContent: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 400px',
      gap: isMobile ? '1rem' : '2rem',
      alignItems: 'start'
    },
    readingLayout: {
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: isMobile ? '1rem' : '2rem'
    },
    pdfSection: {
      minHeight: isMobile ? '400px' : '700px',
      order: isMobile && hasStarted ? 2 : 1
    },
    wizardSection: {
      backgroundColor: 'white',
      padding: isMobile ? '1rem' : '2rem',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      position: isMobile ? 'static' : 'sticky',
      top: isMobile ? 'auto' : '2rem',
      order: isMobile && hasStarted ? 1 : 2,
      marginBottom: isMobile && hasStarted ? '1rem' : 0
    },
    progressBar: {
      width: '100%',
      height: '8px',
      backgroundColor: '#e9ecef',
      borderRadius: '4px',
      marginBottom: isMobile ? '1rem' : '2rem',
      overflow: 'hidden'
    },
    progress: {
      height: '100%',
      backgroundColor: '#007bff',
      borderRadius: '4px',
      transition: 'width 0.3s ease'
    },

    fieldLabel: {
      fontSize: isMobile ? '1.1rem' : '1.3rem',
      fontWeight: 'bold',
      color: '#333',
      marginBottom: isMobile ? '1rem' : '1.5rem',
      textAlign: 'center',
      lineHeight: '1.4'
    },
    buttonGroup: {
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      gap: isMobile ? '0.75rem' : '1rem',
      marginTop: isMobile ? '1.5rem' : '2rem'
    },
    button: {
      padding: isMobile ? '1rem 1.5rem' : '0.75rem 1.5rem',
      border: 'none',
      borderRadius: '8px',
      fontSize: isMobile ? '1.1rem' : '1rem',
      cursor: 'pointer',
      transition: 'all 0.2s',
      flex: 1,
      minHeight: isMobile ? '50px' : 'auto',
      fontWeight: isMobile ? 'bold' : 'normal'
    },
    primaryButton: {
      backgroundColor: '#007bff',
      color: 'white'
    },
    secondaryButton: {
      backgroundColor: '#6c757d',
      color: 'white'
    },
    successButton: {
      backgroundColor: '#28a745',
      color: 'white'
    },
    disabledButton: {
      backgroundColor: '#ccc',
      color: '#666',
      cursor: 'not-allowed'
    }
  };

  if (pdfLoading) {
    return (
      <div style={styles.container}>
        <div style={{ textAlign: 'center', padding: isMobile ? '2rem 1rem' : '4rem 2rem', color: '#666' }}>
          <h2 style={{ fontSize: isMobile ? '1.5rem' : '2rem' }}>Loading Agent Documentation...</h2>
          <p style={{ fontSize: isMobile ? '1rem' : '1.1rem' }}>Please wait while we prepare your forms.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={styles.container}>
        <div style={{ 
          backgroundColor: '#d4edda',
          color: '#155724',
          padding: isMobile ? '2rem 1rem' : '4rem 2rem',
          textAlign: 'center',
          border: '1px solid #c3e6cb',
          borderRadius: '12px'
        }}>
          <h2 style={{ fontSize: isMobile ? '1.5rem' : '2rem' }}>✅ Document Successfully Completed!</h2>
          <p style={{ fontSize: isMobile ? '1rem' : '1.1rem', marginBottom: '1rem' }}>Your signed agent documentation has been sent to the home office.</p>
          <p style={{ fontSize: isMobile ? '1rem' : '1.1rem', marginBottom: '2rem' }}>Thank you for completing all required fields and signatures.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              ...styles.button, 
              ...styles.primaryButton, 
              marginTop: '1rem', 
              maxWidth: isMobile ? '100%' : '200px',
              minHeight: isMobile ? '50px' : 'auto'
            }}
          >
            Start New Document
          </button>
        </div>
      </div>
    );
  }

  const currentField = hasStarted ? fieldMapping[currentStep] : null;
  const progress = hasStarted ? ((currentStep + 1) / fieldMapping.length) * 100 : 0;
  const isLastStep = hasStarted ? currentStep === fieldMapping.length - 1 : false;
  const canProceed = hasStarted && currentField ? 
    (currentField.type === 'signature' ? signatureProvided : 
     currentField.required ? fieldValues[currentField.name] : true) : true;

  return (
         <div style={styles.container}>
       <h2 style={{ 
         marginBottom: isMobile ? '1rem' : '2rem', 
         color: '#333', 
         textAlign: 'center',
         fontSize: isMobile ? '1.5rem' : '2rem',
         lineHeight: '1.3'
       }}>
         {hasStarted ? 
           (isMobile ? 'Agent Docs - Step by Step' : 'Agent Documentation - Step by Step') : 
           (isMobile ? 'Agent Documentation' : 'Agent Documentation - Review')
         }
       </h2>
      
      <div style={hasStarted ? styles.mainContent : styles.readingLayout}>
        {/* PDF Display */}
        <div style={styles.pdfSection}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
             <h3 style={{ color: '#333', margin: 0 }}>
               {hasStarted ? 'Document Preview' : 'Review Complete Document'}
             </h3>
           </div>
                     {pdfUrl ? (
             <iframe 
               key={pdfUrl} // Force reload when URL changes
               src={pdfUrl} 
               title="Agent Pages PDF" 
               width="100%" 
               height={isMobile ? 
                 (hasStarted ? "400px" : "500px") : 
                 (hasStarted ? "700px" : "800px")
               }
               style={{ 
                 border: '1px solid #ddd', 
                 borderRadius: '8px',
                 boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
               }}
             />
           ) : (
             <div style={{ padding: isMobile ? '1rem' : '2rem', textAlign: 'center', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
               <p>Loading PDF preview...</p>
             </div>
           )}
        </div>

        {/* Reading Interface or Wizard Interface */}
        {!hasStarted ? (
          /* Reading Phase */
                     <div style={{
             backgroundColor: 'white',
             padding: isMobile ? '1.5rem' : '3rem',
             borderRadius: '12px',
             boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
             textAlign: 'center',
             maxWidth: isMobile ? '100%' : '800px',
             margin: isMobile ? '1rem auto' : '2rem auto'
           }}>
             <div style={{
               backgroundColor: '#f8f9fa',
               padding: isMobile ? '1.5rem' : '2rem',
               borderRadius: '8px',
               marginBottom: isMobile ? '1.5rem' : '2rem',
               border: '2px solid #007bff'
             }}>
               <h3 style={{ color: '#007bff', margin: '0 0 1rem 0', fontSize: isMobile ? '1.3rem' : '1.5rem' }}>
                 📋 Important Instructions
               </h3>
               <p style={{ 
                 fontSize: isMobile ? '1rem' : '1.1rem', 
                 color: '#333', 
                 lineHeight: '1.6',
                 margin: '0 0 1rem 0'
               }}>
                 <strong>Please read through all pages of the document before signing.</strong>
               </p>
               <p style={{ 
                 fontSize: isMobile ? '0.9rem' : '1rem', 
                 color: '#666', 
                 lineHeight: '1.5',
                 margin: 0
               }}>
                 Review all terms, conditions, and requirements. The document contains important 
                 information about your agent agreement and responsibilities.
               </p>
             </div>
             
             <div style={{
               display: 'grid',
               gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
               gap: isMobile ? '1rem' : '1rem',
               marginBottom: isMobile ? '1.5rem' : '2rem'
             }}>
              <div style={{
                backgroundColor: '#e3f2fd',
                padding: '1.5rem',
                borderRadius: '8px',
                border: '1px solid #2196f3'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
                <div style={{ fontWeight: 'bold', color: '#1976d2', marginBottom: '0.5rem' }}>10 Pages</div>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>Complete document to review</div>
              </div>
              
              <div style={{
                backgroundColor: '#e8f5e8',
                padding: '1.5rem',
                borderRadius: '8px',
                border: '1px solid #4caf50'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✍️</div>
                <div style={{ fontWeight: 'bold', color: '#388e3c', marginBottom: '0.5rem' }}>19 Fields</div>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>Signatures & information to fill</div>
              </div>
              
              <div style={{
                backgroundColor: '#fff3e0',
                padding: '1.5rem',
                borderRadius: '8px',
                border: '1px solid #ff9800'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏱️</div>
                <div style={{ fontWeight: 'bold', color: '#f57c00', marginBottom: '0.5rem' }}>~12 mins</div>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>Estimated completion time</div>
              </div>
            </div>

                                     <button
              onClick={handleStart}
              style={{
                backgroundColor: '#28a745',
                color: 'white',
                padding: isMobile ? '1.25rem 2rem' : '1.25rem 3rem',
                border: 'none',
                borderRadius: '8px',
                fontSize: isMobile ? '1.1rem' : '1.2rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 4px 8px rgba(40, 167, 69, 0.3)',
                transition: 'all 0.2s',
                transform: 'translateY(0)',
                width: isMobile ? '100%' : 'auto',
                minHeight: isMobile ? '60px' : 'auto',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseOver={!isMobile ? (e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 12px rgba(40, 167, 69, 0.4)';
                e.target.style.backgroundColor = '#218838';
              } : undefined}
              onMouseOut={!isMobile ? (e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 8px rgba(40, 167, 69, 0.3)';
                e.target.style.backgroundColor = '#28a745';
              } : undefined}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2em' }}>🚀</span>
                <span>Start Signing Process</span>
                <span style={{ 
                  fontSize: '1.1em', 
                  animation: 'pulse 1.5s infinite',
                  display: 'inline-block'
                }}>▶▶</span>
              </span>
              <style>
                {`
                  @keyframes pulse {
                    0%, 100% { transform: translateX(0); opacity: 1; }
                    50% { transform: translateX(3px); opacity: 0.7; }
                  }
                `}
              </style>
            </button>
            
            <div style={{
              marginTop: '2rem',
              padding: '1rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              fontSize: '0.9rem',
              color: '#666'
            }}>
              <strong>What happens next:</strong>
              <br />
              You'll be guided through each field step-by-step with the PDF automatically 
              scrolling to the correct location for each signature and information field.
            </div>
          </div>
        ) : (
          /* Signing Wizard */
          <div style={styles.wizardSection}>
            {currentField && (
              <>
                {/* Progress Bar */}
                <div style={styles.progressBar}>
                  <div style={{ ...styles.progress, width: `${progress}%` }} />
                </div>
                
                                 <div style={{ textAlign: 'center', marginBottom: '2rem', color: '#666' }}>
                   Step {currentStep + 1} of {fieldMapping.length}
                 </div>

                {/* Field Label */}
                <div style={styles.fieldLabel}>
                  {currentField.label}
                  {currentField.required && <span style={{ color: '#dc3545' }}> *</span>}
                </div>

                {/* Field Input */}
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  {renderFieldInput()}
                </div>

                {/* Keyboard hint for non-signature fields */}
                {currentField.type !== 'signature' && (
                  <div style={{ 
                    textAlign: 'center', 
                    marginBottom: '2rem',
                    fontSize: isMobile ? '0.8rem' : '0.85rem',
                    color: '#666',
                    fontStyle: 'italic'
                  }}>
                    💡 Press <strong>Enter</strong> to continue
                  </div>
                )}

                {/* Navigation */}
                <div style={styles.buttonGroup}>
                  <button 
                    onClick={handlePrevious}
                    disabled={currentStep === 0}
                    style={{
                      ...styles.button,
                      ...styles.secondaryButton,
                      ...(currentStep === 0 ? styles.disabledButton : {})
                    }}
                  >
                    ← Previous
                  </button>
                  
                  {isLastStep ? (
                    <button 
                      onClick={handleSubmit}
                      disabled={!canProceed || submitting}
                      style={{
                        ...styles.button,
                        ...styles.successButton,
                        ...(!canProceed || submitting ? styles.disabledButton : {})
                      }}
                    >
                      {submitting ? 'Submitting...' : '✓ Complete & Submit'}
                    </button>
                  ) : (
                    <button 
                      onClick={handleNext}
                      disabled={!canProceed}
                      style={{
                        ...styles.button,
                        ...styles.primaryButton,
                        ...(!canProceed ? styles.disabledButton : {})
                      }}
                    >
                      Next →
                    </button>
                  )}
                </div>

                                 {/* Error Display */}
                 {error && (
                   <div style={{
                     backgroundColor: '#f8d7da',
                     color: '#721c24',
                     padding: isMobile ? '0.75rem' : '1rem',
                     borderRadius: '4px',
                     marginTop: '1rem',
                     border: '1px solid #f5c6cb',
                     textAlign: 'center',
                     fontSize: isMobile ? '0.9rem' : '1rem'
                   }}>
                     {error}
                   </div>
                 )}

                                 {/* Quick Page Navigation */}
                 <div style={{ 
                   marginTop: '1.5rem', 
                   padding: isMobile ? '0.75rem' : '1rem',
                   backgroundColor: '#f8f9fa',
                   borderRadius: '8px',
                   fontSize: isMobile ? '0.85rem' : '0.9rem'
                 }}>
                   <div style={{ 
                     display: 'flex', 
                     flexDirection: isMobile ? 'column' : 'row',
                     justifyContent: isMobile ? 'center' : 'space-between', 
                     alignItems: 'center', 
                     marginBottom: '0.5rem',
                     gap: isMobile ? '0.5rem' : 0
                   }}>
                     <strong style={{ color: '#333', fontSize: isMobile ? '0.9rem' : '1rem' }}>Document Navigation:</strong>
                     <div style={{ display: 'flex', gap: isMobile ? '0.5rem' : '0.25rem', alignItems: 'center' }}>
                       {[2, 5, 7, 8, 9, 10].map(pageNum => (
                         <div key={pageNum} style={{
                           minWidth: isMobile ? '24px' : '16px',
                           height: isMobile ? '24px' : '16px',
                           borderRadius: isMobile ? '12px' : '8px',
                           backgroundColor: currentField && currentField.page === pageNum ? '#007bff' : '#dee2e6',
                           color: currentField && currentField.page === pageNum ? 'white' : '#666',
                           fontSize: isMobile ? '0.8rem' : '0.7rem',
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           fontWeight: 'bold',
                           padding: isMobile ? '0 6px' : '0 4px'
                         }}>
                           {pageNum}
                         </div>
                       ))}
                     </div>
                   </div>
                   <p style={{ 
                     margin: 0, 
                     color: '#666', 
                     fontSize: isMobile ? '0.75rem' : '0.8rem',
                     textAlign: isMobile ? 'center' : 'left',
                     lineHeight: '1.4'
                   }}>
                     📄 Page {currentField.page} of 10
                   </p>
                 </div>


              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentDocumentSigning;