import React from 'react';
import Select from 'react-select';

const DynamicField = ({ column, value, onChange }) => {
  if (column.type === 'select' && column.DropdownOptions) {
    return (
      <Select
        value={{ value, label: value }}
        onChange={(option) => onChange(option.value)}
        options={column.DropdownOptions.map(opt => ({ value: opt, label: opt }))}
        styles={{
          control: (base) => ({
            ...base,
            backgroundColor: column.dropdownBackgroundColor ? column.dropdownBackgroundColor(value) : '#fff',
            borderColor: '#ddd',
            '&:hover': {
              borderColor: '#007bff'
            }
          }),
          option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#007bff' : state.isFocused ? '#f0f0f0' : '#fff',
            color: state.isSelected ? '#fff' : '#333',
            '&:hover': {
              backgroundColor: state.isSelected ? '#007bff' : '#f0f0f0'
            }
          })
        }}
      />
    );
  }

  if (column.type === 'textarea') {
    return (
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        style={{
          width: '100%',
          padding: '0.5rem',
          border: '1px solid #ddd',
          borderRadius: '4px',
          fontSize: '0.875rem'
        }}
      />
    );
  }

  if (column.type === 'date') {
    return (
      <input
        type="datetime-local"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '0.5rem',
          border: '1px solid #ddd',
          borderRadius: '4px',
          fontSize: '0.875rem'
        }}
      />
    );
  }

  return (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '0.5rem',
        border: '1px solid #ddd',
        borderRadius: '4px',
        fontSize: '0.875rem'
      }}
    />
  );
};

export default DynamicField; 