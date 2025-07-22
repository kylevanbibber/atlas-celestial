import React, { useState, useEffect } from 'react';
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
    const [selectedInsuredIndex, setSelectedInsuredIndex] = useState(null);
    const [clientData, setClientData] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Use row prop if provided, otherwise use data prop (from RightDetails)
    const verificationData = row || data;

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
        medications: { message: "Provide list of medications on", pdf: ['/pdfs/MedicalInfoSheet.pdf'] },
        er_visit: { message: "Provide details of overnight hospital stay on", pdf: ['/pdfs/MedicalInfoSheet.pdf'] },
        high_blood_pressure: { message: "Complete", pdf: ['/pdfs/HighBloodPressureQ.pdf'] },
        diabetes: { message: "Complete", pdf: ['/pdfs/DiabeticQ.pdf'] },
        cancer: { message: "Complete", pdf: ['/pdfs/CancerTumorQ.pdf'] },
        arrested: { message: "Complete", pdf: ['/pdfs/ArrestQ.pdf'] },
        dui: { message: "Complete", pdf: ['/pdfs/AlcoholUseQ.pdf', '/pdfs/DrugQ.pdf', '/pdfs/ArrestQ.pdf'] },
        anxiety_depression: { message: "Complete", pdf: ['/pdfs/DepressionQ.pdf'] },
        heart_issues: { message: "Complete", pdf: ['/pdfs/HeartCirculatoryQ.pdf'] },
        senior_rejected: { message: "Was rejected for life with AIL", pdf: [] },
        heart_lung: { message: "Address Heart/Lung question discrepancy", pdf: [] },
        cirrhosis: { message: "Address Cirrhosis, Alzheimer's, ALS, dementia discrepancy", pdf: [] },
        amputation: { message: "Address Amputation question discrepancy", pdf: [] },
        cancer_senior: { message: "Address Cancer question discrepancy", pdf: [] },
        oxygen: { message: "Address Oxygen question discrepancy", pdf: [] },
        bedridden: { message: "Address bedridden or nursing home residency discrepancy", pdf: [] }
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

        const insureds = { Primary: verificationData.primary_info, Spouse: verificationData.spouse_info, Child1: verificationData.child1_info };

        for (const [insuredType, insuredInfo] of Object.entries(insureds)) {
            if (insuredInfo && insuredInfo !== 'n/a') {
                const [insuredName] = insuredInfo.split(',');

                const insuredDiscrepanciesList = [];
                const insuredRequiredPdfs = new Set();

                Object.keys(medicalDiscrepancyMessages).forEach((key) => {
                    const agentAnswer = verificationData[`${key}_answer`];
                    const clientAnswer = clientData?.[key];

                    if (
                        agentAnswer !== clientAnswer &&
                        clientAnswer &&
                        insuredName &&
                        clientAnswer.includes(`yes(${insuredName.toLowerCase()})`)
                    ) {
                        const message = `${medicalDiscrepancyMessages[key].message}: Agent said ${agentAnswer === 'n' ? 'No' : 'Yes'}, Client said Yes.`;

                        insuredDiscrepanciesList.push(message);

                        // Add PDFs to insuredRequiredPdfs
                        medicalDiscrepancyMessages[key].pdf.forEach((pdfPath) => insuredRequiredPdfs.add(pdfPath));
                    }
                });

                if (insuredDiscrepanciesList.length > 0) {
                    discrepancies[insuredName] = insuredDiscrepanciesList;
                    requiredPdfs[insuredName] = Array.from(insuredRequiredPdfs);
                }
            }
        }

        return { discrepancies, requiredPdfs };
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
                                        const instructionText = medicalDiscrepancyMessages[pdfFileName.replace('.pdf', '')] || '';

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

            // Split client and agent answers into lists of insureds if they contain "yes(insureds)"
            const clientInsureds = clientAnswer.toLowerCase().includes('yes(')
                ? clientAnswer.match(/\(([^)]+)\)/)[1].split(',').map(name => name.trim().toLowerCase())
                : [];

            const agentInsureds = agentAnswer.toLowerCase().includes('yes(')
                ? agentAnswer.match(/\(([^)]+)\)/)[1].split(',').map(name => name.trim().toLowerCase())
                : [];

            // Check if any insured in clientInsureds matches the current insuredName
            return agentAnswer === 'n' && clientInsureds.includes(insuredName.toLowerCase());
        });
    };

    if (loading) {
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
                <div className="loading-container">Loading...</div>
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
                <div className="loading-container">No verification data available.</div>
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