import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { CustomModal, ModalButton } from '@/components/CustomModal';

export default function VisitsIndex() {
  const { colors } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  
  // Data State
  const [activeVisit, setActiveVisit] = useState<any>(null);
  const [pastVisits, setPastVisits] = useState<any[]>([]);
  const [plannedVisits, setPlannedVisits] = useState<any[]>([]);

  // Tab State ('planned' | 'past')
  const [activeTab, setActiveTab] = useState<'planned' | 'past'>('planned');

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'error' | 'default'>('default');

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Aktif Ziyaret Kontrolü
      const { data: activeData } = await supabase
        .from('visits')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();
      
      setActiveVisit(activeData || null);

      // 2. Planlanan Ziyaretler (Sadece 'planned')
      const { data: plannedData } = await supabase
        .from('visits')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'planned')
        .order('started_at', { ascending: true }); // En yakın tarih en üstte
      
      setPlannedVisits(plannedData || []);

      // 3. Geçmiş Ziyaretler (Tamamlanan veya İptal)
      const { data: pastData } = await supabase
        .from('visits')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['completed', 'cancelled']) // Sadece bitmişler
        .order('started_at', { ascending: false }) // En son yapılan en üstte
        .limit(20);
      
      setPastVisits(pastData || []);

    } catch (error) {
      console.log('Veri çekme hatası', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartVisit = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      // Alert yerine CustomModal kullanılıyor
      setModalType('error');
      setModalMessage('Konum izni olmadan ziyaret başlatılamaz. Lütfen ayarlardan izin verin.');
      setModalVisible(true);
      return;
    }
    router.push('/(tabs)/visits/nearby');
  };

  const handleContinueVisit = () => {
    if (activeVisit) {
      router.push({ pathname: '/(tabs)/visits/active', params: { visitId: activeVisit.id } });
    }
  };

  // İkon ve Renk Helper'ı
  const getStatusConfig = (status: string) => {
    switch (status) {
        case 'completed': return { icon: "checkmark", color: "#2E7D32", bg: "#E8F5E9" };
        case 'cancelled': return { icon: "close", color: "#C62828", bg: "#FFEBEE" };
        case 'planned': return { icon: "calendar", color: "#1565C0", bg: "#E3F2FD" };
        default: return { icon: "help", color: "#666", bg: "#eee" };
    }
  };

  const renderVisitItem = ({ item }: { item: any }) => {
    const config = getStatusConfig(item.status);

    return (
      <TouchableOpacity 
        style={[styles.historyItem, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
        onPress={() => router.push({ pathname: '/(tabs)/visits/[id]', params: { id: item.id } })}
      >
        <View style={[styles.historyIcon, { backgroundColor: config.bg }]}>
          <Ionicons name={config.icon as any} size={18} color={config.color} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.historyName, { color: colors.text }]} numberOfLines={1}>{item.place_name}</Text>
          <Text style={[styles.historyDate, { color: colors.textSecondary }]}>
            {new Date(item.started_at).toLocaleDateString('tr-TR')} • {new Date(item.started_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  if (loading) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      
      {/* Üst Kısım: Başlık ve Aksiyon */}
      <View style={styles.headerContent}>
        <Text style={[styles.title, { color: colors.text }]}>Ziyaret Yönetimi</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Saha operasyonlarınızı yönetin.</Text>

        <View style={styles.actionContainer}>
          {activeVisit ? (
            <View style={[styles.activeCard, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
              <View style={styles.activeHeader}>
                <View style={styles.pulseContainer}>
                   <View style={styles.pulseDot} />
                </View>
                <Text style={[styles.activeTitle, { color: colors.primary }]}>Ziyaret Devam Ediyor</Text>
              </View>
              <Text style={[styles.placeName, { color: colors.text }]}>{activeVisit.place_name}</Text>
              <Text style={[styles.placeAddress, { color: colors.textSecondary }]}>{activeVisit.place_address}</Text>
              
              <TouchableOpacity style={[styles.continueButton, { backgroundColor: colors.primary }]} onPress={handleContinueVisit}>
                <Text style={styles.buttonText}>Detaya Git</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={[styles.startButton, { backgroundColor: colors.primary }]} onPress={handleStartVisit}>
              <Ionicons name="location" size={24} color="#fff" style={{ marginRight: 10 }} />
              <Text style={styles.buttonText}>Yeni Ziyaret Başlat</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* TAB MENU */}
      <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
         <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'planned' && { borderBottomColor: colors.primary }]}
            onPress={() => setActiveTab('planned')}
         >
             <Text style={[styles.tabText, { color: activeTab === 'planned' ? colors.primary : colors.textSecondary }]}>
                Planlananlar ({plannedVisits.length})
             </Text>
         </TouchableOpacity>

         <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'past' && { borderBottomColor: colors.primary }]}
            onPress={() => setActiveTab('past')}
         >
             <Text style={[styles.tabText, { color: activeTab === 'past' ? colors.primary : colors.textSecondary }]}>
                Geçmiş
             </Text>
         </TouchableOpacity>
      </View>

      {/* Liste */}
      <View style={[styles.listContainer, { backgroundColor: colors.background }]}>
        <FlatList
          data={activeTab === 'planned' ? plannedVisits : pastVisits}
          keyExtractor={(item) => item.id}
          renderItem={renderVisitItem}
          contentContainerStyle={{ paddingBottom: 20, paddingTop: 10 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
                <Ionicons name={activeTab === 'planned' ? "calendar-outline" : "time-outline"} size={48} color={colors.textSecondary + '50'} />
                <Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: 10 }}>
                    {activeTab === 'planned' ? 'Planlanmış ziyaretiniz bulunmuyor.' : 'Geçmiş ziyaret kaydı yok.'}
                </Text>
            </View>
          }
        />
      </View>

      {/* CUSTOM MODAL ENTEGRASYONU */}
      <CustomModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={modalType === 'error' ? 'İzin Hatası' : 'Bilgi'}
        type={modalType}
      >
        <Text style={{ textAlign: 'center', marginBottom: 20, color: colors.text }}>
           {modalMessage}
        </Text>
        <ModalButton 
          title="Tamam" 
          onPress={() => setModalVisible(false)} 
          variant={modalType === 'error' ? 'danger' : 'primary'}
        />
      </CustomModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerContent: { padding: 24, paddingBottom: 10 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 16, marginBottom: 24 },
  actionContainer: { width: '100%', marginBottom: 10 },
  
  startButton: { padding: 18, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  
  activeCard: { padding: 20, borderRadius: 16, borderWidth: 1 },
  activeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  activeTitle: { fontSize: 14, fontWeight: 'bold', marginLeft: 8, textTransform: 'uppercase' },
  pulseContainer: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(239, 68, 68, 0.2)', alignItems: 'center', justifyContent: 'center' },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  placeName: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  placeAddress: { fontSize: 13, marginBottom: 16 },
  continueButton: { padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },

  // TAB STYLES
  tabContainer: { flexDirection: 'row', marginHorizontal: 24, borderBottomWidth: 1 },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, fontWeight: '600' },

  listContainer: { flex: 1, paddingHorizontal: 24 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  
  historyItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1 },
  historyIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  historyName: { fontSize: 16, fontWeight: '600' },
  historyDate: { fontSize: 12, marginTop: 2 }
});