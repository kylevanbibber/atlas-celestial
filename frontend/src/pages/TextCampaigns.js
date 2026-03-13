import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import CampaignList from '../components/textCampaigns/CampaignList';
import ContactList from '../components/textCampaigns/ContactList';
import ConversationView from '../components/textCampaigns/ConversationView';
import '../components/textCampaigns/TextCampaigns.css';

const ALLOWED_USER_IDS = [92, 24281, 27996];

const TextCampaigns = () => {
  const { user } = useAuth();

  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [selectedContactName, setSelectedContactName] = useState('');
  const [selectedPhone, setSelectedPhone] = useState(null);

  const userId = parseInt(user?.userId);
  const hasAccess = ALLOWED_USER_IDS.includes(userId);

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoadingCampaigns(true);
      const response = await api.get('/text-campaigns');
      setCampaigns(response.data.data || []);
    } catch (err) {
      console.error('Error fetching campaigns:', err);
    } finally {
      setLoadingCampaigns(false);
    }
  }, []);

  useEffect(() => {
    if (hasAccess) fetchCampaigns();
  }, [hasAccess, fetchCampaigns]);

  if (!hasAccess) {
    return (
      <div className="tc-page">
        <div className="tc-access-denied">
          <h2>Access Denied</h2>
          <p>You do not have permission to access Text Campaigns.</p>
        </div>
      </div>
    );
  }

  const handleSelectCampaign = (campaignId) => {
    setSelectedCampaignId(campaignId);
    setSelectedContactId(null);
    setSelectedContactName('');
    setSelectedPhone(null);
  };

  const handleSelectContact = (contactId, contactName, phone) => {
    setSelectedContactId(contactId);
    setSelectedContactName(contactName || '');
    setSelectedPhone(phone || null);
  };

  const handleCloseConversation = () => {
    setSelectedContactId(null);
    setSelectedContactName('');
    setSelectedPhone(null);
  };

  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId) || null;

  return (
    <div className="tc-messenger">
      {/* Left Panel - Campaigns */}
      <div className="tc-panel-campaigns">
        <CampaignList
          campaigns={campaigns}
          loading={loadingCampaigns}
          selectedCampaignId={selectedCampaignId}
          onSelectCampaign={handleSelectCampaign}
          onRefresh={fetchCampaigns}
        />
      </div>

      {/* Middle Panel - Contacts */}
      <div className="tc-panel-contacts">
        {selectedCampaignId ? (
          <ContactList
            campaignId={selectedCampaignId}
            campaignName={selectedCampaign?.name}
            campaignStatus={selectedCampaign?.status}
            selectedContactId={selectedContactId}
            selectedPhone={selectedPhone}
            onSelectContact={handleSelectContact}
            onCampaignUpdate={fetchCampaigns}
          />
        ) : (
          <div className="tc-panel-empty">
            <div className="tc-panel-empty-icon">💬</div>
            <p>Select a campaign to view contacts</p>
          </div>
        )}
      </div>

      {/* Right Panel - Conversation */}
      <div className={`tc-panel-conversation ${selectedContactId ? 'active' : ''}`}>
        {selectedContactId ? (
          <ConversationView
            contactId={selectedContactId}
            contactName={selectedContactName}
            phone={selectedPhone}
            onBack={handleCloseConversation}
            onStatusChange={fetchCampaigns}
          />
        ) : (
          <div className="tc-panel-empty">
            <div className="tc-panel-empty-icon">📨</div>
            <p>Select a contact to view conversation</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TextCampaigns;
