/**
 * Onboarding Screen — Invite Acceptance
 * Workers enter their email + PIN to activate their account and complete their profile.
 * Accessible via deep link: cortexbuild://onboard?email=...&pin=...
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { trpc } from '@/lib/trpc';
import * as Auth from '@/lib/_core/auth';

// React Native Web's Alert is a literal no-op (`class Alert { static alert() {} }`).
// On web we surface state inline so the user actually sees what happened
// (and OK-button onPress callbacks never fire); native still uses Alert.alert.
const IS_WEB = Platform.OS === 'web';

type Step = 'verify' | 'profile' | 'success';

const TRADE_OPTIONS = [
  'Concrete', 'Rebar', 'Steel Fixing', 'Formwork', 'Brickwork', 'Blockwork',
  'Carpentry', 'Joinery', 'Roofing', 'Drylining', 'Plastering', 'Painting',
  'Electrical', 'Plumbing', 'Mechanical', 'HVAC', 'Scaffolding', 'Groundworks',
  'Demolition', 'Surveying', 'Project Management', 'HSE', 'Other',
];

export default function OnboardScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ email?: string; pin?: string }>();

  const [step, setStep] = useState<Step>('verify');
  const [loading, setLoading] = useState(false);

  // Step 1 — Verify
  const [email, setEmail] = useState(params.email ?? '');
  const [pin, setPin] = useState(params.pin ?? '');
  const [pinVisible, setPinVisible] = useState(false);

  // Step 2 — Profile
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [trade, setTrade] = useState('');
  const [tradePickerOpen, setTradePickerOpen] = useState(false);

  // Step 3 — Success data
  const [welcomeName, setWelcomeName] = useState('');
  const [welcomeRole, setWelcomeRole] = useState('');
  const [welcomeProject, setWelcomeProject] = useState('');

  const acceptMutation = trpc.users.acceptInvite.useMutation();
  const resendMutation = trpc.users.resendInvite.useMutation();
  const [showForgotPin, setShowForgotPin] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  // Inline error/notice state — used on web (Alert.alert is a no-op) and
  // ignored on native. Keys cover the three submit handlers + the
  // resent-PIN confirmation banner.
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [pinResentTo, setPinResentTo] = useState<string | null>(null);

  function showError(title: string, body: string) {
    if (IS_WEB) setInlineError(`${title}: ${body}`);
    else Alert.alert(title, body);
  }

  const handleForgotPin = useCallback(async () => {
    setInlineError(null);
    setPinResentTo(null);
    const addr = (forgotEmail.trim() || email.trim());
    if (!addr) {
      showError('Email Required', 'Please enter your email address first.');
      return;
    }
    setForgotLoading(true);
    try {
      await resendMutation.mutateAsync({ email: addr });
      // On web the alert + its OK-button onPress (which closes the
      // forgot-pin form) never fire. Render an inline banner with the
      // address and close the form ourselves; native gets the dialog.
      if (IS_WEB) {
        setPinResentTo(addr);
        setShowForgotPin(false);
      } else {
        Alert.alert(
          'New PIN Sent',
          `A new 6-digit PIN has been emailed to ${addr}.\n\nThe PIN expires in 7 days. Check your email and enter it below — or tap the link in the email to onboard directly.`,
          [{ text: 'OK', onPress: () => { setShowForgotPin(false); } }]
        );
      }
    } catch (err: any) {
      showError('Not Found', err.message ?? 'No invitation found for this email. Please contact your admin.');
    } finally {
      setForgotLoading(false);
    }
  }, [forgotEmail, email, resendMutation]);

  // Auto-advance to profile step if deep link provided valid email+pin
  useEffect(() => {
    if (params.email && params.pin && params.pin.length === 6) {
      // Pre-fill and stay on verify so user can confirm
    }
  }, [params.email, params.pin]);

  const handleVerify = useCallback(async () => {
    setInlineError(null);
    if (!email.trim() || pin.length !== 6) {
      showError('Missing Details', 'Please enter your email address and the 6-digit PIN from your invitation.');
      return;
    }
    setLoading(true);
    try {
      // Just validate format before proceeding to profile step
      // Full verification happens on final submit
      setStep('profile');
    } catch {
      showError('Error', 'Please check your email and PIN and try again.');
    } finally {
      setLoading(false);
    }
  }, [email, pin]);

  const handleSubmit = useCallback(async () => {
    setInlineError(null);
    if (!firstName.trim() || !lastName.trim()) {
      showError('Missing Details', 'First name and last name are required.');
      return;
    }
    setLoading(true);
    try {
      const result = await acceptMutation.mutateAsync({
        email: email.trim().toLowerCase(),
        pin: pin.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        trade: trade || undefined,
      });
      if (result.sessionToken) await Auth.setSessionToken(result.sessionToken);
      if (result.user) {
        await Auth.setUserInfo({
          ...result.user,
          lastSignedIn: new Date(result.user.lastSignedIn),
        });
      }
      setWelcomeName(result.name);
      setWelcomeRole(result.role?.replace(/_/g, ' ') ?? 'Field Worker');
      setWelcomeProject(result.projectName ?? '');
      setStep('success');
    } catch (err: any) {
      showError('Activation Failed', err.message ?? 'Please check your email and PIN and try again.');
    } finally {
      setLoading(false);
    }
  }, [email, pin, firstName, lastName, phone, trade, acceptMutation]);

  const handleGoToApp = useCallback(async () => {
    router.replace('/(tabs)');
  }, []);

  return (
    <ScreenContainer>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={[styles.header, { backgroundColor: '#1E3A5F' }]}>
            <View style={styles.logoRow}>
              <View style={styles.logoBox}>
                <Text style={styles.logoText}>CB</Text>
              </View>
              <View>
                <Text style={styles.appName}>CortexBuild Field</Text>
                <Text style={styles.appTagline}>Construction Management Platform</Text>
              </View>
            </View>
            {/* Step indicator */}
            <View style={styles.stepRow}>
              {(['verify', 'profile', 'success'] as Step[]).map((s, i) => (
                <React.Fragment key={s}>
                  <View style={[styles.stepDot, { backgroundColor: step === s ? '#fff' : 'rgba(255,255,255,0.3)', borderColor: '#fff' }]}>
                    {(step as string) === 'success' || (s === 'verify' && (step as string) !== 'verify') || (s === 'profile' && (step as string) === 'success') ? (
                      <IconSymbol name="checkmark" size={10} color={step === s ? '#1E3A5F' : 'rgba(255,255,255,0.6)'} />
                    ) : (
                      <Text style={[styles.stepNum, { color: step === s ? '#1E3A5F' : 'rgba(255,255,255,0.6)' }]}>{i + 1}</Text>
                    )}
                  </View>
                  {i < 2 && <View style={[styles.stepLine, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />}
                </React.Fragment>
              ))}
            </View>
          </View>

          <View style={[styles.body, { backgroundColor: colors.background }]}>
            {/* Inline notices for web (Alert.alert is a no-op on RN Web).
                Errors render red, the resent-PIN confirmation renders green.
                Both are visible across every step. */}
            {inlineError && (
              <View
                style={[styles.section, styles.errorBanner]}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                <Text style={styles.errorBannerText}>{inlineError}</Text>
              </View>
            )}
            {pinResentTo && (
              <View
                style={[styles.section, styles.successBanner]}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                <Text style={styles.successBannerText}>
                  New PIN sent to {pinResentTo}. The PIN expires in 7 days — enter it below.
                </Text>
              </View>
            )}
            {/* ── Step 1: Verify ── */}
            {step === 'verify' && (
              <View style={styles.section}>
                <Text style={[styles.stepTitle, { color: colors.foreground }]}>Accept Your Invitation</Text>
                <Text style={[styles.stepDesc, { color: colors.muted }]}>
                  Enter the email address and 6-digit PIN from your invitation to activate your CortexBuild Field account.
                </Text>

                <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <IconSymbol name="envelope.fill" size={16} color="#0a7ea4" />
                  <Text style={[styles.infoText, { color: colors.muted }]}>
                    Check your email for the invitation from your site admin. The PIN is valid for 7 days.
                  </Text>
                </View>

                <Text style={[styles.fieldLabel, { color: colors.muted }]}>Email Address</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                  placeholder="your.email@example.com"
                  placeholderTextColor={colors.muted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />

                <Text style={[styles.fieldLabel, { color: colors.muted }]}>6-Digit PIN</Text>
                <View style={styles.pinRow}>
                  <TextInput
                    style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface, flex: 1, letterSpacing: 8, fontSize: 22, textAlign: 'center' }]}
                    placeholder="••••••"
                    placeholderTextColor={colors.muted}
                    value={pin}
                    onChangeText={v => setPin(v.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    secureTextEntry={!pinVisible}
                    maxLength={6}
                    returnKeyType="done"
                    onSubmitEditing={handleVerify}
                  />
                  <Pressable style={styles.eyeBtn} onPress={() => setPinVisible(p => !p)}>
                    <IconSymbol name={pinVisible ? 'eye.slash.fill' : 'eye.fill'} size={20} color={colors.muted} />
                  </Pressable>
                </View>

                <Pressable
                  style={[styles.primaryBtn, { opacity: loading ? 0.6 : 1 }]}
                  onPress={handleVerify}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.primaryBtnText}>Continue</Text>
                      <IconSymbol name="chevron.right" size={16} color="#fff" />
                    </>
                  )}
                </Pressable>

                {/* Forgot PIN */}
                {!showForgotPin ? (
                  <Pressable
                    onPress={() => { setShowForgotPin(true); setForgotEmail(email); }}
                    style={{ alignSelf: 'center', marginTop: 14 }}
                  >
                    <Text style={{ color: colors.primary, fontSize: 14 }}>Forgot PIN or PIN expired?</Text>
                  </Pressable>
                ) : (
                  <View style={[styles.forgotBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.fieldLabel, { color: colors.muted, marginBottom: 4 }]}>Enter your email to receive a new PIN</Text>
                    <TextInput
                      style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                      placeholder="your@email.com"
                      placeholderTextColor={colors.muted}
                      value={forgotEmail}
                      onChangeText={setForgotEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <Pressable
                        style={[styles.primaryBtn, { flex: 1, opacity: forgotLoading ? 0.6 : 1 }]}
                        onPress={handleForgotPin}
                        disabled={forgotLoading}
                      >
                        {forgotLoading
                          ? <ActivityIndicator color="#fff" />
                          : <Text style={styles.primaryBtnText}>Send New PIN</Text>}
                      </Pressable>
                      <Pressable
                        style={[styles.secondaryBtn, { flex: 1 }]}
                        onPress={() => setShowForgotPin(false)}
                      >
                        <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* ── Step 2: Profile ── */}
            {step === 'profile' && (
              <View style={styles.section}>
                <Text style={[styles.stepTitle, { color: colors.foreground }]}>Complete Your Profile</Text>
                <Text style={[styles.stepDesc, { color: colors.muted }]}>
                  Tell us a bit about yourself so your site manager can identify you on the platform.
                </Text>

                <View style={styles.nameRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: colors.muted }]}>First Name *</Text>
                    <TextInput
                      style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                      placeholder="John"
                      placeholderTextColor={colors.muted}
                      value={firstName}
                      onChangeText={setFirstName}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: colors.muted }]}>Last Name *</Text>
                    <TextInput
                      style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                      placeholder="Smith"
                      placeholderTextColor={colors.muted}
                      value={lastName}
                      onChangeText={setLastName}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                  </View>
                </View>

                <Text style={[styles.fieldLabel, { color: colors.muted }]}>Mobile Number (optional)</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                  placeholder="+44 7700 900000"
                  placeholderTextColor={colors.muted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  returnKeyType="next"
                />

                <Text style={[styles.fieldLabel, { color: colors.muted }]}>Trade / Specialisation (optional)</Text>
                <Pressable
                  style={[styles.input, styles.picker, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={() => setTradePickerOpen(p => !p)}
                >
                  <Text style={[{ color: trade ? colors.foreground : colors.muted, fontSize: 14 }]}>
                    {trade || 'Select your trade…'}
                  </Text>
                  <IconSymbol name={tradePickerOpen ? 'chevron.up' : 'chevron.down'} size={16} color={colors.muted} />
                </Pressable>
                {tradePickerOpen && (
                  <View style={[styles.tradeList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {TRADE_OPTIONS.map(t => (
                      <Pressable
                        key={t}
                        style={[styles.tradeItem, { borderBottomColor: colors.border }, trade === t && { backgroundColor: '#0a7ea420' }]}
                        onPress={() => { setTrade(t); setTradePickerOpen(false); }}
                      >
                        <Text style={[styles.tradeItemText, { color: trade === t ? '#0a7ea4' : colors.foreground }]}>{t}</Text>
                        {trade === t && <IconSymbol name="checkmark" size={14} color="#0a7ea4" />}
                      </Pressable>
                    ))}
                  </View>
                )}

                <View style={styles.btnRow}>
                  <Pressable style={[styles.secondaryBtn, { borderColor: colors.border }]} onPress={() => setStep('verify')}>
                    <IconSymbol name="chevron.left" size={14} color={colors.muted} />
                    <Text style={[styles.secondaryBtnText, { color: colors.muted }]}>Back</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.primaryBtn, { flex: 1, opacity: loading ? 0.6 : 1 }]}
                    onPress={handleSubmit}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.primaryBtnText}>Activate Account</Text>
                        <IconSymbol name="checkmark.circle.fill" size={16} color="#fff" />
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            )}

            {/* ── Step 3: Success ── */}
            {step === 'success' && (
              <View style={[styles.section, styles.successSection]}>
                <View style={styles.successIcon}>
                  <IconSymbol name="checkmark.seal.fill" size={64} color="#22C55E" />
                </View>
                <Text style={[styles.successTitle, { color: colors.foreground }]}>Welcome aboard!</Text>
                <Text style={[styles.successName, { color: '#1E3A5F' }]}>{welcomeName}</Text>
                <Text style={[styles.stepDesc, { color: colors.muted, textAlign: 'center' }]}>
                  Your account is now active. Sign in with this email address to load your company access and project assignments.
                </Text>

                <View style={[styles.successCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {[
                    { icon: 'person.fill', label: 'Name', value: welcomeName },
                    { icon: 'briefcase.fill', label: 'Role', value: welcomeRole.replace(/\b\w/g, c => c.toUpperCase()) },
                    welcomeProject ? { icon: 'building.2.fill', label: 'Project', value: welcomeProject } : null,
                  ].filter(Boolean).map((item, i) => (
                    <View key={i} style={[styles.successRow, i > 0 && { borderTopWidth: 0.5, borderTopColor: colors.border }]}>
                      <IconSymbol name={(item as any).icon} size={14} color="#0a7ea4" />
                      <Text style={[styles.successLabel, { color: colors.muted }]}>{(item as any).label}</Text>
                      <Text style={[styles.successValue, { color: colors.foreground }]}>{(item as any).value}</Text>
                    </View>
                  ))}
                </View>

                <View style={[styles.tipsCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                  <Text style={[styles.tipsTitle, { color: '#1E40AF' }]}>Getting Started</Text>
                  {[
                    'Tap the Field tab to check in to your site',
                    'Use the HORUS tracker to log your location',
                    'Submit your weekly timesheet from the Timesheets tab',
                    'Report defects and safety incidents directly from site',
                  ].map((tip, i) => (
                    <View key={i} style={styles.tipRow}>
                      <View style={styles.tipDot} />
                      <Text style={[styles.tipText, { color: '#1E40AF' }]}>{tip}</Text>
                    </View>
                  ))}
                </View>

                <Pressable style={styles.primaryBtn} onPress={handleGoToApp}>
                  <Text style={styles.primaryBtnText}>Sign In to Continue</Text>
                  <IconSymbol name="arrow.right.circle.fill" size={18} color="#fff" />
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 20,
    paddingBottom: 28,
    paddingHorizontal: 24,
    gap: 20,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  appName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  appTagline: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepLine: {
    flex: 1,
    height: 2,
    maxWidth: 60,
    marginHorizontal: 4,
  },
  body: {
    flex: 1,
    padding: 24,
  },
  section: {
    gap: 14,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 14,
    lineHeight: 21,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyeBtn: {
    padding: 12,
  },
  primaryBtn: {
    backgroundColor: '#1E3A5F',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  nameRow: {
    flexDirection: 'row',
    gap: 12,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tradeList: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    maxHeight: 220,
  },
  tradeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 0.5,
  },
  tradeItemText: {
    fontSize: 14,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  successSection: {
    alignItems: 'center',
    paddingTop: 16,
  },
  successIcon: {
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
  },
  successName: {
    fontSize: 20,
    fontWeight: '700',
  },
  successCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 4,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  successLabel: {
    fontSize: 12,
    fontWeight: '600',
    width: 55,
  },
  successValue: {
    fontSize: 14,
    flex: 1,
  },
  tipsCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  tipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3B82F6',
    marginTop: 7,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  forgotBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 12,
    borderRadius: 8,
  },
  errorBannerText: {
    color: '#991B1B',
    fontSize: 13,
    lineHeight: 18,
  },
  successBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 12,
    borderRadius: 8,
  },
  successBannerText: {
    color: '#065F46',
    fontSize: 13,
    lineHeight: 18,
  },
});
