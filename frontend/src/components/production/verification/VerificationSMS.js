import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../../api';
import { FiSend, FiCheck, FiCheckCircle, FiAlertCircle, FiClock, FiMail } from 'react-icons/fi';

const VerificationSMS = ({ applicationId, clientPhone, clientName }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    try {
      const response = await api.get(`/verify/${applicationId}/messages`);
      setMessages(response.data.data?.messages || []);
    } catch (err) {
      console.error('Error fetching verify messages:', err);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Poll every 30 seconds
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
      await api.post(`/verify/${applicationId}/reply`, { message: replyText.trim() });
      setReplyText('');
      fetchMessages();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'delivered':
        return <FiCheckCircle className="vsms-status-icon vsms-delivered" title="Delivered" />;
      case 'sent':
        return <FiCheck className="vsms-status-icon vsms-sent" title="Sent" />;
      case 'failed':
      case 'undelivered':
        return <FiAlertCircle className="vsms-status-icon vsms-failed" title={status} />;
      case 'queued':
      case 'accepted':
        return <FiClock className="vsms-status-icon vsms-queued" title="Queued" />;
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

  if (loading) {
    return <div className="vsms-loading">Loading messages...</div>;
  }

  return (
    <div className="vsms-container">
      <div className="vsms-phone-label">{clientPhone}</div>

      <div className="vsms-messages">
        {messages.length === 0 ? (
          <div className="vsms-empty">No messages yet</div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`vsms-message vsms-message-${msg.direction}${msg.message_type === 'email' ? ' vsms-message-email' : ''}`}>
              {msg.message_type === 'email' && (
                <div className="vsms-message-type-label">
                  <FiMail size={11} /> Email
                </div>
              )}
              <div className="vsms-message-text">{msg.message}</div>
              <div className="vsms-message-meta">
                {formatTime(msg.created_at)}
                {msg.message_type === 'email' ? (
                  <FiMail size={12} className="vsms-status-icon vsms-sent" title="Email sent" />
                ) : (
                  msg.direction === 'outbound' && getStatusIcon(msg.status)
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="vsms-input" onSubmit={handleSendReply}>
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
  );
};

export default VerificationSMS;
