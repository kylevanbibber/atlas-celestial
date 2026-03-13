import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Form, Table, Spinner, Badge, Modal, InputGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { DateTime } from 'luxon';
import { useAuth } from '../../context/AuthContext';
import { FiSend, FiSearch, FiTrash2 } from 'react-icons/fi';
import './Notifications.css';

const NotificationsAdmin = () => {
  const { token, isAdmin } = useAuth();
  const navigate = useNavigate();
  
  // Tab state
  const [activeTab, setActiveTab] = useState('notifications');
  
  // Notifications tab state
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info',
    user_id: '',
    target_group: '',
    scheduled_for: '',
    link_url: '',
    metadata: {}
  });
  
  // Push Subscribers tab state
  const [pushSubscribers, setPushSubscribers] = useState([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const [subscriberSearch, setSubscriberSearch] = useState('');
  const [subscriberPagination, setSubscriberPagination] = useState({ total: 0, limit: 50, offset: 0 });
  const [showSendPushModal, setShowSendPushModal] = useState(false);
  const [selectedSubscriber, setSelectedSubscriber] = useState(null);
  const [pushFormData, setPushFormData] = useState({ title: '', message: '', link_url: '' });
  const [sendingPush, setSendingPush] = useState(false);
  const [purgingStale, setPurgingStale] = useState(false);
  const [purgeResult, setPurgeResult] = useState(null);
  
  // Configure axios with auth token
  const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5001/api',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  
  // Fetch all notifications
  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get('/notifications/admin/all');
      setNotifications(response.data.notifications);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch notifications');
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch push subscribers
  const fetchPushSubscribers = useCallback(async (search = subscriberSearch, offset = 0) => {
    setLoadingSubscribers(true);
    try {
      const params = new URLSearchParams({ limit: 50, offset });
      if (search) params.append('search', search);
      
      const response = await api.get(`/notifications/admin/push-subscribers?${params}`);
      if (response.data.success) {
        setPushSubscribers(response.data.data.subscribers);
        setSubscriberPagination(response.data.data.pagination);
      }
    } catch (err) {
      console.error('Error fetching push subscribers:', err);
      setError(err.response?.data?.error || 'Failed to fetch push subscribers');
    } finally {
      setLoadingSubscribers(false);
    }
  }, [subscriberSearch, token]);
  
  // Purge stale subscriptions
  const purgeStaleSubscriptions = async () => {
    setPurgingStale(true);
    setPurgeResult(null);
    try {
      const response = await api.post('/notifications/admin/purge-stale-subscriptions');
      if (response.data.success) {
        setPurgeResult(response.data);
        // Refresh the subscribers list after purge
        fetchPushSubscribers();
      }
    } catch (err) {
      console.error('Error purging subscriptions:', err);
      setError(err.response?.data?.error || 'Failed to purge stale subscriptions');
    } finally {
      setPurgingStale(false);
    }
  };
  
  // Send push notification to a specific user
  const sendPushToUser = async () => {
    if (!selectedSubscriber || !pushFormData.title || !pushFormData.message) return;
    
    setSendingPush(true);
    try {
      await api.post('/notifications', {
        title: pushFormData.title,
        message: pushFormData.message,
        link_url: pushFormData.link_url || '/',
        type: 'info',
        user_id: selectedSubscriber.user_id
      });
      setShowSendPushModal(false);
      setPushFormData({ title: '', message: '', link_url: '' });
      setSelectedSubscriber(null);
    } catch (err) {
      console.error('Error sending push:', err);
      setError(err.response?.data?.error || 'Failed to send push notification');
    } finally {
      setSendingPush(false);
    }
  };
  
  // Fetch notifications on mount
  useEffect(() => {
    // Redirect if not admin
    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }
    
    fetchNotifications();
  }, [isAdmin, navigate]);
  
  // Fetch subscribers when tab switches to push
  useEffect(() => {
    if (activeTab === 'pushSubscribers') {
      fetchPushSubscribers();
    }
  }, [activeTab]);
  
  // Handle input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // Create notification
  const createNotification = async () => {
    try {
      await api.post('/notifications', formData);
      setShowCreateModal(false);
      setFormData({
        title: '',
        message: '',
        type: 'info',
        user_id: '',
        target_group: '',
        scheduled_for: '',
        link_url: '',
        metadata: {}
      });
      fetchNotifications();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create notification');
      console.error('Error creating notification:', err);
    }
  };
  
  // Schedule notification
  const scheduleNotification = async () => {
    try {
      const data = {
        ...formData,
        scheduled_for: formData.scheduled_for ? new Date(formData.scheduled_for).toISOString() : null
      };
      
      await api.post('/notifications', data);
      setShowScheduleModal(false);
      setFormData({
        title: '',
        message: '',
        type: 'info',
        user_id: '',
        target_group: '',
        scheduled_for: '',
        link_url: '',
        metadata: {}
      });
      fetchNotifications();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to schedule notification');
      console.error('Error scheduling notification:', err);
    }
  };
  
  // Delete notification
  const deleteNotification = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      fetchNotifications();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete notification');
      console.error('Error deleting notification:', err);
    }
  };
  
  // Format datetime
  const formatDateTime = (timestamp) => {
    return DateTime.fromISO(timestamp).toLocaleString(DateTime.DATETIME_SHORT);
  };
  
  // Get badge type based on notification type
  const getBadgeVariant = (type) => {
    switch (type) {
      case 'success': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'danger';
      case 'info':
      default:
        return 'info';
    }
  };
  
  return (
    <Container className="notifications-admin-container">
      <Row className="mb-4">
        <Col>
          <h1>Notifications Management</h1>
          <p className="text-muted">Create, schedule, and manage notifications for your users</p>
        </Col>
        <Col xs="auto" className="d-flex align-items-center">
          {activeTab === 'notifications' && (
            <>
              <Button variant="primary" onClick={() => setShowCreateModal(true)} className="me-2">
                Create Notification
              </Button>
              <Button variant="outline-primary" onClick={() => setShowScheduleModal(true)}>
                Schedule Notification
              </Button>
            </>
          )}
        </Col>
      </Row>
      
      {/* Tabs */}
      <div className="admin-tabs mb-4">
        <Button
          variant={activeTab === 'notifications' ? 'primary' : 'outline-secondary'}
          onClick={() => setActiveTab('notifications')}
          className="me-2"
        >
          In-App Notifications
        </Button>
        <Button
          variant={activeTab === 'pushSubscribers' ? 'primary' : 'outline-secondary'}
          onClick={() => setActiveTab('pushSubscribers')}
        >
          Push Subscribers
        </Button>
      </div>
      
      {error && (
        <Row className="mb-4">
          <Col>
            <div className="alert alert-danger alert-dismissible">
              {error}
              <button type="button" className="btn-close" onClick={() => setError(null)}></button>
            </div>
          </Col>
        </Row>
      )}
      
      {purgeResult && (
        <Row className="mb-4">
          <Col>
            <div className="alert alert-success alert-dismissible">
              Purged {purgeResult.purged} stale subscriptions ({purgeResult.expired} expired, {purgeResult.invalid} invalid). 
              {purgeResult.remaining} active subscriptions remaining.
              <button type="button" className="btn-close" onClick={() => setPurgeResult(null)}></button>
            </div>
          </Col>
        </Row>
      )}
      
      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <Card>
          <Card.Header>
            <h5 className="mb-0">All Notifications</h5>
          </Card.Header>
          <Card.Body className="p-0">
            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-5">
                <p>No notifications found</p>
              </div>
            ) : (
              <div className="table-responsive">
                <Table hover className="mb-0">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Type</th>
                      <th>Target</th>
                      <th>Created</th>
                      <th>Scheduled</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notifications.map(notification => (
                      <tr key={notification.id}>
                        <td>{notification.title}</td>
                        <td>
                          <Badge bg={getBadgeVariant(notification.type)}>
                            {notification.type}
                          </Badge>
                        </td>
                        <td>
                          {notification.user_id ? (
                            <span>User: {notification.username || notification.user_id}</span>
                          ) : notification.target_group ? (
                            <span>Group: {notification.target_group}</span>
                          ) : (
                            <span>All users</span>
                          )}
                        </td>
                        <td>{formatDateTime(notification.created_at)}</td>
                        <td>
                          {notification.scheduled_for ? (
                            formatDateTime(notification.scheduled_for)
                          ) : (
                            <span className="text-muted">Immediate</span>
                          )}
                        </td>
                        <td>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => deleteNotification(notification.id)}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>
      )}
      
      {/* Push Subscribers Tab */}
      {activeTab === 'pushSubscribers' && (
        <Card>
          <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <h5 className="mb-0">Push Notification Subscribers</h5>
            <div className="d-flex align-items-center gap-2">
              <InputGroup style={{ maxWidth: '280px' }}>
                <Form.Control
                  placeholder="Search by name or email"
                  value={subscriberSearch}
                  onChange={(e) => setSubscriberSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') fetchPushSubscribers(subscriberSearch, 0); }}
                />
                <Button variant="outline-secondary" onClick={() => fetchPushSubscribers(subscriberSearch, 0)}>
                  <FiSearch />
                </Button>
              </InputGroup>
              <Button 
                variant="outline-warning" 
                size="sm"
                onClick={purgeStaleSubscriptions}
                disabled={purgingStale}
                title="Test all subscriptions and remove expired ones"
              >
                {purgingStale ? <Spinner animation="border" size="sm" /> : <FiTrash2 className="me-1" />}
                {purgingStale ? 'Purging...' : 'Purge Stale'}
              </Button>
            </div>
          </Card.Header>
          <Card.Body className="p-0">
            {loadingSubscribers ? (
              <div className="text-center py-5">
                <Spinner animation="border" />
              </div>
            ) : pushSubscribers.length === 0 ? (
              <div className="text-center py-5">
                <p className="text-muted">No push subscribers found.</p>
              </div>
            ) : (
              <>
                <div className="table-responsive">
                  <Table hover className="mb-0">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Level</th>
                        <th>Devices</th>
                        <th>Browsers</th>
                        <th>Last Active</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pushSubscribers.map(subscriber => (
                        <tr key={subscriber.user_id}>
                          <td>
                            <div className="d-flex align-items-center">
                              {subscriber.profpic && (
                                <img 
                                  src={subscriber.profpic} 
                                  alt="" 
                                  className="rounded-circle me-2" 
                                  style={{ width: 32, height: 32, objectFit: 'cover' }}
                                />
                              )}
                              <div>
                                <strong>{subscriber.lagnname}</strong>
                                <div className="text-muted small">{subscriber.screen_name || subscriber.email}</div>
                              </div>
                            </div>
                          </td>
                          <td><Badge bg="secondary">{subscriber.clname || 'N/A'}</Badge></td>
                          <td>{subscriber.device_count}</td>
                          <td>
                            {subscriber.browsers && subscriber.browsers.split(', ').map((browser, idx) => (
                              <Badge key={idx} bg="info" className="me-1">{browser}</Badge>
                            ))}
                          </td>
                          <td>{subscriber.last_active ? formatDateTime(subscriber.last_active) : 'N/A'}</td>
                          <td>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                setSelectedSubscriber(subscriber);
                                setShowSendPushModal(true);
                              }}
                            >
                              <FiSend className="me-1" /> Send Push
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
                
                {/* Pagination info */}
                <div className="d-flex justify-content-between align-items-center p-3">
                  <span className="text-muted">
                    Showing {pushSubscribers.length} of {subscriberPagination.total} subscribers
                  </span>
                  {subscriberPagination.total > subscriberPagination.limit && (
                    <div>
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        className="me-2"
                        disabled={subscriberPagination.offset === 0}
                        onClick={() => fetchPushSubscribers(subscriberSearch, Math.max(0, subscriberPagination.offset - subscriberPagination.limit))}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        disabled={subscriberPagination.offset + subscriberPagination.limit >= subscriberPagination.total}
                        onClick={() => fetchPushSubscribers(subscriberSearch, subscriberPagination.offset + subscriberPagination.limit)}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </Card.Body>
        </Card>
      )}
      
      {/* Create Notification Modal */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Create Notification</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Title</Form.Label>
              <Form.Control
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Notification title"
                required
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Message</Form.Label>
              <Form.Control
                as="textarea"
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                placeholder="Notification message"
                rows={3}
                required
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Type</Form.Label>
              <Form.Select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
              >
                <option value="info">Information</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </Form.Select>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Target User ID (optional)</Form.Label>
              <Form.Control
                type="text"
                name="user_id"
                value={formData.user_id}
                onChange={handleInputChange}
                placeholder="Leave blank to send to all users"
              />
              <Form.Text className="text-muted">
                Enter a user ID to send to a specific user
              </Form.Text>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Target Group (optional)</Form.Label>
              <Form.Control
                type="text"
                name="target_group"
                value={formData.target_group}
                onChange={handleInputChange}
                placeholder="e.g., admin, sales, etc."
              />
              <Form.Text className="text-muted">
                Enter a group name to send to all users in that group
              </Form.Text>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Link URL (optional)</Form.Label>
              <Form.Control
                type="url"
                name="link_url"
                value={formData.link_url}
                onChange={handleInputChange}
                placeholder="e.g., /dashboard"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={createNotification}>
            Create Notification
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* Schedule Notification Modal */}
      <Modal show={showScheduleModal} onHide={() => setShowScheduleModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Schedule Notification</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Title</Form.Label>
              <Form.Control
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Notification title"
                required
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Message</Form.Label>
              <Form.Control
                as="textarea"
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                placeholder="Notification message"
                rows={3}
                required
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Type</Form.Label>
              <Form.Select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
              >
                <option value="info">Information</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </Form.Select>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Scheduled For</Form.Label>
              <Form.Control
                type="datetime-local"
                name="scheduled_for"
                value={formData.scheduled_for}
                onChange={handleInputChange}
                required
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Target User ID (optional)</Form.Label>
              <Form.Control
                type="text"
                name="user_id"
                value={formData.user_id}
                onChange={handleInputChange}
                placeholder="Leave blank to send to all users"
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Target Group (optional)</Form.Label>
              <Form.Control
                type="text"
                name="target_group"
                value={formData.target_group}
                onChange={handleInputChange}
                placeholder="e.g., admin, sales, etc."
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Link URL (optional)</Form.Label>
              <Form.Control
                type="url"
                name="link_url"
                value={formData.link_url}
                onChange={handleInputChange}
                placeholder="e.g., /dashboard"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowScheduleModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={scheduleNotification}>
            Schedule Notification
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* Send Push Notification Modal */}
      <Modal show={showSendPushModal} onHide={() => { setShowSendPushModal(false); setSelectedSubscriber(null); }}>
        <Modal.Header closeButton>
          <Modal.Title>
            Send Push to {selectedSubscriber?.lagnname || 'User'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedSubscriber && (
            <div className="d-flex align-items-center mb-3 p-2 bg-light rounded">
              {selectedSubscriber.profpic && (
                <img 
                  src={selectedSubscriber.profpic} 
                  alt="" 
                  className="rounded-circle me-2" 
                  style={{ width: 40, height: 40, objectFit: 'cover' }}
                />
              )}
              <div>
                <strong>{selectedSubscriber.lagnname}</strong>
                <div className="text-muted small">
                  {selectedSubscriber.device_count} device(s) • {selectedSubscriber.browsers}
                </div>
              </div>
            </div>
          )}
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Title</Form.Label>
              <Form.Control
                type="text"
                value={pushFormData.title}
                onChange={(e) => setPushFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Notification title"
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Message</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={pushFormData.message}
                onChange={(e) => setPushFormData(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Notification message"
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Link URL (optional)</Form.Label>
              <Form.Control
                type="text"
                value={pushFormData.link_url}
                onChange={(e) => setPushFormData(prev => ({ ...prev, link_url: e.target.value }))}
                placeholder="e.g., /dashboard"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => { setShowSendPushModal(false); setSelectedSubscriber(null); }}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={sendPushToUser}
            disabled={sendingPush || !pushFormData.title || !pushFormData.message}
          >
            {sendingPush ? <Spinner animation="border" size="sm" className="me-1" /> : <FiSend className="me-1" />}
            Send Push Notification
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default NotificationsAdmin;
