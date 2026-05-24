import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/Input";
import { useTheme } from "@/hooks/useTheme";
import { useProjectStore } from "@/stores/projectStore";

interface DocumentItem {
  id: string;
  name: string;
  type: "pdf" | "dwg" | "doc" | "xls" | "image" | "other";
  projectId?: string;
  size: string;
  uploadedBy: string;
  uploadedAt: string;
  url?: string;
}

const typeIcons: Record<string, string> = {
  pdf: "document-text-outline",
  dwg: "images-outline",
  doc: "document-outline",
  xls: "grid-outline",
  image: "image-outline",
  other: "folder-outline",
};

const typeColors: Record<string, string> = {
  pdf: "#ef4444",
  dwg: "#3b82f6",
  doc: "#6366f1",
  xls: "#22c55e",
  image: "#f59e0b",
  other: "#94a3b8",
};

export default function DocumentsScreen() {
  const { colors } = useTheme();
  const { projects } = useProjectStore();

  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [documents] = useState<DocumentItem[]>([
    {
      id: "d1",
      name: "Site Plan - Rev A.pdf",
      type: "pdf",
      projectId: "p1",
      size: "2.4 MB",
      uploadedBy: "John Smith",
      uploadedAt: "2026-05-10",
    },
    {
      id: "d2",
      name: "Structural Drawings.dwg",
      type: "dwg",
      projectId: "p1",
      size: "8.1 MB",
      uploadedBy: "Sarah Lee",
      uploadedAt: "2026-05-08",
    },
    {
      id: "d3",
      name: "Contract Agreement.docx",
      type: "doc",
      projectId: "p2",
      size: "1.2 MB",
      uploadedBy: "Adrian Stanca",
      uploadedAt: "2026-05-05",
    },
    {
      id: "d4",
      name: "Budget Estimate.xlsx",
      type: "xls",
      projectId: "p2",
      size: "456 KB",
      uploadedBy: "Mike Johnson",
      uploadedAt: "2026-05-01",
    },
    {
      id: "d5",
      name: "Site Photos - Week 20.jpg",
      type: "image",
      projectId: "p1",
      size: "3.2 MB",
      uploadedBy: "John Smith",
      uploadedAt: "2026-04-28",
    },
  ]);

  function onRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }

  const filtered = documents.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  function getProjectName(projectId?: string) {
    if (!projectId) return "General";
    return projects.find((p) => p.id === projectId)?.name ?? "Unknown";
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center justify-between mb-3">
          <ThemedText variant="h1">Documents</ThemedText>
          <TouchableOpacity
            onPress={() => {}}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.primary }}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <Input
          placeholder="Search documents..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon="folder-open"
            title="No Documents"
            subtitle="Upload project documents, drawings, and files"
          />
        ) : (
          filtered.map((doc) => (
            <TouchableOpacity key={doc.id} className="mb-3">
              <Card>
                <View className="flex-row items-start">
                  <View
                    className="w-12 h-12 rounded-xl items-center justify-center mr-3"
                    style={{
                      backgroundColor: typeColors[doc.type] + "20",
                    }}
                  >
                    {/* @ts-ignore */}
                    <Ionicons
                      name={typeIcons[doc.type] as any}
                      size={24}
                      color={typeColors[doc.type]}
                    />
                  </View>
                  <View className="flex-1">
                    <ThemedText variant="body" className="font-semibold">
                      {doc.name}
                    </ThemedText>
                    <View className="flex-row items-center mt-1">
                      <Badge
                        label={doc.type.toUpperCase()}
                        variant="default"
                        className="mr-2"
                      />
                      <ThemedText variant="caption" color="secondary">
                        {doc.size}
                      </ThemedText>
                    </View>
                    <ThemedText variant="caption" color="secondary" className="mt-1">
                      {getProjectName(doc.projectId)} · {doc.uploadedBy} · {doc.uploadedAt}
                    </ThemedText>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.textSecondary}
                  />
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}
