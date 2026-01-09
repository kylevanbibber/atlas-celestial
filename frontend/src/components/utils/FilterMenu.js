// FilterMenu.js
import React, { useState } from "react";
import "./FilterMenu.css";

const FilterMenu = ({ options, onFilterChange }) => {
  const [selectedOption, setSelectedOption] = useState("");

  const handleChange = (e) => {
    setSelectedOption(e.target.value);
    if (onFilterChange) {
      onFilterChange(e.target.value);
    }
  };

  return (
    <div className="filter-menu">
      <select value={selectedOption} onChange={handleChange}>
        <option value="">🔍 Filter</option>
        {options.map((option, index) => (
          <option key={index} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
};

export default FilterMenu;
