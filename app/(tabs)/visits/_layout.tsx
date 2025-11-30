import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function VisitsLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false, // Sayfa başlıklarını gizler (tasarımınıza göre true yapabilirsiniz)
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {/* Ziyaret Ana Sayfası */}
      <Stack.Screen name="index" />
      
      {/* Aktif Ziyaret Ekranı */}
      <Stack.Screen name="active" />
      
      {/* Yakındaki Müşteriler */}
      <Stack.Screen name="nearby" />
      
      {/* Ziyaret Detayı ([id].tsx) */}
      <Stack.Screen name="[id]" />
    </Stack>
  );
}