// Shared types, constants, and utilities for Admin Dashboard tabs

import { TrendingUp, TrendingDown } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'super_admin' | 'company_owner' | 'admin' | 'project_manager' | 'field_worker' | 'client';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  company?: string;
  status: 'active' | 'inactive' | 'suspended';
  avatar?: string;
  phone?: string;
  lastLogin?: string;
  createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  status: 'active' | 'suspended' | 'trial';
  /** `included` = free product, full workspace access (no paid tiers). */
  subscriptionPlan: 'included' | 'free' | 'starter' | 'professional' | 'enterprise';
  userCount: number;
  userLimit: number;
  projectCount: number;
  storageUsed: number;
  storageLimit: number;
  createdAt: string;
  expiresAt?: string;
}

export interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalCompanies: number;
  activeCompanies: number;
  totalProjects: number;
  activeProjects: number;
  activeSessions: number;
  apiCallsToday: number;
  storageUsed: number;
  storageTotal: number;
  systemHealth: 'healthy' | 'degraded' | 'critical';
  uptime: number;
}

export interface AuditEntry {
  id: number;
  user_id: string;
  action: string;
  table_name: string;
  record_id?: number;
  changes?: string;
  created_at: string;
  ip_address?: string;
  user?: { name: string; email: string; avatar?: string };
}

export interface ActivityFeedItem {
  id: string;
  type: 'user' | 'system' | 'alert' | 'success';
  title: string;
  description: string;
  timestamp: string;
  icon: React.ElementType;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: 'bg-red-500/20 text-red-400 border-red-500/30',
  company_owner: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  admin: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  project_manager: 'bg-green-500/20 text-green-400 border-green-500/30',
  field_worker: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  client: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  company_owner: 'Company Owner',
  admin: 'Admin',
  project_manager: 'Project Manager',
  field_worker: 'Field Worker',
  client: 'Client',
};

export const PLAN_COLORS: Record<string, string> = {
  included: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  free: 'bg-gray-500/20 text-gray-400',
  starter: 'bg-blue-500/20 text-blue-400',
  professional: 'bg-green-500/20 text-green-400',
  enterprise: 'bg-purple-500/20 text-purple-400',
};

export const PLAN_LABELS: Record<string, string> = {
  included: 'Full access',
  free: 'Free',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

export const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400',
  inactive: 'bg-gray-500/20 text-gray-400',
  suspended: 'bg-red-500/20 text-red-400',
  trial: 'bg-amber-500/20 text-amber-400',
};

export const HEALTH_COLORS: Record<string, string> = {
  healthy: 'text-emerald-400',
  degraded: 'text-amber-400',
  critical: 'text-red-400',
};

// ─── Utility Functions ────────────────────────────────────────────────────────

export const fmtNumber = (n: number) => n.toLocaleString();

export const fmtDate = (d: string) => {
  if (!d) return '\u2014';
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

export const fmtDateTime = (d: string) => {
  if (!d) return '\u2014';
  try { return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
};

export const fmtBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

export const getTimeAgo = (timestamp: string) => {
  const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const getTrendIcon = (change: number) => change >= 0 ? TrendingUp : TrendingDown;
