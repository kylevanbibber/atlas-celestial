import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../utils/LoadingSpinner';
import DataTable from '../utils/DataTable';
import './../../pages/utilities/Utilities.css';

const MeetingAttendanceTracker = () => {
  const { user } = useAuth();
  const [calendlyEvents, setCalendlyEvents] = useState([]);
  const [zoomMeetings, setZoomMeetings] = useState([]);
  const [matchedBookings, setMatchedBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 30 days
    to: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    // Only fetch data if user is authenticated
    if (user) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [dateRange, user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch Calendly events and Zoom meetings in parallel
      const [calendlyResponse, zoomResponse] = await Promise.all([
        api.get('/account/calendly/events', {
          params: {
            min_start_time: `${dateRange.from}T00:00:00Z`,
            max_start_time: `${dateRange.to}T23:59:59Z`,
            count: 100
          }
        }),
        api.get('/account/zoom/meetings', {
          params: {
            from: dateRange.from,
            to: dateRange.to,
            page_size: 100
          }
        })
      ]);

      if (calendlyResponse.data.success && zoomResponse.data.success) {
        setCalendlyEvents(calendlyResponse.data.data.events || []);
        setZoomMeetings(zoomResponse.data.data.meetings || []);
      } else {
        setError('Failed to fetch data. Make sure both Calendly and Zoom accounts are connected.');
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      if (err.response?.status === 400) {
        const message = err.response?.data?.message || '';
        if (message.includes('Calendly')) {
          setError('Your Calendly connection needs to be refreshed. Please go to Account Settings → Calendly Integration → Reconnect.');
        } else if (message.includes('Zoom')) {
          setError('Your Zoom connection needs to be refreshed. Please go to Account Settings → Zoom Integration → Reconnect.');
        } else {
          setError('Please connect both your Calendly and Zoom accounts in Account Settings.');
        }
      } else {
        setError('Failed to fetch meeting data. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Match Calendly bookings with Zoom meetings
  useEffect(() => {
    if (!calendlyEvents.length || !zoomMeetings.length) {
      setMatchedBookings([]);
      return;
    }

    const matched = calendlyEvents.map(event => {
      const eventStart = new Date(event.start_time);
      const invitee = event.invitees[0]; // Get primary invitee
      
      if (!invitee) {
        return {
          id: event.uri,
          calendlyEvent: event,
          invitee: null,
          zoomMeeting: null,
          attended: 'N/A',
          attendanceDetails: null
        };
      }

      // Find matching Zoom meeting (within 15 minutes of scheduled time)
      const matchingZoomMeeting = zoomMeetings.find(meeting => {
        const meetingStart = new Date(meeting.start_time);
        const timeDiff = Math.abs(meetingStart - eventStart) / (1000 * 60); // minutes
        return timeDiff <= 15; // Within 15 minutes
      });

      if (!matchingZoomMeeting || !matchingZoomMeeting.uuid) {
        return {
          id: event.uri,
          calendlyEvent: event,
          invitee,
          zoomMeeting: null,
          attended: eventStart > new Date() ? 'Pending' : 'No Meeting Found',
          attendanceDetails: null
        };
      }

      // Check if invitee attended by fetching participants
      // Note: We'll need to fetch this separately for each meeting
      return {
        id: event.uri,
        calendlyEvent: event,
        invitee,
        zoomMeeting: matchingZoomMeeting,
        attended: 'Checking...', // Will be updated when we fetch participants
        attendanceDetails: null,
        needsParticipantCheck: true
      };
    });

    setMatchedBookings(matched);
  }, [calendlyEvents, zoomMeetings]);

  // Fetch Zoom participants for matched meetings
  useEffect(() => {
    const fetchParticipants = async () => {
      const bookingsNeedingCheck = matchedBookings.filter(b => b.needsParticipantCheck);
      
      for (const booking of bookingsNeedingCheck) {
        try {
          const response = await api.get(`/account/zoom/meetings/${booking.zoomMeeting.uuid}/participants`);
          
          if (response.data.success) {
            const participants = response.data.data.participants || [];
            const inviteeEmail = booking.invitee.email.toLowerCase();
            const inviteeName = booking.invitee.name.toLowerCase();
            
            // Find matching participant
            const matchingParticipant = participants.find(p => {
              const pEmail = (p.user_email || p.email || '').toLowerCase();
              const pName = (p.name || p.user_name || '').toLowerCase();
              
              return pEmail === inviteeEmail || 
                     pName.includes(inviteeName) || 
                     inviteeName.includes(pName);
            });

            // Update the booking with attendance info
            setMatchedBookings(prev => prev.map(b => {
              if (b.id === booking.id) {
                return {
                  ...b,
                  attended: matchingParticipant ? 'Yes' : 'No-show',
                  attendanceDetails: matchingParticipant || null,
                  needsParticipantCheck: false
                };
              }
              return b;
            }));
          }
        } catch (err) {
          console.error('Error fetching participants:', err);
        }
      }
    };

    if (matchedBookings.some(b => b.needsParticipantCheck)) {
      fetchParticipants();
    }
  }, [matchedBookings]);

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDateRange(prev => ({ ...prev, [name]: value }));
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format duration (minutes to hours:minutes)
  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Table columns - memoized for react-table
  const columns = useMemo(() => [
    {
      Header: 'Invitee Name',
      accessor: 'inviteeName',
      Cell: ({ row }) => (
        <div style={{ fontWeight: '500' }}>
          {row.original.invitee?.name || 'Unknown'}
        </div>
      )
    },
    {
      Header: 'Invitee Email',
      accessor: 'inviteeEmail',
      Cell: ({ row }) => row.original.invitee?.email || 'N/A'
    },
    {
      Header: 'Event Type',
      accessor: 'eventType',
      Cell: ({ row }) => row.original.calendlyEvent?.event_type?.name || 'N/A'
    },
    {
      Header: 'Scheduled Time',
      accessor: 'scheduledTime',
      Cell: ({ row }) => formatDate(row.original.calendlyEvent?.start_time)
    },
    {
      Header: 'Attended',
      accessor: 'attended',
      Cell: ({ row }) => {
        const attended = row.original.attended;
        let color = 'var(--text-secondary)';
        let bgColor = 'var(--secondary-background)';
        
        if (attended === 'Yes') {
          color = '#10b981';
          bgColor = '#d1fae5';
        } else if (attended === 'No-show') {
          color = '#ef4444';
          bgColor = '#fee2e2';
        } else if (attended === 'Pending') {
          color = '#f59e0b';
          bgColor = '#fef3c7';
        }
        
        return (
          <span style={{
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '600',
            color: color,
            background: bgColor
          }}>
            {attended}
          </span>
        );
      }
    },
    {
      Header: 'Duration in Meeting',
      accessor: 'duration',
      Cell: ({ row }) => {
        const details = row.original.attendanceDetails;
        return details ? formatDuration(details.duration) : 'N/A';
      }
    },
    {
      Header: 'Join Time',
      accessor: 'joinTime',
      Cell: ({ row }) => {
        const details = row.original.attendanceDetails;
        return details ? formatDate(details.join_time) : 'N/A';
      }
    }
  ], []);

  if (!user) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>
          Please log in to view meeting attendance data.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <LoadingSpinner />
        <p style={{ marginTop: '20px' }}>Loading attendance data...</p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="settings-alert settings-alert-error" style={{ marginBottom: '20px' }}>
          {error}
        </div>
      )}

        {/* Date Range Filter */}
        <div style={{ 
          display: 'flex', 
          gap: '16px', 
          marginBottom: '20px', 
          flexWrap: 'wrap',
          alignItems: 'flex-end'
        }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label className="settings-label">From Date</label>
            <input
              type="date"
              name="from"
              value={dateRange.from}
              onChange={handleDateChange}
              className="settings-input"
              max={dateRange.to}
            />
          </div>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label className="settings-label">To Date</label>
            <input
              type="date"
              name="to"
              value={dateRange.to}
              onChange={handleDateChange}
              className="settings-input"
              min={dateRange.from}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
          <button
            onClick={fetchData}
            className="settings-button"
            style={{ padding: '10px 20px' }}
          >
            🔍 Refresh
          </button>
        </div>

        {/* Stats Summary */}
        {matchedBookings.length > 0 && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '16px', 
            marginBottom: '20px' 
          }}>
            <div style={{ 
              padding: '16px', 
              background: 'var(--card-background)', 
              border: '1px solid var(--border-color)',
              borderRadius: '8px' 
            }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>
                {matchedBookings.length}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Total Bookings
              </div>
            </div>
            <div style={{ 
              padding: '16px', 
              background: 'var(--card-background)', 
              border: '1px solid var(--border-color)',
              borderRadius: '8px' 
            }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#10b981' }}>
                {matchedBookings.filter(b => b.attended === 'Yes').length}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Attended
              </div>
            </div>
            <div style={{ 
              padding: '16px', 
              background: 'var(--card-background)', 
              border: '1px solid var(--border-color)',
              borderRadius: '8px' 
            }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#ef4444' }}>
                {matchedBookings.filter(b => b.attended === 'No-show').length}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                No-shows
              </div>
            </div>
            <div style={{ 
              padding: '16px', 
              background: 'var(--card-background)', 
              border: '1px solid var(--border-color)',
              borderRadius: '8px' 
            }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#f59e0b' }}>
                {matchedBookings.filter(b => b.attended === 'Pending').length}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Pending
              </div>
            </div>
          </div>
        )}

        {/* Bookings Table */}
        {matchedBookings.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px', 
            color: 'var(--text-secondary)' 
          }}>
            <p>No Calendly bookings found for the selected date range.</p>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>
              Make sure both your Calendly and Zoom accounts are connected.
            </p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={matchedBookings}
            showActionBar={false}
            disableCellEditing={true}
            disablePagination={false}
          />
        )}
    </div>
  );
};

export default MeetingAttendanceTracker;

