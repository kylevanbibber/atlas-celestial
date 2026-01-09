import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import '../../pages/utilities/Utilities.css';
import '../production/ProductionReports.css';
import { FiPlus, FiEdit3, FiCalendar, FiUser, FiMessageSquare, FiSearch } from 'react-icons/fi';
import api from '../../api';
import './Updates.css';
import getSidebarNavItems from '../../context/sidebarNavItems';

const Updates = () => {
  const { user } = useAuth();
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showComposer, setShowComposer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState(null);
  const [newUpdate, setNewUpdate] = useState({
    title: '',
    content: '',
    type: 'update', // 'update', 'bugfix', 'feature'
    priority: 'normal', // 'low', 'normal', 'high'
    tutorialUrl: '',
    pageUrl: '',
    targetDevice: '',
    images: [] // [{url, deleteHash, caption, sortOrder}]
  });
  const [releases, setReleases] = useState([]);
  const [selectedReleaseId, setSelectedReleaseId] = useState('');
  const [newRelease, setNewRelease] = useState({ version: '', title: '', notes: '' });
  const [pageLinkOptions, setPageLinkOptions] = useState([
    { label: 'None', value: '' },
    { label: 'Custom…', value: '__custom' }
  ]);
  const [useCustomPageUrl, setUseCustomPageUrl] = useState(false);
  const [showReleaseComposer, setShowReleaseComposer] = useState(false);
  const [imagePreview, setImagePreview] = useState({ open: false, url: '', caption: '' });
  const [collapsedReleases, setCollapsedReleases] = useState({});

  const toggleRelease = (releaseId) => {
    setCollapsedReleases(prev => ({ ...prev, [releaseId]: !prev[releaseId] }));
  };

  // Dynamically compute page link options from current nav + sections
  useEffect(() => {
    try {
      const isAdmin = user?.Role === 'Admin';
      const teamRole = user?.teamRole || null;
      const userId = user?.userId || null;
      const userLagnname = user?.lagnname || null;
      const userClname = user?.clname || null;
      const navItems = getSidebarNavItems(false, isAdmin, 0, teamRole, userId, userLagnname, userClname) || [];

      const topLevel = navItems.flatMap(item => {
        const items = [{ label: item.name, value: item.path }];
        if (item.submenu && Array.isArray(item.submenu)) {
          items.push(...item.submenu.map(sub => ({ label: `${item.name} - ${sub.name}`, value: sub.path })));
        }
        return items;
      });

      // Production sections (mirror Production.js)
      const hideDailyActivity = isAdmin && teamRole === 'app';
      const isSGANonAdmin = String(user?.clname || '').toUpperCase() === 'SGA' && user?.Role !== 'Admin';
      const shouldHideDailyActivity = hideDailyActivity || isSGANonAdmin;
      const shouldHideGoals = teamRole === 'app' || isSGANonAdmin;
      const shouldHideVerification = isSGANonAdmin;
      
      // Build sections array based on permissions
      const prodSections = [];
      if (!shouldHideDailyActivity) prodSections.push('daily-activity');
      if (!shouldHideGoals) prodSections.push('goals');
      prodSections.push('leaderboard');
      prodSections.push('scorecard');
      if (!shouldHideVerification) prodSections.push('verification');
      if (hideDailyActivity) prodSections.push('release');
      prodSections.push('vips');
      const prodOptions = prodSections.map(sec => ({
        label: `Production - ${
          sec === 'daily-activity' ? 'Daily Activity' :
          sec === 'goals' ? 'Goals' :
          sec === 'vips' ? 'Codes & VIPs' :
          sec.charAt(0).toUpperCase() + sec.slice(1)
        }`,
        value: `/production?section=${sec}`
      }));

      // Resources - Release
      const releaseOption = [
        { label: 'Resources - Release', value: '/resources?active=release' }
      ];

      // Resources
      const resourcesOptions = [{ label: 'Resources', value: '/resources' }];

      // Dashboard
      const dashboardOption = [{ label: 'Dashboard', value: '/dashboard' }];

      // Merge, dedupe by value
      const merged = [
        ...dashboardOption,
        ...resourcesOptions,
        ...prodOptions,
        ...releaseOption,
        ...topLevel
      ];
      const seen = new Set();
      const deduped = merged.filter(opt => {
        if (!opt.value) return false;
        if (seen.has(opt.value)) return false;
        seen.add(opt.value);
        return true;
      }).sort((a, b) => a.label.localeCompare(b.label));

      setPageLinkOptions([
        { label: 'None', value: '' },
        ...deduped,
        { label: 'Custom…', value: '__custom' }
      ]);
    } catch (e) {
      // Fallback stays as minimal
    }
  }, [user]);

  // Fetch releases on mount and when composer opens (to keep fresh)
  useEffect(() => {
    let isCancelled = false;
    (async () => {
      try {
        const res = await api.get('/training/releases');
        if (!isCancelled && res.data?.success) setReleases(res.data.data || []);
      } catch (e) {
        if (!isCancelled) console.error('Failed to load releases', e);
      }
    })();
    return () => { isCancelled = true; };
  }, [showReleaseComposer]);

  // Check if user can manage updates (admin/app team)
  const canManageUpdates = user?.Role === 'Admin' || user?.teamRole === 'app';

  useEffect(() => {
    fetchUpdates();
  }, []);

  const fetchUpdates = async () => {
    try {
      setLoading(true);
      setError(null);
      const [updatesRes, releasesRes] = await Promise.all([
        api.get('/training/updates'),
        api.get('/training/releases')
      ]);

      if (!updatesRes.data?.success) {
        throw new Error('Failed to fetch updates');
      }

      const updatesData = updatesRes.data.data || [];

      // Keep releases in state
      if (releasesRes.data?.success) {
        setReleases(releasesRes.data.data || []);
      }

      // Filter by device
      const isMobile = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
      const filtered = updatesData.filter(item => {
        if (!item.targetDevice) return true;
        if (item.targetDevice === 'mobile') return isMobile;
        if (item.targetDevice === 'desktop') return !isMobile;
        return true;
      });

      // Sort by createdAt desc
      const sorted = filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setUpdates(sorted);
    } catch (err) {
      console.error('Error fetching updates:', err);
      setError('Error loading updates');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchQuery(term);
    setIsSearching(term.trim().length > 0);
  };

  const filteredUpdates = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return updates;
    return updates.filter((u) => {
      const title = (u.title || '').toLowerCase();
      const content = (u.content || '').toLowerCase();
      const type = (u.type || '').toLowerCase();
      const priority = (u.priority || '').toLowerCase();
      const author = (u.authorName || '').toLowerCase();
      return (
        title.includes(q) ||
        content.includes(q) ||
        type.includes(q) ||
        priority.includes(q) ||
        author.includes(q)
      );
    });
  }, [updates, searchQuery]);

  const handleCreateUpdate = () => {
    setEditingUpdate(null);
    setNewUpdate({
      title: '',
      content: '',
      type: 'update',
      priority: 'normal',
      tutorialUrl: '',
      pageUrl: '',
      targetDevice: '',
      images: []
    });
    setSelectedReleaseId('');
    setNewRelease({ version: '', title: '', notes: '' });
    setUseCustomPageUrl(false);
    setShowComposer(true);
  };

  const handleEditUpdate = (update) => {
    setEditingUpdate(update);
    setNewUpdate({
      title: update.title,
      content: update.content,
      type: update.type,
      priority: update.priority,
      tutorialUrl: update.tutorialUrl || '',
      pageUrl: update.pageUrl || '',
      targetDevice: update.targetDevice || '',
      images: Array.isArray(update.images) ? [...update.images] : []
    });
    setShowComposer(true);
  };

  const handleSaveUpdate = async () => {
    try {
      if (!newUpdate.title.trim() || !newUpdate.content.trim()) {
        alert('Please fill in all required fields');
        return;
      }

      const updateData = {
        ...newUpdate,
        title: newUpdate.title.trim(),
        content: newUpdate.content.trim(),
        releaseId: selectedReleaseId || null,
        // Only include version if we're creating a new release (when version is provided)
        version: selectedReleaseId ? null : (newRelease.version?.trim() || null)
      };

      // Clean up empty string values to null for better backend handling
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === '') {
          updateData[key] = null;
        }
      });

      if (editingUpdate) {
        // Update existing
        await api.put(`/training/updates/${editingUpdate.id}`, updateData);
      } else {
        // Create new
        const createRes = await api.post('/training/updates', updateData);
        const newId = createRes?.data?.data?.id;
        if (newId && newUpdate.images?.length) {
          await api.post(`/training/updates/${newId}/images`, { images: newUpdate.images });
        }
      }

      setShowComposer(false);
      fetchUpdates();
    } catch (err) {
      console.error('Error saving update:', err);
      alert('Error saving update');
    }
  };

  const handleCreateRelease = async () => {
    try {
      const payload = {
        version: newRelease.version || null,
        title: newRelease.title || null,
        notes: newRelease.notes || null,
      };
      const res = await api.post('/training/releases', payload);
      const id = res?.data?.data?.id;
      if (id) {
        // Refresh releases and select the newly created one
        try {
          const list = await api.get('/training/releases');
          if (list.data?.success) setReleases(list.data.data || []);
        } catch (e) {
          // non-fatal
        }
        setSelectedReleaseId(String(id));
        setShowReleaseComposer(false);
      }
    } catch (e) {
      console.error('Failed to create release', e);
      alert('Failed to create release');
    }
  };

  const handleDeleteUpdate = async (updateId) => {
    if (!window.confirm('Are you sure you want to delete this update?')) {
      return;
    }

    try {
      await api.delete(`/training/updates/${updateId}`);
      fetchUpdates();
    } catch (err) {
      console.error('Error deleting update:', err);
      alert('Error deleting update');
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'release':
        return <FiCalendar className="update-type-icon" />;
      case 'bugfix':
        return <FiEdit3 className="update-type-icon bugfix" />;
      case 'feature':
        return <FiPlus className="update-type-icon feature" />;
      default:
        return <FiMessageSquare className="update-type-icon update" />;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'release':
        return 'Release';
      case 'bugfix':
        return 'Bug Fix';
      case 'feature':
        return 'New Feature';
      default:
        return 'Update';
    }
  };

  const getPriorityClass = (priority) => {
    return `priority-${priority}`;
  };

  const getPriorityLabel = (priority) => {
    switch ((priority || '').toLowerCase()) {
      case 'low':
        return 'Small';
      case 'high':
        return 'Large';
      case 'normal':
      default:
        return 'Medium';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toTitle = (text) => {
    if (!text) return '';
    return text
      .replace(/[\-_]/g, ' ')
      .replace(/\b\w/g, (m) => m.toUpperCase());
  };

  const getPageLabel = (pageUrl) => {
    if (!pageUrl) return 'Related Page';
    try {
      const u = new URL(pageUrl, window.location.origin);
      const pathname = u.pathname || '/';
      const params = new URLSearchParams(u.search || '');
      const section = params.get('section');

      if (pathname === '/production') {
        if (section) {
          const map = {
            'daily-activity': 'Daily Activity',
            'scorecard': 'Scorecard',
            'leaderboard': 'Leaderboard',
            'verification': 'Verification',
            'vips': 'Codes & VIPs',
            'release': 'Release'
          };
          const secLabel = map[section] || toTitle(section);
          return `Production - ${secLabel}`;
        }
        return 'Production';
      }
      if (pathname === '/resources') return 'Resources';
      if (pathname === '/dashboard') return 'Dashboard';

      // Fallback to last path segment title-cased
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length > 0) return toTitle(parts[parts.length - 1]);
      return 'Related Page';
    } catch (_) {
      return 'Related Page';
    }
  };

  if (loading) {
    return (
      <div className="updates-container">
        <div className="updates-loading">
          <div className="loading-spinner"></div>
          <p>Loading updates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="updates-container">
        <div className="updates-error">
          <p>{error}</p>
          <button onClick={fetchUpdates} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="updates-container">
      {/* Header */}
      <div className="settings-header" style={{ marginBottom: '12px' }}>
        <h1 className="settings-section-title">Updates</h1>
        {user?.Role === 'Admin' && (
          <div>
            <button
              className="settings-icon-button"
              onClick={() => setShowReleaseComposer(v => !v)}
              aria-label="Create new release"
              title="Create new release"
              style={{ marginRight: 8 }}
            >
              <FiPlus /> Release
            </button>
            <button
              className="settings-icon-button"
              onClick={handleCreateUpdate}
              aria-label="Create new update"
              title="Create new update"
            >
              <FiPlus /> Update
            </button>
          </div>
        )}
      </div>
      {/* Search Bar */}
      <div className="reports-search" style={{ marginBottom: '12px' }}>
        <div className="search-input-wrapper">
          <FiSearch className={`search-icon ${isSearching ? 'searching' : ''}`} />
          <input
            type="text"
            placeholder="Search updates by title, content, type, priority, or author..."
            value={searchQuery}
            onChange={handleSearchChange}
            className={`search-input ${isSearching ? 'searching' : ''}`}
          />
          {isSearching && (
            <div className="search-status">
              Searching...
            </div>
          )}
        </div>
      </div>

      {/* Removed ActionBar to use header + plus pattern like LicenseSettings */}

      {/* Release Composer + Update Composer + Updates Thread */}
      {user?.Role === 'Admin' && showReleaseComposer && (
        <div className={`update-post low`}>
          <div className="update-header">
            <div className="update-meta">
              <span className="update-type">New Release</span>
              <span className="update-priority">draft</span>
            </div>
          </div>
          <div className="update-content">
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label>Version</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., 2025.08.15"
                  value={newRelease.version}
                  onChange={(e) => setNewRelease({ ...newRelease, version: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Title</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Release summary"
                  value={newRelease.title}
                  onChange={(e) => setNewRelease({ ...newRelease, title: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea
                className="form-textarea"
                placeholder="High-level summary for the release"
                rows={3}
                value={newRelease.notes}
                onChange={(e) => setNewRelease({ ...newRelease, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="update-footer" style={{ justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => setShowReleaseComposer(false)} style={{ marginRight: 8 }}>Cancel</button>
            <button className="btn-primary" onClick={handleCreateRelease}>Create Release</button>
          </div>
        </div>
      )}
      <div className="updates-thread">
        {user?.Role === 'Admin' && showComposer && (
          <div className={`update-post ${getPriorityClass(newUpdate.priority)}`}>
            <div className="update-header">
              <div className="update-meta">
                {getTypeIcon(newUpdate.type)}
                <span className="update-type">{getTypeLabel(newUpdate.type)}</span>
                <span className="update-priority">{getPriorityLabel(newUpdate.priority)}</span>
                    {selectedReleaseId && (
                      <span className="update-priority" style={{ marginLeft: 6 }}>
                        {(() => {
                          const sel = releases.find(r => String(r.id) === String(selectedReleaseId));
                          const label = sel?.version || sel?.title || `Release ${selectedReleaseId}`;
                          return `Release${label ? `: ${label}` : ''}`;
                        })()}
                      </span>
                    )}
              </div>
              <div className="update-actions">
                <span className="update-date">
                  <FiCalendar size={14} />
                  {formatDate(new Date())}
                </span>
              </div>
            </div>
            <div className="update-content">
              <input
                type="text"
                className="form-input"
                placeholder="Title"
                value={newUpdate.title}
                onChange={(e) => setNewUpdate({ ...newUpdate, title: e.target.value })}
                style={{ marginBottom: '8px' }}
              />
              <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Release (Optional)</label>
              <select
                className="form-select"
                value={selectedReleaseId}
                onChange={(e) => setSelectedReleaseId(e.target.value)}
              >
                <option value="">(Standalone update - no release)</option>
                {releases.map(r => (
                  <option key={r.id} value={r.id}>{r.version || r.title || `Release ${r.id}`}</option>
                ))}
              </select>
            </div>
          </div>
          {!selectedReleaseId && (
            <div style={{ 
              background: 'var(--sidebar-hover)', 
              padding: '12px', 
              borderRadius: '6px', 
              marginBottom: '12px',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ 
                fontSize: '0.9rem', 
                color: 'var(--text-secondary)', 
                marginBottom: '8px',
                fontWeight: '500'
              }}>
                📦 Create New Release (Optional)
              </div>
              <div style={{ 
                fontSize: '0.8rem', 
                color: 'var(--text-secondary)', 
                marginBottom: '12px'
              }}>
                Leave these fields empty to create a standalone update without a release.
              </div>
              <div className="form-group">
                <label>Release Version (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., 2025.08.15 (leave empty for standalone update)"
                  value={newRelease.version}
                  onChange={(e) => setNewRelease({ ...newRelease, version: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Release Title (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Release summary"
                  value={newRelease.title}
                  onChange={(e) => setNewRelease({ ...newRelease, title: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Release Notes (optional)</label>
                <textarea
                  className="form-textarea"
                  placeholder="High-level summary for the release"
                  rows={3}
                  value={newRelease.notes}
                  onChange={(e) => setNewRelease({ ...newRelease, notes: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="composer-type">Type</label>
                  <select
                    id="composer-type"
                    value={newUpdate.type}
                    onChange={(e) => setNewUpdate({ ...newUpdate, type: e.target.value })}
                    className="form-select"
                  >
                    <option value="update">General Update</option>
                    <option value="feature">New Feature</option>
                    <option value="bugfix">Bug Fix</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="composer-priority">Priority</label>
                  <select
                    id="composer-priority"
                    value={newUpdate.priority}
                    onChange={(e) => setNewUpdate({ ...newUpdate, priority: e.target.value })}
                    className="form-select"
                  >
                    <option value="low">Small</option>
                    <option value="normal">Medium</option>
                    <option value="high">Large</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="composer-device">Target Device</label>
                  <select
                    id="composer-device"
                    value={newUpdate.targetDevice}
                    onChange={(e) => setNewUpdate({ ...newUpdate, targetDevice: e.target.value })}
                    className="form-select"
                  >
                    <option value="">All</option>
                    <option value="mobile">Mobile</option>
                    <option value="desktop">Desktop</option>
                  </select>
                </div>
              </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="composer-tutorial">Tutorial Link</label>
              <input
                id="composer-tutorial"
                type="url"
                className="form-input"
                placeholder="https://tutorial-link.example"
                value={newUpdate.tutorialUrl}
                onChange={(e) => setNewUpdate({ ...newUpdate, tutorialUrl: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="composer-page">Page Link</label>
              <select
                id="composer-page"
                className="form-select"
                value={useCustomPageUrl ? '__custom' : (pageLinkOptions.find(opt => opt.value === newUpdate.pageUrl)?.value || '')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__custom') {
                    setUseCustomPageUrl(true);
                  } else {
                    setUseCustomPageUrl(false);
                    setNewUpdate({ ...newUpdate, pageUrl: val });
                  }
                }}
              >
                {pageLinkOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {useCustomPageUrl && (
                <input
                  type="text"
                  className="form-input"
                  placeholder="/resources or /production?section=verification"
                  value={newUpdate.pageUrl}
                  onChange={(e) => setNewUpdate({ ...newUpdate, pageUrl: e.target.value })}
                  style={{ marginTop: 6 }}
                />
              )}
            </div>
          </div>
              <textarea
                className="form-textarea"
                placeholder="Write your update..."
                value={newUpdate.content}
                onChange={(e) => setNewUpdate({ ...newUpdate, content: e.target.value })}
                rows={6}
              />
          {/* Image uploader */}
          <div className="form-group">
            <label>Images</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(newUpdate.images || []).map((img, idx) => (
                <div key={`img-prev-${idx}`} className="update-image-thumb" style={{ position: 'relative' }}>
                  <img
                    src={img.url}
                    alt={img.caption || ''}
                    style={{ maxWidth: 140, borderRadius: 6, border: '1px solid var(--border-color)', cursor: 'zoom-in' }}
                    onClick={() => setImagePreview({ open: true, url: img.url, caption: img.caption || '' })}
                  />
                  <button className="update-action-btn delete" style={{ position: 'absolute', top: 4, right: 4 }} onClick={async () => {
                    try {
                      if (editingUpdate && img.id) {
                        await api.delete(`/training/updates/${editingUpdate.id}/images/${img.id}`);
                      }
                    } catch (e) {}
                    setNewUpdate({ ...newUpdate, images: (newUpdate.images || []).filter((_, i) => i !== idx) });
                  }}>×</button>
                </div>
              ))}
              <label className="settings-icon-button" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const formData = new FormData();
                  formData.append('image', file);
                  try {
                    const res = await api.post('/upload/imgur', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                    if (res.data?.success) {
                      const { url, deleteHash } = res.data.data;
                      const newImg = { url, deleteHash, caption: '', sortOrder: newUpdate.images.length };
                      if (editingUpdate && editingUpdate.id) {
                        try {
                          await api.post(`/training/updates/${editingUpdate.id}/images`, { images: [newImg] });
                          const imgsRes = await api.get(`/training/updates/${editingUpdate.id}/images`);
                          if (imgsRes.data?.success) {
                            setNewUpdate({ ...newUpdate, images: imgsRes.data.data || [] });
                          } else {
                            setNewUpdate({ ...newUpdate, images: [...newUpdate.images, newImg] });
                          }
                        } catch (err) {
                          setNewUpdate({ ...newUpdate, images: [...newUpdate.images, newImg] });
                        }
                      } else {
                        setNewUpdate({ ...newUpdate, images: [...newUpdate.images, newImg] });
                      }
                    }
                  } catch (err) {
                    console.error('Image upload failed', err);
                    alert('Image upload failed');
                  } finally {
                    e.target.value = '';
                  }
                }} />
                <FiPlus /> Add Image
              </label>
            </div>
          </div>
            </div>
            <div className="update-footer" style={{ justifyContent: 'space-between' }}>
              <div className="update-author">
                <FiUser size={14} />
                <span>Posting as {user?.lagnname || user?.name || 'You'}</span>
              </div>
              <div>
                <button className="btn-secondary" onClick={() => setShowComposer(false)} style={{ marginRight: '8px' }}>Cancel</button>
                <button className="btn-primary" onClick={handleSaveUpdate}>{editingUpdate ? 'Update' : 'Post'}</button>
              </div>
            </div>
          </div>
        )}
        {filteredUpdates.length === 0 ? (
          <div className="updates-empty">
            <FiMessageSquare size={64} className="empty-icon" />
            <h3>No matching updates</h3>
            <p>Try adjusting your search.</p>
          </div>
        ) : (
          (() => {
            const releasesById = new Map((releases || []).map(r => [r.id, r]));
            const grouped = new Map();
            const orphanUpdates = [];
            filteredUpdates.forEach(u => {
              if (u.releaseId && releasesById.has(u.releaseId)) {
                if (!grouped.has(u.releaseId)) grouped.set(u.releaseId, []);
                grouped.get(u.releaseId).push(u);
              } else {
                orphanUpdates.push(u);
              }
            });

            // Create a mixed timeline of releases and standalone updates, sorted by creation date
            const timelineItems = [];

            // Add releases to timeline
            Array.from(grouped.entries()).forEach(([relId, relUpdates]) => {
              const rel = releasesById.get(relId);
              if (rel) {
                timelineItems.push({
                  type: 'release',
                  id: relId,
                  release: rel,
                  updates: relUpdates,
                  createdAt: rel.createdAt
                });
              }
            });

            // Add standalone updates to timeline
            orphanUpdates.forEach(update => {
              timelineItems.push({
                type: 'update',
                id: update.id,
                update: update,
                createdAt: update.createdAt
              });
            });

            // Sort timeline by creation date (newest first)
            timelineItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            const renderUpdateCard = (update) => (
              <div key={update.id} className={`update-post ${getPriorityClass(update.priority)}`}>
                <div className="update-header">
                  <div className="update-meta">
                    {getTypeIcon(update.type)}
                    <span className="update-type">{getTypeLabel(update.type)}</span>
                    {update.version && (
                      <span className="update-priority" style={{ marginLeft: 6 }}>v{update.version}</span>
                    )}
                    {(update.releaseId || update.releaseVersion || update.releaseTitle) && (
                      <span className="update-priority" style={{ marginLeft: 6 }}>
                        {`Release${update.releaseVersion ? `: ${update.releaseVersion}` : (update.releaseTitle ? `: ${update.releaseTitle}` : '')}`}
                      </span>
                    )}
                  </div>
                  <div className="update-actions">
                    <span className="update-date">
                      <FiCalendar size={14} />
                      {formatDate(update.createdAt)}
                    </span>
                    {canManageUpdates && update.type !== 'release' && (
                      <>
                        <button 
                          onClick={() => handleEditUpdate(update)}
                          className="update-action-btn edit"
                          title="Edit"
                        >
                          <FiEdit3 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteUpdate(update.id)}
                          className="update-action-btn delete"
                          title="Delete"
                        >
                          ×
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="update-content">
                  <h3 className="update-title">{update.title}</h3>
                  <div className="update-body">
                    {update.content.split('\n').map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                  </div>
                  {(update.tutorialUrl || update.pageUrl) && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {update.tutorialUrl && (
                        <a href={update.tutorialUrl} target="_blank" rel="noreferrer" className="settings-button settings-button-primary" style={{ padding: '6px 10px' }}>
                          Tutorial
                        </a>
                      )}
                      {update.pageUrl && (
                        <a href={update.pageUrl} target="_blank" rel="noreferrer" className="settings-button" style={{ padding: '6px 10px' }}>
                          {getPageLabel(update.pageUrl)}
                        </a>
                      )}
                    </div>
                  )}
                  {Array.isArray(update.images) && update.images.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                      {update.images.map((img, idx) => (
                        <img
                          key={`upd-img-${update.id}-${idx}`}
                          src={img.url}
                          alt={img.caption || ''}
                          style={{ maxWidth: 220, borderRadius: 8, border: '1px solid var(--border-color)', cursor: 'zoom-in' }}
                          onClick={() => setImagePreview({ open: true, url: img.url, caption: img.caption || '' })}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="update-footer" style={{ display: 'flex', alignItems: 'center' }}>
                  <div className="update-author">
                    <FiUser size={14} />
                    <span>Posted by {update.authorName || 'System'}</span>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <span className="update-priority">{getPriorityLabel(update.priority)}</span>
                  </div>
                </div>
              </div>
            );

            const renderReleaseCard = (releaseItem) => {
              const { release, updates: relUpdates, id: relId } = releaseItem;
              const headerTitle = release?.title || (release?.version ? `Release ${release.version}` : `Release ${relId}`);
              
              return (
                <div key={`rel-section-${relId}`} className="release-section">
                  {/* Release card for visual separation */}
                  <div
                    className={`update-post release-card`}
                    style={{ borderLeft: '4px solid var(--border-color)', background: 'rgba(2,132,199,0.06)', cursor: 'pointer' }}
                    onClick={() => toggleRelease(relId)}
                    role="button"
                    aria-expanded={!collapsedReleases[relId]}
                    aria-controls={`rel-children-${relId}`}
                    title={collapsedReleases[relId] ? 'Expand release' : 'Collapse release'}
                  >
                    <div className="update-header">
                      <div className="update-meta">
                        <FiCalendar className="update-type-icon" />
                        <span className="update-type">Release</span>
                        {release?.version && (
                          <span className="update-priority" style={{ marginLeft: 6 }}>v{release.version}</span>
                        )}
                        <span className="update-priority" style={{ marginLeft: 6 }}>{relUpdates.length} update{relUpdates.length === 1 ? '' : 's'}</span>
                      </div>
                      <div className="update-actions">
                        <span className="update-date">
                          <FiCalendar size={14} />
                          {formatDate(release?.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="update-content">
                      <h3 className="update-title">{headerTitle}</h3>
                      {release?.notes && (
                        <div className="update-body">
                          {String(release.notes).split('\n').slice(0, 2).map((p, i) => (
                            <p key={`rel-note-${relId}-${i}`}>{p}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Child updates under this release */}
                  {!collapsedReleases[relId] && (
                    <div id={`rel-children-${relId}`} className="release-children">
                      {relUpdates.map(renderUpdateCard)}
                    </div>
                  )}
                </div>
              );
            };

            return (
              <>
                {timelineItems.map(item => {
                  if (item.type === 'release') {
                    return renderReleaseCard(item);
                  } else {
                    return renderUpdateCard(item.update);
                  }
                })}
              </>
            );
          })()
        )}
      </div>

      {/* Modal removed. Composer is inline above the thread. */}
      {imagePreview.open && (
        <div
          className="update-image-modal-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setImagePreview({ open: false, url: '', caption: '' })}
        >
          <div
            className="update-image-modal"
            style={{ position: 'relative', background: 'var(--bg)', padding: 12, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', maxWidth: '92vw', maxHeight: '88vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <img src={imagePreview.url} alt={imagePreview.caption || ''} style={{ maxWidth: '90vw', maxHeight: '80vh', display: 'block', borderRadius: 6 }} />
            {imagePreview.caption && (
              <div style={{ marginTop: 8, color: 'var(--muted)', fontSize: 13 }}>{imagePreview.caption}</div>
            )}
            <button
              className="update-action-btn delete"
              onClick={() => setImagePreview({ open: false, url: '', caption: '' })}
              style={{ position: 'absolute', top: 8, right: 8, fontSize: 18 }}
              aria-label="Close"
              title="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Updates;
