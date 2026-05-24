import { useState } from "react";
import {
  Plus,
  Leaf,
  Cloud,
  Factory,
  Gauge,
  Trash2,
  X,
  Download,
  FileText,
  TrendingDown,
} from "lucide-react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ModuleBreadcrumbs } from "../ui/Breadcrumbs";
import { BulkActionsBar, useBulkSelection } from "../ui/BulkActions";
import { uploadFile } from "../../services/api";
import { toast } from "sonner";
import { useSustainability } from "../../hooks/useData";
import type { SustainabilityRow } from "../../types/domain";

// Mock data for charts
const monthlyEmissionsData = [
  { month: "Jan", scope1: 450, scope2: 320, scope3: 650 },
  { month: "Feb", scope1: 480, scope2: 340, scope3: 700 },
  { month: "Mar", scope1: 520, scope2: 380, scope3: 780 },
  { month: "Apr", scope1: 490, scope2: 360, scope3: 720 },
  { month: "May", scope1: 450, scope2: 330, scope3: 680 },
  { month: "Jun", scope1: 410, scope2: 300, scope3: 620 },
];

const energySourceData = [
  { source: "Grid", value: 4200 },
  { source: "Solar", value: 1800 },
  { source: "Diesel Gen", value: 900 },
];

const wasteData = [
  { name: "Diverted", value: 72 },
  { name: "Landfill", value: 28 },
];

const wasteStreamData = [
  { type: "Concrete", percent: 32, tonnes: 45 },
  { type: "Timber", percent: 28, tonnes: 39 },
  { type: "Metal", percent: 18, tonnes: 25 },
  { type: "Soil/Rock", percent: 14, tonnes: 20 },
  { type: "Other", percent: 8, tonnes: 11 },
];

const materialsData = [
  {
    id: 1,
    material: "Steel Reinforcement",
    supplier: "UK Steel Ltd",
    certified: "FSC",
    carbonPerUnit: 2.1,
    totalCarbon: 105,
    localSourcing: 85,
  },
  {
    id: 2,
    material: "Timber Framing",
    supplier: "Forestry Solutions",
    certified: "Recycled",
    carbonPerUnit: 1.2,
    totalCarbon: 48,
    localSourcing: 78,
  },
  {
    id: 3,
    material: "Concrete Mix",
    supplier: "ECO Concrete",
    certified: "Yes",
    carbonPerUnit: 0.35,
    totalCarbon: 87.5,
    localSourcing: 90,
  },
  {
    id: 4,
    material: "Insulation (Recycled)",
    supplier: "Green Build Materials",
    certified: "Yes",
    carbonPerUnit: 0.8,
    totalCarbon: 32,
    localSourcing: 65,
  },
  {
    id: 5,
    material: "Sustainable Paint",
    supplier: "EcoCoat UK",
    certified: "FSC",
    carbonPerUnit: 0.15,
    totalCarbon: 7.5,
    localSourcing: 95,
  },
];

const breemCreditsData = [
  { section: "Energy", required: 19, achieved: 16 },
  { section: "Water", required: 7, achieved: 6 },
  { section: "Materials", required: 12, achieved: 10 },
  { section: "Waste", required: 8, achieved: 7 },
  { section: "Ecology", required: 10, achieved: 9 },
  { section: "Health & Wellbeing", required: 15, achieved: 13 },
];

const _COLORS = ["#10b981", "#f97316", "#3b82f6", "#8b5cf6", "#ec4899"];
const _SCOPE_COLORS = {
  scope1: "#ef4444",
  scope2: "#f59e0b",
  scope3: "#06b6d4",
};

