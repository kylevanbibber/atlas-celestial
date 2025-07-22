import React, { useState, useEffect, useRef } from 'react';
import './DataTable.css';

const AddressContextMenu = ({ x, y, initialAddress, onSave, onClose }) => {
  const [address, setAddress] = useState(initialAddress || {
    street: '',
    city: '',
    state: '',
    zip: '',
  });
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleChange = (field, value) => {
    setAddress((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div
      ref={menuRef}
      className="address-context-menu"
      style={{
        left: x,
        top: y,
      }}
    >
      <input
        type="text"
        placeholder="Street"
        value={address.street}
        onChange={(e) => handleChange('street', e.target.value)}
      />
      <input
        type="text"
        placeholder="City"
        value={address.city}
        onChange={(e) => handleChange('city', e.target.value)}
      />
      <input
        type="text"
        placeholder="State"
        value={address.state}
        onChange={(e) => handleChange('state', e.target.value)}
      />
      <input
        type="text"
        placeholder="ZIP"
        value={address.zip}
        onChange={(e) => handleChange('zip', e.target.value)}
      />
      <div style={{ marginTop: '10px' }}>
        <button className="save" onClick={() => onSave(address)}>
          Save
        </button>
        <button className="cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default AddressContextMenu; 