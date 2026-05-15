import React, { useState, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocales } from 'expo-localization';

import { ReelCardsScreen } from './src/screens/ReelCardsScreen';
import { SavedCardsScreen } from './src/screens/SavedCardsScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { OtpScreen } from './src/screens/OtpScreen';
import { NameScreen } from './src/screens/NameScreen';
import { setAuthToken, getMe } from './src/api/api';
import i18n from './src/i18n';

type Screen = 'loading' | 'login' | 'otp' | 'name' | 'cards' | 'saved';

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [userName, setUserName] = useState<string | null>(null);

  const locales = useLocales();
  useEffect(() => {
    const deviceLang = locales[0]?.languageCode ?? 'en';
    const next = ['ru', 'en'].includes(deviceLang) ? deviceLang : 'en';
    if (i18n.language !== next) {
      i18n.changeLanguage(next);
    }
  }, [locales]);

  const fetchUserName = async () => {
    try {
      const me = await getMe();
      setUserName(me.name);
    } catch {}
  };

  useEffect(() => {
    AsyncStorage.getItem('auth_token')
      .then(async (t) => {
        if (t) {
          setAuthToken(t);
          await fetchUserName();
        }
        setScreen(t ? 'cards' : 'login');
      })
      .catch(() => setScreen('login'));
  }, []);

  const handleCodeSent = (e: string) => {
    setEmail(e);
    setScreen('otp');
  };

  const handleOtpSuccess = async (t: string, isNewUser: boolean) => {
    setToken(t);
    setAuthToken(t);
    await AsyncStorage.setItem('auth_token', t);
    if (!isNewUser) await fetchUserName();
    setScreen(isNewUser ? 'name' : 'cards');
  };

  const handleNameDone = async () => {
    await fetchUserName();
    setScreen('cards');
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('auth_token');
    setAuthToken('');
    setToken('');
    setUserName(null);
    setScreen('login');
  };

  if (screen === 'loading') return null;

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {screen === 'login' && (
          <LoginScreen onCodeSent={handleCodeSent} />
        )}
        {screen === 'otp' && (
          <OtpScreen
            email={email}
            onSuccess={handleOtpSuccess}
            onBack={() => setScreen('login')}
          />
        )}
        {screen === 'name' && (
          <NameScreen token={token} onDone={handleNameDone} />
        )}
        {screen === 'cards' && (
          <ReelCardsScreen
            token={token}
            userName={userName}
            onLogout={handleLogout}
            onNavigateSaved={() => setScreen('saved')}
          />
        )}
        {screen === 'saved' && (
          <SavedCardsScreen
            token={token}
            userName={userName}
            onNavigateHome={() => setScreen('cards')}
            onLogout={handleLogout}
          />
        )}
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
