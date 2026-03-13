import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';

const AdminCheck = () => {
  const { user, hasPermission, login, getUserId } = useAuth();
  const isAdmin = hasPermission('admin');
  const [checkResult, setCheckResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hierarchyTest, setHierarchyTest] = useState(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [hierarchyError, setHierarchyError] = useState(null);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginResult, setLoginResult] = useState(null);

  const checkAdminBackend = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('[AdminCheck] Testing backend admin permissions');
      const response = await api.get('/admin/check-admin');
      
      console.log('[AdminCheck] Backend response:', response.data);
      setCheckResult(response.data);
    } catch (err) {
      console.error('[AdminCheck] Error checking admin status:', err);
      setError(err.response?.data?.message || err.message);
      setCheckResult(null);
    } finally {
      setLoading(false);
    }
  };

  const testHierarchyEndpoint = async () => {
    try {
      setHierarchyLoading(true);
      setHierarchyError(null);
      setHierarchyTest(null);
      
      console.log('[AdminCheck] Testing getAllRGAsHierarchy endpoint');
      const response = await api.get('/admin/getAllRGAsHierarchy');
      
      console.log('[AdminCheck] Hierarchy endpoint response:', response.data);
      setHierarchyTest({
        success: true,
        message: 'Successfully retrieved hierarchy data',
        rgaCount: response.data.rgaCount || 0
      });
    } catch (err) {
      console.error('[AdminCheck] Hierarchy endpoint error:', err);
      setHierarchyError(err.response?.data?.message || err.message);
      setHierarchyTest({
        success: false,
        status: err.response?.status,
        statusText: err.response?.statusText
      });
    } finally {
      setHierarchyLoading(false);
    }
  };

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginData(prev => ({ ...prev, [name]: value }));
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoginLoading(true);
      setLoginResult(null);
      
      console.log('[AdminCheck] Attempting login with provided credentials');
      const result = await login(loginData);
      
      setLoginResult({
        success: result.success,
        message: result.success ? 'Login successful! Token refreshed.' : (result.message || 'Login failed')
      });
      
      if (result.success) {
        // Short delay to allow state to update
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (err) {
      console.error('[AdminCheck] Login error:', err);
      setLoginResult({
        success: false,
        message: err.message || 'Login failed due to an error'
      });
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Admin Permissions Check</h1>
      
      <div style={{ margin: '20px 0', padding: '20px', border: '1px solid #ccc', borderRadius: '5px' }}>
        <h2>User Information</h2>
        <pre style={{ background: '#f4f4f4', padding: '10px', borderRadius: '5px', overflow: 'auto' }}>
          {JSON.stringify(user, null, 2)}
        </pre>
      </div>
      
      <div style={{ margin: '20px 0', padding: '20px', border: '1px solid #ccc', borderRadius: '5px' }}>
        <h2>Admin Status</h2>
        <p><strong>Is Admin:</strong> {isAdmin ? '✅ YES' : '❌ NO'}</p>
        <p><strong>Role:</strong> {user?.Role || 'Not set'}</p>
        <p><strong>clname:</strong> {user?.clname || 'Not set'}</p>
        
        <button 
          onClick={checkAdminBackend} 
          disabled={loading}
          style={{
            padding: '10px 15px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'wait' : 'pointer',
            marginTop: '10px'
          }}
        >
          {loading ? 'Checking...' : 'Test Backend Admin Permissions'}
        </button>
        
        {error && (
          <div style={{ color: 'red', marginTop: '10px', padding: '10px', background: '#ffeeee', borderRadius: '4px' }}>
            <strong>Error:</strong> {error}
          </div>
        )}
        
        {checkResult && (
          <div style={{ marginTop: '15px' }}>
            <h3>Backend Check Result:</h3>
            <div style={{ 
              background: checkResult.isAdmin ? '#e6ffe6' : '#ffeeee', 
              padding: '10px', 
              borderRadius: '5px' 
            }}>
              <p><strong>Admin Access:</strong> {checkResult.isAdmin ? '✅ YES' : '❌ NO'}</p>
              <p><strong>Message:</strong> {checkResult.message}</p>
              <h4>User Details from Token:</h4>
              <pre style={{ background: '#f4f4f4', padding: '10px', borderRadius: '4px' }}>
                {JSON.stringify(checkResult.userDetails, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
      
      <div style={{ margin: '20px 0', padding: '20px', border: '1px solid #ccc', borderRadius: '5px' }}>
        <h2>RGA Hierarchy Endpoint Test</h2>
        <p>Test the <code>/admin/getAllRGAsHierarchy</code> endpoint that is causing 401 errors</p>
        
        <button 
          onClick={testHierarchyEndpoint} 
          disabled={hierarchyLoading}
          style={{
            padding: '10px 15px',
            background: '#4285f4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: hierarchyLoading ? 'wait' : 'pointer',
            marginTop: '10px'
          }}
        >
          {hierarchyLoading ? 'Testing...' : 'Test Hierarchy Endpoint'}
        </button>
        
        {hierarchyError && (
          <div style={{ color: 'red', marginTop: '10px', padding: '10px', background: '#ffeeee', borderRadius: '4px' }}>
            <strong>Error:</strong> {hierarchyError}
          </div>
        )}
        
        {hierarchyTest && (
          <div style={{ marginTop: '15px' }}>
            <h3>Hierarchy Endpoint Test Result:</h3>
            <div style={{ 
              background: hierarchyTest.success ? '#e6ffe6' : '#ffeeee', 
              padding: '10px', 
              borderRadius: '5px' 
            }}>
              <p><strong>Success:</strong> {hierarchyTest.success ? '✅ YES' : '❌ NO'}</p>
              {hierarchyTest.success ? (
                <p><strong>RGA Count:</strong> {hierarchyTest.rgaCount}</p>
              ) : (
                <>
                  <p><strong>Status:</strong> {hierarchyTest.status}</p>
                  <p><strong>Status Text:</strong> {hierarchyTest.statusText}</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div style={{ margin: '20px 0', padding: '20px', border: '1px solid #ccc', borderRadius: '5px' }}>
        <h2>Refresh Authentication Token</h2>
        <p>If you're experiencing authentication issues, you can refresh your token by logging in again.</p>
        
        <form onSubmit={handleLoginSubmit} style={{ marginTop: '15px' }}>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Username:</label>
            <input
              type="text"
              name="username"
              value={loginData.username}
              onChange={handleLoginChange}
              style={{ padding: '8px', width: '100%', maxWidth: '300px', borderRadius: '4px', border: '1px solid #ccc' }}
              required
            />
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Password:</label>
            <input
              type="password"
              name="password"
              value={loginData.password}
              onChange={handleLoginChange}
              style={{ padding: '8px', width: '100%', maxWidth: '300px', borderRadius: '4px', border: '1px solid #ccc' }}
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loginLoading}
            style={{
              padding: '10px 15px',
              background: '#ff9900',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loginLoading ? 'wait' : 'pointer'
            }}
          >
            {loginLoading ? 'Logging in...' : 'Refresh Token'}
          </button>
        </form>
        
        {loginResult && (
          <div style={{ 
            marginTop: '15px',
            padding: '10px', 
            borderRadius: '4px',
            background: loginResult.success ? '#e6ffe6' : '#ffeeee',
            color: loginResult.success ? 'green' : 'red'
          }}>
            <p>{loginResult.message}</p>
            {loginResult.success && <p>Page will reload shortly...</p>}
          </div>
        )}
      </div>
      
      <div style={{ margin: '20px 0', padding: '20px', border: '1px solid #ccc', borderRadius: '5px' }}>
        <h2>Other Permissions</h2>
        <p><strong>view_dashboard:</strong> {hasPermission('view_dashboard') ? '✅ YES' : '❌ NO'}</p>
        <p><strong>view_refs:</strong> {hasPermission('view_refs') ? '✅ YES' : '❌ NO'}</p>
        <p><strong>edit_team:</strong> {hasPermission('edit_team') ? '✅ YES' : '❌ NO'}</p>
      </div>
      
      <div style={{ margin: '20px 0', padding: '20px', border: '1px solid #ccc', borderRadius: '5px' }}>
        <h2>Browser Storage</h2>
        <button
          onClick={() => {
            const token = localStorage.getItem('auth_token');
            setCheckResult({
              localStorageToken: token ? `${token.substring(0, 20)}...` : 'No token found'
            });
          }}
          style={{
            padding: '10px 15px',
            background: '#757575',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          Check localStorage Token
        </button>
      </div>
    </div>
  );
};

export default AdminCheck;