import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function CalculatorSelectScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { visitId } = useLocalSearchParams();

  const navigateTo = (path: string) => {
    router.push({
      pathname: path as any,
      params: { visitId: visitId }
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Fiyat Hesaplayıcı</Text>
        {visitId && (
          <View style={{backgroundColor: colors.primary+'20', padding:6, borderRadius:8, marginLeft:10}}>
             <Text style={{color: colors.primary, fontSize:12, fontWeight:'bold'}}>Ziyaret Modu</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Lütfen hesaplama yapmak istediğiniz sistemi seçiniz.
        </Text>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.cardBackground }]}
          onPress={() => navigateTo('/(tabs)/calculator/standard')}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="shield-checkmark-outline" size={32} color={colors.primary} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Kale Alarm 2025</Text>
            <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
              Standart sistemler, kablolu ve kablosuz varyant hesaplamaları.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.cardBackground }]}
          onPress={() => navigateTo('/(tabs)/calculator/premium')}
        >
          <View style={[styles.iconBox, { backgroundColor: '#F59E0B' + '20' }]}>
            <Ionicons name="diamond-outline" size={32} color="#F59E0B" />
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Kale Alarm X</Text>
            <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
              Premium sistemler, Hub bazlı uyumluluk hesaplamaları.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingBottom: 10, flexDirection:'row', alignItems:'center' },
  title: { fontSize: 28, fontWeight: 'bold' },
  content: { padding: 20 },
  subtitle: { fontSize: 16, marginBottom: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  cardDesc: { fontSize: 13, lineHeight: 18 },
});