import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api';
import LoadingSpinner from '../utils/LoadingSpinner';
import DataTable from '../utils/DataTable';
import Modal from '../utils/Modal';
import './../../pages/utilities/Utilities.css';

const ZoomMeetingHistory = () => {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 30 days
    to: new Date().toISOString().split('T')[0]
  });
  
  // Modal state for participants
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);

  useEffect(() => {
    fetchMeetings();
  }, [dateRange]);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await api.get('/account/zoom/meetings', {
        params: {
          from: dateRange.from,
          to: dateRange.to,
          page_size: 100
        }
      });

      if (response.data.success) {
        // Ensure each meeting has a unique ID for react-table
        const meetingsWithIds = (response.data.data.meetings || []).map((meeting, index) => ({
          ...meeting,
          id: meeting.uuid || meeting.id || `meeting-${index}` // Ensure unique ID
        }));
        console.log('[Zoom Meetings] Fetched meetings:', meetingsWithIds.length, meetingsWithIds);
        setMeetings(meetingsWithIds);
      } else {
        setError(response.data.message || 'Failed to fetch meetings');
      }
    } catch (err) {
      console.error('Error fetching meetings:', err);
      if (err.response?.status === 400) {
        setError('Please connect your Zoom account first in Account Settings.');
      } else {
        setError('Failed to fetch meeting history. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipants = async (meetingId) => {
    try {
      setParticipantsLoading(true);
      
      const response = await api.get(`/account/zoom/meetings/${meetingId}/participants`);

      if (response.data.success) {
        // Ensure each participant has a unique ID for react-table
        const participantsWithIds = (response.data.data.participants || []).map((participant, index) => ({
          ...participant,
          id: participant.id || participant.user_id || `participant-${index}` // Ensure unique ID
        }));
        console.log('[Zoom Participants] Fetched participants:', participantsWithIds.length, participantsWithIds);
        console.log('[Zoom Participants] Sample participant data:', participantsWithIds[0]);
        setParticipants(participantsWithIds);
      } else {
        setError('Failed to fetch participants');
      }
    } catch (err) {
      console.error('Error fetching participants:', err);
      setError('Failed to fetch meeting participants');
    } finally {
      setParticipantsLoading(false);
    }
  };

  const handleViewParticipants = (meeting) => {
    setSelectedMeeting(meeting);
    setShowParticipantsModal(true);
    fetchParticipants(meeting.uuid);
  };

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
    if (!minutes) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Table columns - memoized for react-table
  const columns = useMemo(() => [
    {
      Header: 'Topic',
      accessor: 'topic',
      Cell: ({ row }) => (
        <div style={{ fontWeight: '500' }}>
          {row.original.topic || 'Untitled Meeting'}
        </div>
      )
    },
    {
      Header: 'Date & Time',
      accessor: 'start_time',
      Cell: ({ row }) => formatDate(row.original.start_time)
    },
    {
      Header: 'Duration',
      accessor: 'duration',
      Cell: ({ row }) => formatDuration(row.original.duration)
    },
    {
      Header: 'Participants',
      accessor: 'participants_count',
      Cell: ({ row }) => (
        <div style={{ textAlign: 'center' }}>
          {row.original.participants_count || 0}
        </div>
      )
    },
    {
      Header: 'Meeting ID',
      accessor: 'meetingId',
      Cell: ({ row }) => (
        <code style={{ 
          fontSize: '12px', 
          padding: '2px 6px', 
          background: 'var(--secondary-background)', 
          borderRadius: '4px' 
        }}>
          {row.original.id}
        </code>
      )
    },
    {
      Header: 'Actions',
      accessor: 'actions',
      disableSortBy: true,
      Cell: ({ row }) => (
        <button
          onClick={() => handleViewParticipants(row.original)}
          className="settings-button"
          style={{ 
            padding: '6px 12px', 
            fontSize: '13px',
            whiteSpace: 'nowrap'
          }}
        >
          View Attendees
        </button>
      )
    }
  ], []);

  // Participant columns - memoized for react-table
  const participantColumns = useMemo(() => [
    {
      Header: 'Name',
      accessor: 'name',
      Cell: ({ row }) => (
        <div style={{ fontWeight: '500' }}>
          {row.original.name || row.original.user_name || 'Unknown'}
        </div>
      )
    },
    {
      Header: 'Email',
      accessor: 'user_email',
      Cell: ({ row }) => {
        const participant = row.original;
        // Check multiple possible email field names from Zoom API
        const email = participant.user_email || participant.email || participant.participant_user_email;
        return email || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Not available</span>;
      }
    },
    {
      Header: 'Join Time',
      accessor: 'join_time',
      Cell: ({ row }) => formatDate(row.original.join_time)
    },
    {
      Header: 'Leave Time',
      accessor: 'leave_time',
      Cell: ({ row }) => formatDate(row.original.leave_time)
    },
    {
      Header: 'Duration',
      accessor: 'duration',
      Cell: ({ row }) => formatDuration(row.original.duration)
    }
  ], []);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <LoadingSpinner />
        <p style={{ marginTop: '20px' }}>Loading meeting history...</p>
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
            onClick={fetchMeetings}
            className="settings-button"
            style={{ padding: '10px 20px' }}
          >
            🔍 Search
          </button>
        </div>

        {/* Meetings Table */}
        {meetings.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px', 
            color: 'var(--text-secondary)' 
          }}>
            <p>No meetings found for the selected date range.</p>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>
              Try adjusting the date range or check if your Zoom account is properly connected.
            </p>
          </div>
        ) : (
          <>
            <div style={{ 
              marginBottom: '12px', 
              fontSize: '14px', 
              color: 'var(--text-secondary)' 
            }}>
              Found {meetings.length} meeting{meetings.length !== 1 ? 's' : ''}
            </div>
            <DataTable
              columns={columns}
              data={meetings}
              showActionBar={false}
              disableCellEditing={true}
              disablePagination={false}
            />
          </>
        )}

      {/* Participants Modal */}
      {showParticipantsModal && (
        <Modal
          isOpen={showParticipantsModal}
          onClose={() => {
            setShowParticipantsModal(false);
            setSelectedMeeting(null);
            setParticipants([]);
          }}
          title={`Attendees - ${selectedMeeting?.topic || 'Meeting'}`}
          size="large"
        >
          <div style={{ padding: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                <strong>Date:</strong> {formatDate(selectedMeeting?.start_time)}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                <strong>Duration:</strong> {formatDuration(selectedMeeting?.duration)}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                <strong>Total Participants:</strong> {selectedMeeting?.participants_count || 0}
              </div>
            </div>

            {participantsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <LoadingSpinner />
                <p style={{ marginTop: '16px' }}>Loading participants...</p>
              </div>
            ) : participants.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px', 
                color: 'var(--text-secondary)' 
              }}>
                No participant data available for this meeting.
              </div>
            ) : (
              <DataTable
                columns={participantColumns}
                data={participants}
                showActionBar={false}
                disableCellEditing={true}
                disablePagination={false}
              />
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ZoomMeetingHistory;

