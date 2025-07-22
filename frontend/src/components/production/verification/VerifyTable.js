import React, { useState, useEffect, useContext, forwardRef, useImperativeHandle } from 'react';
import { AuthContext } from '../../../context/AuthContext';
import api from '../../../api';
import DataTable from '../../utils/DataTable';
import ActionBar from '../../utils/ActionBar';
import { FiSend, FiMousePointer, FiCheckCircle, FiXCircle, FiClock, FiPlus } from 'react-icons/fi';

const VerifyTable = forwardRef(({ onOpenRightPanel }, ref) => {
    const [verifyData, setVerifyData] = useState([]);
    const [verifyClientData, setVerifyClientData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('unverified');
    const [userIds, setUserIds] = useState([]);
    const [isArchiveView, setIsArchiveView] = useState(false);
    
    const { user } = useContext(AuthContext);
    
    // Check if user is admin
    const isAdmin = user?.Role === 'Admin';
    
    // Helper function to check if a date is within the last week
    const isWithinLastWeek = (dateString) => {
        if (!dateString) return false;
        const date = new Date(dateString);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return date >= weekAgo;
    };

    const fetchHierarchyInfo = async () => {
        try {
            if (!user?.userId) {
                setError('User ID not found');
                return;
            }

            const response = await api.post('/auth/searchByUserId', { 
                userId: user.userId 
            });

            if (response.data.success) {
                setUserIds(response.data.data.map(user => user.id));
            } else {
                setError('Failed to fetch hierarchy information');
            }
        } catch (err) {
            setError('Error fetching hierarchy information: ' + err.message);
        }
    };

    const fetchVerifyData = async () => {
        try {
            setLoading(true);
            // Fetch both verify and verify_client data
            const [verifyResponse, verifyClientResponse] = await Promise.all([
                api.get('/verify/all'),
                api.get('/verify/verifyclient/all')
            ]);

            const verifyResult = verifyResponse.data;
            const verifyClientResult = verifyClientResponse.data;

            if (verifyResult.success) {
                // Filter data to only show applications from users in the hierarchy
                const filteredData = verifyResult.data.filter(row => userIds.includes(row.userId));
                setVerifyData(filteredData);
            } else {
                setError('Failed to fetch verification data');
            }

            if (verifyClientResult.success) {
                setVerifyClientData(verifyClientResult.data);
            } else {
                console.warn('Failed to fetch verify client data');
                setVerifyClientData([]);
            }
        } catch (err) {
            setError('Error fetching data: ' + err.message);
            console.error('Error fetching verification data:', err);
        } finally {
            setLoading(false);
        }
    };

    // Expose refresh method to parent component
    useImperativeHandle(ref, () => ({
        refreshData: async () => {
            if (userIds.length > 0) {
                await fetchVerifyData();
            }
        }
    }));

    const handleOpenVerificationForm = () => {
        if (onOpenRightPanel) {
            onOpenRightPanel({
                __isVerificationDetails: true,
                isNew: true
            });
        }
    };

    const handleRowClick = (row) => {
        if (onOpenRightPanel) {
            onOpenRightPanel({
                __isApplicationDetails: true,
                applicationId: row.application_id || row.id,
                verificationData: row
            });
        }
    };

    useEffect(() => {
        fetchHierarchyInfo();
    }, [user?.userId]);

    useEffect(() => {
        if (userIds.length > 0) {
            fetchVerifyData();
        }
    }, [userIds]);

    const parseInsuredInfo = (info) => {
        if (!info || info === 'n/a,0,n,n') return null;
        const [name, premium, trial, senior] = info.split(',');
        if (name === 'n/a') return null;

        return {
            name,
            premium,
            trial: trial === 'y' ? 'Trial' : 'Standard',
            type: senior === 'y' ? 'Senior' : 'Super Combo',
        };
    };

    const getSaleType = (row) => {
        const insureds = [];
        if (parseInsuredInfo(row.primary_info)) insureds.push(parseInsuredInfo(row.primary_info).type);
        if (parseInsuredInfo(row.spouse_info)) insureds.push(parseInsuredInfo(row.spouse_info).type);

        for (let i = 1; i <= 9; i++) {
            const childInfo = parseInsuredInfo(row[`child${i}_info`]);
            if (childInfo) insureds.push('Super Combo');
        }

        const allSenior = insureds.every((type) => type === 'Senior');
        const noSeniors = insureds.every((type) => type === 'Super Combo');

        return allSenior ? 'Senior' : noSeniors ? 'Super Combo' : 'Super Combo/Senior';
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    };

    // Define columns for DataTable
    const columns = [
        {
            Header: 'Date',
            accessor: 'created_at',
            Cell: ({ value }) => formatDate(value),
            width: 100
        },
        {
            Header: 'Agent',
            accessor: 'agent_name',
            width: 200
        },
        {
            Header: 'Client Name',
            accessor: 'client_name',
            width: 200
        },
        {
            Header: 'Annual Premium',
            accessor: 'total_annual_premium',
            Cell: ({ value }) => `$${value}`,
            width: 130
        },
        {
            Header: 'Sale Type',
            accessor: 'sale_type',
            Cell: ({ row }) => getSaleType(row.original),
            width: 150
        },
        {
            Header: 'Status',
            accessor: 'status',
            Cell: ({ value, row }) => {
                const displayStatus = activeTab === 'discrepancy' ? 'Discrepancy' : (value || 'Unverified');
                const statusStyle = getStatusColor(displayStatus);
                return (
                    <span style={{ 
                        padding: '2px 6px', 
                        borderRadius: '3px', 
                        fontSize: '10px',
                        ...statusStyle
                    }}>
                        {displayStatus}
                    </span>
                );
            },
            width: 120
        }
    ];

    // QUEUED: No client response + status = 'Queued' + archive status based on view
    const getQueuedData = () => {
        return verifyData.filter(
            (verifyRow) => {
                const matchesArchiveView = isArchiveView ? 
                    (verifyRow.archive === 'y' && (isAdmin || isWithinLastWeek(verifyRow.created_at))) :
                    verifyRow.archive !== 'y';
                
                return !verifyClientData.some((clientRow) => clientRow.application_id === verifyRow.application_id) &&
                    verifyRow.status === 'Queued' &&
                    matchesArchiveView;
            }
        );
    };

    // UNVERIFIED: No client response + status != 'Queued' + archive status based on view
    const getUnverifiedData = () => {
        return verifyData.filter(
            (verifyRow) => {
                const matchesArchiveView = isArchiveView ? 
                    (verifyRow.archive === 'y' && (isAdmin || isWithinLastWeek(verifyRow.created_at))) :
                    verifyRow.archive !== 'y';
                
                return !verifyClientData.some((clientRow) => clientRow.application_id === verifyRow.application_id) &&
                    verifyRow.status !== 'Queued' &&
                    matchesArchiveView;
            }
        );
    };

    // VERIFIED: Has client response + no discrepancies + archive status based on view
    const getVerifiedData = () => {
        return verifyData.filter((verifyRow) => {
            const matchingClientRow = verifyClientData.find(
                (clientRow) => clientRow.application_id === verifyRow.application_id
            );

            if (matchingClientRow) {
                // Define medical questions keys
                const medicalKeys = [
                    'amputation', 'anxiety_depression', 'cancer', 'cancer_senior', 'chronic_illness',
                    'cirrhosis', 'diabetes', 'dui', 'er_visit', 'heart_issues', 'heart_lung',
                    'high_blood_pressure', 'medications', 'oxygen', 'senior_rejected'
                ];

                // Allow rows where answers match exactly, whether they are both "n" or both "yes(insureds)"
                const allMedicalMatch = !medicalKeys.some((key) => {
                    const agentAnswer = verifyRow[`${key}_answer`];
                    const clientAnswer = matchingClientRow[key];
                    return agentAnswer !== clientAnswer;
                });

                const noVerificationIssues = (
                    matchingClientRow.account_verification === 'y' &&
                    matchingClientRow.application_verification === 'y' &&
                    matchingClientRow.agent_contact_request === 'No'
                );

                const ipAddressMismatch = verifyRow.agent_ip === matchingClientRow.client_ip;

                const matchesArchiveView = isArchiveView ? 
                    (verifyRow.archive === 'y' && (isAdmin || isWithinLastWeek(verifyRow.created_at))) :
                    verifyRow.archive !== 'y';

                return allMedicalMatch && noVerificationIssues && !ipAddressMismatch && matchesArchiveView;
            }

            return false;
        });
    };

    const hasDiscrepancies = (verifyRow, clientRow) => {
        // Define medical questions keys
        const medicalKeys = [
            'amputation', 'anxiety_depression', 'cancer', 'cancer_senior', 'chronic_illness', 
            'cirrhosis', 'diabetes', 'dui', 'er_visit', 'heart_issues', 'heart_lung', 
            'high_blood_pressure', 'medications', 'oxygen', 'senior_rejected'
        ];

        // Check medical questions - only consider it a discrepancy if agent said "No" and client did not
        for (const key of medicalKeys) {
            const agentAnswer = verifyRow[`${key}_answer`];
            const clientAnswer = clientRow[key];
            
            // Only consider it a discrepancy if agent said "No" and client did not say "No"
            if (agentAnswer === 'n' && clientAnswer !== 'n') {
                return true;
            }
        }

        // Check for discrepancies in other fields
        if (clientRow.account_verification === 'n') return true;
        if (clientRow.application_verification === 'n') return true;
        if (clientRow.agent_contact_request !== 'No') return true;

        // Check IP address match (considered suspicious)
        if (verifyRow.agent_ip === clientRow.client_ip) return true;
        
        return false;
    };

    // DISCREPANCY: Has client response + has discrepancies + archive status based on view
    const getDiscrepancyData = () => {
        return verifyData.map(verifyRow => {
            const matchingClientRow = verifyClientData.find(clientRow => clientRow.application_id === verifyRow.application_id);
            
            if (!matchingClientRow) return null;
            
            const discrepancies = [];
            const discrepancyReasons = []; // Array to store detailed reasons for discrepancies

            // Define medical questions keys
            const medicalKeys = [
                'amputation', 'anxiety_depression', 'cancer', 'cancer_senior', 'chronic_illness', 
                'cirrhosis', 'diabetes', 'dui', 'er_visit', 'heart_issues', 'heart_lung', 
                'high_blood_pressure', 'medications', 'oxygen', 'senior_rejected'
            ];

            // Check discrepancies in each medical question
            medicalKeys.forEach((key) => {
                const agentAnswer = verifyRow[`${key}_answer`];
                const clientAnswer = matchingClientRow[key];
                
                // Only consider it a discrepancy if agent said "No" and client did not
                if (agentAnswer === 'n' && clientAnswer !== 'n') {
                    discrepancies.push({ question: key, agentAnswer, clientAnswer });
                    discrepancyReasons.push(`Discrepancy in ${key}: Agent answered 'No', Client answered '${clientAnswer}'.`);
                }
            });

            // Check for discrepancies in other fields
            if (matchingClientRow.account_verification === 'n') {
                discrepancies.push({ question: 'account_verification', issue: 'Account verification failed' });
                discrepancyReasons.push("Discrepancy in account verification: Client verification failed.");
            }
            if (matchingClientRow.application_verification === 'n') {
                discrepancies.push({ question: 'application_verification', issue: 'Application verification failed' });
                discrepancyReasons.push("Discrepancy in application verification: Application verification failed.");
            }
            if (matchingClientRow.agent_contact_request !== 'No') {
                discrepancies.push({ question: 'agent_contact_request', issue: 'Agent contact request present' });
                discrepancyReasons.push(`Agent contact request discrepancy: Client requested contact with agent.`);
            }

            // Add IP address match as a discrepancy if needed
            if (verifyRow.agent_ip === matchingClientRow.client_ip) {
                discrepancies.push({ question: 'IP Match', issue: 'IP address matches between agent and client' });
                discrepancyReasons.push("IP address discrepancy: IP addresses match between agent and client.");
            }

   

            return {
                ...verifyRow,
                discrepancies,
            };
        }).filter(row => {
            if (!row) return false; // Filter out null rows first
            
            const matchesArchiveView = isArchiveView ? 
                (row.archive === 'y' && (isAdmin || isWithinLastWeek(row.created_at))) :
                row.archive !== 'y';
            
            return row.discrepancies && row.discrepancies.length > 0 && matchesArchiveView;
        });
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Received':
                return { backgroundColor: '#d4edda', color: '#155724' };
            case 'Queued':
                return { backgroundColor: '#fff3cd', color: '#856404' };
            case 'Discrepancy':
                return { backgroundColor: '#f8d7da', color: '#721c24' };
            case 'Unverified':
            default:
                return { backgroundColor: '#e2e3e5', color: '#383d41' };
        }
    };

    // Get current data based on active tab
    const getCurrentData = () => {
        switch (activeTab) {
            case 'queued':
                return getQueuedData();
            case 'unverified':
                return getUnverifiedData();
            case 'verified':
                return getVerifiedData();
            case 'discrepancy':
                return getDiscrepancyData();
            default:
                return [];
        }
    };

    const currentData = getCurrentData();

    // Ensure data has id field for DataTable
    const dataWithIds = currentData.map(row => ({
        ...row,
        id: row.application_id || row.id
    }));

    if (loading) return <div>Loading verification data...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
        <div style={{ position: 'relative' }}>
            <div style={{ position: 'relative' }}>
                {/* ActionBar with status tabs and controls */}
                <ActionBar
                    selectedCount={0}
                    totalCount={currentData.length}
                    entityName="applications"
                    archivedView={isArchiveView}
                >
                    {/* Status Tabs */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                            onClick={() => setActiveTab('queued')}
                            style={{
                                padding: '8px 12px',
                                backgroundColor: activeTab === 'queued' ? '#00558c' : 'transparent',
                                color: activeTab === 'queued' ? 'white' : '#666',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            <FiSend size={14} />
                            ({getQueuedData().length})
                        </button>
                        <button
                            onClick={() => setActiveTab('unverified')}
                            style={{
                                padding: '8px 12px',
                                backgroundColor: activeTab === 'unverified' ? '#00558c' : 'transparent',
                                color: activeTab === 'unverified' ? 'white' : '#666',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            <FiClock size={14} />
                            ({getUnverifiedData().length})
                        </button>
                        <button
                            onClick={() => setActiveTab('verified')}
                            style={{
                                padding: '8px 12px',
                                backgroundColor: activeTab === 'verified' ? '#00558c' : 'transparent',
                                color: activeTab === 'verified' ? 'white' : '#666',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            <FiCheckCircle size={14} />
                            ({getVerifiedData().length})
                        </button>
                        <button
                            onClick={() => setActiveTab('discrepancy')}
                            style={{
                                padding: '8px 12px',
                                backgroundColor: activeTab === 'discrepancy' ? '#00558c' : 'transparent',
                                color: activeTab === 'discrepancy' ? 'white' : '#666',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            <FiXCircle size={14} />
                            ({getDiscrepancyData().length})
                        </button>
                    </div>

                    {/* Controls */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {/* Add Form Button */}
                        <button
                            onClick={handleOpenVerificationForm}
                            style={{
                                padding: '8px',
                                backgroundColor: '#00558c',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            title="Add New Verification"
                        >
                            <FiPlus size={16} />
                        </button>

                        {/* Archive view toggle - Eye icon */}
                        <div 
                            className={`archive-toggle icon-only ${isArchiveView ? 'active' : ''}`}
                            onClick={() => setIsArchiveView(!isArchiveView)}
                            title={isArchiveView ? 'Show Current Applications' : `Show Archived Applications${!isAdmin ? ' (Last 7 days)' : ''}`}
                            style={{
                                padding: '8px',
                                cursor: 'pointer',
                                borderRadius: '4px',
                                backgroundColor: isArchiveView ? '#00558c' : 'transparent',
                                color: isArchiveView ? 'white' : '#666',
                                border: '1px solid #ddd',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <svg 
                                width="18" 
                                height="18" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                {isArchiveView ? (
                                    // Open eye icon (showing archived)
                                    <path 
                                        d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" 
                                        stroke="currentColor" 
                                        strokeWidth="2" 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round"
                                    />
                                ) : (
                                    // Closed eye icon (hiding archived)
                                    <>
                                        <path 
                                            d="m1 1 22 22 M9.88 9.88a3 3 0 1 0 4.24 4.24 M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 8 11 8a13.16 13.16 0 0 1-1.67 2.68 M6.61 6.61A13.526 13.526 0 0 0 1 12s4 8 11 8a9.74 9.74 0 0 0 5-1.28" 
                                            stroke="currentColor" 
                                            strokeWidth="2" 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round"
                                        />
                                    </>
                                )}
                            </svg>
                        </div>
                    </div>
                </ActionBar>

                {/* DataTable without built-in ActionBar */}
                <DataTable
                    columns={columns}
                    data={dataWithIds}
                    entityName="applications"
                    archivedView={isArchiveView}
                    disablePagination={true}
                    disableCellEditing={true}
                    showActionBar={false}
                    onRowClick={handleRowClick}
                />
            </div>
        </div>
    );
});

export default VerifyTable; 