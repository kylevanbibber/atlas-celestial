import React, { useState, useEffect, useMemo } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiCheck, FiX, FiCalendar, FiCreditCard, FiMapPin, FiHome, FiFileText, FiAlertCircle } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { useLicenseWarning } from '../../context/LicenseWarningContext';
import api from '../../api';
import { US_STATES } from '../../constants';
import '../../pages/settings/Settings.css';
import Tooltip from '../utils/Tooltip';
import { toast } from 'react-hot-toast';

// Helper function to parse date from various formats
const parseDate = (dateString) => {
  if (!dateString) return null;
  
  // Try standard Date parsing first
  let date = new Date(dateString);
  
  // Check if the date is valid
  if (isNaN(date.getTime())) {
    // Try to parse MM/DD/YYYY or M/D/YY format
    const parts = dateString.split(/[\/\-]/);
    if (parts.length === 3) {
      // Try different date formats
      if (parts[0].length === 4) {
        // YYYY-MM-DD format
        date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      } else if (parts[2].length === 2) {
        // M/D/YY format - Add '20' prefix to year
        const year = parseInt('20' + parts[2]);
        date = new Date(year, parseInt(parts[0]) - 1, parseInt(parts[1]));
      } else {
        // MM/DD/YYYY format
        date = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
      }
    }
  }
  
  return isNaN(date.getTime()) ? null : date;
};

// Format date to MM/DD/YYYY for display
const formatDateForDisplay = (dateString) => {
  if (!dateString) return '';
  
  const date = parseDate(dateString);
  if (!date) return dateString; // Return original if parsing failed
  
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${month}/${day}/${year}`;
};

// Format date to YYYY-MM-DD for input elements
const formatDateForInput = (dateString) => {
  if (!dateString) return '';
  
  const date = parseDate(dateString);
  if (!date) return dateString; // Return original if parsing failed
  
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${year}-${month}-${day}`;
};

// Helper function to check if a license is expiring soon (within a month)
const isExpiringSoon = (expiryDateStr) => {
  if (!expiryDateStr) return false;
  
  const expiryDate = parseDate(expiryDateStr);
  if (!expiryDate) return false;
  
  const currentDate = new Date();
  const oneMonthLater = new Date(currentDate);
  oneMonthLater.setMonth(currentDate.getMonth() + 1);
  
  return expiryDate <= oneMonthLater && expiryDate >= currentDate;
};

// State outline background component
const StateOutlineBackground = ({ stateCode }) => {
  const [outlineImage, setOutlineImage] = useState(null);
  
  useEffect(() => {
    if (!stateCode) return;
    
    // Import directly from public folder - more reliable for assets
    const imageUrl = `/assets/outline-${stateCode.toLowerCase()}.svg`;
    
    // First check if the image exists before setting it
    fetch(imageUrl)
      .then(response => {
        if (response.ok) {
          setOutlineImage(imageUrl);
        } else {
          console.warn(`State outline SVG not found for ${stateCode}`);
          setOutlineImage(null);
        }
      })
      .catch(error => {
        console.error(`Error loading state outline: ${error}`);
        setOutlineImage(null);
      });
    
  }, [stateCode]);
  
  if (!outlineImage) return null;
  
  return (
    <div className="state-outline-background">
      <img 
        src={outlineImage} 
        alt=""
        aria-hidden="true"
      />
    </div>
  );
};

