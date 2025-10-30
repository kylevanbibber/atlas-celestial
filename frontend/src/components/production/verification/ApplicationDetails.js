import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../api';
import './ApplicationDetails.css';

// Checkmark Icon (Green Circle with Checkmark)
const CheckmarkIcon = () => (
  <svg
      height="20px"
      width="20px"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox="-62.06 -62.06 434.40 434.40"
      xmlSpace="preserve"
      fill="#ffffff"
      stroke="#ffffff"
      strokeWidth="19.547451"
  >
      <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
      <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round" stroke="#CCCCCC" strokeWidth="9.928864"></g>
      <g id="SVGRepo_iconCarrier">
          <g>
              <path
                  style={{ fill: "#00bd2f" }}
                  d="M155.139,0C69.598,0,0,69.598,0,155.139c0,85.547,69.598,155.139,155.139,155.139 c85.547,0,155.139-69.592,155.139-155.139C310.277,69.598,240.686,0,155.139,0z M144.177,196.567L90.571,142.96l8.437-8.437 l45.169,45.169l81.34-81.34l8.437,8.437L144.177,196.567z"
              ></path>
          </g>
      </g>
  </svg>
);

// Cross Icon (Red Circle with X)
const CrossIcon = () => (
    <svg
        viewBox="-3.84 -3.84 23.68 23.68"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        stroke="#ffffff"
        strokeWidth="0.736"
        height="20px"
        width="20px"
    >
        <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M8 16C12.4183 16 16 12.4183 16 8C16 3.58172 12.4183 0 8 0C3.58172 0 0 3.58172 0 8C0 12.4183 3.58172 16 8 16ZM4.29289 5.70711L6.58579 8L4.29289 10.2929L5.70711 11.7071L8 9.41421L10.2929 11.7071L11.7071 10.2929L9.41421 8L11.7071 5.70711L10.2929 4.29289L8 6.58579L5.70711 4.29289L4.29289 5.70711Z"
            fill="#e92b2b"
        />
    </svg>
);

