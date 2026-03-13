import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../../api';
import { FiSearch, FiSend, FiCheck, FiCheckCircle, FiAlertCircle, FiClock, FiX, FiMessageSquare, FiUser, FiMail } from 'react-icons/fi';
import '../../textCampaigns/TextCampaigns.css';

const STATUS_TABS = [
    { key: 'all', label: 'All' },
    { key: 'replied', label: 'Replied' },
    { key: 'no_reply', label: 'No Reply' },
];

const VerifyConversations = () => {
    // Contact list state
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Selected conversation state
    const [selectedAppId, setSelectedAppId] = useState(null);
    const [selectedContact, setSelectedContact] = useState(null);
    const [messages, setMessages] = useState([]);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(timer);
    }, [search]);

    // Fetch conversations list
    const fetchConversations = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (statusFilter !== 'all') params.append('status', statusFilter);
            if (debouncedSearch) params.append('search', debouncedSearch);

            const response = await api.get(`/verify/conversations?${params.toString()}`);
            setConversations(response.data.data || []);
        } catch (err) {
            console.error('Error fetching verify conversations:', err);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, debouncedSearch]);

    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    // Poll conversations list every 30s
    useEffect(() => {
        const interval = setInterval(fetchConversations, 30000);
        return () => clearInterval(interval);
    }, [fetchConversations]);

    // Fetch messages for selected conversation
    const fetchMessages = useCallback(async () => {
        if (!selectedAppId) return;
        try {
            setMessagesLoading(true);
            const response = await api.get(`/verify/${selectedAppId}/messages`);
            setSelectedContact(response.data.data?.contact || null);
            setMessages(response.data.data?.messages || []);
        } catch (err) {
            console.error('Error fetching verify messages:', err);
        } finally {
            setMessagesLoading(false);
        }
    }, [selectedAppId]);

    useEffect(() => {
        if (selectedAppId) fetchMessages();
    }, [fetchMessages, selectedAppId]);

    // Poll messages every 15s when conversation is open
    useEffect(() => {
        if (!selectedAppId) return;
        const interval = setInterval(fetchMessages, 15000);
        return () => clearInterval(interval);
    }, [selectedAppId, fetchMessages]);

    // Auto-scroll messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSelectConversation = (conv) => {
        setSelectedAppId(conv.application_id);
        setReplyText('');
    };

    const handleSendReply = async (e) => {
        e.preventDefault();
        if (!replyText.trim() || sending || !selectedAppId) return;
        try {
            setSending(true);
            await api.post(`/verify/${selectedAppId}/reply`, { message: replyText.trim() });
            setReplyText('');
            fetchMessages();
            // Refresh conversations list to update last message preview
            fetchConversations();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to send reply');
        } finally {
            setSending(false);
        }
    };

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
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
        });
    };

    const formatRelativeTime = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'now';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <div className="tc-messenger">
            {/* Contact List Panel */}
            <div className="tc-panel-contacts" style={{ width: '380px', minWidth: '320px' }}>
                <div className="tc-contacts-panel">
                    <div className="tc-contacts-header">
                        <div className="tc-contacts-title">
                            <h3>Verification Messages</h3>
                        </div>
                        <div className="tc-contacts-search">
                            <FiSearch className="tc-contacts-search-icon" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search client, agent, phone..."
                            />
                        </div>
                    </div>

                    {/* Status tabs */}
                    <div className="tc-contacts-tabs">
                        {STATUS_TABS.map(tab => (
                            <button
                                key={tab.key}
                                className={`tc-contacts-tab ${statusFilter === tab.key ? 'active' : ''}`}
                                onClick={() => setStatusFilter(tab.key)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Conversations list */}
                    <div className="tc-contacts-list">
                        {loading && conversations.length === 0 ? (
                            <div className="tc-sidebar-empty">Loading conversations...</div>
                        ) : conversations.length === 0 ? (
                            <div className="tc-sidebar-empty">No conversations found</div>
                        ) : (
                            conversations.map(conv => (
                                <div
                                    key={conv.application_id}
                                    className={`tc-contact-row ${selectedAppId === conv.application_id ? 'selected' : ''}`}
                                    onClick={() => handleSelectConversation(conv)}
                                >
                                    <div className="tc-contact-avatar">
                                        <FiUser size={16} />
                                        {conv.inbound_count > 0 && (
                                            <div
                                                className="tc-contact-status-dot"
                                                style={{ background: '#66bb6a' }}
                                            />
                                        )}
                                    </div>
                                    <div className="tc-contact-info">
                                        <div className="tc-contact-name-row">
                                            <span className="tc-contact-name">{conv.client_name || 'Unknown'}</span>
                                            <span className="tc-contact-time">{formatRelativeTime(conv.last_message_at)}</span>
                                        </div>
                                        <div className="tc-contact-phone-row">
                                            <span className="tc-contact-phone" style={{ fontSize: '0.75rem' }}>
                                                {conv.client_phoneNumber}
                                            </span>
                                            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', opacity: 0.7 }}>
                                                &middot; {conv.agent_name}
                                            </span>
                                        </div>
                                        {conv.last_message && (
                                            <div className="tc-contact-preview">
                                                {conv.last_message_type === 'email' && <FiMail size={11} style={{ marginRight: 3, flexShrink: 0 }} />}
                                                {conv.last_direction === 'outbound' ? 'You: ' : ''}
                                                {conv.last_message}
                                            </div>
                                        )}
                                    </div>
                                    {conv.inbound_count > 0 && (
                                        <div className="tc-contact-unread-dot" />
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Conversation Panel */}
            <div className={`tc-panel-conversation ${selectedAppId ? 'active' : ''}`}>
                {!selectedAppId ? (
                    <div className="tc-panel-empty">
                        <FiMessageSquare className="tc-panel-empty-icon" />
                        <p>Select a conversation to view messages</p>
                    </div>
                ) : messagesLoading && !selectedContact ? (
                    <div className="tc-conv-loading">Loading...</div>
                ) : (
                    <div className="tc-conversation">
                        {/* Header */}
                        <div className="tc-conv-header">
                            <div className="tc-conv-header-info">
                                <h3>{selectedContact?.client_name || 'Unknown'}</h3>
                                <span>
                                    {selectedContact?.client_phoneNumber}
                                    {' '}&middot;{' '}
                                    <span className={`tc-badge tc-badge-${selectedContact?.status?.toLowerCase()}`}>
                                        {selectedContact?.status}
                                    </span>
                                </span>
                            </div>
                            <div className="tc-conv-header-actions">
                                <button
                                    className="tc-conv-close-btn"
                                    onClick={() => { setSelectedAppId(null); setSelectedContact(null); setMessages([]); }}
                                    title="Close conversation"
                                >
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
                                    <div key={msg.id} className={`tc-message tc-message-${msg.direction}${msg.message_type === 'email' ? ' tc-message-email' : ''}`}>
                                        {msg.message_type === 'email' && (
                                            <div className="tc-message-type-label">
                                                <FiMail size={11} /> Email
                                            </div>
                                        )}
                                        <div>{msg.message}</div>
                                        <div className="tc-message-time">
                                            {formatTime(msg.created_at)}
                                            {msg.message_type === 'email' ? (
                                                <FiMail size={12} className="tc-delivery-icon tc-delivery-sent" title="Email sent" />
                                            ) : (
                                                msg.direction === 'outbound' && getStatusIcon(msg.status)
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Reply input */}
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
                    </div>
                )}
            </div>
        </div>
    );
};

export default VerifyConversations;
