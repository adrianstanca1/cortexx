import { useState, useEffect } from 'react';
import {
  Settings2, ToggleRight, Mail, Key, Lock, CheckCircle2, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { settingsApi, type AppSettings } from '../../../services/api';
interface SettingsTabProps {
  settings?: AppSettings | null;
  loading?: boolean;
  onSave?: (settings: AppSettings) => void;
}

export default function SettingsTab({ settings = null, loading = false, onSave }: SettingsTabProps) {
  const [activeSection, setActiveSection] = useState('general');
  const [localSettings, setLocalSettings] = useState<AppSettings>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) setLocalSettings(settings);
  }, [settings]);

  const sections = [
    { id: 'general', label: 'General', icon: Settings2 },
    { id: 'features', label: 'Feature Flags', icon: ToggleRight },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'oauth', label: 'OAuth', icon: Key },
    { id: 'api', label: 'API Keys', icon: Lock },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsApi.updateSetting('theme', localSettings.theme || 'dark');
      toast.success('Settings saved successfully');
      onSave?.(localSettings);
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex gap-6">
        <div className="w-64 space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-800 rounded-lg animate-pulse" />)}
        </div>
        <div className="flex-1 space-y-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-gray-800 rounded-lg animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <div className="w-64 shrink-0">
        <nav className="space-y-1">
          {sections.map(section => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  activeSection === section.id
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                )}
              >
                <Icon className="w-4 h-4" />
                {section.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white capitalize">{activeSection} Settings</h3>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Save Changes
          </button>
        </div>

        {activeSection === 'general' && (
          <div className="space-y-6">
            <div className="card p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Platform Name</label>
                <input type="text" defaultValue="CortexBuild Ultimate" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Default Theme</label>
                <select
                  value={localSettings.theme || 'dark'}
                  onChange={(e) => setLocalSettings({ ...localSettings, theme: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="auto">Auto</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Default Language</label>
                <select
                  value={localSettings.language || 'en'}
                  onChange={(e) => setLocalSettings({ ...localSettings, language: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Timezone</label>
                <select
                  value={localSettings.timezone || 'Europe/London'}
                  onChange={(e) => setLocalSettings({ ...localSettings, timezone: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Europe/London">London (GMT)</option>
                  <option value="America/New_York">New York (EST)</option>
                  <option value="America/Los_Angeles">Los Angeles (PST)</option>
                  <option value="Europe/Paris">Paris (CET)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'features' && (
          <div className="space-y-4">
            {[
              { key: 'allow_registration', label: 'User Registration', desc: 'Allow new users to register' },
              { key: 'email_verification', label: 'Email Verification', desc: 'Require email verification on signup' },
              { key: 'two_factor_auth', label: 'Two-Factor Auth', desc: 'Enable 2FA for all users' },
              { key: 'api_access', label: 'API Access', desc: 'Allow API key generation' },
            ].map((flag) => (
              <div key={flag.key} className="card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-white">{flag.label}</h4>
                    <p className="text-sm text-gray-500 mt-1">{flag.desc}</p>
                  </div>
                  <button
                    onClick={() => setLocalSettings({ ...localSettings, [flag.key]: !(localSettings as Record<string, unknown>)[flag.key] })}
                    className={clsx('relative w-12 h-6 rounded-full transition-colors', (localSettings as Record<string, unknown>)[flag.key] ? 'bg-blue-500' : 'bg-gray-700')}
                  >
                    <div className={clsx('absolute top-1 w-4 h-4 rounded-full bg-white transition-transform', (localSettings as Record<string, unknown>)[flag.key] ? 'left-7' : 'left-1')} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSection === 'email' && (
          <div className="card p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">SMTP Host</label>
              <input type="text" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" placeholder="smtp.example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">SMTP Port</label>
              <input type="number" defaultValue={587} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">From Address</label>
              <input type="email" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" placeholder="noreply@cortexbuild.com" />
            </div>
          </div>
        )}

        {activeSection === 'oauth' && (
          <div className="space-y-4">
            {[
              { provider: 'Google', enabled: true, clientId: '***-apps.googleusercontent.com' },
              { provider: 'Microsoft', enabled: true, clientId: '***-msft-oauth.apps.microsoft.com' },
            ].map((oauth) => (
              <div key={oauth.provider} className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-white">{oauth.provider} OAuth</h4>
                  <button className={clsx('relative w-12 h-6 rounded-full transition-colors', oauth.enabled ? 'bg-blue-500' : 'bg-gray-700')}>
                    <div className={clsx('absolute top-1 w-4 h-4 rounded-full bg-white transition-transform', oauth.enabled ? 'left-7' : 'left-1')} />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Client ID</label>
                    <input type="text" defaultValue={oauth.clientId} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Client Secret</label>
                    <input type="password" defaultValue="********" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSection === 'api' && (
          <div className="card p-5 space-y-4">
            <div>
              <h4 className="font-medium text-white mb-2">Active API Keys</h4>
              <p className="text-sm text-gray-500 mb-4">Manage API keys for programmatic access</p>
            </div>
            <div className="space-y-3">
              {[
                { name: 'Production Key', prefix: 'pk_live_', created: '2024-01-15', lastUsed: '2 hours ago' },
                { name: 'Development Key', prefix: 'pk_test_', created: '2024-02-20', lastUsed: '1 day ago' },
              ].map((key, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div>
                    <p className="font-medium text-white">{key.name}</p>
                    <p className="text-sm text-gray-500 font-mono">{key.prefix}{'\u2022'.repeat(12)}</p>
                  </div>
                  <span className="text-xs text-gray-500">Last used {key.lastUsed}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
