import { Stack } from 'expo-router';

export default function CalculatorLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="standard" />
      <Stack.Screen name="premium" />
    </Stack>
  );
}