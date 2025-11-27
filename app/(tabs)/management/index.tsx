import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ManagementIndex() {
  const router = useRouter();
  const { colors } = useTheme();

  const menuItems = [
    {
      title: 'Hedef Yönetimi',
      icon: 'trending-up',
      route: '/(tabs)/management/targets',
      description: 'Personel ve ekip satış hedeflerini belirle',
      color: '#4CAF50' // Özel renk vurgusu
    },
    {
      title: 'Personel Yönetimi',
      icon: 'people',
      route: '/(tabs)/management/personnel',
      description: 'Personel ekle, düzenle ve yetkilendir',
    },
    {
      title: 'Ekip Yönetimi',
      icon: 'briefcase',
      route: '/(tabs)/management/teams',
      description: 'Saha ekiplerini oluştur ve yönet',
    },
    {
      title: 'Ürün Yönetimi',
      icon: 'cube',
      route: '/(tabs)/management/products',
      description: 'Alarm paketleri, uç birimler ve fiyat listeleri',
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Yönetim Paneli</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.card, { backgroundColor: colors.cardBackground }]}
            onPress={() => router.push(item.route as any)}
          >
            <View style={[
              styles.iconContainer, 
              { backgroundColor: (item.color || colors.primary) + '20' }
            ]}>
              <Ionicons 
                name={item.icon as any} 
                size={24} 
                color={item.color || colors.primary} 
              />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {item.description}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  content: {
    padding: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
  },
});