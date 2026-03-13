import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AuthContext } from '../../context/AuthContext';
import DataTable from '../utils/DataTable';
import { FiDownload, FiChevronDown, FiChevronRight } from 'react-icons/fi';
import api from '../../api';
import * as XLSX from 'xlsx';
import './PromotionTracking.css';

const PromotionTracking = () => {
    const { user } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [promotionData, setPromotionData] = useState(null);
    const [selectedMonths, setSelectedMonths] = useState([]);
    const [agentType, setAgentType] = useState('GA'); // 'GA' or 'SA'
    const [trackingPeriod, setTrackingPeriod] = useState('2month'); // '1month' or '2month'
    const [netEnabled, setNetEnabled] = useState(true); // Enable/disable NET requirement
    const [isPreparedForExport, setIsPreparedForExport] = useState(false);
    const [customNetThreshold, setCustomNetThreshold] = useState(''); // overrides NET requirement when provided
    const [customF6Threshold, setCustomF6Threshold] = useState('');   // overrides F6 requirement when provided
    const [activeView, setActiveView] = useState('tracking'); // 'tracking' or 'history'
    const [historyData, setHistoryData] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyYear, setHistoryYear] = useState(new Date().getFullYear());
    const [expandedMgas, setExpandedMgas] = useState({});

    // Check if user has app admin permissions
    const isAppAdmin = user?.Role === 'Admin' && user?.teamRole === 'app';

    useEffect(() => {
        // Verify user has access to this component
        if (!isAppAdmin) {
            setError('Access denied. Only app team administrators can access promotion tracking.');
            return;
        }

        // Initialize months based on tracking period
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        
        if (trackingPeriod === '1month') {
            const month = `${String(currentMonth).padStart(2, '0')}/${currentYear}`;
            console.log(`🏆 Initializing 1-month mode with: ${month}`);
            setSelectedMonths([month]);
        } else {
            const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
            const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
            
            const month1 = `${String(prevMonth).padStart(2, '0')}/${prevYear}`;
            const month2 = `${String(currentMonth).padStart(2, '0')}/${currentYear}`;
            console.log(`🏆 Initializing 2-month mode with: [${month1}, ${month2}]`);
            
            setSelectedMonths([month1, month2]);
        }
    }, [isAppAdmin, trackingPeriod]);

    useEffect(() => {
        console.log('🏆 selectedMonths or trackingPeriod changed:', { selectedMonths, trackingPeriod });
        if ((trackingPeriod === '1month' && selectedMonths.length === 1) || 
            (trackingPeriod === '2month' && selectedMonths.length === 2)) {
            console.log('🏆 Triggering fetchPromotionData due to month/period change');
            fetchPromotionData();
        } else {
            console.log('🏆 Conditions not met for fetching data:', {
                trackingPeriod,
                selectedMonthsLength: selectedMonths.length,
                expectedLength: trackingPeriod === '1month' ? 1 : 2
            });
        }
    }, [selectedMonths, trackingPeriod]);

    useEffect(() => {
        console.log('🏆 agentType or netEnabled changed:', { agentType, netEnabled });
        if ((trackingPeriod === '1month' && selectedMonths.length === 1) || 
            (trackingPeriod === '2month' && selectedMonths.length === 2)) {
            console.log('🏆 Triggering fetchPromotionData due to agentType/netEnabled change');
            fetchPromotionData();
        }
    }, [agentType, netEnabled]);

    const fetchPromotionData = async () => {
        try {
            setLoading(true);
            
            // Debug logging to verify correct data is being sent
            console.log(`🏆 Fetching promotion data for ${trackingPeriod} mode:`, {
                months: selectedMonths,
                agentType: agentType,
                trackingPeriod: trackingPeriod
            });
            
            const response = await api.get('/verify/promotion-tracking', {
                params: { 
                    months: selectedMonths,
                    agentType: agentType,
                    trackingPeriod: trackingPeriod // Send tracking period to backend
                }
            });
            
            if (response.data.success) {
                setPromotionData(response.data.data);
                console.log('🏆 Promotion data loaded successfully:', {
                    agentCount: response.data.data?.agents?.length || 0,
                    months: selectedMonths,
                    period: trackingPeriod
                });
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
        if (trackingPeriod === '1month') {
            if (selectedMonths.length !== 1) {
                console.warn('🏆 1-month mode navigation: Expected 1 month, got:', selectedMonths);
                return;
            }
            
            const [currentMonth] = selectedMonths;
            const [monthNum, year] = currentMonth.split('/').map(Number);
            
            let newMonth, newYear;
            
            if (direction === 'backward') {
                if (monthNum === 1) {
                    newMonth = 12;
                    newYear = year - 1;
                } else {
                    newMonth = monthNum - 1;
                    newYear = year;
                }
            } else {
                if (monthNum === 12) {
                    newMonth = 1;
                    newYear = year + 1;
                } else {
                    newMonth = monthNum + 1;
                    newYear = year;
                }
            }
            
            const newMonthStr = `${String(newMonth).padStart(2, '0')}/${newYear}`;
            console.log(`🏆 1-month navigation ${direction}:`, {
                from: currentMonth,
                to: newMonthStr
            });
            setSelectedMonths([newMonthStr]);
        } else {
            // 2-month logic (existing)
            if (selectedMonths.length !== 2) {
                console.warn('🏆 2-month mode navigation: Expected 2 months, got:', selectedMonths);
                return;
            }
            
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
            
            console.log(`🏆 2-month navigation ${direction}:`, {
                from: [month1, month2],
                to: [newMonth1, newMonth2]
            });
            setSelectedMonths([newMonth1, newMonth2]);
        }
    };

    // Promotion History
    const fetchPromotionHistory = async (year) => {
        try {
            setHistoryLoading(true);
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;
            const response = await api.get('/verify/promotion-history', {
                params: { startDate, endDate }
            });
            if (response.data.success) {
                setHistoryData(response.data.data);
            }
        } catch (err) {
            console.error('Error fetching promotion history:', err);
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        if (activeView === 'history') {
            fetchPromotionHistory(historyYear);
        }
    }, [activeView, historyYear]);

    const toggleMgaExpand = (mga) => {
        setExpandedMgas(prev => ({ ...prev, [mga]: !prev[mga] }));
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
        if (netEnabled) {
            if (netLvl3Total >= netThreshold && f6Lvl3Total >= f6Threshold) return 'Ready for Promotion';
            if (netLvl3Total >= netThreshold * 0.8 && f6Lvl3Total >= f6Threshold * 0.8) return 'Near Goal';
        } else {
            // Only check F6 when NET is disabled
            if (f6Lvl3Total >= f6Threshold) return 'Ready for Promotion';
            if (f6Lvl3Total >= f6Threshold * 0.8) return 'Near Goal';
        }
        return 'In Progress';
    };

    const getStatusColor = (netLvl3Total, f6Lvl3Total, netThreshold, f6Threshold) => {
        if (netEnabled) {
            if (netLvl3Total >= netThreshold && f6Lvl3Total >= f6Threshold) return '#28a745';
            if (netLvl3Total >= netThreshold * 0.8 && f6Lvl3Total >= f6Threshold * 0.8) return '#ffc107';
        } else {
            // Only check F6 when NET is disabled
            if (f6Lvl3Total >= f6Threshold) return '#28a745';
            if (f6Lvl3Total >= f6Threshold * 0.8) return '#ffc107';
        }
        return '#dc3545';
    };

    const getRequirements = () => {
        let baseThresholds;
        
        if (agentType === 'SA') {
            baseThresholds = {
                netLvl3Threshold: 50000,
                f6Lvl3Threshold: 25000
            };
        } else {
            // Default to GA requirements
            baseThresholds = {
                netLvl3Threshold: 120000,
                f6Lvl3Threshold: 60000
            };
        }

        // Adjust for 1-month period (halve defaults)
        if (trackingPeriod === '1month') {
            baseThresholds = {
                netLvl3Threshold: baseThresholds.netLvl3Threshold / 2,
                f6Lvl3Threshold: baseThresholds.f6Lvl3Threshold / 2
            };
        }

        // Apply custom overrides if provided (treat custom as final period targets)
        const netOverride = customNetThreshold !== '' && !isNaN(Number(customNetThreshold)) ? Number(customNetThreshold) : null;
        const f6Override = customF6Threshold !== '' && !isNaN(Number(customF6Threshold)) ? Number(customF6Threshold) : null;

        return {
            netLvl3Threshold: netOverride !== null ? netOverride : baseThresholds.netLvl3Threshold,
            f6Lvl3Threshold: f6Override !== null ? f6Override : baseThresholds.f6Lvl3Threshold
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

    // XLSX Export function
    const handleXLSXExport = async () => {
        setIsPreparedForExport(true);
        
        try {
            console.log('📊 Starting Promotion Tracking XLSX export...');
            
            if (!promotionData || !promotionData.agents || promotionData.agents.length === 0) {
                console.warn('⚠️ No promotion data available for export');
                window.alert('No promotion data available for export.');
                return;
            }
            
            // Create a new workbook
            const workbook = XLSX.utils.book_new();
            
            // Prepare data for export
            const sortedAgents = sortAgentsByStatus(promotionData.agents);
            const requirements = getRequirements();
            
            // Transform data for export
            const exportData = sortedAgents.map(agent => {
                const netLvl3Total = parseFloat(agent.lvl_2_net_total);
                const f6Lvl3Total = parseFloat(agent.lvl_2_f6_net_total);
                const status = getStatus(netLvl3Total, f6Lvl3Total, requirements.netLvl3Threshold, requirements.f6Lvl3Threshold);
                
                const baseData = {
                    'Agent': agent.LagnName,
                    'F6 NET': f6Lvl3Total,
                    'MGA': agent.mga || 'N/A',
                    'Status': status
                };
                
                // Add NET column if enabled
                if (netEnabled) {
                    return {
                        'Agent': baseData.Agent,
                        'NET ALP': netLvl3Total,
                        'F6 NET': baseData['F6 NET'],
                        'MGA': baseData.MGA,
                        'Status': baseData.Status
                    };
                }
                
                return baseData;
            });
            
            // Define headers based on NET enabled/disabled
            const headers = netEnabled 
                ? ['Agent', 'NET ALP', 'F6 NET', 'MGA', 'Status']
                : ['Agent', 'F6 NET', 'MGA', 'Status'];
            
            // Create data rows
            const dataRows = exportData.map(item => 
                netEnabled 
                    ? [item.Agent, item['NET ALP'], item['F6 NET'], item.MGA, item.Status]
                    : [item.Agent, item['F6 NET'], item.MGA, item.Status]
            );
            
            // Create sheet data
            const sheetData = [headers, ...dataRows];
            const sheet = XLSX.utils.aoa_to_sheet(sheetData);
            
            // Apply formatting
            const range = XLSX.utils.decode_range(sheet['!ref']);
            
            // Format header row
            for (let col = range.s.c; col <= range.e.c; col++) {
                const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
                if (sheet[cellRef]) {
                    sheet[cellRef].s = {
                        font: { bold: true, color: { rgb: "FFFFFF" } },
                        fill: { bgColor: { indexed: 64 }, fgColor: { rgb: "366092" } },
                        alignment: { horizontal: "center", vertical: "center" },
                        border: {
                            top: { style: "thin" },
                            bottom: { style: "thin" },
                            left: { style: "thin" },
                            right: { style: "thin" }
                        }
                    };
                }
            }
            
            // Set column widths
            const colWidths = headers.map(header => {
                if (header === 'Agent') return { wch: 25 };
                if (header === 'MGA') return { wch: 20 };
                if (header === 'Status') return { wch: 18 };
                if (header.includes('NET')) return { wch: 15 };
                return { wch: 12 };
            });
            sheet['!cols'] = colWidths;
            
            // Create Excel Table with filters
            const tableRange = XLSX.utils.encode_range({
                s: { c: 0, r: 0 },
                e: { c: headers.length - 1, r: dataRows.length }
            });
            
            // Add autofilter
            sheet['!autofilter'] = { ref: tableRange };
            
            // Freeze header row
            sheet['!freeze'] = { xSplit: 0, ySplit: 1 };
            
            // Create sheet name based on agent type and tracking period
            const sheetName = `${agentType}_Promotion_${trackingPeriod}`;
            
            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
            
            // Generate filename
            const periodStr = trackingPeriod === '1month' ? selectedMonths[0] : selectedMonths.join('_');
            const netStr = netEnabled ? 'NET_F6' : 'F6_Only';
            const filename = `Promotion_Tracking_${agentType}_${netStr}_${periodStr.replace(/[\/]/g, '-')}_${trackingPeriod}.xlsx`;
            
            // Write and download the file
            XLSX.writeFile(workbook, filename);
            
            console.log(`✅ Promotion Tracking XLSX export completed: ${filename}`);
            
        } catch (error) {
            console.error('❌ Promotion Tracking XLSX export failed:', error);
            window.alert('Failed to export XLSX file. Please try again.');
        } finally {
            setIsPreparedForExport(false);
        }
    };

    // Memoized columns for DataTable - must be at top level before any conditional returns
    const columns = useMemo(() => {
        const requirements = getRequirements();
        const isSA = agentType === 'SA';
        
        const baseColumns = [
            {
                Header: 'Agent',
                accessor: 'LagnName',
                Cell: ({ value }) => (
                    <div className="agent-info">
                        <strong>{value}</strong>
                    </div>
                ),
                width: 200
            }
        ];

        // Add NET column only if enabled
        if (netEnabled) {
            baseColumns.push({
                Header: isSA ? 'LVL 2 NET' : 'NET ALP',
                accessor: 'lvl_2_net_total',
                Cell: ({ value }) => <span className="currency-value">{formatCurrency(value)}</span>,
                width: 150
            });
        }

        // Always add F6 column
        baseColumns.push({
            Header: isSA ? 'LVL 2 F6 NET' : 'F6 NET',
            accessor: 'lvl_2_f6_net_total',
            Cell: ({ value }) => <span className="currency-value">{formatCurrency(value)}</span>,
            width: 150
        });

        // Add MGA and Status columns
        baseColumns.push(
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
            }
        );
        
        return baseColumns;
    }, [agentType, netEnabled, trackingPeriod]);

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
                {/* View Tabs */}
                <div className="view-tabs">
                    <button
                        className={`view-tab-btn ${activeView === 'tracking' ? 'active' : ''}`}
                        onClick={() => setActiveView('tracking')}
                    >
                        Promotion Tracking
                    </button>
                    <button
                        className={`view-tab-btn ${activeView === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveView('history')}
                    >
                        Promotion History
                    </button>
                </div>

                {/* Promotion History View */}
                {activeView === 'history' && (
                    <div className="promotion-tracking-main">
                        <div className="section-card">
                            <div className="section-header">
                                <h2>Promotion History</h2>
                                <div className="history-controls">
                                    <button className="month-nav-btn" onClick={() => setHistoryYear(y => y - 1)}>◀</button>
                                    <span className="month-values">{historyYear}</span>
                                    <button className="month-nav-btn" onClick={() => setHistoryYear(y => y + 1)}>▶</button>
                                </div>
                            </div>

                            {historyLoading ? (
                                <div className="loading-message">
                                    <div className="loading-spinner"></div>
                                    <p>Loading promotion history...</p>
                                </div>
                            ) : historyData && historyData.summary && historyData.summary.length > 0 ? (
                                <>
                                    <div className="history-totals">
                                        <span><strong>Total Promotions: {historyData.promotions.length}</strong></span>
                                    </div>
                                    <div className="history-table-wrapper">
                                        <table className="history-summary-table">
                                            <thead>
                                                <tr>
                                                    <th></th>
                                                    <th>MGA</th>
                                                    <th>RGA</th>
                                                    <th>AGT→SA</th>
                                                    <th>AGT→GA</th>
                                                    <th>AGT→MGA</th>
                                                    <th>SA→GA</th>
                                                    <th>SA→MGA</th>
                                                    <th>GA→MGA</th>
                                                    <th>Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {historyData.summary.map((row) => {
                                                    const isExpanded = expandedMgas[row.mga];
                                                    const mgaPromotions = historyData.promotions.filter(p => (p.mga || 'Unknown') === row.mga);
                                                    return (
                                                        <React.Fragment key={row.mga}>
                                                            <tr className="mga-summary-row" onClick={() => toggleMgaExpand(row.mga)}>
                                                                <td className="expand-cell">
                                                                    {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
                                                                </td>
                                                                <td><strong>{row.mga}</strong></td>
                                                                <td>{row.rga || '-'}</td>
                                                                <td className={row.agt_to_sa > 0 ? 'has-value' : ''}>{row.agt_to_sa || '-'}</td>
                                                                <td className={row.agt_to_ga > 0 ? 'has-value' : ''}>{row.agt_to_ga || '-'}</td>
                                                                <td className={row.agt_to_mga > 0 ? 'has-value' : ''}>{row.agt_to_mga || '-'}</td>
                                                                <td className={row.sa_to_ga > 0 ? 'has-value' : ''}>{row.sa_to_ga || '-'}</td>
                                                                <td className={row.sa_to_mga > 0 ? 'has-value' : ''}>{row.sa_to_mga || '-'}</td>
                                                                <td className={row.ga_to_mga > 0 ? 'has-value' : ''}>{row.ga_to_mga || '-'}</td>
                                                                <td><strong>{row.total}</strong></td>
                                                            </tr>
                                                            {isExpanded && mgaPromotions.map((p, idx) => (
                                                                <tr key={`${row.mga}-${idx}`} className="promotion-detail-row">
                                                                    <td></td>
                                                                    <td colSpan={2} className="detail-agent-name">{p.lagnname}</td>
                                                                    <td colSpan={5}>
                                                                        <span className="promotion-badge">
                                                                            {p.old_clname} → {p.new_clname}
                                                                        </span>
                                                                    </td>
                                                                    <td colSpan={2} className="detail-date">
                                                                        {new Date(p.promotion_date).toLocaleDateString('en-US')}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            ) : (
                                <div className="empty-state">
                                    <p>No promotions found for {historyYear}.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Existing Promotion Tracking View */}
                {activeView === 'tracking' && promotionData && (
                    <>
                        <div className="promotion-tracking-main">
                            <div className="section-card">
                                <div className="section-header">
                                    <h2>Promotions</h2>

                                    {/* Control Buttons Row */}
                                    <div className="controls-row">
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

                                        <div className="tracking-controls">
                                            <div className="period-toggle">
                                                <span className="toggle-label">Period:</span>
                                                <button 
                                                    className={`toggle-btn ${trackingPeriod === '1month' ? 'active' : ''}`}
                                                    onClick={() => setTrackingPeriod('1month')}
                                                >
                                                    1 Month
                                                </button>
                                                <button 
                                                    className={`toggle-btn ${trackingPeriod === '2month' ? 'active' : ''}`}
                                                    onClick={() => setTrackingPeriod('2month')}
                                                >
                                                    2 Months
                                                </button>
                                            </div>

                                            <div className="net-toggle">
                                                <span className="toggle-label">NET:</span>
                                                <button 
                                                    className={`toggle-btn ${netEnabled ? 'active enabled' : 'disabled'}`}
                                                    onClick={() => setNetEnabled(!netEnabled)}
                                                >
                                                    {netEnabled ? 'Enabled' : 'Disabled'}
                                                </button>
                                            </div>

                                            <div className="export-controls">
                                                <button 
                                                    onClick={handleXLSXExport}
                                                    disabled={isPreparedForExport || !promotionData || promotionData.agents.length === 0}
                                                    className={`export-btn ${isPreparedForExport ? 'exporting' : ''}`}
                                                    title="Export promotion tracking data to Excel"
                                                >
                                                    <FiDownload className={isPreparedForExport ? 'spinning' : ''} />
                                                    {isPreparedForExport ? 'Exporting...' : 'Export'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="month-navigation">
                                        <div className="month-display">
                                            <span className="month-label">Tracking Period:</span>
                                            <span className="month-values">
                                                {trackingPeriod === '1month' ? selectedMonths[0] : selectedMonths.join(' & ')}
                                            </span>
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
                                            <span><strong>Promotion Requirements {trackingPeriod === '1month' ? '(1 Month)' : '(2 Months)'}:</strong></span>
                                            {netEnabled && (
                                                <span>Net LVL 3: {formatCurrency(getRequirements().netLvl3Threshold)}</span>
                                            )}
                                            <span>F6 LVL 3: {formatCurrency(getRequirements().f6Lvl3Threshold)}</span>
                                            {!netEnabled && (
                                                <span className="net-disabled-note">(NET requirement disabled)</span>
                                            )}
                                        </div>

                                        <div className="threshold-overrides">
                                            {netEnabled && (
                                                <div className="override-control">
                                                    <label htmlFor="custom-net-threshold">Custom NET</label>
                                                    <input
                                                        id="custom-net-threshold"
                                                        type="number"
                                                        min="0"
                                                        step="1000"
                                                        placeholder="Override NET"
                                                        value={customNetThreshold}
                                                        onChange={(e) => setCustomNetThreshold(e.target.value)}
                                                    />
                                                </div>
                                            )}
                                            <div className="override-control">
                                                <label htmlFor="custom-f6-threshold">Custom F6</label>
                                                <input
                                                    id="custom-f6-threshold"
                                                    type="number"
                                                    min="0"
                                                    step="1000"
                                                    placeholder="Override F6"
                                                    value={customF6Threshold}
                                                    onChange={(e) => setCustomF6Threshold(e.target.value)}
                                                />
                                            </div>
                                            {(customNetThreshold !== '' || customF6Threshold !== '') && (
                                                <button
                                                    type="button"
                                                    className="clear-overrides-btn"
                                                    onClick={() => { setCustomNetThreshold(''); setCustomF6Threshold(''); }}
                                                    title="Clear custom thresholds"
                                                >
                                                    Reset
                                                </button>
                                            )}
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