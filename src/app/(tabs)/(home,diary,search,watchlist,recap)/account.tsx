import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Text, TextInput } from '@/components/AppText';
import { Mascot, PaperTicket } from '@/components/Mascot';
import { KeyboardSafe } from '@/components/KeyboardSafe';
import { ActionSheet } from '@/components/ActionSheet';
import { DangerButton } from '@/components/DangerButton';
import { SectionLabel } from '@/components/SectionLabel';
import { useToast } from '@/components/Toast';
import { font, fonts, useTheme } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useDiary } from '@/store/DiaryStore';
import { useSync } from '@/sync/SyncProvider';
import type { SyncStatus } from '@/sync/SyncProvider';
import { NO_CONNECTION, isOffline, shownError } from '@/lib/errors';

const errorText = (e: unknown) => shownError(e, 'Something went wrong. Try again.');

export default function AccountScreen() {
  const theme = useTheme();
  const sync = useSync();

  return (
    <KeyboardSafe>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {sync.status === 'unconfigured' ? (
          <Card theme={theme}>
            <MaterialCommunityIcons name="cloud-off-outline" size={32} color={theme.textMuted} />
            <Text style={[styles.h, { color: theme.text }]}>Cloud sync isn’t set up</Text>
            <Text style={[styles.p, { color: theme.textMuted }]}>
              Accounts aren’t available in this version of the app. Your diary is saved on this phone only.
            </Text>
          </Card>
        ) : sync.status === 'signed-out' ? (
          <SignIn theme={theme} />
        ) : (
          <SignedIn theme={theme} />
        )}
      </ScrollView>
    </KeyboardSafe>
  );
}

function Card({ theme, children }: { theme: Theme; children: ReactNode }) {
  return <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>{children}</View>;
}

