import React, { useState, useEffect, useMemo } from 'react';
import { FiUser, FiClock, FiMonitor, FiFilter } from 'react-icons/fi';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import DataTable from '../utils/DataTable';

const LoginLogs = () => {
  const { user, hasPermission } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [days, setDays] = useState(7);
  const [totalCount, setTotalCount] = useState(0);

  // Debug logging
  useEffect(() => {
    console.log('LoginLogs component mounted');
    console.log('Current user:', user);
    console.log('User ID:', user?.id);
    console.log('User Role:', user?.Role);
    console.log('Has admin permission:', hasPermission('admin'));
    console.log('Has Admin role:', user?.Role === 'Admin');
  }, [user, hasPermission]);

  const fetchLogs = async (page = 1, searchTerm = '', dayFilter = 7) => {
    try {
      setLoading(true);
      setError('');

      console.log('Fetching login logs with params:', { page, searchTerm, dayFilter });

      const response = await api.get('/admin/login-logs', {
        params: {
          page,
          limit: 50,
          search: searchTerm,
          days: dayFilter
        }
      });

      console.log('Login logs response:', response.data);

      if (response.data.success) {
        const logsWithIds = response.data.data.logs.map((log, index) => ({
          ...log,
          // Ensure we have a unique ID for DataTable
          id: log.id || `log-${index}`,
          // Format display fields
          userDisplay: log.user_lagnname || log.lagnname,
          loginTime: new Date(log.timestamp + 'Z').toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
          }),
          browserName: getUserAgent(log.user_agent),
          statusDisplay: log.Active === 'y' ? 'Active' : 'Inactive'
        }));
        
        setLogs(logsWithIds);
        setTotalCount(response.data.data.pagination.total);
      } else {
        setError('Failed to fetch login logs');
      }
    } catch (err) {
      console.error('Error fetching login logs:', err);
      setError(err.response?.data?.message || 'Failed to fetch login logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1, search, days);
  }, [search, days]);

  const getRoleColor = (role) => {
    switch (role) {
      // Role field values
      case 'Admin': return '#dc3545';
      case 'Manager': return '#fd7e14';
      case 'Agent': return '#28a745';
      case 'Trainee': return '#17a2b8';
      case 'Recruit': return '#6f42c1';
      
      // clname (agent type) values
      case 'SGA': return '#dc3545';
      case 'RGA': return '#fd7e14';
      case 'MGA': return '#ffc107';
      case 'GA': return '#28a745';
      case 'SA': return '#17a2b8';
      case 'AGT': return '#6f42c1';
      
      default: return '#6c757d';
    }
  };

  const getUserAgent = (userAgent) => {
    if (!userAgent || userAgent === 'unknown') return 'Unknown';
    
    // Extract browser name
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    
    return 'Other';
  };

  // Define columns for DataTable
  const columns = useMemo(() => [
    {
      Header: 'User',
      accessor: 'userDisplay',
      Cell: ({ row }) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: '500' }}>
            {row.original.user_lagnname || row.original.lagnname}
          </div>
          {row.original.user_lagnname && row.original.lagnname !== row.original.user_lagnname && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              ({row.original.lagnname})
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {row.original.clname && (
              <span 
                style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '12px',
                  color: 'white',
                  backgroundColor: getRoleColor(row.original.clname),
                  fontWeight: '500'
                }}
              >
                {row.original.clname}
              </span>
            )}
            {row.original.Role && (
              <span 
                style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '12px',
                  color: 'white',
                  backgroundColor: getRoleColor(row.original.Role),
                  fontWeight: '500'
                }}
              >
                {row.original.Role}
              </span>
            )}
          </div>
        </div>
      ),
      sortType: 'basic'
    },
    {
      Header: 'Login Time',
      accessor: 'loginTime',
      Cell: ({ value }) => (
        <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
          {value}
        </div>
      ),
      sortType: (rowA, rowB) => {
        // Parse UTC timestamps and sort newest first (descending)
        const dateA = new Date(rowA.original.timestamp + 'Z'); // Add Z to ensure UTC parsing
        const dateB = new Date(rowB.original.timestamp + 'Z'); // Add Z to ensure UTC parsing
        return dateB.getTime() - dateA.getTime(); // Newest first (descending)
      }
    },
    {
      Header: 'IP Address',
      accessor: 'ip_address',
      Cell: ({ value }) => (
        <div style={{ 
          fontFamily: 'monospace', 
          fontSize: '0.85rem', 
          color: 'var(--text-secondary)' 
        }}>
          {value || 'Unknown'}
        </div>
      ),
      sortType: 'basic'
    },
    {
      Header: 'Browser',
      accessor: 'browserName',
      Cell: ({ value }) => (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem',
          fontSize: '0.9rem' 
        }}>
          <FiMonitor size={14} />
          {value}
        </div>
      ),
      sortType: 'basic'
    },
    {
      Header: 'Status',
      accessor: 'statusDisplay',
      Cell: ({ row }) => (
        <span 
          style={{
            fontSize: '0.8rem',
            padding: '0.2rem 0.5rem',
            borderRadius: '12px',
            color: 'white',
            backgroundColor: row.original.Active === 'y' ? '#28a745' : '#dc3545',
            fontWeight: '500'
          }}
        >
          {row.original.Active === 'y' ? 'Active' : 'Inactive'}
        </span>
      ),
      sortType: 'basic'
    }
  ], []);

  const handleSearchChange = (searchTerm) => {
    setSearch(searchTerm);
  };

  const handleDaysFilter = (newDays) => {
    setDays(newDays);
  };

  const styles = {
    container: {
      padding: '2rem',
      maxWidth: '1400px',
      margin: '0 auto'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '2rem',
      flexWrap: 'wrap',
      gap: '1rem'
    },
    title: {
      fontSize: '1.5rem',
      fontWeight: 'bold',
      color: 'var(--text-primary)',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    },
    controls: {
      display: 'flex',
      gap: '1rem',
      alignItems: 'center',
      flexWrap: 'wrap'
    },
    searchInput: {
      padding: '0.5rem',
      border: '1px solid var(--border-color)',
      borderRadius: '4px',
      fontSize: '0.9rem',
      minWidth: '200px'
    },
    filterButtons: {
      display: 'flex',
      gap: '0.5rem',
      alignItems: 'center'
    },
    filterButton: {
      padding: '0.5rem 1rem',
      border: '1px solid var(--border-color)',
      backgroundColor: 'var(--card-bg)',
      color: 'var(--text-primary)',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '0.85rem',
      transition: 'all 0.2s ease'
    },
    filterButtonActive: {
      backgroundColor: 'var(--primary-color)',
      color: 'white',
      borderColor: 'var(--primary-color)'
    },
    error: {
      textAlign: 'center',
      padding: '2rem',
      color: '#dc3545',
      backgroundColor: '#f8d7da',
      borderRadius: '4px',
      margin: '1rem 0'
    },
    stats: {
      display: 'flex',
      gap: '1rem',
      marginBottom: '1rem',
      fontSize: '0.9rem',
      color: 'var(--text-secondary)',
      padding: '1rem',
      backgroundColor: 'var(--card-bg)',
      borderRadius: '8px',
      border: '1px solid var(--border-color)'
    },
    debugInfo: {
      backgroundColor: '#f0f0f0',
      padding: '1.5rem',
      borderRadius: '8px',
      marginTop: '2rem',
      border: '1px solid #ccc'
    },
    userObject: {
      marginTop: '1rem',
      padding: '1rem',
      backgroundColor: '#e9ecef',
      borderRadius: '4px',
      overflowX: 'auto'
    }
  };

  // Permission check - show debug info if no permission
  if (!hasPermission('admin')) {
    return (
      <div style={styles.container}>
        <h2>Login Logs - Permission Debug</h2>
        <div style={styles.debugInfo}>
          <h3>Debug Information:</h3>
          <p><strong>User ID:</strong> {user?.id || 'undefined'}</p>
          <p><strong>User Role:</strong> {user?.Role || 'undefined'}</p>
          <p><strong>User clname:</strong> {user?.clname || 'undefined'}</p>
          <p><strong>Has admin permission:</strong> {hasPermission('admin') ? 'Yes' : 'No'}</p>
          <p><strong>Expected User ID for sidebar:</strong> 92</p>
          <p><strong>Expected Role for admin:</strong> Admin</p>
          <div style={styles.userObject}>
            <strong>Full user object:</strong>
            <pre>{JSON.stringify(user, null, 2)}</pre>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          <FiClock size={24} />
          <p>Loading login logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>
          <FiUser />
          Login Logs
        </h1>
        
        <div style={styles.controls}>
          <input
            type="text"
            placeholder="Search by username or IP..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={styles.searchInput}
          />

          <div style={styles.filterButtons}>
            <FiFilter size={16} />
            {[1, 7, 30, 90].map(dayOption => (
              <button
                key={dayOption}
                onClick={() => handleDaysFilter(dayOption)}
                style={{
                  ...styles.filterButton,
                  ...(days === dayOption ? styles.filterButtonActive : {})
                }}
              >
                {dayOption === 1 ? 'Today' : `${dayOption} days`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}

      {totalCount > 0 && (
        <div style={styles.stats}>
          <span><strong>Total logins:</strong> {totalCount}</span>
          <span>•</span>
          <span><strong>Time period:</strong> Last {days} {days === 1 ? 'day' : 'days'}</span>
          <span>•</span>
          <span><strong>Showing:</strong> {logs.length} records</span>
        </div>
      )}

      <DataTable
        columns={columns}
        data={logs}
        entityName="login logs"
        disableCellEditing={true}
        showActionBar={false}
        disablePagination={false}
        defaultSortBy="loginTime"
        defaultSortOrder="desc"
        stickyHeader={true}
        pageScrollSticky={false}
        initialPageSize={50}
        pageSizeOptions={[25, 50, 100]}
      />
    </div>
  );
};

export default LoginLogs; 