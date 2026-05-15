import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const ACCENT = '#c0392b';

interface Language {
  code: string;
  flag: string;
}

const LANGUAGES: Language[] = [
  { code: 'ru', flag: '🇷🇺' },
  { code: 'en', flag: '🇬🇧' },
  { code: 'de', flag: '🇩🇪' },
  { code: 'fr', flag: '🇫🇷' },
  { code: 'es', flag: '🇪🇸' },
  { code: 'it', flag: '🇮🇹' },
  { code: 'zh', flag: '🇨🇳' },
  { code: 'ja', flag: '🇯🇵' },
  { code: 'ko', flag: '🇰🇷' },
  { code: 'pt', flag: '🇵🇹' },
  { code: 'ar', flag: '🇸🇦' },
  { code: 'tr', flag: '🇹🇷' },
  { code: 'uk', flag: '🇺🇦' },
  { code: 'pl', flag: '🇵🇱' },
];

type Slot = 'native' | 'target';

interface Props {
  onClose: () => void;
}

export function LanguagePicker({ onClose }: Props) {
  const { t } = useTranslation();
  const [nativeLang, setNativeLang] = useState('ru');
  const [targetLang, setTargetLang] = useState('en');
  const [openSlot, setOpenSlot] = useState<Slot | null>(null);

  const native = LANGUAGES.find(l => l.code === nativeLang)!;
  const target = LANGUAGES.find(l => l.code === targetLang)!;

  const selectLang = (slot: Slot, code: string) => {
    if (slot === 'native') setNativeLang(code);
    else setTargetLang(code);
    setOpenSlot(null);
  };

  return (
    <View style={s.overlay}>
      <TouchableOpacity style={s.backdrop} onPress={onClose} activeOpacity={1} />
      <View style={s.sheet}>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={s.handleArea}>
          <View style={s.handle} />
        </TouchableOpacity>

        <View style={s.header}>
          <Text style={s.title}>{t('langpicker.title')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={s.closeX}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {(['native', 'target'] as Slot[]).map(slot => {
            const lang = slot === 'native' ? native : target;
            const isOpen = openSlot === slot;
            const label = slot === 'native' ? t('langpicker.know') : t('langpicker.learn');
            return (
              <View key={slot} style={s.group}>
                <Text style={s.sectionLabel}>{label}</Text>
                <TouchableOpacity
                  style={[s.dropdown, isOpen && s.dropdownOpen]}
                  onPress={() => setOpenSlot(isOpen ? null : slot)}
                  activeOpacity={0.7}
                >
                  <Text style={s.flag}>{lang.flag}</Text>
                  <Text style={s.langText}>{t(`lang.${lang.code}`)}</Text>
                  <Text style={s.arrow}>{isOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {isOpen && (
                  <View style={s.list}>
                    {LANGUAGES.map(l => {
                      const selected = l.code === (slot === 'native' ? nativeLang : targetLang);
                      return (
                        <TouchableOpacity
                          key={l.code}
                          style={s.listItem}
                          onPress={() => selectLang(slot, l.code)}
                          activeOpacity={0.7}
                        >
                          <Text style={s.flag}>{l.flag}</Text>
                          <Text style={[s.langText, selected && s.textActive]}>{t(`lang.${l.code}`)}</Text>
                          {selected && <Text style={s.checkmark}>✓</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        <TouchableOpacity style={s.doneBtn} onPress={onClose}>
          <Text style={s.doneBtnText}>{t('langpicker.done')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: SCREEN_HEIGHT * 0.75,
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleArea: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  title:  { fontSize: 17, fontWeight: '700', color: '#fff' },
  closeX: { fontSize: 18, color: 'rgba(255,255,255,0.35)' },
  scroll: { padding: 20, paddingBottom: 8 },

  sectionLabel: {
    fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '600',
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10,
  },
  textActive: { color: '#fff', fontWeight: '600' },
  checkmark:  { marginLeft: 'auto', color: ACCENT, fontSize: 14, fontWeight: '700' },

  group:    { marginBottom: 20 },
  dropdown: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  dropdownOpen: { borderColor: ACCENT },
  flag:    { fontSize: 22 },
  langText:{ fontSize: 15, color: 'rgba(255,255,255,0.7)', flex: 1 },
  arrow:   { fontSize: 10, color: 'rgba(255,255,255,0.35)' },
  list: {
    marginTop: 4, borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  listItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },

  doneBtn: {
    margin: 16, backgroundColor: ACCENT, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  doneBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
