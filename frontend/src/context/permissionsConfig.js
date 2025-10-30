// src/permissionsConfig.js

// Agent types (clname field in database)
export const AGENT_TYPES = {
  SGA: "SGA",
  RGA: "RGA",
  MGA: "MGA",
  GA: "GA",
  SA: "SA",
  AGT: "AGT"
};

// Roles (Role field in database)
export const ROLES = {
  ADMIN: "Admin",
  TRAINEE: "Trainee",
  RECRUIT: "Recruit"
};

// Agent types that grant access to the Dashboard 
// (this is the clname field)
export const dashboardAllowedAgentTypes = [
  AGENT_TYPES.SGA,
  AGENT_TYPES.RGA,
  AGENT_TYPES.MGA,
  AGENT_TYPES.GA,
  AGENT_TYPES.SA,
  AGENT_TYPES.AGT
];

// Roles that have admin privileges
// (this is the Role field)
export const adminRoles = [
  ROLES.ADMIN
];

// Define all page and component permissions
export const PERMISSIONS = {
  // Page access
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_REFS: 'view_refs',
  VIEW_SETTINGS: 'view_settings',
  
  // Admin permissions
  ADMIN: 'admin',
  
  // Dashboard components
  VIEW_DASHBOARD_ANALYTICS: 'view_dashboard_analytics',
  VIEW_DASHBOARD_USERS: 'view_dashboard_users',
  EDIT_DASHBOARD_USERS: 'edit_dashboard_users',
  
  // Refs components
  CREATE_REFS: 'create_refs',
  EDIT_REFS: 'edit_refs',
  DELETE_REFS: 'delete_refs',
  
  // Settings components
  EDIT_PROFILE: 'edit_profile',
  EDIT_TEAM: 'edit_team',
  ADMIN_SETTINGS: 'admin_settings',
};

// Permission matrix for agent types (clname)
export const AGENT_TYPE_PERMISSIONS = {
  [AGENT_TYPES.SGA]: [
    PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_REFS, PERMISSIONS.VIEW_SETTINGS,
    PERMISSIONS.VIEW_DASHBOARD_ANALYTICS, PERMISSIONS.VIEW_DASHBOARD_USERS, PERMISSIONS.EDIT_DASHBOARD_USERS,
    PERMISSIONS.CREATE_REFS, PERMISSIONS.EDIT_REFS, PERMISSIONS.DELETE_REFS,
    PERMISSIONS.EDIT_PROFILE, PERMISSIONS.EDIT_TEAM
  ],
  [AGENT_TYPES.RGA]: [
    PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_REFS, PERMISSIONS.VIEW_SETTINGS,
    PERMISSIONS.VIEW_DASHBOARD_ANALYTICS, PERMISSIONS.VIEW_DASHBOARD_USERS, PERMISSIONS.EDIT_DASHBOARD_USERS,
    PERMISSIONS.CREATE_REFS, PERMISSIONS.EDIT_REFS,
    PERMISSIONS.EDIT_PROFILE, PERMISSIONS.EDIT_TEAM
  ],
  [AGENT_TYPES.MGA]: [
    PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_REFS, PERMISSIONS.VIEW_SETTINGS,
    PERMISSIONS.VIEW_DASHBOARD_ANALYTICS, PERMISSIONS.VIEW_DASHBOARD_USERS,
    PERMISSIONS.CREATE_REFS, PERMISSIONS.EDIT_REFS,
    PERMISSIONS.EDIT_PROFILE, PERMISSIONS.EDIT_TEAM
  ],
  [AGENT_TYPES.GA]: [
    PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_REFS, PERMISSIONS.VIEW_SETTINGS,
    PERMISSIONS.VIEW_DASHBOARD_ANALYTICS,
    PERMISSIONS.CREATE_REFS,
    PERMISSIONS.EDIT_PROFILE
  ],
  [AGENT_TYPES.SA]: [
    PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_REFS, PERMISSIONS.VIEW_SETTINGS,
    PERMISSIONS.VIEW_DASHBOARD_ANALYTICS,
    PERMISSIONS.CREATE_REFS,
    PERMISSIONS.EDIT_PROFILE
  ],
  [AGENT_TYPES.AGT]: [
    PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_REFS, PERMISSIONS.VIEW_SETTINGS,
    PERMISSIONS.CREATE_REFS,
    PERMISSIONS.EDIT_PROFILE
  ]
};

// Permission matrix for roles (Role field)
export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    // Admin has all permissions, including the specific admin permission
    ...Object.values(PERMISSIONS),
    PERMISSIONS.ADMIN
  ],
  [ROLES.TRAINEE]: [
    PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_REFS,
    PERMISSIONS.EDIT_PROFILE
  ],
  [ROLES.RECRUIT]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.EDIT_PROFILE
  ]
};

// Map routes to required permissions
export const routePermissions = {
  "/dashboard": PERMISSIONS.VIEW_DASHBOARD,
  "/refs": PERMISSIONS.VIEW_REFS,
  "/utilities": PERMISSIONS.VIEW_SETTINGS,
  "/team-customization": PERMISSIONS.EDIT_TEAM,
  "/admin/notifications": PERMISSIONS.ADMIN,
  "/admin/hierarchy": PERMISSIONS.ADMIN,
};
  