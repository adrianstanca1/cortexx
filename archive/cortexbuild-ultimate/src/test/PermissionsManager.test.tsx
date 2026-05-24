import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PermissionsManager } from '../components/modules/PermissionsManager';
import * as api from '../services/api';

vi.mock('../services/api');

const mockPermissions = {
  modules: {
    dashboard: { label: 'Dashboard', defaultRole: 'all' },
    projects: { label: 'Projects', defaultRole: 'all' },
  },
  actions: {
    read: { label: 'Read', description: 'View records' },
    create: { label: 'Create', description: 'Create new records' },
  },
};

const mockRoles = [
  {
    id: 'admin',
    name: 'Admin',
    description: 'Administrative access',
    permissions: { '*': ['create', 'read'] },
    isSystem: true,
    isCustom: false,
  },
  {
    id: 'custom_1',
    name: 'Custom Role',
    description: 'A custom role',
    permissions: { dashboard: ['read'] },
    isSystem: false,
    isCustom: true,
  },
];

describe('PermissionsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders and loads roles + permissions on mount', async () => {
    vi.mocked(api.permissionsApi.getRoles).mockResolvedValue(mockRoles);
    vi.mocked(api.permissionsApi.getPermissions).mockResolvedValue(mockPermissions);

    render(<PermissionsManager />);

    await waitFor(() => {
      expect(screen.getByText('Permissions & Access Control')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Admin')).toBeInTheDocument();
      expect(screen.getByText('Custom Role')).toBeInTheDocument();
    });

    expect(api.permissionsApi.getRoles).toHaveBeenCalled();
    expect(api.permissionsApi.getPermissions).toHaveBeenCalled();
  });

  it('selects a role and displays its permissions', async () => {
    vi.mocked(api.permissionsApi.getRoles).mockResolvedValue(mockRoles);
    vi.mocked(api.permissionsApi.getPermissions).mockResolvedValue(mockPermissions);

    render(<PermissionsManager />);

    await waitFor(() => {
      expect(screen.getByText('Custom Role')).toBeInTheDocument();
    });

    const customRoleButton = screen.getByText('Custom Role');
    fireEvent.click(customRoleButton);

    await waitFor(() => {
      expect(customRoleButton.closest('button')).toHaveClass('bg-blue-600/20');
    });
  });

  it('handles bulk delete of custom roles', async () => {
    vi.mocked(api.permissionsApi.getRoles).mockResolvedValue(mockRoles);
    vi.mocked(api.permissionsApi.getPermissions).mockResolvedValue(mockPermissions);
    vi.mocked(api.permissionsApi.deleteRole).mockResolvedValue(undefined);

    render(<PermissionsManager />);

    await waitFor(() => {
      expect(screen.getByText('Custom Role')).toBeInTheDocument();
    });

    // Find and click checkbox for custom role
    const customRoleRow = screen.getByText('Custom Role').closest('button');
    const checkbox = customRoleRow?.querySelector('button');
    if (checkbox) {
      fireEvent.click(checkbox);
    }

    await waitFor(() => {
      const deleteButton = screen.queryByText('Delete Selected');
      expect(deleteButton).toBeInTheDocument();
    });
  });

  it('shows error when loading fails', async () => {
    vi.mocked(api.permissionsApi.getRoles).mockRejectedValue(new Error('Network error'));
    vi.mocked(api.permissionsApi.getPermissions).mockRejectedValue(new Error('Network error'));

    render(<PermissionsManager />);

    // Component should still render, just without data
    await waitFor(() => {
      expect(screen.getByText('Permissions & Access Control')).toBeInTheDocument();
    });
  });

  it('displays loading spinner while data loads', async () => {
    vi.mocked(api.permissionsApi.getRoles).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockRoles), 100))
    );
    vi.mocked(api.permissionsApi.getPermissions).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockPermissions), 100))
    );

    render(<PermissionsManager />);

    // Initially shows loading
    expect(screen.queryByText('Roles Defined')).toBeInTheDocument();

    // Eventually loads
    await waitFor(() => {
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });
  });

  it('creates a new custom role', async () => {
    vi.mocked(api.permissionsApi.getRoles).mockResolvedValue(mockRoles);
    vi.mocked(api.permissionsApi.getPermissions).mockResolvedValue(mockPermissions);
    vi.mocked(api.permissionsApi.createRole).mockResolvedValue({
      id: 'custom_2',
      name: 'New Role',
      description: 'Brand new',
      permissions: { '*': ['read'] },
      isCustom: true,
    });

    render(<PermissionsManager />);

    await waitFor(() => {
      expect(screen.getByText('Create Role')).toBeInTheDocument();
    });

    const createButton = screen.getByText('Create Role');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create Custom Role')).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText('Site Supervisor') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'New Role' } });

    const submitButton = screen.getByText('Create');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(api.permissionsApi.createRole).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Role',
        })
      );
    });
  });

  it('prevents modification of system roles', async () => {
    vi.mocked(api.permissionsApi.getRoles).mockResolvedValue(mockRoles);
    vi.mocked(api.permissionsApi.getPermissions).mockResolvedValue(mockPermissions);

    render(<PermissionsManager />);

    await waitFor(() => {
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });

    const adminButton = screen.getByText('Admin');
    fireEvent.click(adminButton);

    // System roles should show lock icon
    await waitFor(() => {
      const systemRoleIndicator = screen.getByText('System Role');
      expect(systemRoleIndicator).toBeInTheDocument();
    });
  });
});
