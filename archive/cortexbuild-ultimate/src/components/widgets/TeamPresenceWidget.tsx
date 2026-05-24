import React, { useState } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Phone,
  MessageSquare,
  Mail,
  MapPin,
  Clock,
  Search,
  RefreshCw,
  HardHat,
  ClipboardList,
  Building,
} from 'lucide-react';

/**
 * TeamPresenceWidget
 *
 * Displays who's on site today, check-in/check-out status,
 * role badges, and contact quick actions.
 *
 * @param props - Component props
 * @returns JSX element displaying team presence
 *
 * @example
 * ```tsx
 * <TeamPresenceWidget
 *   projectId="proj-123"
 *   onMemberClick={(member) => handleNavigate(member)}
 *   onContact={(member, method) => handleContact(member, method)}
 * />
 * ```
 */

export type PresenceStatus = 'on_site' | 'off_site' | 'checked_in' | 'checked_out' | 'on_leave' | 'late';
export type Role = 'manager' | 'supervisor' | 'worker' | 'contractor' | 'visitor' | 'subcontractor';
export type TeamPresenceSize = 'small' | 'medium' | 'large';

export interface TeamMember {
  id: string;
  name: string;
  role: Role;
  trade?: string;
  company?: string;
  avatar?: string;
  status: PresenceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  location?: string;
  phone?: string;
  email?: string;
  projectId?: string;
}

export interface TeamPresenceData {
  totalMembers: number;
  onSite: number;
  offSite: number;
  checkedIn: number;
  checkedOut: number;
  onLeave: number;
  late: number;
  members: TeamMember[];
}

export interface TeamPresenceWidgetProps {
  /** Optional project ID to filter members */
  projectId?: string;
  /** Click handler for member items */
  onMemberClick?: (member: TeamMember) => void;
  /** Contact handler */
  onContact?: (member: TeamMember, method: 'call' | 'message' | 'email') => void;
  /** Size variant */
  size?: TeamPresenceSize;
  /** Show search */
  showSearch?: boolean;
  /** Show filter controls */
  showFilter?: boolean;
  /** Show contact actions */
  showContactActions?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Refresh handler */
  onRefresh?: () => void;
  /** Custom className */
  className?: string;
}

const statusConfig: Record<PresenceStatus, {
  label: string;
  color: string;
  bg: string;
  icon: React.ReactNode;
}> = {
  on_site: {
    label: 'On Site',
    color: 'text-green-600',
    bg: 'bg-green-100 dark:bg-green-900/30',
    icon: <UserCheck className="w-3 h-3" />,
  },
  checked_in: {
    label: 'Checked In',
    color: 'text-blue-600',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    icon: <UserCheck className="w-3 h-3" />,
  },
  off_site: {
    label: 'Off Site',
    color: 'text-gray-600',
    bg: 'bg-gray-100 dark:bg-gray-700',
    icon: <UserX className="w-3 h-3" />,
  },
  checked_out: {
    label: 'Checked Out',
    color: 'text-gray-500',
    bg: 'bg-gray-100 dark:bg-gray-700',
    icon: <Clock className="w-3 h-3" />,
  },
  on_leave: {
    label: 'On Leave',
    color: 'text-yellow-600',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    icon: <Clock className="w-3 h-3" />,
  },
  late: {
    label: 'Late',
    color: 'text-orange-600',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    icon: <Clock className="w-3 h-3" />,
  },
};

