import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { FiUser, FiSearch, FiX } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { useUserHierarchy } from "../../hooks/useUserHierarchy";
import api from "../../api";
import "./AgentLookup.css";

const ROLE_FILTERS = ['AGT', 'SA', 'GA', 'MGA', 'RGA'];
const MAX_DISPLAY = 100;

// Format name from "LAST, FIRST MIDDLE" to "First Last"
const formatName = (lagnname) => {
  if (!lagnname) return '';
  const parts = lagnname.split(',').map(p => p.trim());
  if (parts.length < 2) return lagnname;
  const last = parts[0];
  const first = (parts[1] || '').split(/\s+/)[0] || '';
  return `${first} ${last}`;
};

const AgentLookup = ({ onSelectAgent, selectedAgent, onClearAgent }) => {
  const { user, hasPermission, isImpersonating } = useAuth();
  const { hierarchyData, hierarchyLoading } = useUserHierarchy();
  const [isOpen, setIsOpen] = useState(false);
  const [adminAgents, setAdminAgents] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const chipRef = useRef(null);
  const adminLoadedRef = useRef(false);

  // When impersonating, use the impersonated user's hierarchy instead of admin list
  const isAdmin = hasPermission('admin') && !isImpersonating;

  // Determine what to show on the chip
  const chipName = selectedAgent
    ? formatName(selectedAgent.lagnname)
    : formatName(user?.lagnname || user?.name || '');
  const chipRole = selectedAgent?.clname || user?.clname || '';
  const chipPic = selectedAgent?.profpic || user?.profpic || '';
  const hasSelection = !!selectedAgent;

  // For admins: load all agents via admin endpoint (on first open)
  const loadAdminAgents = useCallback(async () => {
    if (adminLoadedRef.current) return;
    setAdminLoading(true);
    try {
      const res = await api.get('/admin/getUsersForImpersonation');
      const data = res.data?.users || [];
      setAdminAgents(Array.isArray(data) ? data : []);
      adminLoadedRef.current = true;
    } catch (err) {
      console.debug('Failed to load agents for lookup:', err);
    } finally {
      setAdminLoading(false);
    }
  }, []);

  // Build agent list: admins use admin endpoint, others use hierarchy hook
  const agents = useMemo(() => {
    if (isAdmin) return adminAgents;
    if (!hierarchyData?.raw) return [];
    return hierarchyData.raw;
  }, [isAdmin, adminAgents, hierarchyData]);

  const loading = isAdmin ? adminLoading : hierarchyLoading;

  const handleOpen = () => {
    setIsOpen(true);
    setSearch('');
    setRoleFilter('');
    setHighlightIndex(-1);
    if (isAdmin) loadAdminAgents();
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filtered = agents.filter(a => {
    const name = (a.lagnname || a.name || '').toLowerCase();
    const matchesSearch = !search || name.includes(search.toLowerCase());
    const matchesRole = !roleFilter || (a.clname || '').toUpperCase() === roleFilter;
    return matchesSearch && matchesRole;
  });

  const displayed = search || roleFilter ? filtered : filtered.slice(0, MAX_DISPLAY);
  const hasMore = !search && !roleFilter && filtered.length > MAX_DISPLAY;

  const handleSelect = (agent) => {
    onSelectAgent({
      __isAgentProfile: true,
      id: agent.id,
      lagnname: agent.lagnname || agent.name,
      clname: agent.clname,
      profpic: agent.profpic,
      esid: agent.esid,
      sa: agent.sa,
      ga: agent.ga,
      mga: agent.mga,
      rga: agent.rga,
      managerActive: agent.managerActive || agent.Active || 'y',
    });
    handleClose();
  };

  const handleChipAction = (e) => {
    e.stopPropagation();
    if (hasSelection) {
      onClearAgent();
    } else {
      handleOpen();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => Math.min(prev + 1, displayed.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightIndex >= 0 && highlightIndex < displayed.length) {
      e.preventDefault();
      handleSelect(displayed[highlightIndex]);
    } else if (e.key === 'Escape') {
      handleClose();
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIndex];
      if (item) item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  // Reset highlight when search/filter changes
  useEffect(() => {
    setHighlightIndex(-1);
  }, [search, roleFilter]);

  return (
    <>
      <div
        ref={chipRef}
        className={`agent-lookup-chip ${hasSelection ? 'has-selection' : ''}`}
        onClick={handleOpen}
        title={hasSelection ? chipName : 'Search Agents'}
      >
        <div className="agent-lookup-chip-pic">
          {chipPic ? (
            <img src={chipPic} alt="" />
          ) : (
            <FiUser size={14} />
          )}
        </div>
        <span className="agent-lookup-chip-name">{chipName}</span>
        <span className="agent-lookup-chip-role">{chipRole}</span>
        <button
          className="agent-lookup-chip-action"
          onClick={handleChipAction}
          title={hasSelection ? 'Clear selection' : 'Search agents'}
        >
          {hasSelection ? <FiX size={14} /> : <FiSearch size={14} />}
        </button>
      </div>

      {isOpen && createPortal(
        <div className="agent-lookup-backdrop" onClick={handleClose}>
          <div
            className="agent-lookup-dropdown"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            <div className="agent-lookup-search">
              <FiSearch className="agent-lookup-search-icon" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search agents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="agent-lookup-input"
              />
            </div>

            <div className="agent-lookup-filters">
              <button
                className={`agent-lookup-filter-pill ${!roleFilter ? 'active' : ''}`}
                onClick={() => setRoleFilter('')}
              >
                All
              </button>
              {ROLE_FILTERS.map(role => (
                <button
                  key={role}
                  className={`agent-lookup-filter-pill ${roleFilter === role ? 'active' : ''}`}
                  onClick={() => setRoleFilter(roleFilter === role ? '' : role)}
                >
                  {role}
                </button>
              ))}
            </div>

            <div className="agent-lookup-list" ref={listRef}>
              {loading && (
                <div className="agent-lookup-empty">Loading agents...</div>
              )}
              {!loading && displayed.length === 0 && (
                <div className="agent-lookup-empty">
                  {search || roleFilter ? 'No agents match your search' : 'No agents available'}
                </div>
              )}
              {!loading && displayed.map((agent, idx) => (
                <div
                  key={agent.id || idx}
                  className={`agent-lookup-item ${highlightIndex === idx ? 'highlighted' : ''}`}
                  onClick={() => handleSelect(agent)}
                  onMouseEnter={() => setHighlightIndex(idx)}
                >
                  <div className="agent-lookup-item-pic">
                    {agent.profpic ? (
                      <img src={agent.profpic} alt="" />
                    ) : (
                      <FiUser size={16} />
                    )}
                  </div>
                  <div className="agent-lookup-item-info">
                    <span className="agent-lookup-item-name">
                      {formatName(agent.lagnname || agent.name)}
                    </span>
                    <span className="agent-lookup-item-role">{agent.clname}</span>
                  </div>
                </div>
              ))}
              {hasMore && (
                <div className="agent-lookup-hint">
                  Showing first {MAX_DISPLAY} of {filtered.length} — search to find more
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default AgentLookup;
