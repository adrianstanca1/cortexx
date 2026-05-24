/**
 * CortexBuild Ultimate — Universal Data Hooks
 * Uses React Query for caching, background refresh, and optimistic updates.
 */
import { useEffect, useCallback, useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  keepPreviousData,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  projectsApi,
  invoicesApi,
  teamApi,
  safetyApi,
  rfisApi,
  changeOrdersApi,
  ramsApi,
  cisApi,
  equipmentApi,
  subcontractorsApi,
  timesheetsApi,
  documentsApi,
  tendersApi,
  dailyReportsApi,
  meetingsApi,
  materialsApi,
  punchListApi,
  inspectionsApi,
  contactsApi,
  riskRegisterApi,
  purchaseOrdersApi,
  projectImagesApi,
  projectTasksApi,
  variationsApi,
  defectsApi,
  specificationsApi,
  tempWorksApi,
  signageApi,
  wasteManagementApi,
  sustainabilityApi,
  trainingApi,
  certificationsApi,
  prequalificationApi,
  lettingsApi,
  measuringApi,
  valuationsApi,
  sitePermitsApi,
  safetyPermitsApi,
  siteInspectionsApi,
  permitRenewalsApi,
  permitInspectionsApi,
  reportTemplatesApi,
  submittalsApi,
  maintenanceSchedulesApi,
  projectTemplatesApi,
  auditApi,
  tasksApi,
  suppliersApi,
  ReportTemplate,
  type Row,
} from "../services/api";
import type {
  SignRow,
  MeasurementRow,
  ValuationRow,
  LettingPackageRow,
  CertificationRow,
  PrequalificationRow,
  SustainabilityRow,
  WasteManagementRow,
  TrainingRow,
  SpecificationRow,
} from "../types/domain";
import { eventBus } from "../lib/eventBus";

// ─── Query Key Factory ─────────────────────────────────────────────────────────

export const queryKeys = {
  // Base keys for all resources
  all: () => ["cortexbuild"] as const,
  // Generic resource keys
  resource: (resource: string) => [...queryKeys.all(), resource] as const,
  list: (resource: string, filters?: Record<string, unknown>) =>
    [...queryKeys.resource(resource), "list", filters ?? {}] as const,
  detail: (resource: string, id: string) =>
    [...queryKeys.resource(resource), "detail", id] as const,
  infinite: (resource: string) =>
    [...queryKeys.resource(resource), "infinite"] as const,
  // Specific resource keys
  projects: {
    all: () => [...queryKeys.all(), "projects"] as const,
    lists: () => [...queryKeys.projects.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.projects.lists(), filters ?? {}] as const,
    details: () => [...queryKeys.projects.all(), "detail"] as const,
    detail: (id: string) => [...queryKeys.projects.details(), id] as const,
  },
  invoices: {
    all: () => [...queryKeys.all(), "invoices"] as const,
    lists: () => [...queryKeys.invoices.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.invoices.lists(), filters ?? {}] as const,
    details: () => [...queryKeys.invoices.all(), "detail"] as const,
    detail: (id: string) => [...queryKeys.invoices.details(), id] as const,
  },
  // Add other resources as needed
} as const;

// ─── Pagination Hook ──────────────────────────────────────────────────────────

export interface PaginationState {
  page: number;
  pageSize: number;
  total?: number;
}

