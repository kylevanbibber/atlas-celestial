import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './SGAPermissions.css';

// Define all available pages in the application
const AVAILABLE_PAGES = [
  // Production
  { key: 'production', name: 'Production', path: '/production', category: 'Production' },
  { key: 'production_overview', name: 'Production Overview', path: '/production-overview', category: 'Production' },
  { key: 'reports', name: 'Reports', path: '/reports', category: 'Production' },
  { key: 'scorecard', name: 'Scorecard', path: '/scorecard', category: 'Production' },
  
  // Recruiting
  { key: 'recruiting', name: 'Recruiting', path: '/recruiting', category: 'Recruiting' },
  { key: 'recruiting_overview', name: 'Recruiting Overview', path: '/recruiting-overview', category: 'Recruiting' },
  
  // Training & Resources
  { key: 'training', name: 'Training', path: '/training', category: 'Training' },
  { key: 'resources', name: 'Resources', path: '/resources-overview', category: 'Training' },
  
  // Tools & Utilities
  { key: 'utilities', name: 'Utilities', path: '/utilities', category: 'Tools' },
  { key: 'one_on_one', name: 'One on One', path: '/one-on-one', category: 'Tools' },
  { key: 'refs', name: 'Refs', path: '/refs', category: 'Tools' },
  
  // Admin
  { key: 'admin_notifications', name: 'Admin Notifications', path: '/admin/notifications', category: 'Admin' },
  { key: 'admin_email_campaigns', name: 'Email Campaigns', path: '/admin/email-campaigns', category: 'Admin' },
  { key: 'admin_hierarchy', name: 'Hierarchy Settings', path: '/admin/hierarchy-settings', category: 'Admin' },
  { key: 'admin_analytics', name: 'Analytics Dashboard', path: '/admin/analytics', category: 'Admin' },
  { key: 'team_customization', name: 'Team Customization', path: '/utilities/team-customization', category: 'Admin' },
];

const SGAPermissions = () => {
  const [sgas, setSgas] = useState([]);
  const [selectedSGA, setSelectedSGA] = useState(null);
  const [selectedPages, setSelectedPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchSGAs();
  }, []);

  useEffect(() => {
    if (selectedSGA) {
      fetchPermissions(selectedSGA.id);
    }
  }, [selectedSGA]);

  const fetchSGAs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/sgas');

      if (response.data.success) {
        setSgas(response.data.data || []);
        if (response.data.data && response.data.data.length > 0) {
          setSelectedSGA(response.data.data[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching SGAs:', error);
      setMessage({ type: 'error', text: 'Failed to load agencies' });
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async (sgaId) => {
    try {
      const response = await api.get(`/sgas/${sgaId}/permissions`);
      if (response.data.success) {
        setSelectedPages(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setMessage({ type: 'error', text: 'Failed to load permissions' });
    }
  };

  const handleTogglePage = (pageKey) => {
    setSelectedPages(prev => {
      if (prev.includes(pageKey)) {
        return prev.filter(key => key !== pageKey);
      } else {
        return [...prev, pageKey];
      }
    });
  };

  const handleSave = async () => {
    if (!selectedSGA) return;

    try {
      setSaving(true);
      const response = await api.put(`/sgas/${selectedSGA.id}/permissions`, {
        page_keys: selectedPages
      });

      if (response.data.success) {
        setMessage({ type: 'success', text: 'Permissions saved successfully!' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      }
    } catch (error) {
      console.error('Error saving permissions:', error);
      setMessage({ type: 'error', text: 'Failed to save permissions' });
    } finally {
      setSaving(false);
    }
  };

  const groupByCategory = (pages) => {
    const grouped = {};
    pages.forEach(page => {
      const category = page.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(page);
    });
    return grouped;
  };

  if (loading) {
    return <div className="sga-permissions-loading">Loading...</div>;
  }

  const groupedPages = groupByCategory(AVAILABLE_PAGES);
  const categories = Object.keys(groupedPages).sort();

  return (
    <div className="sga-permissions-container">
      <h1>SGA Page Permissions</h1>
      <p className="sga-permissions-description">
        Configure which pages each agency can access. If a page is not checked, users of that agency won't see it.
      </p>

      {message.text && (
        <div className={`sga-permissions-message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="sga-permissions-layout">
        {/* SGA Selector */}
        <div className="sga-selector-panel">
          <h3>Select Agency</h3>
          <div className="sga-list">
            {sgas.map(sga => (
              <div
                key={sga.id}
                className={`sga-list-item ${selectedSGA?.id === sga.id ? 'active' : ''}`}
                onClick={() => setSelectedSGA(sga)}
              >
                <div className="sga-name">{sga.display_name || sga.rept_name}</div>
                {sga.is_default === 1 && <span className="sga-badge">Default</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Permissions Editor */}
        <div className="permissions-editor-panel">
          {selectedSGA && (
            <>
              <div className="permissions-header">
                <h3>Page Access for {selectedSGA.display_name || selectedSGA.rept_name}</h3>
                <div className="permissions-header-actions">
                  <span className="selected-count">{selectedPages.length} of {AVAILABLE_PAGES.length} pages selected</span>
                  <button
                    className="btn-save-permissions"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>

              <div className="permissions-grid">
                {categories.map(category => (
                  <div key={category} className="permissions-category">
                    <h4 className="category-header">{category}</h4>
                    <div className="permissions-list">
                      {groupedPages[category].map(page => (
                        <div
                          key={page.key}
                          className="permission-item"
                        >
                          <label className="permission-label">
                            <input
                              type="checkbox"
                              checked={selectedPages.includes(page.key)}
                              onChange={() => handleTogglePage(page.key)}
                            />
                            <div className="permission-info">
                              <div className="permission-name">{page.name}</div>
                              <div className="permission-path">{page.path}</div>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SGAPermissions;

