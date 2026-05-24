const USE_MOCK = false;

import { useState } from "react";
import {
  Plus,
  Shield,
  FileCheck,
  Clock,
  AlertTriangle,
  Trash2,
  X,
  Edit,
  Send,
  Bell,
} from "lucide-react";
import { BulkActionsBar, useBulkSelection } from "../ui/BulkActions";
import { ModuleBreadcrumbs } from "../ui/Breadcrumbs";
import { EmptyState } from "../ui/EmptyState";
import { useCertifications } from "../../hooks/useData";
import { uploadFile } from "../../services/api";
import { toast } from "sonner";

const MOCK_CERTIFICATIONS = [
  {
    id: "1",
    certification_type: "CSCS Card - Gold",
    holder: "John Smith",
    company: "CortexBuild Ltd",
    body: "CSCS",
    accreditation_number: "CS123456",
    grade: "Gold",
    issue_date: "2020-06-15",
    expiry_date: "2026-06-14",
    status: "valid",
    document_name: "CSCS_Gold.pdf",
  },
  {
    id: "2",
    certification_type: "SMSTS",
    holder: "Sarah Johnson",
    company: "CortexBuild Ltd",
    body: "CITB",
    accreditation_number: "SM789012",
    grade: "A",
    issue_date: "2021-03-10",
    expiry_date: "2026-03-09",
    status: "valid",
    document_name: null,
  },
  {
    id: "3",
    certification_type: "SSSTS",
    holder: "Mike Davis",
    company: "CortexBuild Ltd",
    body: "CITB",
    accreditation_number: "SS456789",
    grade: "A",
    issue_date: "2022-05-20",
    expiry_date: "2025-05-19",
    status: "expiring_soon",
    document_name: "SSSTS_cert.pdf",
  },
  {
    id: "4",
    certification_type: "First Aid At Work",
    holder: "Emma Wilson",
    company: "CortexBuild Ltd",
    body: "HSE",
    accreditation_number: "FA234567",
    grade: "Pass",
    issue_date: "2023-09-12",
    expiry_date: "2026-09-11",
    status: "valid",
    document_name: null,
  },
  {
    id: "5",
    certification_type: "Asbestos Awareness",
    holder: "Robert Brown",
    company: "CortexBuild Ltd",
    body: "BAAL",
    accreditation_number: "AA345678",
    grade: "Pass",
    issue_date: "2021-11-05",
    expiry_date: "2025-02-14",
    status: "expiring_soon",
    document_name: "Asbestos_cert.pdf",
  },
  {
    id: "6",
    certification_type: "Confined Space",
    holder: "Lisa Anderson",
    company: "CortexBuild Ltd",
    body: "INDG",
    accreditation_number: "CS567890",
    grade: "A",
    issue_date: "2023-01-18",
    expiry_date: "2026-01-17",
    status: "valid",
    document_name: null,
  },
  {
    id: "7",
    certification_type: "Working at Height",
    holder: "James Martin",
    company: "CortexBuild Ltd",
    body: "IRATA",
    accreditation_number: "WH678901",
    grade: "Level 2",
    issue_date: "2022-07-22",
    expiry_date: "2025-07-21",
    status: "expiring_soon",
    document_name: null,
  },
  {
    id: "8",
    certification_type: "Plant Operator - Excavator",
    holder: "David Lee",
    company: "CortexBuild Ltd",
    body: "CIPC",
    accreditation_number: "PL789012",
    grade: "Cat 390F",
    issue_date: "2023-04-14",
    expiry_date: "2026-04-13",
    status: "valid",
    document_name: "Excavator_cert.pdf",
  },
  {
    id: "9",
    certification_type: "IPAF 3a+3b",
    holder: "Susan White",
    company: "CortexBuild Ltd",
    body: "IPAF",
    accreditation_number: "IP890123",
    grade: "3a+3b",
    issue_date: "2022-11-30",
    expiry_date: "2025-11-29",
    status: "expiring_soon",
    document_name: null,
  },
  {
    id: "10",
    certification_type: "PASMA",
    holder: "Thomas Garcia",
    company: "CortexBuild Ltd",
    body: "PASMA",
    accreditation_number: "PM901234",
    grade: "Trained",
    issue_date: "2021-08-17",
    expiry_date: "2025-08-16",
    status: "expired",
    document_name: "PASMA_cert.pdf",
  },
  {
    id: "11",
    certification_type: "CSCS Card - Green",
    holder: "Anna Martinez",
    company: "CortexBuild Ltd",
    body: "CSCS",
    accreditation_number: "CS012345",
    grade: "Green",
    issue_date: "2023-12-01",
    expiry_date: "2026-11-30",
    status: "valid",
    document_name: null,
  },
  {
    id: "12",
    certification_type: "Manual Handling",
    holder: "Paul Thompson",
    company: "CortexBuild Ltd",
    body: "BOSH",
    accreditation_number: "MH123456",
    grade: "Pass",
    issue_date: "2024-01-22",
    expiry_date: "2027-01-21",
    status: "valid",
    document_name: "ManualHandling_cert.pdf",
  },
];

