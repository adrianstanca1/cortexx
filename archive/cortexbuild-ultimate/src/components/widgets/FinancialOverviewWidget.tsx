import React, { useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  FileText,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  ChevronRight,
  Calendar,
  AlertCircle,
} from 'lucide-react';

/**
 * FinancialOverviewWidget
 *
 * Displays financial overview including revenue vs expenses,
 * outstanding invoices, cash flow indicator, and budget utilization.
 *
 * @param props - Component props
 * @returns JSX element displaying financial overview
 *
 * @example
 * ```tsx
 * <FinancialOverviewWidget
 *   projectId="proj-123"
 *   onInvoiceClick={(invoice) => handleNavigate(invoice)}
 * />
 * ```
 */

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'disputed';
export type CashFlowTrend = 'positive' | 'negative' | 'stable';
export type FinancialOverviewSize = 'small' | 'medium' | 'large';

export interface Invoice {
  id: string;
  number: string;
  client: string;
  amount: number;
  status: InvoiceStatus;
  dueDate: string;
  project?: string;
}

export interface FinancialData {
  revenue: number;
  expenses: number;
  profit: number;
  revenueGrowth: number;
  expensesGrowth: number;
  outstandingInvoices: number;
  overdueInvoices: number;
  cashFlow: number;
  cashFlowTrend: CashFlowTrend;
  budgetUtilization: number;
  budgetTotal: number;
  budgetSpent: number;
  recentInvoices: Invoice[];
}

export interface FinancialOverviewWidgetProps {
  /** Optional project ID to filter data */
  projectId?: string;
  /** Click handler for invoices */
  onInvoiceClick?: (invoice: Invoice) => void;
  /** Size variant */
  size?: FinancialOverviewSize;
  /** Show revenue vs expenses chart */
  showRevenueChart?: boolean;
  /** Show budget utilization */
  showBudgetUtilization?: boolean;
  /** Show recent invoices */
  showInvoices?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Refresh handler */
  onRefresh?: () => void;
  /** Custom className */
  className?: string;
}

const invoiceStatusConfig: Record<InvoiceStatus, {
  label: string;
  color: string;
  bg: string;
}> = {
  draft: {
    label: 'Draft',
    color: 'text-gray-600',
    bg: 'bg-gray-100 dark:bg-gray-700',
  },
  sent: {
    label: 'Sent',
    color: 'text-blue-600',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
  },
  paid: {
    label: 'Paid',
    color: 'text-green-600',
    bg: 'bg-green-100 dark:bg-green-900/30',
  },
  overdue: {
    label: 'Overdue',
    color: 'text-red-600',
    bg: 'bg-red-100 dark:bg-red-900/30',
  },
  disputed: {
    label: 'Disputed',
    color: 'text-yellow-600',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
};

const sizeClasses: Record<FinancialOverviewSize, {
  padding: string;
  textSize: string;
  labelSize: string;
  valueSize: string;
  itemPadding: string;
}> = {
  small: {
    padding: 'p-3',
    textSize: 'text-xs',
    labelSize: 'text-xs',
    valueSize: 'text-lg',
    itemPadding: 'p-2',
  },
  medium: {
    padding: 'p-4',
    textSize: 'text-sm',
    labelSize: 'text-sm',
    valueSize: 'text-2xl',
    itemPadding: 'p-2.5',
  },
  large: {
    padding: 'p-5',
    textSize: 'text-base',
    labelSize: 'text-base',
    valueSize: 'text-3xl',
    itemPadding: 'p-3',
  },
};

/**
 * Format currency helper
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * MetricCard Component
 */
function MetricCard({
  icon,
  label,
  value,
  subtext,
  trend,
  color = 'blue',
  size,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  trend?: { value: number; isPositive: boolean };
  color?: string;
  size: FinancialOverviewSize;
}) {
  const sizes = sizeClasses[size];

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    yellow: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  };

  return (
    <div className={`${sizes.itemPadding} rounded-lg bg-gray-50 dark:bg-gray-700/50`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${colorClasses[color]}`}>{icon}</div>
        <span className={`${sizes.labelSize} text-gray-500 dark:text-gray-400`}>{label}</span>
      </div>
      <div className={`${sizes.valueSize} font-bold text-gray-900 dark:text-white`}>{value}</div>
      {subtext && (
        <p className={`${sizes.textSize} text-gray-500 dark:text-gray-400 mt-1`}>{subtext}</p>
      )}
      {trend && (
        <div className={`flex items-center gap-1 mt-1 ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {trend.isPositive ? (
            <ArrowUpRight className="w-3 h-3" />
          ) : (
            <ArrowDownRight className="w-3 h-3" />
          )}
          <span className={`${sizes.textSize} font-medium`}>{trend.value}%</span>
        </div>
      )}
    </div>
  );
}

