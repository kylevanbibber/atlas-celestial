import React, { useState, useEffect } from 'react';
import { 
  FiBarChart2, 
  FiTrendingUp, 
  FiCalendar, 
  FiActivity,
  FiExternalLink,
  FiDownload,
  FiRefreshCw,
  FiEye,
  FiClock,
  FiFolder,
  FiFileText,
  FiSearch,
  FiFilter,
  FiGrid,
  FiList,
  FiSettings,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiEyeOff,
  FiSave,
  FiX,
  FiUsers
} from 'react-icons/fi';
import { BsFiletypeXlsx, BsCloudCheck } from 'react-icons/bs';
import { FaHandshake } from 'react-icons/fa';
import './ProductionReports.css';
import './ProductionReportsAdmin.css';
import ReportVersionModal from './ReportVersionModal';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';

// Import the modular reports
import { RefReport } from './reports';
import MoreReport from './reports/MoreReport';

// Test RefReport import
console.log('RefReport component imported:', RefReport);

const ProductionReports = () => {
  const { hasPermission } = useAuth();
  const isAdmin = hasPermission('admin');
  
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // grid or list
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [oneDriveReports, setOneDriveReports] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [viewingReport, setViewingReport] = useState(null);
  const [reportBreadcrumb, setReportBreadcrumb] = useState([]);
  
  // Admin states
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [categories, setCategories] = useState([]);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminModalType, setAdminModalType] = useState(''); // 'report', 'category'
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [showHidden, setShowHidden] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterFrequency, setFilterFrequency] = useState('');

  // Report categories for filtering
  const reportCategories = [
    { id: 'all', label: 'All Reports', icon: <FiBarChart2 /> },
    { id: 'daily', label: 'Daily Reports', icon: <FiCalendar /> },
    { id: 'weekly', label: 'Weekly Reports', icon: <FiCalendar /> },
    { id: 'monthly', label: 'Monthly Reports', icon: <FiCalendar /> },
    { id: 'quarterly', label: 'Quarterly Reports', icon: <FiTrendingUp /> },
    { id: 'annual', label: 'Annual Reports', icon: <FiTrendingUp /> },
    { id: 'referrals', label: 'Referral Reports', icon: <FiUsers /> },
    { id: 'onedrive', label: 'OneDrive Reports', icon: <BsCloudCheck /> },
    { id: 'custom', label: 'Custom Reports', icon: <FiFolder /> }
  ];

  // Frequency options for reports
  const frequencyOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'annual', label: 'Annual' },
    { value: 'ad-hoc', label: 'Ad-hoc' }
  ];

  // Helper function to get icon component from string
  const getIconComponent = (iconString) => {
    const iconMap = {
      'FiActivity': <FiActivity />,
      'FiTrendingUp': <FiTrendingUp />,
      'FiUsers': <FiUsers />,
      'FiBarChart2': <FiBarChart2 />,
      'FiCalendar': <FiCalendar />,
      'FiFolder': <FiFolder />,
      'BsCloudCheck': <BsCloudCheck />,
      'BsHandshake': <FaHandshake />,
      'FaHandshake': <FaHandshake />
    };
    return iconMap[iconString] || <FiFileText />;
  };

  // Helper function to get category from frequency and metadata
  const getCategoryFromReport = (report) => {
    // Handle OneDrive reports specifically
    if (report.report_type === 'onedrive' || report.type === 'onedrive') {
      const frequency = report.frequency?.toLowerCase();
      // Treat ad-hoc as daily for OneDrive reports
      if (frequency === 'ad-hoc') {
        return 'daily';
      }
      return frequency || 'custom';
    }
    
    // Handle app reports
    if (report.metadata) {
      try {
        const metadata = typeof report.metadata === 'string' ? JSON.parse(report.metadata) : report.metadata;
        if (metadata.category && metadata.category.toLowerCase() === 'referrals') {
          return 'referrals';
        }
      } catch (e) {
        console.warn('Failed to parse report metadata:', e);
      }
    }
    
    // For app reports, use frequency or fallback to custom
    const frequency = report.frequency?.toLowerCase();
    if (frequency === 'ad-hoc') {
      return 'daily';
    }
    return frequency || 'custom';
  };

  // Sample OneDrive reports structure (this would come from OneDrive API)
  const sampleOneDriveReports = [
    {
      id: 'alp-weekly-1',
      title: 'ALP Weekly Summary',
      description: 'Weekly ALP performance data from home office',
      category: 'weekly',
      frequency: 'weekly',
      report_type: 'onedrive',
      type: 'onedrive',
      icon: <BsFiletypeXlsx />,
      fileName: 'ALP_Weekly_Summary_2024_W52.xlsx',
      uploadDate: new Date('2024-12-30'),
      fileSize: '245 KB',
      versions: [
        { date: new Date('2024-12-30'), fileName: 'ALP_Weekly_Summary_2024_W52.xlsx' },
        { date: new Date('2024-12-23'), fileName: 'ALP_Weekly_Summary_2024_W51.xlsx' },
        { date: new Date('2024-12-16'), fileName: 'ALP_Weekly_Summary_2024_W50.xlsx' }
      ],
      downloadUrl: '#', // This would be the OneDrive download URL
      isFromHomeOffice: true
    },
    {
      id: 'production-monthly-1',
      title: 'Monthly Production Report',
      description: 'Monthly production statistics and trends',
      category: 'monthly',
      frequency: 'monthly',
      report_type: 'onedrive',
      type: 'onedrive',
      icon: <BsFiletypeXlsx />,
      fileName: 'Monthly_Production_Dec_2024.xlsx',
      uploadDate: new Date('2024-12-31'),
      fileSize: '892 KB',
      versions: [
        { date: new Date('2024-12-31'), fileName: 'Monthly_Production_Dec_2024.xlsx' },
        { date: new Date('2024-11-30'), fileName: 'Monthly_Production_Nov_2024.xlsx' },
        { date: new Date('2024-10-31'), fileName: 'Monthly_Production_Oct_2024.xlsx' }
      ],
      downloadUrl: '#',
      isFromHomeOffice: true
    },
    {
      id: 'daily-adhoc-1',
      title: 'Daily Ad-hoc Report',
      description: 'Daily ad-hoc production data',
      category: 'daily',
      frequency: 'ad-hoc',
      report_type: 'onedrive',
      type: 'onedrive',
      icon: <BsFiletypeXlsx />,
      fileName: 'Daily_Adhoc_Report_2024_12_31.xlsx',
      uploadDate: new Date('2024-12-31'),
      fileSize: '156 KB',
      versions: [
        { date: new Date('2024-12-31'), fileName: 'Daily_Adhoc_Report_2024_12_31.xlsx' }
      ],
      downloadUrl: '#',
      isFromHomeOffice: true
    }
  ];

  useEffect(() => {
    // Initialize reports
    loadReports();
    if (isAdmin) {
      loadAdminData();
    }
  }, [isAdmin]);

  // URL Management - Check for report parameter in URL on mount and handle browser navigation
  useEffect(() => {
    const checkUrlParams = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const reportParam = urlParams.get('report');
      
      if (reportParam && (reports.length > 0 || oneDriveReports.length > 0)) {
        // Find the report by ID or a URL-friendly slug
        const report = findReportByIdOrSlug(reportParam);
        if (report) {
          console.log('Loading report from URL:', reportParam, report);
          handleReportClickFromUrl(report);
        } else {
          console.warn('Report not found for URL parameter:', reportParam);
          // Remove invalid report parameter from URL
          updateUrlParams(null);
        }
      } else if (!reportParam && viewingReport) {
        // No report parameter but we're viewing a report - go back to reports list
        setViewingReport(null);
        setReportBreadcrumb([]);
      }
    };

    // Check URL params after reports are loaded
    if (reports.length > 0 || oneDriveReports.length > 0) {
      checkUrlParams();
    }
  }, [reports, oneDriveReports]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const reportParam = urlParams.get('report');
      
      if (reportParam && (reports.length > 0 || oneDriveReports.length > 0)) {
        const report = findReportByIdOrSlug(reportParam);
        if (report) {
          handleReportClickFromUrl(report);
        } else {
          // Report not found, go back to reports list
          setViewingReport(null);
          setReportBreadcrumb([]);
        }
      } else {
        // No report parameter, show reports list
        setViewingReport(null);
        setReportBreadcrumb([]);
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [reports, oneDriveReports]);

  // Helper function to find report by ID or URL slug
  const findReportByIdOrSlug = (identifier) => {
    const allReports = [...reports, ...oneDriveReports];
    
    // First try to find by ID
    let report = allReports.find(r => r.id === identifier || r.id === parseInt(identifier));
    
    // If not found by ID, try to find by URL slug (title converted to slug)
    if (!report) {
      report = allReports.find(r => {
        const slug = createUrlSlug(r.title || r.report_name);
        return slug === identifier;
      });
    }
    
    return report;
  };

  // Helper function to create URL-friendly slug from title
  const createUrlSlug = (title) => {
    if (!title) return '';
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  };

  // Helper function to update URL parameters
  const updateUrlParams = (reportIdentifier) => {
    const url = new URL(window.location);
    
    if (reportIdentifier) {
      url.searchParams.set('report', reportIdentifier);
    } else {
      url.searchParams.delete('report');
    }
    
    // Update URL without page reload
    window.history.pushState({}, '', url);
  };

  // Modified function to handle report click from URL (without updating URL again)
  const handleReportClickFromUrl = (report) => {
    console.log('🚀 handleReportClickFromUrl called with:', report);
    
    // Set up breadcrumb navigation
    const breadcrumb = [
      { label: 'Production', path: 'production' },
      { label: 'Reports', path: 'reports' },
      { label: report.title || report.report_name, path: null }
    ];
    
    console.log('🚀 Setting breadcrumb:', breadcrumb);
    console.log('🚀 Setting viewingReport to:', report.title || report.report_name);
    
    setReportBreadcrumb(breadcrumb);
    setViewingReport(report);
  };

  const loadReports = async () => {
    setLoading(true);
    try {
      // Load all reports from API (both OneDrive and in-app reports)
      const reportsRes = await api.get('/production-reports/reports');
      const allApiReports = reportsRes.data.data || [];
      
      // Separate in-app reports from OneDrive reports
      const appReports = [];
      const oneDriveReports = [];
      
      allApiReports.forEach(report => {
        if (report.report_type === 'app') {
          // Transform database app report to frontend format
          const transformedReport = {
            id: report.id,
            title: report.report_name,
            description: report.report_description,
            category: getCategoryFromReport(report),
            type: 'app',
            icon: getIconComponent(report.icon_name),
            lastUpdated: new Date(report.updated_at),
            isInternal: true,
            isModular: true,
            componentName: report.component_name,
            frequency: report.frequency,
            tags: report.tags ? (typeof report.tags === 'string' ? JSON.parse(report.tags) : report.tags) : [],
            metadata: report.metadata ? (typeof report.metadata === 'string' ? JSON.parse(report.metadata) : report.metadata) : {},
            is_hidden: report.is_hidden,
            is_active: report.is_active,
            priority: report.priority,
            sort_order: report.sort_order
          };
          
          // Handle legacy reports with routes
          if (transformedReport.metadata.route) {
            transformedReport.route = transformedReport.metadata.route;
            transformedReport.isModular = false; // legacy report
          }
          
          appReports.push(transformedReport);
        } else {
          // OneDrive report - transform to include icon component
          const transformedOneDriveReport = {
            ...report,
            icon: getIconComponent(report.icon_name) || <BsFiletypeXlsx />,
            type: 'onedrive'
          };
          oneDriveReports.push(transformedOneDriveReport);
        }
      });
      
      // Reports are now loaded from database with proper app/onedrive distinction
      
      // Sort app reports by sort_order, then priority
      appReports.sort((a, b) => {
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order;
        }
        return (b.priority || 0) - (a.priority || 0);
      });
      
      setReports(appReports);
      setOneDriveReports(oneDriveReports);
    } catch (error) {
      console.error('Error loading reports:', error);
      // Fallback to sample data if API fails
      setOneDriveReports(sampleOneDriveReports);
      setReports([]); // Clear app reports on error
    } finally {
      setLoading(false);
    }
  };

  const loadAdminData = async () => {
    if (!isAdmin) return;
    
    try {
      const [categoriesRes, reportsRes] = await Promise.all([
        api.get('/production-reports/categories/all'),
        api.get(`/production-reports/reports?include_hidden=true`)
      ]);

      setCategories(categoriesRes.data.data || []);
      
      // Process all reports (includes hidden ones for admin)
      const allApiReports = reportsRes.data.data || [];
      
      // Separate in-app reports from OneDrive reports
      const appReports = [];
      const oneDriveReports = [];
      
      allApiReports.forEach(report => {
        if (report.report_type === 'app') {
          // Transform database app report to frontend format
          const transformedReport = {
            id: report.id,
            title: report.report_name,
            description: report.report_description,
            category: getCategoryFromReport(report),
            type: 'app',
            icon: getIconComponent(report.icon_name),
            lastUpdated: new Date(report.updated_at),
            isInternal: true,
            isModular: true,
            componentName: report.component_name,
            frequency: report.frequency,
            tags: report.tags ? (typeof report.tags === 'string' ? JSON.parse(report.tags) : report.tags) : [],
            metadata: report.metadata ? (typeof report.metadata === 'string' ? JSON.parse(report.metadata) : report.metadata) : {},
            is_hidden: report.is_hidden,
            is_active: report.is_active,
            priority: report.priority,
            sort_order: report.sort_order
          };
          
          // Handle legacy reports with routes
          if (transformedReport.metadata.route) {
            transformedReport.route = transformedReport.metadata.route;
            transformedReport.isModular = false; // legacy report
          }
          
          appReports.push(transformedReport);
        } else {
          // OneDrive report - transform to include icon component
          const transformedOneDriveReport = {
            ...report,
            icon: getIconComponent(report.icon_name) || <BsFiletypeXlsx />,
            type: 'onedrive'
          };
          oneDriveReports.push(transformedOneDriveReport);
        }
      });
      
      // Sort app reports by sort_order, then priority
      appReports.sort((a, b) => {
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order;
        }
        return (b.priority || 0) - (a.priority || 0);
      });
      
      setReports(appReports);
      setOneDriveReports(oneDriveReports);
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
  };

  const refreshOneDriveReports = async () => {
    setRefreshing(true);
    try {
      // In real implementation, this would call OneDrive API to refresh the report list
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate finding new reports
      console.log('OneDrive reports refreshed');
      
      // Reload admin data if in admin mode
      if (isAdmin) {
        await loadAdminData();
      }
    } catch (error) {
      console.error('Error refreshing OneDrive reports:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // ==================== ADMIN FUNCTIONS ====================

  const openAdminModal = (type, item = null) => {
    setAdminModalType(type);
    setEditingItem(item);
    setShowAdminModal(true);
    
    if (type === 'category') {
      setFormData(item ? {
        name: item.name,
        description: item.description,
        icon: item.icon,
        color: item.color,
        sort_order: item.sort_order,
        is_active: item.is_active
      } : {
        name: '',
        description: '',
        icon: 'FiFolder',
        color: '#6b7280',
        sort_order: 0,
        is_active: true
      });
    } else if (type === 'report') {
      setFormData(item ? {
        subject: item.subject,
        report_name: item.report_name || item.title,
        report_description: item.report_description || item.description,
        category_id: item.category_id,
        frequency: item.frequency || 'ad-hoc',
        report_type: item.report_type || (item.type === 'app' ? 'app' : 'onedrive'),
        component_name: item.component_name || item.componentName || '',
        icon_name: item.icon_name || '',
        onedrive_url: item.onedrive_url,
        file_name: item.file_name,
        file_size: item.file_size,
        file_type: item.file_type,
        upload_date: item.upload_date ? item.upload_date.split('T')[0] : '',
        is_hidden: item.is_hidden,
        is_active: item.is_active !== undefined ? item.is_active : true,
        priority: item.priority || 0,
        sort_order: item.sort_order || 0,
        tags: item.tags ? (Array.isArray(item.tags) ? item.tags : JSON.parse(item.tags)) : []
      } : {
        subject: '',
        report_name: '',
        report_description: '',
        category_id: '',
        frequency: 'ad-hoc',
        report_type: 'onedrive',
        component_name: '',
        icon_name: 'FiFileText',
        onedrive_url: '',
        file_name: '',
        file_size: '',
        file_type: 'xlsx',
        upload_date: new Date().toISOString().split('T')[0],
        is_hidden: false,
        is_active: true,
        priority: 0,
        sort_order: 0,
        tags: []
      });
    }
    setFormErrors({});
  };

  const closeAdminModal = () => {
    setShowAdminModal(false);
    setAdminModalType('');
    setEditingItem(null);
    setFormData({});
    setFormErrors({});
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (adminModalType === 'category') {
      if (!formData.name?.trim()) errors.name = 'Category name is required';
    } else if (adminModalType === 'report') {
      if (!formData.report_name?.trim()) errors.report_name = 'Report name is required';
      
      if (formData.report_type === 'onedrive') {
        // Validate OneDrive reports
        if (!formData.onedrive_url?.trim()) {
          errors.onedrive_url = 'OneDrive URL is required for OneDrive reports';
        } else {
          // Validate OneDrive URL format
          const validDomains = ['1drv.ms', 'onedrive.live.com', 'sharepoint.com', 'office.com'];
          const isValidUrl = validDomains.some(domain => formData.onedrive_url.includes(domain));
          if (!isValidUrl) {
            errors.onedrive_url = 'Please enter a valid OneDrive, SharePoint, or Office.com URL';
          }
        }
      } else if (formData.report_type === 'app') {
        // Validate in-app reports
        if (!formData.component_name?.trim()) {
          errors.component_name = 'Component name is required for in-app reports';
        }
        if (!formData.icon_name?.trim()) {
          errors.icon_name = 'Icon name is required for in-app reports';
        }
      }
      
      if (!formData.category_id) {
        errors.category_id = 'Please select a category';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAdminSubmit = async () => {
    if (!validateForm()) return;

    try {
      if (adminModalType === 'category') {
        if (editingItem) {
          await api.put(`/production-reports/categories/${editingItem.id}`, formData);
        } else {
          await api.post('/production-reports/categories', formData);
        }
      } else if (adminModalType === 'report') {
        if (editingItem) {
          await api.put(`/production-reports/reports/${editingItem.id}`, formData);
        } else {
          await api.post('/production-reports/reports', formData);
        }
      }
      
      closeAdminModal();
      loadAdminData();
    } catch (error) {
      console.error('Error saving:', error);
      setFormErrors({ general: 'Failed to save. Please try again.' });
    }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm(`Are you sure you want to delete this ${type}?`)) return;

    try {
      if (type === 'category') {
        await api.delete(`/production-reports/categories/${id}`);
      } else {
        await api.delete(`/production-reports/reports/${id}`);
      }
      loadAdminData();
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Failed to delete. Please try again.');
    }
  };

  const toggleReportVisibility = async (report) => {
    try {
      await api.put(`/production-reports/reports/${report.id}`, {
        ...report,
        is_hidden: !report.is_hidden
      });
      loadAdminData();
    } catch (error) {
      console.error('Error toggling visibility:', error);
    }
  };

  // Filter reports based on category and search
  const filteredReports = () => {
    let allReports = [...reports];
    
    // Add OneDrive reports to the mix
    if (activeCategory === 'all' || activeCategory === 'onedrive') {
      allReports = [...allReports, ...oneDriveReports];
    } else {
      // Filter OneDrive reports by category using frequency
      const filteredOneDriveReports = oneDriveReports.filter(report => {
        // Use getCategoryFromReport to ensure consistent category determination
        const reportCategory = getCategoryFromReport(report);
        const matches = activeCategory === 'all' || reportCategory === activeCategory;
        return matches;
      });
      allReports = [...allReports, ...filteredOneDriveReports];
    }

    // Filter by category - ensure we're using the correct category property
    if (activeCategory !== 'all') {
      allReports = allReports.filter(report => {
        // Check both the category property and getCategoryFromReport for consistency
        const reportCategory = report.category || getCategoryFromReport(report);
        return reportCategory === activeCategory;
      });
    }

    // Admin mode filtering
    if (isAdminMode) {
      // Filter by admin category filter
      if (filterCategory !== 'all') {
        allReports = allReports.filter(report => {
          // Check both category_id and category for consistency
          const reportCategory = report.category || getCategoryFromReport(report);
          const matches = report.category_id == filterCategory || reportCategory === filterCategory;
          return matches;
        });
      }
      
      // Filter by frequency
      if (filterFrequency) {
        allReports = allReports.filter(report => {
          const reportFrequency = report.frequency?.toLowerCase();
          let matches;
          // Handle ad-hoc to daily mapping
          if (filterFrequency === 'daily') {
            matches = reportFrequency === 'daily' || reportFrequency === 'ad-hoc';
          } else {
            matches = reportFrequency === filterFrequency;
          }
          return matches;
        });
      }
      
      // Filter by visibility (show hidden toggle)
      if (!showHidden) {
        allReports = allReports.filter(report => !report.is_hidden);
      }
    } else {
      // Normal mode - hide hidden reports
      allReports = allReports.filter(report => !report.is_hidden);
    }

    // Filter by search term
    if (searchTerm) {
      allReports = allReports.filter(report => {
        const title = (report.title || report.report_name || '').toLowerCase();
        const description = (report.description || report.report_description || '').toLowerCase();
        const searchLower = searchTerm.toLowerCase();
        const matches = title.includes(searchLower) || description.includes(searchLower);
        return matches;
      });
    }

    return allReports;
  };

  const handleReportClick = (report) => {
    console.log('🚀 handleReportClick called with:', report);
    console.log('🚀 Report details - type:', report.type, 'isModular:', report.isModular, 'componentName:', report.componentName);
    console.log('🚀 Report title:', report.title);
    console.log('🚀 Report ID:', report.id);
    console.log('🚀 Full report object:', JSON.stringify(report, null, 2));
    
    // Create URL identifier (prefer slug for readability, fallback to ID)
    const reportTitle = report.title || report.report_name;
    const urlIdentifier = createUrlSlug(reportTitle) || report.id;
    
    // Update URL with report parameter
    updateUrlParams(urlIdentifier);
    
    // Set up breadcrumb navigation
    const breadcrumb = [
      { label: 'Production', path: 'production' },
      { label: 'Reports', path: 'reports' },
      { label: reportTitle, path: null }
    ];
    
    console.log('🚀 Setting breadcrumb:', breadcrumb);
    console.log('🚀 Setting viewingReport to:', reportTitle);
    console.log('🚀 Updated URL with identifier:', urlIdentifier);
    
    setReportBreadcrumb(breadcrumb);
    setViewingReport(report);
  };

  const handleBackToReports = () => {
    // Remove report parameter from URL
    updateUrlParams(null);
    
    setViewingReport(null);
    setReportBreadcrumb([]);
  };

  const ReportCard = ({ report }) => (
    <div className={`report-card ${isAdminMode && report.is_hidden ? 'hidden-report' : ''}`} 
         onClick={() => !isAdminMode && handleReportClick(report)}>
      <div className="report-card-header">
        <div className="report-header-main">
          <div className="report-icon">
            {report.icon}
          </div>
          <h3 className="report-card-title">{report.title || report.report_name}</h3>
        </div>
        <div className="report-meta">
          {report.type === 'onedrive' && (
            <div className="report-source-badge onedrive">
              <BsCloudCheck size={12} />
              OneDrive
            </div>
          )}
          {(report.isFromHomeOffice || report.is_from_home_office) && (
            <div className="report-source-badge home-office">
              Home Office
            </div>
          )}
          {report.frequency && report.frequency !== 'ad-hoc' && (
            <div className="report-source-badge frequency">
              {report.frequency.charAt(0).toUpperCase() + report.frequency.slice(1)}
            </div>
          )}
          {isAdminMode && report.is_hidden && (
            <div className="report-source-badge hidden">
              Hidden
            </div>
          )}
        </div>
      </div>
      
      <div className="report-content">
        <p className="report-description">{report.description || report.report_description}</p>
        
      </div>
        {(report.type === 'onedrive' || report.file_name) && (
          <div className="report-file-info">
            <div className="file-name">{report.fileName || report.file_name}</div>
            <div className="file-details">
              <span className="file-size">{report.fileSize || report.file_size}</span>
              <span className="file-date">
                <FiClock size={12} />
                {report.uploadDate ? report.uploadDate.toLocaleDateString() : 
                 report.upload_date ? new Date(report.upload_date).toLocaleDateString() : 
                 'No date'}
              </span>
            </div>
          </div>
        )}
      
      <div className="report-actions">
        {isAdminMode ? (
          // Admin mode actions
          <>
            <button
              className="action-btn"
              onClick={(e) => {
                e.stopPropagation();
                toggleReportVisibility(report);
              }}
              title={report.is_hidden ? 'Show Report' : 'Hide Report'}
            >
              {report.is_hidden ? <FiEye size={16} /> : <FiEyeOff size={16} />}
            </button>
            <button
              className="action-btn"
              onClick={(e) => {
                e.stopPropagation();
                openAdminModal('report', report);
              }}
              title="Edit Report"
            >
              <FiEdit2 size={16} />
            </button>
            <button
              className="action-btn delete"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete('report', report.id);
              }}
              title="Delete Report"
            >
              <FiTrash2 size={16} />
            </button>
          </>
        ) : (
          // Normal mode actions
          <>
            {report.type === 'app' ? (
              <button className="report-action-btn primary">
                <FiEye size={14} />
                View Report
              </button>
            ) : (
              <button className="report-action-btn primary">
                <FiDownload size={14} />
                Download
              </button>
            )}
            
            {report.versions && report.versions.length > 1 && (
              <button 
                className="report-action-btn secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedReport(report);
                  setVersionModalOpen(true);
                }}
              >
                <FiClock size={14} />
                History ({report.versions.length})
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );

  const ReportListItem = ({ report }) => (
    <div className="report-list-item" onClick={() => handleReportClick(report)}>
      <div className="report-list-icon">
        {report.icon || getIconComponent(report.icon_name) || <FiFileText />}
      </div>
      
      <div className="report-list-content">
        <div className="report-list-header">
          <h3 className="report-list-title">{report.title || report.report_name}</h3>
          <div className="report-list-meta">
            {report.type === 'onedrive' && (
              <span className="report-source-badge onedrive">
                <BsCloudCheck size={12} />
                OneDrive
              </span>
            )}
            {report.isFromHomeOffice && (
              <span className="report-source-badge home-office">Home Office</span>
            )}
          </div>
        </div>
        
        <p className="report-list-description">{report.description || report.report_description}</p>
        
        {report.type === 'onedrive' && (
          <div className="report-file-info-inline">
            <span className="file-name">{report.fileName}</span>
            <span className="file-size">{report.fileSize}</span>
            <span className="file-date">
              <FiClock size={12} />
              {report.uploadDate ? report.uploadDate.toLocaleDateString() : 'No date available'}
            </span>
          </div>
        )}
      </div>
      
      <div className="report-list-actions">
        {report.type === 'app' ? (
          <button className="report-action-btn primary">
            <FiEye size={14} />
            View
          </button>
        ) : (
          <button className="report-action-btn primary">
            <FiDownload size={14} />
            Download
          </button>
        )}
        
        {report.versions && report.versions.length > 1 && (
          <button 
            className="report-action-btn secondary"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedReport(report);
              setVersionModalOpen(true);
            }}
          >
            History ({report.versions.length})
          </button>
        )}
      </div>
    </div>
  );

  // Breadcrumb component
  const Breadcrumb = ({ items }) => (
    <div className="report-breadcrumb">
      {items.map((item, index) => (
        <span key={index} className="breadcrumb-item">
          {item.path ? (
            <button 
              className="breadcrumb-link"
              onClick={() => {
                if (item.path === 'reports') {
                  handleBackToReports();
                }
              }}
            >
              {item.label}
            </button>
          ) : (
            <span className="breadcrumb-current">{item.label}</span>
          )}
          {index < items.length - 1 && <span className="breadcrumb-separator">{'>'}</span>}
        </span>
      ))}
    </div>
  );

  // Report Viewer Component
  const ReportViewer = ({ report }) => {
    console.log('ReportViewer called with report:', report);
    console.log('Report type:', report?.type, 'isModular:', report?.isModular, 'componentName:', report?.componentName);
    
    // State for managing which version is currently displayed
    const [currentVersion, setCurrentVersion] = useState(null);

    // Initialize with the main report on first load
    useEffect(() => {
      if (report && !currentVersion) {
        setCurrentVersion({
          onedrive_url: report.onedrive_url,
          file_name: report.file_name || report.fileName,
          file_size: report.file_size || report.fileSize,
          upload_date: report.upload_date,
          version_name: 'Current Version',
          is_current: true
        });
      }
    }, [report, currentVersion]);

    // Helper function to convert OneDrive link to embedded view
    const getOneDriveEmbedUrl = (oneDriveUrl) => {
      if (!oneDriveUrl) return null;
      
      try {
        // Handle various OneDrive URL formats
        if (oneDriveUrl.includes('1drv.ms') || oneDriveUrl.includes('onedrive.live.com')) {
          // For personal OneDrive share links
          if (oneDriveUrl.includes('?')) {
            return `${oneDriveUrl}&action=embedview`;
          }
          return `${oneDriveUrl}?action=embedview`;
        } else if (oneDriveUrl.includes('sharepoint.com')) {
          // For SharePoint/Business OneDrive links
          if (oneDriveUrl.includes('?')) {
            return `${oneDriveUrl}&action=embedview`;
          }
          return `${oneDriveUrl}?action=embedview`;
        } else if (oneDriveUrl.includes('office.com')) {
          // For Office.com links
          if (oneDriveUrl.includes('?')) {
            return `${oneDriveUrl}&action=embedview`;
          }
          return `${oneDriveUrl}?action=embedview`;
        }
        
        // Fallback: try to add embed parameter
        const separator = oneDriveUrl.includes('?') ? '&' : '?';
        return `${oneDriveUrl}${separator}action=embedview`;
      } catch (error) {
        console.error('Error creating embed URL:', error);
        return null;
      }
    };

    // Helper function to validate OneDrive URL
    const isValidOneDriveUrl = (url) => {
      if (!url) return false;
      const validDomains = [
        '1drv.ms',
        'onedrive.live.com',
        'sharepoint.com',
        'office.com'
      ];
      return validDomains.some(domain => url.includes(domain));
    };

    // Helper function to convert OneDrive URL to direct download
    const getDirectDownloadUrl = (oneDriveUrl) => {
      if (!oneDriveUrl) return null;
      
      try {
        // Handle various OneDrive URL formats for direct download
        if (oneDriveUrl.includes('1drv.ms') || oneDriveUrl.includes('onedrive.live.com')) {
          // For personal OneDrive share links
          if (oneDriveUrl.includes('?')) {
            return oneDriveUrl.replace('?', '?download=1&');
          }
          return `${oneDriveUrl}?download=1`;
        } else if (oneDriveUrl.includes('sharepoint.com')) {
          // For SharePoint/Business OneDrive links
          if (oneDriveUrl.includes('?')) {
            return oneDriveUrl.replace('?', '?download=1&');
          }
          return `${oneDriveUrl}?download=1`;
        } else if (oneDriveUrl.includes('office.com')) {
          // For Office.com links
          if (oneDriveUrl.includes('?')) {
            return oneDriveUrl.replace('?', '?download=1&');
          }
          return `${oneDriveUrl}?download=1`;
        }
        
        // Fallback: try to add download parameter
        const separator = oneDriveUrl.includes('?') ? '&' : '?';
        return `${oneDriveUrl}${separator}download=1`;
      } catch (error) {
        console.error('Error creating download URL:', error);
        return oneDriveUrl; // Fallback to original URL
      }
    };

    const handleDownloadReport = (url, isDirectDownload = true) => {
      // Log access for tracking
      if (report.id) {
        api.post(`/production-reports/reports/${report.id}/access-log`, {
          access_type: 'download'
        }).catch(err => console.error('Failed to log access:', err));
      }
      
      if (isDirectDownload) {
        // Try to trigger direct download
        const downloadUrl = getDirectDownloadUrl(url);
        if (downloadUrl) {
          // Create a temporary link element to trigger download
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          // Fallback to opening in new tab
          window.open(url, '_blank');
        }
      } else {
        window.open(url, '_blank');
      }
    };

    // Handle switching to a different version in the viewer
    const handleVersionSwitch = (version) => {
      setCurrentVersion(version);
    };

    const handleViewReport = (url) => {
      // Log access for tracking
      if (report.id) {
        api.post(`/production-reports/reports/${report.id}/access-log`, {
          access_type: 'view'
        }).catch(err => console.error('Failed to log access:', err));
      }
    };

    // Helper function to render modular report components
    const renderModularReport = (report) => {
      console.log('🔥 renderModularReport called with:', report);
      console.log('🔥 Component name:', report.componentName);
      console.log('🔥 Report type:', report.type);
      console.log('🔥 Is modular:', report.isModular);
      
      const componentMap = {
        'RefReport': RefReport,
        'MoreReport': MoreReport
        // Add more components here as they are created
        // 'SalesReport': SalesReport,
        // 'ProductionReport': ProductionReport
      };

      console.log('🔥 Available components:', Object.keys(componentMap));
      const ReportComponent = componentMap[report.componentName];
      console.log('🔥 Looking for component:', report.componentName, 'Found:', !!ReportComponent);
      console.log('🔥 RefReport import check:', RefReport);
      
      if (ReportComponent) {
        console.log('🔥 Rendering component:', report.componentName);
        return (
          <ReportComponent 
            onBack={handleBackToReports}
          />
        );
      }

      // Fallback if component not found
      console.log('🔥 Component not found, showing fallback');
      return (
        <div className="embedded-report">
          <div className="report-placeholder">
            <h4>{report.title}</h4>
            <p>Report component '{report.componentName}' not found.</p>
            <p>Please check the component mapping in ProductionReports.js</p>
            <p>Available components: {Object.keys(componentMap).join(', ')}</p>
            <p>RefReport import: {RefReport ? 'SUCCESS' : 'FAILED'}</p>
          </div>
        </div>
      );
    };

    if (report.type === 'app') {
      console.log('📱 Rendering app report:', report);
      console.log('📱 Report type is app, checking if modular...');
      console.log('📱 report.isModular:', report.isModular);
      // Handle modular reports
      if (report.isModular) {
        console.log('📱 Report is modular, calling renderModularReport');
        return renderModularReport(report);
      } else {
        console.log('📱 Report is NOT modular, using legacy rendering');
      }

      // For legacy app-hosted reports
      return (
        <div className="report-viewer app-report">
          <div className="report-viewer-header">
            <h3>{report.title}</h3>
            <p>{report.description}</p>
          </div>
          
          <div className="report-content-area">
            {/* This is where you'd embed the actual report component */}
            {report.id === 'daily-activity-report' && (
              <div className="embedded-report">
                {/* You could import and render DailyActivityForm here */}
                <div className="report-placeholder">
                  <h4>Daily Activity Report</h4>
                  <p>This would show the actual Daily Activity Report interface.</p>
                  <button 
                    className="open-full-report"
                    onClick={() => window.location.href = report.route}
                  >
                    Open Full Report
                  </button>
                </div>
              </div>
            )}
            
            {report.id === 'weekly-performance' && (
              <div className="embedded-report">
                <div className="report-placeholder">
                  <h4>Weekly Performance Dashboard</h4>
                  <p>This would show the weekly performance metrics and charts.</p>
                  <div className="report-stats-grid">
                    <div className="stat-card">
                      <h5>This Week</h5>
                      <p>Sample metrics would appear here</p>
                    </div>
                    <div className="stat-card">
                      <h5>Performance</h5>
                      <p>Charts and graphs would be displayed</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    } else if (report.type === 'onedrive' || report.onedrive_url) {
      // For OneDrive reports, show embedded Excel viewer when possible
      const displayVersion = currentVersion || {
        onedrive_url: report.onedrive_url || report.downloadUrl,
        file_name: report.file_name || report.fileName,
        file_size: report.file_size || report.fileSize,
        upload_date: report.upload_date,
        version_name: 'Current Version'
      };
      
      const embedUrl = getOneDriveEmbedUrl(displayVersion.onedrive_url);
      const reportUrl = displayVersion.onedrive_url;
      
      return (
        <div className="report-viewer onedrive-report">
          <div className="report-viewer-header">
            <h3>{report.title || report.report_name}</h3>
            <p>{report.description || report.report_description}</p>
          </div>
          
          <div className="onedrive-report-content">
            <div className="file-info-section">
              <div className="file-details-large">
                <div className="file-icon-large">
                  <BsFiletypeXlsx size={48} />
                </div>
                <div className="file-info">
                  <h4>{displayVersion.file_name}</h4>
                  <div className="file-meta">
                    <span>Size: {displayVersion.file_size}</span>
                    <span>Modified: {displayVersion.upload_date ? 
                                              (displayVersion.upload_date instanceof Date ? 
                                               displayVersion.upload_date.toLocaleDateString() : 
                                               new Date(displayVersion.upload_date).toLocaleDateString()) : 
                                              'Unknown'}</span>
                    {(report.isFromHomeOffice || report.is_from_home_office) && (
                      <span className="home-office-tag">From Home Office</span>
                    )}
                    {displayVersion.version_name && displayVersion.version_name !== 'Current Version' && (
                      <span className="version-tag">Version: {displayVersion.version_name}</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="file-actions-large">
                <button 
                  className="primary-action-btn"
                  onClick={() => handleDownloadReport(reportUrl)}
                >
                  <FiDownload size={16} />
                  Download Latest
                </button>
                <button 
                  className="secondary-action-btn"
                  onClick={() => {
                    setSelectedReport(report);
                    setVersionModalOpen(true);
                  }}
                >
                  <FiClock size={16} />
                  View All Versions
                </button>
                {embedUrl && (
                  <button 
                    className="secondary-action-btn"
                    onClick={() => window.open(reportUrl, '_blank')}
                  >
                    <FiExternalLink size={16} />
                    Open in OneDrive
                  </button>
                )}
              </div>
            </div>
            
            {/* Excel Embedded Viewer */}
            {embedUrl ? (
              <div className="excel-preview-section">
                <h4>File Preview</h4>
                <div className="excel-iframe-container">
                  <iframe
                    src={embedUrl}
                    className="excel-iframe"
                    title={`Preview of ${displayVersion.file_name}`}
                    key={displayVersion.onedrive_url} // Force re-render when version changes
                    onLoad={() => handleViewReport(reportUrl)}
                    onError={(e) => {
                      console.error('Failed to load Excel preview:', e);
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'block';
                    }}
                  />
                  <div className="excel-preview-fallback" style={{ display: 'none' }}>
                    <div className="excel-preview-placeholder">
                      <BsFiletypeXlsx size={64} />
                      <h4>Preview Not Available</h4>
                      <p>This file cannot be previewed inline. You can download it or open it in OneDrive.</p>
                      <div className="preview-actions">
                        <button 
                          className="preview-action"
                          onClick={() => handleDownloadReport(reportUrl)}
                        >
                          <FiDownload size={16} />
                          Download File
                        </button>
                        <button 
                          className="preview-action secondary"
                          onClick={() => window.open(reportUrl, '_blank')}
                        >
                          <FiExternalLink size={16} />
                          Open in OneDrive
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="excel-preview-section">
                <h4>File Preview</h4>
                <div className="excel-preview-placeholder">
                  <BsFiletypeXlsx size={64} />
                  <h4>Excel File</h4>
                  <p>Preview not available for this file format or link type.</p>
                  <div className="preview-actions">
                    <button 
                      className="preview-action"
                      onClick={() => handleDownloadReport(reportUrl)}
                    >
                      <FiDownload size={16} />
                      Download File
                    </button>
                    <button 
                      className="preview-action secondary"
                      onClick={() => window.open(reportUrl, '_blank')}
                    >
                      <FiExternalLink size={16} />
                      Open in Browser
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Version History Quick View */}
            {report.versions && report.versions.length > 1 && (
              <div className="recent-versions-section">
                <h4>Recent Versions ({report.versions.length} total)</h4>
                <div className="recent-versions-list">
                  {report.versions.slice(0, 3).map((version, index) => {
                    const isCurrentlyViewing = currentVersion && 
                      currentVersion.onedrive_url === (version.onedrive_url || version.downloadUrl);
                    
                    return (
                      <div 
                        key={index} 
                        className={`version-item-inline ${isCurrentlyViewing ? 'active' : ''}`}
                        onClick={() => handleVersionSwitch({
                          onedrive_url: version.onedrive_url || version.downloadUrl,
                          file_name: version.fileName || version.file_name,
                          file_size: version.fileSize || version.file_size,
                          upload_date: version.date || version.upload_date,
                          version_name: version.version_name || `Version ${index + 1}`,
                          is_current: index === 0
                        })}
                        style={{ cursor: 'pointer' }}
                        title="Click to view this version in the preview"
                      >
                        <div className="version-info-inline">
                          <span className="version-name">{version.fileName || version.file_name}</span>
                          <span className="version-date">
                            {version.date ? version.date.toLocaleDateString() : 
                             version.upload_date ? new Date(version.upload_date).toLocaleDateString() : 
                             'Unknown date'}
                          </span>
                          {index === 0 && <span className="current-version-badge">Latest</span>}
                          {isCurrentlyViewing && <span className="viewing-badge">Viewing</span>}
                        </div>
                        <button 
                          className="version-download-btn"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering the version switch
                            handleDownloadReport(version.onedrive_url || version.downloadUrl, true);
                          }}
                          title="Download this version directly"
                        >
                          <FiDownload size={14} />
                        </button>
                      </div>
                    );
                  })}
                  {report.versions.length > 3 && (
                    <button 
                      className="show-all-versions-btn"
                      onClick={() => {
                        setSelectedReport(report);
                        setVersionModalOpen(true);
                      }}
                    >
                      View all {report.versions.length} versions
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
    
    return null;
  };

  if (loading) {
    return (
      <div className="reports-loading">
        <FiRefreshCw className="loading-spinner" />
        <p>Loading reports...</p>
      </div>
    );
  }

  return (
    <div className="production-reports">
      {/* Show breadcrumb when viewing a report */}
      {viewingReport && reportBreadcrumb.length > 0 && (
        <Breadcrumb items={reportBreadcrumb} />
      )}
      
      {/* Show report viewer or reports list */}
      {viewingReport ? (
        <ReportViewer report={viewingReport} />
      ) : (
        <>
                <div className="reports-header">
        <div className="reports-title-section">
          <h2>Reports</h2>
          <p>Access all your reports in one place</p>
        </div>
    
    <div className="reports-actions">
          {isAdmin && (
            <button 
              className={`admin-toggle-btn ${isAdminMode ? 'active' : ''}`}
              onClick={() => setIsAdminMode(!isAdminMode)}
            >
              <FiSettings />
              {isAdminMode ? 'Exit Admin' : 'Admin Mode'}
            </button>
          )}
          <button 
            className="refresh-btn"
            onClick={refreshOneDriveReports}
            disabled={refreshing}
          >
            <FiRefreshCw className={refreshing ? 'spinning' : ''} />
            {refreshing ? 'Syncing...' : 'Sync OneDrive'}
          </button>
        </div>
      </div>

      <div className="reports-controls">
        <div className="reports-search">
          <div className="search-input-wrapper">
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        <div className="reports-filters">
          <div className="category-filters">
            {reportCategories.map(category => (
              <button
                key={category.id}
                className={`category-filter ${activeCategory === category.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(category.id)}
              >
                {category.icon}
                {category.label}
              </button>
            ))}
          </div>
        </div>

        <div className="view-controls">
          <button
            className={`view-toggle ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
          >
            <FiGrid />
          </button>
          <button
            className={`view-toggle ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            <FiList />
          </button>
        </div>
      </div>

      {/* Admin Controls */}
      {isAdmin && isAdminMode && (
        <div className="admin-controls">
          <div className="admin-controls-left">
            <div className="admin-filters">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>

              <select
                value={filterFrequency || 'all'}
                onChange={(e) => setFilterFrequency(e.target.value === 'all' ? '' : e.target.value)}
                className="filter-select"
              >
                <option value="all">All Frequencies</option>
                {frequencyOptions.map(freq => (
                  <option key={freq.value} value={freq.value}>{freq.label}</option>
                ))}
              </select>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showHidden}
                  onChange={(e) => setShowHidden(e.target.checked)}
                />
                Show Hidden
              </label>
            </div>
          </div>

          <div className="admin-actions">
            <button 
              className="btn-primary"
              onClick={() => openAdminModal('category')}
            >
              <FiPlus size={16} />
              Add Category
            </button>
            <button 
              className="btn-primary"
              onClick={() => openAdminModal('report')}
            >
              <FiPlus size={16} />
              Add Report
            </button>
          </div>
        </div>
      )}

      <div className="reports-content">
        {filteredReports().length === 0 ? (
          <div className="reports-empty">
            <FiFileText size={48} />
            <h3>No reports found</h3>
            <p>Try adjusting your search or category filter</p>
          </div>
        ) : (
          <div className={`reports-${viewMode}`}>
            {filteredReports().map(report => (
              viewMode === 'grid' ? (
                <ReportCard key={report.id} report={report} />
              ) : (
                <ReportListItem key={report.id} report={report} />
              )
            ))}
          </div>
        )}
          </div>
        </>
      )}

      {/* Version History Modal */}
      <ReportVersionModal
        report={selectedReport}
        isOpen={versionModalOpen}
        onClose={() => {
          setVersionModalOpen(false);
          setSelectedReport(null);
        }}
      />

      {/* Admin Modal */}
      {isAdmin && showAdminModal && (
        <div className="modal-backdrop" onClick={closeAdminModal}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>
                {editingItem ? 'Edit' : 'Create'} {adminModalType === 'category' ? 'Category' : 'Report'}
              </h3>
              <button className="modal-close-btn" onClick={closeAdminModal}>
                <FiX size={20} />
              </button>
            </div>

            <div className="admin-modal-content">
              {adminModalType === 'category' ? (
                <div className="form-grid">
                  <div className="form-field">
                    <label>Category Name *</label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={e => handleFormChange('name', e.target.value)}
                      className={formErrors.name ? 'error' : ''}
                      placeholder="Enter category name"
                    />
                    {formErrors.name && <span className="field-error">{formErrors.name}</span>}
                  </div>

                  <div className="form-field">
                    <label>Description</label>
                    <textarea
                      value={formData.description || ''}
                      onChange={e => handleFormChange('description', e.target.value)}
                      placeholder="Category description"
                      rows={3}
                    />
                  </div>

                  <div className="form-field">
                    <label>Icon</label>
                    <select
                      value={formData.icon || 'FiFolder'}
                      onChange={e => handleFormChange('icon', e.target.value)}
                    >
                      <option value="FiFolder">Folder</option>
                      <option value="FiCalendar">Calendar</option>
                      <option value="FiBarChart2">Bar Chart</option>
                      <option value="FiTrendingUp">Trending Up</option>
                      <option value="FiFileText">File Text</option>
                      <option value="BsCloudCheck">Cloud</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Color</label>
                    <input
                      type="color"
                      value={formData.color || '#6b7280'}
                      onChange={e => handleFormChange('color', e.target.value)}
                    />
                  </div>

                  <div className="form-field">
                    <label>Sort Order</label>
                    <input
                      type="number"
                      value={formData.sort_order || 0}
                      onChange={e => handleFormChange('sort_order', parseInt(e.target.value))}
                      min="0"
                    />
                  </div>

                  <div className="form-field">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.is_active || false}
                        onChange={e => handleFormChange('is_active', e.target.checked)}
                      />
                      Active
                    </label>
                  </div>
                </div>
              ) : (
                <div className="form-grid">
                  <div className="form-field span-2">
                    <label>Report Name *</label>
                    <input
                      type="text"
                      value={formData.report_name || ''}
                      onChange={e => handleFormChange('report_name', e.target.value)}
                      className={formErrors.report_name ? 'error' : ''}
                      placeholder="Enter report name"
                    />
                    {formErrors.report_name && <span className="field-error">{formErrors.report_name}</span>}
                  </div>

                  <div className="form-field span-2">
                    <label>Description</label>
                    <textarea
                      value={formData.report_description || ''}
                      onChange={e => handleFormChange('report_description', e.target.value)}
                      placeholder="Report description"
                      rows={3}
                    />
                  </div>

                  <div className="form-field">
                    <label>Report Type *</label>
                    <select
                      value={formData.report_type || 'onedrive'}
                      onChange={e => handleFormChange('report_type', e.target.value)}
                    >
                      <option value="onedrive">OneDrive Report</option>
                      <option value="app">In-App Report</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Category *</label>
                    <select
                      value={formData.category_id || ''}
                      onChange={e => handleFormChange('category_id', e.target.value)}
                      className={formErrors.category_id ? 'error' : ''}
                    >
                      <option value="">Select category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                    {formErrors.category_id && <span className="field-error">{formErrors.category_id}</span>}
                  </div>

                  <div className="form-field">
                    <label>Frequency</label>
                    <select
                      value={formData.frequency || 'ad-hoc'}
                      onChange={e => handleFormChange('frequency', e.target.value)}
                    >
                      {frequencyOptions.map(freq => (
                        <option key={freq.value} value={freq.value}>{freq.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Priority</label>
                    <input
                      type="number"
                      value={formData.priority || 0}
                      onChange={e => handleFormChange('priority', parseInt(e.target.value))}
                      min="0"
                      max="10"
                    />
                  </div>

                  <div className="form-field">
                    <label>Sort Order</label>
                    <input
                      type="number"
                      value={formData.sort_order || 0}
                      onChange={e => handleFormChange('sort_order', parseInt(e.target.value))}
                      min="0"
                    />
                  </div>

                  {/* In-App Report Fields */}
                  {formData.report_type === 'app' && (
                    <>
                      <div className="form-field">
                        <label>Component Name *</label>
                        <input
                          type="text"
                          value={formData.component_name || ''}
                          onChange={e => handleFormChange('component_name', e.target.value)}
                          className={formErrors.component_name ? 'error' : ''}
                          placeholder="RefReport"
                        />
                        {formErrors.component_name && <span className="field-error">{formErrors.component_name}</span>}
                      </div>

                      <div className="form-field">
                        <label>Icon Name *</label>
                        <select
                          value={formData.icon_name || ''}
                          onChange={e => handleFormChange('icon_name', e.target.value)}
                          className={formErrors.icon_name ? 'error' : ''}
                        >
                          <option value="">Select icon</option>
                          <option value="FiActivity">Activity</option>
                          <option value="FiTrendingUp">Trending Up</option>
                          <option value="FiUsers">Users</option>
                          <option value="FiBarChart2">Bar Chart</option>
                          <option value="FiCalendar">Calendar</option>
                          <option value="FiFolder">Folder</option>
                          <option value="FiFileText">File Text</option>
                        </select>
                        {formErrors.icon_name && <span className="field-error">{formErrors.icon_name}</span>}
                      </div>
                    </>
                  )}

                  {/* OneDrive Report Fields */}
                  {formData.report_type === 'onedrive' && (
                    <>
                      <div className="form-field span-2">
                        <label>Email Subject</label>
                        <input
                          type="text"
                          value={formData.subject || ''}
                          onChange={e => handleFormChange('subject', e.target.value)}
                          placeholder="Email subject from home office"
                        />
                      </div>

                      <div className="form-field span-2">
                        <label>OneDrive URL *</label>
                        <input
                          type="url"
                          value={formData.onedrive_url || ''}
                          onChange={e => handleFormChange('onedrive_url', e.target.value)}
                          className={formErrors.onedrive_url ? 'error' : ''}
                          placeholder="https://..."
                        />
                        {formErrors.onedrive_url && <span className="field-error">{formErrors.onedrive_url}</span>}
                      </div>

                      <div className="form-field">
                        <label>File Name</label>
                        <input
                          type="text"
                          value={formData.file_name || ''}
                          onChange={e => handleFormChange('file_name', e.target.value)}
                          placeholder="report.xlsx"
                        />
                      </div>

                      <div className="form-field">
                        <label>File Size</label>
                        <input
                          type="text"
                          value={formData.file_size || ''}
                          onChange={e => handleFormChange('file_size', e.target.value)}
                          placeholder="245 KB"
                        />
                      </div>

                      <div className="form-field">
                        <label>Upload Date</label>
                        <input
                          type="date"
                          value={formData.upload_date || ''}
                          onChange={e => handleFormChange('upload_date', e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  <div className="form-field">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.is_hidden || false}
                        onChange={e => handleFormChange('is_hidden', e.target.checked)}
                      />
                      Hidden
                    </label>
                  </div>

                  <div className="form-field">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.is_active !== false}
                        onChange={e => handleFormChange('is_active', e.target.checked)}
                      />
                      Active
                    </label>
                  </div>
                </div>
              )}
              
              {formErrors.general && (
                <div className="form-error">{formErrors.general}</div>
              )}
            </div>

            <div className="admin-modal-actions">
              <button className="btn-secondary" onClick={closeAdminModal}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleAdminSubmit}>
                <FiSave size={16} />
                {editingItem ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionReports; 