import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [permissionsChecked, setPermissionsChecked] = useState(false);

  // İzin Kontrol Fonksiyonu
  const checkPermissions = async () => {
    // 1. Konum Kontrolü
    const { status: locationStatus } = await Location.getForegroundPermissionsAsync();
    if (locationStatus !== 'granted') return false;

    // 2. Mikrofon Kontrolü
    const { status: micStatus } = await ExpoSpeechRecognitionModule.getPermissionsAsync();
    if (micStatus !== 'granted') return false;

    // 3. Bildirim Kontrolü
    const { status: notifStatus } = await Notifications.getPermissionsAsync();
    if (notifStatus !== 'granted') return false;

    return true;
  };

  useEffect(() => {
    // Auth yüklenmesini bekle
    if (loading) return;

    const performChecks = async () => {
      // Önce izinleri kontrol et
      const hasAllPermissions = await checkPermissions();
      
      // Hangi sayfada olduğumuz
      const inAuthGroup = segments[0] === '(tabs)';
      const inPermissionsGroup = segments[0] === 'permissions';

      if (!hasAllPermissions) {
        // İzin yoksa ve zaten izin ekranında değilse -> İzin ekranına at
        if (!inPermissionsGroup) {
          router.replace('/permissions');
        }
      } else {
        // İzinler tamamsa normal Auth akışına devam et
        if (inPermissionsGroup) {
          // İzinler verildiyse ve hala izin ekranındaysa login'e at (veya home'a)
          router.replace(session ? '/(tabs)' : '/login');
        } else if (!session && inAuthGroup) {
          router.replace('/login');
        } else if (session && !inAuthGroup) {
          router.replace('/(tabs)');
        }
      }
      setPermissionsChecked(true);
    };

    performChecks();
  }, [session, segments, loading]);

  if (!permissionsChecked && loading) {
    return null; // Veya bir Splash Screen komponenti
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="permissions/index" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <ThemeProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </ThemeProvider>
  );
}