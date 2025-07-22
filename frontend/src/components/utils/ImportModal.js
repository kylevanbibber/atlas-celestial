import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import "./ImportModal.css";

const ImportModal = ({
  isOpen,
  onClose,
  onImport,
  availableFields,
  columns,
  showToast,
  existingData = [],
  users = [], 
}) => {
  const [fileData, setFileData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [duplicates, setDuplicates] = useState([]); 
  const [duplicateActions, setDuplicateActions] = useState({}); 
  const [finalData, setFinalData] = useState(null); 
  const [selectedUser, setSelectedUser] = useState("");
  
  useEffect(() => {
    if (!isOpen) {
      setFileData([]);
      setHeaders([]);
      setMapping({});
      setDuplicates([]);
      setDuplicateActions({});
      setFinalData(null);
    }
  }, [isOpen]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      if (jsonData.length) {
        const fileHeaders = jsonData[0].map(header => header.trim());
        setHeaders(fileHeaders);
        setFileData(jsonData.slice(1));
        const fields =
          availableFields && availableFields.length > 0
            ? availableFields
            : columns
            ? columns.map((col) => col.Header)
            : [];
        const defaultMapping = {};
        fileHeaders.forEach((header) => {
          const match = fields.find(
            (field) => field.toLowerCase() === header.toLowerCase()
          );
          defaultMapping[header] = match || "";
        });
        setMapping(defaultMapping);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleMappingChange = (fileHeader, newField) => {
    setMapping((prevMapping) => ({
      ...prevMapping,
      [fileHeader]: newField,
    }));
  };

  const transformData = () => {
    const transformedData = fileData.map((row) => {
      const rowObj = {};
      headers.forEach((header, index) => {
        const trimmedHeader = header.trim();
        const targetField = mapping[trimmedHeader];
        if (targetField) {
          const cellValue = row[index];
          rowObj[targetField] = cellValue !== undefined ? cellValue : "";
        }
      });
      if (!rowObj.assigned_to && selectedUser) {
        rowObj.assigned_to = selectedUser;
      }
      return rowObj;
    });
    return transformedData;
  };

  const checkDuplicates = (data) => {
    const existingEmails = existingData.map(item => item.email);
    const dupes = [];
    data.forEach((row, index) => {
      if (row.email && row.name) {
        existingData.forEach((item) => {
          if (
            item.email &&
            item.name &&
            item.email.toLowerCase() === row.email.toLowerCase() &&
            item.name.toLowerCase() === row.name.toLowerCase()
          ) {
            let differences = false;
            for (const key in row) {
              if (row.hasOwnProperty(key)) {
                const newValue = row[key] || "";
                const existingValue = item[key] || "";
                if (
                  String(newValue).trim().toLowerCase() !==
                  String(existingValue).trim().toLowerCase()
                ) {
                  differences = true;
                  break;
                }
              }
            }
            dupes.push({ index, existingId: item.id, row, differences });
          }
        });
      }
    });
    return dupes;
  };

  const handleSubmit = () => {
    const transformed = transformData();
    const dupes = checkDuplicates(transformed);

    if (dupes.length > 0) {
      const defaultActions = {};
      dupes.forEach(({ index, differences }) => {
        defaultActions[index] = differences ? "update" : "skip";
      });
      setDuplicateActions(defaultActions);
      setDuplicates(dupes);
      setFinalData(null);
    } else {
      onImport(transformed);
      onClose();
    }
  };

  const handleFinalSubmit = () => {
    const transformed = transformData();
  
    const finalImportData = transformed.reduce((acc, row, idx) => {
      if (duplicateActions.hasOwnProperty(idx)) {
        const action = duplicateActions[idx];
        if (action === "skip") {
          return acc;
        } else if (action === "update" || action === "insert") {
          const { _duplicateAction, ...rest } = row;
          acc.push(rest);
          return acc;
        }
      } else {
        acc.push(row);
        return acc;
      }
    }, []);
  
    const totalRows = transformed.length;
    const skippedCount = transformed.reduce((count, row, idx) => {
      return duplicateActions.hasOwnProperty(idx) && duplicateActions[idx] === "skip"
        ? count + 1
        : count;
    }, 0);
    const insertedCount = totalRows - skippedCount;
  
    if (typeof showToast === "function") {
      showToast(
        `Import completed: ${skippedCount} row${skippedCount !== 1 ? "s" : ""} skipped, ${insertedCount} row${insertedCount !== 1 ? "s" : ""} inserted.`,
        "info"
      );
    }
  
    if (finalImportData.length === 0) {
      onClose();
      return;
    }
  
    onImport(finalImportData);
    onClose();
  };

  const handleDuplicateActionChange = (index, action) => {
    setDuplicateActions((prev) => ({ ...prev, [index]: action }));
  };

  return (
    <>
      {isOpen && (
        <div className="import-modal-overlay">
          <div className="import-modal">
            <h3>Import Users</h3>
            <button className="close-button" onClick={onClose}>
              ×
            </button>
            <div>
              <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
            </div>

            {headers.length > 0 && (
              <div className="mapping-container">
                <div className="assignment-container">
                  <label htmlFor="assignUser">Assign imported rows to:</label>
                  <select
                    id="assignUser"
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                  >
                    <option value="">-- Select User --</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>
                <h4>Map Columns</h4>
                {headers.map((header) => (
                  <div key={header} className="mapping-row">
                    <div className="file-header">{header}</div>
                    <select
                      value={mapping[header] || ""}
                      onChange={(e) => handleMappingChange(header, e.target.value)}
                      className={mapping[header] ? "matched" : "unmatched"}
                    >
                      <option value="">-- Select Field --</option>
                      {columns.map((col) => (
                        <option key={col.accessor} value={col.accessor}>
                          {col.Header}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {duplicates.length > 0 ? (
              <div className="duplicate-review">
                <h4>Duplicate Review</h4>
                {duplicates.map(({ index, row, differences }) => (
                  <div key={index} className="duplicate-row">
                    <div>
                      <strong>Row {index + 1}:</strong> {row.name} ({row.email})
                    </div>
                    <select
                      value={duplicateActions[index] || "skip"}
                      onChange={(e) =>
                        handleDuplicateActionChange(index, e.target.value)
                      }
                    >
                      <option value="skip">Skip</option>
                      <option value="update">Update</option>
                      <option value="insert">Insert as New</option>
                    </select>
                  </div>
                ))}
                <button className="submit-button" onClick={handleFinalSubmit}>
                  Import with Selected Actions
                </button>
              </div>
            ) : (
              <button className="submit-button" onClick={handleSubmit}>
                Import
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ImportModal; 