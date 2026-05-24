import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Settings } from '../components/modules/Settings';
import * as api from '../services/api';

vi.mock('../services/api');

const mockCompanyData = {
  id: 'company_1',
  name: 'Test Company Ltd',
  registeredAddress: '123 Business Street',
  city: 'London',
  country: 'UK',
  postalCode: 'EC1A 1BB',
  phone: '+44 20 1234 5678',
  email: 'contact@testcompany.co.uk',
  website: 'www.testcompany.co.uk',
  companiesHouseNumber: '12345678',
  vatNumber: 'GB123456789',
  utrNumber: '1234567890',
  hmrcOffice: 'London',
  cisContractor: true,
  cisSubcontractor: false,
  logoUrl: '',
};

const mockUsers = [
  {
    id: 'user_1',
    name: 'John Doe',
    email: 'john@test.com',
    role: 'admin',
    is_active: true,
    last_login_at: '2026-04-25T10:00:00Z',
  },
  {
    id: 'user_2',
    name: 'Jane Smith',
    email: 'jane@test.com',
    role: 'project_manager',
    is_active: true,
    last_login_at: '2026-04-24T15:30:00Z',
  },
];

const mockSettings = {
  notifications: {
    safety_incidents: true,
    rfis_raised: true,
    invoice_overdue: true,
  },
  integrations: {
    hmrc_cis: { connected: false, status: 'Not connected' },
    xero: { connected: false, status: 'Not connected' },
  },
  security: {
    twoFA: false,
  },
};

describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Settings component with all tabs', async () => {
    vi.mocked(api.companyApi.get).mockResolvedValue(mockCompanyData);
    vi.mocked(api.usersApi.getAll).mockResolvedValue(mockUsers);
    vi.mocked(api.settingsApi.getAll).mockResolvedValue(mockSettings);

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Settings/i })).toBeInTheDocument();
    });

    expect(screen.getByText('Company')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Integrations')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
  });

  it('loads company settings on mount', async () => {
    vi.mocked(api.companyApi.get).mockResolvedValue(mockCompanyData);
    vi.mocked(api.usersApi.getAll).mockResolvedValue(mockUsers);
    vi.mocked(api.settingsApi.getAll).mockResolvedValue(mockSettings);

    render(<Settings />);

    expect(api.companyApi.get).toHaveBeenCalled();

    await waitFor(() => {
      const companyNameInput = screen.getByDisplayValue('Test Company Ltd') as HTMLInputElement;
      expect(companyNameInput.value).toBe('Test Company Ltd');
    });
  });

  it('loads users on mount', async () => {
    vi.mocked(api.companyApi.get).mockResolvedValue(mockCompanyData);
    vi.mocked(api.usersApi.getAll).mockResolvedValue(mockUsers);
    vi.mocked(api.settingsApi.getAll).mockResolvedValue(mockSettings);

    render(<Settings />);

    expect(api.usersApi.getAll).toHaveBeenCalled();

    // Switch to Users tab
    const usersTab = screen.getByText('Users');
    fireEvent.click(usersTab);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  it('loads settings on mount', async () => {
    vi.mocked(api.companyApi.get).mockResolvedValue(mockCompanyData);
    vi.mocked(api.usersApi.getAll).mockResolvedValue(mockUsers);
    vi.mocked(api.settingsApi.getAll).mockResolvedValue(mockSettings);

    render(<Settings />);

    expect(api.settingsApi.getAll).toHaveBeenCalled();
  });

  it('saves company settings when Save button is clicked', async () => {
    vi.mocked(api.companyApi.get).mockResolvedValue(mockCompanyData);
    vi.mocked(api.usersApi.getAll).mockResolvedValue(mockUsers);
    vi.mocked(api.settingsApi.getAll).mockResolvedValue(mockSettings);
    vi.mocked(api.companyApi.update).mockResolvedValue(mockCompanyData);

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Company Ltd')).toBeInTheDocument();
    });

    // Change company name
    const companyNameInput = screen.getByDisplayValue('Test Company Ltd') as HTMLInputElement;
    fireEvent.change(companyNameInput, { target: { value: 'Updated Company Ltd' } });

    // Click save button
    const saveButton = screen.getByText('Save Company Settings');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(api.companyApi.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Company Ltd',
        })
      );
    });
  });

  it('displays loading state while fetching data', async () => {
    vi.mocked(api.companyApi.get).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockCompanyData), 100))
    );
    vi.mocked(api.usersApi.getAll).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockUsers), 100))
    );
    vi.mocked(api.settingsApi.getAll).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockSettings), 100))
    );

    render(<Settings />);

    // Eventually should load
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Settings/i })).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    vi.mocked(api.companyApi.get).mockRejectedValue(new Error('Network error'));
    vi.mocked(api.usersApi.getAll).mockRejectedValue(new Error('Network error'));
    vi.mocked(api.settingsApi.getAll).mockRejectedValue(new Error('Network error'));

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Settings/i })).toBeInTheDocument();
    });

    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });

  it('switches between tabs correctly', async () => {
    vi.mocked(api.companyApi.get).mockResolvedValue(mockCompanyData);
    vi.mocked(api.usersApi.getAll).mockResolvedValue(mockUsers);
    vi.mocked(api.settingsApi.getAll).mockResolvedValue(mockSettings);

    render(<Settings />);

    // Initially on Company tab - should show company form
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Company Ltd')).toBeInTheDocument();
    });

    // Switch to Users tab
    fireEvent.click(screen.getByText('Users'));

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Switch to Notifications tab
    fireEvent.click(screen.getByText('Notifications'));

    await waitFor(() => {
      expect(screen.getByText('Delivery Channels')).toBeInTheDocument();
    });
  });

  it('invites a new user', async () => {
    vi.mocked(api.companyApi.get).mockResolvedValue(mockCompanyData);
    vi.mocked(api.usersApi.getAll).mockResolvedValue(mockUsers);
    vi.mocked(api.settingsApi.getAll).mockResolvedValue(mockSettings);
    vi.mocked(api.usersApi.create).mockResolvedValue({
      id: 'user_3',
      name: 'New User',
      email: 'newuser@test.com',
      role: 'project_manager',
    });

    render(<Settings />);

    // Switch to Users tab
    fireEvent.click(screen.getByText('Users'));

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click Invite User button
    const inviteButton = screen.getByText('Invite User');
    fireEvent.click(inviteButton);

    await waitFor(() => {
      expect(screen.getByText('Invite Team Member')).toBeInTheDocument();
    });

    // Fill in the invite form
    const emailInput = screen.getByPlaceholderText('name@company.co.uk') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'newuser@test.com' } });

    // Submit invite
    const sendButton = screen.getByText('Send Invite');
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(api.usersApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'newuser@test.com',
        })
      );
    });
  });

  it('saves notification preferences', async () => {
    vi.mocked(api.companyApi.get).mockResolvedValue(mockCompanyData);
    vi.mocked(api.usersApi.getAll).mockResolvedValue(mockUsers);
    vi.mocked(api.settingsApi.getAll).mockResolvedValue(mockSettings);
    vi.mocked(api.settingsApi.updateSetting).mockResolvedValue({
      key: 'notifications',
      value: mockSettings.notifications,
    });

    render(<Settings />);

    // Switch to Notifications tab
    fireEvent.click(screen.getByText('Notifications'));

    await waitFor(() => {
      expect(screen.getByText('Delivery Channels')).toBeInTheDocument();
    });

    // Find and click Save Preferences button
    const saveButton = screen.getByText('Save Preferences');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(api.settingsApi.updateSetting).toHaveBeenCalled();
    });
  });
});
