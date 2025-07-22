// Input.js
import React from "react";
import "./Input.css";

const Input = ({ label, value, onChange, placeholder = "", type = "text" }) => {
  return (
    <div className="input-group">
      {label && <label className="input-label">{label}</label>}
      <input
        className="input-field"
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </div>
  );
};

export default Input;
