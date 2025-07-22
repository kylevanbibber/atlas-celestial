import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Table, Spinner, Badge, Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { DateTime } from 'luxon';
import { useAuth } from '../../context/AuthContext';
import './Notifications.css';

const NotificationsAdmin = () => {
  const { token, isAdmin } = useAuth();
  const navigate = useNavigate();
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
  
  // Fetch notifications on mount
  useEffect(() => {
    // Redirect if not admin
    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }
    
    fetchNotifications();
  }, [isAdmin, navigate]);
  
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
          <Button variant="primary" onClick={() => setShowCreateModal(true)} className="me-2">
            Create Notification
          </Button>
          <Button variant="outline-primary" onClick={() => setShowScheduleModal(true)}>
            Schedule Notification
          </Button>
        </Col>
      </Row>
      
      {error && (
        <Row className="mb-4">
          <Col>
            <div className="alert alert-danger">{error}</div>
          </Col>
        </Row>
      )}
      
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
    </Container>
  );
};

export default NotificationsAdmin; 