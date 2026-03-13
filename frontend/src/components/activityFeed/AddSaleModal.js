import React, { useState, useRef, useEffect } from 'react';
import { FiX, FiDollarSign, FiCamera, FiTrash2 } from 'react-icons/fi';
import api from '../../api';
import { uploadImageToImgur } from '../../utils/imgurUploader';
import './AddSaleModal.css';

const LEAD_TYPES = [
  { value: 'union', label: 'Union' },
  { value: 'credit_union', label: 'Credit Union' },
  { value: 'association', label: 'Association' },
  { value: 'pos', label: 'POS' },
  { value: 'ref', label: 'Referral' },
  { value: 'child_safe', label: 'Child Safe' },
  { value: 'free_will_kit', label: 'Free Will Kit' },
  { value: 'other', label: 'Other' },
];

const AddSaleModal = ({ onClose, onSaleAdded }) => {
  const [alp, setAlp] = useState('');
  const [refs, setRefs] = useState('0');
  const [leadType, setLeadType] = useState('union');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // Guild + channel selection for Discord posting
  const [guilds, setGuilds] = useState([]);
  const [selectedGuildId, setSelectedGuildId] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState('');

  const selectedGuild = guilds.find(g => g.guild_id === selectedGuildId);

  useEffect(() => {
    api.get('/discord/sales/guilds')
      .then(res => {
        const data = res.data?.data || [];
        setGuilds(data);
        if (data.length === 1) {
          setSelectedGuildId(data[0].guild_id);
          setSelectedChannelId(data[0].default_channel_id);
        }
      })
      .catch(() => {});
  }, []);

  const handleGuildChange = (guildId) => {
    setSelectedGuildId(guildId);
    if (!guildId) {
      setSelectedChannelId('');
      return;
    }
    const guild = guilds.find(g => g.guild_id === guildId);
    setSelectedChannelId(guild?.default_channel_id || '');
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please select a valid image (JPEG, PNG, GIF, or WebP)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be under 10MB');
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const alpNum = parseFloat(alp);
    if (!alpNum || alpNum <= 0) {
      setError('ALP must be greater than 0');
      return;
    }

    try {
      setSubmitting(true);

      // Upload image first if one was selected
      let imageUrl = null;
      if (imageFile) {
        setUploadingImage(true);
        const uploadResult = await uploadImageToImgur(imageFile);
        setUploadingImage(false);
        if (uploadResult.success) {
          imageUrl = uploadResult.url || uploadResult.data?.link;
        } else {
          setError(uploadResult.message || 'Image upload failed');
          setSubmitting(false);
          return;
        }
      }

      const response = await api.post('/discord/sales', {
        alp: alpNum,
        refs: parseInt(refs, 10) || 0,
        lead_type: leadType,
        image_url: imageUrl,
        guild_id: selectedGuildId || null,
        channel_id: selectedChannelId || null,
      });

      if (response.data.success && response.data.event) {
        onSaleAdded(response.data.event);
        onClose();
      } else {
        setError(response.data.message || 'Failed to add sale');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add sale');
    } finally {
      setSubmitting(false);
      setUploadingImage(false);
    }
  };

  const getSubmitLabel = () => {
    if (uploadingImage) return 'Uploading image...';
    if (submitting) return 'Submitting...';
    return 'Submit Sale';
  };

  return (
    <div className="add-sale-overlay" onClick={onClose}>
      <div className="add-sale-modal" onClick={(e) => e.stopPropagation()}>
        <div className="add-sale-header">
          <h3>Log a Sale</h3>
          <button className="add-sale-close-btn" onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        {error && <div className="add-sale-error">{error}</div>}

        <form onSubmit={handleSubmit} className="add-sale-form">
          <div className="add-sale-field">
            <label>ALP Amount</label>
            <div className="add-sale-input-wrapper">
              <FiDollarSign className="add-sale-input-icon" />
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={alp}
                onChange={(e) => setAlp(e.target.value)}
                placeholder="0.00"
                required
                autoFocus
              />
            </div>
          </div>

          <div className="add-sale-field">
            <label>Referrals</label>
            <input
              type="number"
              min="0"
              value={refs}
              onChange={(e) => setRefs(e.target.value)}
            />
          </div>

          <div className="add-sale-field">
            <label>Lead Type</label>
            <select value={leadType} onChange={(e) => setLeadType(e.target.value)}>
              {LEAD_TYPES.map((lt) => (
                <option key={lt.value} value={lt.value}>
                  {lt.label}
                </option>
              ))}
            </select>
          </div>

          {guilds.length > 0 && (
            <>
              <div className="add-sale-field">
                <label>Post to Discord</label>
                <select
                  value={selectedGuildId}
                  onChange={(e) => handleGuildChange(e.target.value)}
                >
                  <option value="">Don't post</option>
                  {guilds.map((g) => (
                    <option key={g.guild_id} value={g.guild_id}>
                      {g.guild_name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedGuild && selectedGuild.channels.length > 0 && (
                <div className="add-sale-field">
                  <label>Channel</label>
                  <select
                    value={selectedChannelId}
                    onChange={(e) => setSelectedChannelId(e.target.value)}
                  >
                    {selectedGuild.channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        #{ch.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <div className="add-sale-field">
            <label>Image (optional)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
            {imagePreview ? (
              <div className="add-sale-image-preview">
                <img src={imagePreview} alt="Sale preview" />
                <button
                  type="button"
                  className="add-sale-image-remove"
                  onClick={handleRemoveImage}
                >
                  <FiTrash2 size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="add-sale-image-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <FiCamera size={16} />
                Add Photo
              </button>
            )}
          </div>

          <button
            type="submit"
            className="add-sale-submit-btn"
            disabled={submitting}
          >
            {getSubmitLabel()}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddSaleModal;
