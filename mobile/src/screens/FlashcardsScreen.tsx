import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export function FlashcardsScreen() {
  return (
    <View style={styles.container}>
      <Text style={{ color: colors.muted }}>Flashcards</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
});
