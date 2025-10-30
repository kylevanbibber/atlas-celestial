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
  title = "Import Data", 
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
        console.log("File Headers:", fileHeaders);
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
        console.log("Default Mapping:", defaultMapping);
        setMapping(defaultMapping);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleMappingChange = (fileHeader, newField) => {
    console.log(`Mapping change - File header: ${fileHeader}, New field: ${newField}`);
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
          if (trimmedHeader.toLowerCase() === "phone") {
            console.log(`Raw value for phone:`, cellValue);
          }
          rowObj[targetField] = cellValue !== undefined ? cellValue : "";
        }
      });
      if (!rowObj.assigned_to && selectedUser) {
        rowObj.assigned_to = selectedUser;
      }
      return rowObj;
    });
    console.log("Transformed Data (rows to be inserted):", transformedData);
    return transformedData;
  };

  const checkDuplicates = (data) => {
    console.log("Existing data for duplicate checking:", existingData);
    const existingEmails = existingData.map(item => item.email);
    console.log("Existing Emails:", existingEmails);

    const dupes = [];
    data.forEach((row, index) => {
      console.log(`Checking new row index ${index}:`, row);
      if (row.email && row.name && row.phone) {
        existingData.forEach((item) => {
          console.log(
            `Comparing new row email (${row.email}) with existing email (${item.email})`
          );
          if (
            item.email &&
            item.name &&
            item.phone &&
            item.email.toLowerCase() === row.email.toLowerCase() &&
            item.name.toLowerCase() === row.name.toLowerCase() &&
            item.phone.toLowerCase() === row.phone.toLowerCase()
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
            console.log(
              `Found duplicate for row ${index} with existing item id ${item.id}. Differences found: ${differences}`
            );
            dupes.push({ index, existingId: item.id, row, differences });
          }
        });
      }
    });
    console.log("Duplicates Found:", dupes);
    return dupes;
  };

  const handleSubmit = () => {
    console.log("Handle Submit triggered");
    console.log("Current table data (existing data):", existingData);
    const transformed = transformData();
    console.log("Transformed data in handleSubmit:", transformed);
    console.log("Is transformed array?", Array.isArray(transformed));
    
    const dupes = checkDuplicates(transformed);

    if (dupes.length > 0) {
      const defaultActions = {};
      dupes.forEach(({ index, differences }) => {
        defaultActions[index] = differences ? "update" : "skip";
      });
      console.log("Default Duplicate Actions:", defaultActions);
      setDuplicateActions(defaultActions);
      setDuplicates(dupes);
      setFinalData(null);
      console.log("Duplicate review required. Waiting for user action on duplicate rows.");
    } else {
      console.log("No duplicates found. Proceeding with import.");
      console.log("About to call onImport with:", transformed);
      onImport(transformed);
      onClose();
    }
  };

  const handleFinalSubmit = () => {
    console.log("Finalizing import with duplicate actions:", duplicateActions);
    const transformed = transformData();
    console.log("Transformed data in handleFinalSubmit:", transformed);
    console.log("Is transformed array in final submit?", Array.isArray(transformed));
  
    const finalImportData = transformed.reduce((acc, row, idx) => {
      if (duplicateActions.hasOwnProperty(idx)) {
        const action = duplicateActions[idx];
        if (action === "skip") {
          console.log(`Skipping row ${idx} as per user action.`);
        } else if (action === "update" || action === "insert") {
          const { _duplicateAction, ...rest } = row;
          acc.push(rest);
        } else {
          // Handle unexpected action values
          console.warn(`Unexpected action ${action} for row ${idx}, including row anyway`);
          acc.push(row);
        }
      } else {
        acc.push(row);
      }
      return acc;
    }, []);
  
    const totalRows = transformed.length;
    const skippedCount = transformed.reduce((count, row, idx) => {
      return duplicateActions.hasOwnProperty(idx) && duplicateActions[idx] === "skip"
        ? count + 1
        : count;
    }, 0);
    const insertedCount = totalRows - skippedCount;
  
    console.log("Final Import Data (after duplicate review):", finalImportData);
    console.log("Is finalImportData array?", Array.isArray(finalImportData));
  
    if (typeof showToast === "function") {
      showToast(
        `Import completed: ${skippedCount} row${skippedCount !== 1 ? "s" : ""} skipped, ${insertedCount} row${insertedCount !== 1 ? "s" : ""} inserted.`,
        "info"
      );
    }
  
    if (finalImportData.length === 0) {
      console.log("No new rows to import after duplicate review.");
      onClose();
      return;
    }
  
    console.log("About to call onImport with:", finalImportData);
    onImport(finalImportData);
    onClose();
  };

  const handleDuplicateActionChange = (index, action) => {
    console.log(`Duplicate action change - Row index: ${index}, Action: ${action}`);
    setDuplicateActions((prev) => ({ ...prev, [index]: action }));
  };

  return (
    <>
      {isOpen && (
        <div className="import-modal-overlay">
          <div className="import-modal">
            <h3>{title}</h3>
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
                        {user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.name || user.lagnname}
                      </option>
                    ))}
                  </select>
                </div>
                <h4>Map File Columns to Database Fields</h4>
                {headers.map((header) => {
                  const usedFields = Object.entries(mapping)
                    .filter(([key, value]) => key !== header && value)
                    .map(([_, value]) => value);
                  return (
                    <div key={header} className="mapping-row">
                      <span className="file-header">{header}</span>
                      <select
                        value={mapping[header]}
                        onChange={(e) =>
                          handleMappingChange(header, e.target.value)
                        }
                        className={mapping[header] ? "matched" : "unmatched"}
                      >
                        <option value="">-- Select Field --</option>
                        {(availableFields && availableFields.length > 0
                          ? availableFields
                          : columns
                          ? columns.map((col) => col.Header)
                          : []
                        ).map((field) => (
                          <option
                            key={field}
                            value={field}
                            disabled={usedFields.includes(field)}
                          >
                            {field}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}

            {headers.length > 0 && duplicates.length === 0 && (
              <button className="submit-button" onClick={handleSubmit}>
                Import Data
              </button>
            )}
            {duplicates.length > 0 && (
              <div className="duplicate-review">
                <h4>Duplicate Records Found</h4>
                <p>
                  For rows detected as duplicates (based on email, name, and phone), choose an action:
                  <br />
                  <strong>Skip</strong> (ignore) or <strong>Insert as New</strong> (create a new record anyway).
                </p>
                {duplicates.map(({ index, existingId, row, differences }) => (
                  <div key={index} className="duplicate-row">
                    <span>
                      Row {index + 1} (Email: {row.email}, Name: {row.name}, Phone: {row.phone}){" "}
                      {differences ? "(Differences found)" : "(No differences)"}
                    </span>
                    <select
                      value={duplicateActions[index] || (differences ? "update" : "skip")}
                      onChange={(e) =>
                        handleDuplicateActionChange(index, e.target.value)
                      }
                    >
                      <option value="skip">Skip</option>
                      <option value="insert">Insert as New</option>
                    </select>
                  </div>
                ))}
                <button className="submit-button" onClick={handleFinalSubmit}>
                  Finalize Import
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ImportModal; 