export function usePaginatedQuery<T>({
  queryKey,
  queryFn,
  pageSize = 20,
  staleTime = 60_000,
}: {
  queryKey: readonly unknown[];
  queryFn: (
    page: number,
    pageSize: number,
  ) => Promise<{ data: T[]; total: number }>;
  pageSize?: number;
  staleTime?: number;
}) {
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize,
    total: undefined,
  });

  const query = useQuery({
    queryKey: [...queryKey, pagination.page, pagination.pageSize],
    queryFn: () => queryFn(pagination.page, pagination.pageSize),
    staleTime,
    placeholderData: keepPreviousData,
  });

  const totalPages = pagination.total
    ? Math.ceil(pagination.total / pagination.pageSize)
    : undefined;

  const goToPage = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page: Math.max(1, page) }));
  }, []);

  const nextPage = useCallback(() => {
    if (totalPages && pagination.page < totalPages) {
      setPagination((prev) => ({ ...prev, page: prev.page + 1 }));
    }
  }, [pagination.page, totalPages]);

  const prevPage = useCallback(() => {
    if (pagination.page > 1) {
      setPagination((prev) => ({ ...prev, page: prev.page - 1 }));
    }
  }, [pagination.page]);

  // Update total when data changes — only track total to avoid infinite loops
  useEffect(() => {
    if (query.data?.total !== undefined) {
      setPagination((prev) => ({ ...prev, total: query.data!.total }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- total-only refresh is intentional
  }, [query.data?.total]);

  return {
    data: query.data?.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isPreviousData: query.isFetching && pagination.page > 1,
    pagination: { ...pagination, totalPages },
    goToPage,
    nextPage,
    prevPage,
  };
}

// ─── Infinite Query Hook ─────────────────────────────────────────────────────

export function useInfiniteData<T>({
  queryKey,
  queryFn,
  staleTime = 60_000,
}: {
  queryKey: readonly unknown[];
  queryFn: (page: number) => Promise<{ data: T[]; hasMore: boolean }>;
  staleTime?: number;
}) {
  return useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam = 1 }) => {
      const result = await queryFn(pageParam);
      return {
        ...result,
        pageParam,
      };
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.pageParam as number) + 1 : undefined,
    getPreviousPageParam: (firstPage) =>
      firstPage.pageParam > 1 ? (firstPage.pageParam as number) - 1 : undefined,
    staleTime,
    initialPageParam: 1,
  });
}

// ─── Prefetch Hook ────────────────────────────────────────────────────────────

export function usePrefetch() {
  const qc = useQueryClient();

  const prefetch = useCallback(
    <T>(
      queryKey: readonly unknown[],
      queryFn: () => Promise<T>,
      staleTime = 60_000,
    ) => {
      qc.prefetchQuery({
        queryKey,
        queryFn,
        staleTime,
      });
    },
    [qc],
  );

  const prefetchIfEmpty = useCallback(
    <T>(
      queryKey: readonly unknown[],
      queryFn: () => Promise<T>,
      staleTime = 60_000,
    ) => {
      const cached = qc.getQueryData<T>(queryKey);
      if (!cached) {
        qc.prefetchQuery({ queryKey, queryFn, staleTime });
      }
    },
    [qc],
  );

  return { prefetch, prefetchIfEmpty };
}

// ─── Optimistic Update Hook ───────────────────────────────────────────────────

export function useOptimisticUpdate<T extends Row>({
  queryKey,
  updateFn,
  rollbackFn,
}: {
  queryKey: readonly unknown[];
  updateFn: (data: T) => T;
  rollbackFn?: (previousData: T[], data: T) => T[];
}) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: T) => {
      // Optimistically update
      qc.setQueryData<T[]>(queryKey, (old) =>
        old
          ? old.map((item) => (item.id === data.id ? updateFn(item) : item))
          : old,
      );
      return data;
    },
    onError: (_err, data, _context) => {
      // Rollback on error
      if (rollbackFn) {
        qc.setQueryData<T[]>(queryKey, (old) =>
          old ? rollbackFn(old, data) : old,
        );
      } else {
        qc.invalidateQueries({ queryKey });
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey });
    },
  });
}

// ─── Generic hook factory ─────────────────────────────────────────────────────