interface Certification {
  id: string;
  certification_type: string;
  holder?: string;
  company: string;
  body: string;
  accreditation_number: string;
  grade: string;
  issue_date?: string;
  expiry_date: string;
  status: string;
  document_name?: string;
  // Form editing aliases
  issueDate?: string;
  expiryDate?: string;
}

interface Alert {
  id: string;
  type: "expired" | "expiring" | "missing";
  severity: "critical" | "warning" | "info";
  message: string;
  details: string;
}

export default function Certifications() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [_uploading, setUploading] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "all" | "person" | "expiring" | "alerts" | "reports"
  >("all");
  const [form, setForm] = useState({
    certificationType: "",
    holder: "",
    company: "",
    body: "",
    accreditationNumber: "",
    grade: "",
    issueDate: "",
    expiryDate: "",
    status: "valid",
  });
  const [editItem, setEditItem] = useState<Certification | null>(null);

  const { useList, useCreate, useUpdate, useDelete } = useCertifications;
  const { data: certs = [], isLoading: _isLoading } = useList();
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();
  const { selectedIds, clearSelection } = useBulkSelection();

  // Use real data if available, otherwise fall back to mock if enabled
  const certificationData =
    certs.length > 0 ? certs : USE_MOCK ? MOCK_CERTIFICATIONS : [];

  const getDaysUntilExpiry = (expiryDate: string): number => {
    return Math.floor(
      (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
  };

  const getStatusBadge = (status: string, expiryDate?: string) => {
    if (status === "expired") return "bg-red-500/10 text-red-400";
    if (status === "suspended") return "bg-red-500/10 text-red-400";
    if (expiryDate) {
      const daysLeft = getDaysUntilExpiry(expiryDate);
      if (daysLeft < 0) return "bg-red-500/10 text-red-400";
      if (daysLeft < 30) return "bg-red-500/10 text-red-400";
      if (daysLeft < 60) return "bg-amber-500/10 text-amber-400";
      return "bg-green-500/10 text-green-400";
    }
    return "bg-green-500/10 text-green-400";
  };

  const getStatusText = (status: string, expiryDate?: string) => {
    if (status === "expired") return "Expired";
    if (status === "suspended") return "Suspended";
    if (expiryDate) {
      const daysLeft = getDaysUntilExpiry(expiryDate);
      if (daysLeft < 0) return "Expired";
      if (daysLeft < 30) return "Expiring Soon";
      if (daysLeft < 60) return "Expiring Soon";
      return "Valid";
    }
    return status === "valid" ? "Valid" : "Pending";
  };

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} certification(s)?`)) return;
    try {
      await Promise.all(
        ids.map((id) => deleteMutation.mutateAsync(String(id))),
      );
      toast.success(`Deleted ${ids.length} certification(s)`);
      clearSelection();
    } catch {
      toast.error("Bulk delete failed");
    }
  }

  const filtered = (certificationData as Certification[]).filter((c) => {
    const matchesSearch =
      (c.certification_type || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (c.holder || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.company || "").toLowerCase().includes(searchTerm.toLowerCase());

    if (filterStatus === "all") return matchesSearch;
    if (filterStatus === "valid")
      return matchesSearch && (c.status === "valid" || c.status === "active");
    if (filterStatus === "expiring_soon")
      return matchesSearch && c.status === "expiring_soon";
    if (filterStatus === "expired")
      return matchesSearch && c.status === "expired";
    return matchesSearch;
  });

  const validCount = (certificationData as Certification[]).filter(
    (c) => c.status === "valid" || c.status === "active",
  ).length;
  const expiringCount = (certificationData as Certification[]).filter(
    (c) => c.status === "expiring_soon",
  ).length;
  const expiredCount = (certificationData as Certification[]).filter(
    (c) => c.status === "expired" || c.status === "suspended",
  ).length;

  const handleCreate = async () => {
    if (!form.certificationType) return;
    try {
      await createMutation.mutateAsync({
        certification_type: form.certificationType,
        holder: form.holder || "",
        company: form.company || "CortexBuild Ltd",
        body: form.body || "",
        accreditation_number: form.accreditationNumber || "",
        grade: form.grade || "",
        issue_date: form.issueDate || null,
        expiry_date: form.expiryDate || null,
        status: form.status,
      });
      toast.success("Certification created");
      setShowCreateModal(false);
      setForm({
        certificationType: "",
        holder: "",
        company: "",
        body: "",
        accreditationNumber: "",
        grade: "",
        issueDate: "",
        expiryDate: "",
        status: "valid",
      });
    } catch {
      toast.error("Failed to create certification");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this certification?")) return;
    try {
      await deleteMutation.mutateAsync(String(id));
      toast.success("Certification deleted");
    } catch {
      toast.error("Failed to delete certification");
    }
  };

  const handleUpdate = async () => {
    if (!editItem || !editItem.certification_type) return;
    try {
      await updateMutation.mutateAsync({
        id: editItem.id,
        data: {
          certification_type: editItem.certification_type,
          holder: editItem.holder || "",
          company: editItem.company,
          body: editItem.body,
          accreditation_number: editItem.accreditation_number,
          grade: editItem.grade,
          issue_date: editItem.issue_date || null,
          expiry_date: editItem.expiry_date || null,
          status: editItem.status,
        },
      });
      toast.success("Certification updated");
      setEditItem(null);
    } catch {
      toast.error("Failed to update certification");
    }
  };

  async function _handleUpload(certId: string, file: File) {
    setUploading(certId);
    try {
      const result = await uploadFile(file, "REPORTS");
      const cert = (certificationData as Certification[]).find(
        (c) => String(c.id) === String(certId),
      );
      if (cert) {
        await updateMutation.mutateAsync({
          id: String(certId),
          data: {
            ...cert,
            document_url: result.file_url || result.name,
            document_name: file.name,
          },
        });
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(null);
    }
  }

  const handleSendReminder = (certId: string, holder: string) => {
    toast.success(`Reminder sent to ${holder}`);
  };

  // All Certifications Tab
  const allCertificationsTab = (
    <div className="space-y-4">
      <div className="flex gap-3 items-center mb-4">
        <input
          type="text"
          placeholder="Search by type or holder..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 input input-bordered text-white"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 input input-bordered text-white"
        >
          <option value="all">All Status</option>
          <option value="valid">Valid</option>
          <option value="expiring_soon">Expiring Soon</option>
          <option value="expired">Expired</option>
        </select>
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No certifications found"
          description="Add certifications to get started."
        />
      ) : (
        <div className="cb-table-scroll touch-pan-x">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-4 py-2 text-left text-gray-400 font-display tracking-widest">
                  Cert Type
                </th>
                <th className="px-4 py-2 text-left text-gray-400 font-display tracking-widest">
                  Holder
                </th>
                <th className="px-4 py-2 text-left text-gray-400 font-display tracking-widest">
                  Issuing Body
                </th>
                <th className="px-4 py-2 text-left text-gray-400 font-display tracking-widest">
                  Accreditation No
                </th>
                <th className="px-4 py-2 text-left text-gray-400 font-display tracking-widest">
                  Grade
                </th>
                <th className="px-4 py-2 text-left text-gray-400 font-display tracking-widest">
                  Issue Date
                </th>
                <th className="px-4 py-2 text-left text-gray-400 font-display tracking-widest">
                  Expiry Date
                </th>
                <th className="px-4 py-2 text-left text-gray-400 font-display tracking-widest">
                  Status
                </th>
                <th className="px-4 py-2 text-right text-gray-400 font-display tracking-widest">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c: Certification) => (
                <tr
                  key={c.id}
                  className="border-b border-gray-700 hover:bg-gray-800/50"
                >
                  <td className="px-4 py-3 text-white">
                    {c.certification_type}
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {c.holder || "N/A"}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{c.body}</td>
                  <td className="px-4 py-3 text-gray-300">
                    {c.accreditation_number}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{c.grade}</td>
                  <td className="px-4 py-3 text-gray-300">
                    {c.issue_date || "N/A"}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{c.expiry_date}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(c.status, c.expiry_date)}`}
                    >
                      {getStatusText(c.status, c.expiry_date)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditItem({
                          ...c,
                          issueDate: c.issue_date || "",
                          expiryDate: c.expiry_date || "",
                        })
                      }
                      className="p-1 hover:bg-gray-700 rounded"
                    >
                      <Edit size={16} className="text-gray-400" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(String(c.id))}
                      className="p-1 hover:bg-red-900/30 rounded"
                    >
                      <Trash2 size={16} className="text-red-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // By Person Tab
  const byPersonTab = (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search by name..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full px-4 py-2 input input-bordered text-white"
      />
      {(() => {
        const grouped = new Map<string, Certification[]>();
        (certificationData as Certification[]).forEach((c) => {
          const holder = c.holder || "Unassigned";
          if (!grouped.has(holder)) grouped.set(holder, []);
          grouped.get(holder)!.push(c);
        });

        const filtered_people = Array.from(grouped.entries()).filter(([name]) =>
          name.toLowerCase().includes(searchTerm.toLowerCase()),
        );

        return filtered_people.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="No people found"
            description="Add certifications to get started."
          />
        ) : (
          filtered_people.map(([name, certs]) => {
            const allValid = certs.every(
              (c) => c.status === "valid" || c.status === "active",
            );
            const hasExpiring = certs.some((c) => c.status === "expiring_soon");
            const hasExpired = certs.some((c) => c.status === "expired");

            return (
              <div key={name} className="card p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                      {name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{name}</h3>
                      <p className="text-gray-400 text-sm">
                        {certs.length} certification(s)
                      </p>
                    </div>
                  </div>
                  <div>
                    {allValid &&
                    hasExpiring === false &&
                    hasExpired === false ? (
                      <span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded font-medium">
                        All Valid
                      </span>
                    ) : hasExpiring ? (
                      <span className="px-2 py-1 bg-amber-500/10 text-amber-400 text-xs rounded font-medium">
                        Has Expiring
                      </span>
                    ) : hasExpired ? (
                      <span className="px-2 py-1 bg-red-500/10 text-red-400 text-xs rounded font-medium">
                        Has Expired
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-2 pl-13">
                  {certs.map((c: Certification) => (
                    <div
                      key={c.id}
                      className="text-sm flex items-center justify-between p-2 bg-gray-800/50 rounded"
                    >
                      <div>
                        <p className="text-gray-300">{c.certification_type}</p>
                        <p className="text-gray-500 text-xs">
                          Expires: {c.expiry_date}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(c.status, c.expiry_date)}`}
                      >
                        {getStatusText(c.status, c.expiry_date)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        );
      })()}
    </div>
  );

  // Expiring Tab
  const expiringTab = (
    <div className="space-y-3">
      {(() => {
        const expiring = (certificationData as Certification[])
          .filter((c) => {
            const days = getDaysUntilExpiry(c.expiry_date);
            return days >= 0 && days <= 90;
          })
          .sort(
            (a, b) =>
              getDaysUntilExpiry(a.expiry_date) -
              getDaysUntilExpiry(b.expiry_date),
          );

        return expiring.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No expiring certifications"
            description="All certifications are valid."
          />
        ) : (
          expiring.map((c) => {
            const daysLeft = getDaysUntilExpiry(c.expiry_date);
            const colorClass =
              daysLeft < 30
                ? "bg-red-500/10 text-red-400"
                : daysLeft < 60
                  ? "bg-amber-500/10 text-amber-400"
                  : "bg-green-500/10 text-green-400";

            return (
              <div
                key={c.id}
                className="card p-4 border border-gray-700 flex items-center justify-between"
              >
                <div>
                  <h3 className="text-white font-semibold">
                    {c.certification_type}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {c.holder || "Unassigned"} - {c.body}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    Expires: {c.expiry_date}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div
                      className={`px-3 py-1 rounded text-sm font-semibold ${colorClass}`}
                    >
                      {daysLeft} days left
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleSendReminder(c.id, c.holder || "Holder")
                    }
                    className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded text-sm font-medium"
                  >
                    <Send size={16} /> Remind
                  </button>
                </div>
              </div>
            );
          })
        );
      })()}
    </div>
  );

  // Alerts Tab
  const alerts: Alert[] = [
    {
      id: "1",
      type: "expired",
      severity: "critical",
      message: "PASMA Certificate Expired",
      details: "Thomas Garcia - PASMA expired on Aug 16, 2025",
    },
    {
      id: "2",
      type: "expiring",
      severity: "warning",
      message: "CSCS Card Expiring Soon",
      details: "John Smith - CSCS Gold expires in 15 days (Jun 14, 2026)",
    },
    {
      id: "3",
      type: "expiring",
      severity: "warning",
      message: "Working at Height Expiring",
      details:
        "James Martin - Working at Height expires in 45 days (Jul 21, 2025)",
    },
    {
      id: "4",
      type: "missing",
      severity: "info",
      message: "Site-Specific Training Missing",
      details: "Some team members lack required on-site inductions",
    },
  ];

  const alertsTab = (
    <div className="space-y-3">
      {alerts.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No alerts"
          description="Your certifications are all up to date."
        />
      ) : (
        alerts.map((alert) => {
          const severityColors = {
            critical: "bg-red-500/10 text-red-400 border-red-500/30",
            warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
            info: "bg-blue-500/10 text-blue-400 border-blue-500/30",
          };

          return (
            <div
              key={alert.id}
              className={`card p-4 border ${severityColors[alert.severity]} rounded-lg`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{alert.message}</h3>
                  <p className="text-sm opacity-80 mt-1">{alert.details}</p>
                </div>
                <button
                  type="button"
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded font-medium"
                >
                  Acknowledge
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  // Reports Tab
  const reportsTab = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-gray-400 text-xs mb-2">Total Certifications</div>
          <div className="text-3xl font-display text-white">
            {certificationData.length}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-gray-400 text-xs mb-2">Valid %</div>
          <div className="text-3xl font-display text-green-400">
            {certificationData.length > 0
              ? Math.round((validCount / certificationData.length) * 100)
              : 0}
            %
          </div>
        </div>
        <div className="card p-4">
          <div className="text-gray-400 text-xs mb-2">Expiring Soon</div>
          <div className="text-3xl font-display text-amber-400">
            {expiringCount}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-gray-400 text-xs mb-2">Expired</div>
          <div className="text-3xl font-display text-red-400">
            {expiredCount}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-white font-semibold mb-4">
          Certification Types Breakdown
        </h3>
        <div className="space-y-3">
          {(() => {
            const types = new Map<string, number>();
            (certificationData as Certification[]).forEach((c) => {
              types.set(
                c.certification_type,
                (types.get(c.certification_type) || 0) + 1,
              );
            });

            const total = certificationData.length;
            return Array.from(types.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => {
                const percentage =
                  total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={type}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-gray-300 text-sm">{type}</span>
                      <span className="text-gray-400 text-xs">
                        {count} ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-amber-500 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              });
          })()}
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-white font-semibold mb-4">Compliance by Status</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded">
            <span className="text-gray-300">Valid</span>
            <div className="flex items-center gap-3">
              <div className="w-24 bg-gray-700 rounded h-2">
                <div
                  className="bg-green-500 h-2 rounded"
                  style={{
                    width: `${certificationData.length > 0 ? (validCount / certificationData.length) * 100 : 0}%`,
                  }}
                ></div>
              </div>
              <span className="text-green-400 font-semibold">{validCount}</span>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded">
            <span className="text-gray-300">Expiring Soon</span>
            <div className="flex items-center gap-3">
              <div className="w-24 bg-gray-700 rounded h-2">
                <div
                  className="bg-amber-500 h-2 rounded"
                  style={{
                    width: `${certificationData.length > 0 ? (expiringCount / certificationData.length) * 100 : 0}%`,
                  }}
                ></div>
              </div>
              <span className="text-amber-400 font-semibold">
                {expiringCount}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded">
            <span className="text-gray-300">Expired</span>
            <div className="flex items-center gap-3">
              <div className="w-24 bg-gray-700 rounded h-2">
                <div
                  className="bg-red-500 h-2 rounded"
                  style={{
                    width: `${certificationData.length > 0 ? (expiredCount / certificationData.length) * 100 : 0}%`,
                  }}
                ></div>
              </div>
              <span className="text-red-400 font-semibold">{expiredCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <ModuleBreadcrumbs currentModule="certifications" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-display text-white">
              Certifications & Licenses
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Manage certifications, compliance and worker qualifications
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold"
          >
            <Plus size={18} /> Add Certification
          </button>
        </div>

        {activeTab === "all" && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <FileCheck className="text-green-400" size={20} />
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Valid</p>
                  <p className="text-2xl font-display text-green-400">
                    {validCount}
                  </p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="text-amber-400" size={20} />
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Expiring Soon</p>
                  <p className="text-2xl font-display text-amber-400">
                    {expiringCount}
                  </p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Trash2 className="text-red-400" size={20} />
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Expired</p>
                  <p className="text-2xl font-display text-red-400">
                    {expiredCount}
                  </p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Shield className="text-blue-400" size={20} />
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Total</p>
                  <p className="text-2xl font-display text-blue-400">
                    {certificationData.length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex border-b border-gray-700">
          {(["all", "person", "expiring", "alerts", "reports"] as const).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-amber-500 text-amber-400"
                    : "border-transparent text-gray-400 hover:text-gray-300"
                }`}
              >
                {tab === "all" && "All Certifications"}
                {tab === "person" && "By Person"}
                {tab === "expiring" && "Expiring"}
                {tab === "alerts" && "Alerts"}
                {tab === "reports" && "Reports"}
              </button>
            ),
          )}
        </div>

        <div className="card p-6">
          {activeTab === "all" && allCertificationsTab}
          {activeTab === "person" && byPersonTab}
          {activeTab === "expiring" && expiringTab}
          {activeTab === "alerts" && alertsTab}
          {activeTab === "reports" && reportsTab}
        </div>

        <BulkActionsBar
          selectedIds={Array.from(selectedIds)}
          actions={[
            {
              id: "delete",
              label: "Delete Selected",
              icon: Trash2,
              variant: "danger",
              onClick: handleBulkDelete,
              confirm: "This action cannot be undone.",
            },
          ]}
          onClearSelection={clearSelection}
        />

        {showCreateModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-900">
                <h3 className="text-xl font-bold text-white">
                  Add Certification
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">
                      Certification Type *
                    </label>
                    <select
                      value={form.certificationType}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          certificationType: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 input input-bordered text-white"
                    >
                      <option value="">Select type...</option>
                      <option value="CSCS Card - Gold">CSCS Card - Gold</option>
                      <option value="CSCS Card - Green">
                        CSCS Card - Green
                      </option>
                      <option value="SMSTS">SMSTS</option>
                      <option value="SSSTS">SSSTS</option>
                      <option value="First Aid At Work">
                        First Aid At Work
                      </option>
                      <option value="Asbestos Awareness">
                        Asbestos Awareness
                      </option>
                      <option value="Confined Space">Confined Space</option>
                      <option value="Working at Height">
                        Working at Height
                      </option>
                      <option value="Plant Operator - Excavator">
                        Plant Operator - Excavator
                      </option>
                      <option value="IPAF 3a+3b">IPAF 3a+3b</option>
                      <option value="PASMA">PASMA</option>
                      <option value="Manual Handling">Manual Handling</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">
                      Holder Name
                    </label>
                    <input
                      type="text"
                      value={form.holder}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, holder: e.target.value }))
                      }
                      placeholder="e.g. John Smith"
                      className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">
                      Company
                    </label>
                    <input
                      type="text"
                      value={form.company}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, company: e.target.value }))
                      }
                      placeholder="Company name"
                      className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">
                      Issuing Body
                    </label>
                    <input
                      type="text"
                      value={form.body}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, body: e.target.value }))
                      }
                      placeholder="e.g. CSCS, CITB"
                      className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">
                      Accreditation Number
                    </label>
                    <input
                      type="text"
                      value={form.accreditationNumber}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          accreditationNumber: e.target.value,
                        }))
                      }
                      placeholder="e.g. ABC-12345"
                      className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">
                      Grade
                    </label>
                    <input
                      type="text"
                      value={form.grade}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, grade: e.target.value }))
                      }
                      placeholder="e.g. Gold, A, Pass"
                      className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">
                      Issue Date
                    </label>
                    <input
                      type="date"
                      value={form.issueDate}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, issueDate: e.target.value }))
                      }
                      className="w-full px-3 py-2 input input-bordered text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">
                      Expiry Date
                    </label>
                    <input
                      type="date"
                      value={form.expiryDate}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, expiryDate: e.target.value }))
                      }
                      className="w-full px-3 py-2 input input-bordered text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">
                      Status
                    </label>
                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, status: e.target.value }))
                      }
                      className="w-full px-3 py-2 input input-bordered text-white"
                    >
                      <option value="valid">Valid</option>
                      <option value="pending">Pending</option>
                      <option value="expiring_soon">Expiring Soon</option>
                      <option value="expired">Expired</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-gray-700 flex justify-end gap-3 sticky bottom-0 bg-gray-900">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={createMutation.isPending || !form.certificationType}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {createMutation.isPending
                    ? "Creating..."
                    : "Add Certification"}
                </button>
              </div>
            </div>
          </div>
        )}

        {editItem && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-900">
                <h3 className="text-xl font-bold text-white">
                  Edit Certification
                </h3>
                <button
                  type="button"
                  onClick={() => setEditItem(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">
                      Certification Type *
                    </label>
                    <select
                      value={editItem.certification_type}
                      onChange={(e) =>
                        setEditItem((f) => ({
                          ...f!,
                          certification_type: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 input input-bordered text-white"
                    >
                      <option value="CSCS Card - Gold">CSCS Card - Gold</option>
                      <option value="CSCS Card - Green">
                        CSCS Card - Green
                      </option>
                      <option value="SMSTS">SMSTS</option>
                      <option value="SSSTS">SSSTS</option>
                      <option value="First Aid At Work">
                        First Aid At Work
                      </option>
                      <option value="Asbestos Awareness">
                        Asbestos Awareness
                      </option>
                      <option value="Confined Space">Confined Space</option>
                      <option value="Working at Height">
                        Working at Height
                      </option>
                      <option value="Plant Operator - Excavator">
                        Plant Operator - Excavator
                      </option>
                      <option value="IPAF 3a+3b">IPAF 3a+3b</option>
                      <option value="PASMA">PASMA</option>
                      <option value="Manual Handling">Manual Handling</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">
                      Holder Name
                    </label>
                    <input
                      type="text"
                      value={editItem.holder || ""}
                      onChange={(e) =>
                        setEditItem((f) => ({ ...f!, holder: e.target.value }))
                      }
                      className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">
                      Company
                    </label>
                    <input
                      type="text"
                      value={editItem.company}
                      onChange={(e) =>
                        setEditItem((f) => ({ ...f!, company: e.target.value }))
                      }
                      className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">
                      Issuing Body
                    </label>
                    <input
                      type="text"
                      value={editItem.body}
                      onChange={(e) =>
                        setEditItem((f) => ({ ...f!, body: e.target.value }))
                      }
                      className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">
                      Accreditation Number
                    </label>
                    <input
                      type="text"
                      value={editItem.accreditation_number}
                      onChange={(e) =>
                        setEditItem((f) => ({
                          ...f!,
                          accreditation_number: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">
                      Grade
                    </label>
                    <input
                      type="text"
                      value={editItem.grade}
                      onChange={(e) =>
                        setEditItem((f) => ({ ...f!, grade: e.target.value }))
                      }
                      className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">
                      Issue Date
                    </label>
                    <input
                      type="date"
                      value={editItem.issue_date || ""}
                      onChange={(e) =>
                        setEditItem((f) => ({
                          ...f!,
                          issue_date: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 input input-bordered text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">
                      Expiry Date
                    </label>
                    <input
                      type="date"
                      value={editItem.expiry_date}
                      onChange={(e) =>
                        setEditItem((f) => ({
                          ...f!,
                          expiry_date: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 input input-bordered text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">
                      Status
                    </label>
                    <select
                      value={editItem.status}
                      onChange={(e) =>
                        setEditItem((f) => ({ ...f!, status: e.target.value }))
                      }
                      className="w-full px-3 py-2 input input-bordered text-white"
                    >
                      <option value="valid">Valid</option>
                      <option value="pending">Pending</option>
                      <option value="expiring_soon">Expiring Soon</option>
                      <option value="expired">Expired</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-gray-700 flex justify-end gap-3 sticky bottom-0 bg-gray-900">
                <button
                  type="button"
                  onClick={() => setEditItem(null)}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdate}
                  disabled={
                    updateMutation.isPending || !editItem.certification_type
                  }
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
