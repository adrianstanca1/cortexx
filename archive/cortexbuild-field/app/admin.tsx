import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, Switch, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useCompany } from '@/lib/company-context';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ApiKeyEntry {
  id: string;
  provider: string;
  keyName: string;
  maskedKey: string;
  model: string;
  isActive: boolean;
  isDefault: boolean;
  totalCalls: number;
  lastUsed?: string;
}

interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  plan: 'free' | 'business' | 'pro' | 'enterprise';
}

// ─── AI Providers ─────────────────────────────────────────────────────────────
const AI_PROVIDERS = [
  { id: 'forge',     label: 'Forge (Built-in)',  icon: '⚡', models: ['default', 'fast', 'balanced', 'powerful'], free: true },
  { id: 'openai',    label: 'OpenAI',            icon: '🤖', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'], free: false },
  { id: 'anthropic', label: 'Anthropic Claude',  icon: '🧠', models: ['claude-3-5-sonnet', 'claude-3-opus', 'claude-3-haiku'], free: false },
  { id: 'google',    label: 'Google Gemini',     icon: '💎', models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'], free: false },
  { id: 'azure',     label: 'Azure OpenAI',      icon: '☁️', models: ['gpt-4o', 'gpt-4', 'gpt-35-turbo'], free: false },
  { id: 'ollama',    label: 'Ollama (Self-hosted)', icon: '🦙', models: ['llama3', 'mistral', 'codellama', 'phi3'], free: true },
];

const MOCK_FEATURE_FLAGS: FeatureFlag[] = [
  { key: 'ai_receipt_scanner',    label: 'AI Receipt Scanner',       description: 'Snap purchase invoices on site; AI extracts vendor, date, line items, VAT', enabled: true,  plan: 'business' },
  { key: 'cis_invoicing',         label: 'CIS Invoicing',            description: 'Full Construction Industry Scheme support with UTR and deduction calculations', enabled: true,  plan: 'pro' },
  { key: 'tender_import',         label: 'Tender / Price a Job',     description: 'Import pricing from CSV/XLSX with column mapping wizard', enabled: true,  plan: 'business' },
  { key: 'enquiry_pipelines',     label: 'Enquiry Pipelines',        description: 'Multiple named pipelines with custom stages for lead management', enabled: true,  plan: 'business' },
  { key: 'advanced_ai_agents',    label: 'Advanced AI Agents',       description: 'All 8 specialist AI agents: Safety, Cost, Contracts, Valuations, Defects, etc.', enabled: true,  plan: 'pro' },
  { key: 'gps_geofencing',        label: 'GPS Geofencing Check-in',  description: 'Verify workers are physically on-site before allowing check-in', enabled: true,  plan: 'business' },
  { key: 'push_notifications',    label: 'Push Notifications',       description: 'Real-time alerts for safety incidents, permit expirations, defect assignments', enabled: true,  plan: 'free' },
  { key: 'document_generator',    label: 'Document Generator',       description: 'AI-powered RAMS, Toolbox Talks, Invoices, Timesheets generation', enabled: true,  plan: 'business' },
  { key: 'file_vault',            label: 'File Vault',               description: 'Upload and manage photos, certificates, payslips, drawings', enabled: true,  plan: 'free' },
  { key: 'advanced_analytics',    label: 'Advanced Analytics',       description: 'Project cost tracking, productivity metrics, safety KPIs', enabled: false, plan: 'pro' },
  { key: 'multi_company',         label: 'Multi-Company Access',     description: 'Switch between multiple company accounts', enabled: true,  plan: 'pro' },
];

// ─── Add API Key Modal ────────────────────────────────────────────────────────
function AddKeyModal({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: (key: Partial<ApiKeyEntry> & { rawKey?: string }) => Promise<void> | void }) {
  const colors = useColors();
  const [provider, setProvider] = useState('openai');
  const [keyName, setKeyName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedProvider = AI_PROVIDERS.find(p => p.id === provider);

  const handleSave = async () => {
    if (!keyName.trim() || (!selectedProvider?.free && !apiKey.trim())) {
      Alert.alert('Missing fields', 'Please fill in all required fields.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        provider,
        keyName,
        rawKey: apiKey || undefined,
        maskedKey: apiKey ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : 'built-in',
        model: model || selectedProvider?.models[0] || 'default',
        isActive: true,
        isDefault: false,
      });
      setKeyName('');
      setApiKey('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add AI Provider</Text>
          <Pressable onPress={onClose}><Text style={{ color: '#1E3A5F', fontSize: 16 }}>Cancel</Text></Pressable>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
          {/* Provider Selection */}
          <View>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>AI Provider</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {AI_PROVIDERS.map(p => (
                <Pressable
                  key={p.id}
                  style={[styles.providerChip, provider === p.id && { borderColor: '#1E3A5F', backgroundColor: '#EFF6FF' }]}
                  onPress={() => { setProvider(p.id); setModel(p.models[0]); }}
                >
                  <Text style={styles.providerIcon}>{p.icon}</Text>
                  <Text style={[styles.providerLabel, provider === p.id && { color: '#1E3A5F', fontWeight: '700' }]}>{p.label}</Text>
                  {p.free && <View style={styles.freeBadge}><Text style={styles.freeBadgeText}>FREE</Text></View>}
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Key Name */}
          <View>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Key Name</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g. Production Key"
              placeholderTextColor={colors.muted}
              value={keyName}
              onChangeText={setKeyName}
            />
          </View>

          {/* API Key (if not free) */}
          {!selectedProvider?.free && (
            <View>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>API Key</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                placeholder={`Enter your ${selectedProvider?.label} API key`}
                placeholderTextColor={colors.muted}
                value={apiKey}
                onChangeText={setApiKey}
                secureTextEntry
                autoCapitalize="none"
              />
              <Text style={[styles.fieldHint, { color: colors.muted }]}>
                Your key is encrypted at rest and never exposed to clients.
              </Text>
            </View>
          )}

          {/* Model Selection */}
          <View>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Model</Text>
            {selectedProvider?.models.map(m => (
              <Pressable
                key={m}
                style={[styles.modelRow, { borderColor: colors.border }, model === m && { borderColor: '#1E3A5F', backgroundColor: '#EFF6FF' }]}
                onPress={() => setModel(m)}
              >
                <View style={[styles.modelRadio, model === m && { borderColor: '#1E3A5F' }]}>
                  {model === m && <View style={styles.modelRadioFill} />}
                </View>
                <Text style={[styles.modelLabel, { color: colors.foreground }, model === m && { color: '#1E3A5F', fontWeight: '600' }]}>{m}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save API Key</Text>}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main Admin Screen ────────────────────────────────────────────────────────
export default function AdminScreen() {
  const colors = useColors();
  const { currentCompany, can } = useCompany();
  const [companyForm, setCompanyForm] = useState({
    name: currentCompany?.name ?? '',
    companyNumber: currentCompany?.companyNumber ?? '',
    vatNumber: currentCompany?.vatNumber ?? '',
    phone: currentCompany?.phone ?? '',
    email: currentCompany?.email ?? '',
    utr: currentCompany?.utr ?? '',
    cisStatus: currentCompany?.cisStatus ?? 'registered_20',
    payrollEmail: currentCompany?.payrollEmail ?? '',
  });
  const updateSettingsMutation = trpc.settings.update.useMutation();

  useEffect(() => {
    setCompanyForm({
      name: currentCompany?.name ?? '',
      companyNumber: currentCompany?.companyNumber ?? '',
      vatNumber: currentCompany?.vatNumber ?? '',
      phone: currentCompany?.phone ?? '',
      email: currentCompany?.email ?? '',
      utr: currentCompany?.utr ?? '',
      cisStatus: currentCompany?.cisStatus ?? 'registered_20',
      payrollEmail: currentCompany?.payrollEmail ?? '',
    });
  }, [currentCompany]);

  const handleSaveCompanySettings = useCallback(async () => {
    try {
      await updateSettingsMutation.mutateAsync({
        companyId: currentCompany?.id ?? 1,
        name: companyForm.name.trim() || undefined,
        companyNumber: companyForm.companyNumber.trim() || undefined,
        vatNumber: companyForm.vatNumber.trim() || undefined,
        phone: companyForm.phone.trim() || undefined,
        email: companyForm.email.trim() || undefined,
        utr: companyForm.utr.trim() || undefined,
        cisStatus: companyForm.cisStatus,
        payrollEmail: companyForm.payrollEmail.trim() || undefined,
      });
      Alert.alert('Saved', 'Company settings updated successfully.');
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'Failed to save settings. Please try again.');
    }
  }, [companyForm, currentCompany?.id, updateSettingsMutation]);
  const [addKeyVisible, setAddKeyVisible] = useState(false);
  const [activeSection, setActiveSection] = useState<'ai' | 'features' | 'company' | 'users'>('ai');
  const apiKeysQuery = trpc.settings.listApiKeys.useQuery({ companyId: currentCompany?.id ?? 1 }, { retry: 1, staleTime: 30_000 });
  const featureFlagsQuery = trpc.settings.listFeatureFlags.useQuery({ companyId: currentCompany?.id ?? 1 }, { retry: 1, staleTime: 30_000 });

  const apiKeys = useMemo((): ApiKeyEntry[] => {
    if (!apiKeysQuery.data) return [];
    return apiKeysQuery.data.map(key => ({
      id: String(key.id),
      provider: key.provider,
      keyName: key.keyName,
      maskedKey: key.maskedKey,
      model: key.model ?? 'default',
      isActive: Boolean(key.isActive),
      isDefault: Boolean(key.isDefault),
      totalCalls: key.totalCalls ?? 0,
      lastUsed: key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString('en-GB') : undefined,
    }));
  }, [apiKeysQuery.data]);

  const featureFlags = useMemo((): FeatureFlag[] => {
    if (!featureFlagsQuery.data) return [];
    const enabledByKey = new Map(featureFlagsQuery.data.map(flag => [flag.feature, Boolean(flag.enabled)]));
    return MOCK_FEATURE_FLAGS.map(flag => ({
      ...flag,
      enabled: enabledByKey.get(flag.key) ?? flag.enabled,
    }));
  }, [featureFlagsQuery.data]);
  const saveApiKeyMutation = trpc.settings.saveApiKey.useMutation();
  const updateApiKeyMutation = trpc.settings.updateApiKey.useMutation();
  const deleteApiKeyMutation = trpc.settings.deleteApiKey.useMutation();
  const setFeatureFlagMutation = trpc.settings.setFeatureFlag.useMutation();
  const companyId = currentCompany?.id ?? 1;
  const projectsQuery = trpc.projects.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const teamsQuery = trpc.teams.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const updateProjectMutation = trpc.projects.update.useMutation();

  const showApiKeysSkeleton =
    apiKeys.length === 0 &&
    (apiKeysQuery.isPending || (apiKeysQuery.isFetching && apiKeysQuery.data === undefined));
  const showFeatureFlagsSkeleton =
    featureFlags.length === 0 &&
    (featureFlagsQuery.isPending || (featureFlagsQuery.isFetching && featureFlagsQuery.data === undefined));

  // Per-project GPS distance filter state
  const [projectFilters, setProjectFilters] = useState<Record<string, number>>({});
  const GPS_FILTER_OPTIONS = [5, 10, 25, 50, 100, 200];
  useEffect(() => {
    if (!projectsQuery.data) return;
    setProjectFilters(Object.fromEntries(projectsQuery.data.map(project => [
      String(project.id),
      project.geofenceRadius ?? 200,
    ])));
  }, [projectsQuery.data]);
  const setProjectFilter = useCallback(async (projectId: string, metres: number) => {
    let previousValue: number | undefined;
    setProjectFilters(prev => {
      previousValue = prev[projectId];
      return { ...prev, [projectId]: metres };
    });
    try {
      await updateProjectMutation.mutateAsync({ id: Number(projectId), companyId, geofenceRadius: metres });
      await projectsQuery.refetch();
    } catch (error: any) {
      setProjectFilters(prev => {
        const next = { ...prev };
        if (previousValue === undefined) {
          delete next[projectId];
        } else {
          next[projectId] = previousValue;
        }
        return next;
      });
      Alert.alert('GPS filter not saved', error?.message ?? 'Could not update this project.');
    }
  }, [companyId, projectsQuery, updateProjectMutation]);

  if (!can('company_admin')) {
    return (
      <ScreenContainer className="p-6 items-center justify-center">
        <IconSymbol name="lock.fill" size={48} color={colors.muted} />
        <Text style={[styles.noAccessTitle, { color: colors.foreground }]}>Admin Access Required</Text>
        <Text style={[styles.noAccessText, { color: colors.muted }]}>You need Company Admin or higher role to access this panel.</Text>
      </ScreenContainer>
    );
  }

  const setDefaultKey = async (id: string) => {
    try {
      await updateApiKeyMutation.mutateAsync({ id: Number(id), companyId, isDefault: true, isActive: true });
      await apiKeysQuery.refetch();
    } catch (error: any) {
      Alert.alert('Update failed', error?.message ?? 'Could not set default provider.');
    }
  };

  const toggleKey = async (id: string) => {
    const key = apiKeys.find(k => k.id === id);
    if (!key) return;
    try {
      await updateApiKeyMutation.mutateAsync({ id: Number(id), companyId, isActive: !key.isActive });
      await apiKeysQuery.refetch();
    } catch (error: any) {
      Alert.alert('Update failed', error?.message ?? 'Could not update provider.');
    }
  };

  const deleteKey = (id: string) => {
    Alert.alert('Delete API Key', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteApiKeyMutation.mutateAsync({ id: Number(id), companyId });
            await apiKeysQuery.refetch();
          } catch (error: any) {
            Alert.alert('Delete failed', error?.message ?? 'Could not delete provider.');
          }
        },
      },
    ]);
  };

  const toggleFeature = async (key: string) => {
    const flag = featureFlags.find(f => f.key === key);
    if (!flag) return;
    try {
      await setFeatureFlagMutation.mutateAsync({
        companyId: currentCompany?.id ?? 1,
        feature: key,
        enabled: !flag.enabled,
      });
      await featureFlagsQuery.refetch();
    } catch (error: any) {
      Alert.alert('Update failed', error?.message ?? 'Could not update feature flag.');
    }
  };

  const persistApiKey = async (key: Partial<ApiKeyEntry> & { rawKey?: string }) => {
    try {
      await saveApiKeyMutation.mutateAsync({
        companyId: currentCompany?.id ?? 1,
        provider: key.provider ?? 'forge',
        keyName: key.keyName ?? 'API Key',
        rawKey: key.rawKey,
        model: key.model,
        isDefault: key.isDefault,
      });
      await apiKeysQuery.refetch();
    } catch (error: any) {
      Alert.alert('Save failed', error?.message ?? 'Could not save API key.');
    }
  };

  const providerInfo = (provider: string) => AI_PROVIDERS.find(p => p.id === provider);

  const PLAN_COLOR: Record<string, string> = {
    free: '#22C55E', business: '#3B82F6', pro: '#8B5CF6', enterprise: '#F59E0B',
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        </Pressable>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Admin Panel</Text>
          <Text style={[styles.headerSub, { color: colors.muted }]}>{currentCompany?.name}</Text>
        </View>
        <View style={[styles.planBadge, { backgroundColor: PLAN_COLOR[currentCompany?.plan ?? 'free'] + '20', borderColor: PLAN_COLOR[currentCompany?.plan ?? 'free'] }]}>
          <Text style={[styles.planBadgeText, { color: PLAN_COLOR[currentCompany?.plan ?? 'free'] }]}>
            {(currentCompany?.plan ?? 'free').toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Section Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {(['ai', 'features', 'company', 'users'] as const).map(tab => (
          <Pressable
            key={tab}
            style={[styles.tab, activeSection === tab && styles.tabActive]}
            onPress={() => setActiveSection(tab)}
          >
            <Text style={[styles.tabText, { color: activeSection === tab ? '#1E3A5F' : colors.muted }]}>
              {tab === 'ai' ? '🤖 AI & Models' : tab === 'features' ? '🚩 Features' : tab === 'company' ? '🏢 Company' : '👥 Users & Roles'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>

        {/* ── AI & Models Section ── */}
        {activeSection === 'ai' && (
          <>
            <View style={[styles.infoBox, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
              <Text style={styles.infoBoxText}>
                AI provider keys are now persisted server-side with masked display values. The active default provider is used for AI agents across your company.
              </Text>
            </View>

            {showApiKeysSkeleton ? (
              <View style={[styles.loadingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ActivityIndicator color={colors.muted} />
                <Text style={[styles.loadingText, { color: colors.muted }]}>Loading API keys...</Text>
                {[0, 1, 2].map(i => (
                  <View key={i} style={[styles.skeletonRow, { backgroundColor: colors.border }]} />
                ))}
              </View>
            ) : apiKeysQuery.isError && apiKeys.length === 0 ? (
              <View style={[styles.infoBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                <Text style={[styles.infoBoxText, { color: '#991B1B' }]}>
                  Could not load API keys. {apiKeysQuery.error?.message ?? 'Please try again.'}
                </Text>
                <Pressable
                  style={[styles.keyActionBtn, { borderColor: colors.border, marginTop: 12 }]}
                  onPress={() => void apiKeysQuery.refetch()}
                >
                  <Text style={[styles.keyActionText, { color: colors.foreground }]}>Retry</Text>
                </Pressable>
              </View>
            ) : apiKeys.map(key => {
              const info = providerInfo(key.provider);
              return (
                <View key={key.id} style={[styles.keyCard, { backgroundColor: colors.surface, borderColor: key.isDefault ? '#1E3A5F' : colors.border }]}>
                  {key.isDefault && (
                    <View style={styles.defaultBanner}>
                      <Text style={styles.defaultBannerText}>✓ ACTIVE DEFAULT</Text>
                    </View>
                  )}
                  <View style={styles.keyCardHeader}>
                    <Text style={styles.keyProviderIcon}>{info?.icon ?? '🔑'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.keyName, { color: colors.foreground }]}>{key.keyName}</Text>
                      <Text style={[styles.keyProvider, { color: colors.muted }]}>{info?.label} · {key.model}</Text>
                    </View>
                    <Switch
                      value={key.isActive}
                      onValueChange={() => toggleKey(key.id)}
                      trackColor={{ false: colors.border, true: '#1E3A5F' }}
                      thumbColor="#fff"
                    />
                  </View>

                  <View style={[styles.keyMeta, { borderTopColor: colors.border }]}>
                    <Text style={[styles.keyMetaText, { color: colors.muted }]}>Key: {key.maskedKey}</Text>
                    <Text style={[styles.keyMetaText, { color: colors.muted }]}>{key.totalCalls.toLocaleString()} calls</Text>
                    {key.lastUsed && <Text style={[styles.keyMetaText, { color: colors.muted }]}>Last: {key.lastUsed}</Text>}
                    <Text style={[styles.keyMetaText, { color: '#16A34A' }]}>Persisted</Text>
                  </View>

                  <View style={styles.keyActions}>
                    {!key.isDefault && (
                      <Pressable style={[styles.keyActionBtn, { borderColor: '#1E3A5F' }]} onPress={() => setDefaultKey(key.id)}>
                        <Text style={[styles.keyActionText, { color: '#1E3A5F' }]}>Set as Default</Text>
                      </Pressable>
                    )}
                    {key.provider !== 'forge' && (
                      <Pressable style={[styles.keyActionBtn, { borderColor: '#EF4444' }]} onPress={() => deleteKey(key.id)}>
                        <Text style={[styles.keyActionText, { color: '#EF4444' }]}>Delete</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}

            <Pressable style={styles.addKeyBtn} onPress={() => setAddKeyVisible(true)}>
              <IconSymbol name="plus.circle.fill" size={20} color="#fff" />
              <Text style={styles.addKeyBtnText}>Add AI Provider / API Key</Text>
            </Pressable>

            {/* Model override for default */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Company-wide Model Override</Text>
              <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
                {"Override the model used by all AI agents for your company. Leave blank to use each provider's default."}
              </Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, marginTop: 10 }]}
                placeholder="e.g. gpt-4o, claude-3-5-sonnet, llama3"
                placeholderTextColor={colors.muted}
              />
            </View>
          </>
        )}

        {/* ── Feature Flags Section ── */}
        {activeSection === 'features' && (
          <>
            <View style={[styles.infoBox, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
              <Text style={styles.infoBoxText}>
                Feature toggles are persisted to company settings and apply across sessions.
              </Text>
            </View>

            {showFeatureFlagsSkeleton ? (
              <View style={[styles.loadingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ActivityIndicator color={colors.muted} />
                <Text style={[styles.loadingText, { color: colors.muted }]}>Loading feature flags...</Text>
                {[0, 1, 2, 3].map(i => (
                  <View key={i} style={[styles.skeletonRow, { backgroundColor: colors.border }]} />
                ))}
              </View>
            ) : featureFlagsQuery.isError && featureFlags.length === 0 ? (
              <View style={[styles.infoBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                <Text style={[styles.infoBoxText, { color: '#991B1B' }]}>
                  Could not load feature flags. {featureFlagsQuery.error?.message ?? 'Please try again.'}
                </Text>
                <Pressable
                  style={[styles.keyActionBtn, { borderColor: colors.border, marginTop: 12 }]}
                  onPress={() => void featureFlagsQuery.refetch()}
                >
                  <Text style={[styles.keyActionText, { color: colors.foreground }]}>Retry</Text>
                </Pressable>
              </View>
            ) : featureFlags.map(flag => (
              <View key={flag.key} style={[styles.flagCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <View style={styles.flagTitleRow}>
                    <Text style={[styles.flagLabel, { color: colors.foreground }]}>{flag.label}</Text>
                    <View style={[styles.planPill, { backgroundColor: PLAN_COLOR[flag.plan] + '20' }]}>
                      <Text style={[styles.planPillText, { color: PLAN_COLOR[flag.plan] }]}>{flag.plan.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={[styles.flagDesc, { color: colors.muted }]}>{flag.description}</Text>
                </View>
                <Switch
                  value={flag.enabled}
                  onValueChange={() => toggleFeature(flag.key)}
                  trackColor={{ false: colors.border, true: '#22C55E' }}
                  thumbColor="#fff"
                />
              </View>
            ))}
          </>
        )}

        {/* ── Company Settings Section ── */}
        {activeSection === 'company' && (
          <>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Company Details</Text>
              {[
                { key: 'name', label: 'Company Name', value: companyForm.name },
                { key: 'companyNumber', label: 'Company Number', value: companyForm.companyNumber },
                { key: 'vatNumber', label: 'VAT Number', value: companyForm.vatNumber },
                { key: 'phone', label: 'Phone', value: companyForm.phone },
                { key: 'email', label: 'Email', value: companyForm.email },
              ].map(field => (
                <View key={field.label} style={styles.fieldRow}>
                  <Text style={[styles.fieldLabel, { color: colors.muted }]}>{field.label}</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                    value={field.value}
                    onChangeText={value => setCompanyForm(prev => ({ ...prev, [field.key]: value }))}
                    placeholderTextColor={colors.muted}
                  />
                </View>
              ))}
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>CIS Configuration</Text>
              <Text style={[styles.cardSubtitle, { color: colors.muted }]}>Construction Industry Scheme settings for invoicing</Text>
              <View style={styles.fieldRow}>
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>UTR Number</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                  value={companyForm.utr}
                  onChangeText={utr => setCompanyForm(prev => ({ ...prev, utr }))}
                  placeholder="10-digit UTR"
                  placeholderTextColor={colors.muted}
                />
              </View>
              <Text style={[styles.fieldLabel, { color: colors.muted, marginTop: 12 }]}>CIS Registration Status</Text>
              {[
                { id: 'registered_20', label: 'Registered (20% deduction)' },
                { id: 'registered_30', label: 'Not Registered (30% deduction)' },
                { id: 'gross_payment', label: 'Gross Payment Status (0%)' },
              ].map(opt => (
                <Pressable
                  key={opt.id}
                  style={[styles.modelRow, { borderColor: companyForm.cisStatus === opt.id ? '#1E3A5F' : colors.border, marginTop: 8 }]}
                  onPress={() => setCompanyForm(prev => ({ ...prev, cisStatus: opt.id }))}
                >
                  <View style={[styles.modelRadio, companyForm.cisStatus === opt.id && { borderColor: '#1E3A5F' }]}>
                    {companyForm.cisStatus === opt.id && <View style={styles.modelRadioFill} />}
                  </View>
                  <Text style={[styles.modelLabel, { color: colors.foreground }]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* GPS Distance Filter per project */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>GPS Distance Filter — Per Project</Text>
              <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
                Set the minimum movement threshold before HORUS receives a location ping. Overrides the worker’s personal setting. Use a tight filter (5–10 m) for confined indoor sites and a wider filter (50–100 m) for large open yards.
              </Text>
              {(projectsQuery.data ?? []).map(project => (
                <View key={project.id} style={{ marginTop: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={[styles.fieldLabel, { color: colors.foreground, flex: 1 }]} numberOfLines={1}>{project.name}</Text>
                    <View style={[styles.roleBadge, { backgroundColor: '#F9731620', borderColor: '#F97316' }]}>
                      <Text style={[styles.roleBadgeText, { color: '#F97316' }]}>{projectFilters[String(project.id)] ?? project.geofenceRadius ?? 200}m</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    {GPS_FILTER_OPTIONS.map(m => (
                      <Pressable
                        key={m}
                        style={[
                          styles.typeBtn,
                          { borderColor: (projectFilters[String(project.id)] ?? project.geofenceRadius ?? 200) === m ? '#F97316' : colors.border,
                            backgroundColor: (projectFilters[String(project.id)] ?? project.geofenceRadius ?? 200) === m ? '#F9731620' : 'transparent',
                            paddingHorizontal: 10, paddingVertical: 5 },
                        ]}
                        onPress={() => setProjectFilter(String(project.id), m)}
                      >
                        <Text style={[
                          styles.typeBtnText,
                          { color: (projectFilters[String(project.id)] ?? project.geofenceRadius ?? 200) === m ? '#F97316' : colors.muted, fontSize: 12 },
                        ]}>{m}m</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
              {!projectsQuery.data?.length && (
                <Text style={[styles.cardSubtitle, { color: colors.muted, marginTop: 12 }]}>
                  No live projects found. Create projects before configuring per-site HORUS filters.
                </Text>
              )}
            </View>
            {/* Payroll Email */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Payroll Settings</Text>
              <Text style={[styles.cardSubtitle, { color: colors.muted }]}>{"The payroll email is used by the \"Send to Payroll\" button on approved timesheets."}</Text>
              <View style={styles.fieldRow}>
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>Payroll Email Address</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                  value={companyForm.payrollEmail}
                  onChangeText={payrollEmail => setCompanyForm(prev => ({ ...prev, payrollEmail }))}
                  placeholder="e.g. payroll@company.co.uk"
                  placeholderTextColor={colors.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
            <Pressable
              style={[styles.saveBtn, updateSettingsMutation.isPending && { opacity: 0.6 }]}
              onPress={handleSaveCompanySettings}
              disabled={updateSettingsMutation.isPending}
            >
              {updateSettingsMutation.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>Save Company Settings</Text>}
            </Pressable>
          </>
        )}

        {/* ── Users & Roles Section ── */}
        {activeSection === 'users' && (
          <>
            <View style={[styles.infoBox, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
              <Text style={styles.infoBoxText}>
                Role hierarchy: Super Admin → Company Admin → Manager → Supervisor → Worker → Viewer. Higher roles inherit all permissions of lower roles.
              </Text>
            </View>

            {(teamsQuery.data ?? []).map(user => (
              <View key={user.id} style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>{user.name.split(' ').map(n => n[0]).join('')}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.userName, { color: colors.foreground }]}>{user.name}</Text>
                  <Text style={[styles.userEmail, { color: colors.muted }]}>{user.email ?? 'No email on file'}</Text>
                  <Text style={[styles.userDept, { color: colors.muted }]}>{user.trade ?? user.role}</Text>
                </View>
                <View style={[styles.roleBadge, { backgroundColor: '#1E3A5F20' }]}>
                  <Text style={[styles.roleBadgeText, { color: '#1E3A5F' }]}>
                    {user.role.replace('_', ' ')}
                  </Text>
                </View>
              </View>
            ))}
            {!teamsQuery.data?.length && (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
                  No live team members found. Use Super Admin to invite and assign workers.
                </Text>
              </View>
            )}

            <Pressable style={styles.addKeyBtn} onPress={() => router.push('/super-admin' as any)}>
              <IconSymbol name="person.badge.plus" size={20} color="#fff" />
              <Text style={styles.addKeyBtnText}>Invite Team Member</Text>
            </Pressable>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <AddKeyModal
        visible={addKeyVisible}
        onClose={() => setAddKeyVisible(false)}
        onSave={persistApiKey}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 0.5, gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 1 },
  planBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1.5,
  },
  planBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  tabs: { borderBottomWidth: 0.5, paddingHorizontal: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#1E3A5F' },
  tabText: { fontSize: 13, fontWeight: '600' },
  infoBox: { borderRadius: 10, borderWidth: 1, padding: 12 },
  infoBoxText: { fontSize: 13, lineHeight: 19, color: '#374151' },
  loadingCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 10, alignItems: 'stretch' },
  loadingText: { fontSize: 13, textAlign: 'center', marginBottom: 4 },
  skeletonRow: { height: 14, borderRadius: 6, opacity: 0.5 },
  keyCard: { borderRadius: 12, borderWidth: 1.5, overflow: 'hidden' },
  defaultBanner: { backgroundColor: '#1E3A5F', paddingVertical: 4, paddingHorizontal: 12 },
  defaultBannerText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  keyCardHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  keyProviderIcon: { fontSize: 28 },
  keyName: { fontSize: 15, fontWeight: '700' },
  keyProvider: { fontSize: 12, marginTop: 2 },
  keyMeta: { flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 0.5 },
  keyMetaText: { fontSize: 11 },
  keyActions: { flexDirection: 'row', gap: 8, padding: 12 },
  keyActionBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  keyActionText: { fontSize: 13, fontWeight: '600' },
  addKeyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1E3A5F', borderRadius: 12,
    paddingVertical: 14, gap: 8,
  },
  addKeyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  card: { borderRadius: 12, borderWidth: 1, padding: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  flagCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1,
    padding: 14, gap: 12,
  },
  flagTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  flagLabel: { fontSize: 14, fontWeight: '700' },
  flagDesc: { fontSize: 12, lineHeight: 17 },
  planPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  planPillText: { fontSize: 10, fontWeight: '700' },
  fieldRow: { marginTop: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  fieldHint: { fontSize: 11, marginTop: 4 },
  textInput: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14,
  },
  modelRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 8,
    padding: 12, gap: 10,
  },
  modelRadio: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center',
  },
  modelRadioFill: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1E3A5F' },
  modelLabel: { fontSize: 14 },
  saveBtn: {
    backgroundColor: '#1E3A5F', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  userCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1,
    padding: 14, gap: 12,
  },
  userAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1E3A5F',
    alignItems: 'center', justifyContent: 'center',
  },
  userAvatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  userName: { fontSize: 15, fontWeight: '700' },
  userEmail: { fontSize: 12, marginTop: 1 },
  userDept: { fontSize: 11, marginTop: 1 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  roleBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  // Modal
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 0.5,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  providerChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#D1D5DB',
    marginRight: 8, gap: 6,
  },
  providerIcon: { fontSize: 18 },
  providerLabel: { fontSize: 13, color: '#374151' },
  freeBadge: { backgroundColor: '#D1FAE5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  freeBadgeText: { fontSize: 9, fontWeight: '700', color: '#065F46' },
  noAccessTitle: { fontSize: 20, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  noAccessText: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  typeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  typeBtnText: { fontSize: 12, fontWeight: '600' },
});
