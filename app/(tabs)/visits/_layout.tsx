import { Stack } from 'expo-router';

export default function VisitsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Ana Ziyaret Ekranı */}
      <Stack.Screen name="index" />
      
      {/* Yakındaki Yerler (Modal olarak açılır) */}
      <Stack.Screen 
        name="nearby" 
        options={{ 
          presentation: 'modal',
          animation: 'slide_from_bottom'
        }} 
      />
      
      {/* Aktif Ziyaret (Geri gidilemez, gesture kapalı) */}
      <Stack.Screen 
        name="active" 
        options={{ 
          gestureEnabled: false 
        }} 
      />
      
      {/* Ziyaret Detayı */}
      <Stack.Screen 
        name="[id]" 
        options={{ 
          presentation: 'card',
          animation: 'slide_from_right'
        }} 
      />
    </Stack>
  );
}