function makeHooks<T extends Row = Row>(
  key: string,
  tableName: string,
  api: {
    getAll: () => Promise<Row[]>;
    create: (data: Row) => Promise<Row | null>;
    update: (id: string, data: Row) => Promise<Row | null>;
    delete: (id: string) => Promise<void>;
  },
) {
  function useList() {
    const qc = useQueryClient();
    useEffect(() => {
      const unsub = eventBus.on("ws:message", ({ type }) => {
        if (
          type === "notification" ||
          type === "dashboard_update" ||
          type === "alert"
        ) {
          qc.invalidateQueries({ queryKey: [key] });
        }
      });
      return unsub;
    }, [qc]);
    return useQuery<T[]>({
      queryKey: [key],
      queryFn: () => api.getAll() as Promise<T[]>,
      staleTime: 60_000, // Increased from 30s to 60s for better caching
      gcTime: 5 * 60_000, // Keep unused data in cache for 5 minutes
      retry: 2, // Retry failed requests up to 2 times
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
    });
  }

  function useCreate() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (data: Row) => api.create(data),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: [key] });
        toast.success("Record created successfully");
      },
      onError: (e: Error) => toast.error(e.message),
    });
  }

  function useUpdate() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, data }: { id: string; data: Row }) =>
        api.update(id, data),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: [key] });
        toast.success("Record updated");
      },
      onError: (e: Error) => toast.error(e.message),
    });
  }

  function useDelete() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (id: string) => api.delete(id),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: [key] });
        toast.success("Record deleted");
      },
      onError: (e: Error) => toast.error(e.message),
    });
  }

  return { useList, useCreate, useUpdate, useDelete };
}

// ─── Exported hooks ───────────────────────────────────────────────────────────

export const useProjects = makeHooks("projects", "projects", projectsApi);
export const useInvoices = makeHooks("invoices", "invoices", invoicesApi);
export const useTeam = makeHooks("team", "team_members", teamApi);
export const useSafety = makeHooks("safety", "safety_incidents", safetyApi);
export const useRFIs = makeHooks("rfis", "rfis", rfisApi);
export const useChangeOrders = makeHooks(
  "change-orders",
  "change_orders",
  changeOrdersApi,
);
export const useRAMS = makeHooks("rams", "rams", ramsApi);
export const useCIS = makeHooks("cis", "cis_returns", cisApi);
export const useEquipment = makeHooks("equipment", "equipment", equipmentApi);
export const useSubcontractors = makeHooks(
  "subcontractors",
  "subcontractors",
  subcontractorsApi,
);
export const useTimesheets = makeHooks(
  "timesheets",
  "timesheets",
  timesheetsApi,
);
export const useDocuments = makeHooks("documents", "documents", documentsApi);
export const useTenders = makeHooks("tenders", "tenders", tendersApi);
export const useDailyReports = makeHooks(
  "daily-reports",
  "daily_reports",
  dailyReportsApi,
);
export const useMeetings = makeHooks("meetings", "meetings", meetingsApi);
export const useMaterials = makeHooks("materials", "materials", materialsApi);
export const usePunchList = makeHooks("punch-list", "punch_list", punchListApi);
export const useInspections = makeHooks(
  "inspections",
  "inspections",
  inspectionsApi,
);
export const useContacts = makeHooks("contacts", "contacts", contactsApi);
export const useRiskRegister = makeHooks(
  "risk-register",
  "risk_register",
  riskRegisterApi,
);
export const useProcurement = makeHooks(
  "purchase-orders",
  "purchase_orders",
  purchaseOrdersApi,
);
export const useProjectImages = makeHooks(
  "project-images",
  "project_images",
  projectImagesApi,
);
export const useProjectTasks = makeHooks(
  "project-tasks",
  "project_tasks",
  projectTasksApi,
);
export const useTasks = makeHooks("tasks", "tasks", tasksApi);
export const useVariations = makeHooks(
  "variations",
  "variations",
  variationsApi,
);
export const useDefects = makeHooks("defects", "defects", defectsApi);
export const useSpecifications = makeHooks<SpecificationRow>(
  "specifications",
  "specifications",
  specificationsApi,
);
export const useTempWorks = makeHooks("temp-works", "temp_works", tempWorksApi);
export const useSignage = makeHooks<SignRow>("signage", "signage", signageApi);
export const useWasteManagement = makeHooks<WasteManagementRow>(
  "waste-management",
  "waste_management",
  wasteManagementApi,
);
export const useSustainability = makeHooks<SustainabilityRow>(
  "sustainability",
  "sustainability",
  sustainabilityApi,
);
export const useTraining = makeHooks<TrainingRow>(
  "training",
  "training",
  trainingApi,
);
export const useCertifications = makeHooks<CertificationRow>(
  "certifications",
  "certifications",
  certificationsApi,
);
export const usePrequalification = makeHooks<PrequalificationRow>(
  "prequalification",
  "prequalification",
  prequalificationApi,
);
export const useLettings = makeHooks<LettingPackageRow>(
  "lettings",
  "lettings",
  lettingsApi,
);
export const useMeasuring = makeHooks<MeasurementRow>(
  "measuring",
  "measuring",
  measuringApi,
);
export const useValuations = makeHooks<ValuationRow>(
  "valuations",
  "valuations",
  valuationsApi,
);
export const useSiteInspections = makeHooks(
  "site-inspections",
  "site_inspections",
  siteInspectionsApi,
);
export const useSuppliers = makeHooks("suppliers", "suppliers", suppliersApi);