const roleConfig: Record<Role, {
  label: string;
  icon: React.ReactNode;
  color: string;
}> = {
  manager: {
    label: 'Manager',
    icon: <Building className="w-3 h-3" />,
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
  supervisor: {
    label: 'Supervisor',
    icon: <ClipboardList className="w-3 h-3" />,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  worker: {
    label: 'Worker',
    icon: <HardHat className="w-3 h-3" />,
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  contractor: {
    label: 'Contractor',
    icon: <HardHat className="w-3 h-3" />,
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  },
  subcontractor: {
    label: 'Subcontractor',
    icon: <HardHat className="w-3 h-3" />,
    color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  },
  visitor: {
    label: 'Visitor',
    icon: <UserCheck className="w-3 h-3" />,
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400',
  },
};

const sizeClasses: Record<TeamPresenceSize, {
  padding: string;
  textSize: string;
  labelSize: string;
  valueSize: string;
  itemPadding: string;
  avatarSize: string;
}> = {
  small: {
    padding: 'p-3',
    textSize: 'text-xs',
    labelSize: 'text-xs',
    valueSize: 'text-lg',
    itemPadding: 'p-2',
    avatarSize: 'w-8 h-8',
  },
  medium: {
    padding: 'p-4',
    textSize: 'text-sm',
    labelSize: 'text-sm',
    valueSize: 'text-2xl',
    itemPadding: 'p-2.5',
    avatarSize: 'w-10 h-10',
  },
  large: {
    padding: 'p-5',
    textSize: 'text-base',
    labelSize: 'text-base',
    valueSize: 'text-3xl',
    itemPadding: 'p-3',
    avatarSize: 'w-12 h-12',
  },
};

/**
 * StatusBadge Component
 */
function StatusBadge({ status, size: _size }: { status: PresenceStatus; size: TeamPresenceSize }) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

/**
 * RoleBadge Component
 */
function RoleBadge({ role, trade }: { role: Role; trade?: string }) {
  const config = roleConfig[role];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${config.color}`}
    >
      {config.icon}
      {config.label}
      {trade && <span className="opacity-75">• {trade}</span>}
    </span>
  );
}

/**
 * MemberCard Component
 */
function MemberCard({
  member,
  size,
  showContactActions,
  onClick,
  onContact,
}: {
  member: TeamMember;
  size: TeamPresenceSize;
  showContactActions?: boolean;
  onClick?: () => void;
  onContact?: (method: 'call' | 'message' | 'email') => void;
}) {
  const sizes = sizeClasses[size];
  const _status = statusConfig[member.status];

  const formatTime = (timeStr?: string): string => {
    if (!timeStr) return '';
    return new Date(timeStr).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <div
      className={`${sizes.itemPadding} rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="relative">
          {member.avatar ? (
            <img
              src={member.avatar}
              alt={member.name}
              className={`${sizes.avatarSize} rounded-full object-cover ring-2 ring-white dark:ring-gray-700`}
            />
          ) : (
            <div
              className={`${sizes.avatarSize} rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-medium text-sm ring-2 ring-white dark:ring-gray-700`}
            >
              {getInitials(member.name)}
            </div>
          )}
          {/* Status Indicator */}
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${
              member.status === 'on_site' || member.status === 'checked_in'
                ? 'bg-green-500'
                : member.status === 'late'
                ? 'bg-orange-500'
                : 'bg-gray-400'
            }`}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`${sizes.textSize} font-semibold text-gray-900 dark:text-white truncate`}>
              {member.name}
            </p>
            <StatusBadge status={member.status} size={size} />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <RoleBadge role={member.role} trade={member.trade} />
            {member.company && (
              <span className={`${sizes.labelSize} text-gray-500 dark:text-gray-400 truncate`}>
                {member.company}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            {member.checkInTime && (
              <span className={`${sizes.labelSize} text-gray-500 dark:text-gray-400 flex items-center gap-1`}>
                <Clock className="w-3 h-3" />
                In: {formatTime(member.checkInTime)}
              </span>
            )}
            {member.location && (
              <span className={`${sizes.labelSize} text-gray-500 dark:text-gray-400 flex items-center gap-1`}>
                <MapPin className="w-3 h-3" />
                {member.location}
              </span>
            )}
          </div>
        </div>

        {/* Contact Actions */}
        {showContactActions && (member.phone || member.email) && (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {member.phone && (
              <>
                <button
                  onClick={() => onContact?.('call')}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors"
                  aria-label="Call"
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onContact?.('message')}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors"
                  aria-label="Message"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </>
            )}
            {member.email && (
              <button
                onClick={() => onContact?.('email')}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors"
                aria-label="Email"
              >
                <Mail className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * TeamPresenceWidget Component
 */
export function TeamPresenceWidget({
  projectId,
  onMemberClick,
  onContact,
  size = 'medium',
  showSearch = true,
  showFilter = true,
  showContactActions = true,
  isLoading = false,
  onRefresh,
  className = '',
}: TeamPresenceWidgetProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<PresenceStatus | 'all'>('all');
  const [filterRole, setFilterRole] = useState<Role | 'all'>('all');
  const sizes = sizeClasses[size];

  // Mock data - replace with actual API call
  const [teamData] = useState<TeamPresenceData>({
    totalMembers: 47,
    onSite: 32,
    offSite: 10,
    checkedIn: 30,
    checkedOut: 12,
    onLeave: 3,
    late: 2,
    members: [
      {
        id: '1',
        name: 'John Smith',
        role: 'manager',
        trade: 'Site Manager',
        company: 'BuildCorp Ltd',
        status: 'on_site',
        checkInTime: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        location: 'Block A',
        phone: '+44 7700 900001',
        email: 'john.smith@buildcorp.co.uk',
      },
      {
        id: '2',
        name: 'Sarah Chen',
        role: 'supervisor',
        trade: 'Safety Officer',
        company: 'SafeBuild',
        status: 'on_site',
        checkInTime: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
        location: 'Main Site',
        phone: '+44 7700 900002',
        email: 'sarah.chen@safebuild.co.uk',
      },
      {
        id: '3',
        name: 'Mike Johnson',
        role: 'worker',
        trade: 'Electrician',
        company: 'ElectroFix',
        status: 'checked_in',
        checkInTime: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(),
        location: 'North Wing',
        phone: '+44 7700 900003',
      },
      {
        id: '4',
        name: 'Emma Wilson',
        role: 'contractor',
        trade: 'Plumber',
        company: 'PipeMasters',
        status: 'late',
        checkInTime: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        location: 'Block B',
      },
      {
        id: '5',
        name: 'David Lee',
        role: 'subcontractor',
        trade: 'Carpenter',
        company: 'WoodWorks Ltd',
        status: 'off_site',
      },
      {
        id: '6',
        name: 'Patricia Watson',
        role: 'visitor',
        status: 'on_site',
        checkInTime: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        location: 'Site Office',
      },
    ],
  });

  const filteredMembers = teamData.members.filter((member) => {
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.trade?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.company?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || member.status === filterStatus;
    const matchesRole = filterRole === 'all' || member.role === filterRole;
    const matchesProject = !projectId || member.projectId === projectId;
    return matchesSearch && matchesStatus && matchesRole && matchesProject;
  });

  const stats = [
    { label: 'On Site', value: teamData.onSite, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
    { label: 'Checked In', value: teamData.checkedIn, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    { label: 'Off Site', value: teamData.offSite, color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-700' },
    { label: 'On Leave', value: teamData.onLeave, color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
  ];

  if (isLoading) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 ${className}`}
      >
        <div className={`${sizes.padding} space-y-3 animate-pulse`}>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className={`${sizes.padding} border-b border-gray-100 dark:border-gray-700`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`${sizes.textSize} font-semibold text-gray-900 dark:text-white flex items-center gap-2`}>
            <Users className="w-5 h-5 text-blue-600" />
            Team Presence
          </h3>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className={`${stat.bg} rounded-lg p-2 text-center`}>
              <div className={`${sizes.valueSize} font-bold ${stat.color}`}>{stat.value}</div>
              <div className={`${sizes.labelSize} text-gray-600 dark:text-gray-400`}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Search & Filters */}
        {(showSearch || showFilter) && (
          <div className="flex gap-2 mt-4">
            {showSearch && (
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search team members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2 ${sizes.textSize} bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-primary`}
                />
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            )}
            {showFilter && (
              <>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as PresenceStatus | 'all')}
                  className={`px-3 py-2 ${sizes.textSize} bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary cursor-pointer`}
                >
                  <option value="all">All Status</option>
                  {Object.keys(statusConfig).map((status) => (
                    <option key={status} value={status}>
                      {statusConfig[status as PresenceStatus].label}
                    </option>
                  ))}
                </select>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value as Role | 'all')}
                  className={`px-3 py-2 ${sizes.textSize} bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary cursor-pointer`}
                >
                  <option value="all">All Roles</option>
                  {Object.keys(roleConfig).map((role) => (
                    <option key={role} value={role}>
                      {roleConfig[role as Role].label}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}
      </div>

      {/* Member List */}
      <div className={`${sizes.padding} space-y-2 max-h-[500px] overflow-y-auto`}>
        {filteredMembers.length > 0 ? (
          filteredMembers.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              size={size}
              showContactActions={showContactActions}
              onClick={() => onMemberClick?.(member)}
              onContact={(method) => onContact?.(member, method)}
            />
          ))
        ) : (
          <div className="text-center py-8">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className={`${sizes.textSize} text-gray-500 dark:text-gray-400`}>
              No team members found
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TeamPresenceWidget;
