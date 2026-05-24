import React, { useState, useEffect } from 'react';
import {
  Shield,
  Plus,
  Edit2,
  Trash2,
  Users,
  Lock,
  RefreshCw,
  Activity,
  CheckSquare,
  Square,
  X,
  Calendar,
  Search,
  ChevronDown,
  MoreVertical,
} from 'lucide-react';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { permissionsApi, type Role, type Permissions } from '../../services/api';
import { toast } from 'sonner';
import clsx from 'clsx';

type AnyRow = Record<string, unknown>;
type SubTab = 'roles' | 'permissions' | 'users' | 'audit';

const _ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-500/20 text-emerald-400',
  read: 'bg-blue-500/20 text-blue-400',
  update: 'bg-amber-500/20 text-amber-400',
  delete: 'bg-red-500/20 text-red-400',
  export: 'bg-purple-500/20 text-purple-400',
  approve: 'bg-cyan-500/20 text-cyan-400',
};

const TABS: { key: SubTab; label: string; icon: React.ElementType }[] = [
  { key: 'roles', label: 'Roles', icon: Shield },
  { key: 'permissions', label: 'Permission Matrix', icon: Lock },
  { key: 'users', label: 'Users & Roles', icon: Users },
  { key: 'audit', label: 'Audit Trail', icon: Activity },
];

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-500',
  manager: 'bg-blue-500',
  supervisor: 'bg-amber-500',
  viewer: 'bg-green-500',
  editor: 'bg-purple-500',
};

const PERMISSION_MODULES = [
  'Projects',
  'Invoicing',
  'Documents',
  'Reports',
  'Admin',
  'Users',
];

const PERMISSION_ACTIONS = [
  'create',
  'read',
  'update',
  'delete',
  'export',
  'approve',
];

interface AuditLog {
  id: string;
  date: string;
  changedBy: string;
  userAffected: string;
  action: string;
  details: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
  lastLogin: string;
}

