// src/components/ContextMenuPortal.jsx
import React from "react";
import ReactDOM from "react-dom";
import "./ContextMenu.css";

const ContextMenuPortal = ({ children }) => {
  return ReactDOM.createPortal(
    children,
    document.body
  );
};

export default ContextMenuPortal;
