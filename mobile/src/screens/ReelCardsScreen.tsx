import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';

import {
  ReelCard,
  getFeed,
  getFeedState,
  savePosition,
  toggleLike,
  toggleSave,
  getSavesCount,
  postEvent,
  logoutApi,
  getUserLevels,
  updateUserLevels,
} from '../api/api';
import { useTranslation } from 'react-i18next';
import { QuoteCardFaces } from '../components/QuoteCardFaces';
import { InterestsPicker } from '../components/InterestsPicker';
import { LanguagePicker } from '../components/LanguagePicker';

const LANG_FLAGS: Record<string, string> = { ru: '🇷🇺', fr: '🇫🇷', de: '🇩🇪', it: '🇮🇹', zh: '🇨🇳' };
import { colors } from '../theme/colors';

const BATCH_SIZE = 15;
const PRELOAD_AT = 5;
const MENU_WIDTH = 280;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  token?: string;
  userName?: string | null;
  lang?: string;
  onLangChange?: (lang: string) => void;
  onLogout?: () => void;
  onNavigateSaved?: () => void;
}

export function ReelCardsScreen({ token, userName, lang = 'ru', onLangChange, onLogout, onNavigateSaved }: Props) {
  const { t } = useTranslation();
  const [deck, setDeck] = useState<ReelCard[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [likes, setLikes] = useState<Set<string>>(new Set());
  const [saves, setSaves] = useState<Set<string>>(new Set());
  const [dislikes, setDislikes] = useState<Set<string>>(new Set());
  const [savesCount, setSavesCount] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showInterests, setShowInterests] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [cefrLevels, setCefrLevels] = useState<string[]>([]);
  const [pendingIdx, setPendingIdx] = useState<number | null>(null);
  const [enterDir, setEnterDir] = useState<'up' | 'down' | null>(null);

  const deckRef = useRef<ReelCard[]>([]);
  const indexRef = useRef(0);
  const resumeRef = useRef(false);
  const langRef = useRef(lang);
  langRef.current = lang;
  const hasMoreRef = useRef(true);
  const fetchingRef = useRef(false);
  const transRef = useRef(false);
  const wasFlippedRef = useRef(false);
  const menuOpenRef = useRef(false);
  const flippedRef = useRef(false);
  const suppressFlipRef = useRef(false);

  deckRef.current = deck;
  indexRef.current = index;
  menuOpenRef.current = menuOpen;
  flippedRef.current = flipped;

  const cardY = useSharedValue(0);
  const pendingCardY = useSharedValue(0);
  const menuX = useSharedValue(MENU_WIDTH);

  // ── Menu animation ────────────────────────────────────────────────────────

  useEffect(() => {
    if (menuOpen) {
      levelsAtOpenRef.current = cefrLevels;
    } else {
      const changed =
        levelsAtOpenRef.current.length !== cefrLevels.length ||
        levelsAtOpenRef.current.some((l, i) => cefrLevels[i] !== l);
      if (changed) {
        resumeRef.current = false;
        hasMoreRef.current = true;
        deckRef.current = [];
        setDeck([]);
        setIndex(0);
        setFlipped(false);
        fetchBatch();
      }
    }
  }, [menuOpen]);

  useEffect(() => {
    menuX.value = withTiming(menuOpen ? 0 : MENU_WIDTH, {
      duration: 320,
      easing: Easing.bezier(0.25, 0.7, 0.3, 1),
    });
  }, [menuOpen]);

  const menuAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: menuX.value }],
  }));

  const contentAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: menuX.value - MENU_WIDTH }],
  }));

  // ── Feed loading ─────────────────────────────────────────────────────────

  const fetchBatch = useCallback(() => {
    if (fetchingRef.current) return;
    if (!hasMoreRef.current && deckRef.current.length > 0) return;
    fetchingRef.current = true;
    setLoading(true);

    getFeed({
      resume: resumeRef.current,
      limit: BATCH_SIZE,
      lang: langRef.current,
    })
      .then((data) => {
        fetchingRef.current = false;
        setLoading(false);
        resumeRef.current = false;
        hasMoreRef.current = data.has_more;

        if (data.items.length > 0) {
          setSaves((prev) => {
            const s = new Set(prev);
            data.items.forEach((c) => { if (c.saved) s.add(c.id); });
            return s;
          });
          setLikes((prev) => {
            const s = new Set(prev);
            data.items.forEach((c) => { if (c.liked) s.add(c.id); });
            return s;
          });
          setDeck((prev) => {
            const seen = new Set(prev.map((c) => c.id));
            const updated = [...prev, ...data.items.filter((c) => !seen.has(c.id))];
            deckRef.current = updated;
            return updated;
          });
        }
      })
      .catch(() => {
        fetchingRef.current = false;
        setLoading(false);
      });
  }, []);

  const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  const levelsAtOpenRef = useRef<string[]>([]);

  const handleLevelTap = (level: string) => {
    const idx = CEFR.indexOf(level);
    const indices = cefrLevels.map(l => CEFR.indexOf(l)).sort((a, b) => a - b);
    let next: string[];
    if (cefrLevels.includes(level)) {
      if (cefrLevels.length === 1) return;
      if (idx === indices[0] || idx === indices[indices.length - 1]) {
        next = cefrLevels.filter(l => l !== level);
      } else {
        return;
      }
    } else {
      const minIdx = indices.length ? Math.min(idx, indices[0]) : idx;
      const maxIdx = indices.length ? Math.max(idx, indices[indices.length - 1]) : idx;
      next = CEFR.slice(minIdx, maxIdx + 1);
    }
    setCefrLevels(next);
    updateUserLevels(next).catch(() => {});
  };

  useEffect(() => {
    getSavesCount().then((data) => setSavesCount(data.count)).catch(() => {});
    getUserLevels().then((data) => setCefrLevels(data.levels)).catch(() => {});
    getFeedState()
      .then((data) => {
        if (data.cursor !== null) {
          resumeRef.current = true;
        }
      })
      .catch(() => {})
      .finally(() => fetchBatch());
  }, []);

  useEffect(() => {
    if (deck.length > 0 && deck.length - index <= PRELOAD_AT) {
      fetchBatch();
    }
  }, [index, deck.length]);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    resumeRef.current = false;
    hasMoreRef.current = true;
    deckRef.current = [];
    setDeck([]);
    setIndex(0);
    setFlipped(false);
    fetchBatch();
  }, [lang]);

  // ── Navigation ───────────────────────────────────────────────────────────

  const completeNavigation = useCallback((nextIdx: number) => {
    cardY.value = 0;
    pendingCardY.value = 0;
    setIndex(nextIdx);
    setFlipped(false);
    setPendingIdx(null);
    setEnterDir(null);
    wasFlippedRef.current = false;
    transRef.current = false;

    const nextCard = deckRef.current[nextIdx];
    if (nextCard) savePosition(nextCard.rand).catch(() => {});
  }, []);

  const doNavigate = useCallback((dir: 'up' | 'down') => {
    if (transRef.current || menuOpenRef.current) return;

    setFlipped(false);
    flippedRef.current = false;

    const curIdx = indexRef.current;
    const nextIdx = curIdx + (dir === 'up' ? 1 : -1);

    if (nextIdx < 0 || nextIdx >= deckRef.current.length) {
      if (nextIdx >= deckRef.current.length) {
        const cur = deckRef.current[curIdx];
        if (cur) {
          const loadMore = () => {
            hasMoreRef.current = true;
            deckRef.current = [];
            setDeck([]);
            setIndex(0);
            setFlipped(false);
            fetchBatch();
          };
          if (!wasFlippedRef.current) {
            postEvent(cur.id, 'skip').then(loadMore).catch(loadMore);
          } else {
            loadMore();
          }
        }
      }
      cardY.value = withSpring(0);
      return;
    }

    if (dir === 'up' && !wasFlippedRef.current) {
      const cur = deckRef.current[curIdx];
      if (cur) postEvent(cur.id, 'skip').catch(() => {});
    }

    transRef.current = true;
    const exitY = dir === 'up' ? -SCREEN_HEIGHT * 1.1 : SCREEN_HEIGHT * 1.1;
    const enterFromY = dir === 'up' ? SCREEN_HEIGHT * 1.1 : -SCREEN_HEIGHT * 1.1;

    setPendingIdx(nextIdx);
    setEnterDir(dir);
    pendingCardY.value = enterFromY;

    const timing = { duration: 340, easing: Easing.bezier(0.25, 0.7, 0.3, 1) };
    cardY.value = withTiming(exitY, timing);
    pendingCardY.value = withTiming(0, timing, (finished) => {
      if (finished) runOnJS(completeNavigation)(nextIdx);
    });
  }, [completeNavigation]);

  // ── Flip ─────────────────────────────────────────────────────────────────

  const doFlip = useCallback(() => {
    if (suppressFlipRef.current) {
      suppressFlipRef.current = false;
      return;
    }
    if (menuOpenRef.current) {
      setMenuOpen(false);
      return;
    }
    const next = !flippedRef.current;
    setFlipped(next);
    if (next && !wasFlippedRef.current) {
      wasFlippedRef.current = true;
      const cur = deckRef.current[indexRef.current];
      if (cur) {
        postEvent(cur.id, 'flip').catch(() => {});
        savePosition(cur.rand).catch(() => {});
      }
    }
  }, []);

  // ── Gesture ───────────────────────────────────────────────────────────────

  const tapGesture = Gesture.Tap()
    .maxDeltaX(5)
    .maxDeltaY(5)
    .onEnd(() => {
      runOnJS(doFlip)();
    });

  const panGesture = Gesture.Pan()
    .enabled(!flipped)
    .minDistance(10)
    .onUpdate((e) => {
      if (transRef.current) return;
      cardY.value = e.translationY;
    })
    .onEnd((e) => {
      if (transRef.current) return;
      const dy = e.translationY;
      const vy = e.velocityY;
      const fast = Math.abs(vy) > 500 && Math.abs(dy) > 30;
      if (dy < -80 || (fast && vy < 0)) runOnJS(doNavigate)('up');
      else if (dy > 80 || (fast && vy > 0)) runOnJS(doNavigate)('down');
      else cardY.value = withSpring(0);
    });

  const gesture = Gesture.Simultaneous(tapGesture, panGesture);

  // ── Actions ───────────────────────────────────────────────────────────────

  const card = deck[index];
  const cardId = card?.id ?? '';
  const isLiked = likes.has(cardId);
  const isSaved = saves.has(cardId);
  const isDisliked = dislikes.has(cardId);

  const handleLike = () => {
    if (!card) return;
    const was = isLiked;
    setLikes((prev) => {
      const s = new Set(prev);
      was ? s.delete(cardId) : s.add(cardId);
      return s;
    });
    if (!was) setDislikes((prev) => { const s = new Set(prev); s.delete(cardId); return s; });
    toggleLike(cardId)
      .then((data) =>
        setLikes((prev) => {
          const s = new Set(prev);
          data.liked ? s.add(cardId) : s.delete(cardId);
          return s;
        }),
      )
      .catch(() =>
        setLikes((prev) => {
          const s = new Set(prev);
          was ? s.add(cardId) : s.delete(cardId);
          return s;
        }),
      );
  };

  const handleSave = () => {
    if (!card) return;
    const was = isSaved;
    setSaves((prev) => {
      const s = new Set(prev);
      was ? s.delete(cardId) : s.add(cardId);
      return s;
    });
    toggleSave(cardId)
      .then((data) => {
        setSaves((prev) => {
          const s = new Set(prev);
          data.saved ? s.add(cardId) : s.delete(cardId);
          return s;
        });
        setSavesCount((prev) => (prev ?? 0) + (data.saved ? 1 : -1));
      })
      .catch(() =>
        setSaves((prev) => {
          const s = new Set(prev);
          was ? s.add(cardId) : s.delete(cardId);
          return s;
        }),
      );
  };

  const handleLogout = () => {
    if (token) logoutApi(token).catch(() => {});
    onLogout?.();
  };

  const handleDislike = () => {
    if (!card) return;
    setDislikes((prev) => {
      const s = new Set(prev);
      if (s.has(cardId)) {
        s.delete(cardId);
      } else {
        s.add(cardId);
        postEvent(cardId, 'dislike').catch(() => {});
        setLikes((l) => { const nl = new Set(l); nl.delete(cardId); return nl; });
      }
      return s;
    });
  };

  // ── Animated styles ───────────────────────────────────────────────────────

  const currentCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardY.value }],
  }));

  const pendingCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pendingCardY.value }],
  }));

  // ── Render ────────────────────────────────────────────────────────────────

  if (!card) {
    return (
      <View style={styles.emptyContainer}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.center}>
          {loading ? (
            <ActivityIndicator color={colors.muted} />
          ) : (
            <>
              <Text style={styles.emptyText}>{t('feed.empty')}</Text>
              <Text style={styles.emptyHint}>{t('feed.empty.hint')}</Text>
              <TouchableOpacity style={styles.emptyAction} onPress={() => setShowInterests(true)}>
                <Text style={styles.emptyActionText}>{t('feed.empty.action')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        {showInterests && (
          <InterestsPicker
            onClose={() => setShowInterests(false)}
            onSaved={() => {
              setShowInterests(false);
              resumeRef.current = false;
              hasMoreRef.current = true;
              deckRef.current = [];
              setDeck([]);
              setIndex(0);
              setFlipped(false);
              fetchBatch();
            }}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Shifted content: cards + action buttons */}
      <Animated.View style={[{ flex: 1 }, contentAnimStyle]}>
        <GestureDetector gesture={gesture}>
          <View style={styles.scene}>
            <Animated.View style={[StyleSheet.absoluteFillObject, currentCardStyle, pendingIdx !== null && { opacity: 0 }]}>
              <QuoteCardFaces key={card.id} card={card} flipped={flipped} onSpeakPressIn={() => { suppressFlipRef.current = true; }} />
            </Animated.View>
            {pendingIdx !== null && deck[pendingIdx] && (
              <Animated.View style={[StyleSheet.absoluteFillObject, pendingCardStyle]}>
                <QuoteCardFaces card={deck[pendingIdx]} flipped={false} />
              </Animated.View>
            )}
          </View>
        </GestureDetector>

        {/* Action buttons — only on front face */}
        <View style={[styles.actions, { opacity: flipped ? 0 : 1 }]} pointerEvents={flipped ? 'none' : 'box-none'}>
          <TouchableOpacity
            style={[styles.actionBtn, isSaved && styles.actionBtnSaved]}
            onPress={handleSave}
          >
            <Svg width="22" height="22" viewBox="0 0 24 24"
              fill={isSaved ? colors.white : 'none'}
              stroke={colors.white}
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </Svg>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, isLiked && styles.actionBtnLiked]}
            onPress={handleLike}
          >
            <Svg width="22" height="22" viewBox="0 0 24 24"
              fill={isLiked ? colors.white : 'none'}
              stroke={colors.white}
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
              <Path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </Svg>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, isDisliked && styles.actionBtnDisliked]}
            onPress={handleDislike}
          >
            <Svg width="22" height="22" viewBox="0 0 24 24"
              fill={isDisliked ? colors.white : 'none'}
              stroke={colors.white}
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
              <Path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
            </Svg>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Menu backdrop */}
      {menuOpen && (
        <TouchableOpacity
          style={styles.menuBackdrop}
          onPress={() => setMenuOpen(false)}
          activeOpacity={1}
        />
      )}

      {/* Slide-in menu from right */}
      <Animated.View
        style={[styles.menu, menuAnimStyle]}
        pointerEvents={menuOpen ? 'auto' : 'none'}
      >
        {/* Logo */}
        <View style={styles.menuLogo}>
          <Text style={styles.menuLogoText} selectable={false}>rig</Text>
          <Text style={styles.menuLogoAccent} selectable={false}>l</Text>
        </View>

        {/* Nav */}
        <View style={styles.menuNav}>
          <TouchableOpacity style={[styles.menuItem, styles.menuItemActive]} onPress={() => setMenuOpen(false)}>
            <Svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" />
              <Path d="M3 8h18" />
              <Path d="M3 13h18" />
            </Svg>
            <Text style={[styles.menuItemText, styles.menuItemTextActive]}>{t('menu.home')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuOpen(false); onNavigateSaved?.(); }}>
            <Svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,255,255,0.5)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </Svg>
            <Text style={styles.menuItemText}>{t('menu.saved')}</Text>
            {savesCount !== null && savesCount > 0 && (
              <View style={styles.menuBadge}>
                <Text style={styles.menuBadgeText}>{savesCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuOpen(false); setShowInterests(true); }}>
            <Svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,255,255,0.5)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </Svg>
            <Text style={styles.menuItemText}>{t('menu.interests')}</Text>
          </TouchableOpacity>
        </View>

        {/* Language indicator */}
        <TouchableOpacity style={styles.langSection} onPress={() => { setMenuOpen(false); setShowLanguage(true); }} activeOpacity={0.7}>
          <Text style={styles.cefrLabel}>{t('menu.language')}</Text>
          <View style={styles.langRow}>
            <Text style={styles.langFlag}>{LANG_FLAGS[lang] ?? '🌐'}</Text>
            <Text style={styles.langArrow}>→</Text>
            <Text style={styles.langFlag}>🇬🇧</Text>
          </View>
        </TouchableOpacity>

        {/* CEFR level selector */}
        <View style={styles.cefrSection}>
          <Text style={styles.cefrLabel}>{t('menu.level')}</Text>
          <View style={styles.cefrRow}>
            {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level) => {
              const selected = cefrLevels.includes(level);
              return (
                <TouchableOpacity
                  key={level}
                  style={[styles.cefrChip, selected && styles.cefrChipActive]}
                  onPress={() => handleLevelTap(level)}
                >
                  <Text style={[styles.cefrChipText, selected && styles.cefrChipTextActive]}>
                    {level}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* User + logout at bottom */}
        <View style={styles.menuBottom}>
          <View style={styles.menuProfile}>
            <View style={styles.menuAvatar}>
              <Text style={styles.menuAvatarLetter}>
                {userName ? userName[0].toUpperCase() : '?'}
              </Text>
            </View>
            <Text style={styles.menuUserName}>{userName ?? '—'}</Text>
          </View>
          <TouchableOpacity style={styles.menuLogoutBtn} onPress={handleLogout}>
            <Text style={styles.menuLogoutText}>{t('menu.logout')}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {showInterests && (
        <InterestsPicker
          onClose={() => setShowInterests(false)}
          onSaved={() => {
            resumeRef.current = false;
            hasMoreRef.current = true;
            deckRef.current = [];
            setDeck([]);
            setIndex(0);
            setFlipped(false);
            fetchBatch();
          }}
        />
      )}
      {showLanguage && (
        <LanguagePicker
          nativeLang={lang}
          onSaved={(newLang) => onLangChange?.(newLang)}
          onClose={() => setShowLanguage(false)}
        />
      )}

      {/* Burger button — rendered AFTER menu so it sits on top */}
      {(!flipped || menuOpen) && (
        <TouchableOpacity style={styles.burger} onPress={() => setMenuOpen((v) => !v)}>
          <View style={[
            styles.burgerLine,
            { backgroundColor: menuOpen ? '#fff' : colors.ink },
            menuOpen && { transform: [{ translateY: 6.5 }, { rotate: '45deg' }] },
          ]} />
          <View style={[
            styles.burgerLine,
            { backgroundColor: menuOpen ? '#fff' : colors.ink, opacity: menuOpen ? 0 : 1 },
          ]} />
          <View style={[
            styles.burgerLine,
            { backgroundColor: menuOpen ? '#fff' : colors.ink },
            menuOpen && { transform: [{ translateY: -6.5 }, { rotate: '-45deg' }] },
          ]} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  emptyContainer: { flex: 1, backgroundColor: '#f9f9f9' },
  emptyHint: { fontSize: 14, color: '#888', marginTop: 8, textAlign: 'center' },
  emptyAction: { marginTop: 24, paddingHorizontal: 28, paddingVertical: 12, backgroundColor: colors.accent, borderRadius: 24 },
  emptyActionText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 15, color: colors.muted },

  scene: { flex: 1 },

  // Action buttons
  actions: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    gap: 28,
    alignItems: 'center',
  },
  actionBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnSaved:    { backgroundColor: '#f59e0b' },
  actionBtnLiked:    { backgroundColor: colors.know },
  actionBtnDisliked: { backgroundColor: colors.accent },

  // Burger
  burger: {
    position: 'absolute',
    top: 54,
    right: 20,
    width: 38,
    height: 30,
    justifyContent: 'center',
    gap: 5,
    padding: 0,
  },
  burgerLine: {
    height: 1.5,
    width: 20,
    alignSelf: 'center',
    borderRadius: 1,
  },

  // Backdrop
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  // Menu
  menu: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: MENU_WIDTH,
    backgroundColor: '#1c1c1e',
    paddingTop: 54,
    paddingHorizontal: 24,
    flexDirection: 'column',
  },
  menuLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    height: 30,
    marginBottom: 20,
    borderBottomWidth: 0,
  },
  menuLogoText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 2,
  },
  menuLogoAccent: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: 2,
  },
  menuNav: {
    gap: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  menuItemText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  menuItemActive: {
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
    paddingLeft: 10,
    marginLeft: -12,
  },
  menuItemTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  menuBadge: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 8,
  },
  menuBadgeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
  },

  menuProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3a3a5c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuAvatarLetter: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  menuUserName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  menuBottom: {
    marginTop: 'auto',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 16,
    paddingBottom: 32,
  },
  menuLogoutBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    marginTop: 12,
  },
  menuLogoutText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '500',
  },

  langSection: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  langFlag: { fontSize: 24 },
  langArrow: { fontSize: 14, color: 'rgba(255,255,255,0.35)' },

  cefrSection: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  cefrLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  cefrRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cefrChip: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cefrChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  cefrChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
  cefrChipTextActive: {
    color: '#fff',
  },
});
