import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AuthContext } from '../../context/AuthContext';
import DataTable from '../utils/DataTable';
import api from '../../api';
import './PromotionTracking.css';

const PromotionTracking = () => {
    const { user } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [promotionData, setPromotionData] = useState(null);
    const [selectedMonths, setSelectedMonths] = useState([]);
    const [agentType, setAgentType] = useState('GA'); // 'GA' or 'SA'

    // Check if user has app admin permissions
    const isAppAdmin = user?.Role === 'Admin' && user?.teamRole === 'app';

    useEffect(() => {
        // Verify user has access to this component
        if (!isAppAdmin) {
            setError('Access denied. Only app team administrators can access promotion tracking.');
            return;
        }

        // Initialize with current month and previous month
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
        
        const month1 = `${String(prevMonth).padStart(2, '0')}/${prevYear}`;
        const month2 = `${String(currentMonth).padStart(2, '0')}/${currentYear}`;
        
        setSelectedMonths([month1, month2]);
    }, [isAppAdmin]);

    useEffect(() => {
        if (selectedMonths.length === 2) {
            fetchPromotionData();
        }
    }, [selectedMonths]);

    useEffect(() => {
        if (selectedMonths.length === 2) {
            fetchPromotionData();
        }
    }, [agentType]);

    const fetchPromotionData = async () => {
        try {
            setLoading(true);
            const response = await api.get('/verify/promotion-tracking', {
                params: { 
                    months: selectedMonths,
                    agentType: agentType
                }
            });
            
            if (response.data.success) {
                setPromotionData(response.data.data);
                console.log('🏆 Promotion data loaded:', response.data.data);
            } else {
                setError(response.data.message || 'Failed to load promotion data');
            }
        } catch (error) {
            console.error('Error fetching promotion data:', error);
            setError('Error loading promotion data: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const navigateMonths = (direction) => {
        if (selectedMonths.length !== 2) return;
        
        const [month1, month2] = selectedMonths;
        const [month1Num, year1] = month1.split('/').map(Number);
        const [month2Num, year2] = month2.split('/').map(Number);
        
        let newMonth1, newMonth2;
        
        if (direction === 'backward') {
            // Go back one month
            if (month1Num === 1) {
                newMonth1 = 12;
                newMonth2 = month1Num;
            } else {
                newMonth1 = month1Num - 1;
                newMonth2 = month1Num;
            }
            const newYear1 = month1Num === 1 ? year1 - 1 : year1;
            const newYear2 = year1;
            
            newMonth1 = `${String(newMonth1).padStart(2, '0')}/${newYear1}`;
            newMonth2 = `${String(newMonth2).padStart(2, '0')}/${newYear2}`;
        } else {
            // Go forward one month
            if (month2Num === 12) {
                newMonth1 = month2Num;
                newMonth2 = 1;
            } else {
                newMonth1 = month2Num;
                newMonth2 = month2Num + 1;
            }
            const newYear1 = year2;
            const newYear2 = month2Num === 12 ? year2 + 1 : year2;
            
            newMonth1 = `${String(newMonth1).padStart(2, '0')}/${newYear1}`;
            newMonth2 = `${String(newMonth2).padStart(2, '0')}/${newYear2}`;
        }
        
        setSelectedMonths([newMonth1, newMonth2]);
    };

    const getStatusPriority = (status) => {
        switch (status) {
            case 'Ready for Promotion': return 1;
            case 'Near Goal': return 2;
            case 'In Progress': return 3;
            default: return 4;
        }
    };

    const sortAgentsByStatus = (agents) => {
        return [...agents].sort((a, b) => {
            const aNetLvl3 = parseFloat(a.lvl_2_net_total);
            const aF6Lvl3 = parseFloat(a.lvl_2_f6_net_total);
            const bNetLvl3 = parseFloat(b.lvl_2_net_total);
            const bF6Lvl3 = parseFloat(b.lvl_2_f6_net_total);
            
            const requirements = getRequirements();
            
            const aStatus = getStatus(aNetLvl3, aF6Lvl3, requirements.netLvl3Threshold, requirements.f6Lvl3Threshold);
            const bStatus = getStatus(bNetLvl3, bF6Lvl3, requirements.netLvl3Threshold, requirements.f6Lvl3Threshold);
            
            const aPriority = getStatusPriority(aStatus);
            const bPriority = getStatusPriority(bStatus);
            
            // First sort by status priority
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            
            // If same status, sort by combined total (highest first)
            const aCombined = aNetLvl3 + aF6Lvl3;
            const bCombined = bNetLvl3 + bF6Lvl3;
            return bCombined - aCombined;
        });
    };

    const getStatus = (netLvl3Total, f6Lvl3Total, netThreshold, f6Threshold) => {
        if (netLvl3Total >= netThreshold && f6Lvl3Total >= f6Threshold) return 'Ready for Promotion';
        if (netLvl3Total >= netThreshold * 0.8 && f6Lvl3Total >= f6Threshold * 0.8) return 'Near Goal';
        return 'In Progress';
    };

    const getStatusColor = (netLvl3Total, f6Lvl3Total, netThreshold, f6Threshold) => {
        if (netLvl3Total >= netThreshold && f6Lvl3Total >= f6Threshold) return '#28a745';
        if (netLvl3Total >= netThreshold * 0.8 && f6Lvl3Total >= f6Threshold * 0.8) return '#ffc107';
        return '#dc3545';
    };

    const getRequirements = () => {
        if (agentType === 'SA') {
            return {
                netLvl3Threshold: 50000,
                f6Lvl3Threshold: 25000
            };
        }
        // Default to GA requirements
        return {
            netLvl3Threshold: 120000,
            f6Lvl3Threshold: 60000
        };
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    // Memoized columns for DataTable - must be at top level before any conditional returns
    const columns = useMemo(() => {
        const requirements = getRequirements();
        const isSA = agentType === 'SA';
        
        return [
            {
                Header: 'Agent',
                accessor: 'LagnName',
                Cell: ({ value }) => (
                    <div className="agent-info">
                        <strong>{value}</strong>
                    </div>
                ),
                width: 200
            },
            {
                Header: isSA ? 'LVL 2 NET' : 'NET ALP',
                accessor: isSA ? 'lvl_2_net_total' : 'lvl_2_net_total',
                Cell: ({ value }) => <span className="currency-value">{formatCurrency(value)}</span>,
                width: 150
            },
            {
                Header: isSA ? 'LVL 2 F6 NET' : 'F6 NET',
                accessor: isSA ? 'lvl_2_f6_net_total' : 'lvl_2_f6_net_total',
                Cell: ({ value }) => <span className="currency-value">{formatCurrency(value)}</span>,
                width: 150
            },
            {
                Header: 'MGA',
                accessor: 'mga',
                Cell: ({ value }) => {
                    // Extract last name from MGA (assuming MGA is in "Last First Middle Suffix" format)
                    if (!value) return <span className="mga-info">N/A</span>;
                    const parts = value.split(' ').filter(part => part.length > 0);
                    const lastName = parts[0] || value;
                    return <span className="mga-info">{lastName}</span>;
                },
                width: 120
            },
            {
                Header: 'Status',
                accessor: 'status',
                Cell: ({ row }) => {
                    const netLvl3Total = parseFloat(row.original.lvl_2_net_total);
                    const f6Lvl3Total = parseFloat(row.original.lvl_2_f6_net_total);
                    const status = getStatus(netLvl3Total, f6Lvl3Total, requirements.netLvl3Threshold, requirements.f6Lvl3Threshold);
                    
                    return (
                        <span 
                            className="status-badge"
                            style={{ backgroundColor: getStatusColor(netLvl3Total, f6Lvl3Total, requirements.netLvl3Threshold, requirements.f6Lvl3Threshold) }}
                        >
                            {status}
                        </span>
                    );
                },
                width: 150
            },
        ];
    }, [agentType]);

    if (error) {
        return (
            <div className="promotion-tracking-container">
                <div className="error-message">
                    <h2>Access Denied</h2>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="promotion-tracking-container">
                <div className="loading-message">
                    <div className="loading-spinner"></div>
                    <p>Loading Promotion Tracking...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="promotion-tracking-container">
            <div className="promotion-tracking-content">
                {promotionData && (
                    <>
                        <div className="promotion-tracking-main">
                            <div className="section-card">
                                <div className="section-header">
                                    <h2>Promotions</h2>
                                    <div className="agent-type-tabs">
                                        <button 
                                            className={`tab-btn ${agentType === 'GA' ? 'active' : ''}`}
                                            onClick={() => setAgentType('GA')}
                                        >
                                            GA Agents
                                        </button>
                                        <button 
                                            className={`tab-btn ${agentType === 'SA' ? 'active' : ''}`}
                                            onClick={() => setAgentType('SA')}
                                        >
                                            SA Agents
                                        </button>
                                    </div>
                                    <div className="month-navigation">
                                        <div className="month-display">
                                            <span className="month-label">Tracking Period:</span>
                                            <span className="month-values">{selectedMonths.join(' & ')}</span>
                                        </div>
                                        <div className="month-controls">
                                            <button 
                                                className="month-nav-btn"
                                                onClick={() => navigateMonths('backward')}
                                                title="Previous months"
                                            >
                                                ◀
                                            </button>
                                            <button 
                                                className="month-nav-btn"
                                                onClick={() => navigateMonths('forward')}
                                                title="Next months"
                                            >
                                                ▶
                                            </button>
                                        </div>
                                    </div>
                                    <div className="threshold-info">
                                        <div className="threshold-requirements">
                                            <span><strong>Promotion Requirements:</strong></span>
                                            <span>Net LVL 3: {formatCurrency(getRequirements().netLvl3Threshold)}</span>
                                            <span>F6 LVL 3: {formatCurrency(getRequirements().f6Lvl3Threshold)}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {promotionData.agents.length === 0 ? (
                                    <div className="empty-state">
                                        <p>No {agentType} agents found for the tracking period.</p>
                                    </div>
                                ) : (
                                    <DataTable
                                        columns={columns}
                                        data={sortAgentsByStatus(promotionData.agents)}
                                        entityName="agents"
                                        disableCellEditing={true}
                                        showActionBar={true}
                                        disablePagination={false}
                                        initialPageSize={25}
                                        pageSizeOptions={[25, 50, 100]}
                                    />
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default PromotionTracking; 