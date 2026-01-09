// File: src/components/Cell.js

import React, { memo } from "react";
import CustomAutocomplete from "./CustomAutocomplete";
import { DateTime } from "luxon";

// contrast / darken helpers
const getContrastColor = (color) => {
  if (color[0] === "#") color = color.slice(1);
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? "black" : "white";
};
const darkenColor = (color, amount) => {
  let usePound = false;
  if (color[0] === "#") {
    color = color.slice(1);
    usePound = true;
  }
  let num = parseInt(color, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.max(0, Math.floor(r * (1 - amount)));
  g = Math.max(0, Math.floor(g * (1 - amount)));
  b = Math.max(0, Math.floor(b * (1 - amount)));
  const newColor = (r << 16) | (g << 8) | b;
  return (usePound ? "#" : "") + newColor.toString(16).padStart(6, "0");
};

export const Cell = memo(function Cell({
  cell,
  row,
  rowIndex,
  columnIndex,
  columns,
  localData,
  editedData,
  editingCell,
  selectedRows,
  toggleRowSelection,
  existingCompanies,
  onCreateCompany,
  onOpenDetails,
  handleEditStart,
  handleEditChange,
  onCellUpdate,
  onCellBlur,
  handleKeyDown,
  inputRef,
  onOpenAddressMenu,
}) {
  // Add comprehensive null checking for essential props
  if (!cell || !cell.column || !columns || !Array.isArray(columns) || !row || !row.original) {
    return "";
  }

  const column = columns.find((col) => col && col.accessor === cell.column.id);

  // If column is not found, return the cell value as-is
  if (!column) {
    return cell.value ?? "";
  }

  // Helper function to handle blur events
  const handleBlur = (value) => {
    if (onCellBlur) {
      onCellBlur(row.original.id, cell.column.id, value);
    }
    // Do not forcibly clear editing state here; navigation manages editing target.
  };

// in Cell.js, under massSelection:
if (column?.massSelection) {
    const rowId = row?.original?.id;
    if (!rowId || !toggleRowSelection) {
      return "";
    }
    return (
      <input
        className="mass-selection-checkbox"
        type="checkbox"
        checked={!!(selectedRows && selectedRows[rowId])}
        onChange={e => {
          e.stopPropagation();
          toggleRowSelection(rowId);
        }}
      />
    );
  }
  

  // 2) address
  if (column.accessor === "address") {
    const addr = cell.value || {
      address1: row.original.address1,
      address2: row.original.address2,
      city: row.original.city,
      state: row.original.state,
      zip: row.original.zip,
      county: row.original.county,
      country: row.original.country,
    };
    const left = [addr.address1, addr.address2, addr.city]
      .filter(Boolean)
      .join(" ");
    const right = [addr.state, addr.zip, addr.country || addr.county]
      .filter(Boolean)
      .join(" ");
    const display = left && right ? `${left}, ${right}` : left || right;

    return (
      <div
        onContextMenu={(e) => onOpenAddressMenu(e, addr, row.original.id)}
        onDoubleClick={(e) => onOpenAddressMenu(e, addr, row.original.id)}
      >
        <span>{display || "Click to add address"}</span>
      </div>
    );
  }

  // 3) company + autocomplete
  if (column.accessor === "company") {
    const editing =
      editingCell?.id === row.original.id && editingCell?.field === "company";
    const key = `${row.original.id}-company`;
    const val = (editedData[key] ?? cell.value) || "";
    const suggestions = existingCompanies
      .filter((c) => c.name.toLowerCase().includes(val.toLowerCase()))
      .map((c) => c.name);
    const valid = existingCompanies.some(
      (c) => c.name.trim().toLowerCase() === val.trim().toLowerCase()
    );
    const plusBtn = (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onCreateCompany(val, row.original);
        }}
        style={{
          position: "absolute",
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "0 4px",
          fontSize: "14px",
          color: "#000",
          marginLeft: "4px",
          lineHeight: 1,
          pointerEvents: "all",
        }}
        title="Add Company"
      >
        +
      </button>
    );

    if (editing) {
      return (
        <div style={{ position: "relative", display: "inline-block" }}>
          <CustomAutocomplete
            value={val}
            onChange={(v) => handleEditChange(row.original.id, "company", v)}
            onBlur={(e) => handleBlur(e.target.value)}
            suggestions={suggestions}
            chipStyle
          />
          {val && !valid && plusBtn}
        </div>
      );
    }
    if (val) {
      return valid ? (
        <div
          onDoubleClick={() =>
            onOpenDetails
              ? onOpenDetails(row.original)
              : handleEditStart(row.original.id, "company")
          }
          style={{
            userSelect: "none",
            cursor: "pointer",
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: "12px",
            backgroundColor: "#e0e0e0",
            position: "relative",
          }}
        >
          {val}
        </div>
      ) : (
        <div style={{ position: "relative", display: "inline-block" }}>
          <div
            onClick={() => handleEditStart(row.original.id, "company")}
            style={{ cursor: "text", paddingRight: "20px" }}
          >
            {val}
          </div>
          {plusBtn}
        </div>
      );
    }
    return (
      <div
        onClick={() => handleEditStart(row.original.id, "company")}
        style={{ cursor: "text", minHeight: "1.5em" }}
      />
    );
  }

  // 4) DropdownOptions
  if (column?.DropdownOptions) {
    const key = `${row.original.id}-${cell.column.id}`;
    const val = editedData[key] ?? cell.value;
    const bg = column.dropdownBackgroundColor
      ? column.dropdownBackgroundColor(val)
      : "#fff";
    const textColor = getContrastColor(bg);
    const borderColor = darkenColor(bg, 0.2);

    return (
      <select
        style={{
          backgroundColor: bg,
          color: textColor,
          border: `2px solid ${borderColor}`,
          width: "100%",
          boxSizing: "border-box",
          padding: "4px 8px",
          borderRadius: "4px",
          fontSize: "12px",
          fontWeight: "500",
          cursor: "pointer",
        }}
        value={val}
        tabIndex={0}
        onChange={(e) =>
          handleEditChange(row.original.id, cell.column.id, e.target.value)
        }
        onBlur={(e) => {
          console.log('[Cell] select onBlur', {
            rowId: row.original.id,
            field: cell.column.id,
            value: e.target.value
          });
          handleBlur(e.target.value);
        }}
        onKeyDown={(e) => {
          // Keep arrows and Enter/Space within the select
          if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " "].includes(e.key)) {
            e.stopPropagation();
            return;
          }
          // For Tab/Shift+Tab, move between cells
          if (e.key === "Tab") {
            console.log('[Cell] Tab on select', {
              rowIndex,
              columnIndex,
              rowId: row.original.id,
              field: cell.column.id,
              shiftKey: !!e.shiftKey
            });
            e.preventDefault();
            e.stopPropagation();
            // Blur current select to avoid trapped focus in some browsers
            if (e.currentTarget && typeof e.currentTarget.blur === 'function') {
              e.currentTarget.blur();
            }
            handleKeyDown(e, rowIndex, columnIndex);
            return;
          }
        }}
      >
        {column.DropdownOptions.map((opt) => (
          <option 
            key={opt} 
            value={opt}
            style={{
              backgroundColor: "#fff",
              color: "#333",
            }}
          >
            {opt}
          </option>
        ))}
      </select>
    );
  }

  // 5) custom column.Cell
  if (column?.Cell) {
    return column.Cell({
      value: cell.value,
      row,
      updateCell: handleEditChange,
      isEditing:
        editingCell?.id === row.original.id && editingCell?.field === cell.column.id,
    });
  }

  // 6) autocomplete
  if (column?.autocomplete) {
    const editing =
      editingCell?.id === row.original.id && editingCell?.field === cell.column.id;
    const key = `${row.original.id}-${cell.column.id}`;
    const val = editedData[key] ?? cell.value;
    const suggestions = Array.from(
      new Set(localData.map((i) => i[column.accessor]).filter((v) => v && v !== val))
    );
    const Aut = editing ? (
      <CustomAutocomplete
        value={val}
        onChange={(v) => handleEditChange(row.original.id, column.accessor, v)}
        onBlur={(e) => handleBlur(val)}
        suggestions={suggestions}
      />
    ) : (
      <span onDoubleClick={() => handleEditStart(row.original.id, column.accessor)}>
        {cell.value}
      </span>
    );
    if (column.buttonOnHover) {
      const { label, title, onClick } = column.buttonOnHover;
      return (
        <div className="button-on-hover-cell">
          {Aut}
          <button
            className="button-on-hover"
            title={title}
            onClick={() => onClick(row.original)}
          >
            {label}
          </button>
        </div>
      );
    }
    return Aut;
  }

  // 7) buttonOnHover (no-autocomplete)
  if (column?.buttonOnHover) {
    const { label, title, onClick } = column.buttonOnHover;
    return (
      <div className="button-on-hover-cell">
        <span>{cell.value}</span>
        <button className="button-on-hover" title={title} onClick={() => onClick(row.original)}>
          {label}
        </button>
      </div>
    );
  }

  // 8) chips
  if (column?.chips) {
    const chips = Array.isArray(cell.value)
      ? cell.value
      : `${cell.value}`.split(",").map((c) => c.trim());
    return (
      <div
        className="chip-container"
        onDoubleClick={() => handleEditStart(row.original.id, column.accessor, cell.value)}
      >
        {chips.map((chip, i) => {
          const colorFn = column.chipColor;
          const bg =
            typeof colorFn === "function"
              ? colorFn(chip, row.original)
              : colorFn || "#e0e0e0";
          return (
            <span
              key={i}
              className="chip"
              style={{ backgroundColor: bg, color: getContrastColor(bg) }}
            >
              {chip}
            </span>
          );
        })}
      </div>
    );
  }

  // 9) datePicker
  if (column?.datePicker) {
    const editing =
      editingCell?.id === row.original.id && editingCell?.field === column.accessor;
    
    // Check if the value is already in the correct format
    const isAlreadyFormatted = typeof cell.value === 'string' && 
      cell.value.match(/^\d{1,2}\/\d{1,2}\/\d{2} \d{1,2}:\d{2} [AP]M$/);
    
    const dt = isAlreadyFormatted 
      ? DateTime.fromFormat(cell.value, 'M/d/yy h:mm a')
      : cell.value
        ? DateTime.fromISO(cell.value).setZone(
            Intl.DateTimeFormat().resolvedOptions().timeZone
          )
        : null;
    
    const localStr = dt ? dt.toFormat("yyyy-MM-dd'T'HH:mm") : "";
    const dispStr = dt
      ? dt.toFormat("M/d/yy h:mm a")
      : "";
      
    if (editing) {
      return (
        <input
          ref={inputRef}
          type="datetime-local"
          value={localStr}
          onChange={(e) => {
            const picked = DateTime.fromFormat(
              e.target.value,
              "yyyy-MM-dd'T'HH:mm",
              { zone: "local" }
            );
            handleEditChange(row.original.id, column.accessor, picked.toISO());
          }}
          onBlur={(e) => handleBlur(localStr)}
          onKeyDown={(e) => handleKeyDown(e, rowIndex, columnIndex)}
        />
      );
    }
    return (
      <div 
        style={{ 
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => {
          const icon = e.currentTarget.querySelector('.calendar-icon');
          if (icon) icon.style.display = 'block';
        }}
        onMouseLeave={(e) => {
          const icon = e.currentTarget.querySelector('.calendar-icon');
          if (icon) icon.style.display = 'none';
        }}
      >
        <span onDoubleClick={() => handleEditStart(row.original.id, column.accessor)}>
          {dispStr}
        </span>
        <span 
          className="calendar-icon"
          style={{
            display: 'none',
            color: '#666',
            cursor: 'pointer',
            position: 'absolute',
            right: '8px'
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleEditStart(row.original.id, column.accessor);
          }}
        >
          📅
        </span>
      </div>
    );
  }

  // 10) chipDropdown
  if (column?.chipDropdown) {
    const key = `${row.original.id}-${column.accessor}`;
    const val = editedData[key] ?? cell.value;
    const colorFn = column.chipDropdownChipColor;
    const bg =
      typeof colorFn === "function" ? colorFn(row.original) : colorFn || "#e0e0e0";
    const textColor = getContrastColor(bg);
    return (
      <select
        style={{
          backgroundColor: bg,
          color: textColor,
          border: "none",
          borderRadius: "12px",
          padding: "2px 8px",
          fontSize: "12px",
          appearance: "none",
        }}
        value={val}
        onChange={(e) => handleEditChange(row.original.id, column.accessor, e.target.value)}
        onBlur={(e) => handleBlur(e.target.value)}
        onKeyDown={(e) => handleKeyDown(e, rowIndex, columnIndex)}
      >
        {column.chipDropdownOptions.map((opt) => (
          <option key={opt[column.chipDropdownValueField]} value={opt[column.chipDropdownValueField]}>
            {column.chipDropdownDisplay ? column.chipDropdownDisplay(opt) : opt[column.chipDropdownValueField]}
          </option>
        ))}
      </select>
    );
  }

  // 11) fallback editable
  const key = `${row.original.id}-${column.accessor}`;
  const editing =
    editingCell?.id === row.original.id && editingCell?.field === column.accessor;
  const disp = editing ? editedData[key] ?? cell.value : cell.value;
  if (editing) {
    // Handle numeric input validation for number type columns
    const handleKeyPress = (e) => {
      if (column.type === 'number') {
        // Allow: backspace, delete, tab, escape, enter, decimal point
        if ([8, 9, 27, 13, 110, 190, 46].indexOf(e.keyCode) !== -1 ||
            // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
            (e.keyCode === 65 && e.ctrlKey === true) ||
            (e.keyCode === 67 && e.ctrlKey === true) ||
            (e.keyCode === 86 && e.ctrlKey === true) ||
            (e.keyCode === 88 && e.ctrlKey === true)) {
          return; // Let it happen, don't do anything
        }
        // Ensure that it is a number and stop the keypress
        if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
          e.preventDefault();
        }
        // Only allow one decimal point
        if (e.key === '.' && e.target.value.includes('.')) {
          e.preventDefault();
        }
      }
    };

    const handleInputChange = (e) => {
      let value = e.target.value;
      
      // For number type columns, validate the input
      if (column.type === 'number' && value !== '') {
        // Only allow numbers and decimal point
        if (!/^\d*\.?\d*$/.test(value)) {
          return; // Don't update if invalid
        }
      }
      
      handleEditChange(row.original.id, column.accessor, value);
    };

    return (
      <input
        ref={inputRef}
        type={column.type === 'number' ? 'text' : 'text'} // Use text for better control
        inputMode={column.type === 'number' ? 'decimal' : 'text'}
        pattern={column.type === 'number' ? '[0-9]*\\.?[0-9]*' : undefined}
        value={disp}
        onChange={handleInputChange}
        onKeyDown={(e) => {
          handleKeyPress(e);
          handleKeyDown(e, rowIndex, columnIndex);
        }}
        onBlur={(e) => handleBlur(e.target.value)}
        {...(column.inputProps || {})}
      />
    );
  }
  return (
    <span
      className="editable-cell"
      data-rowid={row.original.id}
      data-field={column.accessor}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleEditStart(row.original.id, column.accessor, cell.value);
      }}
    >
      {cell.value}
    </span>
  );
},
(prev, next) => {
    // Add safety checks for essential props
    if (!next || !next.cell || !next.cell.column || !next.columns || !Array.isArray(next.columns)) {
      return false; // Force re-render if essential data is missing
    }
    
    // if this is the mass-selection column, always re-render
    const column = next.columns.find(
      (c) => c && c.accessor === next.cell.column.id
    );
    if (column?.massSelection) {
      return false;
    }
  
      const id    = next.row?.original?.id;
  const field = next.cell?.column?.id;
  const key   = `${id}-${field}`;

  // Add comprehensive null checking
  if (!id || !field) {
    return false; // Force re-render if essential data is missing
  }

  const valueUnchanged     = prev.cell?.value === next.cell?.value;
  const draftUnchanged     = prev.editedData?.[key] === next.editedData?.[key];
  
  // More defensive editing cell comparison
  const prevEditingId = prev.editingCell?.id;
  const prevEditingField = prev.editingCell?.field;
  const nextEditingId = next.editingCell?.id;
  const nextEditingField = next.editingCell?.field;
  
  const editingUnchanged   =
    !(prevEditingId === id && prevEditingField === field) &&
    !(nextEditingId === id && nextEditingField === field);
  
  const selectionUnchanged =
    !!prev.selectedRows?.[id] === !!next.selectedRows?.[id];
  
    return (
      valueUnchanged &&
      draftUnchanged &&
      editingUnchanged &&
      selectionUnchanged
    );
  }
  
);
