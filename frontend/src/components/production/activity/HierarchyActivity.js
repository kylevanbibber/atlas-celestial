import React, { useState, useEffect } from 'react';
import { FiChevronRight, FiLoader, FiUser, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { useAuth } from '../../../context/AuthContext';
import RightDetails from '../../utils/RightDetails';
import api from '../../../api';
import './HierarchyActivity.css';

const HierarchyActivity = ({ currentUserOnly = false }) => {
  const { hasPermission, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rgaHierarchies, setRgaHierarchies] = useState([]);
  const [expandedRGAs, setExpandedRGAs] = useState({});
  const [expandedNodes, setExpandedNodes] = useState({});
  const [error, setError] = useState('');
  const [showRightDetails, setShowRightDetails] = useState(false);
  const [rightDetailsData, setRightDetailsData] = useState(null);

  // Check if user is admin or regular user
  useEffect(() => {
    if (currentUserOnly) {
      fetchUserHierarchyData();
    } else if (!hasPermission('admin')) {
      fetchUserHierarchyData();
    } else {
      fetchAllRGAsHierarchy();
    }
  }, [currentUserOnly, hasPermission('admin'), user?.userId]);

  // Handle profile click - open agent profile in RightDetails
  const handleProfileClick = (node) => {
    const agentData = {
      __isAgentProfile: true,
      id: node.id,
      lagnname: node.lagnname,
      displayName: node.lagnname,
      clname: node.clname,
      profpic: node.profpic,
      email: node.email,
      phone: node.phone,
      managerActive: node.managerActive || 'y',
      esid: node.esid,
      licenses: node.licenses || [],
      sa: node.sa,
      ga: node.ga,
      mga: node.mga,
      rga: node.rga
    };
    
    setRightDetailsData(agentData);
    setShowRightDetails(true);
  };

  // Fetch data for non-admin users using simplified userHierarchy endpoint
  const fetchUserHierarchyData = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (!user || !user.userId) {
        setError('User information is not available. Please try logging in again.');
        setLoading(false);
        return;
      }

      const response = await api.post('/auth/userHierarchy', {
        userId: user.userId
      });
      
      if (response.data.success) {
        // Create a single "RGA hierarchy" object from the user data
        const userHierarchyData = {
          rgaId: response.data.agnName || user.userId,
          rgaName: response.data.agnName || user.userId,
          hierarchyData: response.data.data || []
        };
        
        // Process the hierarchy data
        const hierarchicalData = buildRgaHierarchy(userHierarchyData.hierarchyData);
        const processedHierarchy = {
          ...userHierarchyData,
          hierarchicalData
        };
        
        // Initialize expanded state
        const initialExpandedState = {};
        initialExpandedState[processedHierarchy.rgaId] = true; // Expand by default for single user
        setExpandedRGAs(initialExpandedState);
        
        // Set the hierarchy data
        setRgaHierarchies([processedHierarchy]);
      } else {
        setError(response.data.message || 'Failed to load hierarchy data');
      }
    } catch (err) {
      setError('Error loading hierarchy data: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Fetch hierarchy data for all RGAs (admin users)
  const fetchAllRGAsHierarchy = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get('/admin/getAllRGAsHierarchy');
      
      if (response.data.success) {
        // Process received hierarchies
        const hierarchies = response.data.data;
        
        // Process the hierarchies to build the tree structure
        const processedHierarchies = processHierarchyData(hierarchies);
        
        // Initialize expanded state for each RGA (collapsed by default)
        const initialExpandedState = {};
        processedHierarchies.forEach(rga => {
          initialExpandedState[rga.rgaId] = false;
        });
        setExpandedRGAs(initialExpandedState);
        
        // Set the hierarchies data
        setRgaHierarchies(processedHierarchies);
      } else {
        setError(response.data.message || 'Failed to load hierarchy data');
      }
    } catch (err) {
      setError('Error loading hierarchy data: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Process hierarchy data to build tree structure
  const processHierarchyData = (hierarchies) => {
    const processedHierarchies = hierarchies.map(rgaHierarchy => {
      // Build hierarchical structure for this RGA's data
      const hierarchicalData = buildRgaHierarchy(rgaHierarchy.hierarchyData);
      
      return {
        ...rgaHierarchy,
        hierarchicalData, // Add the processed hierarchical structure
      };
    });
    
    return processedHierarchies;
  };

  // Build hierarchy structure
  const buildRgaHierarchy = (rgaData) => {
    const hierarchy = [];
    const map = {};
    
    // Initialize map with each item
    rgaData.forEach(item => {
      map[item.lagnname] = { 
        ...item, 
        children: [],
        level: 0
      };
    });

    // Process nodes in a single pass with clear hierarchy rules
    rgaData.forEach(item => {
      let added = false;

      // First level: RGA or MGA
      if (item.clname === 'RGA' || item.clname === 'MGA') {
        // Check if this RGA/MGA should be under another RGA
        if (item.rga && map[item.rga]) {
          map[item.rga].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.rga].level + 1;
          added = true;
        } 
        // Check for MGA-RGA link
        else if (item.mga_rga_link && map[item.mga_rga_link]) {
          map[item.mga_rga_link].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.mga_rga_link].level + 1;
          added = true;
        }
        // Otherwise add to top level
        else {
          hierarchy.push(map[item.lagnname]);
          map[item.lagnname].level = 0;
          added = true;
        }
      }
      // Second level: AGT with no sa or ga
      else if (item.clname === 'AGT' && !item.sa && !item.ga) {
        if (item.mga && map[item.mga]) {
          map[item.mga].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.mga].level + 1;
          added = true;
        } else if (item.rga && map[item.rga]) {
          map[item.rga].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.rga].level + 1;
          added = true;
        }
      }
      // Third level: SA with no ga
      else if (item.clname === 'SA' && !item.ga) {
        if (item.mga && map[item.mga]) {
          map[item.mga].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.mga].level + 1;
          added = true;
        } else if (item.rga && map[item.rga]) {
          map[item.rga].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.rga].level + 1;
          added = true;
        }
      }
      // Fourth level: AGT with SA value but no ga
      else if (item.clname === 'AGT' && item.sa && !item.ga) {
        if (map[item.sa]) {
          map[item.sa].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.sa].level + 1;
          added = true;
        }
      }
      // Fifth level: GA
      else if (item.clname === 'GA') {
        if (item.mga && map[item.mga]) {
          map[item.mga].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.mga].level + 1;
          added = true;
        } else if (item.rga && map[item.rga]) {
          map[item.rga].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.rga].level + 1;
          added = true;
        }
      }
      // Sixth level: AGT with no sa but with GA
      else if (item.clname === 'AGT' && !item.sa && item.ga) {
        if (map[item.ga]) {
          map[item.ga].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.ga].level + 1;
          added = true;
        }
      }
      // Seventh level: SA with ga
      else if (item.clname === 'SA' && item.ga) {
        if (map[item.ga]) {
          map[item.ga].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.ga].level + 1;
          added = true;
        }
      }
      // Eighth level: AGT with both sa and ga
      else if (item.clname === 'AGT' && item.sa && item.ga) {
        if (map[item.sa]) {
          map[item.sa].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.sa].level + 1;
          added = true;
        }
      }

      // Default fallback if not handled by above rules
      if (!added) {
        if (item.sa && map[item.sa]) {
          map[item.sa].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.sa].level + 1;
        } else if (item.ga && map[item.ga]) {
          map[item.ga].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.ga].level + 1;
        } else if (item.mga && map[item.mga]) {
          map[item.mga].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.mga].level + 1;
        } else if (item.rga && map[item.rga]) {
          map[item.rga].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.rga].level + 1;
        } else {
          hierarchy.push(map[item.lagnname]);
          map[item.lagnname].level = 0;
        }
      }
    });

    // Sort children alphabetically within each type group
    const sortChildren = (nodes) => {
      if (!nodes || !nodes.length) return [];
      
      return nodes.map(node => {
        if (node.children && node.children.length) {
          node.children.sort((a, b) => {
            if (a.clname === b.clname) {
              return a.lagnname.localeCompare(b.lagnname);
            }
            return 0;
          });
          
          node.children = sortChildren(node.children);
        }
        return node;
      });
    };
    
    return sortChildren(hierarchy);
  };

  // Toggle RGA expansion
  const toggleRgaExpansion = (rgaId) => {
    setExpandedRGAs(prev => ({
      ...prev,
      [rgaId]: !prev[rgaId]
    }));
  };

  // Toggle node expansion
  const toggleNodeExpansion = (nodeId) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: prev[nodeId] === undefined ? true : !prev[nodeId]
    }));
  };

  // Flatten hierarchy to array for table display
  const flattenHierarchy = (nodes, parentExpandedState = true) => {
    let result = [];
    
    if (!nodes || !nodes.length) {
      return result;
    }
    
    nodes.forEach(node => {
      // Add the node itself
      result.push({
        ...node,
        visible: parentExpandedState
      });
      
      // Process children if any
      if (node.children && node.children.length > 0) {
        const childrenVisible = parentExpandedState && (expandedNodes[node.lagnname] !== false);
        const childrenNodes = flattenHierarchy(node.children, childrenVisible);
        result = [...result, ...childrenNodes];
      }
    });
    
    return result;
  };

  // Helper function to check if a node is expandable
  const isNodeExpandable = (node) => {
    return node.children && node.children.length > 0;
  };

  // Determine role color based on clname
  const getRoleColor = (clname) => {
    const roleColors = {
      'RGA': { bg: '#00558c', border: '#004372' },
      'MGA': { bg: 'rgb(104, 182, 117)', border: 'rgb(84, 152, 97)' },
      'GA': { bg: 'rgb(237, 114, 47)', border: 'rgb(197, 94, 37)' },
      'SA': { bg: 'rgb(178, 82, 113)', border: 'rgb(138, 62, 93)' },
      'AGT': { bg: 'lightgrey', border: 'grey' }
    };
    
    return roleColors[clname] || { bg: '#888', border: '#666' };
  };

  // Format phone number for display
  const formatPhoneNumber = (phone) => {
    if (!phone) return '—';
    
    const cleaned = ('' + phone).replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return '(' + match[1] + ') ' + match[2] + '-' + match[3];
    }
    return phone;
  };

  // Toggle all RGAs expanded/collapsed
  const toggleAllRGAs = () => {
    const hasExpandedRGAs = Object.values(expandedRGAs).some(isExpanded => isExpanded);
    
    const newState = {};
    rgaHierarchies.forEach(rga => {
      newState[rga.rgaId] = !hasExpandedRGAs;
    });
    
    setExpandedRGAs(newState);
  };

  if (loading) {
    return (
      <div className="hierarchy-activity-loading">
        <div className="spinner"></div>
        <span>Loading hierarchy data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="hierarchy-activity-error">
        {error}
      </div>
    );
  }

  return (
    <div className="hierarchy-activity">
      <div className="hierarchy-activity-header">
        <h2>Team Hierarchy</h2>
        <div className="hierarchy-controls">
          <button 
            className="hierarchy-toggle-btn" 
            onClick={toggleAllRGAs} 
            title={Object.values(expandedRGAs).some(isExpanded => isExpanded) ? "Collapse All" : "Expand All"}
          >
            {Object.values(expandedRGAs).some(isExpanded => isExpanded) 
              ? <FiChevronUp /> 
              : <FiChevronDown />
            }
          </button>
        </div>
      </div>

      <div className="hierarchy-container">
        {rgaHierarchies.map((rgaHierarchy) => {
          const isExpanded = expandedRGAs[rgaHierarchy.rgaId];
          
          return (
            <div key={rgaHierarchy.rgaId} className="rga-section">
              <div 
                className="rga-header"
                onClick={() => toggleRgaExpansion(rgaHierarchy.rgaId)}
              >
                <div className="rga-title">
                  {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
                  <span>{rgaHierarchy.rgaName}</span>
                </div>
                <div className="rga-role">
                  <span 
                    className="role-badge role-RGA"
                    style={{
                      backgroundColor: getRoleColor('RGA').bg,
                      borderColor: getRoleColor('RGA').border
                    }}
                  >
                    RGA
                  </span>
                  <div className="user-count">
                    {rgaHierarchy.hierarchyData.length}
                  </div>
                </div>
              </div>
              
              {isExpanded && (
                <div className="hierarchy-table-container">
                  <table className="hierarchy-table">
                    <thead>
                      <tr>
                        <th className="toggle-column"></th>
                        <th>Name</th>
                        <th>Role</th>
                        <th>Email</th>
                        <th>Phone</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const tableData = flattenHierarchy(rgaHierarchy.hierarchicalData);
                        
                        if (tableData.length === 0) {
                          return (
                            <tr>
                              <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                                No users to display
                              </td>
                            </tr>
                          );
                        }
                        
                        return tableData.map((node, index) => {
                          const isCurrentUser = node.lagnname === user?.userId;
                          const indentation = node.level * 20;
                          const canExpand = isNodeExpandable(node);
                          const isNodeExpanded = expandedNodes[node.lagnname] !== false;
                          const isActive = node.managerActive && node.managerActive.toLowerCase() === 'y';
                          
                          const rowClasses = [
                            !isActive ? 'inactive' : '',
                            isCurrentUser ? 'current-user' : ''
                          ].filter(Boolean).join(' ');
                          
                          return (
                            <tr key={`node-${node.lagnname}-${index}`} className={rowClasses}>
                              <td className="toggle-column">
                                {canExpand ? (
                                  <button 
                                    className="node-toggle"
                                    onClick={() => toggleNodeExpansion(node.lagnname)}
                                    aria-label={isNodeExpanded ? "Collapse" : "Expand"}
                                  >
                                    {isNodeExpanded ? <FiChevronDown /> : <FiChevronRight />}
                                  </button>
                                ) : null}
                              </td>
                              <td className="name-column">
                                <div 
                                  className="indented-content"
                                  style={{ marginLeft: `${indentation}px` }}
                                >
                                  <div className="user-cell">
                                    <div 
                                      className="user-icon clickable-profile-icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleProfileClick(node);
                                      }}
                                      title="View profile"
                                    >
                                      {node.profpic ? (
                                        <img 
                                          src={node.profpic} 
                                          alt={`${node.lagnname}'s profile`} 
                                          className="profile-image"
                                        />
                                      ) : (
                                        <FiUser size={18} />
                                      )}
                                    </div>
                                    <div className="name-with-icon">
                                      <span className="user-name">{node.lagnname}</span>
                                      {isCurrentUser && <span className="you-badge">You</span>}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className={`role-badge role-${node.clname}`}>
                                  {node.clname}
                                </span>
                              </td>
                              <td>
                                <a href={`mailto:${node.email}`}>{node.email || '—'}</a>
                              </td>
                              <td>
                                <a href={`tel:${node.phone}`}>{formatPhoneNumber(node.phone)}</a>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Agent Profile RightDetails */}
      {showRightDetails && rightDetailsData && (
        <RightDetails
          data={rightDetailsData}
          onClose={() => {
            setShowRightDetails(false);
            setRightDetailsData(null);
          }}
        />
      )}
    </div>
  );
};

export default HierarchyActivity;