export function PermissionsManager() {
  const [roles, setRoles] = useState<(Role & AnyRow)[]>([]);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<SubTab>('roles');
  const [selectedRole, setSelectedRole] = useState<(Role & AnyRow) | null>(null);
  const [editedPermissions, setEditedPermissions] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showAssignRoleModal, setShowAssignRoleModal] = useState(false);
  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} role(s)?`)) return;
    try {
      await Promise.all(ids.map(id => permissionsApi.deleteRole(String(id))));
      toast.success(`Deleted ${ids.length} role(s)`);
      loadData();
      clearSelection();
    } catch {
      toast.error('Bulk delete failed');
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rolesData, permsData] = await Promise.all([
        permissionsApi.getRoles(),
        permissionsApi.getPermissions(),
      ]);
      setRoles(rolesData as (Role & AnyRow)[]);
      setPermissions(permsData);

      // Load mock user data
      setUsers([
        { id: '1', name: 'Alice Johnson', email: 'alice@cortex.com', role: 'Admin', status: 'active', lastLogin: '2 hours ago' },
        { id: '2', name: 'Bob Smith', email: 'bob@cortex.com', role: 'Project Manager', status: 'active', lastLogin: '1 day ago' },
        { id: '3', name: 'Carol Davis', email: 'carol@cortex.com', role: 'Viewer', status: 'inactive', lastLogin: '5 days ago' },
        { id: '4', name: 'David Wilson', email: 'david@cortex.com', role: 'Editor', status: 'active', lastLogin: '3 hours ago' },
      ]);

      // Load mock audit logs
      setAuditLogs([
        { id: '1', date: '2026-04-27', changedBy: 'Admin', userAffected: 'Bob Smith', action: 'Role assigned', details: 'Assigned Project Manager role' },
        { id: '2', date: '2026-04-26', changedBy: 'Alice', userAffected: 'Carol Davis', action: 'Permission changed', details: 'Updated read permissions on Reports module' },
        { id: '3', date: '2026-04-25', changedBy: 'Admin', userAffected: 'David Wilson', action: 'Role assigned', details: 'Assigned Editor role' },
        { id: '4', date: '2026-04-24', changedBy: 'Alice', userAffected: 'Alice Johnson', action: 'Role created', details: 'Created Finance Officer role' },
      ]);
    } catch {
      toast.error('Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  const selectRole = (role: Role & AnyRow) => {
    setSelectedRole(role);
    setEditedPermissions((role.permissions as Record<string, string[]>) || {});
  };

  const _togglePermission = (module: string, action: string) => {
    setEditedPermissions(prev => {
      const modulePerms = prev[module] || [];
      if (modulePerms.includes(action)) {
        return { ...prev, [module]: modulePerms.filter(a => a !== action) };
      }
      return { ...prev, [module]: [...modulePerms, action] };
    });
  };

  const _toggleModuleWildcard = (module: string) => {
    setEditedPermissions(prev => {
      if (prev[module]?.includes('*')) {
        return { ...prev, [module]: [] };
      }
      return { ...prev, [module]: ['*'] };
    });
  };

  const _hasPermission = (module: string, action: string): boolean => {
    const modulePerms = editedPermissions[module] || [];
    if (modulePerms.includes('*')) return true;
    if (editedPermissions['*']?.includes('*')) return true;
    return modulePerms.includes(action);
  };

  const saveChanges = async () => {
    if (!selectedRole) return;
    if (selectedRole.isSystem) {
      toast.error('Cannot modify system roles');
      return;
    }
    setSaving(true);
    try {
      await permissionsApi.updateRole(String(selectedRole.id), { permissions: editedPermissions });
      toast.success('Permissions updated');
      loadData();
    } catch {
      toast.error('Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (roleId: string | number) => {
    if (!window.confirm('Delete this role? This action cannot be undone.')) return;
    try {
      await permissionsApi.deleteRole(String(roleId));
      toast.success('Role deleted');
      if (String(selectedRole?.id) === String(roleId)) setSelectedRole(null);
      loadData();
    } catch {
      toast.error('Failed to delete role');
    }
  };

  const togglePermission = (module: string, action: string) => {
    setEditedPermissions(prev => {
      const modulePerms = prev[module] || [];
      if (modulePerms.includes(action)) {
        return { ...prev, [module]: modulePerms.filter(a => a !== action) };
      }
      return { ...prev, [module]: [...modulePerms, action] };
    });
  };

  const hasPermission = (module: string, action: string): boolean => {
    const modulePerms = editedPermissions[module] || [];
    if (modulePerms.includes('*')) return true;
    if (editedPermissions['*']?.includes('*')) return true;
    return modulePerms.includes(action);
  };

  const modules = (permissions?.modules as Record<string, AnyRow>) || {};

  const filteredRoles = roles.filter(r =>
    String(r.name ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsers = users.filter(u =>
    String(u.name).toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    String(u.email).toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  const filteredAuditLogs = auditLogs.filter(log => {
    const logDate = new Date(log.date);
    const startDate = dateRangeStart ? new Date(dateRangeStart) : null;
    const endDate = dateRangeEnd ? new Date(dateRangeEnd) : null;

    if (startDate && logDate < startDate) return false;
    if (endDate && logDate > endDate) return false;

    return true;
  });

  return (
    <>
      <ModuleBreadcrumbs currentModule="permissions" />
      <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Permissions & Access Control</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 btn btn-primary rounded-lg text-sm font-medium flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Role
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="input input-bordered p-4">
          <p className="text-xs text-gray-400 uppercase mb-1">Total Users</p>
          <p className="text-2xl font-bold text-white">124</p>
        </div>
        <div className="input input-bordered p-4">
          <p className="text-xs text-gray-400 uppercase mb-1">Roles Defined</p>
          <p className="text-2xl font-bold text-white">{Number(roles.length)}</p>
        </div>
        <div className="input input-bordered p-4">
          <p className="text-xs text-gray-400 uppercase mb-1">Permission Changes</p>
          <p className="text-2xl font-bold text-white">18</p>
        </div>
        <div className="input input-bordered p-4">
          <p className="text-xs text-gray-400 uppercase mb-1">Inactive Users</p>
          <p className="text-2xl font-bold text-white">7</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="border-b border-gray-700 flex gap-1 cb-table-scroll touch-pan-x">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                subTab === t.key
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ROLES TAB */}
      {subTab === 'roles' && (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-gray-800">
                <input
                  type="text"
                  placeholder="Search roles..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                />
              </div>
              <div className="divide-y divide-gray-800 max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="p-4 flex justify-center">
                    <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
                  </div>
                ) : (
                  filteredRoles.map(role => {
                    const isSelected = selectedIds.has(String(role.id));
                    return (
                    <button
                      key={String(role.id)}
                      onClick={() => selectRole(role)}
                      className={clsx(
                        'w-full text-left p-4 transition-colors border-l-2 flex items-start gap-2',
                        String(selectedRole?.id) === String(role.id)
                          ? 'bg-blue-600/20 border-blue-500'
                          : 'hover:bg-gray-800/50 border-transparent'
                      )}
                    >
                      <button type="button" onClick={e => { e.stopPropagation(); toggle(String(role.id)); }} className="mt-0.5">
                        {isSelected ? <CheckSquare size={16} className="text-blue-400"/> : <Square size={16} className="text-gray-500"/>}
                      </button>
                      <div>
                        <p className="font-medium text-white text-sm">{String(role.name ?? 'Untitled')}</p>
                        <p className="text-xs text-gray-500">{String(role.description ?? '')}</p>
                        {Boolean(role.isSystem) && (
                          <div className="mt-2 flex items-center gap-1">
                            <Lock className="h-3 w-3 text-gray-600" />
                            <span className="text-xs text-gray-500">System Role</span>
                          </div>
                        )}
                      </div>
                    </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          </div>

          <BulkActionsBar
          selectedIds={Array.from(selectedIds)}
          actions={[
            { id: 'delete', label: 'Delete Selected', icon: Trash2, variant: 'danger', onClick: handleBulkDelete, confirm: 'This action cannot be undone.' },
          ]}
          onClearSelection={clearSelection}
        />
        </>
      )}

      {/* PERMISSIONS TAB */}
      {subTab === 'permissions' && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <p className="text-sm text-gray-400">Manage role permissions across all modules and actions</p>
          </div>
          <div className="cb-table-scroll touch-pan-x">
            <table className="w-full text-xs">
              <thead className="bg-gray-800 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-300">Module / Action</th>
                  {filteredRoles.map(role => (
                    <th key={String(role.id)} className="text-center px-3 py-3 font-semibold text-gray-300 whitespace-nowrap">
                      <div className="flex flex-col items-center gap-1">
                        <span className={clsx('w-2 h-2 rounded-full', ROLE_COLORS[String(role.name).toLowerCase()] || 'bg-gray-500')} />
                        <span>{String(role.name ?? '').split(' ')[0]}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {PERMISSION_MODULES.map(module => (
                  <React.Fragment key={module}>
                    <tr className="bg-gray-800/30">
                      <td colSpan={filteredRoles.length + 1} className="px-4 py-2 font-semibold text-blue-400 text-xs">
                        {module}
                      </td>
                    </tr>
                    {PERMISSION_ACTIONS.map(action => (
                      <tr key={`${module}-${action}`} className="hover:bg-gray-800/50">
                        <td className="px-4 py-3 text-gray-400 text-xs">{action}</td>
                        {filteredRoles.map(role => (
                          <td key={`${String(role.id)}-${module}-${action}`} className="text-center px-3 py-3">
                            <button
                              onClick={() => togglePermission(module, action)}
                              className="inline-flex items-center justify-center w-5 h-5 rounded border border-gray-700 hover:border-blue-500 transition-colors"
                            >
                              {hasPermission(module, action) && (
                                <CheckSquare className="h-4 w-4 text-blue-400" />
                              )}
                            </button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {selectedRole && (
            <div className="p-4 border-t border-gray-800 flex justify-end gap-3">
              <button onClick={() => setSelectedRole(null)} className="px-4 py-2 btn btn-ghost rounded-lg text-sm">
                Cancel
              </button>
              <button onClick={saveChanges} disabled={saving} className="px-4 py-2 btn btn-primary rounded-lg text-sm font-medium flex items-center gap-2">
                {Boolean(saving) && <RefreshCw className="h-4 w-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          )}
        </div>
      )}

      {/* USERS & ROLES TAB */}
      {subTab === 'users' && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-800 flex gap-3">
            <div className="flex-1 relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={userSearchQuery}
                onChange={e => setUserSearchQuery(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 pl-9 text-white text-sm"
              />
            </div>
            <button className="px-4 py-2 btn btn-primary rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap">
              <Plus className="h-4 w-4" />
              Invite User
            </button>
          </div>
          <div className="cb-table-scroll touch-pan-x">
            <table className="w-full text-sm">
              <thead className="bg-gray-800">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">Last Login</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredUsers.map((user) => (
                  <tr key={String(user.id)} className="hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-gray-300 font-medium">{String(user.name)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{String(user.email)}</td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        'px-3 py-1 rounded text-xs font-medium',
                        user.role === 'Admin' ? 'bg-red-500/20 text-red-400' :
                        user.role === 'Project Manager' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-gray-700/50 text-gray-300'
                      )}>
                        {String(user.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        'px-2 py-1 rounded text-xs font-medium',
                        user.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-700/50 text-gray-400'
                      )}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{String(user.lastLogin)}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => { setSelectedUser(user); setShowAssignRoleModal(true); }} className="text-blue-400 hover:text-blue-300 flex items-center gap-1 justify-center">
                        <Edit2 className="h-4 w-4" />
                        Assign
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AUDIT TRAIL TAB */}
      {subTab === 'audit' && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-800 space-y-4">
            <p className="text-sm text-gray-400">Filter permission change history by date range</p>
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-gray-400 mb-1">Start Date</label>
                <div className="relative">
                  <Calendar className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="date"
                    value={dateRangeStart}
                    onChange={e => setDateRangeStart(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 pl-9 text-white text-sm"
                  />
                </div>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-gray-400 mb-1">End Date</label>
                <div className="relative">
                  <Calendar className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="date"
                    value={dateRangeEnd}
                    onChange={e => setDateRangeEnd(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 pl-9 text-white text-sm"
                  />
                </div>
              </div>
              {(dateRangeStart || dateRangeEnd) && (
                <div className="flex items-end">
                  <button onClick={() => { setDateRangeStart(''); setDateRangeEnd(''); }} className="text-gray-400 hover:text-gray-300">
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="cb-table-scroll touch-pan-x">
            <table className="w-full text-sm">
              <thead className="bg-gray-800">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">Changed By</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">User Affected</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredAuditLogs.map((log) => (
                  <tr key={String(log.id)} className="hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-gray-400 text-xs">{String(log.date)}</td>
                    <td className="px-4 py-3 text-gray-300 font-medium text-xs">{String(log.changedBy)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{String(log.userAffected)}</td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        'px-2 py-1 rounded text-xs font-medium',
                        log.action.includes('assigned') ? 'bg-blue-500/20 text-blue-400' :
                        log.action.includes('changed') ? 'bg-amber-500/20 text-amber-400' :
                        'bg-purple-500/20 text-purple-400'
                      )}>
                        {String(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{String(log.details)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ACTIVITY TAB */}
      {subTab === 'audit' && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
          <div className="cb-table-scroll touch-pan-x">
            <table className="w-full text-sm">
              <thead className="bg-gray-800">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">Changed By</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">Change</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {[
                  { by: 'Admin', change: 'Updated Site Manager role permissions', date: '2026-03-20' },
                  { by: 'Alice', change: 'Created Finance Officer role', date: '2026-03-18' },
                ].map((log, idx) => (
                  <tr key={idx} className="hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-gray-300">{String(log.by)}</td>
                    <td className="px-4 py-3 text-gray-400">{String(log.change)}</td>
                    <td className="px-4 py-3 text-gray-500">{String(log.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreateRoleModal
          onClose={() => setShowCreateModal(false)}
          onSave={() => {
            setShowCreateModal(false);
            loadData();
          }}
        />
      )}

      {showAssignRoleModal && selectedUser && (
        <AssignRoleModal
          user={selectedUser}
          roles={roles}
          onClose={() => { setShowAssignRoleModal(false); setSelectedUser(null); }}
          onSave={() => {
            setShowAssignRoleModal(false);
            setSelectedUser(null);
            loadData();
          }}
        />
      )}
    </div>
    </>
  );
}

function AssignRoleModal({ user, roles, onClose, onSave }: { user: User; roles: (Role & AnyRow)[]; onClose: () => void; onSave: () => void }) {
  const [selectedRole, setSelectedRole] = useState(user.role);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      toast.success(`Role changed to ${selectedRole}`);
      onSave();
    } catch {
      toast.error('Failed to update user role');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-800">
          <h3 className="text-lg font-bold text-white">Assign Role</h3>
          <p className="text-sm text-gray-400 mt-1">{String(user.name)}</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-3">Select Role</label>
            <div className="space-y-2">
              {roles.map(role => (
                <button
                  key={String(role.id)}
                  onClick={() => setSelectedRole(String(role.name))}
                  className={clsx(
                    'w-full text-left px-4 py-3 rounded-lg border transition-colors',
                    selectedRole === String(role.name)
                      ? 'bg-blue-600/20 border-blue-500 text-white'
                      : 'border-gray-700 text-gray-300 hover:border-gray-600'
                  )}
                >
                  <div className="font-medium">{String(role.name)}</div>
                  <div className="text-xs text-gray-500 mt-1">{String(role.description ?? '')}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-gray-800 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 btn btn-ghost rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 btn btn-primary rounded-lg font-medium flex items-center gap-2"
          >
            {Boolean(saving) && <RefreshCw className="h-4 w-4 animate-spin" />}
            Assign Role
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateRoleModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      await permissionsApi.createRole({
        name,
        description,
        permissions: { '*': ['read'] },
      });
      toast.success('Role created');
      onSave();
    } catch {
      toast.error('Failed to create role');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-800">
          <h3 className="text-lg font-bold text-white">Create Custom Role</h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Role Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 btn text-white"
              placeholder="Site Supervisor"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 btn text-white h-20"
              placeholder="Manage site operations..."
            />
          </div>
        </div>
        <div className="p-6 border-t border-gray-800 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 btn btn-ghost rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="px-4 py-2 btn btn-primary rounded-lg font-medium flex items-center gap-2"
          >
            {Boolean(saving) && <RefreshCw className="h-4 w-4 animate-spin" />}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
export default PermissionsManager;
