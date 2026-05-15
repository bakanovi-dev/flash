import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { ReelCard } from '../api/api';
import { SpeakBtn } from './SpeakBtn';
import { colors } from '../theme/colors';

interface Props {
  card: ReelCard;
  flipped: boolean;
  onSpeakPressIn?: () => void;
}

function getLevelColors(level: string): { bg: string; fg: string } {
  switch (level) {
    case 'B1': return { bg: 'rgba(80,190,100,0.35)', fg: '#90e0a0' };
    case 'B2': return { bg: 'rgba(70,150,230,0.35)', fg: '#90c8f8' };
    case 'C1': return { bg: 'rgba(210,140,60,0.40)', fg: '#f5c070' };
    case 'C2': return { bg: 'rgba(210,70,70,0.40)',  fg: '#f09090' };
    default:   return { bg: 'rgba(255,255,255,0.18)', fg: 'rgba(255,255,255,0.7)' };
  }
}

export function QuoteCardFaces({ card, flipped, onSpeakPressIn }: Props) {
  const { top: topInset } = useSafeAreaInsets();
  const flipProgress = useSharedValue(0);

  useEffect(() => {
    flipProgress.value = withTiming(flipped ? 1 : 0, { duration: 380 });
  }, [flipped]);

  const frontStyle = useAnimatedStyle(() => ({
    opacity: flipProgress.value > 0.5 ? 0 : 1,
    transform: [
      { perspective: 900 },
      { rotateY: `${interpolate(flipProgress.value, [0, 1], [0, 180])}deg` },
    ],
  }));

  const backStyle = useAnimatedStyle(() => ({
    opacity: flipProgress.value < 0.5 ? 0 : 1,
    transform: [
      { perspective: 900 },
      { rotateY: `${interpolate(flipProgress.value, [0, 1], [180, 360])}deg` },
    ],
  }));

  const epLabel =
    card.show && card.season != null
      ? `${card.show} · S${String(card.season).padStart(2, '0')}E${String(card.episode).padStart(2, '0')}`
      : card.show || null;

  return (
    <View style={styles.container}>
      {/* Front */}
      <Animated.View
        style={[styles.face, styles.front, frontStyle, { pointerEvents: flipped ? 'none' : 'auto' }]}
      >
        <View style={styles.frontInner}>
          {epLabel && (
            <Text style={styles.metaShow} allowFontScaling={false}>{epLabel}</Text>
          )}
          <View style={styles.quoteGroup}>
            <SpeakBtn text={card.quote_en} onPressIn={onSpeakPressIn} />
            <Text style={styles.quote} allowFontScaling={false}>{card.quote_en}</Text>
            {card.context ? (
              <Text style={styles.context} allowFontScaling={false}>{card.context}</Text>
            ) : null}
          </View>
        </View>
      </Animated.View>

      {/* Back */}
      <Animated.View
        style={[styles.face, styles.back, backStyle, { pointerEvents: flipped ? 'auto' : 'none' }]}
      >
        <ScrollView
          style={styles.backScroll}
          contentContainerStyle={[styles.backContent, { paddingTop: topInset + 16 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.quoteRu} allowFontScaling={false}>
            {card.quote_translated}
          </Text>

          {card.expressions.length > 0 && (
            <View style={styles.expressions}>
              {card.expressions.map((expr, i) => (
                <View key={i} style={styles.expr}>
                  <Text style={styles.exprPhrase} allowFontScaling={false}>
                    {expr.phrase}
                  </Text>
                  {expr.literal ? (
                    <Text style={styles.exprLiteral} allowFontScaling={false}>
                      {expr.literal}
                    </Text>
                  ) : null}
                  {expr.explanation ? (
                    <Text style={styles.exprExplanation} allowFontScaling={false}>
                      {expr.explanation}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          {card.words.length > 0 && (
            <View style={styles.words}>
              {card.words.map((w, i) => {
                const lc = getLevelColors(w.level);
                return (
                  <View key={i} style={styles.wordChip}>
                    <View style={[styles.wordLevelBadge, { backgroundColor: lc.bg }]}>
                      <Text style={[styles.wordLevelText, { color: lc.fg }]} allowFontScaling={false}>
                        {w.level}
                      </Text>
                    </View>
                    <View style={styles.wordBody}>
                      <Text style={styles.wordText} allowFontScaling={false}>{w.word}</Text>
                      <Text style={styles.wordTr} allowFontScaling={false}>{w.translation}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  face: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  front: {
    backgroundColor: colors.white,
  },
  back: {
    backgroundColor: colors.back,
  },

  // ── Front ──────────────────────────────────────────────────────────────────

  frontInner: {
    flex: 1,
    paddingHorizontal: 28,
    paddingVertical: 32,
    justifyContent: 'center',
    gap: 20,
  },
  metaShow: {
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  quoteGroup: {
    gap: 12,
  },
  quote: {
    fontSize: 19,
    fontWeight: '500',
    color: colors.ink,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  context: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 22,
    fontStyle: 'italic',
    opacity: 0.75,
  },

  // ── Back ───────────────────────────────────────────────────────────────────

  backScroll: { flex: 1 },
  backContent: {
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 120,
    gap: 16,
  },

  quoteRu: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.75)',
    fontStyle: 'italic',
    lineHeight: 27,
    paddingBottom: 16,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },

  expressions: { gap: 16 },
  expr: { gap: 3 },
  exprPhrase: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  exprLiteral: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    fontStyle: 'italic',
    letterSpacing: 0.1,
  },
  exprExplanation: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 25,
    marginTop: 4,
  },

  words: {
    gap: 8,
    marginTop: 4,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  wordChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  wordLevelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 2,
  },
  wordLevelText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  wordBody: {
    flex: 1,
    gap: 2,
  },
  wordText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  wordTr: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
});
