import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { colors } from '../theme/colors';
import { sendOtp } from '../api/api';

interface Props {
  onCodeSent: (email: string) => void;
}

export function LoginScreen({ onCodeSent }: Props) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    try {
      await sendOtp(trimmed, i18n.language);
      onCodeSent(trimmed);
    } catch {
      setError(t('login.error_send'));
    } finally {
      setLoading(false);
    }
  };

  const ready = email.trim().length > 3 && email.includes('@');

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" />

      <View style={styles.top}>
        <Text style={styles.wordmark}>rig</Text>
        <Text style={styles.wordmarkAccent}>l</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.label}>{t('login.label')}</Text>
        <Text style={styles.sub}>{t('login.sub')}</Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={(v) => { setEmail(v); setError(''); }}
          placeholder="your@email.com"
          placeholderTextColor="rgba(255,255,255,0.2)"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          onSubmitEditing={handleSubmit}
          returnKeyType="done"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, !ready && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={!ready || loading}
          activeOpacity={0.75}
        >
          <Text style={[styles.btnText, !ready && styles.btnTextDisabled]}>
            {loading ? t('login.btn_loading') : t('login.btn')}
          </Text>
        </TouchableOpacity>
      </View>

      <View />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 48,
  },

  top: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  wordmark: {
    fontSize: 22,
    fontWeight: '300',
    color: colors.ink,
    letterSpacing: 3,
    textTransform: 'lowercase',
  },
  wordmarkAccent: {
    fontSize: 22,
    fontWeight: '300',
    color: colors.accent,
    letterSpacing: 3,
    textTransform: 'lowercase',
  },

  body: {
    gap: 16,
  },
  label: {
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 2.5,
    fontWeight: '600',
    marginBottom: 4,
  },
  sub: {
    fontSize: 15,
    color: colors.muted,
    lineHeight: 22,
    marginBottom: 8,
  },

  input: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 14,
    fontSize: 17,
    color: colors.ink,
    letterSpacing: 0.3,
  },

  error: {
    fontSize: 13,
    color: colors.accent,
    marginTop: -4,
  },

  btn: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 4,
    backgroundColor: colors.ink,
    alignItems: 'center',
  },
  btnDisabled: {
    backgroundColor: colors.line,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.bg,
    letterSpacing: 0.3,
  },
  btnTextDisabled: {
    color: colors.muted,
  },

  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: colors.muted,
    letterSpacing: 0.5,
  },
});
