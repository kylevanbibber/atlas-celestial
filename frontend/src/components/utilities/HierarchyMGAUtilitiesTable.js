import React, { useEffect, useState, useContext, useMemo, useRef, useCallback } from 'react';
import { FiMail, FiCheckCircle, FiXCircle, FiUsers, FiX, FiRefreshCw } from 'react-icons/fi';
import DataTable from '../utils/DataTable';
import Modal from '../utils/Modal';
import api from '../../api';
import { AuthContext } from '../../context/AuthContext';
import '../admin/AdminHierarchyTableView.css'; // Import styles for bulk actions

function groupAgentsByMGA(users) {
	const groups = new Map();
	users.forEach(u => {
		const mgaName = u.mga || u.lagnname;
		if (!groups.has(mgaName)) groups.set(mgaName, new Set());
		groups.get(mgaName).add(u.lagnname);
		if (u.clname === 'MGA' || u.lagnname === mgaName) {
			groups.get(mgaName).add(mgaName);
		}
	});
	return new Map([...groups.entries()].map(([k, v]) => [k, Array.from(v)]));
}

export default function HierarchyMGAUtilitiesTable({ 
	searchQuery = '', 
	rgaHierarchies = null, 
	dataLoading = false, 
	error: propError = '',
	activeFilters = null,
	allAvailableStates = [],
	passesAllFilters = null,
	searchMode = 'full',
	searchResults = null
}) {
	const { user } = useContext(AuthContext);
	const [loading, setLoading] = useState(!rgaHierarchies);
	const [error, setError] = useState(propError);
	const [users, setUsers] = useState([]);
	const [expandedMga, setExpandedMga] = useState({});
	const [selectedRows, setSelectedRows] = useState({});
	const [toggleLoading, setToggleLoading] = useState(null);
	const [emailModal, setEmailModal] = useState({ open: false, userId: null, email: '', displayName: '' });
	const [emailModalSending, setEmailModalSending] = useState(false);
	
	// Add a ref for the scrollable container
	const scrollableContainerRef = useRef(null);
	
	// Default filter function if not provided
	const defaultPassesAllFilters = (node) => {
		// If no filters provided, show all active users
		if (!activeFilters) {
			const isActive = node.managerActive !== undefined && 
				node.managerActive !== null && 
				node.managerActive.toLowerCase() === 'y';
			return isActive;
		}
		
		// Apply the same filter logic as AdminHierarchySettings
		// Check role filters
		if (!activeFilters[node.clname]) {
			return false;
		}
		
		// Check state license filters
		const hasActiveStateFilters = Object.values(activeFilters.states || {}).some(value => value === true);
		
		if (hasActiveStateFilters) {
			// If user has no licenses or if none of their licenses match the active state filters
			if (!node.licenses || !Array.isArray(node.licenses) || node.licenses.length === 0) {
				// Hide this node if any state filter is active
				return false;
			}
			
			const userHasFilteredState = node.licenses.some(license => 
				license.state && activeFilters.states[license.state]
			);
			
			if (!userHasFilteredState) {
				return false;
			}
		}
		
		// Check status filters
		const isRedeemed = node.redeemed !== undefined && 
							node.redeemed !== null && 
							parseInt(node.redeemed) === 1;
							
		const isReleased = node.released !== undefined && 
							node.released !== null && 
							parseInt(node.released) === 1;
							
		const isActive = node.managerActive !== undefined && 
						 node.managerActive !== null && 
						 node.managerActive.toLowerCase() === 'y';
						 
		const hasNoProfPic = !node.profpic;
		
		// Check pending/RFC status
		const isPending = node.pending === 1 || node.pending === '1';
		if (activeFilters.pending !== null && activeFilters.pending !== isPending) {
			return false;
		}
		
		if (activeFilters.released !== null && activeFilters.released !== isReleased) {
			return false;
		}
		
		if (activeFilters.redeemed !== null && activeFilters.redeemed !== isRedeemed) {
			return false;
		}
		
		if (activeFilters.noProfPic !== null && activeFilters.noProfPic !== hasNoProfPic) {
			return false;
		}
		
		// Only apply managerActive filter if it's not the default "Active: yes" state
		// or if it's explicitly set to false (show inactive)
		if (activeFilters.managerActive === false && isActive) {
			return false;
		}
		
		// If managerActive is true (default) or null (show all), show active users
		if (activeFilters.managerActive === true && !isActive) {
			return false;
		}
		
		return true;
	};
	
	// Use provided filter function or default
	const filterFunction = passesAllFilters || defaultPassesAllFilters;

	useEffect(() => {
		// If data is provided via props, use it instead of loading
		if (rgaHierarchies) {
			// Process the provided RGA hierarchies data
			const flatUsers = [];
			rgaHierarchies.forEach(h => {
				(h.hierarchyData || []).forEach(u => flatUsers.push(u));
			});
			
			// Keep only active and managerActive users; ensure uniqueness by lagnname
			const unique = new Map();
			flatUsers.forEach(u => {
				const active = String(u.Active || '').toLowerCase() === 'y';
				const mgrActive = String(u.managerActive || '').toLowerCase() === 'y';
				if (active && mgrActive && u.lagnname && !unique.has(u.lagnname)) {
					unique.set(u.lagnname, u);
				}
			});
			
			// Apply filters to the users
			const filteredUsers = Array.from(unique.values()).filter(user => filterFunction(user));
			setUsers(filteredUsers);
			setLoading(false);
			setError(propError || '');
			return;
		}

		// If no data provided, load it normally
		let mounted = true;
		const fetchUsers = async () => {
			try {
				setLoading(true);
				setError('');
				if (!user?.userId) throw new Error('No user');
				const isOrgAdmin = (user?.Role === 'Admin') || (user?.teamRole === 'app');
				if (isOrgAdmin) {
					// Load all hierarchies across the organization
					const res = await api.get('/admin/getAllRGAsHierarchy');
					if (!res.data?.success) throw new Error('Hierarchy load failed');
					const flatUsers = [];
					(res.data.data || []).forEach(h => {
						(h.hierarchyData || []).forEach(u => flatUsers.push(u));
					});
					// Keep only active and managerActive users; ensure uniqueness by lagnname
					const unique = new Map();
					flatUsers.forEach(u => {
						const active = String(u.Active || '').toLowerCase() === 'y';
						const mgrActive = String(u.managerActive || '').toLowerCase() === 'y';
						if (active && mgrActive && u.lagnname && !unique.has(u.lagnname)) {
							unique.set(u.lagnname, u);
						}
					});
					// Apply filters to the users
					const filteredUsers = Array.from(unique.values()).filter(user => filterFunction(user));
					if (mounted) setUsers(filteredUsers);
				} else {
					// Load only current user's hierarchy (lite)
					const res = await api.post('/auth/searchByUserIdLite', { userId: user.userId });
					if (!res.data?.success) throw new Error('Hierarchy load failed');
					// Apply filters to the users
					const filteredUsers = (res.data.data || []).filter(user => filterFunction(user));
					if (mounted) setUsers(filteredUsers);
				}
			} catch (e) {
				if (mounted) setError('Error loading hierarchy');
			} finally {
				if (mounted) setLoading(false);
			}
		};
		fetchUsers();
		return () => { mounted = false; };
	}, [rgaHierarchies, propError, user?.userId, user?.Role, user?.teamRole, filterFunction, activeFilters]);

	const mgaToAgents = useMemo(() => groupAgentsByMGA(users), [users]);

	const baseRows = useMemo(() => {
		const result = [];
		mgaToAgents.forEach((agents, mgaName) => {
			// Find the MGA user data
			const mgaUser = users.find(u => u.lagnname === mgaName && u.clname === 'MGA') || 
							users.find(u => u.lagnname === mgaName);
			result.push({ 
				id: mgaName, 
				role: (String(mgaUser?.clname || '').toUpperCase() === 'RGA') ? 'RGA' : 'MGA', 
				name: mgaName, 
				depth: 0,
				email: mgaUser?.email || '',
				phone: mgaUser?.phone || '',
				esid: mgaUser?.esid || '',
				userData: mgaUser || {}
			});
		});
		
		// Sort with inactive/hidden MGAs at the bottom
		return result.sort((a, b) => {
			// Only check inactive/hidden status if they're currently an MGA or RGA
			const aIsMgaOrRga = ['MGA', 'RGA'].includes(String(a.role || '').toUpperCase());
			const bIsMgaOrRga = ['MGA', 'RGA'].includes(String(b.role || '').toUpperCase());
			
			const aInactive = aIsMgaOrRga && (a.userData?.mga_active === 'n' || a.userData?.mga_hide === 'y');
			const bInactive = bIsMgaOrRga && (b.userData?.mga_active === 'n' || b.userData?.mga_hide === 'y');
			
			// If one is inactive and the other isn't, inactive goes to bottom
			if (aInactive && !bInactive) return 1;
			if (!aInactive && bInactive) return -1;
			
			// Otherwise sort alphabetically
			return a.name.localeCompare(b.name);
		});
	}, [mgaToAgents, users]);

	const topLevelRows = useMemo(() => {
		const normalize = (s) => (s || '').trim().toUpperCase();
		const role = (user?.clname || '').toUpperCase();
		const selfName = user?.lagnname || '';
		const allowed = new Set();
		if (role === 'RGA') {
			// Ensure your own MGA group exists as a top-level row even if no children pass filters
			let baseRowsEffective = baseRows;
			const presentMgas = new Set(baseRowsEffective.map(r => normalize(r.name)));
			if (!presentMgas.has(normalize(selfName))) {
				const meUser = users.find(u => normalize(u.lagnname) === normalize(selfName));
				if (meUser) {
					baseRowsEffective = [
						...baseRowsEffective,
						{
							id: selfName,
							role: 'RGA',
							name: selfName,
							depth: 0,
							email: meUser.email || '',
							phone: meUser.phone || '',
							esid: meUser.esid || '',
							userData: meUser
						}
					];
					presentMgas.add(normalize(selfName));
				}
			}
			// Always include your own MGA team if it exists as a group key
			if (presentMgas.has(normalize(selfName))) {
				allowed.add(normalize(selfName));
			}
			// Include all MGA rows whose RGA matches the logged-in RGA
			users.forEach(u => {
				if (u.clname === 'MGA' && presentMgas.has(normalize(u.lagnname))) {
					if (normalize(u.rga) === normalize(selfName)) allowed.add(normalize(u.lagnname));
				}
			});
			if (allowed.size === 0) presentMgas.forEach(n => allowed.add(n));
			// Return filtered rows from effective base rows
			return baseRowsEffective.filter(r => allowed.has(normalize(r.name)));
		} else if (role === 'MGA') {
			const queue = [normalize(selfName)];
			const seen = new Set(queue);
			while (queue.length) {
				const current = queue.shift();
				allowed.add(current);
				users.forEach(u => {
					if (u.clname === 'MGA' && normalize(u.mga) === current) {
						const child = normalize(u.lagnname);
						if (!seen.has(child)) { seen.add(child); queue.push(child); }
					}
				});
			}
		} else {
			let myMga = '';
			const me = users.find(u => normalize(u.lagnname) === normalize(selfName));
			if (me && me.mga) myMga = me.mga;
			if (myMga) allowed.add(normalize(myMga));
		}
		if (allowed.size === 0) return baseRows;
		return baseRows.filter(r => allowed.has(normalize(r.name)));
	}, [baseRows, users, user?.clname, user?.lagnname]);

	const getRoleBadgeStyle = (cl) => {
		const clname = String(cl || '').toUpperCase();
		const styles = { backgroundColor: 'lightgrey', border: '2px solid grey' };
		switch (clname) {
			case 'SA': styles.backgroundColor = 'rgb(178, 82, 113)'; styles.border = '2px solid rgb(138, 62, 93)'; break;
			case 'GA': styles.backgroundColor = 'rgb(237, 114, 47)'; styles.border = '2px solid rgb(197, 94, 37)'; break;
			case 'MGA': styles.backgroundColor = 'rgb(104, 182, 117)'; styles.border = '2px solid rgb(84, 152, 97)'; break;
			case 'RGA': styles.backgroundColor = '#00558c'; styles.border = '2px solid #004372'; break;
			case 'AGT': default: styles.backgroundColor = 'lightgrey'; styles.border = '2px solid grey'; break;
		}
		return {
			...styles,
			padding: '2px 4px',
			borderRadius: '4px',
			fontSize: '10px',
			color: 'white',
			fontWeight: 600,
			letterSpacing: '0.5px',
			boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
			display: 'inline-block'
		};
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

	// Format date for display as m/d/yy
	const formatDate = (dateString) => {
		if (!dateString) return '—';
		try {
			const date = new Date(dateString);
			return date.toLocaleDateString('en-US', { 
				year: '2-digit', 
				month: 'numeric', 
				day: 'numeric' 
			});
		} catch (e) {
			return dateString;
		}
	};

	// Calculate career stage based on ESID
	const calculateCareerStage = (esid) => {
		if (!esid) return { isF6: false, isVIPEligible: false, careerMonths: null };
		try {
			const esidDate = new Date(esid);
			if (isNaN(esidDate.getTime())) {
				return { isF6: false, isVIPEligible: false, careerMonths: null };
			}
			const currentDate = new Date();
			const yearDiff = currentDate.getFullYear() - esidDate.getFullYear();
			const monthDiff = currentDate.getMonth() - esidDate.getMonth();
			const totalMonthsDiff = (yearDiff * 12) + monthDiff;
			const isF6 = totalMonthsDiff < 6;
			const isVIPEligible = totalMonthsDiff >= 1 && totalMonthsDiff <= 3;
			return { isF6, isVIPEligible, careerMonths: totalMonthsDiff };
		} catch (error) {
			return { isF6: false, isVIPEligible: false, careerMonths: null };
		}
	};

	// Render status badges for a user node with inline display and +X more tooltip
	const renderStatusBadges = (node) => {
		if (!node) return null;
		const isActive = node.managerActive && node.managerActive.toLowerCase() === 'y';
		const isRedeemed = node.redeemed === 1 || node.redeemed === '1';
		const isReleased = node.released === 1 || node.released === '1';
		const isPending = node.pending === 1 || node.pending === '1';
		const { isF6, isVIPEligible } = calculateCareerStage(node.esid);
		
		// Build array of all badges
		const allBadges = [
			{ label: isActive ? 'Active' : 'Inactive', className: isActive ? 'active' : 'inactive' },
			{ label: isRedeemed ? 'Redeemed' : 'Not Redeemed', className: isRedeemed ? 'redeemed' : 'inactive' },
			{ label: isReleased ? 'Released' : 'Not Released', className: isReleased ? 'released' : 'inactive' },
		];
		
		if (isPending) {
			allBadges.push({ label: 'RFC', className: 'rfc' });
		}
		if (!isPending && isF6) {
			allBadges.push({ label: 'F6', className: 'f6' });
		}
		if (!isPending && isVIPEligible) {
			allBadges.push({ label: 'VIP Eligible', className: 'vip-eligible' });
		}
		
		// Show first 2 badges inline, rest in tooltip
		const visibleBadges = allBadges.slice(0, 2);
		const hiddenBadges = allBadges.slice(2);
		
		return (
			<div className="status-badges-inline" style={{ position: 'relative' }}>
				{visibleBadges.map((badge, idx) => (
					<span key={idx} className={`status-badge ${badge.className}`}>
						{badge.label}
					</span>
				))}
				{hiddenBadges.length > 0 && (
					<div className="status-badge-more-wrapper">
						<span className="status-badge-more">
							+{hiddenBadges.length}
						</span>
						<div className="status-badge-tooltip">
							{hiddenBadges.map((badge, idx) => (
								<span key={idx} className={`status-badge ${badge.className}`}>
									{badge.label}
								</span>
							))}
						</div>
					</div>
				)}
			</div>
		);
	};

	// Render license state badges for a user node (table-specific classes)
	const renderLicenseBadges = (node) => {
		if (!node || !node.licenses || node.licenses.length === 0) {
			return null;
		}
		const sortedLicenses = [...node.licenses].sort((a, b) => 
			(a.state || '').localeCompare(b.state || '')
		);
		
		return (
			<div className="table-license-badges">
				{sortedLicenses.map(license => (
					<span 
						key={license.id} 
						className={`table-license-state-badge ${license.resident_state === 1 ? 'resident' : ''}`}
						title={`${license.resident_state === 1 ? 'Resident' : 'Non-resident'} license in ${license.state}`}
					>
						{license.state}
					</span>
				))}
			</div>
		);
	};

	// Render only resident license state badges for parent MGA rows (table-specific classes)
	const renderResidentLicenseBadges = (node) => {
		if (!node || !node.licenses || node.licenses.length === 0) {
			return null;
		}
		const residentLicenses = node.licenses
			.filter(license => license.resident_state === 1)
			.sort((a, b) => (a.state || '').localeCompare(b.state || ''));
		
		if (residentLicenses.length === 0) {
			return null;
		}
		
		return (
			<div className="table-license-badges">
				{residentLicenses.map(license => (
					<span 
						key={license.id} 
						className="table-license-state-badge resident"
						title={`Resident license in ${license.state}`}
					>
						{license.state}
					</span>
				))}
			</div>
		);
	};

	// Selection handlers
	const toggleRowSelection = React.useCallback((nodeId, event) => {
		// Prevent row expansion when clicking checkbox
		if (event) {
			event.stopPropagation();
		}
		
		setSelectedRows(prev => {
			const newState = {
				...prev,
				[nodeId]: !prev[nodeId]
			};
			
			// DEBUG: Log selection change
			console.log(`Row selection changed: ${nodeId} is now ${!prev[nodeId] ? 'selected' : 'deselected'}`);
			console.log('Currently selected rows:', Object.keys(newState).filter(id => newState[id]));
			
			return newState;
		});
	}, []);

	const selectAllVisible = React.useCallback((visibleRows) => {
		// Get current selection state to determine if we're selecting or deselecting
		// If all visible rows are already selected, clicking should deselect all
		const allSelected = visibleRows.length > 0 && visibleRows.every(row => selectedRows[row.id]);
		
		// Create new selection state
		const newSelection = { ...selectedRows };
		
		// If all are selected, deselect all visible rows
		if (allSelected) {
			visibleRows.forEach(row => {
				newSelection[row.id] = false;
			});
			console.log('Deselecting all visible rows');
		} 
		// Otherwise, select all visible rows
		else {
			visibleRows.forEach(row => {
				newSelection[row.id] = true;
			});
			console.log('Selecting all visible rows');
		}
		
		setSelectedRows(newSelection);
	}, [selectedRows]);

	const clearSelection = React.useCallback(() => {
		setSelectedRows({});
	}, []);

	const getSelectedCount = React.useCallback(() => {
		return Object.values(selectedRows).filter(Boolean).length;
	}, [selectedRows]);

	const extendSelectionToChildren = React.useCallback(() => {
		// Get copy of current selection
		const newSelection = { ...selectedRows };
		
		// Find all selected rows and select their visible downlines
		displayRows.forEach(selectedRow => {
			if (selectedRows[selectedRow.id] && selectedRow.userData) {
				const selectedUserName = selectedRow.userData.lagnname;
				
				// Find all downlines of this selected user in the displayRows
				displayRows.forEach(potentialChild => {
					if (potentialChild.userData && !newSelection[potentialChild.id]) {
						const childData = potentialChild.userData;
						
						// Check if this user is a downline of the selected user
						// A user is a downline if any of their upline fields (mga, ga, sa, rga) 
						// matches the selected user's name
						const isDownline = (
							childData.mga === selectedUserName ||
							childData.ga === selectedUserName ||
							childData.sa === selectedUserName ||
							childData.rga === selectedUserName
						);
						
						if (isDownline) {
							newSelection[potentialChild.id] = true;
							
							// Debug logging
							console.log(`Including downline: ${childData.lagnname} (${childData.clname}) under ${selectedUserName}`);
						}
					}
				});
			}
		});
		
		setSelectedRows(newSelection);
	}, [selectedRows]);

	const performBulkAction = React.useCallback((action) => {
		// Get unique selected node IDs to prevent double counting
		const selectedNodeIds = Object.keys(selectedRows).filter(id => selectedRows[id]);
		
		// DEBUG: Log which rows are selected at the start of bulk action
		console.log(`Starting ${action} bulk action with ${selectedNodeIds.length} selected rows:`);
		console.log('Selected row IDs:', selectedNodeIds);
		
		// Find the actual user objects from the selected rows
		const selectedUsers = [];
		displayRows.forEach(row => {
			if (selectedRows[row.id] && row.userData && row.userData.email) {
				selectedUsers.push(row.userData);
			}
		});
		
		// DEBUG: Log the final selected users
		console.log(`Final selected users for action: ${selectedUsers.length}`);
		console.log('Selected users:', selectedUsers.map(user => ({ id: user.lagnname, email: user.email })));
		
		// Get an accurate count
		const selectedCount = selectedUsers.length;
		
		// Perform the requested action
		switch (action) {
			case 'email':
				// Create mailto link with all emails - ensure uniqueness by using a Set
				const uniqueEmails = new Set();
				selectedUsers.forEach(user => {
					if (user.email) {
						uniqueEmails.add(user.email);
					}
				});
				
				const emailArray = Array.from(uniqueEmails);
				
				if (emailArray.length > 0) {
					window.location.href = `mailto:?bcc=${emailArray.join(',')}`;
				} else {
					setError('No email addresses found in the selected users.');
				}
				break;
				
			case 'activate':
				// Batch activate all selected users
				if (window.confirm(`Activate all ${selectedCount} selected users?`)) {
					// Here you would implement the batch activation API call
					setError('Batch activation not implemented yet');
				}
				break;
				
			case 'deactivate':
				// Batch deactivate all selected users
				if (window.confirm(`Deactivate all ${selectedCount} selected users?`)) {
					// Here you would implement the batch deactivation API call
					setError('Batch deactivation not implemented yet');
				}
				break;
				
			default:
				setError(`Unknown bulk action: ${action}`);
		}
	}, [selectedRows]);

	// Add sticky behavior for bulk action panel
	useEffect(() => {
		// Only run if there are selected rows
		if (getSelectedCount() === 0) return;
		
		const panel = document.getElementById('bulk-action-panel');
		const placeholder = document.getElementById('bulk-action-placeholder');
		
		if (!panel || !placeholder) return;
		
		// Find the correct scrollable container by checking which one actually scrolls
		// Start with most specific and fall back to more general containers
		const possibleContainers = [
			document.querySelector('.page-content'),
			document.querySelector('.settings-content'),
			document.querySelector('.settings-section'),
			document.querySelector('main'),
			document.body
		].filter(Boolean); // Filter out any null containers
		
		// Determine which container is the actual scrollable one
		let scrollableContainer = window;
		
		for (const container of possibleContainers) {
			// Check for overflow properties that would make it scrollable
			const style = window.getComputedStyle(container);
			const hasScroll = ['auto', 'scroll'].includes(style.overflowY) || 
								['auto', 'scroll'].includes(style.overflow);
			
			// Also check if it actually has scrollHeight > clientHeight
			if (hasScroll && container.scrollHeight > container.clientHeight) {
				scrollableContainer = container;
				break;
			}
		}
		
		// Store ref to the container for future use
		scrollableContainerRef.current = scrollableContainer;
		
		// Get the original position of the panel relative to its scrollable container
		const panelRect = panel.getBoundingClientRect();
		const containerRect = scrollableContainer === window ? 
			{ top: 0, left: 0 } : 
			scrollableContainer.getBoundingClientRect();
		
		// Calculate the position based on the container type
		const panelPosition = scrollableContainer === window ? 
			panelRect.top + window.scrollY : 
			panelRect.top - containerRect.top;
		
		// Store panel height to use for the placeholder
		const panelHeight = panel.offsetHeight;
		
		// Store the original width of the panel
		const originalPanelWidth = panel.offsetWidth;
		
		placeholder.style.height = '0px';
		
		// Variable to track current sticky state to avoid unnecessary DOM updates
		let isCurrentlySticky = false;
		
		// Handle scroll event with debouncing for better performance
		const handleScroll = () => {
			const scrollPosition = scrollableContainer === window ? 
				window.scrollY : 
				scrollableContainer.scrollTop;
			
			// Check if we need to update sticky state
			const shouldBeSticky = scrollPosition > panelPosition;
			
			// Only update DOM if state changed
			if (shouldBeSticky !== isCurrentlySticky) {
				isCurrentlySticky = shouldBeSticky;
				
				if (shouldBeSticky) {
					// Before adding sticky class, ensure placeholder has the right height
					placeholder.style.height = `${panelHeight}px`;
					placeholder.style.marginBottom = '15px';
					placeholder.classList.add('visible');
					
					// Small delay to let the placeholder animate in size first
					setTimeout(() => {
						panel.classList.add('sticky');
						
						// Add class to container instead of body for better positioning
						if (scrollableContainer !== window) {
							scrollableContainer.classList.add('has-sticky-panel');
						} else {
							document.body.classList.add('has-sticky-panel');
						}
						
						// Set the exact original width
						panel.style.width = `${originalPanelWidth}px`;
						panel.style.maxWidth = `${originalPanelWidth}px`;
					}, 50);
				} else {
					// Remove sticky class first
					panel.classList.remove('sticky');
					
					// Remove class from container
					if (scrollableContainer !== window) {
						scrollableContainer.classList.remove('has-sticky-panel');
					} else {
						document.body.classList.remove('has-sticky-panel');
					}
					
					// Reset width to default
					panel.style.width = '';
					panel.style.maxWidth = '';
					
					// Let the panel transition fully before collapsing placeholder
					setTimeout(() => {
						placeholder.classList.remove('visible');
						placeholder.style.height = '0px';
						placeholder.style.marginBottom = '0px';
					}, 50);
				}
			}
		};
		
		// Debounce function to improve scroll performance
		let scrollTimeout;
		const debouncedHandleScroll = () => {
			if (scrollTimeout) {
				window.cancelAnimationFrame(scrollTimeout);
			}
			scrollTimeout = window.requestAnimationFrame(handleScroll);
		};
		
		// Add scroll event listener to the appropriate container
		scrollableContainer.addEventListener('scroll', debouncedHandleScroll);
		
		// Check initial scroll position (needed if page loads already scrolled)
		handleScroll();
		
		// Also listen for window resize to adjust panel width
		const handleResize = () => {
			if (panel.classList.contains('sticky')) {
				// Keep the panel width fixed at its original size
				panel.style.width = `${originalPanelWidth}px`;
				panel.style.maxWidth = `${originalPanelWidth}px`;
			}
		};
		
		window.addEventListener('resize', handleResize);
		
		// Clean up event listener on component unmount
		return () => {
			scrollableContainer.removeEventListener('scroll', debouncedHandleScroll);
			window.removeEventListener('resize', handleResize);
			
			if (scrollableContainer !== window) {
				scrollableContainer.classList.remove('has-sticky-panel');
			} else {
				document.body.classList.remove('has-sticky-panel');
			}
		};
	}, [selectedRows]); // Re-run when selection changes

	const columns = useMemo(() => ([
		{
			Header: ({ data }) => (
				<input 
					type="checkbox" 
					onChange={() => selectAllVisible(data)}
					checked={
						data.length > 0 && 
						data.every(row => selectedRows[row.id])
					}
					title="Select all visible rows"
				/>
			),
			accessor: 'selection',
			width: 5,
			disableSortBy: true,
			Cell: ({ row }) => (
				<input
					type="checkbox"
					checked={selectedRows[row.original.id] || false}
					onChange={(e) => toggleRowSelection(row.original.id, e)}
					onClick={(e) => e.stopPropagation()}
				/>
			)
		},
		{ 
			Header: 'Role', 
			accessor: 'role', 
			width: 12,
			Cell: ({ value, row }) => {
				const depth = row.original.depth || 0;
				const isTopLevel = depth === 0;
				const parentRole = row.original.parentRole;
				
				// Get the parent's role badge color for connectors
				const getParentColor = () => {
					if (!parentRole) return 'var(--border-color)';
					const parentRoleUpper = String(parentRole).toUpperCase();
					switch (parentRoleUpper) {
						case 'RGA': return '#00558c';
						case 'MGA': return 'rgb(104, 182, 117)';
						case 'GA': return 'rgb(237, 114, 47)';
						case 'SA': return 'rgb(178, 82, 113)';
						default: return 'var(--border-color)';
					}
				};
				
				const connectorColor = getParentColor();
				
				return (
					<div style={{ 
						display: 'flex', 
						alignItems: 'center', 
						paddingLeft: `${depth * 28}px`,
						position: 'relative'
					}}>
						{/* Show hierarchy connector for nested items */}
						{depth > 0 && (
							<>
								{/* Vertical line connecting to parent */}
								<span style={{ 
									position: 'absolute',
									left: `${(depth - 1) * 28 + 10}px`,
									top: 0,
									bottom: '50%',
									width: '2px',
									backgroundColor: connectorColor,
									opacity: 0.4
								}} />
								{/* Horizontal connector */}
								<span style={{ 
									position: 'absolute',
									left: `${(depth - 1) * 28 + 10}px`,
									top: '50%',
									width: '14px',
									height: '2px',
									backgroundColor: connectorColor,
									opacity: 0.4
								}} />
								{/* Arrow/connector symbol */}
								<span style={{ 
									marginRight: '6px',
									marginLeft: '18px',
									color: connectorColor, 
									fontSize: '11px',
									opacity: 0.5,
									fontWeight: 'bold'
								}}>
									▸
								</span>
							</>
						)}
						<span 
							className="user-role-badge" 
							style={{
								...getRoleBadgeStyle(value),
								fontWeight: isTopLevel ? '700' : '600',
								fontSize: isTopLevel ? '11px' : '10px'
							}}
						>
							{value}
						</span>
					</div>
				);
			}
		},
		{ 
			Header: 'Name', 
			accessor: 'name', 
			autoWidth: true,
			Cell: ({ value, row }) => (
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
					{row.original.userData?.profpic ? (
						<img 
							src={row.original.userData.profpic} 
							alt={value}
							style={{
								width: '28px',
								height: '28px',
								borderRadius: '50%',
								objectFit: 'cover',
								border: '1px solid var(--border-color)'
							}}
						/>
					) : (
						<div style={{
							width: '28px',
							height: '28px',
							borderRadius: '50%',
							backgroundColor: 'var(--sidebar-hover)',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							color: 'var(--text-secondary)',
							fontSize: '14px',
							fontWeight: '600',
							border: '1px solid var(--border-color)'
						}}>
							{value?.charAt(0) || '?'}
						</div>
					)}
					<span>{value}</span>
				</div>
			)
		},
		{ 
			Header: 'Agent #', 
			accessor: 'agtnum', 
			width: 10,
			Cell: ({ row }) => row.original?.userData?.agtnum || '—'
		},
		{ 
			Header: 'Email', 
			accessor: 'email', 
			width: 18,
			Cell: ({ value }) => value ? <a href={`mailto:${value}`}>{value}</a> : '—'
		},
		{ 
			Header: 'Phone', 
			accessor: 'phone', 
			width: 12,
			Cell: ({ value }) => value ? <a href={`tel:${value}`}>{formatPhoneNumber(value)}</a> : '—'
		},
		{ 
			Header: 'Status', 
			accessor: 'status', 
			width: 125,
			Cell: ({ row }) => {
				// Show status for all rows including top-level RGA/MGA
				return renderStatusBadges(row.original.userData);
			}
		},
		{ 
			Header: 'ESID', 
			accessor: 'esid', 
			width: 12,
			Cell: ({ value }) => value ? formatDate(value) : '—'
		},
		{ 
			Header: '4mo Ret', 
			accessor: 'retention4mo', 
			width: 10,
			Cell: ({ row }) => {
				// Show 4mo retention for all rows including top-level RGA/MGA
				const retentionRate = row.original.userData?.pnp_data?.curr_mo_4mo_rate;
				return retentionRate ? `${retentionRate}%` : '—';
			}
		},
		{ 
			Header: 'Licenses', 
			accessor: 'licenses', 
			width: 225,
			Cell: ({ row }) => {
				// Show only resident licenses for parent MGA/RGA rows (depth 0)
				if ((row.original.role === 'MGA' || row.original.role === 'RGA') && row.original.depth === 0) {
					return renderResidentLicenseBadges(row.original.userData);
				}
				// Show all licenses for child agent rows
				return renderLicenseBadges(row.original.userData);
			}
		},
	]), [selectedRows, selectAllVisible, toggleRowSelection]); // Dependencies to ensure checkboxes update

	const buildHierarchy = (agents) => {
		const order = ['RGA','MGA','GA','SA','AGT'];
		const nodesByName = new Map();
		agents.forEach(a => { nodesByName.set(a.lagnname, { ...a, children: [] }); });
		const roots = [];
		agents.forEach(a => {
			const node = nodesByName.get(a.lagnname);
			let parentName = null;
			if (a.sa && nodesByName.has(a.sa)) parentName = a.sa; else
			if (a.ga && nodesByName.has(a.ga)) parentName = a.ga; else
			if (a.mga && nodesByName.has(a.mga)) parentName = a.mga; else
			if (a.rga && nodesByName.has(a.rga)) parentName = a.rga;
			if (parentName && nodesByName.has(parentName)) nodesByName.get(parentName).children.push(node);
			else roots.push(node);
		});
		const sortRec = (arr, parent = null) => arr
			.sort((a,b)=> {
				const aRole = String(a.clname || '').toUpperCase();
				const bRole = String(b.clname || '').toUpperCase();
				const orphanA = (aRole === 'AGT' && !a.sa && !a.ga);
				const orphanB = (bRole === 'AGT' && !b.sa && !b.ga);
				if (parent && String(parent.clname || '').toUpperCase() === 'GA') {
					const agtNoSaA = (aRole === 'AGT' && !a.sa);
					const agtNoSaB = (bRole === 'AGT' && !b.sa);
					if (agtNoSaA !== agtNoSaB) return agtNoSaA ? -1 : 1;
					const isSaA = (aRole === 'SA');
					const isSaB = (bRole === 'SA');
					if (isSaA !== isSaB) return isSaA ? 1 : -1;
				}
				if (orphanA !== orphanB) return orphanA ? -1 : 1;
				const oa = order.indexOf(aRole);
				const ob = order.indexOf(bRole);
				if (oa === ob) return a.lagnname.localeCompare(b.lagnname);
				return oa - ob;
			})
			.map(n => ({ ...n, children: sortRec(n.children, n) }));
		return sortRec(roots);
	};

	const normalizedQuery = (searchQuery || '').trim().toLowerCase();

	// Auto-expand nodes that have matches when searching (multi-level) - with debouncing
	useEffect(() => {
		if (!normalizedQuery) return; // don't modify expansion when empty
		
		// Debounce the expansion logic to avoid blocking UI
		const timeoutId = setTimeout(() => {
			const nextExpanded = {};
			
			// Build a lookup map for faster searching
			const userMap = new Map();
			const childrenMap = new Map();
			
			users.forEach(u => {
				userMap.set(u.lagnname, u);
				
				// Build children lookup for faster traversal
				[u.sa, u.ga, u.mga, u.rga].forEach(parent => {
					if (parent) {
						if (!childrenMap.has(parent)) {
							childrenMap.set(parent, []);
						}
						childrenMap.get(parent).push(u.lagnname);
					}
				});
			});
			
			// Helper function to check if a user or their descendants match the search
			const hasMatchInSubtree = (userName, visited = new Set()) => {
				// Prevent infinite loops
				if (visited.has(userName)) return false;
				visited.add(userName);
				
				const matchesQuery = (str) => String(str || '').toLowerCase().includes(normalizedQuery);
				
				// Check if this user matches
				const user = userMap.get(userName);
				if (user && (matchesQuery(user.lagnname) || matchesQuery(user.clname))) {
					return true;
				}
				
				// Check if any descendants match
				const children = childrenMap.get(userName) || [];
				return children.some(childName => 
					matchesQuery(userMap.get(childName)?.lagnname) || 
					matchesQuery(userMap.get(childName)?.clname) || 
					hasMatchInSubtree(childName, visited)
				);
			};
			
			// Expand all nodes that have matches in their subtree
			baseRows.forEach(mgaRow => {
				if (hasMatchInSubtree(mgaRow.name)) {
					nextExpanded[mgaRow.id] = true;
					
					// Also expand all managers under this MGA that have matches
					const agents = users.filter(u => u.mga === mgaRow.name || u.lagnname === mgaRow.name);
					agents.forEach(agent => {
						if (hasMatchInSubtree(agent.lagnname)) {
							nextExpanded[`${mgaRow.id}::${agent.lagnname}`] = true;
						}
					});
				}
			});
			
			setExpandedMga(prev => ({ ...prev, ...nextExpanded }));
		}, 300); // 300ms debounce
		
		return () => clearTimeout(timeoutId);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [normalizedQuery]);

	const displayRows = (() => {
		// If in isolated mode and we have search results with isolated hierarchies, use those
		if (searchMode === 'isolated' && searchResults?.matchingRgaGroups?.length > 0) {
			const out = [];
			const matchIds = new Set();
			
			searchResults.matchingRgaGroups.forEach(rgaGroup => {
				if (rgaGroup.isolatedHierarchies?.length > 0) {
					rgaGroup.isolatedHierarchies.forEach((isolatedItem, index) => {
						const { targetUser, isolatedHierarchy } = isolatedItem;
						
						// Add a header row for the isolated hierarchy
						const isolatedHeaderId = `isolated-${targetUser.lagnname}-${index}`;
						out.push({
							id: isolatedHeaderId,
							role: 'ISOLATED',
							name: `${targetUser.lagnname} (${targetUser.clname}) - Isolated View`,
							depth: 0,
							email: '',
							phone: '',
							esid: '',
							userData: targetUser,
							isIsolatedHeader: true
						});
						
						// Mark the target user as a match
						matchIds.add(isolatedHeaderId);
						
						// Flatten the isolated hierarchy with parent role tracking
						const flattenIsolated = (nodes, depth, parentRole = null) => {
							nodes.forEach(node => {
								const nodeId = `isolated-${isolatedHeaderId}-${node.lagnname}`;
								
								// Check if this is the target user (highlight differently)
								const isTargetUser = node.lagnname === targetUser.lagnname;
								if (isTargetUser) {
									matchIds.add(nodeId);
								}
								
								out.push({
									id: nodeId,
									role: node.clname || '',
									name: node.lagnname,
									depth: depth + 1,
									email: node.email || '',
									phone: node.phone || '',
									esid: node.esid || '',
									userData: node,
									isTargetUser: isTargetUser,
									parentRole: parentRole || targetUser.clname // Track parent role
								});
								
								if (node.children?.length > 0) {
									flattenIsolated(node.children, depth + 1, node.clname || parentRole);
								}
							});
						};
						
						if (isolatedHierarchy?.length > 0) {
							flattenIsolated(isolatedHierarchy, 0, targetUser.clname);
						}
					});
				}
			});
			
			out.matchIds = matchIds;
			return out;
		}
		
		// Default behavior for full mode with multi-level collapsing
		const out = [];
		const matchIds = new Set();
		
		// Separate active and inactive rows (only check if they're currently MGA/RGA)
		const activeRows = topLevelRows.filter(row => {
			const isMgaOrRga = ['MGA', 'RGA'].includes(String(row.role || '').toUpperCase());
			return !(isMgaOrRga && (row.userData?.mga_active === 'n' || row.userData?.mga_hide === 'y'));
		});
		const inactiveRows = topLevelRows.filter(row => {
			const isMgaOrRga = ['MGA', 'RGA'].includes(String(row.role || '').toUpperCase());
			return isMgaOrRga && (row.userData?.mga_active === 'n' || row.userData?.mga_hide === 'y');
		});
		
		// Process active rows first, then inactive rows
		const rowsToProcess = [...activeRows, ...inactiveRows];
		
		rowsToProcess.forEach(mgaRow => {
			// If searching, include only MGAs with a match in self or descendants
			if (normalizedQuery) {
				const mgaNameMatches = String(mgaRow.name || '').toLowerCase().includes(normalizedQuery);
				const agentsAll = users.filter(u => u.mga === mgaRow.name || u.lagnname === mgaRow.name);
				const anyAgentMatch = agentsAll.some(a =>
					String(a.lagnname || '').toLowerCase().includes(normalizedQuery) ||
					String(a.clname || '').toLowerCase().includes(normalizedQuery) ||
					String(a.mga || '').toLowerCase().includes(normalizedQuery)
				);
				if (!mgaNameMatches && !anyAgentMatch) {
					return; // skip this MGA entirely
				}
				if (mgaNameMatches) {
					matchIds.add(mgaRow.id);
				}
			}
			// Check if this top-level MGA/RGA is inactive/hidden (only if currently MGA/RGA)
			const isMgaOrRga = ['MGA', 'RGA'].includes(String(mgaRow.role || '').toUpperCase());
			const topLevelInactive = isMgaOrRga && (mgaRow.userData?.mga_active === 'n' || mgaRow.userData?.mga_hide === 'y');
			
			out.push({
				...mgaRow,
				isParentInactive: topLevelInactive
			});
			
			if (expandedMga[mgaRow.id]) {
				const agents = users.filter(u => u.mga === mgaRow.name || u.lagnname === mgaRow.name);
				const tree = buildHierarchy(agents);
				const flat = [];
				
				// Updated traverse function to respect expansion state at each level and track parent role
				const traverse = (nodes, depth, parentId = mgaRow.id, parentRole = mgaRow.role, parentInactive = false) => {
					nodes.forEach(n => {
						if (normalizedQuery) {
							const isMatch =
								String(n.lagnname || '').toLowerCase().includes(normalizedQuery) ||
								String(n.clname || '').toLowerCase().includes(normalizedQuery) ||
								String(n.mga || '').toLowerCase().includes(normalizedQuery);
							if (isMatch) {
								matchIds.add(`${mgaRow.id}::${n.lagnname}`);
							}
						}
						
						// Skip pushing the parent MGA/RGA node itself; only show its children
						const isParentNode =
							String(n.lagnname || '').toUpperCase() === String(mgaRow.name || '').toUpperCase() &&
							(['MGA', 'RGA'].includes(String(n.clname || '').toUpperCase()));
							
						if (!isParentNode) {
							const nodeId = `${mgaRow.id}::${n.lagnname}`;
							const nodeRole = String(n.clname || '').toUpperCase();
							const isManager = ['RGA', 'MGA', 'GA', 'SA'].includes(nodeRole);
							
							// Check if this node itself is inactive/hidden, but ONLY if they're currently an MGA/RGA
							const isMgaOrRga = ['MGA', 'RGA'].includes(nodeRole);
							const nodeInactive = isMgaOrRga && (n.mga_active === 'n' || n.mga_hide === 'y');
							
							flat.push({ 
								id: nodeId,
								role: n.clname || '', 
								name: n.lagnname, 
								depth,
								email: n.email || '',
								phone: n.phone || '',
								esid: n.esid || '',
								userData: n,
								parentRole: parentRole, // Track the parent's role for styling
								isParentInactive: parentInactive || nodeInactive // Track if parent chain is inactive
							});
							
							// Only traverse children if this node is expanded (or if it's not a manager)
							if (n.children && n.children.length) {
								const isExpanded = expandedMga[nodeId];
								// If it's a manager, only show children if expanded
								// If it's not a manager (AGT), always show children
								if (!isManager || isExpanded) {
									// Pass this node's role as the parent role for its children
									traverse(n.children, depth + 1, nodeId, n.clname || parentRole, parentInactive || nodeInactive);
								}
							}
						} else {
							// For parent MGA/RGA node, continue traversing children at same depth
							if (n.children && n.children.length) {
								traverse(n.children, depth, parentId, parentRole, parentInactive);
							}
						}
					});
				};
				
				// Start at depth 1 so direct children of RGA/MGA get the left border
				traverse(tree, 1, mgaRow.id, mgaRow.role, topLevelInactive);
				out.push(...flat);
			}
		});
		// Attach matchIds as a property for later consumption
		out.matchIds = matchIds;
		return out;
	})();

	// Build right-click context menu options for each row
	const getRowContextMenuOptions = React.useCallback((row) => {
		const targetEmail = row?.userData?.email || row?.email || '';
		const hasEmail = !!targetEmail;
		const displayName = row?.name || row?.userData?.lagnname || 'user';
		const userId = row?.userData?.id || row?.userData?.userId || row?.userData?.ID || null;
		const viewerCl = String(user?.clname || '').toUpperCase();
		const viewerRole = user?.Role;
		const viewerTeamRole = user?.teamRole;
		const isAllowedViewer = (viewerRole === 'Admin') || (viewerTeamRole === 'app') || ['SA','GA','MGA','RGA','SGA'].includes(viewerCl);

		return [
			{
				label: 'Email',
				icon: <FiMail />,
				disabled: !hasEmail,
				onClick: () => {
					if (!hasEmail) {
						setError('No email address found for this user.');
						return;
					}
					window.location.href = `mailto:?bcc=${encodeURIComponent(targetEmail)}`;
				}
			},
			{
				label: 'Send Account Info',
				icon: <FiMail />,
				disabled: !userId || !isAllowedViewer,
				onClick: async () => {
					if (!userId) {
						setError('Cannot determine user ID for this row.');
						return;
					}
					setEmailModal({ open: true, userId, email: targetEmail, displayName });
				}
			},
			{
				label: 'Activate',
				icon: <FiCheckCircle />,
				onClick: () => {
					if (window.confirm(`Activate ${displayName}?`)) {
						setError('Activation not implemented yet');
					}
				}
			},
			{
				label: 'Deactivate',
				icon: <FiXCircle />,
				onClick: () => {
					if (window.confirm(`Deactivate ${displayName}?`)) {
						setError('Deactivation not implemented yet');
					}
				}
			},
			{
				label: 'Reset Password',
				icon: <FiRefreshCw />,
				disabled: !userId || !isAllowedViewer,
				onClick: async () => {
					try {
						if (!userId) {
							setError('Cannot determine user ID for this row.');
							return;
						}
						if (!window.confirm(`Reset password for ${displayName} to "default"?`)) return;
						await api.post('/admin/users/reset-password', { userId });
						window.alert('Password reset to default');
					} catch (err) {
						setError('Failed to reset password');
					}
				}
			}
		];
	}, [user?.clname, user?.Role, user?.teamRole]);

	// Update expandableRows to allow expansion on ALL manager rows (RGA, MGA, GA, SA) that have children
	const expandableRows = (() => {
		if (searchMode === 'isolated') {
			// In isolated mode, no rows are expandable since we show the full hierarchy
			return {};
		}
		const map = {};
		// Check if each row has children in the hierarchy
		(displayRows || []).forEach(row => {
			const role = String(row.role || row?.userData?.clname || '').toUpperCase();
			// Manager roles that can have children
			const isManager = ['RGA', 'MGA', 'GA', 'SA'].includes(role);
			
			// Check if this manager actually has children
			let hasChildren = false;
			if (isManager && row.userData) {
				const userName = row.userData.lagnname;
				// Check if any user in the table has this user as their upline
				hasChildren = users.some(u => 
					u.mga === userName || 
					u.ga === userName || 
					u.sa === userName || 
					u.rga === userName
				);
			}
			
			map[row.id] = isManager && hasChildren;
		});
		return map;
	})();

	const handleRowExpansionChange = (rowId, isExpanded) => {
		setExpandedMga(prev => {
			const newState = { ...prev, [rowId]: isExpanded };
			
			// If expanding a top-level row, also auto-expand the first nested version of that same person
			if (isExpanded) {
				// Extract the base name from the rowId (top-level rows are just the name)
				const baseName = rowId.includes('::') ? rowId.split('::')[1] : rowId;
				
				// Find and auto-expand the first nested occurrence of this person
				const nestedRowId = `${rowId}::${baseName}`;
				if (displayRows.some(r => r.id === nestedRowId)) {
					newState[nestedRowId] = true;
				}
			}
			
			return newState;
		});
	};

	// Build row class names to highlight matches and target users
	const rowClassNames = (() => {
		const classes = {};
		const matchIds = displayRows.matchIds || new Set();
		
		// Apply match highlighting
		if (normalizedQuery || searchMode === 'isolated') {
			matchIds.forEach(id => {
				classes[id] = 'today-row';
			});
		}
		
		// Add special styling for target users in isolated mode
		if (searchMode === 'isolated') {
			displayRows.forEach(row => {
				if (row.isTargetUser) {
					classes[row.id] = 'today-row target-user-row';
				} else if (row.isIsolatedHeader) {
					classes[row.id] = 'isolated-header-row';
				}
			});
		}
		
		// Add hierarchy depth classes, parent role classes, and inactive/hidden classes
		displayRows.forEach(row => {
			const existingClass = classes[row.id] || '';
			const depthClass = `hierarchy-depth-${row.depth || 0}`;
			const roleClass = `hierarchy-role-${(row.role || '').toLowerCase()}`;
			const parentRoleClass = row.parentRole ? `parent-role-${(row.parentRole || '').toLowerCase()}` : '';
			
			// Only apply inactive styling if currently an MGA/RGA with inactive/hidden status
			const isMgaOrRga = ['MGA', 'RGA'].includes(String(row.role || '').toUpperCase());
			const isInactiveOrHidden = isMgaOrRga && 
									   (row.userData?.mga_active === 'n' || 
									    row.userData?.mga_hide === 'y' || 
									    row.isParentInactive);
			const inactiveClass = isInactiveOrHidden ? 'mga-inactive-hidden' : '';
			
			classes[row.id] = `${existingClass} ${depthClass} ${roleClass} ${parentRoleClass} ${inactiveClass}`.trim();
		});
		
		return classes;
	})();

	if (loading || dataLoading) {
		return <div style={{ padding: 16, textAlign: 'center' }}>Loading hierarchy…</div>;
	}
	if (error) {
		return <div style={{ padding: 16, color: 'var(--text-error)' }}>{error}</div>;
	}

	return (
		<div>
			{/* Send Account Info Modal */}
			<Modal
				isOpen={emailModal.open}
				onClose={() => !emailModalSending && setEmailModal({ open: false, userId: null, email: '', displayName: '' })}
				title={`Send Account Info${emailModal.displayName ? ` - ${emailModal.displayName}` : ''}`}
				maxWidth="420px"
			>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<label style={{ fontWeight: 600, fontSize: 14 }}>Recipient Email</label>
					<input
						type="email"
						value={emailModal.email}
						onChange={(e) => setEmailModal(prev => ({ ...prev, email: e.target.value }))}
						placeholder="name@example.com"
						style={{ padding: 8, border: '1px solid var(--border-color)', borderRadius: 6 }}
					/>
					<div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
						<button
							onClick={() => setEmailModal({ open: false, userId: null, email: '', displayName: '' })}
							disabled={emailModalSending}
							style={{ padding: '8px 12px' }}
						>
							Cancel
						</button>
						<button
							onClick={async () => {
								if (!emailModal.userId) return;
								const toEmail = (emailModal.email || '').trim();
								if (!toEmail) { setError('Please enter a valid email'); return; }
								try {
									setEmailModalSending(true);
									await api.post('/admin/users/send-account-info', { userId: emailModal.userId, toEmail });
									setEmailModal({ open: false, userId: null, email: '', displayName: '' });
									window.alert(`Account info sent to ${toEmail}`);
								} catch (err) {
									setError('Failed to send account info');
								} finally {
									setEmailModalSending(false);
								}
							}}
							disabled={emailModalSending}
							style={{ padding: '8px 12px', background: 'var(--primary-color, #3b82f6)', color: 'white', border: 'none', borderRadius: 6, opacity: emailModalSending ? 0.8 : 1, cursor: emailModalSending ? 'wait' : 'pointer' }}
						>
							{emailModalSending ? 'Sending…' : 'Send'}
						</button>
					</div>
				</div>
			</Modal>

			{/* Bulk Actions Panel - Only shown when rows are selected */}
			{getSelectedCount() > 0 && (
				<>
					<div id="bulk-action-panel" className="bulk-action-panel">
						<div className="selected-count">
							{getSelectedCount()} user{getSelectedCount() !== 1 ? 's' : ''} selected
						</div>
						<div className="bulk-actions">
							<button 
								className="bulk-action-button" 
								onClick={() => performBulkAction('email')}
								title="Send email to all selected users"
							>
								<FiMail /> Email
							</button>
							<button 
								className="bulk-action-button" 
								onClick={() => performBulkAction('activate')}
								title="Activate all selected users"
							>
								<FiCheckCircle /> Activate
							</button>
							<button 
								className="bulk-action-button" 
								onClick={() => performBulkAction('deactivate')}
								title="Deactivate all selected users"
							>
								<FiXCircle /> Deactivate
							</button>
							<button 
								className="bulk-action-button" 
								onClick={() => extendSelectionToChildren()}
								title="Include children of selected users"
							>
								<FiUsers /> Include Children
							</button>
							<button 
								className="bulk-action-button" 
								onClick={clearSelection}
								title="Clear selection"
							>
								<FiX /> Clear
							</button>
						</div>
					</div>
					<div id="bulk-action-placeholder" className="bulk-action-placeholder"></div>
				</>
			)}
			
			<DataTable
				key={`datatable-${Object.keys(selectedRows).filter(id => selectedRows[id]).join('-')}`}
				columns={columns}
				data={displayRows}
				disablePagination={true}
				showActionBar={false}
				disableCellEditing={true}
				stickyHeader={false}
				enableRowContextMenu={true}
				getRowContextMenuOptions={getRowContextMenuOptions}
				enableRowExpansion={true}
				expandableRows={expandableRows}
				expandedRows={expandedMga}
				expandableDefault={false}
				isRowExpandable={(row) => {
					const role = String(row.role || row?.userData?.clname || '').toUpperCase();
					// Allow RGA, MGA, GA, and SA to be expandable if they have children
					return expandableRows[row.id] === true;
				}}
				expandOnRowClick={true}
				showExpandButton={false}
				onRowExpansionChange={handleRowExpansionChange}
				rowClassNames={rowClassNames}
				pageScrollSticky={true}
				allowTableOverflow={true}
				tableClassName="hierarchy-table"
				getRowDataAttributes={(row) => ({ 'data-role': (row.role || row?.userData?.clname || '').toUpperCase() })}
			/>
		</div>
	);
}