/**
 * RevenueVsExpenses Component
 */
function RevenueVsExpenses({
  revenue,
  expenses,
  size,
}: {
  revenue: number;
  expenses: number;
  size: FinancialOverviewSize;
}) {
  const sizes = sizeClasses[size];
  const profit = revenue - expenses;
  const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const max = Math.max(revenue, expenses);

  return (
    <div className={`${sizes.padding} bg-gradient-to-br from-blue-50 to-green-50 dark:from-gray-700/50 dark:to-gray-700/30 rounded-lg`}>
      <div className="flex items-center justify-between mb-4">
        <h4 className={`${sizes.labelSize} font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2`}>
          <PieChart className="w-4 h-4" />
          Revenue vs Expenses
        </h4>
        <span
          className={`${sizes.textSize} font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-600'} flex items-center gap-1`}
        >
          {profit >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {profitMargin >= 0 ? '+' : ''}
          {profitMargin.toFixed(1)}% margin
        </span>
      </div>

      {/* Bar Chart */}
      <div className="space-y-3">
        <div>
          <div className="flex justify-between mb-1">
            <span className={`${sizes.textSize} text-gray-600 dark:text-gray-400`}>Revenue</span>
            <span className={`${sizes.textSize} font-medium text-green-600`}>{formatCurrency(revenue)}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-green-500 to-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${(revenue / max) * 100}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <span className={`${sizes.textSize} text-gray-600 dark:text-gray-400`}>Expenses</span>
            <span className={`${sizes.textSize} font-medium text-red-600`}>{formatCurrency(expenses)}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-red-500 to-orange-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${(expenses / max) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Profit */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
        <div className="flex justify-between items-center">
          <span className={`${sizes.textSize} text-gray-600 dark:text-gray-400`}>Net Profit</span>
          <span
            className={`${sizes.valueSize} font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            {formatCurrency(profit)}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * BudgetUtilization Component
 */
function BudgetUtilization({
  budgetTotal,
  budgetSpent,
  size,
}: {
  budgetTotal: number;
  budgetSpent: number;
  size: FinancialOverviewSize;
}) {
  const sizes = sizeClasses[size];
  const percentage = (budgetSpent / budgetTotal) * 100;
  const remaining = budgetTotal - budgetSpent;
  const isOverBudget = percentage > 100;

  return (
    <div className={`${sizes.padding} bg-gray-50 dark:bg-gray-700/50 rounded-lg`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className={`${sizes.labelSize} font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2`}>
          <FileText className="w-4 h-4" />
          Budget Utilization
        </h4>
        <span
          className={`${sizes.textSize} font-medium ${isOverBudget ? 'text-red-600' : percentage > 80 ? 'text-yellow-600' : 'text-green-600'} flex items-center gap-1`}
        >
          {isOverBudget ? (
            <AlertCircle className="w-3 h-3" />
          ) : (
            <TrendingUp className="w-3 h-3" />
          )}
          {percentage.toFixed(1)}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-4 overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isOverBudget
              ? 'bg-gradient-to-r from-red-500 to-orange-500'
              : percentage > 80
              ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
              : 'bg-gradient-to-r from-blue-500 to-green-500'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className={`${sizes.textSize} text-gray-500 dark:text-gray-400`}>Spent</span>
          <p className={`${sizes.textSize} font-semibold text-gray-900 dark:text-white`}>
            {formatCurrency(budgetSpent)}
          </p>
        </div>
        <div className="text-right">
          <span className={`${sizes.textSize} text-gray-500 dark:text-gray-400`}>Remaining</span>
          <p
            className={`${sizes.textSize} font-semibold ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}
          >
            {formatCurrency(remaining)}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * CashFlowIndicator Component
 */
function CashFlowIndicator({
  cashFlow,
  trend,
  size,
}: {
  cashFlow: number;
  trend: CashFlowTrend;
  size: FinancialOverviewSize;
}) {
  const sizes = sizeClasses[size];

  const trendConfig: Record<CashFlowTrend, {
    label: string;
    color: string;
    bg: string;
    icon: React.ReactNode;
  }> = {
    positive: {
      label: 'Positive',
      color: 'text-green-600',
      bg: 'bg-green-100 dark:bg-green-900/30',
      icon: <TrendingUp className="w-4 h-4" />,
    },
    negative: {
      label: 'Negative',
      color: 'text-red-600',
      bg: 'bg-red-100 dark:bg-red-900/30',
      icon: <TrendingDown className="w-4 h-4" />,
    },
    stable: {
      label: 'Stable',
      color: 'text-gray-600',
      bg: 'bg-gray-100 dark:bg-gray-700',
      icon: <PieChart className="w-4 h-4" />,
    },
  };

  const config = trendConfig[trend];

  return (
    <div className={`${sizes.padding} ${config.bg} rounded-lg`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`${sizes.labelSize} text-gray-600 dark:text-gray-400`}>Cash Flow</span>
        <span className={`${sizes.textSize} font-medium ${config.color} flex items-center gap-1`}>
          {config.icon}
          {config.label}
        </span>
      </div>
      <div className={`${sizes.valueSize} font-bold ${cashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {cashFlow >= 0 ? '+' : ''}
        {formatCurrency(cashFlow)}
      </div>
      <p className={`${sizes.textSize} text-gray-500 dark:text-gray-400 mt-1`}>
        This month
      </p>
    </div>
  );
}

/**
 * InvoiceItem Component
 */
function InvoiceItem({
  invoice,
  size,
  onClick,
}: {
  invoice: Invoice;
  size: FinancialOverviewSize;
  onClick?: () => void;
}) {
  const sizes = sizeClasses[size];
  const config = invoiceStatusConfig[invoice.status];

  const getDueDateStatus = (dueDate: string): { label: string; color: string } => {
    const due = new Date(dueDate);
    const now = new Date();
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, color: 'text-red-600' };
    if (diffDays === 0) return { label: 'Due today', color: 'text-orange-600' };
    if (diffDays <= 7) return { label: `${diffDays}d left`, color: 'text-yellow-600' };
    return { label: due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), color: 'text-gray-500' };
  };

  const dueDateStatus = getDueDateStatus(invoice.dueDate);

  return (
    <div
      className={`${sizes.itemPadding} rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors flex items-center gap-3`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className={`p-2 rounded-lg ${config.bg}`}>
        <FileText className={`w-4 h-4 ${config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`${sizes.textSize} font-medium text-gray-900 dark:text-white truncate`}>
          {invoice.number}
        </p>
        <p className={`${sizes.labelSize} text-gray-500 dark:text-gray-400`}>
          {invoice.client}
        </p>
      </div>
      <div className="text-right">
        <p className={`${sizes.textSize} font-semibold text-gray-900 dark:text-white`}>
          {formatCurrency(invoice.amount)}
        </p>
        <div className="flex items-center gap-1 justify-end">
          <Calendar className={`w-3 h-3 ${dueDateStatus.color}`} />
          <span className={`${sizes.labelSize} ${dueDateStatus.color}`}>{dueDateStatus.label}</span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400" />
    </div>
  );
}

/**
 * FinancialOverviewWidget Component
 */
export function FinancialOverviewWidget({
  projectId: _projectId,
  onInvoiceClick,
  size = 'medium',
  showRevenueChart = true,
  showBudgetUtilization = true,
  showInvoices = true,
  isLoading = false,
  onRefresh,
  className = '',
}: FinancialOverviewWidgetProps) {
  const sizes = sizeClasses[size];

  // Mock data - replace with actual API call
  const [financials] = useState<FinancialData>({
    revenue: 2450000,
    expenses: 1890000,
    profit: 560000,
    revenueGrowth: 12.5,
    expensesGrowth: 8.2,
    outstandingInvoices: 18,
    overdueInvoices: 4,
    cashFlow: 125000,
    cashFlowTrend: 'positive',
    budgetUtilization: 77,
    budgetTotal: 3000000,
    budgetSpent: 2310000,
    recentInvoices: [
      {
        id: '1',
        number: 'INV-2024-042',
        client: 'Acme Construction',
        amount: 45000,
        status: 'overdue',
        dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
        project: 'Block A Development',
      },
      {
        id: '2',
        number: 'INV-2024-043',
        client: 'BuildRight Ltd',
        amount: 78000,
        status: 'sent',
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString(),
        project: 'North Wing',
      },
      {
        id: '3',
        number: 'INV-2024-041',
        client: 'Premier Properties',
        amount: 32000,
        status: 'paid',
        dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        project: 'Main Site',
      },
      {
        id: '4',
        number: 'INV-2024-044',
        client: 'City Developments',
        amount: 125000,
        status: 'disputed',
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
        project: 'Tower Block',
      },
    ],
  });

  if (isLoading) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 ${className}`}
      >
        <div className={`${sizes.padding} space-y-3 animate-pulse`}>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
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
      <div className={`${sizes.padding} border-b border-gray-100 dark:border-gray-700 flex items-center justify-between`}>
        <h3 className={`${sizes.textSize} font-semibold text-gray-900 dark:text-white flex items-center gap-2`}>
          <DollarSign className="w-5 h-5 text-green-600" />
          Financial Overview
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

      {/* Content */}
      <div className={`${sizes.padding} space-y-6`}>
        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Revenue"
            value={formatCurrency(financials.revenue)}
            trend={{ value: financials.revenueGrowth, isPositive: true }}
            color="green"
            size={size}
          />
          <MetricCard
            icon={<TrendingDown className="w-4 h-4" />}
            label="Expenses"
            value={formatCurrency(financials.expenses)}
            trend={{ value: financials.expensesGrowth, isPositive: false }}
            color="red"
            size={size}
          />
          <MetricCard
            icon={<CreditCard className="w-4 h-4" />}
            label="Outstanding"
            value={financials.outstandingInvoices}
            subtext={`${financials.overdueInvoices} overdue`}
            color="yellow"
            size={size}
          />
          <MetricCard
            icon={<PieChart className="w-4 h-4" />}
            label="Budget Used"
            value={`${financials.budgetUtilization}%`}
            subtext={formatCurrency(financials.budgetSpent)}
            color="blue"
            size={size}
          />
        </div>

        {/* Charts and Indicators */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {showRevenueChart && (
            <RevenueVsExpenses
              revenue={financials.revenue}
              expenses={financials.expenses}
              size={size}
            />
          )}
          {showBudgetUtilization && (
            <BudgetUtilization
              budgetTotal={financials.budgetTotal}
              budgetSpent={financials.budgetSpent}
              size={size}
            />
          )}
        </div>

        {/* Cash Flow */}
        <CashFlowIndicator
          cashFlow={financials.cashFlow}
          trend={financials.cashFlowTrend}
          size={size}
        />

        {/* Recent Invoices */}
        {showInvoices && financials.recentInvoices.length > 0 && (
          <div>
            <h4 className={`${sizes.labelSize} font-semibold text-gray-700 dark:text-gray-300 mb-3`}>
              Recent Invoices
            </h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {financials.recentInvoices.slice(0, 5).map((invoice) => (
                <InvoiceItem
                  key={invoice.id}
                  invoice={invoice}
                  size={size}
                  onClick={() => onInvoiceClick?.(invoice)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FinancialOverviewWidget;