// License settings component
const LicenseSettings = () => {
  const { user } = useAuth();
  const { hasWarning, loading: licenseWarningLoading, refreshStatus } = useLicenseWarning();
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);
  
  // State for adding/editing a license
  const [isAdding, setIsAdding] = useState(false);
  const [editingLicenseId, setEditingLicenseId] = useState(null);
  const [newLicense, setNewLicense] = useState({
    state: '',
    license_number: '',
    expiry_date: '',
    resident_state: false
  });
  
  // Fetch user licenses on component mount
  useEffect(() => {
    if (user?.userId) {
      fetchLicenses();
    }
  }, [user]);
  
  // Function to manually refresh license warning status
  const refreshLicenseWarnings = async () => {
    try {
      // Use the refreshStatus function from the license warning context
      // This will trigger a re-check of the license status without a page reload
      hasWarning && refreshStatus();
      
      // Log the refresh attempt for debugging
      console.log('[LicenseSettings] Refreshing license warning status');
    } catch (error) {
      console.error('[LicenseSettings] Error refreshing license warnings:', error);
    }
  };
  
  // Fetch licenses from API
  const fetchLicenses = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/licenses/${user.userId}`);
      setLicenses(response.data.licenses || []);
    } catch (error) {
      console.error('Error fetching licenses:', error);
      setError('Failed to load licenses. Please try again later.');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle input change for new/edited license
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let newValue = type === 'checkbox' ? checked : value;
    
    // Special case for resident_state change
    if (name === 'resident_state' && newValue === true) {
      // Check if there's already a resident state that's not the one being edited
      const hasAnotherResidentState = licenses.some(license => 
        license.resident_state === 1 && license.id !== editingLicenseId
      );
      
      if (hasAnotherResidentState) {
        setError('You can only have one resident state. Please uncheck the existing resident state first.');
        return; // Prevent the change
      }
    }
    
    setNewLicense(prev => ({
      ...prev,
      [name]: newValue
    }));
    
    // Clear the error for this field when user makes changes
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };
  
  // Validate expiry date format
  const validateExpiryDateFormat = (date) => {
    if (!date) return true;
    
    if (date.includes('-')) {
      // Handle YYYY-MM-DD format (input type="date")
    return true;
    } else {
      // Check for M/D/YY format with regex
      const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/;
      return regex.test(date);
    }
  };
  
  // Handle expiry date blur to validate
  const handleExpiryBlur = () => {
    if (newLicense.expiry_date) {
      validateExpiryDateFormat(newLicense.expiry_date);
    }
  };
  
  // Start adding a new license
  const handleAddNew = () => {
    // Check if a resident state already exists
    const hasResidentState = licenses.some(license => license.resident_state === 1);
    
    setNewLicense({
      state: '',
      license_number: '',
      expiry_date: '',
      resident_state: false // Always default to false, especially if resident state exists
    });
    setFormErrors({});
    setIsAdding(true);
    setEditingLicenseId(null);
    setError('');
  };
  
  // Start editing existing license
  const handleEdit = (license) => {
    // If it's a resident license, may want to warn the user
    if (license.resident_state === 1) {
      // Optional: We could show a warning here if needed
    }
    
    setNewLicense({
      state: license.state || '',
      license_number: license.license_number?.toString() || '',
      expiry_date: license.expiry_date ? formatDateForInput(license.expiry_date) : '',
      resident_state: license.resident_state === 1
    });
    setFormErrors({});
    setEditingLicenseId(license.id);
    setIsAdding(false);
    setError('');
  };
  
  // Cancel adding/editing
  const handleCancel = () => {
    setIsAdding(false);
    setEditingLicenseId(null);
    setError('');
    setFormErrors({});
  };
  
  // Validate the form
  const validateForm = () => {
    const errors = {};
    
    if (!newLicense.state) {
      errors.state = 'State is required';
    }
    
    if (newLicense.expiry_date && !validateExpiryDateFormat(newLicense.expiry_date)) {
      errors.expiry_date = 'Invalid date format (use MM/DD/YYYY)';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Save a new license
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }
    
    try {
      setSubmitLoading(true);
      
      const licenseData = {
        userId: user.userId,
        lagnname: user.lagnname || user.name || '',
        state: newLicense.state,
        license_number: newLicense.license_number,
        expiry_date: newLicense.expiry_date,
        resident_state: newLicense.resident_state
      };
      
      if (isAdding) {
        // Add new license
        await api.post('/licenses', licenseData);
        toast.success('License added successfully');
      } else {
        // Update existing license
        await api.put(`/licenses/${editingLicenseId}`, licenseData);
        toast.success('License updated successfully');
      }
      
      // Refresh the licenses list
      fetchLicenses();
      
      // Clean up
      setIsAdding(false);
      setEditingLicenseId(null);
      setNewLicense({
        state: '',
        license_number: '',
        expiry_date: '',
        resident_state: false
      });
      
      // Refresh warning indicators
      refreshLicenseWarnings();
      
    } catch (error) {
      console.error('Error saving license:', error);
      toast.error('Failed to save license information');
    } finally {
      setSubmitLoading(false);
    }
  };
  
  // Delete a license
  const handleDelete = async (licenseId) => {
    if (!window.confirm('Are you sure you want to delete this license?')) {
      return;
    }
    
    try {
      setLoading(true);
      await api.delete(`/licenses/${licenseId}`);
      toast.success('License deleted successfully');
      fetchLicenses();
      
      // Refresh warning indicators
      refreshLicenseWarnings();
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (error) {
      console.error('Error deleting license:', error);
      toast.error('Failed to delete license');
    } finally {
      setLoading(false);
    }
  };
  
  // Get the full state name for display
  const getStateName = (stateCode) => {
    const state = US_STATES.find(s => s.code === stateCode);
    return state ? state.name : stateCode;
  };
  
  if (loading && licenses.length === 0) {
    return (
      <div className="settings-section">
        <div className="settings-loading">
          <div className="spinner"></div>
          <p>Loading licenses...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="settings-section">
      <div className="settings-header">
        <h1 className="settings-section-title">Licensing</h1>
        {!isAdding && editingLicenseId === null && (
          <button 
            className="settings-icon-button"
            onClick={handleAddNew}
            aria-label="Add new license"
          >
            <FiPlus />
          </button>
        )}
      </div>
      
      {error && <div className="settings-alert settings-alert-error">{error}</div>}
      {success && <div className="settings-alert settings-alert-success">{success}</div>}
      
      <div className="settings-card">
        <h2 className="settings-card-title">My Licenses</h2>
        <p className="settings-card-description">
          Manage the states where you hold insurance licenses. This information helps ensure you only receive leads from states where you're authorized to do business.
        </p>
        
        {/* Add New License Form */}
        {isAdding && (
          <div className="license-item license-item-editing">
            {newLicense.state && <StateOutlineBackground stateCode={newLicense.state} />}
            <div className="license-edit-form">
              <div className="license-edit-fields">
                <div className="license-edit-row">
                  <div className="license-state-field">
                    <select 
                      id="state"
                      name="state"
                      value={newLicense.state}
                      onChange={handleInputChange}
                      className={`state-select ${formErrors.state ? 'input-error' : ''}`}
                    >
                      <option value="">Select</option>
                      {US_STATES.map(state => (
                        <option key={state.code} value={state.code}>
                          {state.code}
                        </option>
                      ))}
                    </select>
                    <div className="license-state-name">
                      {newLicense.state && getStateName(newLicense.state)}
                    </div>
                    {formErrors.state && (
                      <div className="input-error-message small">{formErrors.state}</div>
                    )}
                  </div>
                  
                  <div 
                    className={`resident-badge ${newLicense.resident_state ? 'active' : 'inactive'}`}
                    onClick={() => {
                      // If trying to set to resident, check if another resident state exists
                      if (!newLicense.resident_state) {
                        const hasAnotherResidentState = licenses.some(license => 
                          license.resident_state === 1 && license.id !== editingLicenseId
                        );
                        
                        if (hasAnotherResidentState) {
                          setError('You can only have one resident state. Please uncheck the existing resident state first.');
                          return;
                        }
                      }
                      
                      setNewLicense(prev => ({
                        ...prev,
                        resident_state: !prev.resident_state
                      }));
                    }}
                  >
                    {newLicense.resident_state ? (
                      <>
                        <FiHome size={12} /> Resident
                      </>
                    ) : 'Non-Resident'}
                  </div>
                </div>
                
                <div className="license-edit-row">
                  <div className="license-field">
                    <label>
                      <FiCreditCard className="field-icon-small" />
                      License:
                    </label>
                    <input 
                      type="text" 
                      name="license_number"
                      value={newLicense.license_number}
                      onChange={handleInputChange}
                      placeholder="Enter license number (optional)"
                      className={formErrors.license_number ? 'input-error' : ''}
                    />
                    {formErrors.license_number && (
                      <div className="input-error-message small">{formErrors.license_number}</div>
                    )}
                  </div>
                </div>
                
                <div className="license-edit-row">
                  <div className="license-field">
                    <label>
                      <FiCalendar className="field-icon-small" />
                      Expires:
                    </label>
                    <input 
                      type="date" 
                      name="expiry_date"
                      value={newLicense.expiry_date}
                      onChange={handleInputChange}
                      className={formErrors.expiry_date ? 'input-error' : ''}
                    />
                    {formErrors.expiry_date && (
                      <div className="input-error-message small">{formErrors.expiry_date}</div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="license-actions">
                <button 
                  className="license-action-button"
                  onClick={handleSave}
                  disabled={submitLoading || Object.keys(formErrors).length > 0}
                  aria-label="Add license"
                >
                  {submitLoading ? (
                    <div className="spinner button-spinner-small"></div>
                  ) : (
                    <FiCheck />
                  )}
                </button>
                <button 
                  className="license-action-button"
                  onClick={handleCancel}
                  disabled={submitLoading}
                  aria-label="Cancel adding"
                >
                  <FiX />
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Licenses List */}
        {licenses.length === 0 && !isAdding ? (
          <div className="empty-state">
            <div className="empty-icon">
              <FiFileText size={40} />
            </div>
            <h3>No Licenses Added</h3>
            <p>You don't have any licenses yet. Add your first license to get started.</p>
            <button 
              className="settings-button settings-button-primary"
              onClick={handleAddNew}
            >
              <FiPlus /> Add License
            </button>
          </div>
        ) : (
          <div className="licenses-list">
            {licenses.map(license => (
              <div 
                key={license.id} 
                className={`license-item ${editingLicenseId === license.id ? 'license-item-editing' : ''}`}
              >
                {license.state && <StateOutlineBackground stateCode={license.state} />}
                {editingLicenseId === license.id ? (
                  // Inline edit mode
                  <div className="license-edit-form">
                    <div className="license-edit-fields">
                      <div className="license-edit-row">
                        <div className="license-state-field">
                          <select 
                            name="state"
                            value={newLicense.state}
                            onChange={handleInputChange}
                            className={`state-select ${formErrors.state ? 'input-error' : ''}`}
                          >
                            {US_STATES.map(state => (
                              <option key={state.code} value={state.code}>
                                {state.code}
                              </option>
                            ))}
                          </select>
                          <div className="license-state-name">
                            {getStateName(newLicense.state)}
                          </div>
                          {formErrors.state && (
                            <div className="input-error-message small">{formErrors.state}</div>
                          )}
                        </div>
                        
                        <div 
                          className={`resident-badge ${newLicense.resident_state ? 'active' : 'inactive'}`}
                          onClick={() => {
                            // If trying to set to resident, check if another resident state exists
                            if (!newLicense.resident_state) {
                              const hasAnotherResidentState = licenses.some(license => 
                                license.resident_state === 1 && license.id !== editingLicenseId
                              );
                              
                              if (hasAnotherResidentState) {
                                setError('You can only have one resident state. Please uncheck the existing resident state first.');
                                return;
                              }
                            }
                            
                            setNewLicense(prev => ({
                              ...prev,
                              resident_state: !prev.resident_state
                            }));
                          }}
                        >
                          {newLicense.resident_state ? (
                            <>
                              <FiHome size={12} /> Resident
                            </>
                          ) : 'Non-Resident'}
                        </div>
                      </div>
                      
                      <div className="license-edit-row">
                        <div className="license-field">
                          <label>
                            <FiCreditCard className="field-icon-small" />
                            License:
                          </label>
                          <input 
                            type="text" 
                            name="license_number"
                            value={newLicense.license_number}
                            onChange={handleInputChange}
                            placeholder="Enter license number (optional)"
                            className={formErrors.license_number ? 'input-error' : ''}
                          />
                          {formErrors.license_number && (
                            <div className="input-error-message small">{formErrors.license_number}</div>
                          )}
                        </div>
                      </div>

                      <div className="license-edit-row">
                        <div className="license-field">
                          <label>
                            <FiCalendar className="field-icon-small" />
                            Expires:
                          </label>
                          <input 
                            type="date" 
                            name="expiry_date"
                            value={newLicense.expiry_date}
                            onChange={handleInputChange}
                            className={formErrors.expiry_date ? 'input-error' : ''}
                          />
                          {formErrors.expiry_date && (
                            <div className="input-error-message small">{formErrors.expiry_date}</div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="license-actions">
                      <button 
                        className="license-action-button"
                        onClick={handleSave}
                        disabled={submitLoading || Object.keys(formErrors).length > 0}
                        aria-label="Save license"
                      >
                        {submitLoading ? (
                          <div className="spinner button-spinner-small"></div>
                        ) : (
                          <FiCheck />
                        )}
                      </button>
                      <button 
                        className="license-action-button"
                        onClick={handleCancel}
                        disabled={submitLoading}
                        aria-label="Cancel editing"
                      >
                        <FiX />
                      </button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <>
                    <div className="license-details">
                      <div className="license-state">
                        <div className="license-state-code">
                          {license.state}
                        </div>
                        <div className="license-state-name">
                          {getStateName(license.state)}
                        </div>
                        {license.resident_state === 1 && (
                          <span className="resident-badge">
                            <FiHome size={12} /> Resident
                          </span>
                        )}
                      </div>
                      <div className="license-info">
                        <div className="license-number">
                          <FiCreditCard className="license-icon" /> License: {license.license_number}
                        </div>
                        {license.expiry_date && (
                          <div className="license-expiry">
                            <FiCalendar className="license-icon" /> Expires: {formatDateForDisplay(license.expiry_date)}
                            {isExpiringSoon(license.expiry_date) && (
                              <Tooltip 
                                content="Visit the site you initially applied for this license through and renew. Once renewing, please update the new expiry date here to keep your info up to date for the lead team."
                                position="top"
                                className="license-tooltip"
                              >
                                <span className="expiring-soon-tag">
                                  <FiAlertCircle size={12} /> Expiring Soon
                                </span>
                              </Tooltip>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="license-actions">
                      <button 
                        className="license-action-button"
                        onClick={() => handleEdit(license)}
                        aria-label="Edit license"
                      >
                        <FiEdit />
                      </button>
                      <button 
                        className="license-action-button license-delete-button"
                        onClick={() => handleDelete(license.id)}
                        aria-label="Delete license"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LicenseSettings; 