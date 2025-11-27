import { Stack } from 'expo-router';

export default function ManagementLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Yönetim Ana Sayfası */}
      <Stack.Screen name="index" />
      
      {/* Ürün Yönetimi Sayfaları */}
      <Stack.Screen name="products/index" />
      <Stack.Screen name="products/manage" />
      
      {/* Personel Yönetimi Sayfaları */}
      <Stack.Screen name="personnel/index" />
      <Stack.Screen name="personnel/create" />
      <Stack.Screen name="personnel/edit" />
      
      {/* Ekip Yönetimi Sayfaları */}
      <Stack.Screen name="teams/index" />
      <Stack.Screen name="teams/create" />
      <Stack.Screen name="teams/edit" />
      <Stack.Screen name="teams/[id]" />
    </Stack>
  );
}