function Button({
  theme,
  label,
  onPress,
  busy,
  disabled,
  kind = 'primary',
}: {
  theme: Theme;
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  kind?: 'primary' | 'secondary' | 'danger';
}) {
  const bg = kind === 'primary' ? theme.accent : theme.chip;
  const fg = kind === 'primary' ? theme.accentText : kind === 'danger' ? theme.danger : theme.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      style={({ pressed }) => [styles.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[styles.btnText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

const MIN_PASSWORD = 6; // Supabase's default minimum
const RESEND_WAIT_S = 60; // Supabase allows one code email per address per minute

type Mode = 'sign-in' | 'sign-up' | 'confirm' | 'forgot' | 'reset';

const TITLES: Record<Mode, string> = {
  'sign-in': 'Your diary, on every device',
  'sign-up': 'Get your ticket',
  confirm: 'Check your email',
  forgot: 'Lost your ticket?',
  reset: 'Choose a new password',
};

/** Friendlier wording for the auth errors people actually hit. */
function authError(e: unknown) {
  if (isOffline(e)) return NO_CONNECTION;
  const text = errorText(e);
  if (/rate limit|too many|for security purposes/i.test(text)) return 'Too many emails in a short time. Wait a minute and try again.';
  if (/expired|invalid.*(otp|token)|token.*(invalid|expired)/i.test(text)) return "That code didn't work or has expired. Check it, or send a new one.";
  if (/invalid login credentials/i.test(text)) return 'Wrong email or password.';
  if (/email not confirmed/i.test(text)) return 'Confirm your email first: enter the code we sent you.';
  return text;
}

/** Whole seconds until `at`, ticking every second; null when nothing is planned. */
function useSecondsUntil(at: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (at === null) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0); // catch up straight away when a new time is planned
    const every = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, [at]);
  return at === null ? null : Math.max(0, Math.ceil((at - now) / 1000));
}

/** What the mascot says on her ticket, by step (the website's lines). */
const REEL_SAYS: Record<Mode, string> = {
  'sign-in': 'Welcome back!',
  'sign-up': 'Grab a seat!',
  confirm: 'Check your inbox!',
  forgot: 'Happens to us all.',
  reset: 'A fresh start!',
};

function SignIn({ theme }: { theme: Theme }) {
  const { signIn, signUp, confirmSignUp, resendSignUpCode, sendPasswordReset, resetPassword } = useSync();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const resendIn = useSecondsUntil(resendAt > 0 ? resendAt : null) ?? 0;
  // A quarter of the screen's height, 150 to 190, so the form still starts in view on a small phone.
  const mascot = Math.round(Math.min(190, Math.max(150, useWindowDimensions().height * 0.25)));

  const go = (next: Mode, message: string | null = null) => {
    setMode(next);
    setError(null);
    setNotice(message);
    if (next === 'confirm' || next === 'reset') setCode('');
  };

  const emailOk = email.includes('@');
  const codeOk = /^\d{6,8}$/.test(code.trim());
  const valid =
    mode === 'sign-in' || mode === 'sign-up'
      ? emailOk && password.length >= MIN_PASSWORD
      : mode === 'forgot'
        ? emailOk
        : mode === 'confirm'
          ? codeOk
          : codeOk && password.length >= MIN_PASSWORD;

  const run = async (fn: () => Promise<void>) => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(authError(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = () =>
    run(async () => {
      if (mode === 'sign-in') await signIn(email, password);
      else if (mode === 'sign-up') {
        if (!(await signUp(email, password))) {
          setResendAt(Date.now() + RESEND_WAIT_S * 1000);
          go('confirm', `We emailed a 6-digit code to ${email.trim()}. Enter it to finish creating your account.`);
        }
      } else if (mode === 'confirm') await confirmSignUp(email, code);
      else if (mode === 'forgot') {
        await sendPasswordReset(email);
        setResendAt(Date.now() + RESEND_WAIT_S * 1000);
        setPassword('');
        go('reset', `If an account exists for ${email.trim()}, we've emailed it a 6-digit code.`);
      } else await resetPassword(email, code, password);
    });

  const resend = async () => {
    if (busy || resendIn > 0) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'confirm') await resendSignUpCode(email);
      else await sendPasswordReset(email);
      setResendAt(Date.now() + RESEND_WAIT_S * 1000);
      setNotice(`New code sent to ${email.trim()}.`);
    } catch (e) {
      setError(authError(e));
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.bg, borderColor: theme.border }];
  const needsEmail = mode === 'sign-in' || mode === 'sign-up' || mode === 'forgot';
  const needsPassword = mode === 'sign-in' || mode === 'sign-up' || mode === 'reset';
  const needsCode = mode === 'confirm' || mode === 'reset';
  const newPassword = mode === 'sign-up' || mode === 'reset';
  const label: Record<Mode, string> = {
    'sign-in': 'Sign in',
    'sign-up': 'Create account',
    confirm: 'Confirm email',
    forgot: 'Send code',
    reset: 'Set new password',
  };

  return (
    <Card theme={theme}>
      {/* The mascot waves hello, and has an oops moment at an error. */}
      <View style={styles.reelRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Mascot pose={error ? 'oops' : 'hello'} height={mascot} />
        <PaperTicket text={error ? 'Hmm, try again?' : REEL_SAYS[mode]} hole={theme.card} size={10} tilt={-5} style={styles.reelTicket} />
      </View>
      <Text style={[styles.h, { color: theme.text }]}>{TITLES[mode]}</Text>
      <Text style={[styles.p, { color: theme.textMuted }]}>
        {mode === 'forgot'
          ? "Enter your account's email and we'll send you a code to choose a new password."
          : mode === 'confirm' || mode === 'reset'
            ? `Enter the code from the email we sent to ${email.trim()}.`
            : 'Sign in to back up your diary and watchlist, and keep them in sync across your phones and tablets. Free, and your data is only yours.'}
      </Text>

      {needsEmail && (
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={theme.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          autoCorrect={false}
          onSubmitEditing={mode === 'forgot' ? submit : undefined}
          style={inputStyle}
        />
      )}
      {needsCode && (
        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 8))}
          placeholder="6-digit code"
          placeholderTextColor={theme.textMuted}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          accessibilityLabel="Code from the email"
          onSubmitEditing={mode === 'confirm' ? submit : undefined}
          style={[inputStyle, code ? [styles.code, { color: theme.accent }] : styles.codeEmpty]}
        />
      )}
      {needsPassword && (
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={newPassword ? `${mode === 'reset' ? 'New password' : 'Password'} (at least ${MIN_PASSWORD} characters)` : 'Password'}
          placeholderTextColor={theme.textMuted}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={newPassword ? 'new-password' : 'current-password'}
          textContentType={newPassword ? 'newPassword' : 'password'}
          onSubmitEditing={submit}
          style={inputStyle}
        />
      )}
      <Button theme={theme} label={label[mode]} busy={busy} disabled={!valid} onPress={submit} />

      {error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}
      {notice && <Text style={[styles.p, { color: theme.text }]}>{notice}</Text>}

      {mode === 'sign-in' && (
        <Pressable onPress={() => go('forgot')} accessibilityRole="button">
          <Text style={[styles.switch, { color: theme.accent }]}>Forgot password?</Text>
        </Pressable>
      )}
      {needsCode && (
        <Pressable onPress={resend} disabled={resendIn > 0 || busy} accessibilityRole="button">
          <Text style={[styles.switch, { color: resendIn > 0 ? theme.textMuted : theme.accent }]}>
            {resendIn > 0 ? `Resend code in ${resendIn} s` : 'Resend code'}
          </Text>
        </Pressable>
      )}
      <Pressable onPress={() => go(mode === 'sign-in' ? 'sign-up' : 'sign-in')} accessibilityRole="button">
        <Text style={[styles.switch, { color: theme.textMuted }]}>
          {mode === 'sign-in' ? 'New here? ' : mode === 'sign-up' ? 'Already have an account? ' : ''}
          <Text style={{ color: theme.accent }}>{mode === 'sign-in' ? 'Create an account' : mode === 'sign-up' ? 'Sign in' : 'Back to sign in'}</Text>
        </Text>
      </Pressable>
    </Card>
  );
}

const STATUS: Record<SyncStatus, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  unconfigured: { icon: 'cloud-offline-outline', label: 'Not set up' },
  'signed-out': { icon: 'cloud-offline-outline', label: 'Signed out' },
  idle: { icon: 'cloud-outline', label: 'Waiting to sync' },
  syncing: { icon: 'sync', label: 'Syncing…' },
  waiting: { icon: 'time-outline', label: 'Changes waiting to sync' },
  synced: { icon: 'cloud-done-outline', label: 'Up to date' },
  error: { icon: 'cloud-offline-outline', label: "Couldn't sync, retrying soon" },
};

