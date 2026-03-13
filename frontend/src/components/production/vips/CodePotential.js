import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../api';
import DataTable from '../../utils/DataTable';
import Card from '../../utils/Card';
import { FiDownload, FiTrendingUp, FiTarget, FiUsers, FiPackage, FiCalendar } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import '../reports/RefReport.css';
import './PotentialVIPs.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Helper functions (defined outside component to avoid hoisting issues)
const getMetricLabel = (metric) => {
  const labels = {
    codes_mtd: 'Codes MTD',
    potential_vips: 'Potential VIPs',
    potential_code_with_vips: 'Potential Code w/ VIPs',
    pending_agents: 'Pending Agents',
    setup_kits_inprogress: 'Setup Kits In Progress',
    pct_of_obj_mtd: '% of Objective MTD'
  };
  return labels[metric] || metric;
};

const getMetricColor = (metric, alpha = 1) => {
  const colors = {
    codes_mtd: `rgba(34, 139, 230, ${alpha})`,
    potential_vips: `rgba(76, 175, 80, ${alpha})`,
    potential_code_with_vips: `rgba(156, 39, 176, ${alpha})`,
    pending_agents: `rgba(255, 152, 0, ${alpha})`,
    setup_kits_inprogress: `rgba(244, 67, 54, ${alpha})`,
    pct_of_obj_mtd: `rgba(63, 81, 181, ${alpha})`
  };
  return colors[metric] || `rgba(100, 100, 100, ${alpha})`;
};

