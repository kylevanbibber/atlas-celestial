import React, { useEffect, useState, useContext, useMemo, useRef } from 'react';
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
		return result.sort((a,b)=> a.name.localeCompare(b.name));
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

	// Render status badges for a user node
	const renderStatusBadges = (node) => {
		if (!node) return null;
		const isActive = node.managerActive && node.managerActive.toLowerCase() === 'y';
		const isRedeemed = node.redeemed === 1 || node.redeemed === '1';
		const isReleased = node.released === 1 || node.released === '1';
		const isPending = node.pending === 1 || node.pending === '1';
		const { isF6, isVIPEligible } = calculateCareerStage(node.esid);
		
		return (
			<div className="status-badges">
				<span className={`status-badge ${isActive ? 'active' : 'inactive'}`}>
					{isActive ? 'Active' : 'Inactive'}
				</span>
				<span className={`status-badge ${isRedeemed ? 'redeemed' : 'inactive'}`}>
					{isRedeemed ? 'Redeemed' : 'Not Redeemed'}
				</span>
				<span className={`status-badge ${isReleased ? 'released' : 'inactive'}`}>
					{isReleased ? 'Released' : 'Not Released'}
				</span>
				{isPending && (
					<span className="status-badge rfc">RFC</span>
				)}
				{!isPending && isF6 && (
					<span className="status-badge f6">F6</span>
				)}
				{!isPending && isVIPEligible && (
					<span className="status-badge vip-eligible">VIP Eligible</span>
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
			Cell: ({ value, row }) => (
				<span 
					className="user-role-badge" 
					style={{ 
						...getRoleBadgeStyle(value), 
						marginLeft: `${(row.original.depth || 0) * 16}px`
					}}
				>
					{value}
				</span>
			)
		},
		{ Header: 'Name', accessor: 'name', autoWidth: true },
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
				// Don't show status for parent MGA rows
				if (row.original.role === 'MGA' && row.original.depth === 0) {
					return '—';
				}
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
			Header: '13mo Ret', 
			accessor: 'retention13mo', 
			width: 10,
			Cell: ({ row }) => {
				// Don't show 13mo retention for parent MGA rows
				if (row.original.role === 'MGA' && row.original.depth === 0) {
					return '—';
				}
				const retentionRate = row.original.userData?.pnp_data?.curr_mo_13mo_rate;
				return retentionRate ? `${retentionRate}%` : '—';
			}
		},
		{ 
			Header: 'Licenses', 
			accessor: 'licenses', 
			width: 225,
			Cell: ({ row }) => {
				// Show only resident licenses for parent MGA rows
				if (row.original.role === 'MGA' && row.original.depth === 0) {
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

	// Auto-expand MGAs that have matches when searching
	useEffect(() => {
		if (!normalizedQuery) return; // don't modify expansion when empty
		const nextExpanded = {};
		baseRows.forEach(mgaRow => {
			const agents = users.filter(u => u.mga === mgaRow.name || u.lagnname === mgaRow.name);
			// Quick pre-filter
			const hasAgentMatch = agents.some(a =>
				(String(a.lagnname || '').toLowerCase().includes(normalizedQuery)) ||
				(String(a.clname || '').toLowerCase().includes(normalizedQuery)) ||
				(String(a.mga || '').toLowerCase().includes(normalizedQuery))
			);
			if (hasAgentMatch || String(mgaRow.name || '').toLowerCase().includes(normalizedQuery)) {
				nextExpanded[mgaRow.id] = true;
			}
		});
		setExpandedMga(prev => ({ ...prev, ...nextExpanded }));
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
						
						// Flatten the isolated hierarchy
						const flattenIsolated = (nodes, depth) => {
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
									isTargetUser: isTargetUser
								});
								
								if (node.children?.length > 0) {
									flattenIsolated(node.children, depth + 1);
								}
							});
						};
						
						if (isolatedHierarchy?.length > 0) {
							flattenIsolated(isolatedHierarchy, 0);
						}
					});
				}
			});
			
			out.matchIds = matchIds;
			return out;
		}
		
		// Default behavior for full mode
		const out = [];
		const matchIds = new Set();
		topLevelRows.forEach(mgaRow => {
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
			out.push(mgaRow);
			if (expandedMga[mgaRow.id]) {
				const agents = users.filter(u => u.mga === mgaRow.name || u.lagnname === mgaRow.name);
				const tree = buildHierarchy(agents);
				const flat = [];
				const traverse = (nodes, depth) => {
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
						// Skip pushing the parent MGA node itself; only show its children
						const isParentMgaNode =
							String(n.lagnname || '').toUpperCase() === String(mgaRow.name || '').toUpperCase() &&
							String(n.clname || '').toUpperCase() === 'MGA';
						if (!isParentMgaNode) {
							flat.push({ 
								id: `${mgaRow.id}::${n.lagnname}`, 
								role: n.clname || '', 
								name: n.lagnname, 
								depth,
								email: n.email || '',
								phone: n.phone || '',
								esid: n.esid || '',
								userData: n
							});
						}
						// Continue traversing children; if we skipped parent, keep same depth for first-generation children
						if (n.children && n.children.length) {
							const nextDepth = isParentMgaNode ? depth : depth + 1;
							traverse(n.children, nextDepth);
						}
					});
				};
				traverse(tree, 0);
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

	// Update expandableRows to only allow expansion on top-level MGA rows
	const expandableRows = (() => {
		if (searchMode === 'isolated') {
			// In isolated mode, no rows are expandable since we show the full hierarchy
			return {};
		}
		const map = {};
		// Only rows with role MGA or RGA are expandable
		(displayRows || []).forEach(row => {
			const role = String(row.role || row?.userData?.clname || '').toUpperCase();
			map[row.id] = role === 'MGA' || role === 'RGA';
			// Debug logging of expandability map entries
			try {
				console.log('[HierarchyMGAUtilitiesTable] expandableRows entry', {
					id: row.id,
					name: row.name,
					role,
					depth: row.depth,
					isExpandable: map[row.id]
				});
			} catch (_) {}
		});
		try {
			const totals = Object.values(map).reduce((acc, v) => {
				acc[v ? 'expandable' : 'nonExpandable'] += 1; return acc;
			}, { expandable: 0, nonExpandable: 0 });
		} catch (_) {}
		return map;
	})();

	const handleRowExpansionChange = (rowId, isExpanded) => setExpandedMga(prev => ({ ...prev, [rowId]: isExpanded }));

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
				expandableDefault={false}
				isRowExpandable={(row) => {
					const role = String(row.role || row?.userData?.clname || '').toUpperCase();
					const allowed = role === 'MGA' || role === 'RGA';
					return allowed;
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