function ApplicationDetails({ row, data, onClose, parseInsuredInfo, isDiscrepancyTab, isQueuedTab }) {
    const { user } = useAuth();
    const [selectedInsuredIndex, setSelectedInsuredIndex] = useState(null);
    const [clientData, setClientData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editingEmail, setEditingEmail] = useState(false);
    const [editingPhone, setEditingPhone] = useState(false);
    const [editEmail, setEditEmail] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [updating, setUpdating] = useState(false);
    const [updatedContactInfo, setUpdatedContactInfo] = useState({});
    
    // Use row prop if provided, otherwise use data prop (from RightDetails)
    const verificationData = row || data;
    
    // Check if user has app management permissions (teamRole="app" OR Role="Admin")
    const hasAppManagementPermissions = user?.teamRole === 'app' || user?.Role === 'Admin';
    
    // Legacy compatibility - keeping isAppAdmin for existing code
    const isAppAdmin = hasAppManagementPermissions;
    
    // Debug logging for app admin detection
    console.log('🏭 ApplicationDetails: Debug info', {
        userRole: user?.Role,
        teamRole: user?.teamRole,
        hasAppManagementPermissions,
        isAppAdmin,
        clientName: verificationData?.client_name
    });

    const pdfMapping = {
        medications: '/pdfs/MedicalInfoSheet.pdf',
        er_visit: '/pdfs/MedicalInfoSheet.pdf',
        high_blood_pressure: '/pdfs/HighBloodPressureQ.pdf',
        diabetes: '/pdfs/DiabeticQ.pdf',
        cancer: '/pdfs/CancerTumorQ.pdf',
        arrested: '/pdfs/ArrestQ.pdf',
        dui: ['/pdfs/AlcoholUseQ.pdf', '/pdfs/DrugQ.pdf', '/pdfs/ArrestQ.pdf'],
        anxiety_depression: '/pdfs/DepressionQ.pdf',
        heart_issues: '/pdfs/HeartCirculatoryQ.pdf',
    };

    const medicalDiscrepancyMessages = {
        medications: "Needs medications listed on medical info sheet",
        er_visit: "Needs details of overnight hospital stay on medical info sheet", 
        high_blood_pressure: "Needs High Blood Pressure Questionnaire",
        diabetes: "Needs Diabetes Questionnaire",
        cancer: "Needs Cancer Questionnaire",
        arrested: "Needs Arrest Questionnaire",
        dui: "Needs Alcohol Use, Drug, and Arrest Questionnaires",
        anxiety_depression: "Needs Depression Questionnaire",
        heart_issues: "Needs Heart/Circulatory Questionnaire",
        senior_rejected: "Was rejected for life with AIL",
        heart_lung: "Heart/Lung question discrepancy",
        cirrhosis: "Cirrhosis, Alzheimer's, ALS, dementia discrepancy",
        amputation: "Amputation question discrepancy",
        cancer_senior: "Cancer question discrepancy",
        oxygen: "Oxygen question discrepancy",
        chronic_illness: "Needs Chronic Illness details on medical info sheet",
        bedridden: "Address bedridden or nursing home residency discrepancy"
    };

    useEffect(() => {
        const fetchClientData = async () => {
            try {
                setLoading(true);
                const response = await api.get('/verify/verifyclient/all');
                if (response.data.success) {
                    const clientRecord = response.data.data.find(
                        client => client.application_id === verificationData.application_id
                    );
                    console.log('🔍 Client data fetch debug:', {
                        allClientData: response.data.data,
                        applicationId: verificationData.application_id,
                        foundClientRecord: clientRecord,
                        hasEmail: clientRecord?.client_email,
                        hasPhone: clientRecord?.client_phoneNumber
                    });
                    setClientData(clientRecord || null);
                }
            } catch (error) {
                console.error('Error fetching client data:', error);
            } finally {
                setLoading(false);
            }
        };

        if (verificationData?.application_id) {
            fetchClientData();
        } else {
            // If no verification data, stop loading
            setLoading(false);
        }
    }, [verificationData?.application_id]);

    // Use passed parseInsuredInfo function or provide a default implementation
    const parseInsuredInfoFunction = parseInsuredInfo || ((info) => {
        if (!info || info === 'n/a') return null;
        const [name, premium, trial, senior] = info.split(',');
        if (name === 'n/a') return null;

        return {
            name,
            premium: parseFloat(premium) || 0,
            trial: trial === 'y' ? 'Trial' : 'Standard',
            type: senior === 'y' ? 'Senior' : 'Super Combo',
        };
    });

    const capitalizeWords = (str) => {
        return str
            .replace(/_/g, ' ') // Replace underscores with spaces
            .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize each word
    };

    // Helper functions to get current contact info with updates
    const getCurrentEmail = () => {
        return updatedContactInfo.client_email || 
               clientData?.client_email || 
               verificationData?.client_email || 
               '';
    };

    const getCurrentPhone = () => {
        return updatedContactInfo.client_phoneNumber || 
               clientData?.client_phoneNumber || 
               verificationData?.client_phoneNumber || 
               '';
    };

    const handleEditEmail = () => {
        setEditEmail(getCurrentEmail());
        setEditingEmail(true);
    };

    const handleEditPhone = () => {
        setEditPhone(getCurrentPhone());
        setEditingPhone(true);
    };

    const handleSaveEmail = async () => {
        const applicationId = clientData?.application_id || verificationData?.application_id;
        if (!applicationId) return;
        
        try {
            setUpdating(true);
            const response = await api.put('/verify/update-client-contact', {
                application_id: applicationId,
                client_email: editEmail
            });
            
            if (response.data.success) {
                // Update clientData if it exists
                if (clientData) {
                    setClientData(prev => ({ ...prev, client_email: editEmail }));
                }
                // Update local contact info state to reflect the change immediately
                setUpdatedContactInfo(prev => ({ ...prev, client_email: editEmail }));
                setEditingEmail(false);
                // Show success message
                alert('Client email updated successfully!');
            } else {
                alert('Failed to update client email: ' + response.data.message);
            }
        } catch (error) {
            console.error('Error updating client email:', error);
            alert('Error updating client email: ' + error.message);
        } finally {
            setUpdating(false);
        }
    };

    const handleSavePhone = async () => {
        const applicationId = clientData?.application_id || verificationData?.application_id;
        if (!applicationId) return;
        
        try {
            setUpdating(true);
            const response = await api.put('/verify/update-client-contact', {
                application_id: applicationId,
                client_phoneNumber: editPhone
            });
            
            if (response.data.success) {
                // Update clientData if it exists
                if (clientData) {
                    setClientData(prev => ({ ...prev, client_phoneNumber: editPhone }));
                }
                // Update local contact info state to reflect the change immediately
                setUpdatedContactInfo(prev => ({ ...prev, client_phoneNumber: editPhone }));
                setEditingPhone(false);
                // Show success message
                alert('Client phone number updated successfully!');
            } else {
                alert('Failed to update client phone number: ' + response.data.message);
            }
        } catch (error) {
            console.error('Error updating client phone number:', error);
            alert('Error updating client phone number: ' + error.message);
        } finally {
            setUpdating(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingEmail(false);
        setEditingPhone(false);
        setEditEmail('');
        setEditPhone('');
    };

    const renderMedicalQuestions = (insuredType, insuredName) => {
        const questions = insuredType === 'Senior'
            ? ['senior_rejected', 'heart_lung', 'cirrhosis', 'amputation', 'cancer_senior', 'oxygen']
            : ['anxiety_depression', 'cancer', 'chronic_illness', 'diabetes', 'dui', 'er_visit', 'heart_issues', 'high_blood_pressure', 'medications'];

        return (
            <table className='recruiting-table'>
                <thead>
                    <tr>
                        <th>Question</th>
                        <th>Agent Answer</th>
                        {!isQueuedTab && <th>Client Answer</th>}
                    </tr>
                </thead>
                <tbody>
                    {questions.map((questionKey) => {
                        // Process agent answer with multiple insureds
                        const agentAnswerRaw = verificationData[`${questionKey}_answer`] || 'n';
                        let agentAnswer;

                        if (agentAnswerRaw.toLowerCase().includes('yes(')) {
                            const insuredsWithYes = agentAnswerRaw.match(/\(([^)]+)\)/)[1]
                                .split(',')
                                .map(name => name.trim().toLowerCase());
                            
                            if (insuredsWithYes.includes(insuredName.toLowerCase())) {
                                agentAnswer = 'Yes';
                            } else {
                                agentAnswer = 'No'; // Show "No" if this insured isn't listed as "Yes"
                            }
                        } else {
                            agentAnswer = agentAnswerRaw === 'n' ? 'No' : 'Yes';
                        }

                        // Process client answer similarly
                        const clientAnswerRaw = clientData?.[questionKey] || 'undefined';
                        let clientAnswer;

                        if (clientAnswerRaw.toLowerCase().includes(`yes(`)) {
                            const insuredsWithYes = clientAnswerRaw.match(/\(([^)]+)\)/)[1]
                                .split(',')
                                .map(name => name.trim().toLowerCase());
                            
                            if (insuredsWithYes.includes(insuredName.toLowerCase())) {
                                clientAnswer = 'Yes';
                            } else {
                                clientAnswer = 'No'; // Show "No" if this insured isn't listed as "Yes"
                            }
                        } else if (clientAnswerRaw === 'n') {
                            clientAnswer = 'No';
                        } else {
                            clientAnswer = 'N/A';
                        }

                        const isDiscrepancy = agentAnswer === 'No' && clientAnswer === 'Yes';

                        return (
                            <tr key={questionKey} style={{ backgroundColor: isDiscrepancy ? 'lightcoral' : 'white' }}>
                                <td>{capitalizeWords(questionKey)}</td>
                                <td>{agentAnswer}</td>
                                {!isQueuedTab && <td>{clientAnswer}</td>}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        );
    };

    const convertMSTToUTC = (mstDateString) => {
        const mstDate = new Date(mstDateString);
        const utcDate = new Date(mstDate.getTime() + 7 * 60 * 60 * 1000); // Add 7 hours to get UTC
        return utcDate.toISOString(); // Convert to ISO string in UTC format
    };
    
    const convertUTCToLocalTime = (utcDateString) => {
        const utcDate = new Date(utcDateString);
        return utcDate.toLocaleString(); // Convert to local time based on user's time zone
    };

    const getDiscrepancyData = () => {
        const discrepancies = {};
        const requiredPdfs = {};

        if (!clientData || !verificationData) {
            return { discrepancies, requiredPdfs };
        }

        // Medical questions to check (same as old ApplicationDetails.js)
        const medicalKeys = [
            'amputation', 'anxiety_depression', 'cancer', 'cancer_senior', 'chronic_illness',
            'cirrhosis', 'diabetes', 'dui', 'er_visit', 'heart_issues', 'heart_lung',
            'high_blood_pressure', 'medications', 'oxygen', 'senior_rejected'
        ];

        // Get all insureds (same as old ApplicationDetails.js)
        const insureds = {
            Primary: verificationData.primary_info,
            Spouse: verificationData.spouse_info,
            Child1: verificationData.child1_info,
            Child2: verificationData.child2_info,
            Child3: verificationData.child3_info,
            Child4: verificationData.child4_info,
            Child5: verificationData.child5_info,
            Child6: verificationData.child6_info,
            Child7: verificationData.child7_info,
            Child8: verificationData.child8_info,
            Child9: verificationData.child9_info,
        };

        // Check each insured for discrepancies (same logic as old ApplicationDetails.js)
        for (const [insuredType, insuredInfo] of Object.entries(insureds)) {
            if (insuredInfo && insuredInfo !== 'n/a') {
                const [insuredName] = insuredInfo.split(',');
                const insuredDiscrepanciesList = [];

                medicalKeys.forEach((key) => {
                    const agentAnswer = verificationData[`${key}_answer`] || 'n';
                    const clientAnswer = clientData[key] || 'n';

                    // Extract insured names from answers for comparison with data cleaning (same as old app)
                    const agentInsureds = agentAnswer.toLowerCase().includes('yes(')
                        ? (agentAnswer.match(/\(([^)]+)\)/) || [])[1]?.split(',').map(name => {
                            // Clean up duplicate names and formatting issues
                            const cleanedName = name.trim().toLowerCase();
                            // Remove duplicate words (like "Douglas Shope Shope" -> "Douglas Shope")
                            const words = cleanedName.split(' ');
                            const uniqueWords = words.filter((word, index) => words.indexOf(word) === index);
                            return uniqueWords.join(' ');
                        }) || []
                        : [];

                    const clientInsureds = clientAnswer.toLowerCase().includes('yes(')
                        ? (clientAnswer.match(/\(([^)]+)\)/) || [])[1]?.split(',').map(name => name.trim().toLowerCase()) || []
                        : [];

                    // Simple discrepancy check (same as old ApplicationDetails.js):
                    // Agent says "No" (doesn't include insured) AND Client lists this insured
                    const isDiscrepancy = !agentInsureds.includes(insuredName.toLowerCase()) &&
                        clientInsureds.includes(insuredName.toLowerCase());

                    if (isDiscrepancy) {
                        const message = `${medicalDiscrepancyMessages[key] || key}: Agent said No, Client said Yes`;
                        insuredDiscrepanciesList.push(message);
                    }
                });

                if (insuredDiscrepanciesList.length > 0) {
                    discrepancies[insuredName] = insuredDiscrepanciesList;
                }
            }
        }

        // Check other fields for discrepancies - these go under "General"
        const generalDiscrepancies = [];
        
        if (clientData.account_verification === 'n') {
            generalDiscrepancies.push('Account verification failed');
        }
        
        if (clientData.application_verification === 'n') {
            generalDiscrepancies.push('Application verification failed');
        }
        
        if (clientData.agent_contact_request && clientData.agent_contact_request.toLowerCase() !== 'no') {
            const requestType = clientData.agent_contact_request;
            generalDiscrepancies.push(`Agent contact request: ${requestType}`);
        }
        
        if (verificationData.agent_ip === clientData.client_ip) {
            generalDiscrepancies.push('IP addresses match between agent and client');
        }

        // Add general discrepancies if any exist
        if (generalDiscrepancies.length > 0) {
            discrepancies['General'] = generalDiscrepancies;
        }

        // Convert Sets to Arrays for required PDFs
        Object.keys(requiredPdfs).forEach(key => {
            requiredPdfs[key] = Array.from(requiredPdfs[key]);
        });

        return { discrepancies, requiredPdfs };
    };

    // Function to get discrepancy data in a format suitable for copying
    const getDiscrepancyDataForCopy = () => {
        const { discrepancies } = getDiscrepancyData();
        const discrepancyText = [];

        Object.entries(discrepancies).forEach(([insuredName, messages]) => {
            discrepancyText.push(`${insuredName}:`);
            messages.forEach(message => {
                discrepancyText.push(`  - ${message}`);
            });
        });

        return discrepancyText;
    };

    // Copy button click handler for app admins
    const handleCopyClick = () => {
        const discrepancyText = getDiscrepancyDataForCopy();
        if (discrepancyText.length > 0) {
            const fullText = `Discrepancies for ${verificationData.client_name}:\n${discrepancyText.join('\n')}`;
            navigator.clipboard.writeText(fullText);
            alert(`Copied: Discrepancies for ${verificationData.client_name}`);
        } else {
            alert('No discrepancies to copy');
        }
    };

    const renderRequiredDocuments = () => {
        const { discrepancies, requiredPdfs } = getDiscrepancyData();

        // Check if there are any required PDFs
        const hasRequiredPdfs = Object.keys(requiredPdfs).length > 0;

        return (
            <div>
                {/* Conditionally render the Questionnaires section only if there are required PDFs */}
                {hasRequiredPdfs && (
                    <div>
                        <h4>Questionnaires</h4>
                        <hr />
                        {Object.entries(requiredPdfs).map(([insuredName, pdfList]) => (
                            <div key={insuredName} style={{ marginBottom: '10px' }}>
                                <strong>Insured: {insuredName}</strong>
                                <ul>
                                    {pdfList.map((pdfPath, index) => {
                                        const pdfFileName = pdfPath.split('/').pop(); // Extract file name from path
                                        const pdfKey = pdfFileName.replace('.pdf', '').replace(/Q$/, '').toLowerCase();
        const instructionText = medicalDiscrepancyMessages[pdfKey] || '';

                                        return (
                                            <li key={index} style={{ display: 'flex', alignItems: 'center' }}>
                                                {/* Display instruction text first */}
                                                <span>{instructionText} </span>
                                                {/* PDF link displayed separately */}
                                                <a href={pdfPath} target="_blank" rel="noopener noreferrer">
                                                    {pdfFileName}
                                                </a>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))}
                    </div>
                )}

                {/* Conditionally render Discrepancies section if discrepancies exist */}
                {Object.keys(discrepancies).length > 0 && (
                    <div>
                        <h4>Discrepancies</h4>
                        <ul>
                            {Object.entries(discrepancies).map(([insuredName, messages], index) => (
                                <li key={index}>
                                    <strong>{insuredName}:</strong>
                                    <ul>
                                        {messages.map((message, msgIndex) => (
                                            <li key={msgIndex}>{message}</li>
                                        ))}
                                    </ul>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '1rem' }}>
                    Email all required questionnaires to <a href="mailto:eapps@ariasagencies.com">eapps@ariasagencies.com</a>
                </div>
            </div>
        );
    };

    const renderInsuredsTable = () => {
        const insureds = [];

        const primaryInfo = parseInsuredInfoFunction(verificationData.primary_info);
        if (primaryInfo) insureds.push(primaryInfo);

        const spouseInfo = parseInsuredInfoFunction(verificationData.spouse_info);
        if (spouseInfo) insureds.push(spouseInfo);

        for (let i = 1; i <= 9; i++) {
            const childInfo = parseInsuredInfoFunction(verificationData[`child${i}_info`]);
            if (childInfo) insureds.push(childInfo);
        }

        return (
            <table className='insureds-table'>
                <thead>
                    <tr>
                        <th>Status</th>
                        <th>Name</th>
                        <th>Monthly</th>
                        <th>Status</th>
                        <th>Type</th>
                    </tr>
                </thead>
                <tbody>
                    {insureds.length > 0 ? (
                        insureds.map((insured, index) => {
                            const hasMismatch = clientData && checkForMismatch(verificationData, insured.type, clientData, insured.name); // Check for any mismatch
                            return (
                                <React.Fragment key={index}>
                                    <tr
                                        className={`insured-row ${hasMismatch ? 'discrepancy-row' : ''}`}
                                        onClick={() => handleInsuredRowClick(index)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td>
                                            <div className={`status-icon ${hasMismatch ? 'discrepancy' : 'verified'}`}>
                                                {clientData && (hasMismatch ? <CrossIcon /> : <CheckmarkIcon />)}
                                            </div>
                                        </td>
                                        <td>
                                            <strong>{insured.name}</strong>
                                            {selectedInsuredIndex === index && (
                                                <span style={{ marginLeft: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                    (Click to collapse)
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <strong>{Number(insured.premium).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</strong>
                                        </td>
                                        <td>
                                            <span className={`verification-badge ${insured.trial === 'Trial' ? 'discrepancy' : 'verified'}`}>
                                                {insured.trial}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`verification-badge ${insured.type === 'Senior' ? 'verified' : 'discrepancy'}`}>
                                                {insured.type}
                                            </span>
                                        </td>
                                    </tr>
                                    {selectedInsuredIndex === index && (
                                        <tr>
                                            <td colSpan="5" className="medical-questions-cell">
                                                <div style={{ padding: '15px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', margin: '10px 0' }}>
                                                    <h5 style={{ margin: '0 0 15px 0', color: 'var(--hover-color)', fontSize: '14px' }}>
                                                        Medical Questions for {insured.name}
                                                    </h5>
                                                    {renderMedicalQuestions(insured.type, insured.name)}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })
                    ) : (
                        <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                                No insureds found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        );
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const options = {
            year: '2-digit',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
        };
        return date.toLocaleString('en-US', options);
    };

    const handleInsuredRowClick = (index) => {
        setSelectedInsuredIndex(selectedInsuredIndex === index ? null : index);
    };

    const getSetForSendDate = (submittedDate) => {
        const submitted = new Date(submittedDate);
        const nextDay = new Date(submitted);
        nextDay.setDate(submitted.getDate() + 1); // Move to the next day
        nextDay.setHours(8, 0, 0, 0); // Set time to 8:00 AM
        return nextDay.toLocaleString('en-US', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
        });
    };

    const checkForMismatch = (verificationRow, insuredType, clientData, insuredName) => {
        const medicalQuestions = insuredType === 'Senior'
            ? ['senior_rejected', 'heart_lung', 'cirrhosis', 'amputation', 'cancer_senior', 'oxygen']
            : ['anxiety_depression', 'cancer', 'chronic_illness', 'diabetes', 'dui', 'er_visit', 'heart_issues', 'high_blood_pressure', 'medications'];

        return medicalQuestions.some((key) => {
            const agentAnswer = verificationRow[`${key}_answer`] || 'n';
            const clientAnswer = clientData?.[key] || 'n';

            // Extract insured names from answers for comparison with data cleaning
            const clientInsureds = clientAnswer.toLowerCase().includes('yes(')
                ? clientAnswer.match(/\(([^)]+)\)/)[1].split(',').map(name => name.trim().toLowerCase())
                : [];

            const agentInsureds = agentAnswer.toLowerCase().includes('yes(')
                ? agentAnswer.match(/\(([^)]+)\)/)[1].split(',').map(name => {
                    // Clean up duplicate names and formatting issues
                    const cleanedName = name.trim().toLowerCase();
                    // Remove duplicate words (like "Douglas Shope Shope" -> "Douglas Shope")
                    const words = cleanedName.split(' ');
                    const uniqueWords = words.filter((word, index) => words.indexOf(word) === index);
                    return uniqueWords.join(' ');
                })
                : [];

            // Discrepancy exists if:
            // 1. Agent said "No" and client said "Yes" (simple case)
            // 2. OR Agent said "No" and client specifically listed this insured
            return agentAnswer === 'n' && (
                clientAnswer.toLowerCase() === 'y' || 
                clientInsureds.includes(insuredName.toLowerCase())
            );
        });
    };

    if (loading) {
        return (
            <div className="route-loading" role="alert" aria-busy="true">
              <div className="spinner"></div>
              <p>Loading...</p>
            </div>
        );
    }

    if (!verificationData) {
        return (
            <div className="application-details-container">
                <div className="application-details-header">
                    <h3>Application Details</h3>
                    {onClose && (
                        <button onClick={onClose} className="application-details-close-button">
                            ×
                        </button>
                    )}
                </div>
                <div className="error-message">
                    <h3>No Data Available</h3>
                    <p>No verification data available for this application.</p>
                </div>
            </div>
        );
    }

    // Conditional row styling if IP addresses match
    const rowStyle = verificationData.agent_ip === clientData?.client_ip ? { backgroundColor: 'lightcoral' } : {};

    return (
        <div className="application-details-container">
            {onClose && (
                <div className="application-details-header">
                    <h3>Application Details</h3>
                    <button onClick={onClose} className="application-details-close-button">
                        ×
                    </button>
                </div>
            )}

            <div className="application-details-content">
                {/* Copy button for app admins - placed above Agent Information */}
                {isAppAdmin && (() => {
                    const { discrepancies } = getDiscrepancyData();
                    const hasDiscrepancies = Object.keys(discrepancies).length > 0;
                    
                    // Show copy button if there are discrepancies OR if this came from discrepancy table
                    const shouldShowCopyButton = hasDiscrepancies || isDiscrepancyTab;
                    
                    console.log('🏭 Copy button check:', { 
                        isAppAdmin, 
                        hasDiscrepancies, 
                        isDiscrepancyTab,
                        shouldShowCopyButton,
                        discrepancies 
                    });
                    
                    return shouldShowCopyButton ? (
                        <div style={{ textAlign: 'right', marginBottom: '15px' }}>
                            <button 
                                onClick={handleCopyClick}
                                style={{
                                    padding: '8px 12px',
                                    backgroundColor: '#00558c',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 'bold'
                                }}
                            >
                                Copy Notes
                            </button>
                        </div>
                    ) : null;
                })()}

                {/* Agent Information Section */}
                <div className="application-details-section">
                    <h4>
                        <span>👤</span>
                        Agent Information
                    </h4>
                    <table className='details-table'>
                        <thead>
                            <tr>
                                <th>Agent Name</th>
                                <th>Date Submitted</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>{verificationData.agent_name}</td>
                                <td>{formatDate(verificationData.created_at)}</td>
                                <td>
                                    <span className={`verification-badge ${isDiscrepancyTab ? 'discrepancy' : 'verified'}`}>
                                        {isDiscrepancyTab ? 'Discrepancy' : verificationData.status || 'Pending'}
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* IP Address Comparison Section - Important for App Admins */}
                {isAppAdmin && clientData && (
                    <div className="application-details-section">
                        <h4>
                            <span>🌐</span>
                            IP Address Comparison
                        </h4>
                        <table className='details-table'>
                            <thead>
                                <tr>
                                    <th>Agent IP</th>
                                    <th>Client IP</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={verificationData.agent_ip === clientData.client_ip ? { backgroundColor: 'lightcoral' } : {}}>
                                    <td>{verificationData.agent_ip}</td>
                                    <td>{clientData.client_ip || 'No client IP'}</td>
                                    <td>
                                        {verificationData.agent_ip === clientData.client_ip ? (
                                            <span style={{ color: 'red', fontWeight: 'bold' }}>⚠️ MATCH (Suspicious)</span>
                                        ) : (
                                            <span style={{ color: 'green' }}>✓ Different (Normal)</span>
                                        )}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Client Verification Section */}
                {clientData && (
                    <div className="application-details-section">
                        <h4>
                            <span>✉️</span>
                            Client Verification
                        </h4>
                        <table className='contact-agent-table'>
                            <thead>
                                <tr>
                                    <th>Contact Agent Request</th>
                                    <th>Account Verification</th>
                                    <th>Application Verification</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className={clientData?.agent_contact_request !== 'No' ? 'contact-request-yes' : ''}>
                                        {clientData?.agent_contact_request || 'N/A'}
                                    </td>
                                    <td className={clientData?.account_verification === 'n' ? 'contact-request-yes' : ''}>
                                        {clientData?.account_verification === 'y' ? 'Verified' : 'Failed'}
                                    </td>
                                    <td className={clientData?.application_verification === 'n' ? 'contact-request-yes' : ''}>
                                        {clientData?.application_verification === 'y' ? 'Verified' : 'Failed'}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Client Contact Information Section - Only for App Admins */}
                {isAppAdmin && (
                    <div className="application-details-section">
                        <h4>
                            <span>📞</span>
                            Client Contact Information
                        </h4>
                        {console.log('🔍 Contact info debug:', {
                            isAppAdmin,
                            clientData,
                            verificationData,
                            updatedContactInfo,
                            currentEmail: getCurrentEmail(),
                            currentPhone: getCurrentPhone(),
                            hasClientEmail: !!getCurrentEmail(),
                            hasClientPhone: !!getCurrentPhone()
                        })}
                        <table className='contact-agent-table'>
                            <thead>
                                <tr>
                                    <th>Client Email</th>
                                    <th>Client Phone Number</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>
                                        {getCurrentEmail() ? (
                                            <div className="client-contact-info">
                                                <span>{getCurrentEmail()}</span>
                                                <div className="contact-actions">
                                                    <button 
                                                        className="copy-btn"
                                                        onClick={() => navigator.clipboard.writeText(getCurrentEmail())}
                                                        title="Copy email to clipboard"
                                                    >
                                                        📋
                                                    </button>
                                                    {editingEmail ? (
                                                        <div className="edit-form">
                                                            <input
                                                                type="email"
                                                                value={editEmail}
                                                                onChange={(e) => setEditEmail(e.target.value)}
                                                                className="edit-input"
                                                                placeholder="Enter email"
                                                            />
                                                            <button 
                                                                onClick={handleSaveEmail} 
                                                                className="save-btn"
                                                                disabled={updating}
                                                            >
                                                                {updating ? 'Saving...' : 'Save'}
                                                            </button>
                                                            <button 
                                                                onClick={handleCancelEdit} 
                                                                className="cancel-btn"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button 
                                                            className="edit-btn"
                                                            onClick={handleEditEmail}
                                                            title="Edit email"
                                                        >
                                                            ✏️
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="client-contact-info">
                                                <span className="no-data">No email provided</span>
                                                {editingEmail ? (
                                                    <div className="edit-form">
                                                        <input
                                                            type="email"
                                                            value={editEmail}
                                                            onChange={(e) => setEditEmail(e.target.value)}
                                                            className="edit-input"
                                                            placeholder="Enter email"
                                                        />
                                                        <button 
                                                            onClick={handleSaveEmail} 
                                                            className="save-btn"
                                                            disabled={updating}
                                                        >
                                                            {updating ? 'Saving...' : 'Save'}
                                                        </button>
                                                        <button 
                                                            onClick={handleCancelEdit} 
                                                            className="cancel-btn"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        className="edit-btn"
                                                        onClick={handleEditEmail}
                                                        title="Add email"
                                                    >
                                                        ➕
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        {getCurrentPhone() ? (
                                            <div className="client-contact-info">
                                                <span>{getCurrentPhone()}</span>
                                                <div className="contact-actions">
                                                    <button 
                                                        className="copy-btn"
                                                        onClick={() => navigator.clipboard.writeText(getCurrentPhone())}
                                                        title="Copy phone to clipboard"
                                                    >
                                                        📋
                                                    </button>
                                                    {editingPhone ? (
                                                        <div className="edit-form">
                                                            <input
                                                                type="text"
                                                                value={editPhone}
                                                                onChange={(e) => setEditPhone(e.target.value)}
                                                                className="edit-input"
                                                                placeholder="Enter phone number"
                                                            />
                                                            <button 
                                                                onClick={handleSavePhone} 
                                                                className="save-btn"
                                                                disabled={updating}
                                                            >
                                                                {updating ? 'Saving...' : 'Save'}
                                                            </button>
                                                            <button 
                                                                onClick={handleCancelEdit} 
                                                                className="cancel-btn"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button 
                                                            className="edit-btn"
                                                            onClick={handleEditPhone}
                                                            title="Edit phone number"
                                                        >
                                                            ✏️
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="client-contact-info">
                                                <span className="no-data">No phone number provided</span>
                                                {editingPhone ? (
                                                    <div className="edit-form">
                                                        <input
                                                            type="text"
                                                            value={editPhone}
                                                            onChange={(e) => setEditPhone(e.target.value)}
                                                            className="edit-input"
                                                            placeholder="Enter phone number"
                                                        />
                                                        <button 
                                                            onClick={handleSavePhone} 
                                                            className="save-btn"
                                                            disabled={updating}
                                                        >
                                                            {updating ? 'Saving...' : 'Save'}
                                                        </button>
                                                        <button 
                                                            onClick={handleCancelEdit} 
                                                            className="cancel-btn"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        className="edit-btn"
                                                        onClick={handleEditPhone}
                                                        title="Add phone number"
                                                    >
                                                        ➕
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Insureds Section */}
                <div className="application-details-section">
                    <h4>
                        <span>👥</span>
                        Insureds & Medical Questions
                    </h4>
                    {renderInsuredsTable()}
                </div>

                {/* Required Documents Section */}
                {isDiscrepancyTab && (
                    <div className="application-details-section">
                        <h4>
                            <span>📄</span>
                            Required Documents
                        </h4>
                        {renderRequiredDocuments()}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ApplicationDetails; 