import React, { useState, useEffect, useRef } from 'react';
import { 
  FiBarChart2, 
  FiCalendar, 
  FiActivity,
  FiExternalLink,
  FiDownload,
  FiRefreshCw,
  FiArrowLeft,
  FiInfo,
  FiClock,
  FiSettings,
  FiMaximize2,
  FiMinimize2,
  FiX,
  FiChevronDown,
  FiFileText,
  FiTrendingUp,
  FiUsers,
  FiFolder
} from 'react-icons/fi';
import { BsHandshake, BsFiletypeXlsx, BsCloudCheck } from 'react-icons/bs';
import { FaHandshake, FaStar } from 'react-icons/fa';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import './Reports.css';

const Reports = ({ 
  reportConfig, 
  children, 
  onBack,
  showBackButton = true,
  title,
  description,
  actions = [],
  metadata = {},
  loading = false,
  error = null,
  onRefresh = null,
  fullScreenCapable = false,
  onExport = null, // Custom export function
  onPrepareForExport = null, // Function to prepare components for export (expand scrollable areas, etc.)
  dateRange = null, // Date range information for PDF header
  rangeType = null, // Range type (week, month, year) for PDF header
  exportData = null // Data for XLSX export (leaderboard data, summary, etc.)
}) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0, stage: '' });
  const [cancelExport, setCancelExport] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const reportContentRef = useRef(null);
  const exportDropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
        setShowExportDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Format date range for PDF header
  const formatDateRangeForPDF = () => {
    if (!dateRange) return '';
    
    // Support both old and new date range formats
    const start = dateRange.start_date || dateRange.start;
    const end = dateRange.end_date || dateRange.end;
    const type = dateRange.type || rangeType;
    
    if (!start) return '';
    
    const startDate = new Date(start + 'T00:00:00');
    
    switch (type) {
      case 'year':
        return startDate.getFullYear().toString();
      case 'month':
        return startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'week':
        const endDate = end ? new Date(end + 'T00:00:00') : new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000);
        return `${startDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })}-${endDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })}`;
      case 'custom':
        if (!end) return startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const customEndDate = new Date(end + 'T00:00:00');
        return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${customEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      default:
        return '';
    }
  };

  // Handle refresh functionality
  const handleRefresh = () => {
    if (onRefresh) {
      setLastRefresh(new Date());
      onRefresh();
    }
  };

  // Toggle fullscreen mode
  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  // Optimized PDF Export with progress tracking and memory management
  const handlePDFExport = async () => {
    if (isExporting) return;
    
    setIsExporting(true);
    setCancelExport(false);
    setExportProgress({ current: 0, total: 0, stage: 'Preparing...' });
    
    try {
      // Step 1: Prepare components for export
      setExportProgress({ current: 0, total: 0, stage: 'Preparing content...' });
      if (onPrepareForExport) {
        await onPrepareForExport();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Step 2: Get the report container element
      const reportElement = reportContentRef.current;
      if (!reportElement) {
        throw new Error('Report container not found');
      }

      console.log('📸 Starting optimized multi-page PDF export...');
      console.log(`📏 Content dimensions: ${reportElement.scrollWidth}x${reportElement.scrollHeight}px`);

      // Step 3: Calculate page dimensions for US Letter (8.5" x 11")
      const letterWidthMm = 216; // 8.5 inches = 216mm
      const letterHeightMm = 279; // 11 inches = 279mm
      const topMarginMm = 25; // Space for title and date range
      const bottomMarginMm = 15; // Space for page numbers
      const sideMarginMm = 13; // Side margins
      const usableHeightMm = letterHeightMm - topMarginMm - bottomMarginMm;
      const usableWidthMm = letterWidthMm - (sideMarginMm * 2);
      
      const contentWidth = reportElement.scrollWidth;
      const contentHeight = reportElement.scrollHeight;
      
      // Dynamic scale based on content size - reduce for large exports
      let scale = contentHeight > 10000 ? 1.2 : contentHeight > 5000 ? 1.5 : 2;
      
      // Calculate how many pixels fit on one US Letter page at the chosen scale
      // Standard web assumption: 96 DPI, so ~3.78 pixels per mm at 1x scale
      const basePixelsPerMm = 3.78;
      const pixelsPerMm = basePixelsPerMm * scale;
      const maxPageHeightPx = Math.floor(usableHeightMm * pixelsPerMm);
      
      const numPages = Math.ceil(contentHeight / maxPageHeightPx);
      console.log(`📚 Will create ${numPages} page(s) at ${scale}x scale`);
      
      // Warn user about very large exports
      if (numPages > 50) {
        if (!window.confirm(`This will create ${numPages} pages and may take several minutes. Continue?`)) {
          return;
        }
      }

      setExportProgress({ current: 0, total: numPages, stage: 'Generating pages...' });

      // Step 4: Create PDF document (US Letter format)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter' // US Letter 8.5" x 11"
      });

      // Step 5: Memory-efficient page capture
      for (let pageIndex = 0; pageIndex < numPages; pageIndex++) {
        // Check for cancellation
        if (cancelExport) {
          console.log('🚫 Export cancelled by user');
          throw new Error('Export cancelled by user');
        }
        
        setExportProgress({ 
          current: pageIndex + 1, 
          total: numPages, 
          stage: `Capturing page ${pageIndex + 1}/${numPages}...` 
        });
        
        const yOffset = pageIndex * maxPageHeightPx;
        const remainingHeight = Math.min(maxPageHeightPx, contentHeight - yOffset);
        
        // Optimized canvas options for memory efficiency
        const canvasOptions = {
          backgroundColor: '#ffffff',
          scale: scale,
          useCORS: true,
          allowTaint: true,
          logging: false, // Disable html2canvas logging for performance
          scrollX: 0,
          scrollY: yOffset,
          width: contentWidth,
          height: remainingHeight,
          windowWidth: contentWidth,
          windowHeight: remainingHeight,
          x: 0,
          y: yOffset
        };

        try {
          // Capture page with timeout to prevent hanging
          const capturePromise = html2canvas(reportElement, canvasOptions);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Page capture timeout')), 30000)
          );
          
          const canvas = await Promise.race([capturePromise, timeoutPromise]);
          
          // Use lower quality for large exports to reduce memory usage
          const imageQuality = numPages > 20 ? 0.7 : numPages > 10 ? 0.8 : 0.9;
          const imgData = canvas.toDataURL('image/jpeg', imageQuality); // Use JPEG for better compression
          
          // Add new page if not the first page
          if (pageIndex > 0) {
            pdf.addPage();
          }
          
          // Calculate dimensions to fit US Letter page with centered content
          const imgWidth = canvas.width;
          const imgHeight = canvas.height;
          
          // Scale to fit within usable area
          const pdfWidth = usableWidthMm;
          const pdfHeight = (imgHeight * pdfWidth) / imgWidth;
          
          let finalWidth = pdfWidth;
          let finalHeight = pdfHeight;
          
          // If content is too tall, scale to fit height
          if (pdfHeight > usableHeightMm) {
            finalHeight = usableHeightMm;
            finalWidth = (imgWidth * finalHeight) / imgHeight;
          }
          
          // Center the content horizontally and position below header
          const xOffset = (letterWidthMm - finalWidth) / 2;
          const yOffset = topMarginMm;
          
          // Add page header (title and date range) on first page or if specified
          if (pageIndex === 0 || true) { // Add header to all pages
            pdf.setFontSize(16);
            pdf.setTextColor(0, 0, 0);
            const reportTitle = title || reportConfig?.title || 'Report';
            pdf.text(reportTitle, letterWidthMm / 2, 15, { align: 'center' });
            
            // Add date range if available
            const dateRangeText = formatDateRangeForPDF();
            if (dateRangeText) {
              pdf.setFontSize(12);
              pdf.setTextColor(100, 100, 100);
              pdf.text(dateRangeText, letterWidthMm / 2, 21, { align: 'center' });
            }
          }
          
          // Add the image to PDF
          pdf.addImage(imgData, 'JPEG', xOffset, yOffset, finalWidth, finalHeight);
          
          // Add page number at bottom
          pdf.setFontSize(10);
          pdf.setTextColor(128, 128, 128);
          pdf.text(`Page ${pageIndex + 1} of ${numPages}`, letterWidthMm / 2, letterHeightMm - 8, { align: 'center' });
          
          // Memory cleanup
          canvas.width = 0;
          canvas.height = 0;
          
        } catch (pageError) {
          console.error(`❌ Error capturing page ${pageIndex + 1}:`, pageError);
          
          if (pageIndex > 0) {
            pdf.addPage();
          }
          
          pdf.setFontSize(16);
          pdf.setTextColor(200, 50, 50);
          pdf.text(`Error capturing page ${pageIndex + 1}`, letterWidthMm / 2, letterHeightMm / 2, { align: 'center' });
          pdf.setFontSize(12);
          pdf.text(pageError.message.includes('timeout') ? 'Page capture timed out' : 'Could not render this section', 
                   letterWidthMm / 2, (letterHeightMm / 2) + 10, { align: 'center' });
        }
        
        // Yield to browser between pages for better responsiveness
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Force garbage collection hint every 10 pages
        if (pageIndex % 10 === 0 && pageIndex > 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      // Step 6: Save PDF
      setExportProgress({ current: numPages, total: numPages, stage: 'Saving PDF...' });
      
      const reportTitle = title || reportConfig?.title || 'Report';
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${reportTitle.replace(/\s+/g, '_')}_${timestamp}.pdf`;
      
      pdf.save(filename);
      
      console.log(`✅ Optimized PDF export completed: ${filename} (${numPages} pages)`);
      
    } catch (error) {
      console.error('❌ PDF export failed:', error);
      
      if (error.message.includes('cancelled by user')) {
        console.log('Export cancelled - no error shown to user');
        return; // Don't show error for user cancellation
      }
      
      let errorMessage = 'Failed to export PDF. ';
      if (error.message.includes('Invalid string length')) {
        errorMessage += 'The report is too large for your browser\'s memory. Try reducing the date range.';
      } else if (error.message.includes('timeout')) {
        errorMessage += 'Export timed out. The report may be too complex.';
      } else if (error.message.includes('PNG') || error.message.includes('JPEG')) {
        errorMessage += 'Image processing failed. Try again or reduce the content size.';
      } else {
        errorMessage += 'Please try again or contact support.';
      }
      
      window.alert(errorMessage);
    } finally {
      // Reset export preparation state
      if (onPrepareForExport) {
        if (typeof onPrepareForExport.reset === 'function') {
          onPrepareForExport.reset();
        }
      }
      setIsExporting(false);
      setCancelExport(false);
      setExportProgress({ current: 0, total: 0, stage: '' });
    }
  };

  // XLSX Export functionality - Dynamic and flexible for different report types
  const handleXLSXExport = async () => {
    if (isExporting) return;
    
    setIsExporting(true);
    setExportProgress({ current: 0, total: 0, stage: 'Preparing XLSX...' });
    
    try {
      console.log('📊 Starting XLSX export...');
      console.log('📊 Export data structure:', exportData);
      
      // Create a new workbook
      const workbook = XLSX.utils.book_new();
      
      // Add summary sheet - dynamically adapt to different summary structures
      if (exportData?.summary) {
        const summaryData = [
          ['Report Summary'],
          [''],
          ['Report Title', title || reportConfig?.title || 'Report'],
          ['Date Range', formatDateRangeForPDF()],
          ['Generated', new Date().toLocaleString()],
          [''],
          ['Metric', 'Value']
        ];
        
        // Dynamically add summary metrics based on what's available
        const summary = exportData.summary;
        
                 // Common field mappings for different report types
         const fieldMappings = {
           // RefReport fields
           completedRefs: 'Ref Sales',
           activeRefs: 'Pending',
           totalRefs: 'Total Submitted',
           conversionRate: 'Conversion Rate',
           
           // MoreReport fields
           totalSets: 'Total Sets',
           totalShows: 'Total Shows',
           totalHires: 'Total Hires',
           prHires: 'PR Hires',
           finalsSet: 'Finals Set',
           finalsShow: 'Finals Show',
           
           // Generic/common fields
           totalUsers: 'Total Users',
           activeUsers: 'Active Users',
           totalRevenue: 'Total Revenue',
           avgPerformance: 'Average Performance'
         };
        
                 // Add available summary fields
         console.log('📊 Summary fields detected:', Object.keys(summary));
         Object.entries(summary).forEach(([key, value]) => {
           const displayName = fieldMappings[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
           
           // Format the value appropriately
           let formattedValue = value;
           if (key.toLowerCase().includes('rate') || key.toLowerCase().includes('percent')) {
             formattedValue = `${value}%`;
           } else if (typeof value === 'number') {
             formattedValue = value;
           }
           
           summaryData.push([displayName, formattedValue]);
         });
        
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        
        // ADVANCED SUMMARY SHEET FORMATTING
        
        // Style the main title (A1)
        summarySheet['A1'].s = {
          font: { bold: true, sz: 16, color: { rgb: "366092" } },
          alignment: { horizontal: "center", vertical: "center" },
          fill: { bgColor: { indexed: 64 }, fgColor: { rgb: "E8F0FE" } }
        };
        
        // Format the metric headers (row with "Metric" and "Value")
        const metricHeaderRow = summaryData.findIndex(row => row[0] === 'Metric');
        if (metricHeaderRow > -1) {
          ['A', 'B'].forEach(col => {
            const cellRef = `${col}${metricHeaderRow + 1}`;
            if (summarySheet[cellRef]) {
              summarySheet[cellRef].s = {
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
          });
        }
        
        // Format data rows with alternating colors and borders
        summaryData.forEach((row, index) => {
          if (index > metricHeaderRow && metricHeaderRow > -1) {
            ['A', 'B'].forEach(col => {
              const cellRef = `${col}${index + 1}`;
              if (summarySheet[cellRef]) {
                const isEvenRow = (index - metricHeaderRow) % 2 === 0;
                summarySheet[cellRef].s = {
                  border: {
                    top: { style: "thin" },
                    bottom: { style: "thin" },
                    left: { style: "thin" },
                    right: { style: "thin" }
                  },
                  alignment: { horizontal: col === 'A' ? "left" : "center" },
                  fill: isEvenRow ? { bgColor: { indexed: 64 }, fgColor: { rgb: "F8F9FA" } } : undefined
                };
                
                // Bold the metric names (column A)
                if (col === 'A') {
                  summarySheet[cellRef].s.font = { bold: true };
                }
              }
            });
          }
        });
        
        // Set column widths
        summarySheet['!cols'] = [
          { wch: 25 }, // Metric column
          { wch: 20 }  // Value column
        ];
        
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
      }
      
      // Add leaderboard sheet - dynamically adapt to different leaderboard structures
      if (exportData?.leaderboardData && exportData.leaderboardData.length > 0) {
        const firstItem = exportData.leaderboardData[0];
        
        // Dynamically determine headers based on the data structure
        const headers = ['Rank', 'Name'];
        const dataKeys = ['rank', 'name'];
        
        // Add MGA if available (common in many reports)
        if (firstItem.MGA || firstItem.mga) {
          headers.push('MGA');
          dataKeys.push(firstItem.MGA ? 'MGA' : 'mga');
        }
        
        // Add Role/Level if available
        if (firstItem.clname || firstItem.level) {
          headers.push('Role');
          dataKeys.push(firstItem.clname ? 'clname' : 'level');
        }
        
                 // Dynamically add metric columns based on data structure
         const metricFields = [
           // RefReport metrics
           { key: 'true_refs', display: 'Ref Sales' },
           { key: 'total_refs', display: 'Total Refs' },
           { key: 'conversion_rate', display: 'Conversion Rate', format: 'percentage' },
           
           // MoreReport metrics
           { key: 'Total_Hires', display: 'Total Hires' },
           { key: 'PR_Hires', display: 'PR Hires' },
           { key: 'Total_Set', display: 'Total Sets' },
           { key: 'Total_Show', display: 'Total Shows' },
           { key: 'Finals_Set', display: 'Finals Set' },
           { key: 'Finals_Show', display: 'Finals Show' },
           { key: 'Group_Invite', display: 'Group Invites' },
           
           // Generic metrics
           { key: 'score', display: 'Score' },
           { key: 'points', display: 'Points' },
           { key: 'value', display: 'Value' }
         ];
        
                 // Add available metric columns
         metricFields.forEach(field => {
           if (firstItem.hasOwnProperty(field.key)) {
             headers.push(field.display);
             dataKeys.push({ key: field.key, format: field.format });
           }
         });
         
         console.log('📊 Detected leaderboard columns:', headers);
         console.log('📊 Data keys for export:', dataKeys);
        
        // Build leaderboard rows
        const leaderboardRows = [];
        
        exportData.leaderboardData.forEach((item, index) => {
          const row = [];
          
          dataKeys.forEach(keyInfo => {
            if (typeof keyInfo === 'string') {
              // Simple field
              row.push(item[keyInfo] || '');
            } else {
              // Field with formatting
              let value = item[keyInfo.key] || 0;
              if (keyInfo.format === 'percentage') {
                value = `${value}%`;
              }
              row.push(value);
            }
          });
          
          leaderboardRows.push(row);
          
          // Add expanded team data if available (for RefReport)
          if (exportData.expandedData && exportData.expandedData[`${item.name}_${index}`]) {
            const teamData = exportData.expandedData[`${item.name}_${index}`];
            if (teamData.data && teamData.data.length > 0) {
              teamData.data.forEach((agent, agentIndex) => {
                const expandedRow = [];
                
                dataKeys.forEach(keyInfo => {
                  if (typeof keyInfo === 'string') {
                    let value = agent[keyInfo] || '';
                    // Indent team member names
                    if (keyInfo === 'name') {
                      value = `  ${value}`;
                    } else if (keyInfo === 'rank') {
                      value = `  ${agent.team_rank || (agentIndex + 1)}`;
                    }
                    expandedRow.push(value);
                  } else {
                    let value = agent[keyInfo.key] || 0;
                    if (keyInfo.format === 'percentage') {
                      value = `${value}%`;
                    }
                    expandedRow.push(value);
                  }
                });
                
                leaderboardRows.push(expandedRow);
              });
            }
          }
        });
        
        const leaderboardData = [headers, ...leaderboardRows];
        const leaderboardSheet = XLSX.utils.aoa_to_sheet(leaderboardData);
        
        // ADVANCED LEADERBOARD SHEET FORMATTING
        
        // Set dynamic column widths based on headers
        const columnWidths = headers.map(header => {
          if (header === 'Name') return { wch: 25 };
          if (header === 'MGA') return { wch: 20 };
          if (header === 'Rank') return { wch: 6 };
          if (header === 'Role') return { wch: 8 };
          if (header.includes('Rate') || header.includes('%')) return { wch: 15 };
          return { wch: 12 };
        });
        leaderboardSheet['!cols'] = columnWidths;
        
        // Format header row
        const leaderboardRange = XLSX.utils.decode_range(leaderboardSheet['!ref']);
        for (let col = leaderboardRange.s.c; col <= leaderboardRange.e.c; col++) {
          const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
          if (!leaderboardSheet[cellRef]) continue;
          
          leaderboardSheet[cellRef].s = {
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
        
        // Format data rows with alternating colors, borders, and number formatting
        for (let row = 1; row <= leaderboardRange.e.r; row++) {
          for (let col = 0; col <= leaderboardRange.e.c; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
            if (!leaderboardSheet[cellRef]) continue;
            
            const header = headers[col];
            const cellStyle = {
              border: {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" }
              },
              alignment: { horizontal: "center" }
            };
            
            // Apply number formatting
            if (header && header.includes('%')) {
              cellStyle.numFmt = '0"%"';
            } else if (header && (header.includes('Rate') || header.includes('Ratio'))) {
              cellStyle.numFmt = '0.00';
            } else if (typeof leaderboardSheet[cellRef].v === 'number' && header !== 'Rank') {
              cellStyle.numFmt = '0';
            }
            
            // Alternating row colors
            if (row % 2 === 0) {
              cellStyle.fill = { bgColor: { indexed: 64 }, fgColor: { rgb: "F8F9FA" } };
            }
            
            // Special formatting for rank column
            if (header === 'Rank') {
              cellStyle.font = { bold: true };
              cellStyle.fill = { bgColor: { indexed: 64 }, fgColor: { rgb: "FFF3CD" } };
            }
            
            // Special formatting for names (left align)
            if (header === 'Name') {
              cellStyle.alignment = { horizontal: "left" };
              // Bold for team names (not indented)
              if (typeof leaderboardSheet[cellRef].v === 'string' && !leaderboardSheet[cellRef].v.startsWith('  ')) {
                cellStyle.font = { bold: true };
              }
            }
            
            leaderboardSheet[cellRef].s = cellStyle;
          }
        }
        
        // Freeze header row
        leaderboardSheet['!freeze'] = { xSplit: 0, ySplit: 1 };
        
        XLSX.utils.book_append_sheet(workbook, leaderboardSheet, 'Leaderboard');
      }
      
            // Add chart data sheet if available - flexible for different chart structures with ORDERED columns and FORMATTING
      if (exportData?.chartData && exportData.chartData.length > 0) {
        const firstChartItem = exportData.chartData[0];
        
        console.log('📊 Chart data structure detected:', Object.keys(firstChartItem));
        
        let chartHeaders = [];
        let chartFieldOrder = [];
        
        // Check if this is MoreReport data (has MORE_Date) for special ordered export
        if (firstChartItem.hasOwnProperty('MORE_Date')) {
          // MoreReport: Use EXACT order specified by user
          const moreReportOrder = [
            { field: 'MORE_Date', header: 'MORE Date' },
            { field: 'MGA', header: 'MGA' },
            { field: 'Total_Hires_Key', header: 'Total Hires' },
            { field: 'External_Sets', header: 'External Sets' },
            { field: 'External_Shows', header: 'External Shows' },
            { field: 'External_Show_Ratio', header: 'External Show Ratio (%)', format: 'percentage' },
            { field: 'Internal_Sets', header: 'Internal Sets' },
            { field: 'Internal_Shows', header: 'Internal Shows' },
            { field: 'Internal_Show_Ratio', header: 'Internal Show Ratio (%)', format: 'percentage' },
            { field: 'Personal_Sets', header: 'Personal Sets' },
            { field: 'Personal_Shows', header: 'Personal Shows' },
            { field: 'Personal_Show_Ratio', header: 'Personal Show Ratio (%)', format: 'percentage' },
            { field: 'Total_Set', header: 'Total Set' },
            { field: 'Total_Show', header: 'Total Show' },
            { field: 'Total_Show_Ratio', header: 'Total Show Ratio (%)', format: 'percentage' },
            { field: 'Group_Invite', header: 'Group Invite' },
            { field: 'Group_Invite_Percent', header: 'Group Invite % of Shows', format: 'percentage' },
            { field: 'Finals_Set', header: 'Finals Set' },
            { field: 'Finals_Show', header: 'Finals Show' },
            { field: 'Finals_Show_Ratio', header: 'Finals Show Ratio (%)', format: 'percentage' },
            { field: 'Non_PR_Hires', header: 'Non-PR Hires' },
            { field: 'PR_Hires', header: 'PR Hires' },
            { field: 'Total_Hires', header: 'Total Hires' },
            { field: 'Set_to_Hire_Ratio', header: 'Set to Hire Ratio', format: 'decimal' },
            { field: 'Show_to_Hire_Ratio', header: 'Show to Hire Ratio', format: 'decimal' },
            { field: 'PR_Hire_Percentage', header: 'PR Hire Percentage (%)', format: 'percentage' },
            { field: 'Finals_to_Hire_Rate', header: 'Finals to Hire Rate', format: 'decimal' },
            { field: 'RGA', header: 'RGA' },
            { field: 'Tree', header: 'Tree' }
          ];
          
          // Filter to only include fields that exist in the data
          moreReportOrder.forEach(({ field, header, format }) => {
            if (firstChartItem.hasOwnProperty(field)) {
              chartHeaders.push(header);
              chartFieldOrder.push({ field, format });
            }
          });
          
        } else {
          // RefReport or other: Use dynamic detection with primary value
          chartHeaders = ['Date'];
          chartFieldOrder = [{ field: 'date' }];
          
          let valueKey = 'value';
          let valueHeader = 'Value';
          
          // Check for specific value fields and customize headers
          if (firstChartItem.hasOwnProperty('approved_refs')) {
            valueKey = 'approved_refs';
            valueHeader = 'Approved Referrals';
          } else if (firstChartItem.hasOwnProperty('true_refs')) {
            valueKey = 'true_refs';
            valueHeader = 'Ref Sales';
          } else if (firstChartItem.hasOwnProperty('Total_Hires')) {
            valueKey = 'Total_Hires';
            valueHeader = 'Total Hires';
          } else if (firstChartItem.hasOwnProperty('hires')) {
            valueKey = 'hires';
            valueHeader = 'Hires';
          }
          
          chartHeaders.push(valueHeader);
          chartFieldOrder.push({ field: valueKey });
          
          // Add additional fields for RefReport
          const additionalFields = ['sets', 'shows', 'pending_refs', 'rejected_refs', 'user_true_refs', 'team_true_refs'];
          additionalFields.forEach(field => {
            if (firstChartItem.hasOwnProperty(field)) {
              const displayName = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              chartHeaders.push(displayName);
              chartFieldOrder.push({ field });
            }
          });
        }
        
        console.log('📊 Final chart headers:', chartHeaders);
        
        // Build chart rows using the ordered field mapping
        const chartRows = exportData.chartData.map(item => {
          return chartFieldOrder.map(({ field }) => {
            return item[field] || (typeof item[field] === 'number' ? 0 : '');
          });
        });
        
        const chartData = [chartHeaders, ...chartRows];
        const chartSheet = XLSX.utils.aoa_to_sheet(chartData);
        
        // ADVANCED XLSX FORMATTING
        
        // 1. Set dynamic column widths with optimization
        const chartColumnWidths = chartHeaders.map((header, index) => {
          if (header.includes('Date')) return { wch: 12 };
          if (header.includes('MGA') || header.includes('RGA')) return { wch: 20 };
          if (header.includes('Tree')) return { wch: 15 };
          if (header.includes('Ratio') || header.includes('%') || header.includes('Rate')) return { wch: 18 };
          if (header.includes('Sets') || header.includes('Shows') || header.includes('Hires')) return { wch: 14 };
          return { wch: 12 };
        });
        chartSheet['!cols'] = chartColumnWidths;
        
        // 2. Format header row (row 1)
        const headerRange = XLSX.utils.decode_range(chartSheet['!ref']);
        for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
          const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
          if (!chartSheet[cellRef]) continue;
          
          chartSheet[cellRef].s = {
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
        
        // 3. Format data cells with number formatting and borders
        for (let row = 1; row <= headerRange.e.r; row++) {
          for (let col = 0; col <= headerRange.e.c; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
            if (!chartSheet[cellRef]) continue;
            
            const fieldInfo = chartFieldOrder[col];
            const cellStyle = {
              border: {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" }
              },
              alignment: { horizontal: "center" }
            };
            
            // Apply number formatting based on field type
            if (fieldInfo && fieldInfo.format === 'percentage') {
              cellStyle.numFmt = '0"%"'; // Format as percentage with % symbol
            } else if (fieldInfo && fieldInfo.format === 'decimal') {
              cellStyle.numFmt = '0.00'; // Format as decimal with 2 places
            } else if (typeof chartSheet[cellRef].v === 'number' && !fieldInfo?.field.includes('Date')) {
              cellStyle.numFmt = '0'; // Format as whole number
            }
            
            // Alternate row colors for better readability
            if (row % 2 === 0) {
              cellStyle.fill = { bgColor: { indexed: 64 }, fgColor: { rgb: "F2F2F2" } };
            }
            
            chartSheet[cellRef].s = cellStyle;
          }
        }
        
        // 4. Freeze header row
        chartSheet['!freeze'] = { xSplit: 0, ySplit: 1 };
        
        // 5. Set print settings for landscape orientation
        chartSheet['!printSettings'] = {
          orientation: 'landscape',
          scale: 85, // Slightly smaller to fit more columns
          fitToWidth: 1,
          fitToHeight: 0
        };
        
        XLSX.utils.book_append_sheet(workbook, chartSheet, 'Chart Data');
      }
      
      // Generate filename and save
      setExportProgress({ current: 1, total: 1, stage: 'Saving XLSX...' });
      
      const reportTitle = title || reportConfig?.title || 'Report';
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${reportTitle.replace(/\s+/g, '_')}_${timestamp}.xlsx`;
      
      // Write and download the file
      XLSX.writeFile(workbook, filename);
      
      console.log(`✅ XLSX export completed: ${filename}`);
      
    } catch (error) {
      console.error('❌ XLSX export failed:', error);
      window.alert('Failed to export XLSX file. Please try again.');
    } finally {
      setIsExporting(false);
      setExportProgress({ current: 0, total: 0, stage: '' });
    }
  };

  // Handle export functionality
  const handleExport = (type = 'pdf') => {
    setShowExportDropdown(false); // Close dropdown
    
    if (onExport) {
      // Use custom export function if provided
      onExport(type);
    } else {
      // Use built-in export functions
      if (type === 'xlsx') {
        handleXLSXExport();
      } else {
        handlePDFExport();
      }
    }
  };

  // Default report metadata
  const defaultMetadata = {
    category: 'Custom',
    frequency: 'On-demand',
    lastUpdated: lastRefresh,
    ...metadata
  };

  return (
    <div className={`report-container ${isFullScreen ? 'fullscreen' : ''}`} ref={reportContentRef}>
      {/* Report Header */}
      <div className="report-header">
        <div className="report-header-left">
          {showBackButton && (
            <button 
              className="back-btn"
              onClick={onBack}
              title="Back to Reports"
            >
              <FiArrowLeft size={20} />
            </button>
          )}
          
          <div className="report-title-section">
            <h1 className="report-title">
              {title || reportConfig?.title || 'Report'}
            </h1>
            {(description || reportConfig?.description) && (
              <p className="report-description">
                {description || reportConfig?.description}
              </p>
            )}
          </div>
        </div>

        <div className="report-header-right">
          <div className="report-metadata">
            <span className="metadata-item">
              <FiActivity size={14} />
              {defaultMetadata.category}
            </span>
            <span className="metadata-item">
              <FiCalendar size={14} />
              {defaultMetadata.frequency}
            </span>
            <span className="metadata-item">
              <FiClock size={14} />
              Updated: {defaultMetadata.lastUpdated.toLocaleTimeString()}
            </span>
          </div>

          <div className="report-actions">
            {/* Custom Actions */}
            {actions.map((action, index) => (
              action.component ? (
                <div key={index} className="report-action-component">
                  {action.component}
                </div>
              ) : (
                <button
                  key={index}
                  className={`report-action-btn ${action.variant || 'secondary'}`}
                  onClick={action.onClick}
                  title={action.title}
                  disabled={action.disabled}
                >
                  {action.icon}
                  {action.label}
                </button>
              )
            ))}

            {/* Export Dropdown Button with Progress */}
            <div ref={exportDropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
              <button
                className="report-action-btn primary"
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                title="Export report"
                disabled={loading || isExporting}
                style={{ 
                  minWidth: isExporting ? '180px' : 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <FiDownload className={isExporting ? 'spinning' : ''} size={16} />
                {isExporting ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                    <span style={{ fontSize: '12px' }}>
                      {exportProgress.stage || 'Exporting...'}
                    </span>
                    {exportProgress.total > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                        <div style={{
                          width: '60px',
                          height: '4px',
                          backgroundColor: 'rgba(255,255,255,0.3)',
                          borderRadius: '2px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${(exportProgress.current / exportProgress.total) * 100}%`,
                            height: '100%',
                            backgroundColor: '#fff',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                        <span>{exportProgress.current}/{exportProgress.total}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <span></span>
                    <FiChevronDown size={12} />
                  </>
                )}
              </button>

              {/* Export Dropdown Menu */}
              {showExportDropdown && !isExporting && (
                <div className="export-dropdown-menu">
                  <button
                    onClick={() => handleExport('pdf')}
                    className="export-dropdown-item"
                  >
                    <FiFileText size={16} />
                    Export PDF
                  </button>
                  <button
                    onClick={() => handleExport('xlsx')}
                    className="export-dropdown-item"
                  >
                    <FiBarChart2 size={16} />
                    Export XLSX
                  </button>
                </div>
              )}
            </div>

            {/* Cancel Export Button - Show when exporting large reports */}
            {isExporting && exportProgress.total > 10 && (
              <button
                className="report-action-btn secondary"
                onClick={() => setCancelExport(true)}
                title="Cancel PDF export"
                style={{ backgroundColor: '#dc3545', borderColor: '#dc3545', color: 'white' }}
              >
                <FiX size={16} />
                
              </button>
            )}

            {/* Refresh Button */}
            {onRefresh && (
              <button
                className="report-action-btn secondary"
                onClick={handleRefresh}
                title="Refresh Report"
                disabled={loading}
              >
                <FiRefreshCw className={loading ? 'spinning' : ''} size={16} />
                
              </button>
            )}

            {/* Fullscreen Toggle */}
            {fullScreenCapable && (
              <button
                className="report-action-btn secondary"
                onClick={toggleFullScreen}
                title={isFullScreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              >
                {isFullScreen ? <FiMinimize2 size={16} /> : <FiMaximize2 size={16} />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="report-content">
        {loading && (
          <div className="route-loading" role="alert" aria-busy="true">
            <div className="spinner"></div>
            <p>Loading report data...</p>
          </div>
        )}

        {error && (
          <div className="report-error">
            <FiInfo size={24} />
            <h3>Error Loading Report</h3>
            <p>{error}</p>
            {onRefresh && (
              <button 
                className="retry-btn"
                onClick={handleRefresh}
              >
                <FiRefreshCw size={16} />
                Try Again
              </button>
            )}
          </div>
        )}

        {!loading && !error && children}
      </div>

      {/* Report Footer */}
      <div className="report-footer">
        <div className="report-footer-info">
          <span>
            Generated on {new Date().toLocaleString()}
          </span>
          {reportConfig?.version && (
            <span>
              Version {reportConfig.version}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports; 