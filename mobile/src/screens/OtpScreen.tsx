import React, { useState, useRef } from 'react';
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
import { colors } from '../theme/colors';
import { verifyOtp } from '../api/api';

interface Props {
  email: string;
  onSuccess: (token: string, isNewUser: boolean) => void;
  onBack: () => void;
}

export function OtpScreen({ email, onSuccess, onBack }: Props) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<TextInput>(null);

  const handleChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    setError('');
    if (digits.length === 6) handleSubmit(digits);
  };

  const handleSubmit = async (c = code) => {
    if (c.length < 6) return;
    setLoading(true);
    setError('');
    try {
      const data = await verifyOtp(email, c);
      onSuccess(data.token, data.is_new_user);
    } catch (e: any) {
      setError(e?.message || t('otp.error_fallback'));
      setCode('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

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
        <Text style={styles.label}>{t('otp.label')}</Text>
        <Text style={styles.sub}>
          {t('otp.sub')}{' '}
          <Text style={styles.emailHighlight}>{email}</Text>
        </Text>

        <TextInput
          ref={inputRef}
          style={styles.input}
          value={code}
          onChangeText={handleChange}
          placeholder="000000"
          placeholderTextColor={colors.line}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, (code.length < 6 || loading) && styles.btnDisabled]}
          onPress={() => handleSubmit()}
          disabled={code.length < 6 || loading}
          activeOpacity={0.75}
        >
          <Text style={[styles.btnText, (code.length < 6 || loading) && styles.btnTextDisabled]}>
            {loading ? t('otp.btn_loading') : t('otp.btn')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>{t('otp.back')}</Text>
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
  },
  wordmarkAccent: {
    fontSize: 22,
    fontWeight: '300',
    color: colors.accent,
    letterSpacing: 3,
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
  emailHighlight: {
    color: colors.ink,
    fontWeight: '500',
  },

  input: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 14,
    fontSize: 28,
    color: colors.ink,
    letterSpacing: 8,
    fontWeight: '300',
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

  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  backText: {
    fontSize: 14,
    color: colors.muted,
  },
});
