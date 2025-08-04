import React, { useState, useEffect, useContext, forwardRef, useImperativeHandle, useMemo, useCallback } from 'react';
import { AuthContext } from '../../../context/AuthContext';
import api from '../../../api';
import DataTable from '../../utils/DataTable';
import ActionBar from '../../utils/ActionBar';
import { FiSend, FiMousePointer, FiCheckCircle, FiXCircle, FiClock, FiPlus, FiSearch, FiRefreshCw } from 'react-icons/fi';
import '../ProductionReports.css';
import { debounce } from 'lodash';

const VerifyTableComponent = React.forwardRef(({ onOpenRightPanel }, ref) => {
    const [verifyData, setVerifyData] = useState([]);
    const [verifyClientData, setVerifyClientData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('unverified');
    const [userIds, setUserIds] = useState([]);
    const [isArchiveView, setIsArchiveView] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    
    const { user } = useContext(AuthContext);
    
    // Check if user is admin
    const isAdmin = user?.Role === 'Admin';
    
    // Check if user is admin with teamRole="app" - show all data and enable context menu
    const isAppAdmin = user?.Role === 'Admin' && user?.teamRole === 'app';
    
    // Debug logging for app admin detection
    console.log('🏭 VerifyTable: Context menu access check', {
        userRole: user?.Role,
        teamRole: user?.teamRole,
        isAppAdmin,
        contextMenuEnabled: isAppAdmin
    });

    // Debounced search to improve performance - reduced to 150ms for smoother feel
    const debouncedSetSearch = useCallback(
        debounce((term) => {
            setDebouncedSearchTerm(term);
            setIsSearching(false);
        }, 150),
        []
    );

    // Update debounced search when searchTerm changes
    useEffect(() => {
        if (searchTerm !== debouncedSearchTerm) {
            setIsSearching(true);
        }
        debouncedSetSearch(searchTerm);
        return () => {
            debouncedSetSearch.cancel();
        };
    }, [searchTerm, debouncedSearchTerm, debouncedSetSearch]);

    // Handle search input changes with immediate visual feedback
    const handleSearchChange = useCallback((e) => {
        setSearchTerm(e.target.value);
    }, []);

    // Handle refresh button click
    const handleRefresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Refresh hierarchy info first (for non-app admins)
            if (!isAppAdmin) {
                await fetchHierarchyInfo();
            }
            // Then refresh verify data with current archive view
            await fetchVerifyData(isArchiveView);
        } catch (err) {
            setError('Error refreshing data: ' + err.message);
        }
    }, [isAppAdmin, isArchiveView]);
    
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

            // For app admins, don't fetch hierarchy - they can see all data
            if (isAppAdmin) {
                console.log('🏭 VerifyTable: App admin detected, showing all verification data');
                setUserIds([]); // Empty array means no filtering
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

    const fetchVerifyData = async (archiveView = isArchiveView) => {
        try {
            setLoading(true);
            // Fetch both verify and verify_client data with archive filter
            const archiveParam = archiveView ? 'true' : 'false';
            const [verifyResponse, verifyClientResponse] = await Promise.all([
                api.get(`/verify/all?archive=${archiveParam}`),
                api.get(`/verify/verifyclient/all?archive=${archiveParam}`)
            ]);

            const verifyResult = verifyResponse.data;
            const verifyClientResult = verifyClientResponse.data;

            if (verifyResult.success) {
                // For app admins, show all data. For others, filter by hierarchy
                const filteredData = isAppAdmin 
                    ? verifyResult.data 
                    : verifyResult.data.filter(row => userIds.includes(row.userId));
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
            if (isAppAdmin || userIds.length > 0) {
                await fetchVerifyData();
            }
        }
    }));

    const handleOpenVerificationForm = useCallback(() => {
        if (onOpenRightPanel) {
            onOpenRightPanel({
                __isVerificationDetails: true,
                isNew: true
            });
        }
    }, [onOpenRightPanel]);

    const handleRowClick = useCallback((row) => {
        if (onOpenRightPanel) {
            onOpenRightPanel({
                __isApplicationDetails: true,
                applicationId: row.application_id || row.id,
                verificationData: row
            });
        }
    }, [onOpenRightPanel]);

    useEffect(() => {
        fetchHierarchyInfo();
    }, [user?.userId]);

    useEffect(() => {
        // For app admins, fetch data immediately. For others, wait for userIds
        if (isAppAdmin || userIds.length > 0) {
            fetchVerifyData(isArchiveView);
        }
    }, [userIds, isAppAdmin, isArchiveView]);

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

    // Memoized columns for DataTable
    const columns = useMemo(() => [
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
            accessor: 'displayStatus', // Use displayStatus instead of status
            Cell: ({ value }) => {
                const statusStyle = getStatusColor(value);
                return (
                    <span style={{ 
                        padding: '2px 6px', 
                        borderRadius: '3px', 
                        fontSize: '10px',
                        ...statusStyle
                    }}>
                        {value}
                    </span>
                );
            },
            width: 120
        }
    ], []); // Removed activeTab dependency since displayStatus is now in the data

    // QUEUED: No client response + status = 'Queued' + archive status based on view
    const getQueuedData = useCallback(() => {
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
    }, [verifyData, verifyClientData, isArchiveView, isAdmin]);

    // UNVERIFIED: No client response + status != 'Queued' + archive status based on view
    const getUnverifiedData = useCallback(() => {
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
    }, [verifyData, verifyClientData, isArchiveView, isAdmin]);

    // VERIFIED: Has client response + no discrepancies + archive status based on view
    const getVerifiedData = useCallback(() => {
        const medicalKeys = [
            'amputation', 'anxiety_depression', 'cancer', 'cancer_senior', 'chronic_illness',
            'cirrhosis', 'diabetes', 'dui', 'er_visit', 'heart_issues', 'heart_lung',
            'high_blood_pressure', 'medications', 'oxygen', 'senior_rejected'
        ];

        return verifyData.filter((verifyRow) => {
            const matchingClientRow = verifyClientData.find(
                (clientRow) => clientRow.application_id === verifyRow.application_id
            );

            if (matchingClientRow) {
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
    }, [verifyData, verifyClientData, isArchiveView, isAdmin]);

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
    const getDiscrepancyData = useCallback(() => {
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

            // Check discrepancies in each medical question (using AdminVerify.js logic)
            medicalKeys.forEach((key) => {
                const agentAnswer = verifyRow[`${key}_answer`] || 'n';
                const clientAnswer = matchingClientRow[key] || 'n';

                // Extract insured names from 'yes(insureds)' format with data cleaning (same logic as AdminVerify.js)
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

                // Allow agent 'yes(insureds)' and client 'no' (same as AdminVerify.js)
                if (agentInsureds.length > 0 && clientAnswer === 'n') {
                    // This is acceptable, not a discrepancy
                    return;
                }

                // Check if client insureds are a subset of agent insureds (same as AdminVerify.js)
                const isSubset = clientInsureds.every(insured => agentInsureds.includes(insured));

                if (agentInsureds.length > 0 && clientInsureds.length > 0 && !isSubset) {
                    discrepancies.push({ question: key, agentAnswer, clientAnswer });
                    discrepancyReasons.push(`Discrepancy in ${key}: Mismatch in insureds. Agent: ${agentInsureds.join(',')}, Client: ${clientInsureds.join(',')}.`);
                }

                // Flag a mismatch if the client lists insureds but the agent says 'no' (same as AdminVerify.js)
                if (agentAnswer === 'n' && clientInsureds.length > 0) {
                    discrepancies.push({ question: key, agentAnswer, clientAnswer });
                    discrepancyReasons.push(`Discrepancy in ${key}: Agent answered 'No', but client answered 'Yes' for ${clientInsureds.join(', ')}.`);
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
    }, [verifyData, verifyClientData, isArchiveView, isAdmin]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'Received':
                return { backgroundColor: '#d4edda', color: '#155724' };
            case 'Verified':
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

    // Memoize current data based on active tab with proper displayStatus
    const currentTabData = useMemo(() => {
        let data = [];
        let displayStatus = '';
        
        switch (activeTab) {
            case 'queued':
                data = getQueuedData();
                displayStatus = 'Queued';
                break;
            case 'unverified':
                data = getUnverifiedData();
                displayStatus = 'Unverified';
                break;
            case 'verified':
                data = getVerifiedData();
                displayStatus = 'Verified';
                break;
            case 'discrepancy':
                data = getDiscrepancyData();
                displayStatus = 'Discrepancy';
                break;
            default:
                return [];
        }
        
        // Add displayStatus to each row based on the tab
        return data.map(row => ({
            ...row,
            displayStatus: activeTab === 'queued' || activeTab === 'unverified' 
                ? (row.status || displayStatus) // Use actual status for queued/unverified
                : displayStatus // Use tab-specific status for verified/discrepancy
        }));
    }, [activeTab, getQueuedData, getUnverifiedData, getVerifiedData, getDiscrepancyData]);

    // Pre-indexed search data for ultra-fast filtering
    const searchIndex = useMemo(() => {
        return currentTabData.map(row => ({
            ...row,
            searchableText: [
                row.agent_name || '',
                row.client_name || '',
                row.application_id || ''
            ].join(' ').toLowerCase()
        }));
    }, [currentTabData]);

    // Ultra-fast search filtering using pre-indexed data
    const currentData = useMemo(() => {
        if (!debouncedSearchTerm.trim()) return currentTabData;
        
        const searchLower = debouncedSearchTerm.toLowerCase();
        
        // Use simple string includes on pre-indexed text for maximum performance
        return searchIndex.filter(row => 
            row.searchableText.includes(searchLower)
        );
    }, [searchIndex, currentTabData, debouncedSearchTerm]);

    // Memoized data with IDs for DataTable
    const dataWithIds = useMemo(() => 
        currentData.map(row => ({
            ...row,
            id: row.application_id || row.id
        })), [currentData]
    );

    // Archive function to handle archiving applications
    const handleArchiveApplication = useCallback(async (applicationId) => {
        try {
            const response = await api.put('/verify/archive', {
                application_id: applicationId
            });

            if (response.data.success) {
                // Update local state to remove the archived application instead of reloading all data
                setVerifyData(prevData => 
                    prevData.filter(item => (item.application_id || item.id) !== applicationId)
                );
                console.log('Application archived successfully');
            } else {
                console.error('Failed to archive application:', response.data.message);
            }
        } catch (error) {
            console.error('Error archiving application:', error);
        }
    }, []);

    // Unarchive function to handle unarchiving applications
    const handleUnarchiveApplication = useCallback(async (applicationId) => {
        try {
            const response = await api.put('/verify/unarchive', {
                application_id: applicationId
            });

            if (response.data.success) {
                // Update local state to remove the unarchived application instead of reloading all data
                setVerifyData(prevData => 
                    prevData.filter(item => (item.application_id || item.id) !== applicationId)
                );
                console.log('Application unarchived successfully');
            } else {
                console.error('Failed to unarchive application:', response.data.message);
            }
        } catch (error) {
            console.error('Error unarchiving application:', error);
        }
    }, []);

    // Send Early function (for queued applications) - sends all queued emails
    const handleSendEarly = useCallback(async () => {
        try {
            const response = await api.post('/verify/send-queued');

            if (response.data.success) {
                // Refresh data to reflect status changes from 'Queued' to 'Sent'
                await fetchVerifyData(isArchiveView);
                console.log('Send early completed:', response.data.message);
            } else {
                console.error('Failed to send early:', response.data.message);
            }
        } catch (error) {
            console.error('Error sending early:', error);
        }
    }, [isArchiveView]);

    // Resend function (for unverified applications)
    const handleResend = useCallback(async (applicationId) => {
        try {
            const response = await api.post('/verify/resend', {
                application_id: applicationId
            });

            if (response.data.success) {
                // Update the local data to reflect the status change
                setVerifyData(prevData => 
                    prevData.map(item => 
                        (item.application_id || item.id) === applicationId 
                            ? { ...item, status: 'Resent by Staff', resend_count: (item.resend_count || 0) + 1 }
                            : item
                    )
                );
                console.log('Resend completed:', response.data.message);
            } else {
                console.error('Failed to resend:', response.data.message);
            }
        } catch (error) {
            console.error('Error resending:', error);
        }
    }, []);

    // Copy details function for verified applications
    const handleCopyVerifiedDetails = useCallback(() => {
        const textToCopy = 'survey verified';
        navigator.clipboard.writeText(textToCopy).then(() => {
            console.log('Copied to clipboard: survey verified');
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    }, []);

    // Medical discrepancy messages with "Needs" statements (same as ApplicationDetails)
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
    };

    // Parse insured info helper (same as ApplicationDetails)
    const parseInsuredInfoFunction = (info) => {
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

    // Function to get comprehensive discrepancy details (matching ApplicationDetails logic)
    const getDiscrepancyDetails = useCallback((verifyRow) => {
        const matchingClientRow = verifyClientData.find(clientRow => clientRow.application_id === verifyRow.application_id);
        
        if (!matchingClientRow) return null;
        
        const discrepancies = {};

        // Medical questions to check (same as ApplicationDetails)
        const medicalKeys = [
            'amputation', 'anxiety_depression', 'cancer', 'cancer_senior', 'chronic_illness',
            'cirrhosis', 'diabetes', 'dui', 'er_visit', 'heart_issues', 'heart_lung',
            'high_blood_pressure', 'medications', 'oxygen', 'senior_rejected'
        ];

        // Get all insureds (same as ApplicationDetails)
        const insureds = {
            Primary: verifyRow.primary_info,
            Spouse: verifyRow.spouse_info,
            Child1: verifyRow.child1_info,
            Child2: verifyRow.child2_info,
            Child3: verifyRow.child3_info,
            Child4: verifyRow.child4_info,
            Child5: verifyRow.child5_info,
            Child6: verifyRow.child6_info,
            Child7: verifyRow.child7_info,
            Child8: verifyRow.child8_info,
            Child9: verifyRow.child9_info,
        };

        // Check each insured for discrepancies (same logic as ApplicationDetails)
        for (const [insuredType, insuredInfo] of Object.entries(insureds)) {
            if (insuredInfo && insuredInfo !== 'n/a') {
                const [insuredName] = insuredInfo.split(',');
                const insuredDiscrepanciesList = [];

                medicalKeys.forEach((key) => {
                    const agentAnswer = verifyRow[`${key}_answer`] || 'n';
                    const clientAnswer = matchingClientRow[key] || 'n';

                    // Extract insured names from answers for comparison with data cleaning (same as ApplicationDetails)
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

                    // Simple discrepancy check (same as ApplicationDetails):
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

        // Check other fields for discrepancies - these go under "General" (same as ApplicationDetails)
        const generalDiscrepancies = [];
        
        if (matchingClientRow.account_verification === 'n') {
            generalDiscrepancies.push('Account verification failed');
        }
        
        if (matchingClientRow.application_verification === 'n') {
            generalDiscrepancies.push('Application verification failed');
        }
        
        if (matchingClientRow.agent_contact_request && matchingClientRow.agent_contact_request.toLowerCase() !== 'no') {
            generalDiscrepancies.push('Agent contact request present');
        }
        
        if (verifyRow.agent_ip === matchingClientRow.client_ip) {
            generalDiscrepancies.push('IP addresses match between agent and client');
        }

        // Add general discrepancies if any exist
        if (generalDiscrepancies.length > 0) {
            discrepancies['General'] = generalDiscrepancies;
        }

        return discrepancies;
    }, [verifyClientData]);

    // Copy details function for discrepancy applications (matching ApplicationDetails format)
    const handleCopyDiscrepancyDetails = useCallback((row) => {
        const discrepancies = getDiscrepancyDetails(row);
        
        if (!discrepancies || Object.keys(discrepancies).length === 0) {
            const textToCopy = 'No discrepancies found';
            navigator.clipboard.writeText(textToCopy);
            console.log('Copied to clipboard: No discrepancies found');
            return;
        }

        // Format discrepancies same as ApplicationDetails getDiscrepancyDataForCopy
        const discrepancyText = [];
        
        Object.entries(discrepancies).forEach(([insuredName, messages]) => {
            discrepancyText.push(`${insuredName}:`);
            messages.forEach(message => {
                discrepancyText.push(`  - ${message}`);
            });
        });

        const fullText = `Discrepancies for ${row.client_name}:\n${discrepancyText.join('\n')}`;
        navigator.clipboard.writeText(fullText).then(() => {
            console.log('Copied comprehensive discrepancy details to clipboard');
        }).catch(err => {
            console.error('Failed to copy discrepancy details: ', err);
        });
    }, [getDiscrepancyDetails]);

    // Get context menu options for rows (only for app admins)
    const getRowContextMenuOptions = useCallback((row) => {
        // Double-check permissions as an extra safety measure
        if (!isAppAdmin) {
            console.warn('🚫 VerifyTable: Context menu access denied - user is not app admin');
            return [];
        }

        const options = [];

        if (isArchiveView) {
            // When viewing archived applications, show unarchive option
            options.push({
                label: 'Unarchive',
                icon: '📤',
                onClick: () => handleUnarchiveApplication(row.application_id || row.id),
                className: 'menu-item-unarchive'
            });
        } else {
            // When viewing current applications, show context-specific options
            
            // Add tab-specific options first
            if (activeTab === 'queued') {
                options.push({
                    label: 'Send Early',
                    icon: '🚀',
                    onClick: () => {
                        if (window.confirm('This will send emails to ALL queued applications. Continue?')) {
                            handleSendEarly();
                        }
                    },
                    className: 'menu-item-send-early'
                });
            } else if (activeTab === 'unverified') {
                options.push({
                    label: 'Resend',
                    icon: '🔄',
                    onClick: () => {
                        if (window.confirm(`Resend verification email to ${row.client_name}?`)) {
                            handleResend(row.application_id || row.id);
                        }
                    },
                    className: 'menu-item-resend'
                });
            } else if (activeTab === 'verified') {
                options.push({
                    label: 'Copy Details',
                    icon: '📋',
                    onClick: () => handleCopyVerifiedDetails(),
                    className: 'menu-item-copy'
                });
            } else if (activeTab === 'discrepancy') {
                options.push({
                    label: 'Copy Details',
                    icon: '📋',
                    onClick: () => handleCopyDiscrepancyDetails(row),
                    className: 'menu-item-copy'
                });
            }

            // Always show archive option for current applications
            options.push({
                label: 'Archive',
                icon: '📁',
                onClick: () => handleArchiveApplication(row.application_id || row.id),
                className: 'menu-item-archive'
            });
        }

        return options;
    }, [handleArchiveApplication, handleUnarchiveApplication, handleSendEarly, handleResend, handleCopyVerifiedDetails, handleCopyDiscrepancyDetails, isArchiveView, activeTab, isAppAdmin]);

    // Memoized DataTable component to prevent unnecessary re-renders
    const MemoizedDataTable = useMemo(() => (
        <DataTable
            columns={columns}
            data={dataWithIds}
            entityName="applications"
            archivedView={isArchiveView}
            disablePagination={false}
            disableCellEditing={true}
            showActionBar={false}
            onRowClick={handleRowClick}
            enableRowContextMenu={isAppAdmin} // Only enable context menu for app admins
            getRowContextMenuOptions={isAppAdmin ? getRowContextMenuOptions : undefined}
            // Add totals for queued applications
            showTotals={activeTab === 'queued'}
            totalsPosition="bottom"
            totalsColumns={['total_annual_premium']}
            totalsLabel="Total Annual Premium"
            totalsLabelColumn="client_name"
            // Performance optimizations
            initialPageSize={50}
            pageSizeOptions={[25, 50, 100, 200]}
        />
    ), [columns, dataWithIds, isArchiveView, handleRowClick, activeTab, getRowContextMenuOptions, isAppAdmin]);

    // Memoized tab counts to prevent recalculation on every render
    const tabCounts = useMemo(() => ({
        queued: getQueuedData().length,
        unverified: getUnverifiedData().length,
        verified: getVerifiedData().length,
        discrepancy: getDiscrepancyData().length
    }), [getQueuedData, getUnverifiedData, getVerifiedData, getDiscrepancyData]);

    if (loading) return <div>Loading verification data...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
        <div style={{ position: 'relative' }}>
            {/* Add CSS animation for spinner */}
            <style>
                {`
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                `}
            </style>
            <div style={{ position: 'relative' }}>
                {/* Search Bar */}
                <div style={{ marginBottom: '16px' }}>
                    <div className="reports-search">
                        <div className="search-input-wrapper">
                            <FiSearch className="search-icon" style={{ 
                                color: isSearching ? '#00558c' : undefined,
                                opacity: isSearching ? 0.8 : undefined 
                            }} />
                            <input
                                type="text"
                                placeholder="Search by agent name, client name, or application ID..."
                                value={searchTerm}
                                onChange={handleSearchChange}
                                className="search-input"
                                style={{ 
                                    borderColor: isSearching ? '#00558c' : undefined,
                                    transition: 'border-color 0.2s ease'
                                }}
                            />
                            {isSearching && (
                                <div style={{
                                    position: 'absolute',
                                    right: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: '#00558c',
                                    fontSize: '12px'
                                }}>
                                    Searching...
                                </div>
                            )}
                        </div>
                    </div>
                </div>

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
                            ({tabCounts.queued})
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
                            ({tabCounts.unverified})
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
                            ({tabCounts.verified})
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
                            ({tabCounts.discrepancy})
                        </button>
                    </div>

                    {/* Controls */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {/* Refresh Button */}
                        <button
                            onClick={handleRefresh}
                            disabled={loading}
                            style={{
                                padding: '8px',
                                backgroundColor: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: loading ? 0.6 : 1
                            }}
                            title="Refresh Data"
                        >
                            <FiRefreshCw 
                                size={16} 
                                style={{ 
                                    animation: loading ? 'spin 1s linear infinite' : 'none',
                                    transformOrigin: 'center'
                                }} 
                            />
                        </button>

                        {/* Add Form Button - Hidden for app admin users */}
                        {!isAppAdmin && (
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
                        )}

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
                {MemoizedDataTable}
            </div>
        </div>
    );
});

VerifyTableComponent.displayName = 'VerifyTable';

const VerifyTable = React.memo(VerifyTableComponent);

export default VerifyTable; 