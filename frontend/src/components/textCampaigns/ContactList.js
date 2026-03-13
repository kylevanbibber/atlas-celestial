import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../api';
import CsvUploadModal from './CsvUploadModal';
import { FiUpload, FiSearch, FiUser, FiPhone } from 'react-icons/fi';

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'sent', label: 'Sent' },
  { key: 'responded', label: 'Responded' },
  { key: 'closed', label: 'Closed' },
  { key: 'failed', label: 'Failed' },
  { key: 'opted_out', label: 'Opted Out' },
];

const ContactList = ({ campaignId, campaignName, campaignStatus, selectedContactId, selectedPhone, onSelectContact, onCampaignUpdate }) => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, sent: 0, responded: 0, closed: 0, failed: 0, opted_out: 0 });
  const debounceRef = useRef(null);

  // Debounce search input — wait 300ms after the user stops typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (activeStatus !== 'all') params.append('status', activeStatus);
      if (debouncedSearch) params.append('search', debouncedSearch);

      const response = await api.get(`/text-campaigns/${campaignId}/contacts?${params}`);
      // Filter out secondary phone rows where the phone is blank
      const rows = (response.data.data || []).filter(c =>
        c.phone_type !== 'secondary' || (c.conversation_phone && c.conversation_phone.trim())
      );
      setContacts(rows);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    } finally {
      setLoading(false);
    }
  }, [campaignId, activeStatus, debouncedSearch]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get(`/text-campaigns/${campaignId}`);
      const c = response.data.data;
      setStats({
        total: c.total_contacts || 0,
        pending: c.pending_count || 0,
        sent: c.sent_count_contacts || 0,
        responded: c.responded_count || 0,
        closed: c.closed_count || 0,
        failed: c.failed_count_contacts || 0,
        opted_out: c.opted_out_count || 0,
      });
    } catch (err) {
      console.error('Error fetching campaign stats:', err);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchContacts();
    fetchStats();
  }, [fetchContacts, fetchStats]);

  const handleUploadComplete = () => {
    setShowUpload(false);
    fetchContacts();
    fetchStats();
    onCampaignUpdate();
  };

  const getDisplayName = (c) => c.policyholder_name || c.owner_name || 'Unknown';

  const getStatusDot = (status) => {
    const colors = {
      pending: '#90a4ae',
      sent: '#42a5f5',
      responded: '#66bb6a',
      closed: '#78909c',
      failed: '#ef5350',
      opted_out: '#c62828',
    };
    return colors[status] || '#90a4ae';
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    const days = Math.floor(diff / 86400000);
    if (days === 0) {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
    } else if (days < 7) {
      return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
  };

  const getTabCount = (key) => {
    switch (key) {
      case 'all': return stats.total;
      case 'sent': return stats.sent;
      case 'responded': return stats.responded;
      case 'closed': return stats.closed;
      case 'failed': return stats.failed;
      case 'opted_out': return stats.opted_out;
      case 'pending': return stats.pending;
      default: return 0;
    }
  };

  return (
    <div className="tc-contacts-panel">
      {/* Panel header */}
      <div className="tc-contacts-header">
        <div className="tc-contacts-title">
          <h3>{campaignName || 'Contacts'}</h3>
          {campaignStatus === 'draft' && (
            <button className="tc-icon-btn" onClick={() => setShowUpload(true)} title="Upload CSV">
              <FiUpload size={15} />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="tc-contacts-search">
          <FiSearch className="tc-contacts-search-icon" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="tc-contacts-tabs">
        {STATUS_TABS.map((tab) => {
          const count = getTabCount(tab.key);
          return (
            <button
              key={tab.key}
              className={`tc-contacts-tab ${activeStatus === tab.key ? 'active' : ''}`}
              onClick={() => setActiveStatus(tab.key)}
            >
              {tab.label}
              {count > 0 && <span className="tc-contacts-tab-count">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Contact list */}
      <div className="tc-contacts-list">
        {loading ? (
          <div className="tc-sidebar-empty">Loading...</div>
        ) : contacts.length === 0 ? (
          <div className="tc-sidebar-empty">
            {activeStatus !== 'all' ? `No ${activeStatus} contacts` : 'No contacts yet'}
          </div>
        ) : (
          contacts.map((c) => {
            const convKey = `${c.id}_${c.conversation_phone || c.phone_normalized}`;
            const isSelected = selectedContactId === c.id && selectedPhone === (c.conversation_phone || c.phone_normalized);
            return (
              <div
                key={convKey}
                className={`tc-contact-row ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectContact(c.id, getDisplayName(c), c.conversation_phone || c.phone_normalized)}
              >
                <div className="tc-contact-avatar">
                  {c.primary_phone ? <FiPhone size={14} /> : <FiUser size={14} />}
                  <span
                    className="tc-contact-status-dot"
                    style={{ background: getStatusDot(c.conversation_status || c.campaign_status) }}
                  />
                </div>
                <div className="tc-contact-info">
                  <div className="tc-contact-name-row">
                    <span className="tc-contact-name">{getDisplayName(c)}</span>
                    <span className="tc-contact-time">{formatTime(c.last_phone_message_at || c.last_message_at)}</span>
                  </div>
                  <div className="tc-contact-phone-row">
                    <span className="tc-contact-phone">{c.conversation_phone || c.primary_phone || ''}</span>
                    {c.phone_type === 'secondary' && (
                      <span className="tc-contact-phone-type">(2nd)</span>
                    )}
                  </div>
                  <div className="tc-contact-preview">
                    {c.last_message ? (
                      <span className="tc-contact-last-msg">
                        {c.last_message_direction === 'outbound' && 'You: '}
                        {c.last_message.length > 50 ? c.last_message.substring(0, 50) + '...' : c.last_message}
                      </span>
                    ) : (
                      c.policy_number && (
                        <span className="tc-contact-policy">#{c.policy_number}</span>
                      )
                    )}
                  </div>
                </div>
                {c.follow_ups_sent > 0 && (
                  <span className="tc-contact-followup-badge">FU {c.follow_ups_sent}</span>
                )}
                {(c.conversation_status || c.campaign_status) === 'responded' && (
                  <span className="tc-contact-unread-dot" />
                )}
              </div>
            );
          })
        )}
      </div>

      {showUpload && (
        <CsvUploadModal
          campaignId={campaignId}
          onComplete={handleUploadComplete}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  );
};

export default ContactList;
