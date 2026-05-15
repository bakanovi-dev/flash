import AsyncStorage from '@react-native-async-storage/async-storage';

export async function loadKnownSet(deckId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(`fc_known::${deckId}`);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export async function saveKnown(deckId: string, set: Set<string>): Promise<void> {
  await AsyncStorage.setItem(`fc_known::${deckId}`, JSON.stringify([...set]));
}

export async function clearKnown(deckId: string): Promise<void> {
  await AsyncStorage.removeItem(`fc_known::${deckId}`);
}
