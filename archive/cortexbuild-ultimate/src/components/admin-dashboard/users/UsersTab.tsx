import { useState, useEffect } from 'react';
import {
  Search, Plus, Edit2, Trash2, Lock, UserCheck, UserX,
  CheckSquare, Square, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { usersApi, apiFetch } from '../../../services/api';
import { EmptyState } from '../../ui/EmptyState';
import { BulkActionsBar, useBulkSelection, type BulkAction } from '../../ui/BulkActions';
import { Modal, StatusBadge } from '../shared';
import {
  ROLE_COLORS, ROLE_LABELS, fmtDateTime, type User, type UserRole,
} from '../types';

type AnyRow = Record<string, unknown>;

interface UsersTabProps {
  users?: User[];
  loading?: boolean;
  onRefresh?: () => void;
}

export default function UsersTab({ users: propUsers = [], loading: propLoading = false, onRefresh }: UsersTabProps) {
  const [fetchedUsers, setFetchedUsers] = useState<User[]>([]);
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({});
  const [fetchLoading, setFetchLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);

  const { selectedIds, isSelected, toggle, toggleAll, clearSelection } = useBulkSelection();

  const loadUsers = () => {
    setFetchLoading(true);
    usersApi.getAll()
      .then(data => {
        setFetchedUsers((data as AnyRow[]).map(u => ({
          id: String(u.id ?? ''),
          name: String(u.name ?? ''),
          email: String(u.email ?? ''),
          role: (u.role as UserRole) ?? 'field_worker',
          company: u.company_id ? String(u.company_id) : (u.company ? String(u.company) : undefined),
          status: 'active' as const,
          avatar: u.avatar ? String(u.avatar) : undefined,
          phone: u.phone ? String(u.phone) : undefined,
          createdAt: String(u.createdAt ?? ''),
        })));
        // Also fetch company names for display
        apiFetch('/companies')
          .then((companies: unknown) => {
            const map: Record<string, string> = {};
            if (Array.isArray(companies)) {
              for (const c of companies as AnyRow[]) {
                map[String(c.id)] = String(c.name ?? '');
              }
            }
            setCompanyNames(map);
          })
          .catch((e: unknown) => {
            console.warn('[UsersTab] failed to load company names — company column will show IDs:', e);
          });
      })
      .catch((e: unknown) => {
        console.error('[UsersTab] failed to load users:', e);
        toast.error('Failed to load users. Please refresh the page.');
      })
      .finally(() => setFetchLoading(false));
  };

  useEffect(() => {
    if (propUsers.length === 0) loadUsers();
    else setFetchLoading(false);
  }, [propUsers.length]);

  const users = propUsers.length > 0 ? propUsers : fetchedUsers;
  const loading = propLoading || fetchLoading;

  const filteredUsers = users.filter(user => {
    if (searchQuery && !user.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !user.email.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterRole !== 'all' && user.role !== filterRole) return false;
    if (filterStatus !== 'all' && user.status !== filterStatus) return false;
    return true;
  });

  const bulkActions: BulkAction[] = [
    { id: 'activate', label: 'Activate', icon: UserCheck, variant: 'primary', onClick: () => handleBulkAction('activate') },
    { id: 'deactivate', label: 'Deactivate', icon: UserX, variant: 'default', onClick: () => handleBulkAction('deactivate') },
    { id: 'delete', label: 'Delete', icon: Trash2, variant: 'danger', onClick: () => handleBulkAction('delete'), confirm: 'Are you sure?' },
  ];

  const [newUser, setNewUser] = useState<Partial<User>>({
    name: '', email: '', role: 'field_worker', status: 'active',
  });

  const handleCreate = async () => {
    if (!newUser.name || !newUser.email) {
      toast.error('Name and email are required');
      return;
    }
    setCreating(true);
    try {
      await usersApi.create({
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
      });
      toast.success('User created successfully');
      setShowCreateModal(false);
      setNewUser({ name: '', email: '', role: 'field_worker', status: 'active' });
      onRefresh?.(); loadUsers();
    } catch {
      toast.error('Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const [editingUser, setEditingUser] = useState<{ name: string; email: string; role: UserRole; status: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleEditSave = async () => {
    if (!selectedUser || !editingUser) return;
    setSaving(true);
    try {
      await usersApi.update(selectedUser.id, {
        name: editingUser.name,
        email: editingUser.email,
        role: editingUser.role,
        status: editingUser.status,
      });
      toast.success('User updated successfully');
      setShowEditModal(false);
      setSelectedUser(null);
      setEditingUser(null);
      onRefresh?.(); loadUsers();
    } catch (err) {
      toast.error(`Failed to update user: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (user: User) => {
    if (!confirm(`Reset password for ${user.name}?`)) return;
    try {
      await apiFetch(`/auth/reset-password/${user.id}`, { method: 'POST' });
      toast.success(`Password reset email sent to ${user.email}`);
    } catch (err) {
      toast.error(`Failed to reset password: ${(err as Error).message}`);
    }
  };

  const handleBulkAction = async (action: string) => {
    const ids = Array.from(selectedIds);
    if (action === 'delete') {
      if (!confirm(`Delete ${ids.length} users? This cannot be undone.`)) return;
      try {
        await Promise.all(ids.map(id => usersApi.delete(id)));
        toast.success(`Deleted ${ids.length} users`);
        onRefresh?.(); loadUsers();
        clearSelection();
      } catch {
        toast.error('Failed to delete users');
      }
    } else if (action === 'activate' || action === 'deactivate') {
      const isActive = action === 'activate';
      try {
        await Promise.all(ids.map(id => usersApi.setActive(id, isActive)));
        toast.success(`${isActive ? 'Activated' : 'Deactivated'} ${ids.length} user${ids.length !== 1 ? 's' : ''}`);
        onRefresh?.(); loadUsers();
        clearSelection();
      } catch {
        toast.error(`Failed to ${action} users`);
      }
    }
  };

  const columns = [
    { key: 'user', header: 'User', width: '250px', render: (user: AnyRow) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm">
          {String(user.name || '').charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-medium text-white">{String(user.name || '')}</p>
          <p className="text-xs text-gray-500">{String(user.email || '')}</p>
        </div>
      </div>
    )},
    { key: 'role', header: 'Role', width: '150px', render: (user: AnyRow) => {
      const role = String(user.role || 'field_worker') as UserRole;
      return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${ROLE_COLORS[role] || ROLE_COLORS.field_worker}`}>
          {ROLE_LABELS[role] || 'Field Worker'}
        </span>
      );
    }},
    { key: 'status', header: 'Status', width: '120px', render: (user: AnyRow) => (
      <StatusBadge status={String(user.status || 'active')} />
    )},
    { key: 'company', header: 'Company', width: '180px', render: (user: AnyRow) => {
      const companyId = String(user.company || '');
      const companyName = companyId ? (companyNames[companyId] || companyId) : '\u2014';
      return <span className="text-sm text-gray-300">{companyName}</span>;
    }},
    { key: 'lastLogin', header: 'Last Login', width: '150px', render: (user: AnyRow) => (
      <span className="text-sm text-gray-400">{fmtDateTime(String(user.lastLogin || ''))}</span>
    )},
    { key: 'actions', header: 'Actions', width: '120px', render: (user: AnyRow) => (
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            const u = user as unknown as User;
            setSelectedUser(u);
            setEditingUser({ name: u.name, email: u.email, role: u.role, status: u.status });
            setShowEditModal(true);
          }}
          className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
          title="Edit user"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleResetPassword(user as unknown as User); }}
          className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
          title="Reset password"
        >
          <Lock className="w-4 h-4" />
        </button>
      </div>
    )},
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <div className="h-10 w-64 bg-gray-800 rounded-lg animate-pulse" />
            <div className="h-10 w-40 bg-gray-800 rounded-lg animate-pulse" />
            <div className="h-10 w-40 bg-gray-800 rounded-lg animate-pulse" />
          </div>
          <div className="h-10 w-32 bg-gray-800 rounded-lg animate-pulse" />
        </div>
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-800/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Roles</option>
          {Object.entries(ROLE_LABELS).map(([role, label]) => (
            <option key={role} value={role}>{label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
        <button onClick={() => setShowCreateModal(true)} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add User
        </button>
        <button onClick={onRefresh} className="btn btn-secondary p-2">
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="border border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-900 sticky top-0 z-10">
            <tr className="border-b border-gray-700">
              <th className="w-12 p-3">
                <button onClick={toggleAll} className="flex items-center justify-center">
                  {selectedIds.size === filteredUsers.length && filteredUsers.length > 0 ? (
                    <CheckSquare className="w-5 h-5 text-blue-500" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-600 hover:text-gray-400" />
                  )}
                </button>
              </th>
              {columns.map(col => (
                <th key={col.key} className="text-left p-3 text-xs font-medium text-gray-400 uppercase" style={{ width: col.width }}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="p-12 text-center">
                  <EmptyState title="No users found" description="Try adjusting your search or filters" />
                </td>
              </tr>
            ) : (
              filteredUsers.map(user => (
                <tr
                  key={user.id}
                  onClick={() => toggle(user.id)}
                  className={clsx(
                    'border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer transition-colors',
                    isSelected(user.id) && 'bg-blue-900/20'
                  )}
                >
                  <td className="p-3">
                    <div className="flex items-center justify-center">
                      {isSelected(user.id) ? (
                        <CheckSquare className="w-5 h-5 text-blue-500" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-600 hover:text-gray-400" />
                      )}
                    </div>
                  </td>
                  {columns.map(col => (
                    <td key={col.key} className="p-3">
                      {col.render ? col.render(user as unknown as AnyRow) : String((user as unknown as AnyRow)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <BulkActionsBar
          selectedIds={Array.from(selectedIds)}
          actions={bulkActions}
          onClearSelection={clearSelection}
        />
      )}

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New User"
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowCreateModal(false)} className="btn btn-secondary">Cancel</button>
            <button onClick={handleCreate} disabled={creating} className="btn btn-primary">
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Create User
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Full Name</label>
            <input
              type="text"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="john@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Role</label>
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              {Object.entries(ROLE_LABELS).map(([role, label]) => (
                <option key={role} value={role}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
            <select
              value={newUser.status}
              onChange={(e) => setNewUser({ ...newUser, status: e.target.value as User['status'] })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setSelectedUser(null); }}
        title="Edit User"
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => { setShowEditModal(false); setSelectedUser(null); }} className="btn btn-secondary">Cancel</button>
            <button onClick={handleEditSave} disabled={saving} className="btn btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Changes
            </button>
          </div>
        }
      >
        {selectedUser && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Full Name</label>
              <input type="text" defaultValue={selectedUser.name} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
              <input type="email" defaultValue={selectedUser.email} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Role</label>
              <select defaultValue={selectedUser.role} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500">
                {Object.entries(ROLE_LABELS).map(([role, label]) => (
                  <option key={role} value={role}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
              <select defaultValue={selectedUser.status} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
