import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

export default function PersonnelListScreen() {
  const { colors } = useTheme();
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // Yenileme durumu

  const fetchPersonnel = async () => {
    // Sadece ilk yüklemede loading göster, refresh yaparken gösterme
    if (!refreshing) setLoading(true);
    
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id, full_name, email, avatar_url,
        titles (name),
        cities (name),
        teams!profiles_team_id_fkey (name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Personel çekme hatası:", error.message);
    } else if (data) {
      setPersonnel(data);
    }
    
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchPersonnel();
    }, [])
  );

  // Pull-to-Refresh Tetikleyicisi
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPersonnel();
  }, []);

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
      onPress={() => router.push({ pathname: '/(tabs)/management/personnel/edit', params: { id: item.id } })}
    >
      <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surface }]}>
        {item.avatar_url ? (
          <Image 
            source={{ uri: item.avatar_url }} 
            style={styles.avatarImage} 
            resizeMode="cover"
          />
        ) : (
          <Text style={[styles.avatarText, { color: colors.text }]}>
            {item.full_name?.charAt(0).toUpperCase() || '?'}
          </Text>
        )}
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.text }]}>{item.full_name || 'İsimsiz'}</Text>
        <Text style={[styles.detail, { color: colors.textSecondary }]}>
          {item.titles?.name || 'Unvan Yok'} • {item.teams?.name || 'Ekip Yok'}
        </Text>
        <Text style={[styles.subDetail, { color: colors.textTertiary }]}>
          {item.cities?.name || 'Şehir Yok'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Personel Listesi</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/management/personnel/create')}>
            <Ionicons name="person-add" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={personnel}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={ // Refresh Control Eklendi
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
               <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Personel bulunamadı.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: { fontSize: 20, fontWeight: '600' },
  backButton: { padding: 4 },
  listContent: { padding: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: { fontSize: 18, fontWeight: '600' },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  detail: { fontSize: 13, marginBottom: 2 },
  subDetail: { fontSize: 12 },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { fontSize: 16, fontWeight: '500', marginBottom: 8 },
});