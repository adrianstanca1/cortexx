import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet,
  Alert, Modal, TextInput, ActivityIndicator, Share, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SectionHeader } from '@/components/ui/shared';
import { useColors } from '@/hooks/use-colors';
import { MOCK_TIMESHEETS, formatDate } from '@/lib/mock-data';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/lib/company-context';
import { mapTimesheetEntries, mapTimesheetSubmissions, type TimesheetSubmissionView } from '@/lib/timesheet-mappers';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS_COLORS: Record<string, string> = {
  draft: '#94A3B8',
  submitted: '#F59E0B',
  approved: '#22C55E',
  rejected: '#EF4444',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
};

function getWeekDates(): string[] {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function getWeekStarting(): string {
  const weekDates = getWeekDates();
  return weekDates[0];
}

type TimesheetSubmission = TimesheetSubmissionView;

const FALLBACK_SUBMISSIONS: TimesheetSubmission[] = [
  { id: 's1', workerName: 'James Thornton', weekStarting: '2026-04-14', totalHours: 42.5, overtimeHours: 2.5, status: 'approved', submittedAt: '2026-04-19T08:00:00Z', reviewedBy: 'Site Manager', notes: 'Approved — good week', mondayHours: 8, tuesdayHours: 8, wednesdayHours: 8, thursdayHours: 8, fridayHours: 8, saturdayHours: 2.5, sundayHours: 0 },
  { id: 's2', workerName: 'James Thornton', weekStarting: '2026-04-07', totalHours: 40, overtimeHours: 0, status: 'approved', submittedAt: '2026-04-12T08:00:00Z', reviewedBy: 'Site Manager', mondayHours: 8, tuesdayHours: 8, wednesdayHours: 8, thursdayHours: 8, fridayHours: 8, saturdayHours: 0, sundayHours: 0 },
  { id: 's3', workerName: 'James Thornton', weekStarting: '2026-03-31', totalHours: 38, overtimeHours: 0, status: 'rejected', submittedAt: '2026-04-05T08:00:00Z', reviewedBy: 'Site Manager', notes: 'Missing Saturday hours — please resubmit', mondayHours: 8, tuesdayHours: 8, wednesdayHours: 8, thursdayHours: 8, fridayHours: 6, saturdayHours: 0, sundayHours: 0 },
];

export default function TimesheetsScreen() {
  const colors = useColors();
  const router = useRouter();
  const weekDates = getWeekDates();

  const [localSubmissions, setLocalSubmissions] = useState<TimesheetSubmission[]>([]);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { currentCompany, currentProject, currentUser } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const submitMutation = trpc.timesheets.submit.useMutation();
  const timesheetsQuery = trpc.timesheets.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const generateSignedOffMutation = trpc.documents.generateTimesheetSignedOff.useMutation();
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [sendingPayrollId, setSendingPayrollId] = useState<string | null>(null);

  const PAYROLL_EMAIL = currentCompany?.payrollEmail || 'payroll@cortexbuild.com';
  const workerName = currentUser.name;
  const liveEntries = useMemo(
    () => mapTimesheetEntries(timesheetsQuery.isError ? undefined : timesheetsQuery.data, MOCK_TIMESHEETS, getWeekStarting()),
    [timesheetsQuery.data, timesheetsQuery.isError],
  );
  const remoteSubmissions = useMemo(
    () => mapTimesheetSubmissions(timesheetsQuery.isError ? undefined : timesheetsQuery.data, FALLBACK_SUBMISSIONS),
    [timesheetsQuery.data, timesheetsQuery.isError],
  );
  const submissions = useMemo(() => {
    const seen = new Set(remoteSubmissions.map(s => s.id));
    return [...localSubmissions.filter(s => !seen.has(s.id)), ...remoteSubmissions];
  }, [localSubmissions, remoteSubmissions]);

  const handleSendToPayroll = useCallback(async (sub: TimesheetSubmission) => {
    setSendingPayrollId(sub.id);
    try {
      // Generate the signed-off PDF content first so the body contains a text summary
      const result = await generateSignedOffMutation.mutateAsync({
        companyId,
        workerName: sub.workerName,
        projectName: sub.projectName ?? currentProject?.name ?? 'Current project',
        weekStarting: sub.weekStarting,
        totalHours: sub.totalHours,
        overtimeHours: sub.overtimeHours,
        approvedBy: sub.reviewedBy,
        notes: sub.notes,
      });
      const subject = encodeURIComponent(`Timesheet — ${sub.workerName} w/c ${sub.weekStarting}`);
      const body = encodeURIComponent(
        `Hi Payroll Team,\n\nPlease find the approved timesheet for ${sub.workerName} for the week commencing ${sub.weekStarting}.\n\n` +
        `Regular Hours: ${sub.totalHours - (sub.overtimeHours ?? 0)}h\n` +
        `Overtime Hours: ${sub.overtimeHours ?? 0}h\n` +
        `Total Hours: ${sub.totalHours}h\n` +
        `Approved By: ${sub.reviewedBy ?? 'Manager'}\n\n` +
        `--- Document Summary ---\n${result.content.slice(0, 600)}\n\nKind regards,\nCortexBuild Field App`
      );
      const mailtoUrl = `mailto:${PAYROLL_EMAIL}?subject=${subject}&body=${body}`;
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
      } else {
        Alert.alert('No Email App', 'Please configure an email app on this device to send timesheets.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not prepare email.');
    } finally {
      setSendingPayrollId(null);
    }
  }, [companyId, generateSignedOffMutation, PAYROLL_EMAIL, currentProject?.name]);

  const handleExportPDF = useCallback(async (sub: TimesheetSubmission) => {
    setExportingId(sub.id);
    try {
      const result = await generateSignedOffMutation.mutateAsync({
        companyId,
        workerName: sub.workerName,
        projectName: sub.projectName ?? currentProject?.name ?? 'Current project',
        weekStarting: sub.weekStarting,
        totalHours: sub.totalHours,
        overtimeHours: sub.overtimeHours,
        approvedBy: sub.reviewedBy,
        notes: sub.notes,
      });
      await Share.share({ title: result.title, message: result.content });
    } catch (err: any) {
      Alert.alert('Export Failed', err?.message ?? 'Could not generate timesheet.');
    } finally {
      setExportingId(null);
    }
  }, [companyId, generateSignedOffMutation, currentProject?.name]);

  const currentWeekEntries = liveEntries.filter(entry => weekDates.includes(entry.date));
  const totalRegular = currentWeekEntries.reduce((s, t) => s + t.regularHours, 0);
  const totalOvertime = currentWeekEntries.reduce((s, t) => s + t.overtimeHours, 0);
  const totalHours = totalRegular + totalOvertime;

  const getEntryForDate = useCallback((date: string) =>
    liveEntries.find(t => t.date === date), [liveEntries]);

  const currentWeekSubmission = submissions.find(sub => sub.weekStarting === getWeekStarting());
  const currentStatus = currentWeekSubmission?.status ?? 'draft';

  const handleSubmitForApproval = useCallback(async () => {
    setSubmitting(true);
    try {
      const payload = {
        companyId,
        workerName,
        projectId: currentProject?.id,
        projectName: currentProject?.name,
        weekStarting: getWeekStarting(),
        mondayHours: getEntryForDate(weekDates[0])?.regularHours ?? 0,
        tuesdayHours: getEntryForDate(weekDates[1])?.regularHours ?? 0,
        wednesdayHours: getEntryForDate(weekDates[2])?.regularHours ?? 0,
        thursdayHours: getEntryForDate(weekDates[3])?.regularHours ?? 0,
        fridayHours: getEntryForDate(weekDates[4])?.regularHours ?? 0,
        saturdayHours: getEntryForDate(weekDates[5])?.regularHours ?? 0,
        sundayHours: getEntryForDate(weekDates[6])?.regularHours ?? 0,
        totalHours, overtimeHours: totalOvertime,
        notes: notes.trim() || undefined,
      };
      await submitMutation.mutateAsync(payload);
      await timesheetsQuery.refetch();

      const newSubmission: TimesheetSubmission = {
        id: `s_${Date.now()}`,
        workerName,
        weekStarting: getWeekStarting(),
        totalHours,
        overtimeHours: totalOvertime,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
        notes: notes.trim() || undefined,
      };
      setLocalSubmissions(prev => [newSubmission, ...prev]);
      setShowSubmitModal(false);
      setNotes('');
      Alert.alert('Submitted', 'Your timesheet has been submitted for approval. Your manager will be notified.', [{ text: 'OK' }]);
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'Failed to submit timesheet. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [companyId, currentProject, getEntryForDate, notes, submitMutation, timesheetsQuery, totalHours, totalOvertime, weekDates, workerName]);

  const statusColor = STATUS_COLORS[currentStatus];

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: '#06B6D4' }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <IconSymbol name="arrow.left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Timesheets</Text>
            <Text style={styles.headerSub}>Week of {formatDate(weekDates[0])}</Text>
          </View>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]} onPress={() => setShowSubmitModal(true)}>
            <IconSymbol name="plus" size={18} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Log Hours</Text>
          </TouchableOpacity>
        </View>

        {/* Weekly Summary */}
        <View style={[styles.summaryCard, { backgroundColor: '#1E3A5F' }]}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totalHours.toFixed(1)}</Text>
              <Text style={styles.summaryLabel}>Total Hours</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totalRegular.toFixed(1)}</Text>
              <Text style={styles.summaryLabel}>Regular</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, totalOvertime > 0 && { color: '#FCD34D' }]}>
                {totalOvertime.toFixed(1)}
              </Text>
              <Text style={styles.summaryLabel}>Overtime</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {submissions.filter(s => s.status === 'approved').length}
              </Text>
              <Text style={styles.summaryLabel}>Approved</Text>
            </View>
          </View>
        </View>

        {/* Current Week Status + Submit Button */}
        <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.statusRow}>
            <View>
              <Text style={[styles.statusLabel, { color: colors.muted }]}>This Week Status</Text>
              <View style={styles.statusBadgeRow}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusValue, { color: statusColor }]}>
                  {STATUS_LABELS[currentStatus]}
                </Text>
              </View>
            </View>
            {currentStatus === 'draft' && (
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: '#1E3A5F' }]}
                onPress={() => setShowSubmitModal(true)}
              >
                <IconSymbol name="paperplane.fill" size={14} color="#fff" />
                <Text style={styles.submitBtnText}>Submit for Approval</Text>
              </TouchableOpacity>
            )}
            {currentStatus === 'submitted' && (
              <View style={[styles.pendingBadge, { backgroundColor: '#F59E0B22', borderColor: '#F59E0B' }]}>
                <Text style={[styles.pendingText, { color: '#F59E0B' }]}>Awaiting Review</Text>
              </View>
            )}
            {currentStatus === 'rejected' && (
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: '#EF4444' }]}
                onPress={() => setShowSubmitModal(true)}
              >
                <IconSymbol name="arrow.counterclockwise" size={14} color="#fff" />
                <Text style={styles.submitBtnText}>Resubmit</Text>
              </TouchableOpacity>
            )}
          </View>
          {currentStatus === 'rejected' && submissions[0]?.notes && (
            <View style={[styles.rejectionNote, { backgroundColor: '#EF444415', borderColor: '#EF4444' }]}>
              <IconSymbol name="exclamationmark.circle.fill" size={14} color="#EF4444" />
              <Text style={[styles.rejectionNoteText, { color: '#EF4444' }]}>{submissions[0].notes}</Text>
            </View>
          )}
        </View>

        {/* Weekly Grid */}
        <SectionHeader title="This Week" />
        <View style={[styles.weekGrid, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {weekDates.map((date, idx) => {
            const entry = getEntryForDate(date);
            const dayDate = new Date(date);
            const isToday = date === new Date().toISOString().slice(0, 10);
            const hours = entry ? entry.regularHours + entry.overtimeHours : 0;
            return (
              <TouchableOpacity
                key={date}
                style={[
                  styles.dayCell,
                  isToday && { backgroundColor: colors.primary + '15' },
                  idx < 6 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                ]}
                activeOpacity={0.7}
              >
                <View style={styles.dayCellLeft}>
                  <View style={[styles.dayBadge, isToday && { backgroundColor: colors.primary }]}>
                    <Text style={[styles.dayName, { color: isToday ? '#FFFFFF' : colors.muted }]}>
                      {DAYS[idx]}
                    </Text>
                    <Text style={[styles.dayNum, { color: isToday ? '#FFFFFF' : colors.foreground }]}>
                      {dayDate.getDate()}
                    </Text>
                  </View>
                  {entry ? (
                    <View>
                      <Text style={[styles.entryProject, { color: colors.foreground }]} numberOfLines={1}>
                        {entry.projectName}
                      </Text>
                      <Text style={[styles.entryNotes, { color: colors.muted }]} numberOfLines={1}>
                        {entry.notes ?? 'Regular shift'}
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.noEntry, { color: colors.muted }]}>No entry</Text>
                  )}
                </View>
                <View style={styles.dayCellRight}>
                  {entry ? (
                    <>
                      <Text style={[styles.hoursText, { color: colors.foreground }]}>
                        {hours.toFixed(1)}h
                      </Text>
                      {entry.overtimeHours > 0 && (
                        <Text style={styles.overtimeText}>+{entry.overtimeHours}h OT</Text>
                      )}
                      <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[entry.status] ?? '#94A3B8' }]} />
                    </>
                  ) : (
                    <IconSymbol name="plus.circle.fill" size={20} color={colors.border} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Submission History */}
        <SectionHeader title="Submission History" />
        <View style={[styles.historyList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {submissions.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Text style={[styles.emptyHistoryText, { color: colors.muted }]}>No submissions yet</Text>
            </View>
          ) : (
            submissions.map((sub, idx) => (
              <View key={sub.id}>
                <View style={styles.historyItem}>
                  <View style={[styles.historyStatusIcon, { backgroundColor: STATUS_COLORS[sub.status] + '20' }]}>
                    <IconSymbol
                      name={sub.status === 'approved' ? 'checkmark.circle.fill' : sub.status === 'rejected' ? 'xmark.circle.fill' : sub.status === 'submitted' ? 'clock.fill' : 'doc.fill'}
                      size={18}
                      color={STATUS_COLORS[sub.status]}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.historyWeek, { color: colors.foreground }]}>
                      Week of {formatDate(sub.weekStarting)}
                    </Text>
                    <Text style={[styles.historyMeta, { color: colors.muted }]}>
                      {sub.totalHours}h total · {sub.overtimeHours}h OT
                      {sub.reviewedBy ? ` · ${sub.reviewedBy}` : ''}
                    </Text>
                    {sub.notes && sub.status === 'rejected' && (
                      <Text style={[styles.historyNote, { color: '#EF4444' }]} numberOfLines={2}>
                        {sub.notes}
                      </Text>
                    )}
                    {sub.notes && sub.status === 'approved' && (
                      <Text style={[styles.historyNote, { color: '#22C55E' }]} numberOfLines={1}>
                        {sub.notes}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[styles.statusPill, { backgroundColor: STATUS_COLORS[sub.status] + '20', borderColor: STATUS_COLORS[sub.status] }]}>
                      <Text style={[styles.statusPillText, { color: STATUS_COLORS[sub.status] }]}>
                        {STATUS_LABELS[sub.status]}
                      </Text>
                    </View>
                    {sub.submittedAt && (
                      <Text style={[styles.submittedAt, { color: colors.muted }]}>
                        {new Date(sub.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </Text>
                    )}
                    <TouchableOpacity
                      style={[styles.exportBtn, { borderColor: '#06B6D4' }]}
                      onPress={() => handleExportPDF(sub)}
                      disabled={exportingId === sub.id || sendingPayrollId === sub.id}
                    >
                      {exportingId === sub.id
                        ? <ActivityIndicator size="small" color="#06B6D4" />
                        : <IconSymbol name="square.and.arrow.up" size={12} color="#06B6D4" />}
                      <Text style={[styles.exportBtnText, { color: '#06B6D4' }]}>Export</Text>
                    </TouchableOpacity>
                    {sub.status === 'approved' && (
                      <TouchableOpacity
                        style={[styles.exportBtn, { borderColor: '#22C55E', marginTop: 4 }]}
                        onPress={() => handleSendToPayroll(sub)}
                        disabled={sendingPayrollId === sub.id || exportingId === sub.id}
                      >
                        {sendingPayrollId === sub.id
                          ? <ActivityIndicator size="small" color="#22C55E" />
                          : <IconSymbol name="envelope.fill" size={12} color="#22C55E" />}
                        <Text style={[styles.exportBtnText, { color: '#22C55E' }]}>Payroll</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                {idx < submissions.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                )}
              </View>
            ))
          )}
        </View>

      </ScrollView>

      {/* Submit for Approval Modal */}
      <Modal visible={showSubmitModal} transparent animationType="slide" onRequestClose={() => setShowSubmitModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Submit Timesheet</Text>
            <Text style={[styles.modalSub, { color: colors.muted }]}>
              Submitting {totalHours.toFixed(1)}h ({totalOvertime.toFixed(1)}h OT) for week of {formatDate(getWeekStarting())}
            </Text>

            <View style={[styles.summaryPreview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {DAYS.map((day, i) => {
                const entry = getEntryForDate(weekDates[i]);
                const hours = entry ? entry.regularHours + entry.overtimeHours : 0;
                return (
                  <View key={day} style={styles.previewRow}>
                    <Text style={[styles.previewDay, { color: colors.muted }]}>{day}</Text>
                    <Text style={[styles.previewHours, { color: hours > 0 ? colors.foreground : colors.muted }]}>
                      {hours > 0 ? `${hours.toFixed(1)}h` : '—'}
                    </Text>
                  </View>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Notes (optional)</Text>
            <TextInput
              style={[styles.notesInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Any notes for your manager..."
              placeholderTextColor={colors.muted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              returnKeyType="done"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: '#1E3A5F' }]}
                onPress={handleSubmitForApproval}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <IconSymbol name="paperplane.fill" size={16} color="#fff" />
                    <Text style={styles.confirmBtnText}>Submit for Approval</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setShowSubmitModal(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100 },
  addBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  summaryCard: { marginHorizontal: 16, marginTop: 12, borderRadius: 16, padding: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  summaryLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  summaryDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.15)' },
  statusCard: { marginHorizontal: 16, marginTop: 12, borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  statusBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusValue: { fontSize: 14, fontWeight: '700' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  submitBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  pendingBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  pendingText: { fontSize: 12, fontWeight: '600' },
  rejectionNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  rejectionNoteText: { flex: 1, fontSize: 12, lineHeight: 18 },
  weekGrid: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  dayCell: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  dayCellLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayBadge: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 1 },
  dayName: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  dayNum: { fontSize: 16, fontWeight: '700' },
  entryProject: { fontSize: 13, fontWeight: '600' },
  entryNotes: { fontSize: 11, marginTop: 1 },
  noEntry: { fontSize: 13 },
  dayCellRight: { alignItems: 'flex-end', gap: 3 },
  hoursText: { fontSize: 16, fontWeight: '700' },
  overtimeText: { fontSize: 11, color: '#F59E0B', fontWeight: '600' },
  historyList: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  historyItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  historyStatusIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  historyWeek: { fontSize: 14, fontWeight: '600' },
  historyMeta: { fontSize: 12, marginTop: 2 },
  historyNote: { fontSize: 11, marginTop: 4, lineHeight: 16 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusPillText: { fontSize: 11, fontWeight: '600' },
  submittedAt: { fontSize: 10 },
  emptyHistory: { padding: 24, alignItems: 'center' },
  emptyHistoryText: { fontSize: 14 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc', alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  modalSub: { fontSize: 13, marginBottom: 16, lineHeight: 18 },
  summaryPreview: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewRow: { width: '13%', alignItems: 'center', gap: 2 },
  previewDay: { fontSize: 10, fontWeight: '600' },
  previewHours: { fontSize: 12, fontWeight: '700' },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  notesInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, height: 80, textAlignVertical: 'top', marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 12 },
  confirmBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
  cancelBtnText: { fontWeight: '600', fontSize: 15 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  exportBtnText: { fontSize: 11, fontWeight: '600' },
});