function SignedIn({ theme }: { theme: Theme }) {
  const toast = useToast();
  const { status, email, lastSyncedAt, unsentCount, nextSyncAt, error, syncNow, signOut, deleteAccount } = useSync();
  const { entries, watchlist } = useDiary();
  const secondsLeft = useSecondsUntil(status === 'waiting' ? nextSyncAt : null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<'sign-out' | 'delete' | null>(null);
  const s = STATUS[status];

  const act = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast(done);
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card theme={theme}>
        <SectionLabel theme={theme}>Signed in as</SectionLabel>
        <Text style={[styles.email, { color: theme.text }]}>{email}</Text>
        <Text style={[styles.p, { color: theme.textMuted }]}>
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'} and {watchlist.length} on the watchlist, kept in your account.
        </Text>
      </Card>

      <Card theme={theme}>
        <View style={styles.statusRow}>
          <Ionicons name={s.icon} size={22} color={status === 'error' ? theme.danger : theme.accent} />
          <Text style={[styles.statusText, { color: theme.text }]}>{s.label}</Text>
        </View>
        <Text style={[styles.p, { color: theme.textMuted }]}>
          {lastSyncedAt ? `Last synced ${new Date(lastSyncedAt).toLocaleTimeString()}` : 'Not synced yet this session'}
          {unsentCount > 0 ? `, ${unsentCount} change${unsentCount === 1 ? '' : 's'} waiting` : ''}
        </Text>
        {status === 'waiting' && (
          <Text style={[styles.p, { color: theme.textMuted }]}>
            {secondsLeft ? `Syncs in ${secondsLeft} s.` : 'Syncing soon.'}
          </Text>
        )}
        {status === 'error' && error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}
        <Button theme={theme} kind="secondary" label="Sync now" busy={status === 'syncing'} onPress={() => void syncNow()} />
      </Card>

      <Button theme={theme} kind="secondary" label="Sign out" busy={busy && sheet === null} onPress={() => setSheet('sign-out')} />
      {sheet === 'delete' ? (
        <DeleteAccount theme={theme} onClose={() => setSheet(null)} onDelete={deleteAccount} />
      ) : (
        <DangerButton theme={theme} label="Delete account" icon="person-remove-outline" onPress={() => setSheet('delete')} style={{ marginTop: 8 }} />
      )}

      <ActionSheet
        visible={sheet === 'sign-out'}
        title="Your account keeps your diary and profile either way. Sign in again any time to get them back."
        onClose={() => setSheet(null)}
        actions={[
          { label: 'Sign out, keep my diary on this phone', icon: 'log-out-outline', onPress: () => void act(() => signOut(false), 'Signed out') },
          {
            label: 'Sign out and remove my diary and profile from this phone',
            icon: 'trash-outline',
            destructive: true,
            onPress: () => void act(() => signOut(true), 'Signed out; your diary and profile are removed from this phone'),
          },
        ]}
      />
    </>
  );
}

