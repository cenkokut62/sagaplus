import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const [plannedVisits, setPlannedVisits] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Zamana göre selamlama mesajı
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return 'İyi Geceler';
    if (hour < 12) return 'Günaydın';
    if (hour < 18) return 'Tünaydın';
    return 'İyi Akşamlar';
  };

  const jobTitle = profile?.titles?.name || 'Ünvan Belirtilmemiş';
  // @ts-ignore
  const teamName = profile?.team_members?.[0]?.teams?.name;

  // Planlanmış ziyaretleri çek
  const fetchDashboardData = async () => {
    try {
      const { data } = await supabase
        .from('visits')
        .select('*')
        .eq('status', 'planned')
        .order('started_at', { ascending: true })
        .limit(5); // İlk 5 planı göster
      
      if (data) setPlannedVisits(data);
    } catch (error) {
      console.log('Dashboard veri hatası:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        
        {/* --- ÜST PROFİL ALANI --- */}
        <View style={styles.headerContainer}>
          <View style={styles.profileSection}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.8}>
              <View style={[styles.avatarContainer, { borderColor: colors.primary }]}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.avatarInitial, { color: colors.primary }]}>
                      {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'}
                    </Text>
                  </View>
                )}
                <View style={styles.statusDot} />
              </View>
            </TouchableOpacity>

            <View style={styles.greetingContainer}>
              <Text style={[styles.greetingText, { color: colors.textSecondary }]}>
                {getGreeting()},
              </Text>
              <Text style={[styles.nameText, { color: colors.text }]} numberOfLines={1}>
                {profile?.full_name || 'Kullanıcı'}
              </Text>
              <View style={styles.badgeContainer}>
                 <View style={[styles.badge, { backgroundColor: colors.primary + '15' }]}>
                    <Text style={[styles.badgeText, { color: colors.primary }]}>{jobTitle}</Text>
                 </View>
                 {teamName && (
                   <View style={[styles.badge, { backgroundColor: colors.textSecondary + '15', marginLeft: 8 }]}>
                      <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{teamName}</Text>
                   </View>
                 )}
              </View>
            </View>
          </View>
        </View>

        {/* --- HOŞ GELDİN KARTI --- */}
        <View style={[styles.welcomeCard, { backgroundColor: colors.primary }]}>
           <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Saha Operasyonlarına Hazır Mısın?</Text>
              <Text style={styles.cardDesc}>
                Bugünkü görevlerini kontrol et, raporlarını oluştur ve ekibinle senkronize kal.
              </Text>
              <TouchableOpacity 
                style={styles.cardButton}
                onPress={() => router.push('/(tabs)/management')}
              >
                 <Text style={[styles.cardButtonText, { color: colors.primary }]}>Yönetim Paneline Git</Text>
                 <Ionicons name="arrow-forward" size={16} color={colors.primary} />
              </TouchableOpacity>
           </View>
           <Ionicons name="analytics" size={120} color="rgba(255,255,255,0.15)" style={styles.cardIconDecor} />
        </View>

        {/* --- YENİ PLANLANAN ZİYARETLER BÖLÜMÜ --- */}
        {plannedVisits.length > 0 && (
          <View style={{marginBottom: 24}}>
             <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Ajanda (Planlananlar)</Text>
             </View>
             {plannedVisits.map((visit) => (
               <TouchableOpacity 
                 key={visit.id}
                 style={[styles.plannedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                 onPress={() => router.push({ pathname: '/(tabs)/visits/[id]', params: { id: visit.id } })}
               >
                  <View style={{flexDirection:'row', alignItems:'center'}}>
                     <View style={[styles.dateBox, { backgroundColor: colors.primary+'15' }]}>
                        <Text style={{color: colors.primary, fontWeight:'bold', fontSize: 16}}>
                          {new Date(visit.started_at).getDate()}
                        </Text>
                        <Text style={{color: colors.primary, fontSize: 10}}>
                          {new Date(visit.started_at).toLocaleString('tr-TR', { month: 'short' })}
                        </Text>
                     </View>
                     <View style={{marginLeft: 12, flex: 1}}>
                        <Text style={{color: colors.text, fontWeight:'bold', fontSize: 16}}>{visit.place_name}</Text>
                        <Text style={{color: colors.textSecondary, fontSize: 12}}>
                           Saat: {new Date(visit.started_at).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}
                        </Text>
                     </View>
                     <Ionicons name="chevron-forward" color={colors.textSecondary} size={20} />
                  </View>
               </TouchableOpacity>
             ))}
          </View>
        )}

        {/* --- HIZLI ERİŞİM --- */}
        <View style={styles.sectionHeader}>
           <Text style={[styles.sectionTitle, { color: colors.text }]}>Hızlı Erişim</Text>
        </View>

        <View style={styles.quickActionsGrid}>
           <QuickActionCard 
              title="Yeni Rapor" 
              icon="document-text-outline" 
              color="#4F46E5" 
              bgColor="#EEF2FF"
              onPress={() => {}} 
           />
           <QuickActionCard 
              title="Müşteriler" 
              icon="people-outline" 
              color="#059669" 
              bgColor="#ECFDF5"
              onPress={() => {}} 
           />
           <QuickActionCard 
              title="Takvim" 
              icon="calendar-outline" 
              color="#D97706" 
              bgColor="#FFFBEB"
              onPress={() => {}} 
           />
           <QuickActionCard 
              title="Dosyalar" 
              icon="folder-open-outline" 
              color="#DB2777" 
              bgColor="#FDF2F8"
              onPress={() => {}} 
           />
        </View>

        {/* --- SON AKTİVİTELER --- */}
        <View style={[styles.infoCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
           <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.infoCardTitle, { color: colors.text }]}>Son Durum</Text>
           </View>
           <Text style={[styles.infoCardText, { color: colors.textSecondary }]}>
              {plannedVisits.length > 0 
                ? `${plannedVisits.length} adet planlı ziyaretiniz bulunmaktadır.` 
                : 'Henüz bekleyen bir göreviniz bulunmamaktadır.'}
           </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const QuickActionCard = ({ title, icon, color, bgColor, onPress }: any) => (
  <TouchableOpacity style={[styles.actionCard, { backgroundColor: bgColor }]} onPress={onPress}>
     <View style={[styles.actionIconContainer, { backgroundColor: '#FFFFFF' }]}>
        <Ionicons name={icon} size={24} color={color} />
     </View>
     <Text style={[styles.actionTitle, { color: '#1F2937' }]}>{title}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 20, paddingBottom: 40 },
  
  // Header
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  profileSection: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarContainer: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, padding: 2, marginRight: 16, position: 'relative' },
  avatar: { width: '100%', height: '100%', borderRadius: 30 },
  avatarPlaceholder: { width: '100%', height: '100%', borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 24, fontWeight: 'bold' },
  statusDot: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#FFFFFF' },
  greetingContainer: { flex: 1 },
  greetingText: { fontSize: 14, fontWeight: '500' },
  nameText: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  badgeContainer: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  
  // Welcome Card
  welcomeCard: { borderRadius: 24, padding: 24, marginBottom: 24, position: 'relative', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 8 },
  cardContent: { zIndex: 2, paddingRight: 60 },
  cardTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold', marginBottom: 8, lineHeight: 28 },
  cardDesc: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginBottom: 20, lineHeight: 20 },
  cardButton: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardButtonText: { fontSize: 14, fontWeight: '700' },
  cardIconDecor: { position: 'absolute', right: -20, bottom: -20, zIndex: 1, transform: [{ rotate: '-15deg' }] },

  // Quick Actions
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  actionCard: { width: (width - 52) / 2, padding: 16, borderRadius: 16, alignItems: 'flex-start' },
  actionIconContainer: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 2 },
  actionTitle: { fontSize: 14, fontWeight: '600' },

  // Info Card
  infoCard: { borderRadius: 16, borderWidth: 1, padding: 20, borderStyle: 'dashed' },
  infoCardTitle: { fontSize: 16, fontWeight: '600', marginLeft: 8 },
  infoCardText: { fontSize: 14, lineHeight: 20 },

  // Planned Visits Card (New)
  plannedCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 10 },
  dateBox: { width: 45, height: 45, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }
});