import React from 'react';
import Select from 'react-select';

const SearchSelectInput = ({
  options,
  value,
  onChange,
  placeholder = 'Search...',
  isMulti = false,
  valueField = 'id',
  displayField = 'name'
}) => {
  const formattedOptions = options.map(opt => ({
    value: opt[valueField],
    label: opt[displayField]
  }));

  const selectedValue = isMulti
    ? value.map(v => formattedOptions.find(opt => opt.value === v))
    : formattedOptions.find(opt => opt.value === value);

  return (
    <Select
      value={selectedValue}
      onChange={(selected) => {
        if (isMulti) {
          onChange(selected ? selected.map(opt => opt.value) : []);
        } else {
          onChange(selected ? selected.value : null);
        }
      }}
      options={formattedOptions}
      isMulti={isMulti}
      placeholder={placeholder}
      styles={{
        control: (base) => ({
          ...base,
          minHeight: '36px',
          fontSize: '14px'
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
};

export default SearchSelectInput; 