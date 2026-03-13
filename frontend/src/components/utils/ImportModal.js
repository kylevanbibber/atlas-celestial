import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { FiCopy, FiX } from "react-icons/fi";
import "./ImportModal.css";

let _entryIdCounter = 0;

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
  assignFields = [],
  rowAssignField = null,
  stageChecklistItems = null,
}) => {
  const [step, setStep] = useState(1); // 1=file+mapping, 2=row assignment, 3=checklist, 4=duplicates/status
  const [fileData, setFileData] = useState([]);
  const [headers, setHeaders] = useState([]);
  // mappingEntries: array of { id, headerIndex, header } — allows duplicates of same column
  const [mappingEntries, setMappingEntries] = useState([]);
  // mapping keyed by entry id → target field
  const [mapping, setMapping] = useState({});
  const [duplicates, setDuplicates] = useState([]);
  const [duplicateActions, setDuplicateActions] = useState({});
  const [selectedUser, setSelectedUser] = useState("");
  const [assignSelections, setAssignSelections] = useState({});
  const [importStatus, setImportStatus] = useState(null);
  const [importMessage, setImportMessage] = useState("");

  // Per-row assignments for rowAssignField (index → value)
  const [rowAssignments, setRowAssignments] = useState({});
  // Transformed data built at end of step 1, used in step 2+
  const [transformedRows, setTransformedRows] = useState([]);
  // Pagination for row assign step
  const [rowPage, setRowPage] = useState(0);
  const ROWS_PER_PAGE = 50;

  // Checklist completion selections: { stageName: [itemId1, itemId2, ...] }
  const [checklistSelections, setChecklistSelections] = useState({});

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setFileData([]);
      setHeaders([]);
      setMappingEntries([]);
      setMapping({});
      setDuplicates([]);
      setDuplicateActions({});
      setSelectedUser("");
      setAssignSelections({});
      setImportStatus(null);
      setImportMessage("");
      setRowAssignments({});
      setTransformedRows([]);
      setRowPage(0);
      setChecklistSelections({});
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
        const fileHeaders = jsonData[0].map(header => String(header ?? '').trim()).filter(h => h !== '');
        setHeaders(fileHeaders);
        setFileData(jsonData.slice(1));
        const fields =
          availableFields && availableFields.length > 0
            ? availableFields
            : columns
            ? columns.map((col) => col.Header)
            : [];
        const entries = [];
        const defaultMapping = {};
        fileHeaders.forEach((header, index) => {
          const entryId = `col-${_entryIdCounter++}`;
          entries.push({ id: entryId, headerIndex: index, header });
          const match = fields.find(
            (field) => field.toLowerCase() === header.toLowerCase()
          );
          defaultMapping[entryId] = match || "";
        });
        setMappingEntries(entries);
        setMapping(defaultMapping);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleMappingChange = (entryId, newField) => {
    setMapping((prevMapping) => ({
      ...prevMapping,
      [entryId]: newField,
    }));
  };

  const handleDuplicateColumn = (entry) => {
    const newId = `col-${_entryIdCounter++}`;
    const newEntry = { id: newId, headerIndex: entry.headerIndex, header: entry.header };
    setMappingEntries(prev => {
      const idx = prev.findIndex(e => e.id === entry.id);
      const updated = [...prev];
      updated.splice(idx + 1, 0, newEntry);
      return updated;
    });
    setMapping(prev => ({ ...prev, [newId]: "" }));
  };

  const handleRemoveMappingEntry = (entryId) => {
    setMappingEntries(prev => prev.filter(e => e.id !== entryId));
    setMapping(prev => {
      const updated = { ...prev };
      delete updated[entryId];
      return updated;
    });
  };

  // Check if an entry is a duplicate (not the first occurrence of its headerIndex)
  const isDuplicateEntry = (entry) => {
    return mappingEntries.findIndex(e => e.headerIndex === entry.headerIndex) !==
      mappingEntries.indexOf(entry);
  };

  const buildTransformedData = () => {
    return fileData.map((row) => {
      const rowObj = {};
      mappingEntries.forEach((entry) => {
        const targetField = mapping[entry.id];
        if (targetField) {
          const cellValue = row[entry.headerIndex];
          // Only overwrite if this cell has a value (allows multiple columns mapped to same field)
          if (cellValue !== undefined && cellValue !== null && cellValue !== "") {
            rowObj[targetField] = cellValue;
          } else if (!(targetField in rowObj)) {
            rowObj[targetField] = "";
          }
        }
      });
      // Apply global assignment dropdowns (non-rowLevel)
      if (assignFields.length > 0) {
        assignFields.forEach(({ field }) => {
          if (assignSelections[field]) {
            if (rowObj[field]) {
              // Column was mapped — pass dropdown value as fallback
              rowObj[`_fallback_${field}`] = assignSelections[field];
            } else {
              rowObj[field] = assignSelections[field];
            }
          }
        });
      } else if (!rowObj.assigned_to && selectedUser) {
        rowObj.assigned_to = selectedUser;
      }
      return rowObj;
    });
  };

  // Get a display label for a row (name, email, or first mapped values)
  const getRowLabel = (row) => {
    if (row.name) return row.name;
    if (row.recruit_first || row.recruit_last) {
      return `${row.recruit_first || ''} ${row.recruit_last || ''}`.trim();
    }
    if (row.email) return row.email;
    if (row.phone) return row.phone;
    const vals = Object.values(row).filter(v => v);
    return vals[0] || `Row`;
  };

  // Step 1 → Step 2 (or straight to import if no rowAssignField)
  const handleNextFromMapping = () => {
    const transformed = buildTransformedData();
    setTransformedRows(transformed);

    if (rowAssignField) {
      // Pre-populate row assignments from column-mapped values
      const defaults = {};
      transformed.forEach((row, idx) => {
        if (row[rowAssignField.field]) {
          defaults[idx] = row[rowAssignField.field];
        }
      });
      setRowAssignments(defaults);
      setStep(2);
    } else {
      // No row assignment needed — go straight to import
      runImport(transformed);
    }
  };

  // Get unique stages that have checklist items
  const getStagesWithChecklist = (data) => {
    if (!stageChecklistItems || !rowAssignField) return [];
    const stageField = rowAssignField.field;
    const uniqueStages = [...new Set(data.map(r => r[stageField]).filter(Boolean))];
    return uniqueStages.filter(s => stageChecklistItems[s]?.length > 0);
  };

  // Step 2 → step 3 (checklist) or import
  const handleNextFromRowAssign = () => {
    // Apply per-row assignments to transformed data
    const finalData = transformedRows.map((row, idx) => {
      if (rowAssignments[idx]) {
        return { ...row, [rowAssignField.field]: rowAssignments[idx] };
      }
      return row;
    });
    setTransformedRows(finalData);

    const stagesWithItems = getStagesWithChecklist(finalData);
    if (stagesWithItems.length > 0) {
      setStep(3);
    } else {
      runImport(finalData);
    }
  };

  // Step 3 → import (attach checklist selections to each row)
  const handleNextFromChecklist = () => {
    const stageField = rowAssignField.field;
    const finalData = transformedRows.map(row => {
      const stage = row[stageField];
      const selected = checklistSelections[stage];
      if (selected && selected.length > 0) {
        return { ...row, _completedChecklistItems: selected };
      }
      return row;
    });
    runImport(finalData);
  };

  const toggleChecklistItem = (stageName, itemId) => {
    setChecklistSelections(prev => {
      const current = prev[stageName] || [];
      const updated = current.includes(itemId)
        ? current.filter(id => id !== itemId)
        : [...current, itemId];
      return { ...prev, [stageName]: updated };
    });
  };

  const toggleAllChecklistItems = (stageName, items, selectAll) => {
    setChecklistSelections(prev => ({
      ...prev,
      [stageName]: selectAll ? items.map(i => i.id) : [],
    }));
  };

  const importStepNum = stageChecklistItems && rowAssignField ? 4 : (rowAssignField ? 3 : 2);

  const runImport = async (data) => {
    const dupes = checkDuplicates(data);
    if (dupes.length > 0) {
      const defaultActions = {};
      dupes.forEach(({ index, differences }) => {
        defaultActions[index] = differences ? "update" : "skip";
      });
      setDuplicateActions(defaultActions);
      setDuplicates(dupes);
      setTransformedRows(data);
      setStep(importStepNum);
    } else {
      setStep(importStepNum);
      setImportStatus('importing');
      setImportMessage(`Importing ${data.length} row(s)...`);
      try {
        await onImport(data);
        setImportStatus('success');
        setImportMessage(`Successfully imported ${data.length} row(s).`);
      } catch (error) {
        console.error("Import error:", error);
        setImportStatus('error');
        setImportMessage(`Import failed: ${error?.message || 'Unknown error'}`);
      }
    }
  };

  const checkDuplicates = (data) => {
    const dupes = [];
    data.forEach((row, index) => {
      if (row.email && row.name && row.phone) {
        existingData.forEach((item) => {
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
            dupes.push({ index, existingId: item.id, row, differences });
          }
        });
      }
    });
    return dupes;
  };

  const handleFinalSubmit = async () => {
    const finalImportData = transformedRows.reduce((acc, row, idx) => {
      if (duplicateActions.hasOwnProperty(idx)) {
        const action = duplicateActions[idx];
        if (action === "skip") {
          // skip
        } else if (action === "update" || action === "insert") {
          const { _duplicateAction, ...rest } = row;
          acc.push(rest);
        } else {
          acc.push(row);
        }
      } else {
        acc.push(row);
      }
      return acc;
    }, []);

    const skippedCount = transformedRows.reduce((count, row, idx) => {
      return duplicateActions.hasOwnProperty(idx) && duplicateActions[idx] === "skip"
        ? count + 1
        : count;
    }, 0);
    const insertedCount = transformedRows.length - skippedCount;

    if (finalImportData.length === 0) {
      setImportStatus('success');
      setImportMessage('No new rows to import after duplicate review.');
      setDuplicates([]);
      return;
    }

    setDuplicates([]);
    setImportStatus('importing');
    setImportMessage(`Importing ${insertedCount} row(s), skipping ${skippedCount}...`);
    try {
      await onImport(finalImportData);
      setImportStatus('success');
      setImportMessage(`Import completed: ${skippedCount} row${skippedCount !== 1 ? "s" : ""} skipped, ${insertedCount} row${insertedCount !== 1 ? "s" : ""} inserted.`);
    } catch (error) {
      console.error("Import error:", error);
      setImportStatus('error');
      setImportMessage(`Import failed: ${error?.message || 'Unknown error'}`);
    }
  };

  // Row assign field options memo
  const rowAssignOptions = useMemo(() => {
    if (!rowAssignField) return [];
    return rowAssignField.options || [];
  }, [rowAssignField]);

  const hasChecklistStep = stageChecklistItems && rowAssignField;
  const totalSteps = 1 + (rowAssignField ? 1 : 0) + (hasChecklistStep ? 1 : 0) + 1;

  return (
    <>
      {isOpen && (
        <div className="import-modal-overlay">
          <div className="import-modal">
            <h3>{title}</h3>
            <button className="close-button" onClick={onClose}>
              ×
            </button>

            {/* Step indicator */}
            {headers.length > 0 && (
              <div className="import-step-indicator">
                {(() => {
                  let n = 1;
                  const steps = [];
                  steps.push(<span key="map" className={step === 1 ? 'active' : step > 1 ? 'completed' : ''}>{n++}. Map</span>);
                  if (rowAssignField) {
                    steps.push(<span key="assign" className={step === 2 ? 'active' : step > 2 ? 'completed' : ''}>{n++}. Assign</span>);
                  }
                  if (hasChecklistStep) {
                    steps.push(<span key="checklist" className={step === 3 ? 'active' : step > 3 ? 'completed' : ''}>{n++}. Checklist</span>);
                  }
                  steps.push(<span key="import" className={step === importStepNum ? 'active' : ''}>{n++}. Import</span>);
                  return steps;
                })()}
              </div>
            )}

            {/* STEP 1: File + Column Mapping + Global Assignments */}
            {step === 1 && (
              <>
                <div>
                  <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileChange} />
                </div>

                {headers.length > 0 && (
                  <div className="mapping-container">
                    {assignFields.length > 0 ? (
                      assignFields.map(({ field, label, options, valueKey, labelKey, placeholder }) => {
                        const opts = options || users;
                        const vKey = valueKey || 'id';
                        const lKey = labelKey || null;
                        return (
                          <div className="assignment-container" key={field}>
                            <label htmlFor={`assign-${field}`}>{label}:</label>
                            <select
                              id={`assign-${field}`}
                              value={assignSelections[field] || ""}
                              onChange={(e) => setAssignSelections(prev => ({ ...prev, [field]: e.target.value }))}
                            >
                              <option value="">{placeholder || '-- Select --'}</option>
                              {opts.map((item) => {
                                const val = item[vKey] ?? item;
                                const display = lKey ? item[lKey]
                                  : item.first_name ? `${item.first_name} ${item.last_name || ''}`.trim()
                                  : item.name || item.lagnname || String(val);
                                return (
                                  <option key={val} value={val}>{display}</option>
                                );
                              })}
                            </select>
                          </div>
                        );
                      })
                    ) : users.length > 0 ? (
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
                    ) : null}

                    <h4>Map File Columns to Database Fields</h4>
                    {mappingEntries.map((entry) => {
                      const isDupe = isDuplicateEntry(entry);
                      return (
                        <div key={entry.id} className="mapping-row">
                          <span className="file-header">{entry.header}{isDupe ? ' (copy)' : ''}</span>
                          <select
                            value={mapping[entry.id] || ""}
                            onChange={(e) =>
                              handleMappingChange(entry.id, e.target.value)
                            }
                            className={mapping[entry.id] ? "matched" : "unmatched"}
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
                              >
                                {field}
                              </option>
                            ))}
                          </select>
                          <button
                            className="mapping-action-btn"
                            title="Duplicate this column"
                            onClick={() => handleDuplicateColumn(entry)}
                          >
                            <FiCopy size={14} />
                          </button>
                          {isDupe && (
                            <button
                              className="mapping-action-btn mapping-remove-btn"
                              title="Remove this duplicate"
                              onClick={() => handleRemoveMappingEntry(entry.id)}
                            >
                              <FiX size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    <button className="submit-button" onClick={handleNextFromMapping}>
                      {rowAssignField ? 'Next: Assign Stages' : 'Import Data'}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* STEP 2: Per-row assignment (e.g. pipeline stage per row) */}
            {step === 2 && rowAssignField && (
              <div className="row-assign-step">
                <p className="row-assign-hint">
                  Assign a <strong>{rowAssignField.label || rowAssignField.field}</strong> to each row ({transformedRows.length} total).
                  Use "Set All" to apply one value to every row, or choose individually.
                </p>
                <div className="row-assign-set-all">
                  <label>Set All:</label>
                  <select
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const val = e.target.value;
                      const all = {};
                      transformedRows.forEach((_, idx) => { all[idx] = val; });
                      setRowAssignments(all);
                    }}
                    value=""
                  >
                    <option value="">-- Apply to all rows --</option>
                    {rowAssignOptions.map((opt) => {
                      const vKey = rowAssignField.valueKey || 'id';
                      const lKey = rowAssignField.labelKey || null;
                      const val = opt[vKey] ?? opt;
                      const display = lKey ? opt[lKey] : String(val);
                      return <option key={val} value={val}>{display}</option>;
                    })}
                  </select>
                </div>
                <div className="row-assign-list">
                  {transformedRows
                    .slice(rowPage * ROWS_PER_PAGE, (rowPage + 1) * ROWS_PER_PAGE)
                    .map((row, pageIdx) => {
                      const idx = rowPage * ROWS_PER_PAGE + pageIdx;
                      return (
                        <div key={idx} className="row-assign-row">
                          <span className="row-assign-label">
                            {idx + 1}. {getRowLabel(row)}
                          </span>
                          <select
                            value={rowAssignments[idx] || ""}
                            onChange={(e) => setRowAssignments(prev => ({ ...prev, [idx]: e.target.value }))}
                            className={rowAssignments[idx] ? "matched" : "unmatched"}
                          >
                            <option value="">-- {rowAssignField.placeholder || 'Select'} --</option>
                            {rowAssignOptions.map((opt) => {
                              const vKey = rowAssignField.valueKey || 'id';
                              const lKey = rowAssignField.labelKey || null;
                              const val = opt[vKey] ?? opt;
                              const display = lKey ? opt[lKey] : String(val);
                              return <option key={val} value={val}>{display}</option>;
                            })}
                          </select>
                        </div>
                      );
                    })}
                </div>
                {transformedRows.length > ROWS_PER_PAGE && (
                  <div className="row-assign-pagination">
                    <button
                      disabled={rowPage === 0}
                      onClick={() => setRowPage(p => p - 1)}
                    >
                      ← Prev
                    </button>
                    <span>
                      {rowPage * ROWS_PER_PAGE + 1}–{Math.min((rowPage + 1) * ROWS_PER_PAGE, transformedRows.length)} of {transformedRows.length}
                    </span>
                    <button
                      disabled={(rowPage + 1) * ROWS_PER_PAGE >= transformedRows.length}
                      onClick={() => setRowPage(p => p + 1)}
                    >
                      Next →
                    </button>
                  </div>
                )}
                <div className="row-assign-actions">
                  <button className="submit-button secondary" onClick={() => setStep(1)}>
                    Back
                  </button>
                  <button className="submit-button" onClick={handleNextFromRowAssign}>
                    {hasChecklistStep ? 'Next: Checklist' : 'Import Data'}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Checklist completion (if stageChecklistItems provided) */}
            {step === 3 && hasChecklistStep && (
              <div className="row-assign-step">
                <p className="row-assign-hint">
                  Select which checklist items should be marked as <strong>completed</strong> for each stage.
                  Items left unchecked will remain pending.
                </p>
                {(() => {
                  const stageField = rowAssignField.field;
                  const uniqueStages = [...new Set(transformedRows.map(r => r[stageField]).filter(Boolean))];
                  const stagesWithItems = uniqueStages.filter(s => stageChecklistItems[s]?.length > 0);

                  if (stagesWithItems.length === 0) {
                    return <p style={{ color: 'var(--text-secondary, #888)', fontSize: 13 }}>No checklist items found for the assigned stages.</p>;
                  }

                  return stagesWithItems.map(stageName => {
                    const items = stageChecklistItems[stageName] || [];
                    const selected = checklistSelections[stageName] || [];
                    const allSelected = items.length > 0 && items.every(i => selected.includes(i.id));
                    const rowCount = transformedRows.filter(r => r[stageField] === stageName).length;

                    return (
                      <div key={stageName} className="checklist-stage-group">
                        <div className="checklist-stage-header">
                          <strong>{stageName}</strong>
                          <span className="checklist-stage-count">{rowCount} recruit{rowCount !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="checklist-select-all">
                          <label>
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={() => toggleAllChecklistItems(stageName, items, !allSelected)}
                            />
                            <span>Select All</span>
                          </label>
                        </div>
                        <div className="checklist-items-list">
                          {items.sort((a, b) => (a.item_order || 0) - (b.item_order || 0)).map(item => (
                            <label key={item.id} className="checklist-item-row">
                              <input
                                type="checkbox"
                                checked={selected.includes(item.id)}
                                onChange={() => toggleChecklistItem(stageName, item.id)}
                              />
                              <span className="checklist-item-name">{item.item_name}</span>
                              {item.is_required ? <span className="checklist-required">Required</span> : null}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
                <div className="row-assign-actions">
                  <button className="submit-button secondary" onClick={() => setStep(2)}>
                    Back
                  </button>
                  <button className="submit-button" onClick={handleNextFromChecklist}>
                    Import Data
                  </button>
                </div>
              </div>
            )}

            {/* STEP: Import status + duplicate review */}
            {step === importStepNum && (
              <>
                {importStatus && (
                  <div className={`import-status import-status-${importStatus}`}>
                    {importStatus === 'importing' && <div className="import-spinner" />}
                    <span>{importMessage}</span>
                    {(importStatus === 'success' || importStatus === 'error') && (
                      <button className="submit-button" onClick={onClose} style={{ marginTop: 12 }}>
                        Done
                      </button>
                    )}
                  </div>
                )}

                {!importStatus && duplicates.length > 0 && (
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
                            setDuplicateActions((prev) => ({ ...prev, [index]: e.target.value }))
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
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ImportModal;