const CodePotential = ({ searchQuery = '', filters = {} }) => {
  const { user } = useAuth();
  const isAdmin = user?.Role === 'Admin';
  
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMetrics, setSelectedMetrics] = useState(['codes_mtd']); // Array of selected metrics
  const [viewMode, setViewMode] = useState('chart'); // 'chart', 'table', 'monthly-comparison', or 'forecast'
  const [selectedOrg, setSelectedOrg] = useState('arias'); // Filter by org - default to Arias
  const [timeView, setTimeView] = useState('daily'); // 'daily', 'monthly', or 'single-month'
  const [selectedMonth, setSelectedMonth] = useState(''); // For single-month view
  
  // Forecasting conversion rates (will be updated with historical data on load)
  const [conversionRates, setConversionRates] = useState({
    setupToPending: 0.75, // Default: 75% of setup kits become pending agents
    pendingToCode: 0.65   // Default: 65% of pending agents become codes
  });
  const [ratesInitialized, setRatesInitialized] = useState(false);
  
  // Monthly codes from associates table (actual PRODDATE counts)
  const [monthlyCodes, setMonthlyCodes] = useState({});

  useEffect(() => {
    fetchCodePotential();
    fetchMonthlyCodes();
  }, []);

  // Reset rates when organization changes
  useEffect(() => {
    setRatesInitialized(false);
  }, [selectedOrg]);

  const fetchMonthlyCodes = async () => {
    try {
      const response = await api.get('/code-potential/monthly-codes');
      
      if (response.data.success) {
        const codesData = response.data.data || [];
        // Convert array to object for easy lookup: { '2025-01': 146, '2025-02': 162, ... }
        const codesMap = {};
        codesData.forEach(row => {
          codesMap[row.month] = parseInt(row.code_count);
        });
        setMonthlyCodes(codesMap);
        console.log('[CodePotential] Monthly codes from associates table:', codesMap);
      }
    } catch (err) {
      console.error('Error fetching monthly codes:', err);
      // Don't set error state, this is optional data
    }
  };

  const fetchCodePotential = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch all data (no date filter) to show trends
      const response = await api.get('/code-potential');
      
      if (response.data.success) {
        const rawData = response.data.data || [];
        
        // Ensure rawData is an array
        if (!Array.isArray(rawData)) {
          console.error('Expected array but got:', typeof rawData, rawData);
          setError('Invalid data format received from server');
          setData([]);
          return;
        }
        
        setData(rawData);
      } else {
        setError('Failed to fetch code potential data');
      }
    } catch (err) {
      console.error('Error fetching code potential:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.message || err.message || 'An error occurred');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Get unique organizations
  const organizations = useMemo(() => {
    const orgs = Array.from(new Set(data.map(d => d.org).filter(Boolean))).sort();
    return ['all', ...orgs];
  }, [data]);

  // Get available months
  const availableMonths = useMemo(() => {
    const months = Array.from(new Set(
      data.map(d => {
        if (!d.email_received_date) return null;
        const date = new Date(d.email_received_date + 'T00:00:00');
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }).filter(Boolean)
    )).sort().reverse();
    
    // Set default to most recent month
    if (!selectedMonth && months.length > 0) {
      setSelectedMonth(months[0]);
    }
    
    return months;
  }, [data, selectedMonth]);

  // Filter data by selected org
  const filteredByOrg = useMemo(() => {
    if (selectedOrg === 'all') return data;
    return data.filter(d => d.org === selectedOrg);
  }, [data, selectedOrg]);

  // Toggle metric selection
  const toggleMetric = (metric) => {
    setSelectedMetrics(prev => {
      if (prev.includes(metric)) {
        // Don't allow deselecting if it's the only one selected
        if (prev.length === 1) return prev;
        return prev.filter(m => m !== metric);
      } else {
        return [...prev, metric];
      }
    });
  };

  // Prepare chart data based on time view
  const chartData = useMemo(() => {
    if (timeView === 'single-month') {
      // Single month view - show daily data for selected month
      const monthData = filteredByOrg.filter(row => {
        if (!row.email_received_date || !selectedMonth) return false;
        const date = new Date(row.email_received_date + 'T00:00:00');
        const rowMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return rowMonth === selectedMonth;
      });

      const groupedByDate = {};
      monthData.forEach(row => {
        const date = row.email_received_date;
        if (!date) return;
        
        if (!groupedByDate[date]) {
          groupedByDate[date] = {
            codes_mtd: 0,
            potential_vips: 0,
            potential_code_with_vips: 0,
            pending_agents: 0,
            setup_kits_inprogress: 0,
            recruiting_obj: 0,
            pct_of_obj_mtd: 0,
            count: 0
          };
        }
        
        if (selectedOrg === 'all') {
          groupedByDate[date].codes_mtd += parseFloat(row.codes_mtd) || 0;
          groupedByDate[date].potential_vips += parseFloat(row.potential_vips) || 0;
          groupedByDate[date].potential_code_with_vips += parseFloat(row.potential_code_with_vips) || 0;
          groupedByDate[date].pending_agents += parseFloat(row.pending_agents) || 0;
          groupedByDate[date].setup_kits_inprogress += parseFloat(row.setup_kits_inprogress) || 0;
          groupedByDate[date].recruiting_obj += parseFloat(row.recruiting_obj) || 0;
        } else {
          groupedByDate[date].codes_mtd = parseFloat(row.codes_mtd) || 0;
          groupedByDate[date].potential_vips = parseFloat(row.potential_vips) || 0;
          groupedByDate[date].potential_code_with_vips = parseFloat(row.potential_code_with_vips) || 0;
          groupedByDate[date].pending_agents = parseFloat(row.pending_agents) || 0;
          groupedByDate[date].setup_kits_inprogress = parseFloat(row.setup_kits_inprogress) || 0;
          groupedByDate[date].recruiting_obj = parseFloat(row.recruiting_obj) || 0;
          groupedByDate[date].pct_of_obj_mtd = parseFloat(row.pct_of_obj_mtd) || 0;
        }
        groupedByDate[date].count += 1;
      });

      if (selectedOrg === 'all') {
        Object.keys(groupedByDate).forEach(date => {
          const obj = groupedByDate[date].recruiting_obj;
          const codes = groupedByDate[date].codes_mtd;
          groupedByDate[date].pct_of_obj_mtd = obj > 0 ? codes / obj : 0;
        });
      }

      const sortedDates = Object.keys(groupedByDate).sort();
      const datasets = selectedMetrics.map(metric => ({
        label: getMetricLabel(metric),
        data: sortedDates.map(date => groupedByDate[date][metric]),
        borderColor: getMetricColor(metric),
        backgroundColor: getMetricColor(metric, 0.1),
        fill: selectedMetrics.length === 1,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: getMetricColor(metric),
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        yAxisID: metric === 'pct_of_obj_mtd' ? 'y1' : 'y',
      }));

      return {
        labels: sortedDates.map(d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        datasets
      };
    } else if (timeView === 'monthly') {
      // Monthly view - show last report of each month
      const monthlyData = {};
      
      filteredByOrg.forEach(row => {
        if (!row.email_received_date) return;
        const date = new Date(row.email_received_date + 'T00:00:00');
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = [];
        }
        monthlyData[monthKey].push(row);
      });

      // Get the last report of each month
      const monthlyAggregated = {};
      Object.keys(monthlyData).forEach(monthKey => {
        const monthRows = monthlyData[monthKey].sort((a, b) => 
          new Date(b.email_received_date) - new Date(a.email_received_date)
        );
        
        // Get last date of the month
        const lastDate = monthRows[0].email_received_date;
        const lastDateRows = monthRows.filter(r => r.email_received_date === lastDate);
        
        monthlyAggregated[monthKey] = {
          codes_mtd: 0,
          potential_vips: 0,
          potential_code_with_vips: 0,
          pending_agents: 0,
          setup_kits_inprogress: 0,
          recruiting_obj: 0,
          pct_of_obj_mtd: 0
        };

        if (selectedOrg === 'all') {
          lastDateRows.forEach(row => {
            monthlyAggregated[monthKey].codes_mtd += parseFloat(row.codes_mtd) || 0;
            monthlyAggregated[monthKey].potential_vips += parseFloat(row.potential_vips) || 0;
            monthlyAggregated[monthKey].potential_code_with_vips += parseFloat(row.potential_code_with_vips) || 0;
            monthlyAggregated[monthKey].pending_agents += parseFloat(row.pending_agents) || 0;
            monthlyAggregated[monthKey].setup_kits_inprogress += parseFloat(row.setup_kits_inprogress) || 0;
            monthlyAggregated[monthKey].recruiting_obj += parseFloat(row.recruiting_obj) || 0;
          });
          const obj = monthlyAggregated[monthKey].recruiting_obj;
          const codes = monthlyAggregated[monthKey].codes_mtd;
          monthlyAggregated[monthKey].pct_of_obj_mtd = obj > 0 ? codes / obj : 0;
        } else {
          const row = lastDateRows[0];
          monthlyAggregated[monthKey].codes_mtd = parseFloat(row.codes_mtd) || 0;
          monthlyAggregated[monthKey].potential_vips = parseFloat(row.potential_vips) || 0;
          monthlyAggregated[monthKey].potential_code_with_vips = parseFloat(row.potential_code_with_vips) || 0;
          monthlyAggregated[monthKey].pending_agents = parseFloat(row.pending_agents) || 0;
          monthlyAggregated[monthKey].setup_kits_inprogress = parseFloat(row.setup_kits_inprogress) || 0;
          monthlyAggregated[monthKey].recruiting_obj = parseFloat(row.recruiting_obj) || 0;
          monthlyAggregated[monthKey].pct_of_obj_mtd = parseFloat(row.pct_of_obj_mtd) || 0;
        }
      });

      const sortedMonths = Object.keys(monthlyAggregated).sort();
      const datasets = selectedMetrics.map(metric => ({
        label: getMetricLabel(metric),
        data: sortedMonths.map(month => monthlyAggregated[month][metric]),
        borderColor: getMetricColor(metric),
        backgroundColor: getMetricColor(metric, 0.1),
        fill: selectedMetrics.length === 1,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: getMetricColor(metric),
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        yAxisID: metric === 'pct_of_obj_mtd' ? 'y1' : 'y',
      }));

      return {
        labels: sortedMonths.map(m => {
          const [year, month] = m.split('-');
          return new Date(year, parseInt(month) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        }),
        datasets
      };
    } else {
      // Daily view (running total) - all data
      const groupedByDate = {};
      
      filteredByOrg.forEach(row => {
        const date = row.email_received_date;
        if (!date) return;
        
        if (!groupedByDate[date]) {
          groupedByDate[date] = {
            codes_mtd: 0,
            potential_vips: 0,
            potential_code_with_vips: 0,
            pending_agents: 0,
            setup_kits_inprogress: 0,
            recruiting_obj: 0,
            pct_of_obj_mtd: 0,
            count: 0
          };
        }
        
        if (selectedOrg === 'all') {
          groupedByDate[date].codes_mtd += parseFloat(row.codes_mtd) || 0;
          groupedByDate[date].potential_vips += parseFloat(row.potential_vips) || 0;
          groupedByDate[date].potential_code_with_vips += parseFloat(row.potential_code_with_vips) || 0;
          groupedByDate[date].pending_agents += parseFloat(row.pending_agents) || 0;
          groupedByDate[date].setup_kits_inprogress += parseFloat(row.setup_kits_inprogress) || 0;
          groupedByDate[date].recruiting_obj += parseFloat(row.recruiting_obj) || 0;
        } else {
          groupedByDate[date].codes_mtd = parseFloat(row.codes_mtd) || 0;
          groupedByDate[date].potential_vips = parseFloat(row.potential_vips) || 0;
          groupedByDate[date].potential_code_with_vips = parseFloat(row.potential_code_with_vips) || 0;
          groupedByDate[date].pending_agents = parseFloat(row.pending_agents) || 0;
          groupedByDate[date].setup_kits_inprogress = parseFloat(row.setup_kits_inprogress) || 0;
          groupedByDate[date].recruiting_obj = parseFloat(row.recruiting_obj) || 0;
          groupedByDate[date].pct_of_obj_mtd = parseFloat(row.pct_of_obj_mtd) || 0;
        }
        
        groupedByDate[date].count += 1;
      });

      if (selectedOrg === 'all') {
        Object.keys(groupedByDate).forEach(date => {
          const obj = groupedByDate[date].recruiting_obj;
          const codes = groupedByDate[date].codes_mtd;
          groupedByDate[date].pct_of_obj_mtd = obj > 0 ? codes / obj : 0;
        });
      }
      
      const sortedDates = Object.keys(groupedByDate).sort();
      const datasets = selectedMetrics.map(metric => ({
        label: getMetricLabel(metric),
        data: sortedDates.map(date => groupedByDate[date][metric]),
        borderColor: getMetricColor(metric),
        backgroundColor: getMetricColor(metric, 0.1),
        fill: selectedMetrics.length === 1,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: getMetricColor(metric),
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        yAxisID: metric === 'pct_of_obj_mtd' ? 'y1' : 'y',
      }));
      
      return {
        labels: sortedDates.map(d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        datasets
      };
    }
  }, [filteredByOrg, selectedMetrics, selectedOrg, timeView, selectedMonth]);

  // Chart options
  const chartOptions = useMemo(() => {
    const hasPercentage = selectedMetrics.includes('pct_of_obj_mtd');
    const hasOtherMetrics = selectedMetrics.some(m => m !== 'pct_of_obj_mtd');
    
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: {
              size: 12,
              weight: 'bold'
            }
          }
        },
        title: {
          display: false,
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              // Check if this dataset is the percentage metric
              if (context.dataset.yAxisID === 'y1') {
                label += (context.parsed.y * 100).toFixed(1) + '%';
              } else {
                label += Math.round(context.parsed.y);
              }
              return label;
            }
          }
        },
      },
      scales: {
        y: {
          type: 'linear',
          display: hasOtherMetrics,
          position: 'left',
          beginAtZero: true,
          title: {
            display: hasOtherMetrics && selectedMetrics.length > 1,
            text: 'Count',
            font: {
              weight: 'bold'
            }
          },
          ticks: {
            callback: function(value) {
              return Math.round(value);
            }
          }
        },
        y1: {
          type: 'linear',
          display: hasPercentage,
          position: 'right',
          beginAtZero: true,
          title: {
            display: hasPercentage && hasOtherMetrics,
            text: 'Percentage',
            font: {
              weight: 'bold'
            }
          },
          ticks: {
            callback: function(value) {
              return (value * 100).toFixed(0) + '%';
            }
          },
          grid: {
            drawOnChartArea: false, // Don't draw grid lines for secondary axis
          },
        },
        x: {
          grid: {
            display: false
          }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      },
    };
  }, [selectedMetrics]);

  // Calculate monthly start/end comparison data
  const monthlyComparisonData = useMemo(() => {
    const monthlyData = {};
    
    filteredByOrg.forEach(row => {
      if (!row.email_received_date) return;
      const date = new Date(row.email_received_date + 'T00:00:00');
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = [];
      }
      monthlyData[monthKey].push(row);
    });

    // For each month, get start (first date) and end (last date) values
    const comparison = [];
    Object.keys(monthlyData).sort().forEach(monthKey => {
      const monthRows = monthlyData[monthKey].sort((a, b) => 
        new Date(a.email_received_date) - new Date(b.email_received_date)
      );
      
      const firstDate = monthRows[0].email_received_date;
      const lastDate = monthRows[monthRows.length - 1].email_received_date;
      
      const firstDateRows = monthRows.filter(r => r.email_received_date === firstDate);
      const lastDateRows = monthRows.filter(r => r.email_received_date === lastDate);
      
      const startValues = {
        codes_mtd: 0,
        potential_vips: 0,
        potential_code_with_vips: 0,
        pending_agents: 0,
        setup_kits_inprogress: 0,
        recruiting_obj: 0,
        pct_of_obj_mtd: 0
      };
      
      const endValues = {
        codes_mtd: 0,
        potential_vips: 0,
        potential_code_with_vips: 0,
        pending_agents: 0,
        setup_kits_inprogress: 0,
        recruiting_obj: 0,
        pct_of_obj_mtd: 0
      };

      if (selectedOrg === 'all') {
        // Sum values for all orgs
        firstDateRows.forEach(row => {
          startValues.codes_mtd += parseFloat(row.codes_mtd) || 0;
          startValues.potential_vips += parseFloat(row.potential_vips) || 0;
          startValues.potential_code_with_vips += parseFloat(row.potential_code_with_vips) || 0;
          startValues.pending_agents += parseFloat(row.pending_agents) || 0;
          startValues.setup_kits_inprogress += parseFloat(row.setup_kits_inprogress) || 0;
          startValues.recruiting_obj += parseFloat(row.recruiting_obj) || 0;
        });
        startValues.pct_of_obj_mtd = startValues.recruiting_obj > 0 ? startValues.codes_mtd / startValues.recruiting_obj : 0;

        lastDateRows.forEach(row => {
          endValues.codes_mtd += parseFloat(row.codes_mtd) || 0;
          endValues.potential_vips += parseFloat(row.potential_vips) || 0;
          endValues.potential_code_with_vips += parseFloat(row.potential_code_with_vips) || 0;
          endValues.pending_agents += parseFloat(row.pending_agents) || 0;
          endValues.setup_kits_inprogress += parseFloat(row.setup_kits_inprogress) || 0;
          endValues.recruiting_obj += parseFloat(row.recruiting_obj) || 0;
        });
        endValues.pct_of_obj_mtd = endValues.recruiting_obj > 0 ? endValues.codes_mtd / endValues.recruiting_obj : 0;
      } else {
        // Single org
        const startRow = firstDateRows[0];
        const endRow = lastDateRows[0];
        
        startValues.codes_mtd = parseFloat(startRow.codes_mtd) || 0;
        startValues.potential_vips = parseFloat(startRow.potential_vips) || 0;
        startValues.potential_code_with_vips = parseFloat(startRow.potential_code_with_vips) || 0;
        startValues.pending_agents = parseFloat(startRow.pending_agents) || 0;
        startValues.setup_kits_inprogress = parseFloat(startRow.setup_kits_inprogress) || 0;
        startValues.recruiting_obj = parseFloat(startRow.recruiting_obj) || 0;
        startValues.pct_of_obj_mtd = parseFloat(startRow.pct_of_obj_mtd) || 0;

        endValues.codes_mtd = parseFloat(endRow.codes_mtd) || 0;
        endValues.potential_vips = parseFloat(endRow.potential_vips) || 0;
        endValues.potential_code_with_vips = parseFloat(endRow.potential_code_with_vips) || 0;
        endValues.pending_agents = parseFloat(endRow.pending_agents) || 0;
        endValues.setup_kits_inprogress = parseFloat(endRow.setup_kits_inprogress) || 0;
        endValues.recruiting_obj = parseFloat(endRow.recruiting_obj) || 0;
        endValues.pct_of_obj_mtd = parseFloat(endRow.pct_of_obj_mtd) || 0;
      }

      const [year, month] = monthKey.split('-');
      comparison.push({
        month: monthKey,
        monthLabel: new Date(year, parseInt(month) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        startDate: firstDate,
        endDate: lastDate,
        startValues,
        endValues,
        change: {
          codes_mtd: endValues.codes_mtd - startValues.codes_mtd,
          potential_vips: endValues.potential_vips - startValues.potential_vips,
          potential_code_with_vips: endValues.potential_code_with_vips - startValues.potential_code_with_vips,
          pending_agents: endValues.pending_agents - startValues.pending_agents,
          setup_kits_inprogress: endValues.setup_kits_inprogress - startValues.setup_kits_inprogress,
          recruiting_obj: endValues.recruiting_obj - startValues.recruiting_obj,
          pct_of_obj_mtd: endValues.pct_of_obj_mtd - startValues.pct_of_obj_mtd
        }
      });
    });

    return comparison;
  }, [filteredByOrg, selectedOrg]);

  // Calculate current metrics (most recent date)
  const currentMetrics = useMemo(() => {
    if (filteredByOrg.length === 0) return null;
    
    // Get most recent date
    const sortedData = [...filteredByOrg].sort((a, b) => 
      new Date(b.email_received_date) - new Date(a.email_received_date)
    );
    
    const mostRecentDate = sortedData[0]?.email_received_date;
    const recentData = filteredByOrg.filter(d => d.email_received_date === mostRecentDate);
    
    if (selectedOrg === 'all') {
      return {
        recruiting_obj: recentData.reduce((sum, row) => sum + (parseFloat(row.recruiting_obj) || 0), 0),
        codes_mtd: recentData.reduce((sum, row) => sum + (parseFloat(row.codes_mtd) || 0), 0),
        potential_vips: recentData.reduce((sum, row) => sum + (parseFloat(row.potential_vips) || 0), 0),
        potential_code_with_vips: recentData.reduce((sum, row) => sum + (parseFloat(row.potential_code_with_vips) || 0), 0),
        pending_agents: recentData.reduce((sum, row) => sum + (parseFloat(row.pending_agents) || 0), 0),
        setup_kits_inprogress: recentData.reduce((sum, row) => sum + (parseFloat(row.setup_kits_inprogress) || 0), 0),
        date: mostRecentDate
      };
    } else {
      const orgData = recentData[0];
      return {
        recruiting_obj: parseFloat(orgData.recruiting_obj) || 0,
        codes_mtd: parseFloat(orgData.codes_mtd) || 0,
        potential_vips: parseFloat(orgData.potential_vips) || 0,
        potential_code_with_vips: parseFloat(orgData.potential_code_with_vips) || 0,
        pending_agents: parseFloat(orgData.pending_agents) || 0,
        setup_kits_inprogress: parseFloat(orgData.setup_kits_inprogress) || 0,
        pct_of_obj_mtd: parseFloat(orgData.pct_of_obj_mtd) || 0,
        date: mostRecentDate
      };
    }
  }, [filteredByOrg, selectedOrg]);

  // Note: Conversion rates are not reliable for this forecast model
  // The cohort model uses actual historical ending codes, not conversion rates
  const historicalConversionRates = null;

  // Update conversion rates with historical data when available
  useEffect(() => {
    if (historicalConversionRates && !ratesInitialized) {
      setConversionRates({
        setupToPending: historicalConversionRates.setupToPending,
        pendingToCode: historicalConversionRates.pendingToCode
      });
      setRatesInitialized(true);
    }
  }, [historicalConversionRates, ratesInitialized]);

  // Calculate advanced forecast data with multiple models
  const forecastData = useMemo(() => {
    if (!currentMetrics || filteredByOrg.length < 2) return null;

    const currentCodes = currentMetrics.codes_mtd;
    const currentPending = currentMetrics.pending_agents;
    const currentSetup = currentMetrics.setup_kits_inprogress;
    const objective = currentMetrics.recruiting_obj;

    // Use historical rates if available, otherwise use manual rates
    const effectiveRates = historicalConversionRates || {
      setupToPending: conversionRates.setupToPending,
      pendingToCode: conversionRates.pendingToCode
    };

    // Sort data by date for time-series analysis
    const sortedData = [...filteredByOrg].sort((a, b) => 
      new Date(a.email_received_date) - new Date(b.email_received_date)
    );

    // Group by date
    const dailyData = {};
    sortedData.forEach(row => {
      const date = row.email_received_date;
      if (!date) return;

      if (!dailyData[date]) {
        dailyData[date] = { codes: 0, pending: 0, setup: 0 };
      }

      if (selectedOrg === 'all') {
        dailyData[date].codes += parseFloat(row.codes_mtd) || 0;
        dailyData[date].pending += parseFloat(row.pending_agents) || 0;
        dailyData[date].setup += parseFloat(row.setup_kits_inprogress) || 0;
      } else {
        dailyData[date].codes = parseFloat(row.codes_mtd) || 0;
        dailyData[date].pending = parseFloat(row.pending_agents) || 0;
        dailyData[date].setup = parseFloat(row.setup_kits_inprogress) || 0;
      }
    });

    const dates = Object.keys(dailyData).sort();
    const dataPoints = dates.map(date => ({
      date,
      ...dailyData[date],
      timestamp: new Date(date).getTime()
    }));

    // === Pipeline Conversion (for reference) ===
    const potentialCodesFromPending = currentPending * effectiveRates.pendingToCode;
    const potentialPendingFromSetup = currentSetup * effectiveRates.setupToPending;
    const potentialCodesFromSetup = potentialPendingFromSetup * effectiveRates.pendingToCode;
    const pipelineForecast = currentCodes + potentialCodesFromPending + potentialCodesFromSetup;

    // === Historical Cohort Model ===
    // For each historical month, we look at:
    // 1. Pending agents at START of month (first report)
    // 2. Setup kits at START of month (first report)
    // 3. Codes at END of month (first report of NEXT month)
    // Calculate the average ending codes across ALL historical months
    
    let cohortForecast = currentCodes;
    let historicalCohorts = [];
    let currentMonthStartPending = currentPending;
    let currentMonthStartSetup = currentSetup;
    
    // Group data by month - we need LAST report of each month (ending codes)
    // Filter to only include data from 2025 onwards
    const monthlyData = {};
    const sortedPoints = [...dataPoints].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    sortedPoints.forEach(point => {
      // Parse date string directly to avoid timezone shifts
      const dateStr = point.date;
      let monthKey;
      let year;
      
      if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        // Date is in YYYY-MM-DD format, extract year and month directly
        const [yearStr, month] = dateStr.split('-');
        year = parseInt(yearStr);
        monthKey = `${yearStr}-${month}`;
      } else {
        // Fallback to Date parsing
        const date = new Date(dateStr);
        year = date.getFullYear();
        monthKey = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      
      // Only include data from 2025 onwards
      if (year < 2025) return;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          firstReport: point,
          lastReport: point,
          firstDate: point.date,
          lastDate: point.date
        };
      } else {
        // Update last report as we go through chronologically
        monthlyData[monthKey].lastReport = point;
        monthlyData[monthKey].lastDate = point.date;
      }
    });
    
    console.log('[CodePotential] Monthly data keys:', Object.keys(monthlyData).sort());
    console.log('[CodePotential] Most recent date in data:', currentMetrics.date);
    console.log('[CodePotential] Monthly data details:', Object.keys(monthlyData).sort().map(key => ({
      month: key,
      firstDate: monthlyData[key].firstDate,
      lastDate: monthlyData[key].lastDate,
      firstPending: Math.round(monthlyData[key].firstReport.pending),
      firstSetup: Math.round(monthlyData[key].firstReport.setup)
    })));

    // Build cohorts: for each month, get starting pending/setup (first report) and ending codes (last report)
    // Example: For August, we use Aug's first report (pending/setup) and Aug's last report (ending codes)
    const months = Object.keys(monthlyData).sort();
    
    // Get current month key using same parsing logic to avoid timezone issues
    let currentMonthKey;
    const currentDateStr = currentMetrics.date;
    if (typeof currentDateStr === 'string' && currentDateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
      const [year, month] = currentDateStr.split('-');
      currentMonthKey = `${year}-${month}`;
    } else {
      const currentMonth = new Date(currentDateStr);
      currentMonthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    }
    
    // Get current month's starting position
    if (monthlyData[currentMonthKey]) {
      currentMonthStartPending = monthlyData[currentMonthKey].firstReport.pending;
      currentMonthStartSetup = monthlyData[currentMonthKey].firstReport.setup;
    }
    
    // Collect ALL historical cohorts (no similarity filtering)
    for (let i = 0; i < months.length; i++) {
      const monthKey = months[i];
      
      // Skip current month (incomplete)
      if (monthKey === currentMonthKey) continue;
      
      const startPending = monthlyData[monthKey].firstReport.pending;
      const startSetup = monthlyData[monthKey].firstReport.setup;
      const endPending = monthlyData[monthKey].lastReport.pending;
      const endSetup = monthlyData[monthKey].lastReport.setup;
      
      // Calculate changes during the month
      const pendingChange = endPending - startPending;
      const setupChange = endSetup - startSetup;
      
      // Use actual codes from associates table if available, otherwise fall back to last report
      const endCodes = monthlyCodes[monthKey] !== undefined 
        ? monthlyCodes[monthKey] 
        : monthlyData[monthKey].lastReport.codes;
      
      historicalCohorts.push({
        month: monthKey,
        startPending,
        startSetup,
        endPending,
        endSetup,
        pendingChange,
        setupChange,
        endCodes
      });
    }

    console.log('[CodePotential] Current month key:', currentMonthKey);
    console.log('[CodePotential] Selected org:', selectedOrg);
    console.log('[CodePotential] Monthly codes from associates table:', monthlyCodes);
    console.log('[CodePotential] Historical cohorts (full details):', historicalCohorts);
    console.log('[CodePotential] Historical cohorts count:', historicalCohorts.length);

    // Get current month's changes (so far)
    let currentPendingChange = 0;
    let currentSetupChange = 0;
    if (monthlyData[currentMonthKey]) {
      const currentStart = monthlyData[currentMonthKey].firstReport;
      const currentLast = monthlyData[currentMonthKey].lastReport;
      currentPendingChange = currentLast.pending - currentStart.pending;
      currentSetupChange = currentLast.setup - currentStart.setup;
    }

    // Calculate forecast based on ALL historical cohorts using linear regression
    if (historicalCohorts.length >= 3) {
      // Linear regression: endCodes = a*startPending + b*startSetup + c*pendingChange + d*setupChange + e
      const n = historicalCohorts.length;
      
      // Build design matrix X and response vector y for multiple linear regression
      // We'll use a simplified approach: calculate correlation and coefficients
      const X = historicalCohorts.map(c => [c.startPending, c.startSetup, c.pendingChange, c.setupChange, 1]);
      const y = historicalCohorts.map(c => c.endCodes);
      
      // Calculate means
      const meanStartPending = historicalCohorts.reduce((sum, c) => sum + c.startPending, 0) / n;
      const meanStartSetup = historicalCohorts.reduce((sum, c) => sum + c.startSetup, 0) / n;
      const meanPendingChange = historicalCohorts.reduce((sum, c) => sum + c.pendingChange, 0) / n;
      const meanSetupChange = historicalCohorts.reduce((sum, c) => sum + c.setupChange, 0) / n;
      const meanCodes = historicalCohorts.reduce((sum, c) => sum + c.endCodes, 0) / n;
      
      // For simplicity, we'll use a correlation-based approach
      // Calculate correlation of each variable with endCodes
      let corrStartPending = 0, corrStartSetup = 0, corrPendingChange = 0, corrSetupChange = 0;
      let varStartPending = 0, varStartSetup = 0, varPendingChange = 0, varSetupChange = 0, varCodes = 0;
      
      historicalCohorts.forEach(c => {
        const dStartPending = c.startPending - meanStartPending;
        const dStartSetup = c.startSetup - meanStartSetup;
        const dPendingChange = c.pendingChange - meanPendingChange;
        const dSetupChange = c.setupChange - meanSetupChange;
        const dCodes = c.endCodes - meanCodes;
        
        corrStartPending += dStartPending * dCodes;
        corrStartSetup += dStartSetup * dCodes;
        corrPendingChange += dPendingChange * dCodes;
        corrSetupChange += dSetupChange * dCodes;
        
        varStartPending += dStartPending * dStartPending;
        varStartSetup += dStartSetup * dStartSetup;
        varPendingChange += dPendingChange * dPendingChange;
        varSetupChange += dSetupChange * dSetupChange;
        varCodes += dCodes * dCodes;
      });
      
      // Simple coefficients based on correlation (normalized)
      const stdCodes = Math.sqrt(varCodes / n);
      const a = varStartPending > 0 ? (corrStartPending / n) / (varStartPending / n) * (stdCodes / Math.sqrt(varStartPending / n)) * 0.5 : 0;
      const b = varStartSetup > 0 ? (corrStartSetup / n) / (varStartSetup / n) * (stdCodes / Math.sqrt(varStartSetup / n)) * 0.5 : 0;
      const c = varPendingChange > 0 ? (corrPendingChange / n) / (varPendingChange / n) * (stdCodes / Math.sqrt(varPendingChange / n)) * 0.5 : 0;
      const d = varSetupChange > 0 ? (corrSetupChange / n) / (varSetupChange / n) * (stdCodes / Math.sqrt(varSetupChange / n)) * 0.5 : 0;
      const e = meanCodes - a * meanStartPending - b * meanStartSetup - c * meanPendingChange - d * meanSetupChange;
      
      // Apply the regression model to current month
      cohortForecast = a * currentMonthStartPending + b * currentMonthStartSetup + c * currentPendingChange + d * currentSetupChange + e;
      
      // Ensure forecast is at least the current codes (can't go backwards)
      cohortForecast = Math.max(cohortForecast, currentCodes);
      
      console.log('[CodePotential] Regression coefficients:', { 
        startPending: a.toFixed(4), 
        startSetup: b.toFixed(4), 
        pendingChange: c.toFixed(4),
        setupChange: d.toFixed(4),
        intercept: e.toFixed(2) 
      });
      console.log('[CodePotential] Forecast calculation:', {
        currentStartPending: Math.round(currentMonthStartPending),
        currentStartSetup: Math.round(currentMonthStartSetup),
        currentPendingChange: Math.round(currentPendingChange),
        currentSetupChange: Math.round(currentSetupChange),
        forecast: Math.round(cohortForecast)
      });
      
      // Sort by month (most recent first) for display
      historicalCohorts.sort((a, b) => b.month.localeCompare(a.month));
    } else if (historicalCohorts.length > 0) {
      // Fallback to simple average if not enough data for regression
      const avgEndCodes = historicalCohorts.reduce((sum, c) => sum + c.endCodes, 0) / historicalCohorts.length;
      cohortForecast = avgEndCodes;
      
      console.log('[CodePotential] Not enough data for regression, using average:', Math.round(avgEndCodes));
      
      historicalCohorts.sort((a, b) => b.month.localeCompare(a.month));
    }

    // === Confidence Intervals ===
    // Calculate standard deviation based on historical cohort variance
    let stdDev = 0;
    if (historicalCohorts.length >= 3) {
      const endCodesValues = historicalCohorts.map(c => c.endCodes);
      const mean = endCodesValues.reduce((a, b) => a + b, 0) / endCodesValues.length;
      const variance = endCodesValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / endCodesValues.length;
      stdDev = Math.sqrt(variance);
    }

    // 68% confidence interval (±1 std dev), 95% confidence interval (±2 std dev)
    const confidenceInterval68 = {
      low: Math.max(currentCodes, cohortForecast - stdDev),
      high: cohortForecast + stdDev
    };
    const confidenceInterval95 = {
      low: Math.max(currentCodes, cohortForecast - (2 * stdDev)),
      high: cohortForecast + (2 * stdDev)
    };

    // === Trend Indicators ===
    const recentTrend = dataPoints.length >= 7 
      ? dataPoints[dataPoints.length - 1].codes - dataPoints[dataPoints.length - 7].codes
      : 0;
    
    const trendDirection = recentTrend > 5 ? 'accelerating' : recentTrend < -5 ? 'decelerating' : 'steady';
    const momentumStrong = Math.abs(recentTrend) > 10;

    // Calculate progress metrics
    const currentProgress = objective > 0 ? (currentCodes / objective) * 100 : 0;
    const forecastProgress = objective > 0 ? (cohortForecast / objective) * 100 : 0;
    const gap = objective - cohortForecast;

    return {
      current: {
        codes: currentCodes,
        pending: currentPending,
        setup: currentSetup,
        objective: objective,
        progress: currentProgress,
        startPending: currentMonthStartPending,
        startSetup: currentMonthStartSetup
      },
      models: {
        pipeline: {
          value: pipelineForecast,
          label: 'Pipeline Conversion',
          description: 'Based on current pipeline converting at historical rates'
        },
        cohort: {
          value: cohortForecast,
          label: 'Historical Cohort',
          matches: historicalCohorts.length,
          historicalCohorts: historicalCohorts // All historical months
        }
      },
      confidence: {
        interval68: confidenceInterval68,
        interval95: confidenceInterval95,
        stdDev: stdDev
      },
      trends: {
        direction: trendDirection,
        recentChange: recentTrend,
        momentumStrong: momentumStrong
      },
      forecast: {
        codesFromPending: potentialCodesFromPending,
        codesFromSetup: potentialCodesFromSetup,
        totalPotentialCodes: cohortForecast,
        progress: forecastProgress,
        gap: gap,
        onTrack: gap <= 0
      },
      breakdown: {
        existingCodes: currentCodes,
        pendingContribution: potentialCodesFromPending,
        setupContribution: potentialCodesFromSetup
      },
      rates: effectiveRates,
      usingHistoricalData: !!historicalConversionRates
    };
  }, [currentMetrics, conversionRates, historicalConversionRates, filteredByOrg, selectedOrg, monthlyCodes]);

  // Export to Excel
  const exportToExcel = () => {
    const exportData = filteredByOrg.map(row => ({
      'Organization': row.org,
      'Recruiting Objective': row.recruiting_obj,
      'Codes MTD': row.codes_mtd,
      'Potential VIPs': row.potential_vips,
      'Potential Code w/ VIPs': row.potential_code_with_vips,
      '% of Obj MTD': (row.pct_of_obj_mtd * 100).toFixed(1) + '%',
      'Pending Agents': row.pending_agents,
      'Setup Kits In Progress': row.setup_kits_inprogress,
      'Processed Date': row.processed_date,
      'Email Received Date': row.email_received_date
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Code Potential');
    XLSX.writeFile(wb, `code_potential_${selectedOrg}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Table columns
  const columns = useMemo(() => [
    {
      Header: 'Organization',
      accessor: 'org',
      Cell: ({ value }) => <strong>{value}</strong>
    },
    {
      Header: 'Email Date',
      accessor: 'email_received_date',
      Cell: ({ value }) => value ? new Date(value + 'T00:00:00').toLocaleDateString('en-US') : '-'
    },
    {
      Header: 'Recruiting Obj',
      accessor: 'recruiting_obj',
      Cell: ({ value }) => Math.round(value || 0)
    },
    {
      Header: 'Codes MTD',
      accessor: 'codes_mtd',
      Cell: ({ value }) => Math.round(value || 0)
    },
    {
      Header: '% of Obj',
      accessor: 'pct_of_obj_mtd',
      Cell: ({ value }) => (
        <span style={{ 
          color: value >= 0.5 ? '#4caf50' : value >= 0.3 ? '#ff9800' : '#f44336',
          fontWeight: 'bold'
        }}>
          {(value * 100).toFixed(1)}%
        </span>
      )
    },
    {
      Header: 'Potential VIPs',
      accessor: 'potential_vips',
      Cell: ({ value }) => Math.round(value || 0)
    },
    {
      Header: 'Potential Code w/ VIPs',
      accessor: 'potential_code_with_vips',
      Cell: ({ value }) => Math.round(value || 0)
    },
    {
      Header: 'Pending Agents',
      accessor: 'pending_agents',
      Cell: ({ value }) => Math.round(value || 0)
    },
    {
      Header: 'Setup Kits In Progress',
      accessor: 'setup_kits_inprogress',
      Cell: ({ value }) => Math.round(value || 0)
    }
  ], []);

  if (loading) {
    return <div className="loading-container">Loading code potential data...</div>;
  }

  if (error) {
    return (
      <div className="error-container" style={{ 
        padding: '40px', 
        textAlign: 'center',
        backgroundColor: '#fff3cd',
        border: '1px solid #ffc107',
        borderRadius: '8px',
        margin: '20px'
      }}>
        <h3 style={{ color: '#856404', marginBottom: '10px' }}>⚠️ Error Loading Data</h3>
        <p style={{ color: '#856404' }}>{error}</p>
        <p style={{ color: '#666', fontSize: '14px', marginTop: '10px' }}>
          If the table doesn't exist yet, please create it in the database or contact your administrator.
        </p>
      </div>
    );
  }

  if (!loading && data.length === 0) {
    return (
      <div className="error-container" style={{ 
        padding: '40px', 
        textAlign: 'center',
        backgroundColor: '#e7f3ff',
        border: '1px solid #2196f3',
        borderRadius: '8px',
        margin: '20px'
      }}>
        <h3 style={{ color: '#1976d2', marginBottom: '10px' }}>📊 No Data Available</h3>
        <p style={{ color: '#1976d2' }}>
          There is no code potential data in the database yet.
        </p>
        <p style={{ color: '#666', fontSize: '14px', marginTop: '10px' }}>
          Data will appear here once records are added to the code_potential table.
        </p>
      </div>
    );
  }

  const pctOfObj = currentMetrics ? (currentMetrics.codes_mtd / currentMetrics.recruiting_obj) : 0;

  return (
    <div className="potential-vips-container">
      {/* Header Controls */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '15px'
      }}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Organization Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiUsers style={{ color: '#666' }} />
            <select
              value={selectedOrg}
              onChange={(e) => setSelectedOrg(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #ddd',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <option value="all">Grand Total</option>
              <option value="arias">Arias</option>
            </select>
          </div>

          {/* View Mode Toggle (Chart/Forecast/Raw Data) */}
          <div style={{ display: 'flex', gap: '5px', backgroundColor: '#f5f5f5', padding: '4px', borderRadius: '6px' }}>
            <button
              onClick={() => setViewMode('chart')}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: viewMode === 'chart' ? '#228be6' : 'transparent',
                color: viewMode === 'chart' ? '#fff' : '#666',
                fontWeight: viewMode === 'chart' ? 'bold' : 'normal',
                fontSize: '13px',
                transition: 'all 0.2s'
              }}
            >
              Chart
            </button>
            <button
              onClick={() => setViewMode('forecast')}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: viewMode === 'forecast' ? '#228be6' : 'transparent',
                color: viewMode === 'forecast' ? '#fff' : '#666',
                fontWeight: viewMode === 'forecast' ? 'bold' : 'normal',
                fontSize: '13px',
                transition: 'all 0.2s'
              }}
              title="View code forecast from pipeline"
            >
              Forecast
            </button>
            <button
              onClick={() => setViewMode('table')}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: viewMode === 'table' ? '#228be6' : 'transparent',
                color: viewMode === 'table' ? '#fff' : '#666',
                fontWeight: viewMode === 'table' ? 'bold' : 'normal',
                fontSize: '13px',
                transition: 'all 0.2s'
              }}
            >
              Raw Data
            </button>
          </div>

          {/* Time View Toggle (only show for chart view) */}
          {viewMode === 'chart' && (
            <div style={{ display: 'flex', gap: '5px', backgroundColor: '#f5f5f5', padding: '4px', borderRadius: '6px' }}>
              <button
                onClick={() => setTimeView('daily')}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: timeView === 'daily' ? '#228be6' : 'transparent',
                  color: timeView === 'daily' ? '#fff' : '#666',
                  fontWeight: timeView === 'daily' ? 'bold' : 'normal',
                  fontSize: '13px',
                  transition: 'all 0.2s'
                }}
                title="Show all daily data points"
              >
                Daily (All)
              </button>
              <button
                onClick={() => setTimeView('monthly')}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: timeView === 'monthly' ? '#228be6' : 'transparent',
                  color: timeView === 'monthly' ? '#fff' : '#666',
                  fontWeight: timeView === 'monthly' ? 'bold' : 'normal',
                  fontSize: '13px',
                  transition: 'all 0.2s'
                }}
                title="Show last report of each month"
              >
                Monthly
              </button>
              <button
                onClick={() => setTimeView('single-month')}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: timeView === 'single-month' ? '#228be6' : 'transparent',
                  color: timeView === 'single-month' ? '#fff' : '#666',
                  fontWeight: timeView === 'single-month' ? 'bold' : 'normal',
                  fontSize: '13px',
                  transition: 'all 0.2s'
                }}
                title="Show daily data for a specific month"
              >
                Single Month
              </button>
            </div>
          )}

          {/* Month Selector (only show for single-month view in chart mode) */}
          {viewMode === 'chart' && timeView === 'single-month' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiCalendar style={{ color: '#666' }} />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                {availableMonths.map(month => {
                  const [year, monthNum] = month.split('-');
                  const monthName = new Date(year, parseInt(monthNum) - 1).toLocaleDateString('en-US', { 
                    month: 'long', 
                    year: 'numeric' 
                  });
                  return (
                    <option key={month} value={month}>
                      {monthName}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>

        {/* Export Button */}
        <button
          onClick={exportToExcel}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            backgroundColor: '#4caf50',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px'
          }}
        >
          <FiDownload /> Export to Excel
        </button>
      </div>

      {/* Summary Cards */}
      {currentMetrics && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            marginBottom: '12px',
            color: '#666',
            fontSize: '14px'
          }}>
            <FiCalendar />
            <span>Most Recent Data: {new Date(currentMetrics.date + 'T00:00:00').toLocaleDateString('en-US', { 
              month: 'long', 
              day: 'numeric', 
              year: 'numeric' 
            })}</span>
          </div>
          
          <div className="card-container" style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '15px' 
          }}>
            <Card
              title="Recruiting Objective"
              value={Math.round(currentMetrics.recruiting_obj)}
              icon={<FiTarget />}
              color="#228be6"
            />
            <Card
              title="Codes MTD"
              value={Math.round(currentMetrics.codes_mtd)}
              icon={<FiTrendingUp />}
              color="#4caf50"
            />
            <Card
              title="% of Objective"
              value={`${(pctOfObj * 100).toFixed(1)}%`}
              icon={<FiTarget />}
              color={pctOfObj >= 0.5 ? '#4caf50' : pctOfObj >= 0.3 ? '#ff9800' : '#f44336'}
            />
          </div>
        </div>
      )}

      {viewMode === 'chart' ? (
        <>
          {/* Metric Selection */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ 
              marginBottom: '10px',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#666'
            }}>
              Select Metrics to Display (click to toggle):
            </div>
            <div style={{ 
              display: 'flex', 
              gap: '10px', 
              flexWrap: 'wrap'
            }}>
              {[
                { key: 'codes_mtd', label: 'Codes MTD' },
                { key: 'potential_vips', label: 'Potential VIPs' },
                { key: 'potential_code_with_vips', label: 'Potential Code w/ VIPs' },
                { key: 'pending_agents', label: 'Pending Agents' },
                { key: 'setup_kits_inprogress', label: 'Setup Kits In Progress' },
                { key: 'pct_of_obj_mtd', label: '% of Objective' }
              ].map(metric => {
                const isSelected = selectedMetrics.includes(metric.key);
                return (
                  <button
                    key={metric.key}
                    onClick={() => toggleMetric(metric.key)}
                    style={{
                      padding: '10px 20px',
                      border: isSelected ? `2px solid ${getMetricColor(metric.key)}` : '2px solid #ddd',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? getMetricColor(metric.key) : '#fff',
                      color: isSelected ? '#fff' : '#666',
                      fontWeight: isSelected ? 'bold' : 'normal',
                      fontSize: '14px',
                      transition: 'all 0.2s',
                      boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                      transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                      opacity: selectedMetrics.length === 1 && isSelected ? 0.7 : 1
                    }}
                    disabled={selectedMetrics.length === 1 && isSelected}
                    title={selectedMetrics.length === 1 && isSelected ? 'At least one metric must be selected' : 'Click to toggle'}
                  >
                    {isSelected ? '✓ ' : ''}{metric.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chart */}
          <div style={{ 
            backgroundColor: '#fff', 
            padding: '20px', 
            borderRadius: '8px', 
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            height: '500px'
          }}>
            <Line data={chartData} options={chartOptions} />
          </div>
        </>
      ) : viewMode === 'forecast' ? (
        /* Forecast View */
        <div>
          {forecastData && (
            <>
              {/* Pipeline Visualization */}
              <div style={{ 
                backgroundColor: '#fff', 
                padding: '30px', 
                borderRadius: '8px', 
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                marginBottom: '20px'
              }}>
                <h3 style={{ marginBottom: '25px', color: '#333', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FiTrendingUp size={24} />
                  Code Production Forecast
                </h3>

                {/* Pipeline Flow */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-around',
                  marginBottom: '40px',
                  flexWrap: 'wrap',
                  gap: '20px'
                }}>
                  {/* Setup Kits */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      width: '140px',
                      height: '140px',
                      borderRadius: '50%',
                      backgroundColor: '#f44336',
                      color: '#fff',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(244,67,54,0.3)',
                      margin: '0 auto 15px'
                    }}>
                      <FiPackage size={32} />
                      <div style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '10px' }}>
                        {Math.round(forecastData.current.setup)}
                      </div>
                    </div>
                    <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '5px' }}>Setup Kits</div>
                    <div style={{ fontSize: '13px', color: '#666' }}>In Progress</div>
                  </div>

                  {/* Arrow 1 */}
                  <div style={{ textAlign: 'center', color: '#999' }}>
                    <div style={{ fontSize: '40px' }}>→</div>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#f44336' }}>
                      {(forecastData.rates.setupToPending * 100).toFixed(0)}%
                    </div>
                    <div style={{ fontSize: '11px' }}>
                      ~{Math.round(forecastData.current.setup * forecastData.rates.setupToPending)} pending
                    </div>
                  </div>

                  {/* Pending Agents */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      width: '140px',
                      height: '140px',
                      borderRadius: '50%',
                      backgroundColor: '#ff9800',
                      color: '#fff',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(255,152,0,0.3)',
                      margin: '0 auto 15px'
                    }}>
                      <FiUsers size={32} />
                      <div style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '10px' }}>
                        {Math.round(forecastData.current.pending)}
                      </div>
                    </div>
                    <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '5px' }}>Pending Agents</div>
                    <div style={{ fontSize: '13px', color: '#666' }}>Ready to Code</div>
                  </div>

                  {/* Arrow 2 */}
                  <div style={{ textAlign: 'center', color: '#999' }}>
                    <div style={{ fontSize: '40px' }}>→</div>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#ff9800' }}>
                      {(forecastData.rates.pendingToCode * 100).toFixed(0)}%
                    </div>
                    <div style={{ fontSize: '11px' }}>
                      ~{Math.round(forecastData.forecast.codesFromPending)} codes
                    </div>
                  </div>

                  {/* Codes */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      width: '140px',
                      height: '140px',
                      borderRadius: '50%',
                      backgroundColor: '#4caf50',
                      color: '#fff',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(76,175,80,0.3)',
                      margin: '0 auto 15px'
                    }}>
                      <FiTrendingUp size={32} />
                      <div style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '10px' }}>
                        {Math.round(forecastData.current.codes)}
                      </div>
                    </div>
                    <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '5px' }}>Current Codes</div>
                    <div style={{ fontSize: '13px', color: '#666' }}>Completed</div>
                  </div>
                </div>

                {/* Projected Codes Display */}
                <div style={{ 
                  backgroundColor: '#fff', 
                  padding: '30px', 
                  borderRadius: '8px',
                  border: '3px solid #4caf50',
                  marginBottom: '30px',
                  textAlign: 'center',
                  boxShadow: '0 4px 16px rgba(76,175,80,0.2)'
                }}>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Projected End-of-Month
                  </div>
                  <div style={{ 
                    fontSize: '64px', 
                    fontWeight: 'bold',
                    color: '#4caf50',
                    lineHeight: '1'
                  }}>
                    {Math.round(forecastData.models.cohort.value)}
                  </div>
                  <div style={{ fontSize: '16px', color: '#666', marginTop: '10px' }}>
                    Codes
                  </div>
                  <div style={{ 
                    marginTop: '15px', 
                    paddingTop: '15px', 
                    borderTop: '1px solid #e0e0e0',
                    fontSize: '13px',
                    color: '#666'
                  }}>
                    Based on historical data from {forecastData.models.cohort.matches} months
                  </div>
                </div>

                {/* Progress vs Objective */}
                <div style={{ 
                  backgroundColor: '#fff', 
                  padding: '25px', 
                  borderRadius: '8px',
                  border: '2px solid #e0e0e0'
                }}>
                  <h4 style={{ marginBottom: '20px', color: '#333' }}>Progress vs Recruiting Objective</h4>
                  
                  <div style={{ marginBottom: '25px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 'bold' }}>Current Progress</span>
                      <span style={{ fontWeight: 'bold', color: '#2196f3' }}>
                        {forecastData.current.progress.toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ 
                      width: '100%', 
                      height: '30px', 
                      backgroundColor: '#e0e0e0', 
                      borderRadius: '15px',
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        width: `${Math.min(forecastData.current.progress, 100)}%`, 
                        height: '100%', 
                        backgroundColor: '#2196f3',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    <div style={{ marginTop: '5px', fontSize: '13px', color: '#666' }}>
                      {Math.round(forecastData.current.codes)} / {Math.round(forecastData.current.objective)} codes
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 'bold' }}>Forecasted Progress</span>
                      <span style={{ fontWeight: 'bold', color: forecastData.forecast.onTrack ? '#4caf50' : '#ff9800' }}>
                        {forecastData.forecast.progress.toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ 
                      width: '100%', 
                      height: '30px', 
                      backgroundColor: '#e0e0e0', 
                      borderRadius: '15px',
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        width: `${Math.min(forecastData.forecast.progress, 100)}%`, 
                        height: '100%', 
                        backgroundColor: forecastData.forecast.onTrack ? '#4caf50' : '#ff9800',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    <div style={{ marginTop: '5px', fontSize: '13px', color: '#666' }}>
                      {Math.round(forecastData.forecast.totalPotentialCodes)} / {Math.round(forecastData.current.objective)} codes
                    </div>
                  </div>

                  {/* Gap Analysis */}
                  <div style={{ 
                    marginTop: '25px', 
                    padding: '20px', 
                    backgroundColor: forecastData.forecast.onTrack ? '#e8f5e9' : '#fff3e0',
                    borderRadius: '8px',
                    border: `2px solid ${forecastData.forecast.onTrack ? '#4caf50' : '#ff9800'}`
                  }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px' }}>
                      {forecastData.forecast.onTrack ? '✓ On Track to Meet Objective' : '⚠ Gap to Objective'}
                    </div>
                    {!forecastData.forecast.onTrack && (
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        Need <strong>{Math.round(Math.abs(forecastData.forecast.gap))}</strong> more codes to reach objective.
                        <br />
                        This would require approximately:
                        <ul style={{ marginTop: '10px', marginLeft: '20px' }}>
                          <li><strong>{Math.round(Math.abs(forecastData.forecast.gap) / conversionRates.pendingToCode)}</strong> additional pending agents, or</li>
                          <li><strong>{Math.round(Math.abs(forecastData.forecast.gap) / (conversionRates.setupToPending * conversionRates.pendingToCode))}</strong> additional setup kits</li>
                        </ul>
                      </div>
                    )}
                    {forecastData.forecast.onTrack && (
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        Forecasted to exceed objective by <strong>{Math.round(Math.abs(forecastData.forecast.gap))}</strong> codes.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        /* Raw Data Table View */
        <div style={{ 
          backgroundColor: '#fff', 
          padding: '20px', 
          borderRadius: '8px', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
        }}>
          <DataTable
            columns={columns}
            data={filteredByOrg}
            initialSortBy={[{ id: 'email_received_date', desc: true }]}
          />
        </div>
      )}
    </div>
  );
};

export default CodePotential;
