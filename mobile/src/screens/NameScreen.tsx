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
import { colors } from '../theme/colors';
import { setName } from '../api/api';

interface Props {
  token: string;
  onDone: () => void;
}

export function NameScreen({ token, onDone }: Props) {
  const { t } = useTranslation();
  const [name, setNameVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    try {
      await setName(token, trimmed);
      onDone();
    } catch {
      setError(t('name.error_save'));
    } finally {
      setLoading(false);
    }
  };

  const ready = name.trim().length > 0;

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
        <Text style={styles.label}>{t('name.label')}</Text>
        <Text style={styles.sub}>{t('name.sub')}</Text>

        <TextInput
          style={styles.input}
          value={name}
          onChangeText={(v) => { setNameVal(v); setError(''); }}
          placeholder="Имя"
          placeholderTextColor={colors.line}
          autoCapitalize="words"
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
            {loading ? t('name.btn_loading') : t('name.btn')}
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
});
