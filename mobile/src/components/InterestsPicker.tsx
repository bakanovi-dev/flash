import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { getCatalogDomains, getUserDomains, updateUserDomains, DomainItem } from '../api/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const ACCENT = '#c0392b';

const DOMAIN_EMOJI: Record<string, string> = {
  adult:         '🔞',
  arts:          '🎨',
  business:      '💼',
  entertainment: '🎬',
  law:           '⚖️',
  lifestyle:     '🌿',
  personal:      '💬',
  science:       '🔬',
  society:       '🏛️',
  sports:        '⚽',
};


interface Props {
  onClose: () => void;
  onSaved?: () => void;
}

export function InterestsPicker({ onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<DomainItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selDomains, setSelDomains] = useState<Set<string>>(new Set());
  const [selSubs, setSelSubs] = useState<Map<string, Set<string>>>(new Map());
  const initialDomainsRef = React.useRef<string>('');

  useEffect(() => {
    Promise.all([getCatalogDomains(), getUserDomains()])
      .then(([catalogRes, userRes]) => {
        setCatalog(catalogRes.domains);
        const domains = new Set<string>();
        const subs = new Map<string, Set<string>>();
        for (const saved of userRes.domains) {
          const dotIdx = saved.indexOf('.');
          if (dotIdx !== -1) {
            const domainName = saved.substring(0, dotIdx);
            domains.add(domainName);
            const set = subs.get(domainName) ?? new Set<string>();
            set.add(saved);
            subs.set(domainName, set);
          } else {
            domains.add(saved);
          }
        }
        initialDomainsRef.current = [...userRes.domains].sort().join(',');
        setSelDomains(domains);
        setSelSubs(subs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleDomain = (name: string) => {
    setSelDomains(prev => {
      const s = new Set(prev);
      s.has(name) ? s.delete(name) : s.add(name);
      return s;
    });
  };

  const toggleSub = (domainName: string, fullName: string) => {
    setSelSubs(prev => {
      const next = new Map(prev);
      const subs = new Set(next.get(domainName) ?? []);
      subs.has(fullName) ? subs.delete(fullName) : subs.add(fullName);
      next.set(domainName, subs);
      return next;
    });
  };

  const handleClose = async () => {
    setSaving(true);
    const domainsToSave: string[] = [];
    for (const domainName of selDomains) {
      const subsForDomain = selSubs.get(domainName);
      if (!subsForDomain || subsForDomain.size === 0) {
        domainsToSave.push(domainName);
      } else {
        domainsToSave.push(...Array.from(subsForDomain));
      }
    }
    const newStr = [...domainsToSave].sort().join(',');
    try {
      await updateUserDomains(domainsToSave);
      if (newStr !== initialDomainsRef.current) {
        onSaved?.();
      }
    } catch {}
    setSaving(false);
    onClose();
  };

  const selectedDomains = catalog.filter(d => selDomains.has(d.name));

  return (
    <View style={s.overlay}>
      <TouchableOpacity style={s.backdrop} onPress={handleClose} activeOpacity={1} />

      <View style={s.sheet}>
        <TouchableOpacity onPress={handleClose} activeOpacity={0.7} style={s.handleArea}>
          <View style={s.handle} />
        </TouchableOpacity>

        <View style={s.header}>
          <Text style={s.title}>{t('interests.title')}</Text>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={s.closeX}>✕</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.loadingContainer}>
            <ActivityIndicator color={ACCENT} />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scroll}
          >
            {/* ── Domain tiles ── */}
            <View style={s.grid}>
              {catalog.map(d => {
                const on = selDomains.has(d.name);
                return (
                  <TouchableOpacity
                    key={d.name}
                    style={[s.tile, on && s.tileOn]}
                    onPress={() => toggleDomain(d.name)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.tileEmoji}>{DOMAIN_EMOJI[d.name] ?? '📁'}</Text>
                    <Text style={[s.tileName, on && s.tileNameOn]}>
                      {t(`domain.${d.name}`)}
                    </Text>
                    {on && (
                      <View style={s.tileBadge}>
                        <Text style={s.tileBadgeMark}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Subdomains for selected domains ── */}
            {selectedDomains.length > 0 && (
              <View style={s.subsSection}>
                <Text style={s.subsHeader}>{t('interests.refine')}</Text>

                {selectedDomains.map(d => {
                  const domainSubs = selSubs.get(d.name) ?? new Set<string>();
                  return (
                    <View key={d.name} style={s.subGroup}>
                      <Text style={s.subGroupLabel}>
                        {DOMAIN_EMOJI[d.name] ?? '📁'} {t(`domain.${d.name}`)}
                      </Text>
                      <View style={s.chipRow}>
                        {d.subdomains.map(sub => {
                          const active = domainSubs.has(sub.full_name);
                          const label = t(`sub.${sub.full_name}`, { defaultValue: sub.name });
                          return (
                            <TouchableOpacity
                              key={sub.full_name}
                              style={[s.chip, active && s.chipOn]}
                              onPress={() => toggleSub(d.name, sub.full_name)}
                              activeOpacity={0.7}
                            >
                              <Text style={[s.chipText, active && s.chipTextOn]}>
                                {label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}

        {saving && (
          <View style={s.savingOverlay}>
            <ActivityIndicator color={ACCENT} />
          </View>
        )}
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
    height: SCREEN_HEIGHT * 0.78,
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleArea: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  title:  { fontSize: 17, fontWeight: '700', color: '#fff' },
  closeX: { fontSize: 18, color: 'rgba(255,255,255,0.35)' },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  scroll: { padding: 16, paddingBottom: 8 },

  // ── Domain tile grid ──────────────────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  tile: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  tileOn: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(192,57,43,0.12)',
  },
  tileEmoji: { fontSize: 24, marginBottom: 6 },
  tileName:  { fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: '600' },
  tileNameOn: { color: '#fff' },
  tileBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center',
  },
  tileBadgeMark: { fontSize: 10, color: '#fff', fontWeight: '800' },

  // ── Subdomains section ────────────────────────────────────────────────────
  subsSection: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 16,
  },
  subsHeader: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  subGroup:      { marginBottom: 16 },
  subGroupLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'transparent',
  },
  chipOn: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  chipText:   { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  chipTextOn: { color: '#fff', fontWeight: '600' },

  savingOverlay: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
  },
});