export default function Sustainability() {
  const { data: metrics = [], isLoading } = useSustainability.useList();
  const createMutation = useSustainability.useCreate();
  const updateMutation = useSustainability.useUpdate();
  const deleteMutation = useSustainability.useDelete();

  const [activeTab, setActiveTab] = useState("carbon");
  const [_searchTerm, _setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [_uploading, setUploading] = useState<string | null>(null);
  const [form, setForm] = useState({
    metricType: "",
    project: "",
    period: "",
    actual: "",
    target: "",
    unit: "kgCO2",
  });
  const [editItem, setEditItem] = useState<
    (Partial<SustainabilityRow> & { id?: string }) | null
  >(null);

  const { selectedIds, clearSelection } = useBulkSelection();

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} metric(s)?`)) return;
    try {
      await Promise.all(ids.map((id) => deleteMutation.mutateAsync(id)));
      clearSelection();
      toast.success(`Deleted ${ids.length} metric(s)`);
    } catch {
      toast.error("Bulk delete failed");
    }
  }

  const _filtered = metrics.filter(
    (m: SustainabilityRow) =>
      (m.metric_type || "").toLowerCase().includes(_searchTerm.toLowerCase()) ||
      (m.project || "").toLowerCase().includes(_searchTerm.toLowerCase()),
  );

  const _totalCarbon = metrics
    .filter((m: SustainabilityRow) =>
      m.metric_type?.toLowerCase().includes("carbon"),
    )
    .reduce(
      (acc: number, m: SustainabilityRow) => acc + Number(m.actual || 0),
      0,
    );
  const totalEnergy = metrics
    .filter((m: SustainabilityRow) =>
      m.metric_type?.toLowerCase().includes("energy"),
    )
    .reduce(
      (acc: number, m: SustainabilityRow) => acc + Number(m.actual || 0),
      0,
    );

  const handleCreate = async () => {
    if (!form.metricType) return;
    try {
      await createMutation.mutateAsync({
        metric_type: form.metricType,
        project: form.project || "",
        period: form.period || "",
        actual: parseFloat(form.actual) || 0,
        target: parseFloat(form.target) || 0,
        unit: form.unit,
      });
      setShowCreateModal(false);
      setForm({
        metricType: "",
        project: "",
        period: "",
        actual: "",
        target: "",
        unit: "kgCO2",
      });
    } catch {
      toast.error("Failed to create metric");
    }
  };

  const handleUpdate = async () => {
    if (!editItem || !editItem.id) return;
    try {
      await updateMutation.mutateAsync({
        id: editItem.id,
        data: {
          metric_type: editItem.metric_type,
          project: editItem.project || "",
          period: editItem.period || "",
          actual: editItem.actual || 0,
          target: editItem.target || 0,
          unit: editItem.unit,
        },
      });
      setEditItem(null);
    } catch {
      toast.error("Failed to update metric");
    }
  };

  const _handleDelete = async (id: string) => {
    if (!confirm("Delete this metric?")) return;
    try {
      await deleteMutation.mutateAsync(id);
    } catch {
      toast.error("Failed to delete metric");
    }
  };

  async function _handleUploadDoc(id: string, file: File) {
    setUploading(id);
    try {
      await uploadFile(file, "REPORTS");
      toast.success(`Uploaded: ${file.name}`);
    } catch {
      console.error("Upload failed");
      toast.error("Upload failed");
    } finally {
      setUploading(null);
    }
  }

  return (
    <>
      <ModuleBreadcrumbs currentModule="sustainability" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-display text-white">
              Sustainability & ESG
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Track carbon emissions, energy and environmental metrics
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold"
          >
            <Plus size={18} /> Log Metrics
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Cloud className="text-red-400" size={20} />
              </div>
              <div>
                <p className="text-gray-400 text-xs">Carbon Footprint</p>
                <p className="text-2xl font-display text-red-400">
                  2,847 tCO2e
                </p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Factory className="text-amber-400" size={20} />
              </div>
              <div>
                <p className="text-gray-400 text-xs">Energy Used</p>
                <p className="text-2xl font-display text-amber-400">
                  {isLoading ? "..." : `${totalEnergy.toLocaleString()} kWh`}
                </p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Leaf className="text-green-400" size={20} />
              </div>
              <div>
                <p className="text-gray-400 text-xs">Renewable %</p>
                <p className="text-2xl font-display text-green-400">42%</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Gauge className="text-blue-400" size={20} />
              </div>
              <div>
                <p className="text-gray-400 text-xs">BREEAM Score</p>
                <p className="text-2xl font-display text-blue-400">68/90</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex border-b border-gray-700 mb-6 gap-2">
            <button
              onClick={() => setActiveTab("carbon")}
              className={`px-4 py-3 font-medium transition-colors ${activeTab === "carbon" ? "text-orange-400 border-b-2 border-orange-400" : "text-gray-400 hover:text-gray-300"}`}
            >
              Carbon Tracking
            </button>
            <button
              onClick={() => setActiveTab("energy")}
              className={`px-4 py-3 font-medium transition-colors ${activeTab === "energy" ? "text-orange-400 border-b-2 border-orange-400" : "text-gray-400 hover:text-gray-300"}`}
            >
              Energy
            </button>
            <button
              onClick={() => setActiveTab("waste")}
              className={`px-4 py-3 font-medium transition-colors ${activeTab === "waste" ? "text-orange-400 border-b-2 border-orange-400" : "text-gray-400 hover:text-gray-300"}`}
            >
              Waste
            </button>
            <button
              onClick={() => setActiveTab("materials")}
              className={`px-4 py-3 font-medium transition-colors ${activeTab === "materials" ? "text-orange-400 border-b-2 border-orange-400" : "text-gray-400 hover:text-gray-300"}`}
            >
              Materials
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className={`px-4 py-3 font-medium transition-colors ${activeTab === "reports" ? "text-orange-400 border-b-2 border-orange-400" : "text-gray-400 hover:text-gray-300"}`}
            >
              Reports
            </button>
          </div>

          {activeTab === "carbon" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-white font-display mb-4 flex items-center gap-2">
                    <Gauge size={18} className="text-orange-400" /> Project
                    Carbon Footprint
                  </h3>
                  <div className="space-y-4">
                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm">
                          Current: 2,847 tCO2e
                        </span>
                        <span className="text-orange-400 font-display">
                          94.9%
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-orange-500 to-orange-400 h-full"
                          style={{ width: "94.9%" }}
                        ></div>
                      </div>
                      <div className="text-gray-400 text-xs mt-2">
                        Target: 3,000 tCO2e
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-white font-display mb-4 flex items-center gap-2">
                    <TrendingDown size={18} className="text-green-400" /> Carbon
                    Reduction Actions
                  </h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-700/50 cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="rounded border-gray-600"
                      />
                      <div className="flex-1">
                        <p className="text-sm text-gray-300">
                          LED Lighting Retrofit
                        </p>
                        <p className="text-xs text-green-400">
                          +320 tCO2e saved
                        </p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-700/50 cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="rounded border-gray-600"
                      />
                      <div className="flex-1">
                        <p className="text-sm text-gray-300">
                          Solar Panels Install
                        </p>
                        <p className="text-xs text-green-400">
                          +480 tCO2e saved
                        </p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-700/50 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-gray-600"
                      />
                      <div className="flex-1">
                        <p className="text-sm text-gray-300">
                          EV Fleet Transition
                        </p>
                        <p className="text-xs text-amber-400">
                          Planned Q3 2026
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-white font-display mb-4">
                  Monthly Emissions by Scope
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={monthlyEmissionsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="month" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="scope1"
                      stackId="1"
                      stroke="#ef4444"
                      fill="#ef4444"
                      name="Scope 1 (Direct)"
                    />
                    <Area
                      type="monotone"
                      dataKey="scope2"
                      stackId="1"
                      stroke="#f59e0b"
                      fill="#f59e0b"
                      name="Scope 2 (Energy)"
                    />
                    <Area
                      type="monotone"
                      dataKey="scope3"
                      stackId="1"
                      stroke="#06b6d4"
                      fill="#06b6d4"
                      name="Scope 3 (Supply Chain)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-gradient-to-r from-blue-900/20 to-cyan-900/20 border border-blue-700/30 rounded-lg p-4">
                <h4 className="text-blue-300 font-display mb-2">
                  UK EPC/BREEAM Rating
                </h4>
                <div className="flex items-end gap-4">
                  <div>
                    <p className="text-gray-400 text-sm">EPC Rating</p>
                    <p className="text-3xl font-display text-blue-400">A</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">BREEAM Rating</p>
                    <p className="text-3xl font-display text-green-400">
                      Excellent
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">BREEAM Score</p>
                    <p className="text-3xl font-display text-amber-400">
                      75.6%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "energy" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-white font-display mb-4">
                    Energy Consumption by Source
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={energySourceData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="source" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1f2937",
                          border: "1px solid #374151",
                        }}
                      />
                      <Bar dataKey="value" fill="#f97316" name="kWh" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div>
                  <h3 className="text-white font-display mb-4">
                    Daily Usage Trend
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart
                      data={[
                        { day: "Mon", usage: 580 },
                        { day: "Tue", usage: 620 },
                        { day: "Wed", usage: 640 },
                        { day: "Thu", usage: 590 },
                        { day: "Fri", usage: 610 },
                        { day: "Sat", usage: 380 },
                        { day: "Sun", usage: 350 },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="day" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1f2937",
                          border: "1px solid #374151",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="usage"
                        stroke="#06b6d4"
                        fill="#06b6d4"
                        name="kWh"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-4">
                  <p className="text-emerald-300 text-sm mb-2">
                    Renewable Energy %
                  </p>
                  <p className="text-4xl font-display text-emerald-400">42%</p>
                  <p className="text-gray-400 text-xs mt-2">
                    3,892 kWh from solar
                  </p>
                </div>
                <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
                  <p className="text-blue-300 text-sm mb-2">Grid Energy Used</p>
                  <p className="text-4xl font-display text-blue-400">
                    4,200 kWh
                  </p>
                  <p className="text-gray-400 text-xs mt-2">
                    58% of total consumption
                  </p>
                </div>
                <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-4">
                  <p className="text-amber-300 text-sm mb-2">Generator Usage</p>
                  <p className="text-4xl font-display text-amber-400">
                    900 kWh
                  </p>
                  <p className="text-gray-400 text-xs mt-2">
                    Emergency backup only
                  </p>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="text-white font-display mb-3">
                  Energy Efficiency Tips
                </h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>
                    • Schedule HVAC maintenance monthly to maintain 95%+
                    efficiency
                  </li>
                  <li>
                    • Install occupancy sensors in low-traffic areas to reduce
                    lighting load by 20%
                  </li>
                  <li>
                    • Expand solar array to 10kW capacity for additional 40%
                    renewable coverage
                  </li>
                  <li>
                    • Conduct thermal imaging audit to identify insulation gaps
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === "waste" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-white font-display mb-4">
                    Waste Diverted vs Landfill
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={wasteData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={120}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#ef4444" />
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1f2937",
                          border: "1px solid #374151",
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div>
                  <h3 className="text-white font-display mb-4">
                    Top 5 Waste Streams (Tonnes)
                  </h3>
                  <div className="space-y-3">
                    {wasteStreamData.map((stream, idx) => (
                      <div key={idx}>
                        <div className="flex justify-between mb-1">
                          <span className="text-gray-300 text-sm">
                            {stream.type}
                          </span>
                          <span className="text-gray-400 text-xs">
                            {stream.tonnes}t ({stream.percent}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full"
                            style={{ width: `${stream.percent}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-4">
                <h4 className="text-emerald-300 font-display mb-2">
                  Recycling Rate Target
                </h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-5xl font-display text-emerald-400">
                      72%
                    </p>
                    <p className="text-gray-400 text-sm mt-1">
                      Current recycling rate
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-display text-amber-400">90%</p>
                    <p className="text-gray-400 text-sm mt-1">
                      Target by Q4 2026
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "materials" && (
            <div className="space-y-4">
              <h3 className="text-white font-display">
                Sustainable Materials Tracker
              </h3>
              <div className="cb-table-scroll touch-pan-x">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">
                        Material
                      </th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">
                        Supplier
                      </th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">
                        Certified
                      </th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">
                        Carbon/Unit
                      </th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">
                        Total Carbon
                      </th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">
                        Local %
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialsData.map((mat) => (
                      <tr
                        key={mat.id}
                        className="border-b border-gray-700/50 hover:bg-gray-800/30"
                      >
                        <td className="py-3 px-4 text-white font-medium">
                          {mat.material}
                        </td>
                        <td className="py-3 px-4 text-gray-300">
                          {mat.supplier}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400">
                            {mat.certified}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-gray-300">
                          {mat.carbonPerUnit} kg
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-amber-400">
                          {mat.totalCarbon} kg
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-gray-700 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-blue-400 h-full"
                                style={{ width: `${mat.localSourcing}%` }}
                              ></div>
                            </div>
                            <span className="text-gray-300 text-xs font-medium">
                              {mat.localSourcing}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "reports" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-white font-display mb-4">
                    BREEAM/LEED Credit Tracker
                  </h3>
                  <div className="space-y-3">
                    {breemCreditsData.map((credit, idx) => (
                      <div
                        key={idx}
                        className="border border-gray-700 rounded-lg p-3"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-300 font-medium">
                            {credit.section}
                          </span>
                          <span className="text-orange-400 font-display">
                            {credit.achieved}/{credit.required}
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-orange-500 to-orange-400 h-full"
                            style={{
                              width: `${(credit.achieved / credit.required) * 100}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-white font-display mb-4">
                    Sustainability KPIs
                  </h3>
                  <div className="space-y-3">
                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <p className="text-gray-400 text-sm mb-1">
                        Carbon Intensity
                      </p>
                      <p className="text-2xl font-display text-red-400">
                        42.8 kg CO2/m²
                      </p>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <p className="text-gray-400 text-sm mb-1">
                        Embodied Carbon (Materials)
                      </p>
                      <p className="text-2xl font-display text-amber-400">
                        312 tCO2e
                      </p>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <p className="text-gray-400 text-sm mb-1">
                        Energy Use Intensity
                      </p>
                      <p className="text-2xl font-display text-blue-400">
                        85.6 kWh/m² p.a.
                      </p>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <p className="text-gray-400 text-sm mb-1">
                        Water Consumption
                      </p>
                      <p className="text-2xl font-display text-cyan-400">
                        4,280 m³/year
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold">
                  <FileText size={18} /> Generate ESG Report
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold">
                  <Download size={18} /> Export PDF
                </button>
              </div>
            </div>
          )}
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
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg">
              <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                <h3 className="text-xl font-display text-white">
                  Log Sustainability Metric
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
                <div>
                  <label
                    htmlFor="sustType"
                    className="block text-gray-400 text-xs mb-1"
                  >
                    Metric Type *
                  </label>
                  <select
                    id="sustType"
                    value={form.metricType}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, metricType: e.target.value }))
                    }
                    className="w-full px-3 py-2 input input-bordered text-white"
                  >
                    <option value="">Select type...</option>
                    <option value="Carbon Emissions">Carbon Emissions</option>
                    <option value="Energy Consumption">
                      Energy Consumption
                    </option>
                    <option value="Water Usage">Water Usage</option>
                    <option value="Waste Recycled">Waste Recycled</option>
                    <option value="Renewable Energy">Renewable Energy</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="sustProject"
                    className="block text-gray-400 text-xs mb-1"
                  >
                    Project
                  </label>
                  <input
                    id="sustProject"
                    type="text"
                    value={form.project}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, project: e.target.value }))
                    }
                    placeholder="Project name"
                    className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="sustPeriod"
                      className="block text-gray-400 text-xs mb-1"
                    >
                      Period
                    </label>
                    <input
                      id="sustPeriod"
                      type="text"
                      value={form.period}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, period: e.target.value }))
                      }
                      placeholder="e.g. Q1 2026"
                      className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sustUnit"
                      className="block text-gray-400 text-xs mb-1"
                    >
                      Unit
                    </label>
                    <select
                      id="sustUnit"
                      value={form.unit}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, unit: e.target.value }))
                      }
                      className="w-full px-3 py-2 input input-bordered text-white"
                    >
                      <option value="kgCO2">kgCO2</option>
                      <option value="kWh">kWh</option>
                      <option value="m3">m3</option>
                      <option value="tonnes">tonnes</option>
                      <option value="%">%</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="sustActual"
                      className="block text-gray-400 text-xs mb-1"
                    >
                      Actual Value
                    </label>
                    <input
                      id="sustActual"
                      type="number"
                      value={form.actual}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, actual: e.target.value }))
                      }
                      placeholder="0"
                      className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sustTarget"
                      className="block text-gray-400 text-xs mb-1"
                    >
                      Target
                    </label>
                    <input
                      id="sustTarget"
                      type="number"
                      value={form.target}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, target: e.target.value }))
                      }
                      placeholder="0"
                      className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                    />
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
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
                  disabled={createMutation.isPending || !form.metricType}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {createMutation.isPending ? "Creating..." : "Log Metric"}
                </button>
              </div>
            </div>
          </div>
        )}

        {editItem && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg">
              <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                <h3 className="text-xl font-display text-white">
                  Edit Sustainability Metric
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
                <div>
                  <label
                    htmlFor="editSustType"
                    className="block text-gray-400 text-xs mb-1"
                  >
                    Metric Type *
                  </label>
                  <select
                    id="editSustType"
                    value={editItem.metric_type || ""}
                    onChange={(e) =>
                      setEditItem((prev) => ({
                        id: prev?.id,
                        ...prev,
                        metric_type: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 input input-bordered text-white"
                  >
                    <option value="">Select type...</option>
                    <option value="Carbon Emissions">Carbon Emissions</option>
                    <option value="Energy Consumption">
                      Energy Consumption
                    </option>
                    <option value="Water Usage">Water Usage</option>
                    <option value="Waste Recycled">Waste Recycled</option>
                    <option value="Renewable Energy">Renewable Energy</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="editSustProject"
                    className="block text-gray-400 text-xs mb-1"
                  >
                    Project
                  </label>
                  <input
                    id="editSustProject"
                    type="text"
                    value={editItem.project || ""}
                    onChange={(e) =>
                      setEditItem((prev) => ({
                        id: prev?.id,
                        ...prev,
                        project: e.target.value,
                      }))
                    }
                    placeholder="Project name"
                    className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="editSustPeriod"
                      className="block text-gray-400 text-xs mb-1"
                    >
                      Period
                    </label>
                    <input
                      id="editSustPeriod"
                      type="text"
                      value={editItem.period || ""}
                      onChange={(e) =>
                        setEditItem((prev) => ({
                          id: prev?.id,
                          ...prev,
                          period: e.target.value,
                        }))
                      }
                      placeholder="e.g. Q1 2026"
                      className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="editSustUnit"
                      className="block text-gray-400 text-xs mb-1"
                    >
                      Unit
                    </label>
                    <select
                      id="editSustUnit"
                      value={editItem.unit || "kgCO2"}
                      onChange={(e) =>
                        setEditItem((prev) => ({
                          id: prev?.id,
                          ...prev,
                          unit: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 input input-bordered text-white"
                    >
                      <option value="kgCO2">kgCO2</option>
                      <option value="kWh">kWh</option>
                      <option value="m3">m3</option>
                      <option value="tonnes">tonnes</option>
                      <option value="%">%</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="editSustActual"
                      className="block text-gray-400 text-xs mb-1"
                    >
                      Actual Value
                    </label>
                    <input
                      id="editSustActual"
                      type="number"
                      value={editItem.actual || ""}
                      onChange={(e) =>
                        setEditItem((prev) => ({
                          id: prev?.id,
                          ...prev,
                          actual: parseFloat(e.target.value) || 0,
                        }))
                      }
                      placeholder="0"
                      className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="editSustTarget"
                      className="block text-gray-400 text-xs mb-1"
                    >
                      Target
                    </label>
                    <input
                      id="editSustTarget"
                      type="number"
                      value={editItem.target || ""}
                      onChange={(e) =>
                        setEditItem((prev) => ({
                          id: prev?.id,
                          ...prev,
                          target: parseFloat(e.target.value) || 0,
                        }))
                      }
                      placeholder="0"
                      className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                    />
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
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
                  disabled={updateMutation.isPending || !editItem.metric_type}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50"
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
