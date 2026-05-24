import { Bell, Mail, MessageSquare } from 'lucide-react';
import { ReactNode } from 'react';

interface ChannelHeaderProps {
  channel: 'push' | 'email' | 'sms' | 'inApp';
  label: string;
}

const channelIcons: Record<string, ReactNode> = {
  push: <Bell className="w-4 h-4" />,
  email: <Mail className="w-4 h-4" />,
  sms: <MessageSquare className="w-4 h-4" />,
  inApp: <Bell className="w-4 h-4" />,
};

export function ChannelHeader({ channel, label }: ChannelHeaderProps) {
  return (
    <th className="text-center">
      <div className="flex items-center justify-center gap-1">
        {channelIcons[channel]}
        {label}
      </div>
    </th>
  );
}
