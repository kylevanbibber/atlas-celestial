import React, { useState, useEffect } from "react";
import api from '../../../api';
import './MoreReport.css';

const MoreReportingStatus = ({ amoreData, filters, dateRange }) => {
  const [mgaData, setMgaData] = useState([]);
  const [groupedData, setGroupedData] = useState([]);
  const [showOnlyNotReported, setShowOnlyNotReported] = useState(false); // Toggle state for filtering

  useEffect(() => {
    const fetchMgaData = async () => {
      try {
        const response = await api.get('/more/get-mgas-with-activeusers');
        console.log('Fetched MGA Data:', response.data);
        if (response.data.success) {
          // Filter MGAs with hide = 'n' and active = 'y' (already done in backend)
          setMgaData(response.data.data);
        } else {
          console.error('Failed to fetch MGAs:', response.data.message);
        }
      } catch (error) {
        console.error('Error fetching MGAs:', error);
      }
    };

    fetchMgaData();
  }, []);

  useEffect(() => {
    if (mgaData.length) {
      // Apply MGA, RGA, and Tree filters
      const { MGA, RGA, Tree } = filters;

      const filtered = mgaData.filter((mga) => {
        if (MGA && mga.lagnname !== MGA) return false;
        if (RGA && mga.rga !== RGA) return false;
        if (Tree && mga.tree !== Tree) return false;
        return true;
      });

      // Check if MGAs are reported and/or reported automatically for the selected date range
      // amoreData is already filtered by the selected date range from MoreReport.js
      const reportedMGAs = amoreData.map((item) => ({
        lagnname: item.MGA,
        botEnter: item.bot_enter === 1, // Mark reported automatically
      }));

      // Map MGAs and add `isReported` and `isReportedAutomatically` properties
      const finalList = filtered.map((mga) => {
        const reportInfo = reportedMGAs.find((report) => report.lagnname === mga.lagnname);
        return {
          ...mga,
          isReported: !!reportInfo,
          isReportedAutomatically: reportInfo?.botEnter || false,
        };
      });

      // Group by Tree and calculate totals
      const grouped = finalList.reduce((acc, mga) => {
        if (!acc[mga.tree]) {
          acc[mga.tree] = {
            mgas: [],
            total: 0,
            reported: 0,
          };
        }
        acc[mga.tree].mgas.push(mga);
        acc[mga.tree].total += 1;
        if (mga.isReported) acc[mga.tree].reported += 1;
        return acc;
      }, {});

      // Sort MGAs alphabetically within each tree
      Object.keys(grouped).forEach((tree) => {
        grouped[tree].mgas = grouped[tree].mgas.sort((a, b) =>
          a.lagnname.localeCompare(b.lagnname)
        );
      });

      // Apply filtering to remove reported MGAs if toggled
      if (showOnlyNotReported) {
        Object.keys(grouped).forEach((tree) => {
          grouped[tree].mgas = grouped[tree].mgas.filter((mga) => !mga.isReported);
          // Add a placeholder row if no MGAs remain for the tree
          if (grouped[tree].mgas.length === 0) {
            grouped[tree].mgas = [{ placeholder: true }];
          }
        });
      }

      setGroupedData(grouped);
    }
  }, [filters, mgaData, amoreData, showOnlyNotReported]);

  const reformatName = (name) => {
    if (!name) return "Unknown";
    const capitalize = (word) =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    const parts = name.split(" ");
    const [last, first, ...rest] = parts;
    return `${capitalize(first || "")} ${capitalize(last || "")}`;
  };

  const formatDateRange = () => {
    if (!dateRange || !dateRange.start_date) return "";
    
    const startDate = new Date(dateRange.start_date);
    const endDate = new Date(dateRange.end_date);
    
    if (dateRange.type === 'week') {
      return `Week of ${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else if (dateRange.type === 'month') {
      return `${startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    } else if (dateRange.type === 'year') {
      return `${startDate.getFullYear()}`;
    } else {
      // Custom range
      if (dateRange.start_date === dateRange.end_date) {
        return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      } else {
        return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
    }
  };

  return (
    <div className="more-reporting-status-container">
      <div className="more-header-with-toggle-and-filters">
        <div>
          <h5>Reporting Status</h5>
          {formatDateRange() && (
            <p style={{ 
              margin: "4px 0 0 0", 
              fontSize: "14px", 
              color: "var(--text-secondary)", 
              fontWeight: "normal" 
            }}>
              {formatDateRange()}
            </p>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "10px" }}>
          <button
            onClick={() => setShowOnlyNotReported(!showOnlyNotReported)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "4px 8px",
              background: "#f0f0f0",
              border: "1px solid #ccc",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                fontSize: "10px",
                textDecoration: "none",
              }}
            >
              {showOnlyNotReported ? "Show All" : "Filter Reported"}
            </span>
          </button>
        </div>
      </div>

      {Object.keys(groupedData).length > 0 ? (
        <table className="recruiting-table">
          <tbody>
            {Object.entries(groupedData).map(([tree, { mgas, total, reported }]) => (
              <React.Fragment key={tree}>
                {/* Row for Tree */}
                <tr>
                  <td colSpan="3" style={{ fontWeight: "bold" }}>
                    {reformatName(tree)}
                  </td>
                </tr>
                {/* Rows for MGAs under the Tree */}
                {mgas.map((mga, index) =>
                  mga.placeholder ? (
                    <tr key={`${tree}-placeholder`}>
                      <td colSpan="3" style={{ textAlign: "center", fontStyle: "italic" }}>
                        All MGAs reported for this Tree{formatDateRange() ? ` (${formatDateRange()})` : ''}
                      </td>
                    </tr>
                  ) : (
                    <tr key={index}>
                      <td></td>
                      <td>{reformatName(mga.lagnname)}</td>
                      <td
                        style={{
                          color: mga.isReported
                            ? mga.isReportedAutomatically
                              ? "orange"
                              : "green"
                            : "black",
                        }}
                      >
                        {mga.isReportedAutomatically
                          ? "Reported Automatically"
                          : mga.isReported
                          ? "Reported"
                          : "Not Reported"}
                      </td>
                    </tr>
                  )
                )}
                {/* Total Row */}
                <tr>
                  <td></td>
                  <td
                    colSpan="2"
                    style={{
                      fontWeight: "bold",
                      textAlign: "right",
                      borderTop: "1px solid #ccc",
                    }}
                  >
                    Total Reported: {reported} / {total}
                  </td>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No MGAs match the current filters{formatDateRange() ? ` for ${formatDateRange()}` : ''}.</p>
      )}
    </div>
  );
};

export default MoreReportingStatus; 