import React, { useState, useEffect, useRef } from 'react';
import './DataTable.css';

const CustomAutocomplete = ({
  value,
  onChange,
  onKeyDown,
  options,
  inputRef,
  onCreateNew,
  style = {},
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const [filteredOptions, setFilteredOptions] = useState(options);
  const wrapperRef = useRef(null);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const filtered = options.filter((option) =>
      option.toLowerCase().includes(inputValue.toLowerCase())
    );
    setFilteredOptions(filtered);
  }, [inputValue, options]);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsOpen(true);
    onChange(newValue);
  };

  const handleOptionClick = (option) => {
    setInputValue(option);
    onChange(option);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', ...style }}>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={onKeyDown}
        onFocus={() => setIsOpen(true)}
        style={{ width: '100%', padding: '5px' }}
      />
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            maxHeight: '200px',
            overflowY: 'auto',
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            zIndex: 1000,
          }}
        >
          {filteredOptions.map((option, index) => (
            <div
              key={index}
              onClick={() => handleOptionClick(option)}
              style={{
                padding: '8px',
                cursor: 'pointer',
                backgroundColor: inputValue === option ? '#f0f0f0' : 'white',
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = '#f5f5f5';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor =
                  inputValue === option ? '#f0f0f0' : 'white';
              }}
            >
              {option}
            </div>
          ))}
          {onCreateNew && inputValue && !options.includes(inputValue) && (
            <div
              onClick={() => {
                onCreateNew(inputValue);
                setIsOpen(false);
              }}
              style={{
                padding: '8px',
                cursor: 'pointer',
                borderTop: '1px solid #ddd',
                color: '#0066cc',
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = '#f5f5f5';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = 'white';
              }}
            >
              Create "{inputValue}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomAutocomplete; 