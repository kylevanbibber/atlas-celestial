import React, { useState, useEffect } from 'react';
import { FiRefreshCw, FiClock, FiUsers, FiCalendar, FiSend, FiLink, FiAlertCircle, FiRepeat, FiRotateCw, FiEdit, FiTrash2, FiFilter, FiSearch, FiX, FiChevronUp, FiChevronDown, FiPlus } from 'react-icons/fi';
import { DateTime } from 'luxon';
import axios from 'axios';
import { toast } from 'react-toastify';
import './NotificationSchedule.css';
import api from '../../../api';
import FilterMenu from '../../common/FilterMenu';
import { NOTIFICATION_TYPES } from '../../common/NotificationCenter';

const NotificationSchedule = ({ 
  groups = [], 
  scheduledNotifications = [],
  onRefresh 
}) => {
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filteredNotifications, setFilteredNotifications] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // Store ID of notification to delete
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({
    start: null,
    end: null
  });
  const [activeFilters, setActiveFilters] = useState({
    // Status filters
    sent: null,
    not_sent: null,
    
    // Recurrence type filters
    recurring: null,
    one_time: null,
    
    // Time pattern filters
    daily: null,
    weekly: null,
    monthly: null,
    yearly: null,
    
    // Type filters
    info: null,
    success: null,
    warning: null,
    error: null,
    
    // Link filters
    has_link: null,
    no_link: null,
    
    // Date range filter
    date_range: {
      start: null,
      end: null
    }
  });
  const [sortConfig, setSortConfig] = useState({
    key: 'scheduled_for',
    direction: 'desc'
  });
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info',
    target_group: '',
    scheduled_for: '',
    link_url: '',
    is_recurring: false,
    recurrence_pattern: 'daily',
    recurrence_count: 1,
    recurrence_end_date: '',
    indefinite_recurrence: false,
    monthly_day: 1,
    weekly_day: 1, // Monday = 1, Sunday = 7
    selected_days: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: true
    },
    originalMetadata: {}
  });
  const [previewCount, setPreviewCount] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // Get days of the month options (1-31)
  const getDaysOfMonth = () => {
    const days = [];
    for (let i = 1; i <= 31; i++) {
      days.push(i);
    }
    return days;
  };
  
  // Get days of the week
  const getDaysOfWeek = () => {
    return [
      { value: 1, label: 'Monday' },
      { value: 2, label: 'Tuesday' },
      { value: 3, label: 'Wednesday' },
      { value: 4, label: 'Thursday' },
      { value: 5, label: 'Friday' },
      { value: 6, label: 'Saturday' },
      { value: 7, label: 'Sunday' }
    ];
  };
  
  // Initialize scheduled_for to tomorrow at current time
  useEffect(() => {
    const tomorrow = DateTime.now().plus({ days: 1 }).toISO().slice(0, 16);
    const nextMonth = DateTime.now().plus({ months: 1 }).toISO().slice(0, 16);
    
    // Set initial day of month to match the initial scheduled date
    const tomorrowDay = DateTime.now().plus({ days: 1 }).day;
    // Set initial day of week to match the initial scheduled date (1-7, where 1 is Monday)
    const tomorrowWeekday = DateTime.now().plus({ days: 1 }).weekday;
    
    setFormData(prev => ({ 
      ...prev, 
      scheduled_for: tomorrow,
      recurrence_end_date: nextMonth,
      monthly_day: tomorrowDay,
      weekly_day: tomorrowWeekday
    }));
  }, []);

  // Initialize active filters
  useEffect(() => {
    // Log groups data to understand its structure
    console.log("Notification Schedule - Loaded groups:", groups);
    
    // If we have groups, log the structure of the first one as an example
    if (groups && groups.length > 0) {
      console.log("Example group structure:", groups[0]);
      console.log("Group has queryData:", !!groups[0].queryData);
      console.log("Group has tables:", !!groups[0].tables);
    }
    
    // Create initial state with all groups enabled
    let initialGroupFilters = { 'all_users': null }; // Add all_users filter for users without a group
    
    // Add each group from props
    if (groups && groups.length > 0) {
      groups.forEach(group => {
        initialGroupFilters[`group_${group.id}`] = null;
      });
    }
    
    // Set only the filters we're actually using
    setActiveFilters({
      ...initialGroupFilters,
      // Status filters
      sent: null,
      not_sent: null,
      
      // Recurrence type filters
      recurring: null,
      one_time: null,
      
      // Time pattern filters
      daily: null,
      weekly: null,
      monthly: null,
      yearly: null,
      
      // Type filters
      info: null,
      success: null,
      warning: null,
      error: null,
      
      // Link filters
      has_link: null,
      no_link: null,
      
      // Date range filter
      date_range: {
        start: null,
        end: null
      }
    });
  }, [groups]);

  // Get status badge for notification
  const getStatusBadge = (notification) => {
    if (notification.is_sent) {
      return <span className="status-badge status-completed">Sent</span>;
    }
    
    if (isPastDue(notification.scheduled_for)) {
      return <span className="status-badge status-processing">Processing</span>;
    }
    
    if (notification.is_paused) {
      return <span className="status-badge status-paused">Paused</span>;
    }
    
    return <span className="status-badge status-scheduled">Scheduled</span>;
  };

  // Format relative time (e.g., "2 hours ago")
  const formatRelativeTime = (dateStr) => {
        try {
      if (!dateStr) return 'recently';
      
      // Try multiple date formats - explicitly set to UTC since server data is in UTC
      let date = DateTime.fromISO(dateStr, { zone: 'utc' }).toLocal();
      if (!date.isValid) date = DateTime.fromSQL(dateStr, { zone: 'utc' }).toLocal();
      if (!date.isValid) date = DateTime.fromJSDate(new Date(dateStr), { zone: 'utc' }).toLocal();
      
      if (!date.isValid) {
        console.warn(`Invalid date format for relative time: ${dateStr}`);
        return 'recently';
      }
      
      return date.toRelative();
        } catch (error) {
      console.error('Error formatting relative time:', error);
      return 'recently';
    }
  };
  
  // Format scheduled date display
  const formatScheduledDate = (isoDate, metadata, notification) => {
    // Basic date formatting function without recursion
    const formatBasicDate = (dateStr) => {
      if (!dateStr) return 'Date not available';
    
      try {
        // Try parsing as ISO format first - treat as local time since scheduled_for is stored in user's timezone
        let date = DateTime.fromISO(dateStr);
        
        // Check if the date is valid
        if (!date.isValid) {
          // Try parsing as SQL datetime format - also treating as local time
          date = DateTime.fromSQL(dateStr);
        }
        
        // If still not valid, try as JS Date object
        if (!date.isValid) {
          date = DateTime.fromJSDate(new Date(dateStr));
        }
        
        // If still invalid after all attempts, show formatted date with fallback
        if (!date.isValid) {
          console.warn(`Invalid date format in formatBasicDate: ${dateStr}`);
          return `${dateStr}`;
        }
        
        return date.toFormat('MMM dd, yyyy HH:mm');
      } catch (error) {
        console.error(`Error in formatBasicDate: ${error.message}`, dateStr);
        return `${dateStr}`;
      }
    };
    
    // If notification has been sent, add a clear indicator
    if (notification && notification.is_sent) {
      // For one-time notifications that have been sent
      if (!metadata || !metadata.recurrence) {
        return `Sent at ${formatBasicDate(isoDate)}`;
      }
      
      // For recurring notifications that have been sent at least once
      try {
        const metaObj = typeof metadata === 'string' ? JSON.parse(metadata || '{}') : metadata;
        if (metaObj && metaObj.recurrence) {
          return `Next: ${formatBasicDate(isoDate)} (Last sent: ${formatBasicDate(notification.updated_at)})`;
        }
      } catch (error) {
        console.error('Error formatting recurring sent notification date:', error);
      }
      
      // Default fallback
      return `Sent at ${formatBasicDate(isoDate)}`;
    }
    
    // Original date formatting logic
    if (!isoDate) {
      // Check if this is a recurring notification without a specific date
      if (metadata) {
        try {
          const parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
          if (parsedMetadata && parsedMetadata.recurrence) {
            return 'Recurring (Next date TBD)';
          }
        } catch (error) {
          console.error('Error parsing metadata in formatScheduledDate:', error);
        }
      }
      return 'Not scheduled';
    }
    
    return formatBasicDate(isoDate);
  };

  // Get badge style based on notification type
  const getBadgeClass = (type) => {
    switch (type) {
      case 'success':
        return 'badge-success';
      case 'warning':
        return 'badge-warning';
      case 'error':
        return 'badge-error';
      default:
        return 'badge-info';
    }
  };

  // Format group name for display
  const getGroupName = (groupId) => {
    if (!groupId) return 'All Users';
    
    // Ensure groupId is treated as an integer for comparison
    const numericId = parseInt(groupId, 10);
    const group = groups.find(g => g.id === numericId);
    return group ? group.name : `Group ${groupId}`;
  };

  // Get day of week name
  const getDayOfWeekName = (dayNumber) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[dayNumber - 1] || 'Unknown';
  };

  // Convert day name to day number
  const getDayNumber = (dayName) => {
    const dayMap = {
      'monday': 1,
      'tuesday': 2,
      'wednesday': 3,
      'thursday': 4,
      'friday': 5,
      'saturday': 6,
      'sunday': 7
    };
    return dayMap[dayName.toLowerCase()] || 0;
  };

  // Format selected days of week as text
  const formatSelectedDays = (selectedDays) => {
    const dayNames = Object.keys(selectedDays).filter(day => selectedDays[day]);
    
    if (dayNames.length === 7) return 'Every day';
    if (dayNames.length === 0) return 'No days selected';
    
    if (dayNames.length === 5 && 
        selectedDays.monday && 
        selectedDays.tuesday && 
        selectedDays.wednesday && 
        selectedDays.thursday && 
        selectedDays.friday) {
      return 'Weekdays only';
    }
    
    if (dayNames.length === 2 && 
        selectedDays.saturday && 
        selectedDays.sunday) {
      return 'Weekends only';
    }
    
    return dayNames.map(day => day.charAt(0).toUpperCase() + day.slice(1).substring(0, 2)).join(', ');
  };

  // Get recurrence pattern display text
  const getRecurrenceText = (metadata) => {
    if (!metadata) return 'One-time notification';
    
    try {
      const parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      
      if (!parsedMetadata.recurrence || !parsedMetadata.recurrence.pattern) {
        return 'One-time notification';
      }
      
      const { pattern, count, end_date, indefinite, monthly_day, weekly_day, selected_days } = parsedMetadata.recurrence;
      
      let baseText = '';
      switch (pattern) {
        case 'daily':
          if (selected_days) {
            baseText = `Every ${formatSelectedDays(selected_days)}`;
          } else {
            baseText = count > 1 ? `Every ${count} days` : 'Daily';
          }
          break;
        case 'weekly':
          if (weekly_day) {
            baseText = count > 1 
              ? `Every ${count} weeks on ${getDayOfWeekName(weekly_day)}` 
              : `Weekly on ${getDayOfWeekName(weekly_day)}`;
          } else {
            baseText = count > 1 ? `Every ${count} weeks` : 'Weekly';
          }
          break;
        case 'monthly':
          if (monthly_day) {
            const dayWithSuffix = getOrdinalSuffix(monthly_day);
            baseText = count > 1 
              ? `Every ${count} months on the ${dayWithSuffix}` 
              : `Monthly on the ${dayWithSuffix}`;
          } else {
            baseText = count > 1 ? `Every ${count} months` : 'Monthly';
          }
          break;
        case 'yearly':
          baseText = count > 1 ? `Every ${count} years` : 'Yearly';
          break;
        default:
          baseText = `${pattern}`;
      }
      
      if (indefinite) {
        return `${baseText} (indefinitely)`;
      } else if (end_date) {
        const formattedEndDate = DateTime.fromISO(end_date).toFormat('MMM dd, yyyy');
        return `${baseText} until ${formattedEndDate}`;
      }
      
      return baseText;
    } catch (error) {
      console.error('Error parsing recurrence metadata:', error);
      return 'One-time notification';
    }
  };

  // Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
  const getOrdinalSuffix = (day) => {
    if (day > 3 && day < 21) return `${day}th`;
    switch (day % 10) {
      case 1: return `${day}st`;
      case 2: return `${day}nd`;
      case 3: return `${day}rd`;
      default: return `${day}th`;
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    if (loading || !onRefresh) return;
    
    try {
      setLoading(true);
      await onRefresh();
    } finally {
      setLoading(false);
    }
  };

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'indefinite_recurrence' && checked) {
      // If setting to indefinite, update the form data accordingly
      setFormData(prev => ({
        ...prev,
        [name]: checked,
        // Clear end date if setting to indefinite
        recurrence_end_date: ''
      }));
    } else if (name.startsWith('day_')) {
      // Handle day checkboxes for daily pattern
      const day = name.replace('day_', '');
      setFormData(prev => ({
        ...prev,
        selected_days: {
          ...prev.selected_days,
          [day]: checked
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
      
      // Reset preview count when target group changes
      if (name === 'target_group') {
        resetPreviewCount();
      }
    }
  };

  // Handle edit notification
  const handleEditNotification = (notification) => {
    // Parse the metadata for recurrence settings and queryData
    let recurrenceSettings = {
      is_recurring: false,
      recurrence_pattern: 'daily',
      recurrence_count: 1,
      recurrence_end_date: DateTime.now().plus({ months: 1 }).toISO().slice(0, 16),
      indefinite_recurrence: false,
      monthly_day: 1,
      weekly_day: 1,
      selected_days: {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: true
      }
    };

    // Save original metadata to preserve queryData and other properties
    let originalMetadata = {};

    if (notification.metadata) {
      try {
        const metadata = typeof notification.metadata === 'string' 
          ? JSON.parse(notification.metadata) 
          : notification.metadata;
          
        // Store the original metadata to preserve queryData
        originalMetadata = metadata;
        
        // Store the target group ID for future comparison
        if (notification.target_group) {
          originalMetadata.targetGroupId = parseInt(notification.target_group, 10);
        }
          
        if (metadata.recurrence) {
          recurrenceSettings.is_recurring = true;
          recurrenceSettings.recurrence_pattern = metadata.recurrence.pattern || 'daily';
          recurrenceSettings.recurrence_count = metadata.recurrence.count || 1;
          
          if (metadata.recurrence.end_date) {
            recurrenceSettings.recurrence_end_date = metadata.recurrence.end_date;
            recurrenceSettings.indefinite_recurrence = false;
          } else {
            recurrenceSettings.indefinite_recurrence = true;
          }
          
          if (metadata.recurrence.pattern === 'monthly' && metadata.recurrence.day_of_month) {
            recurrenceSettings.monthly_day = metadata.recurrence.day_of_month;
          }
          
          if (metadata.recurrence.pattern === 'weekly' && metadata.recurrence.day_of_week) {
            recurrenceSettings.weekly_day = metadata.recurrence.day_of_week;
          }
          
          if (metadata.recurrence.pattern === 'daily' && metadata.recurrence.selected_days) {
            recurrenceSettings.selected_days = metadata.recurrence.selected_days;
          }
        }
      } catch (error) {
        console.error('Error parsing notification metadata:', error);
      }
    } else {
      // If no metadata, still store the target group ID
      if (notification.target_group) {
        originalMetadata.targetGroupId = parseInt(notification.target_group, 10);
      }
    }
    
    // Ensure target_group is a string representation of an integer for the form field
    const targetGroup = notification.target_group ? String(notification.target_group) : '';
    
    // Format scheduled_for date safely
    let formattedScheduledDate;
    try {
    if (notification.scheduled_for) {
        const parsedDate = DateTime.fromISO(notification.scheduled_for);
        if (parsedDate.isValid) {
          formattedScheduledDate = parsedDate.toISO().slice(0, 16);
        } else {
          // Try alternate format
          const altParsedDate = DateTime.fromSQL(notification.scheduled_for);
          if (altParsedDate.isValid) {
            formattedScheduledDate = altParsedDate.toISO().slice(0, 16);
          } else {
            // If all parsing fails, use tomorrow
            formattedScheduledDate = DateTime.now().plus({ days: 1 }).toISO().slice(0, 16);
          }
        }
      } else {
        // No date provided, use tomorrow
        formattedScheduledDate = DateTime.now().plus({ days: 1 }).toISO().slice(0, 16);
        }
      } catch (error) {
        console.error('Error formatting scheduled date:', error);
      // Fallback to tomorrow if any error occurs
      formattedScheduledDate = DateTime.now().plus({ days: 1 }).toISO().slice(0, 16);
    }
    
    // Open the form with notification data
    setFormData({
      title: notification.title || '',
      message: notification.message || '',
      type: notification.type || 'info',
      target_group: targetGroup,
      scheduled_for: formattedScheduledDate,
      link_url: notification.link_url || '',
      originalMetadata: originalMetadata, // Store original metadata to preserve queryData
      ...recurrenceSettings
    });
    
    setIsEditing(true);
    setEditingId(notification.id);
    setFormOpen(true);
  };

  // Handle delete notification
  const handleDeleteNotification = async (id) => {
        setLoading(true);
    try {
      await api.delete(`/notifications/scheduled/${id}`);
      setDeleteConfirm(null);
      toast.success('Notification deleted successfully.');
      if (onRefresh) {
        onRefresh();
      }
      } catch (error) {
        console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification. Please try again.');
      } finally {
        setLoading(false);
    }
  };

  // Cancel delete confirmation
  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  // Handle form submission (create or update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
      
    // Get the selected group data for queryData
    let selectedGroup = null;
    let queryData = null;
    let tables = null;
    
    if (formData.target_group) {
      const selectedGroupId = parseInt(formData.target_group, 10);
      selectedGroup = groups.find(g => g.id === selectedGroupId);
      
      // Parse query_data from string to object
      if (selectedGroup && selectedGroup.query_data) {
        try {
          queryData = JSON.parse(selectedGroup.query_data);
        } catch (err) {
          console.error("Error parsing query_data:", err);
          toast.error('Invalid query data format');
          setSubmitting(false);
      return;
    }
      }
      
      // Parse tables from string to array
      if (selectedGroup && selectedGroup.tables) {
        try {
          // Check if tables is already an array (processed) or a string (needs parsing)
          if (Array.isArray(selectedGroup.tables)) {
            tables = selectedGroup.tables;
          } else {
            tables = JSON.parse(selectedGroup.tables);
          }
        } catch (err) {
          console.error("Error parsing tables:", err);
          toast.error('Invalid tables format');
          setSubmitting(false);
          return;
        }
      }
    }

    // Process the form data
    const payload = {
      title: formData.title,
      message: formData.message,
      type: formData.type,
      // Ensure target_group is passed as a number or null
      target_group: formData.target_group ? parseInt(formData.target_group, 10) : null,
      scheduled_for: formData.scheduled_for,
      link_url: formData.link_url || null,
      metadata: {}
    };
      
    // If editing, start with the original metadata to preserve queryData
    if (isEditing && formData.originalMetadata) {
      payload.metadata = {...formData.originalMetadata};
      
      // Remove recurrence from original metadata if it exists
      // We'll add the updated recurrence settings below
      if (payload.metadata.recurrence) {
        delete payload.metadata.recurrence;
      }
    }

    // Add recurrence information if this is a recurring notification
      if (formData.is_recurring) {
      payload.metadata.recurrence = {
          pattern: formData.recurrence_pattern,
        count: formData.recurrence_count
      };

      // Add pattern-specific details
      if (formData.recurrence_pattern === 'weekly') {
        if (formData.weekly_day) {
          payload.metadata.recurrence.day_of_week = formData.weekly_day;
        }
      } else if (formData.recurrence_pattern === 'monthly') {
        if (formData.monthly_day) {
          payload.metadata.recurrence.day_of_month = formData.monthly_day;
        }
      }

      // Add selected days for weekly recurrence with multiple days
      if (formData.recurrence_pattern === 'weekly' && Object.values(formData.selected_days).some(day => day)) {
        payload.metadata.recurrence.days = Object.entries(formData.selected_days)
          .filter(([_, isSelected]) => isSelected)
          .map(([day]) => getDayNumber(day));
      }
      
      // Add end date if not indefinite
      if (!formData.indefinite_recurrence && formData.recurrence_end_date) {
        payload.metadata.recurrence.end_date = formData.recurrence_end_date;
      }
    }

    // Include queryData from selectedGroup similar to SendNotification.js
    if (selectedGroup) {
      // Include queryData in the metadata
      if (queryData) {
        payload.metadata.queryData = queryData;
      }
      
      // Include tables if available
      if (tables) {
        payload.metadata.tables = tables;
      }
    }

    try {
      if (isEditing) {
        await api.put(`/notifications/scheduled/${editingId}`, payload);
        toast.success('Scheduled notification updated successfully.');
      } else {
        await api.post('/notifications/scheduled', payload);
        toast.success('Scheduled notification created successfully.');
      }
      
      // Reset form and refresh data
      setFormData({
        title: '',
        message: '',
        type: 'info',
        target_group: '',
        scheduled_for: DateTime.now().plus({ days: 1 }).toISO().slice(0, 16),
        link_url: '',
        is_recurring: false,
        recurrence_pattern: 'daily',
        recurrence_count: 1,
        recurrence_end_date: DateTime.now().plus({ months: 1 }).toISO().slice(0, 16),
        indefinite_recurrence: false,
        monthly_day: 1,
        weekly_day: 1,
        selected_days: {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: true,
          sunday: true
        },
        originalMetadata: {}
      });
      
      // Reset preview count
      setPreviewCount(null);
      
      setFormOpen(false);
      setIsEditing(false);
      setEditingId(null);
      
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error saving notification:', error);
      toast.error('Failed to save notification. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Check if a notification is past due (scheduled time is in the past)
  const isPastDue = (scheduledFor) => {
    if (!scheduledFor) return false;
    
    try {
      const now = DateTime.now();
      let scheduledDate;
      
      // Try parsing as ISO format first
      scheduledDate = DateTime.fromISO(scheduledFor);
      
      // If not valid, try SQL format
      if (!scheduledDate.isValid) {
        scheduledDate = DateTime.fromSQL(scheduledFor);
      }
      
      // If still not valid, try JS Date
      if (!scheduledDate.isValid) {
        scheduledDate = DateTime.fromJSDate(new Date(scheduledFor));
      }
      
      if (!scheduledDate.isValid) {
        return false;
      }
      
      return scheduledDate < now;
    } catch (error) {
      console.error('Error checking if past due:', error);
      return false;
    }
  };

  // Apply filters and sorting to notifications
  useEffect(() => {
    let result = [...scheduledNotifications];
    
    // Apply search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(item => 
        (item.title && item.title.toLowerCase().includes(query)) || 
        (item.message && item.message.toLowerCase().includes(query))
      );
    }
    
    // Apply date range filter
    if (dateRange.start || dateRange.end) {
      result = result.filter(item => {
        if (!item.scheduled_for) return false;
        
        const date = DateTime.fromISO(item.scheduled_for);
        
        if (dateRange.start && dateRange.end) {
          return date >= DateTime.fromISO(dateRange.start) && 
                 date <= DateTime.fromISO(dateRange.end);
        } else if (dateRange.start) {
          return date >= DateTime.fromISO(dateRange.start);
        } else if (dateRange.end) {
          return date <= DateTime.fromISO(dateRange.end);
        }
        
        return true;
      });
    }
    
    // Apply target group filters using the three-state system
    const enabledGroups = [];
    const disabledGroups = [];
    let hasActiveGroupFilter = false;
    
    // First check if there are any active group filters
    const allUsersFilter = activeFilters['all_users'];
    
    if (allUsersFilter !== null) {
      hasActiveGroupFilter = true;
    }
    
    // Check group filters
    groups.forEach(group => {
      const groupKey = `group_${group.id}`;
      if (activeFilters[groupKey] === true) {
        enabledGroups.push(String(group.id));
        hasActiveGroupFilter = true;
      } else if (activeFilters[groupKey] === false) {
        disabledGroups.push(String(group.id));
        hasActiveGroupFilter = true;
      }
    });
    
    if (hasActiveGroupFilter) {
      result = result.filter(item => {
        // For null target_group (all users)
        if (!item.target_group) {
          return allUsersFilter !== false; // Show unless explicitly excluded
        }
        
        // For specific target groups
        const groupId = String(item.target_group);
        
        // If explicitly included, show it
        if (enabledGroups.includes(groupId)) {
          return true;
        }
        
        // If explicitly excluded, hide it
        if (disabledGroups.includes(groupId)) {
          return false;
        }
        
        // If not specified either way, show it only if we're not in strict mode
        return !hasActiveGroupFilter;
      });
    }
    
    // Apply type filters
    const typeFilters = ['info', 'success', 'warning', 'error'];
    const includedTypes = typeFilters.filter(type => activeFilters[type] === true);
    const excludedTypes = typeFilters.filter(type => activeFilters[type] === false);
    
    if (includedTypes.length > 0 || excludedTypes.length > 0) {
      result = result.filter(item => {
        const type = item.type || 'info';
        
        // If type is explicitly included, show it
        if (includedTypes.includes(type)) {
          return true;
        }
        
        // If type is explicitly excluded, hide it
        if (excludedTypes.includes(type)) {
          return false;
        }
        
        // If no explicit include/exclude, show it
        return includedTypes.length === 0;
      });
    }
    
    // Apply link URL filters
    const hasLinkFilter = activeFilters.has_link;
    const noLinkFilter = activeFilters.no_link;
    
    if (hasLinkFilter !== null || noLinkFilter !== null) {
      result = result.filter(item => {
        const hasLink = !!item.link_url;
        
        // Check has_link filter
        if (hasLinkFilter === true && hasLink) {
          return true;
        }
        
        // Check no_link filter
        if (noLinkFilter === true && !hasLink) {
          return true;
        }
        
        // Exclude if explicitly filtered against
        if (hasLinkFilter === false && hasLink) {
          return false;
        }
        
        if (noLinkFilter === false && !hasLink) {
          return false;
        }
        
        // Show if neither filter is active
        return hasLinkFilter === null && noLinkFilter === null;
      });
    }
    
    // Apply sent/not sent filters
    const sentFilter = activeFilters.sent;
    const notSentFilter = activeFilters.not_sent;
    
    if (sentFilter !== null || notSentFilter !== null) {
      result = result.filter(item => {
        const isSent = item.is_read;
        
        // Check sent filter
        if (sentFilter === true && isSent) {
          return true;
        }
        
        // Check not_sent filter
        if (notSentFilter === true && !isSent) {
          return true;
        }
        
        // Exclude if explicitly filtered against
        if (sentFilter === false && isSent) {
          return false;
        }
        
        if (notSentFilter === false && !isSent) {
          return false;
        }
        
        // Show if neither filter is active
        return sentFilter === null && notSentFilter === null;
      });
    }
    
    // Apply recurring/one-time filters
    const recurringFilter = activeFilters.recurring;
    const oneTimeFilter = activeFilters.one_time;
    
    if (recurringFilter !== null || oneTimeFilter !== null) {
      result = result.filter(item => {
        let isRecurring = false;
        
        try {
          const metadata = typeof item.metadata === 'string' 
            ? JSON.parse(item.metadata) 
            : item.metadata;
          isRecurring = !!(metadata && metadata.recurrence);
        } catch (err) {
          isRecurring = false;
        }
        
        // Check recurring filter
        if (recurringFilter === true && isRecurring) {
          return true;
        }
        
        // Check one_time filter
        if (oneTimeFilter === true && !isRecurring) {
          return true;
        }
        
        // Exclude if explicitly filtered against
        if (recurringFilter === false && isRecurring) {
          return false;
        }
        
        if (oneTimeFilter === false && !isRecurring) {
          return false;
        }
        
        // Show if neither filter is active
        return recurringFilter === null && oneTimeFilter === null;
      });
    }
    
    // Apply recurrence pattern filters
    const patternFilters = {
      daily: activeFilters.daily,
      weekly: activeFilters.weekly,
      monthly: activeFilters.monthly,
      yearly: activeFilters.yearly
    };
    
    const hasPatternFilter = Object.values(patternFilters).some(v => v !== null);
    
    if (hasPatternFilter) {
      result = result.filter(item => {
        try {
          const metadata = typeof item.metadata === 'string' 
            ? JSON.parse(item.metadata) 
            : item.metadata;
          
          // If not recurring, handle based on one_time filter
          if (!(metadata && metadata.recurrence)) {
            return oneTimeFilter !== false; // Show unless explicitly excluded
          }
          
          const pattern = metadata.recurrence.pattern;
          
          // If this pattern is explicitly included, show it
          if (patternFilters[pattern] === true) {
            return true;
          }
          
          // If this pattern is explicitly excluded, hide it
          if (patternFilters[pattern] === false) {
            return false;
          }
          
          // If no explicit include/exclude for this pattern, show it if no patterns are explicitly included
          return !Object.values(patternFilters).some(v => v === true);
        } catch (err) {
          // If error parsing metadata, treat as one-time
          return oneTimeFilter !== false; // Show unless explicitly excluded
        }
      });
    }
    
    // Apply sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        let aValue, bValue;
        
        if (sortConfig.key === 'scheduled_for') {
          // Handle date sorting, accounting for null dates
          aValue = a.scheduled_for ? new Date(a.scheduled_for).getTime() : 0;
          bValue = b.scheduled_for ? new Date(b.scheduled_for).getTime() : 0;
        } else if (sortConfig.key === 'target_group') {
          // Sort by group name
          aValue = getGroupName(a.target_group).toLowerCase();
          bValue = getGroupName(b.target_group).toLowerCase();
        } else if (sortConfig.key === 'recurring') {
          // Sort by recurring status
          try {
            const aMetadata = typeof a.metadata === 'string' ? JSON.parse(a.metadata) : a.metadata;
            const bMetadata = typeof b.metadata === 'string' ? JSON.parse(b.metadata) : b.metadata;
            aValue = aMetadata && aMetadata.recurrence ? 1 : 0;
            bValue = bMetadata && bMetadata.recurrence ? 1 : 0;
          } catch (err) {
            aValue = 0;
            bValue = 0;
          }
        } else {
          // Default string comparison
          aValue = (a[sortConfig.key] || '').toLowerCase();
          bValue = (b[sortConfig.key] || '').toLowerCase();
        }
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    
    setFilteredNotifications(result);
  }, [scheduledNotifications, activeFilters, sortConfig, groups, searchQuery, dateRange]);
  
  // Handle role filter toggle (for target groups)
  const handleRoleFilterToggle = (role) => {
    setActiveFilters(prev => ({
      ...prev,
      [role]: !prev[role]
    }));
  };
  
  // Toggle all role filters
  const handleToggleAllRoles = (value) => {
    setActiveFilters(prev => ({
      ...prev,
      RGA: value,
      MGA: value,
      GA: value,
      SA: value,
      AGT: value
    }));
  };
  
  // Handle status filter toggle with three states
  const handleStatusFilterToggle = (status) => {
    setActiveFilters(prev => {
      // Cycle through: null (neutral) -> true (include) -> null (neutral)
      const currentValue = prev[status];
      let newValue;
      
      if (currentValue === null) {
        newValue = true;
      } else {
        newValue = null;
      }
      
      return {
        ...prev,
        [status]: newValue
      };
    });
  };
  
  // Handle recurrence type toggle with three states
  const handleRecurrenceTypeToggle = (type) => {
    setActiveFilters(prev => {
      // Cycle through: null (neutral) -> true (include) -> null (neutral)
      const currentValue = prev[type];
      let newValue;
      
      if (currentValue === null) {
        newValue = true;
      } else {
        newValue = null;
      }
      
      return {
        ...prev,
        [type]: newValue
      };
    });
  };
  
  // Handle recurrence pattern toggle with three states
  const handleRecurrencePatternToggle = (pattern) => {
    setActiveFilters(prev => {
      // Cycle through: null (neutral) -> true (include) -> null (neutral)
      const currentValue = prev[pattern];
      let newValue;
      
      if (currentValue === null) {
        newValue = true;
      } else {
        newValue = null;
      }
      
      return {
        ...prev,
        [pattern]: newValue
      };
    });
  };
  
  // Handle link filter toggle with three states
  const handleLinkFilterToggle = (filter) => {
    setActiveFilters(prev => {
      // Cycle through: null (neutral) -> true (include) -> null (neutral)
      const currentValue = prev[filter];
      let newValue;
      
      if (currentValue === null) {
        newValue = true;
      } else {
        newValue = null;
      }
      
      return {
        ...prev,
        [filter]: newValue
      };
    });
  };
  
  // Handle date range change
  const handleDateRangeChange = (range) => {
    setDateRange(range);
    setActiveFilters(prev => ({
      ...prev,
      date_range: range
    }));
  };
  
  // Reset all filters
  const resetFilters = () => {
    let resetGroups = { 'all_users': null };
    
    // Reset all groups to null (neutral)
    if (groups && groups.length > 0) {
      groups.forEach(group => {
        resetGroups[`group_${group.id}`] = null;
      });
    }
    
    setActiveFilters({
      ...resetGroups,
      sent: null,
      not_sent: null,
      recurring: null,
      one_time: null,
      daily: null,
      weekly: null,
      monthly: null,
      yearly: null,
      info: null,
      success: null,
      warning: null,
      error: null,
      has_link: null,
      no_link: null,
      date_range: {
        start: null,
        end: null
      }
    });
    
    // Reset search and date range
    setSearchQuery('');
    setDateRange({
      start: null,
      end: null
    });
  };
  
  // Get role filters for the FilterMenu component
  const getTargetFilters = () => {
    const filters = ['all_users']; // Filter for all users (no target group)
    
    // Add each group from props
    if (groups && groups.length > 0) {
      groups.forEach(group => {
        filters.push(`group_${group.id}`);
      });
    }
    
    return filters;
  };
  
  // Handle target filter toggle with three states
  const handleTargetFilterToggle = (target) => {
    setActiveFilters(prev => {
      // Cycle through: null (neutral) -> true (include) -> null (neutral)
      const currentValue = prev[target];
      let newValue;
      
      if (currentValue === null) {
        newValue = true;
      } else {
        newValue = null;
      }
      
      return {
        ...prev,
        [target]: newValue
      };
    });
  };
  
  // Toggle all target filters
  const handleToggleAllTargets = (value) => {
    let updates = { 'all_users': value };
    
    // Add each group from props
    if (groups && groups.length > 0) {
      groups.forEach(group => {
        updates[`group_${group.id}`] = value;
      });
    }
    
    setActiveFilters(prev => ({
      ...prev,
      ...updates
    }));
  };
  
  // Get type filters for the FilterMenu component
  const getTypeFilters = () => {
    return ['info', 'success', 'warning', 'error'];
  };
  
  // Handle type filter toggle with three states
  const handleTypeFilterToggle = (type) => {
    setActiveFilters(prev => {
      // Cycle through: null (neutral) -> true (include) -> null (neutral)
      const currentValue = prev[type];
      let newValue;
      
      if (currentValue === null) {
        newValue = true;
      } else {
        newValue = null;
      }
      
      return {
        ...prev,
        [type]: newValue
      };
    });
  };
  
  // Handle all types toggle
  const handleToggleAllTypes = (value) => {
    setActiveFilters(prev => ({
      ...prev,
      info: value,
      success: value,
      warning: value,
      error: value
    }));
  };
  
  // Get link filters
  const getLinkFilters = () => {
    return ['has_link', 'no_link'];
  };
  
  // Get display label for filter values
  const getFilterLabel = (filter, value) => {
    // Target group mapping
    if (filter === 'all_users') return 'All Users';
    
    // Check if it's a group filter
    if (filter.startsWith('group_')) {
      const groupId = filter.replace('group_', '');
      const group = groups.find(g => g.id === parseInt(groupId, 10));
      return group ? group.name : `Group ${groupId}`;
    }
    
    // Status mapping
    if (filter === 'sent') return 'Already Sent';
    if (filter === 'not_sent') return 'Not Yet Sent';
    
    // Link mapping
    if (filter === 'has_link') return 'Contains Link URL';
    if (filter === 'no_link') return 'No Link URL';
    
    // Type mapping
    if (filter === 'info') return 'Info Type';
    if (filter === 'success') return 'Success Type';
    if (filter === 'warning') return 'Warning Type';
    if (filter === 'error') return 'Error Type';
    
    // Recurrence type mapping
    if (filter === 'recurring') return 'Recurring Notifications';
    if (filter === 'one_time') return 'One-time Notifications';
    
    // Recurrence pattern mapping
    if (filter === 'daily') return 'Daily Pattern';
    if (filter === 'weekly') return 'Weekly Pattern';
    if (filter === 'monthly') return 'Monthly Pattern';
    if (filter === 'yearly') return 'Yearly Pattern';
    
    return value;
  };
  
  // Get additional filter groups for the FilterMenu component
  const getCustomFilterGroups = () => {
    return [
      {
        name: 'Target Group',
        filters: getTargetFilters(),
        onToggle: handleTargetFilterToggle,
        onToggleAll: handleToggleAllTargets
      },
      {
        name: 'Notification Type',
        filters: ['info', 'success', 'warning', 'error'],
        onToggle: handleTypeFilterToggle,
        onToggleAll: handleToggleAllTypes
      },
      {
        name: 'Time Pattern',
        filters: ['daily', 'weekly', 'monthly', 'yearly'],
        onToggle: handleRecurrencePatternToggle
      },
      {
        name: 'Recurrence',
        filters: ['recurring', 'one_time'],
        onToggle: handleRecurrenceTypeToggle
      },
      {
        name: 'Link',
        filters: ['has_link', 'no_link'],
        onToggle: handleLinkFilterToggle
      },
      {
        name: 'Status',
        filters: ['sent', 'not_sent'],
        onToggle: handleStatusFilterToggle
      }
    ];
  };

  // Add back the requestSort function
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Get active filter count function
  const getActiveFilterCount = () => {
    let count = 0;
    
    // Count target group filters that are not null
    if (activeFilters['all_users'] !== null) count++;
    groups.forEach(group => {
      if (activeFilters[`group_${group.id}`] !== null) count++;
    });
    
    // Count type filters that are not null
    const typeFilters = ['info', 'success', 'warning', 'error'];
    typeFilters.forEach(type => {
      if (activeFilters[type] !== null) count++;
    });
    
    // Count link filters that are not null
    if (activeFilters.has_link !== null) count++;
    if (activeFilters.no_link !== null) count++;
    
    // Count status filters that are not null
    if (activeFilters.sent !== null) count++;
    if (activeFilters.not_sent !== null) count++;
    
    // Count recurrence type filters that are not null
    if (activeFilters.recurring !== null) count++;
    if (activeFilters.one_time !== null) count++;
    
    // Count recurrence pattern filters that are not null
    if (activeFilters.daily !== null) count++;
    if (activeFilters.weekly !== null) count++;
    if (activeFilters.monthly !== null) count++;
    if (activeFilters.yearly !== null) count++;
    
    // Count date range filter
    if (activeFilters.date_range.start || activeFilters.date_range.end) count++;
    
    // Count search query
    if (searchQuery.trim()) count++;
    
    return count;
  };

  // Render the group selection options
  const renderGroupOptions = () => {
    return [
      <option key="all" value="">All Users</option>,
      ...groups.map(group => (
        <option key={group.id} value={group.id.toString()}>
          {group.name}
        </option>
      ))
    ];
  };

  // Add the handlePreviewCount function after other handler functions
  const handlePreviewCount = async () => {
    if (!formData.target_group) {
      toast.error('Please select a notification group first');
      return;
    }

    try {
      setPreviewLoading(true);
      
      const selectedGroupId = parseInt(formData.target_group, 10);
      console.log("Looking for group with ID:", selectedGroupId);
      
      const selectedGroup = groups.find(g => g.id === selectedGroupId);
      
      if (!selectedGroup) {
        toast.error('Selected group not found');
        return;
      }

      console.log("Selected group:", selectedGroup);

      // Parse query_data from string to object
      let queryData = {};
      if (selectedGroup.query_data) {
        try {
          queryData = JSON.parse(selectedGroup.query_data);
          console.log("Parsed queryData:", queryData);
        } catch (err) {
          console.error("Error parsing query_data:", err);
          toast.error('Invalid query data format');
          return;
        }
      } else {
        toast.error('This group does not have query data configured');
        return;
      }

      // Parse tables from string to array
      let tables = [];
      if (selectedGroup && selectedGroup.tables) {
        try {
          // Check if tables is already an array (processed) or a string (needs parsing)
          if (Array.isArray(selectedGroup.tables)) {
            tables = selectedGroup.tables;
          } else {
            tables = JSON.parse(selectedGroup.tables);
          }
        } catch (err) {
          console.error("Error parsing tables:", err);
          toast.error('Invalid tables format');
          setSubmitting(false);
          return;
        }
      }

      // Send the request with the parsed data
      const response = await api.post('/notifications/admin/query-preview', {
        conditions: queryData.conditions || [],
        logicOperator: queryData.logicOperator || 'AND',
        tables: tables
      });
      
      console.log("Preview response:", response.data);
      
      if (response.data.success) {
        setPreviewCount(response.data.count);
      } else {
        toast.error(response.data.error || 'Failed to preview query results');
      }
    } catch (err) {
      console.error('Error previewing query:', err);
      toast.error('Failed to preview query. Please try again.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Add reset preview count function
  const resetPreviewCount = () => {
    setPreviewCount(null);
  };

  return (
    <div className="notification-schedule-container">
      <div className="notification-filters">
        <div className="search-filter-row">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search by title or message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button className="clear-search" onClick={() => setSearchQuery('')}>
                <FiX size={16} />
              </button>
            )}
            <FiSearch size={16} className="search-icon" />
          </div>
          
          <FilterMenu
            activeFilters={activeFilters}
            onFilterToggle={(filter) => {
              if (filter.startsWith('group_') || filter === 'all_users') {
                handleTargetFilterToggle(filter);
              } else if (['info', 'success', 'warning', 'error'].includes(filter)) {
                handleTypeFilterToggle(filter);
              } else if (['daily', 'weekly', 'monthly', 'yearly'].includes(filter)) {
                handleRecurrencePatternToggle(filter);
              } else if (['recurring', 'one_time'].includes(filter)) {
                handleRecurrenceTypeToggle(filter);
              } else if (['sent', 'not_sent'].includes(filter)) {
                handleStatusFilterToggle(filter);
              }
            }}
            onResetFilters={resetFilters}
            filterCategories={[
              {
                name: 'Target Audience',
                filters: getTargetFilters(),
                onToggle: handleTargetFilterToggle,
                onToggleAll: handleToggleAllTargets
              },
              {
                name: 'Notification Type',
                filters: ['info', 'success', 'warning', 'error'],
                onToggle: handleTypeFilterToggle,
                onToggleAll: handleToggleAllTypes,
                getFilterLabel: (filter) => {
                  const labels = {
                    'info': 'Information',
                    'success': 'Success',
                    'warning': 'Warning',
                    'error': 'Error'
                  };
                  return labels[filter] || filter;
                }
              },
              {
                name: 'Delivery Status',
                filters: ['sent', 'not_sent'],
                onToggle: handleStatusFilterToggle,
                getFilterLabel: (filter) => {
                  const labels = {
                    'sent': 'Already Sent',
                    'not_sent': 'Pending Delivery'
                  };
                  return labels[filter] || filter;
                }
              },
              {
                name: 'Recurrence',
                filters: ['recurring', 'one_time'],
                onToggle: handleRecurrenceTypeToggle,
                getFilterLabel: (filter) => {
                  const labels = {
                    'recurring': 'Recurring Notifications',
                    'one_time': 'One-time Notifications'
                  };
                  return labels[filter] || filter;
                }
              },
              { 
                name: 'Time Pattern',
                filters: ['daily', 'weekly', 'monthly', 'yearly'],
                onToggle: handleRecurrencePatternToggle,
                getFilterLabel: (filter) => {
                  const labels = {
                    'daily': 'Daily',
                    'weekly': 'Weekly',
                    'monthly': 'Monthly',
                    'yearly': 'Yearly'
                  };
                  return labels[filter] || filter;
                }
              },
              {
                name: 'Sort By',
                type: 'sort',
                options: [
                  { key: 'scheduled_for', label: 'Date', direction: 'desc' },
                  { key: 'scheduled_for', label: 'Date (oldest first)', direction: 'asc' },
                  { key: 'created_at', label: 'Created', direction: 'desc' },
                  { key: 'created_at', label: 'Created (oldest first)', direction: 'asc' }
                ],
                value: sortConfig,
                onChange: (option) => {
                  setSortConfig({ key: option.key, direction: option.direction });
                }
              }
            ]}
            buttonLabel={<FiFilter title="Filter Notifications" />}
            menuType="expandable"
            position="bottom"
            showFilterState={false}
            getFilterLabel={(filter) => {
              // Target group mapping
              if (filter === 'all_users') return 'All Users';
              
              // Check if it's a group filter
              if (filter.startsWith('group_')) {
                const groupId = filter.replace('group_', '');
                const group = groups.find(g => g.id === parseInt(groupId, 10));
                return group ? group.name : `Group ${groupId}`;
                }
              
              // Status mapping
              if (filter === 'sent') return 'Already Sent';
              if (filter === 'not_sent') return 'Pending Delivery';
              
              // Type mapping
              if (filter === 'info') return 'Information';
              if (filter === 'success') return 'Success';
              if (filter === 'warning') return 'Warning';
              if (filter === 'error') return 'Error';
              
              // Recurrence type mapping
              if (filter === 'recurring') return 'Recurring Notifications';
              if (filter === 'one_time') return 'One-time Notifications';
              
              // Recurrence pattern mapping
              if (filter === 'daily') return 'Daily';
              if (filter === 'weekly') return 'Weekly';
              if (filter === 'monthly') return 'Monthly';
              if (filter === 'yearly') return 'Yearly';
              
              return filter;
            }}
            getFilterColor={(filter) => {
              if (filter === 'info') return { bg: 'var(--info-color-light)', border: 'var(--info-color)' };
              if (filter === 'success') return { bg: 'var(--success-color-light)', border: 'var(--success-color)' };
              if (filter === 'warning') return { bg: 'var(--warning-color-light)', border: 'var(--warning-color)' };
              if (filter === 'error') return { bg: 'var(--error-color-light)', border: 'var(--error-color)' };
              return null;
            }}
            includeDateRange={true}
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
            dateRangeLabels={{
              title: 'Schedule Date',
              start: 'From',
              end: 'To',
              apply: 'Apply Date Range',
              clear: 'Clear Dates'
            }}
          />
          
          <button 
            className="settings-button settings-button-icon"
            onClick={handleRefresh}
            disabled={loading}
            title="Refresh"
          >
            <FiRefreshCw 
              size={16} 
              className={loading ? 'icon-spin' : ''} 
            />
          </button>
          
          <button 
            className="settings-button settings-button-icon"
            onClick={() => {
              if (isEditing) {
                // Reset form if canceling edit
                setFormData({
                  title: '',
                  message: '',
                  type: 'info',
                  target_group: '',
                  scheduled_for: DateTime.now().plus({ days: 1 }).toISO().slice(0, 16),
                  link_url: '',
                  is_recurring: false,
                  recurrence_pattern: 'daily',
                  recurrence_count: 1,
                  recurrence_end_date: DateTime.now().plus({ months: 1 }).toISO().slice(0, 16),
                  indefinite_recurrence: false,
                  monthly_day: 1,
                  weekly_day: 1,
                  selected_days: {
                    monday: true,
                    tuesday: true,
                    wednesday: true,
                    thursday: true,
                    friday: true,
                    saturday: true,
                    sunday: true
                  },
                  originalMetadata: {}
                });
                setIsEditing(false);
                setEditingId(null);
                setPreviewCount(null);
              }
              setFormOpen(!formOpen);
            }}
            title="Schedule New Notification"
          >
            <FiClock size={16} style={{ marginRight: '2px' }} />
            <FiPlus size={14} />
          </button>
        </div>
        
        {/* Remove the separate sort-controls section */}
      </div>
      
      {formOpen && (
        <div className="schedule-notification-form">
          <h4>{isEditing ? 'Edit Notification' : 'Schedule a New Notification'}</h4>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="title">Title*</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                placeholder="Notification title"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="message">Message*</label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                required
                placeholder="Notification message"
                rows={3}
              ></textarea>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="type">Type</label>
                <select
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                >
                  <option value="info">Info</option>
                  <option value="success">Success</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="target_group">Target Group</label>
                <div className="select-container">
                <select
                  id="target_group"
                  name="target_group"
                    className="form-control"
                  value={formData.target_group}
                  onChange={handleInputChange}
                >
                    <option value="">Select a notification group</option>
                  {groups.map(group => (
                      <option key={group.id} value={group.id.toString()}>
                        {group.name}
                      </option>
                  ))}
                </select>
                </div>
                
                {formData.target_group && (
                  <div className="target-preview">
                    <button 
                      type="button" 
                      className="settings-button settings-button-secondary"
                      onClick={handlePreviewCount}
                      disabled={previewLoading || !formData.target_group}
                    >
                      {previewLoading ? (
                        <>
                          <div className="spinner" style={{ width: '16px', height: '16px', marginRight: '8px' }} />
                          Calculating...
                        </>
                      ) : (
                        <>
                          <FiUsers size={14} style={{ marginRight: '4px' }} />
                          Check Target Count
                        </>
                      )}
                    </button>
                    
                    {previewCount !== null && (
                      <div className="target-user-count">
                        <FiUsers size={14} style={{ marginRight: '8px' }} />
                        This notification will be sent to <strong>{previewCount}</strong> user{previewCount !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="scheduled_for">Schedule Date/Time{formData.is_recurring ? '' : '*'}</label>
                <input
                  type="datetime-local"
                  id="scheduled_for"
                  name="scheduled_for"
                  value={formData.scheduled_for}
                  onChange={handleInputChange}
                  required={!formData.is_recurring}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="link_url">Link URL (Optional)</label>
                <input
                  type="text"
                  id="link_url"
                  name="link_url"
                  value={formData.link_url}
                  onChange={handleInputChange}
                  placeholder="e.g., /dashboard/reports"
                />
              </div>
            </div>
            
            <div className="form-group">
              <div className="checkbox-group">
                <input
                  type="checkbox"
                  id="is_recurring"
                  name="is_recurring"
                  checked={formData.is_recurring}
                  onChange={handleInputChange}
                />
                <label htmlFor="is_recurring" className="checkbox-label">
                  <FiRepeat size={16} style={{ marginRight: '4px' }} />
                  Recurring Notification
                </label>
              </div>
            </div>
            
            {formData.is_recurring && (
              <div className="recurrence-section">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="recurrence_pattern">Repeat</label>
                    <select
                      id="recurrence_pattern"
                      name="recurrence_pattern"
                      value={formData.recurrence_pattern}
                      onChange={handleInputChange}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  
                  {formData.recurrence_pattern !== 'daily' && (
                    <div className="form-group">
                      <label htmlFor="recurrence_count">Every</label>
                      <div className="number-input-group">
                        <input
                          type="number"
                          id="recurrence_count"
                          name="recurrence_count"
                          min="1"
                          max="365"
                          value={formData.recurrence_count}
                          onChange={handleInputChange}
                        />
                        <span className="input-suffix">
                          {formData.recurrence_pattern === 'weekly' ? 'weeks' :
                           formData.recurrence_pattern === 'monthly' ? 'months' : 'years'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Daily pattern - select days of week */}
                {formData.recurrence_pattern === 'daily' && (
                  <div className="days-of-week-selector">
                    <label>Days of the week</label>
                    <div className="days-checkboxes">
                      {Object.keys(formData.selected_days).map(day => (
                        <div key={day} className="day-checkbox">
                          <input
                            type="checkbox"
                            id={`day_${day}`}
                            name={`day_${day}`}
                            checked={formData.selected_days[day]}
                            onChange={handleInputChange}
                          />
                          <label htmlFor={`day_${day}`}>
                            {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Weekly pattern - select day of week */}
                {formData.recurrence_pattern === 'weekly' && (
                  <div className="form-group">
                    <label htmlFor="weekly_day">Day of the week</label>
                    <select
                      id="weekly_day"
                      name="weekly_day"
                      value={formData.weekly_day}
                      onChange={handleInputChange}
                    >
                      {getDaysOfWeek().map(day => (
                        <option key={day.value} value={day.value}>
                          {day.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                {/* Monthly pattern - select day of month */}
                {formData.recurrence_pattern === 'monthly' && (
                  <div className="form-group">
                    <label htmlFor="monthly_day">Day of the month</label>
                    <select
                      id="monthly_day"
                      name="monthly_day"
                      value={formData.monthly_day}
                      onChange={handleInputChange}
                    >
                      {getDaysOfMonth().map(day => (
                        <option key={day} value={day}>
                          {day}{getOrdinalSuffix(day).slice(String(day).length)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    id="indefinite_recurrence"
                    name="indefinite_recurrence"
                    checked={formData.indefinite_recurrence}
                    onChange={handleInputChange}
                  />
                  <label htmlFor="indefinite_recurrence" className="checkbox-label">
                    <FiRotateCw size={16} style={{ marginRight: '4px' }} />
                    Repeat indefinitely
                  </label>
                </div>
                
                {!formData.indefinite_recurrence && (
                  <div className="form-group">
                    <label htmlFor="recurrence_end_date">End Date</label>
                    <input
                      type="datetime-local"
                      id="recurrence_end_date"
                      name="recurrence_end_date"
                      value={formData.recurrence_end_date}
                      onChange={handleInputChange}
                      required={formData.is_recurring && !formData.indefinite_recurrence}
                    />
                  </div>
                )}
                
                <div className="recurrence-summary">
                  <FiClock size={16} style={{ marginRight: '8px' }} />
                  <span>
                    {formData.recurrence_pattern === 'daily' ? (
                      `Repeats on ${formatSelectedDays(formData.selected_days)}`
                    ) : formData.recurrence_pattern === 'weekly' ? (
                      formData.recurrence_count === 1 ? 
                        `Repeats weekly on ${getDayOfWeekName(parseInt(formData.weekly_day, 10))}` : 
                        `Repeats every ${formData.recurrence_count} weeks on ${getDayOfWeekName(parseInt(formData.weekly_day, 10))}`
                    ) : formData.recurrence_pattern === 'monthly' ? (
                      formData.recurrence_count === 1 ? 
                        `Repeats monthly on the ${getOrdinalSuffix(parseInt(formData.monthly_day, 10))}` : 
                        `Repeats every ${formData.recurrence_count} months on the ${getOrdinalSuffix(parseInt(formData.monthly_day, 10))}`
                    ) : (
                      formData.recurrence_count === 1 ? 'Repeats yearly' : `Repeats every ${formData.recurrence_count} years`
                    )}
                    
                    {formData.indefinite_recurrence ? (
                      <> indefinitely</>
                    ) : formData.recurrence_end_date ? (
                      <> until {formatScheduledDate(formData.recurrence_end_date)}</>
                    ) : null}
                  </span>
                </div>
              </div>
            )}
            
            <div className="form-actions">
              <button
                type="button"
                className="settings-button settings-button-secondary"
                onClick={() => {
                  setFormOpen(false);
                  setIsEditing(false);
                  setEditingId(null);
                  setPreviewCount(null);
                }}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="settings-button"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <div className="spinner-sm"></div>
                    {isEditing ? 'Updating...' : 'Scheduling...'}
                  </>
                ) : (
                  <>
                    <FiSend size={16} style={{ marginRight: '4px' }} />
                    {isEditing ? 'Update Notification' : 'Schedule Notification'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
      
      {loading ? (
        <div className="query-builder-loading">
          <div className="spinner"></div>
          <p>Loading scheduled notifications...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="scheduled-notifications-empty">
          {scheduledNotifications.length > 0 ? (
            <p>No notifications match your current filters. <button onClick={resetFilters} className="text-button">Clear filters</button></p>
          ) : (
            <p>No scheduled notifications found.</p>
          )}
        </div>
      ) : (
        <>
          {getActiveFilterCount() > 0 && (
            <div className="active-filters">
              <span>Active filters:</span>
              
              {/* Search query */}
              {searchQuery.trim() && (
                <span className="filter-tag">
                  Search: "{searchQuery}"
                  <button onClick={() => setSearchQuery('')}>×</button>
                </span>
              )}
              
              {/* Date range */}
              {(dateRange.start || dateRange.end) && (
                <span className="filter-tag">
                  Date: {dateRange.start ? formatScheduledDate(dateRange.start) : 'Any'} to {dateRange.end ? formatScheduledDate(dateRange.end) : 'Any'}
                  <button onClick={() => handleDateRangeChange({start: null, end: null})}>×</button>
                </span>
              )}
              
              {/* Type filters */}
              {['info', 'success', 'warning', 'error'].some(type => !activeFilters[type]) && (
                <span className="filter-tag">
                  Type: {['info', 'success', 'warning', 'error'].filter(type => activeFilters[type]).map(type => getFilterLabel(type)).join(', ')}
                </span>
              )}
              
              {/* Target group filters */}
              {(!activeFilters['all_users'] || groups.some(group => !activeFilters[`group_${group.id}`])) && (
                <span className="filter-tag">
                  Target: {[
                    ...(activeFilters['all_users'] ? ['All Users'] : []),
                    ...groups.filter(group => activeFilters[`group_${group.id}`]).map(group => group.name)
                  ].join(', ')}
                </span>
              )}
              
              {/* Link filters */}
              {(!activeFilters.has_link || !activeFilters.no_link) && (
                <span className="filter-tag">
                  Link: {[
                    ...(activeFilters.has_link ? ['Has Link'] : []),
                    ...(activeFilters.no_link ? ['No Link'] : [])
                  ].join(', ')}
                </span>
              )}
              
              {/* Time pattern filters */}
              {['daily', 'weekly', 'monthly', 'yearly'].some(pattern => !activeFilters[pattern]) && (
                <span className="filter-tag">
                  Time: {['daily', 'weekly', 'monthly', 'yearly'].filter(pattern => activeFilters[pattern]).map(pattern => getFilterLabel(pattern)).join(', ')}
                </span>
              )}
              
              {/* Recurrence type filters */}
              {(!activeFilters.recurring || !activeFilters.one_time) && (
                <span className="filter-tag">
                  Recurrence: {[
                    ...(activeFilters.recurring ? ['Recurring'] : []),
                    ...(activeFilters.one_time ? ['One-time'] : [])
                  ].join(', ')}
                </span>
              )}
              
              <button onClick={resetFilters} className="clear-filters-button">Clear all</button>
            </div>
          )}
          <div className="notification-count">
            Showing {filteredNotifications.length} of {scheduledNotifications.length} notifications
          </div>
          <div className="scheduled-notifications-list">
            {filteredNotifications.map(notification => (
              <div 
                key={notification.id} 
                className="scheduled-notification-item"
              >
                <div className="scheduled-notification-header">
                  <span className={`notification-type-badge ${getBadgeClass(notification.type)}`}>
                    {(() => {
                      const typeInfo = NOTIFICATION_TYPES[notification.type] || NOTIFICATION_TYPES.info;
                      const IconComponent = typeInfo.icon;
                      return (
                        <>
                          <IconComponent size={14} style={{ marginRight: '4px' }} />
                          {notification.type || 'info'}
                        </>
                      );
                    })()}
                  </span>
                  <div className="scheduled-notification-datetime">
                    <FiCalendar size={14} style={{ marginRight: '4px' }} />
                    {formatScheduledDate(notification.scheduled_for, notification.metadata, notification)}
                    {getStatusBadge(notification)}
                  </div>
                </div>
                
                <h4 className="scheduled-notification-title">{notification.title}</h4>
                <p className="scheduled-notification-message">{notification.message}</p>
                
                <div className="scheduled-notification-target">
                  <FiUsers size={14} style={{ marginRight: '4px' }} />
                  Target: {getGroupName(notification.target_group)}
                </div>
                
                {notification.link_url && (
                  <div className="scheduled-notification-link">
                    <FiLink size={14} style={{ marginRight: '4px' }} />
                    <a href={notification.link_url} target="_blank" rel="noopener noreferrer">
                      {notification.link_url}
                    </a>
                  </div>
                )}
                
                <div className="scheduled-notification-repeat">
                  <FiClock size={14} style={{ marginRight: '4px' }} />
                  {getRecurrenceText(notification.metadata)}
                </div>
                
                <div className="notification-card-actions">
                  <button 
                    className="card-action-button"
                    onClick={() => handleEditNotification(notification)}
                    title="Edit notification"
                  >
                    <FiEdit size={16} />
                  </button>
                  
                  {deleteConfirm === notification.id ? (
                    <div className="delete-confirm">
                      <span>Confirm?</span>
                      <button 
                        className="confirm-yes"
                        onClick={() => handleDeleteNotification(notification.id)}
                      >
                        Yes
                      </button>
                      <button 
                        className="confirm-no"
                        onClick={cancelDelete}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button 
                      className="card-action-button"
                      onClick={() => handleDeleteNotification(notification.id)}
                      title="Delete notification"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}


    </div>
  );
};

export default NotificationSchedule; 