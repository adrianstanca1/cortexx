import { NotificationPreference } from './NotificationPreferences';

interface PreferenceRowProps {
  preference: NotificationPreference;
  updatePreference: (
    type: string,
    channel: keyof Omit<NotificationPreference, 'type' | 'label'>,
    value: boolean
  ) => void;
}

export function PreferenceRow({ preference, updatePreference }: PreferenceRowProps) {
  return (
    <tr>
      <td className="font-medium">{preference.label}</td>
      <td className="text-center">
        <input
          type="checkbox"
          checked={preference.push}
          onChange={e => updatePreference(preference.type, 'push', e.target.checked)}
          className="checkbox checkbox-sm checkbox-primary"
          aria-label={`Enable push notifications for ${preference.label}`}
        />
      </td>
      <td className="text-center">
        <input
          type="checkbox"
          checked={preference.email}
          onChange={e => updatePreference(preference.type, 'email', e.target.checked)}
          className="checkbox checkbox-sm checkbox-primary"
          aria-label={`Enable email notifications for ${preference.label}`}
        />
      </td>
      <td className="text-center">
        <input
          type="checkbox"
          checked={preference.sms}
          onChange={e => updatePreference(preference.type, 'sms', e.target.checked)}
          className="checkbox checkbox-sm checkbox-primary"
          aria-label={`Enable SMS notifications for ${preference.label}`}
        />
      </td>
      <td className="text-center">
        <input
          type="checkbox"
          checked={preference.inApp}
          onChange={e => updatePreference(preference.type, 'inApp', e.target.checked)}
          className="checkbox checkbox-sm checkbox-primary"
          aria-label={`Enable in-app notifications for ${preference.label}`}
        />
      </td>
    </tr>
  );
}
