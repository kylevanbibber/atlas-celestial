import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api';
import { FiX, FiSend, FiCheck, FiCheckCircle, FiAlertCircle, FiClock, FiChevronDown } from 'react-icons/fi';

const ConversationView = ({ contactId, contactName, phone, onBack, onStatusChange }) => {
  const [contact, setContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [closeDropdownOpen, setCloseDropdownOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const closeDropdownRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const params = phone ? `?phone=${encodeURIComponent(phone)}` : '';
      const response = await api.get(`/text-campaigns/contacts/${contactId}/messages${params}`);
      setContact(response.data.data.contact);
      setMessages(response.data.data.messages || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  }, [contactId, phone]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // WebSocket listeners
  useEffect(() => {
    const handleWsMessage = (e) => {
      if (e.detail?.contactId === parseInt(contactId)) {
        if (e.detail.phone && phone && e.detail.phone !== phone) return;
        fetchMessages();
      }
    };
    const handleStatusUpdate = (e) => {
      if (e.detail?.contactId === parseInt(contactId)) {
        if (e.detail.phone && phone && e.detail.phone !== phone) return;
        fetchMessages();
      }
    };
    window.addEventListener('text_campaign_message', handleWsMessage);
    window.addEventListener('text_campaign_status', handleStatusUpdate);
    return () => {
      window.removeEventListener('text_campaign_message', handleWsMessage);
      window.removeEventListener('text_campaign_status', handleStatusUpdate);
    };
  }, [contactId, fetchMessages]);

  // Fallback poll every 30s
  useEffect(() => {
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || sending) return;
    try {
      setSending(true);
      await api.post(`/text-campaigns/contacts/${contactId}/reply`, { message: replyText.trim(), phone: phone || undefined });
      setReplyText('');
      fetchMessages();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handleMarkClosed = async () => {
    try {
      await api.put(`/text-campaigns/contacts/${contactId}/status`, { status: 'closed' });
      fetchMessages();
      onStatusChange?.();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleReopen = async () => {
    try {
      await api.put(`/text-campaigns/contacts/${contactId}/status`, { status: 'responded' });
      fetchMessages();
      onStatusChange?.();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleCloseAll = async () => {
    setCloseDropdownOpen(false);
    try {
      await api.put(`/text-campaigns/contacts/${contactId}/close-all`);
      fetchMessages();
      onStatusChange?.();
    } catch (err) {
      console.error('Error closing all:', err);
    }
  };

  const handleCloseDnc = async () => {
    setCloseDropdownOpen(false);
    try {
      await api.put(`/text-campaigns/contacts/${contactId}/close-dnc`, { phone: phone || undefined });
      fetchMessages();
      onStatusChange?.();
    } catch (err) {
      console.error('Error closing with DNC:', err);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (closeDropdownRef.current && !closeDropdownRef.current.contains(e.target)) {
        setCloseDropdownOpen(false);
      }
    };
    if (closeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeDropdownOpen]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'delivered':
        return <FiCheckCircle className="tc-delivery-icon tc-delivery-delivered" title="Delivered" />;
      case 'sent':
        return <FiCheck className="tc-delivery-icon tc-delivery-sent" title="Sent" />;
      case 'failed':
      case 'undelivered':
        return <FiAlertCircle className="tc-delivery-icon tc-delivery-failed" title={status} />;
      case 'queued':
      case 'accepted':
        return <FiClock className="tc-delivery-icon tc-delivery-queued" title="Queued" />;
      default:
        return null;
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      timeZone: 'America/New_York'
    });
  };

  if (loading && !contact) {
    return <div className="tc-conv-loading">Loading...</div>;
  }

  return (
    <div className="tc-conversation">
      {/* Header */}
      <div className="tc-conv-header">
        <div className="tc-conv-header-info">
          <h3>{contact?.policyholder_name || contact?.owner_name || contactName || 'Unknown'}</h3>
          <span>
            {phone || contact?.primary_phone}
            {contact?.policy_number && <> &middot; #{contact.policy_number}</>}
            {' '}&middot;{' '}
            <span className={`tc-badge tc-badge-${contact?.campaign_status}`}>{contact?.campaign_status}</span>
          </span>
        </div>
        <div className="tc-conv-header-actions">
          {(contact?.campaign_status === 'responded' || contact?.campaign_status === 'opted_out') && (
            <div className="tc-split-btn" ref={closeDropdownRef}>
              <button
                className="tc-split-btn-arrow"
                onClick={() => setCloseDropdownOpen(prev => !prev)}
                title="More close options"
              >
                <FiChevronDown size={12} />
              </button>
              <button className="tc-split-btn-main tc-btn-sm tc-btn-primary" onClick={handleMarkClosed}>
                Close
              </button>
              {closeDropdownOpen && (
                <div className="tc-split-btn-dropdown">
                  <button onClick={handleCloseAll}>Close All</button>
                  <button onClick={handleCloseDnc}>Close &amp; Add to DNC</button>
                </div>
              )}
            </div>
          )}
          {contact?.campaign_status === 'closed' && (
            <button className="tc-btn tc-btn-sm tc-btn-secondary" onClick={handleReopen}>Reopen</button>
          )}
          <button className="tc-conv-close-btn" onClick={onBack} title="Close conversation">
            <FiX size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="tc-conv-messages">
        {messages.length === 0 ? (
          <div className="tc-sidebar-empty" style={{ marginTop: '2rem' }}>No messages yet</div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`tc-message tc-message-${msg.direction}`}>
              {msg.follow_up_step && (
                <div className="tc-message-followup-label">
                  Follow-Up #{msg.follow_up_step}
                </div>
              )}
              <div>{msg.message}</div>
              <div className="tc-message-time">
                {formatTime(msg.created_at)}
                {msg.direction === 'outbound' && getStatusIcon(msg.status)}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {contact?.campaign_status === 'opted_out' ? (
        <div className="tc-conv-opted-out">
          This contact has opted out and cannot receive messages.
        </div>
      ) : (
        <form className="tc-conv-input" onSubmit={handleSendReply}>
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type a message..."
            disabled={sending}
          />
          <button type="submit" disabled={!replyText.trim() || sending}>
            <FiSend />
          </button>
        </form>
      )}
    </div>
  );
};

export default ConversationView;