export const useSitePermits = makeHooks(
  "site-permits",
  "site-permits",
  sitePermitsApi,
);
export const useSafetyPermits = makeHooks(
  "safety-permits",
  "safety_permits",
  safetyPermitsApi,
);

export const usePermitRenewals = makeHooks(
  "permit-renewals",
  "permit_renewals",
  permitRenewalsApi,
);

export const usePermitInspections = makeHooks(
  "permit-inspections",
  "permit_inspections",
  permitInspectionsApi,
);
export const useReportTemplates = makeHooks<ReportTemplate>(
  "report-templates",
  "report_templates",
  {
    getAll: () => reportTemplatesApi.getAll(),
    create: (data: Row) =>
      reportTemplatesApi.create(
        data as Parameters<typeof reportTemplatesApi.create>[0],
      ) as Promise<ReportTemplate | null>,
    update: (id, data) =>
      reportTemplatesApi.update(
        id,
        data as Parameters<typeof reportTemplatesApi.update>[1],
      ) as Promise<ReportTemplate | null>,
    delete: (id) => reportTemplatesApi.delete(id),
  },
);

export const useSubmittals = makeHooks(
  "submittals",
  "submittals",
  submittalsApi,
);
export const useMaintenanceSchedules = makeHooks(
  "maintenance-schedules",
  "maintenance_schedules",
  maintenanceSchedulesApi,
);

export const useProjectTemplates = makeHooks(
  "project-templates",
  "project_templates",
  projectTemplatesApi,
);

export function useDuplicateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      reportTemplatesApi.duplicate(id) as Promise<unknown>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report-templates"] });
      toast.success("Record duplicated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Custom hooks for non-standard APIs ──────────────────────────────────────

/**
 * Returns audit log hooks. Must be called inside a component.
 * @example const { useList, useStats, useInvalidate } = useAuditLog();
 */
export function useAuditLog() {
  const qc = useQueryClient();
  function useList() {
    return useQuery<AuditEntry[]>({
      queryKey: ["audit"],
      queryFn: () => auditApi.getAll({ limit: 500 }) as Promise<AuditEntry[]>,
      staleTime: 30_000,
    });
  }
  function useStats() {
    return useQuery<AuditStats>({
      queryKey: ["audit-stats"],
      queryFn: () => auditApi.getStats() as unknown as Promise<AuditStats>,
      staleTime: 60_000,
    });
  }
  function useInvalidate() {
    return () => {
      qc.invalidateQueries({ queryKey: ["audit"] });
      qc.invalidateQueries({ queryKey: ["audit-stats"] });
    };
  }
  return { useList, useStats, useInvalidate };
}

interface AuditEntry extends Row {
  id: number;
  user_id: string;
  action: string;
  table_name: string;
  record_id: number;
  changes: string;
  created_at: string;
  user?: { name: string; avatar?: string };
  ip_address?: string;
}

interface AuditStats extends Row {
  total_entries: number;
  today_entries: number;
  week_entries: number;
  month_entries: number;
  active_users: number;
  security_alerts: number;
}