/** Deleting the account asks for its password first, like the website. */
function DeleteAccount({ theme, onClose, onDelete }: { theme: Theme; onClose: () => void; onDelete: (password: string) => Promise<void> }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete(password);
      toast('Account deleted');
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Card theme={theme}>
      <Text style={[styles.h, { color: theme.text }]}>Delete your account?</Text>
      <Text style={[styles.p, { color: theme.textMuted }]}>
        Everything in it goes from the cloud. Your diary stays on this phone, but your other devices stop syncing. This can’t be undone.
      </Text>
      <TextInput
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          setError(null);
        }}
        placeholder="Your password"
        placeholderTextColor={theme.textMuted}
        secureTextEntry
        autoFocus
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={() => void submit()}
        accessibilityLabel="Your password"
        style={[styles.input, { color: theme.text, backgroundColor: theme.bg, borderColor: error ? theme.danger : theme.border }]}
      />
      {error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}
      <Button theme={theme} kind="danger" label="Delete my account" busy={busy} disabled={!password} onPress={() => void submit()} />
      <Button theme={theme} kind="secondary" label="Cancel" disabled={busy} onPress={onClose} />
    </Card>
  );
}

const styles = StyleSheet.create({
  reelRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  // A long line shrinks rather than pushing past the card on a narrow phone.
  reelTicket: { flexShrink: 1 },
  content: { padding: 16, gap: 12 },
  card: { padding: 18, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, gap: 12 },
  h: { fontFamily: fonts.uiBold, fontSize: font.title2 },
  p: { fontFamily: fonts.ui, fontSize: font.footnote, lineHeight: 19 },
  email: { fontSize: font.headline, fontWeight: '800' },
  input: { fontSize: font.headline, minHeight: 50, borderRadius: 10, borderWidth: 1, paddingHorizontal: 16 },
  code: { fontFamily: fonts.uiSemibold, fontSize: font.title2, textAlign: 'center' },
  codeEmpty: { textAlign: 'center' },
  switch: { fontFamily: fonts.uiSemibold, fontSize: font.footnote, textAlign: 'center', paddingVertical: 4 },
  btn: { height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: fonts.uiSemibold, fontSize: font.body },
  error: { fontFamily: fonts.ui, fontSize: font.footnote },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusText: { fontSize: font.headline, fontWeight: '700' },
});
