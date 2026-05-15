import React, { useState } from 'react';
import { TouchableOpacity } from 'react-native-gesture-handler';
import Svg, { Polygon, Path, Rect } from 'react-native-svg';
import * as Speech from 'expo-speech';
import { colors } from '../theme/colors';

export function SpeakBtn({ text, onPressIn }: { text: string; onPressIn?: () => void }) {
  const [speaking, setSpeaking] = useState(false);

  const handlePressIn = () => {
    onPressIn?.();
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
    } else {
      setSpeaking(true);
      Speech.speak(text, {
        language: 'en-US',
        rate: 0.88,
        useApplicationAudioSession: false,
        onDone: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      });
    }
  };

  const color = speaking ? colors.accent : colors.muted;

  return (
    <TouchableOpacity onPressIn={handlePressIn} style={{ padding: 4, alignSelf: 'flex-start' }}>
      {speaking ? (
        <Svg width="18" height="18" viewBox="0 0 24 24" fill={color}>
          <Rect x="5" y="5" width="14" height="14" rx="2" />
        </Svg>
      ) : (
        <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <Polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <Path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <Path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </Svg>
      )}
    </TouchableOpacity>
  );
}
