import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
// Yeni PDF servisini import et
import { generateDailyReportPDF } from '@/services/pdfService'; 
import { CustomModal, ModalButton } from '@/components/CustomModal';
import { useAuth } from '@/contexts/AuthContext';

export default function ReportsIndex() {
  const { colors } = useTheme();
  const { profile: authProfile } = useAuth(); 
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Data States
  const [visits, setVisits] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({
    totalVisits: 0,
    plannedVisits: 0,
    completedVisits: 0,
    totalDurationMinutes: 0,
    offerCount: 0,
    conversionRate: 0
  });
  
  const [personnelInfo, setPersonnelInfo] = useState<any>({
    fullName: authProfile?.full_name || 'Personel',
    title: authProfile?.titles?.name || 'Saha Personeli',
    city: authProfile?.cities?.name || '',
    team: 'Genel'
  });

  // Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'success' | 'error'>('success');
  const [modalMessage, setModalMessage] = useState('');

  // --- YENİ EKLENEN STATE'LER: BÖLGE MODALI ---
  const [regionModalVisible, setRegionModalVisible] = useState(false);
  const [workingRegion, setWorkingRegion] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchReportData();
    }, [currentDate])
  );

  useEffect(() => {
    if (authProfile) {
        setPersonnelInfo((prev: any) => ({
            ...prev,
            fullName: authProfile.full_name || prev.fullName,
            title: authProfile.titles?.name || prev.title,
            city: authProfile.cities?.name || prev.city,
        }));
        // Varsayılan olarak profilin şehrini atayalım, kullanıcı değiştirebilir
        if (authProfile.cities?.name) {
            setWorkingRegion(authProfile.cities.name);
        }
    }
  }, [authProfile]);

  const fetchReportData = async () => {
    try {
      if (!refreshing) setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select(`
          full_name,
          titles (name),
          cities (name),
          team_members ( teams ( name ) )
        `)
        .eq('id', user.id)
        .maybeSingle();

      const safeName = profileData?.full_name || authProfile?.full_name || user.user_metadata?.full_name || 'İsimsiz Personel';

      const pInfo = {
        fullName: safeName,
        title: profileData?.titles?.name || authProfile?.titles?.name || 'Unvan Yok',
        city: profileData?.cities?.name || authProfile?.cities?.name || '',
        team: profileData?.team_members?.[0]?.teams?.name || 'Genel Ekip'
      };
      
      setPersonnelInfo(pInfo);
      if (!workingRegion && pInfo.city) setWorkingRegion(pInfo.city);

      const startOfDay = new Date(currentDate);
      startOfDay.setHours(0,0,0,0);
      const endOfDay = new Date(currentDate);
      endOfDay.setHours(23,59,59,999);

      // --- DÜZELTME: Status filtresi YOK, hepsini çekiyoruz ---
      const { data: visitsData, error } = await supabase
        .from('visits')
        .select(`*, offers (id)`)
        .eq('user_id', user.id)
        .gte('started_at', startOfDay.toISOString())
        .lte('started_at', endOfDay.toISOString())
        .order('started_at', { ascending: false });

      if (error) throw error;

      let planned = 0;
      let completed = 0;
      let durationSec = 0;
      let offerCnt = 0;
      
      const processedVisits = (visitsData || []).map((v: any) => {
        if(v.status === 'planned') planned++;
        if(v.status === 'completed') completed++;
        if(v.duration_seconds) durationSec += v.duration_seconds;
        const hasOffer = v.offers && v.offers.length > 0;
        if(hasOffer) offerCnt++;
        return { ...v, offer_given: hasOffer };
      });

      setVisits(processedVisits);
      setMetrics({
        totalVisits: processedVisits.length,
        plannedVisits: planned,
        completedVisits: completed,
        totalDurationMinutes: Math.floor(durationSec / 60),
        offerCount: offerCnt,
        conversionRate: completed > 0 ? Math.floor((offerCnt / completed) * 100) : 0
      });

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 1. PDF Butonuna Basılınca Modalı Aç
  const handlePreExport = () => {
      setRegionModalVisible(true);
  };

  // 2. Modal Onaylanınca PDF Oluştur
  const handleConfirmExport = async () => {
    setRegionModalVisible(false); // Modalı kapat
    try {
      setLoading(true);
      
      // Personel bilgisindeki şehri, kullanıcının girdiği bölge ile geçici olarak değiştiriyoruz
      const reportPersonnelInfo = {
          ...personnelInfo,
          city: workingRegion || 'Belirtilmedi'
      };

      await generateDailyReportPDF(metrics, visits, reportPersonnelInfo, currentDate);
    } catch (e) {
      console.error(e);
      setModalType('error');
      setModalMessage('PDF oluşturulamadı.');
      setModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const changeDate = (days: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    const today = new Date();
    today.setHours(23,59,59,999);
    if (newDate.getTime() > today.getTime()) return;
    setCurrentDate(newDate);
  };
  
  const isToday = currentDate.toDateString() === new Date().toDateString();
  const onRefresh = () => { setRefreshing(true); fetchReportData(); };

  // ... (MetricCard ve RenderVisitRow kodları aynen kalacak) ...
  const renderMetricCard = (label: string, value: string | number, icon: string, color: string) => (
    <View style={[styles.metricCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
      <View style={[styles.metricIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );

  const renderVisitRow = ({ item, index }: { item: any, index: number }) => {
    const isLastItem = index === visits.length - 1;
    const startTime = new Date(item.started_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    let statusColor = colors.primary;
    let statusIcon = "time"; 
    let statusText = "Planlandı";

    if (item.status === 'completed') {
        statusColor = colors.success;
        statusIcon = "checkmark-circle";
        statusText = "Tamamlandı";
    } else if (item.status === 'cancelled') {
        statusColor = colors.error;
        statusIcon = "close-circle";
        statusText = "İptal Edildi";
    }

    const offerText = item.offer_given ? 'Teklif İletildi' : 'Teklif İletilmedi';
    const cardText = item.card_image_url ? 'Görsel Eklendi' : 'Görsel Yok';
    const passiveColor = '#999';

    return (
      <View style={styles.timelineRow}>
        <View style={styles.timelineLeft}>
            <Text style={[styles.timelineTime, { color: colors.textSecondary }]}>{startTime}</Text>
            <View style={styles.timelineLineContainer}>
                <View style={[styles.timelineDot, { backgroundColor: statusColor, borderColor: colors.background }]} />
                {!isLastItem && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}
            </View>
        </View>
        <View style={[styles.timelineCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
                <Text style={[styles.placeName, { color: colors.text }]} numberOfLines={1}>{item.place_name}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
                    <Ionicons name={statusIcon as any} size={12} color={statusColor} style={{ marginRight: 4 }} />
                    <Text style={{ color: statusColor, fontSize: 10, fontWeight: 'bold' }}>{statusText}</Text>
                </View>
            </View>
            <Text style={[styles.addressText, { color: colors.textTertiary }]} numberOfLines={1}>
                {item.place_address || 'Adres bilgisi girilmemiş'}
            </Text>
            <View style={styles.miniStatsRow}>
                <View style={styles.miniStat}>
                    <Ionicons name="timer-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.miniStatText, { color: colors.textSecondary }]}>
                        {item.duration_seconds ? Math.floor(item.duration_seconds / 60) + ' dk' : '-'}
                    </Text>
                </View>
                <View style={styles.miniStat}>
                    <Ionicons name={item.offer_given ? "document-text" : "document-outline"} size={14} color={item.offer_given ? colors.success : passiveColor} />
                    <Text style={[styles.miniStatText, { color: item.offer_given ? colors.success : passiveColor }]}>{offerText}</Text>
                </View>
                <View style={styles.miniStat}>
                    <Ionicons name={item.card_image_url ? "image" : "image-outline"} size={14} color={item.card_image_url ? colors.primary : passiveColor} />
                    <Text style={[styles.miniStatText, { color: item.card_image_url ? colors.primary : passiveColor }]}>{cardText}</Text>
                </View>
            </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.dateControl}>
           <TouchableOpacity onPress={() => changeDate(-1)} style={styles.arrowBtn}>
             <Ionicons name="chevron-back" size={24} color={colors.text} />
           </TouchableOpacity>
           <View style={{ alignItems: 'center', minWidth: 120 }}>
             <Text style={[styles.dateTitle, { color: colors.text }]}>
               {isToday ? 'BUGÜN' : currentDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
             </Text>
             <Text style={[styles.subTitle, { color: colors.textSecondary }]}>{currentDate.getFullYear()}</Text>
           </View>
           <TouchableOpacity onPress={() => changeDate(1)} style={styles.arrowBtn} disabled={isToday}>
             <Ionicons name="chevron-forward" size={24} color={isToday ? colors.textTertiary : colors.text} />
           </TouchableOpacity>
        </View>
        
        {/* BUTON ARTIK handlePreExport'U ÇAĞIRIYOR */}
        <TouchableOpacity 
           style={[styles.pdfButton, { backgroundColor: colors.primary }]} 
           onPress={handlePreExport} 
           disabled={loading}
        >
          {loading ? (
             <ActivityIndicator color="#fff" size="small" />
          ) : (
             <>
               <Ionicons name="share-outline" size={20} color="#fff" />
               <Text style={styles.pdfBtnText}>Raporla</Text>
             </>
          )}
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(item) => item.id}
          renderItem={renderVisitRow}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
          ListHeaderComponent={() => (
             <View style={{ paddingBottom: 5 }}>
                <View style={{ marginVertical: 10, padding: 10, backgroundColor: colors.surface, borderRadius: 8 }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>Rapor Sahibi</Text>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>{personnelInfo.fullName}</Text>
                    <Text style={{ fontSize: 12, color: colors.textTertiary }}>{personnelInfo.title} | {personnelInfo.city || 'Bölge Belirtilmedi'}</Text>
                </View>

                <View style={styles.metricsContainer}>
                  <View style={styles.row}>
                    {renderMetricCard('Ziyaret', metrics.totalVisits, 'location', colors.primary)}
                    {renderMetricCard('Tamamlanan', metrics.completedVisits, 'checkmark-circle', colors.success)}
                  </View>
                  <View style={styles.row}>
                    {renderMetricCard('Teklif', metrics.offerCount, 'document-text', '#F57C00')}
                    {renderMetricCard('Başarı', `%${metrics.conversionRate}`, 'trending-up', '#7B1FA2')}
                  </View>
                </View>
                
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Günlük Akış</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{visits.length} Kayıt</Text>
                </View>
             </View>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="folder-open-outline" size={48} color={colors.textTertiary} style={{ marginBottom: 10 }} />
              <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>Kayıt bulunamadı.</Text>
            </View>
          }
        />
      )}

      {/* --- YENİ EKLENEN BÖLGE SEÇİM MODALI --- */}
      <CustomModal
        visible={regionModalVisible}
        onClose={() => setRegionModalVisible(false)}
        title="Rapor Detayı"
        type="default"
      >
        <View style={{ width: '100%' }}>
            <Text style={{ marginBottom: 10, color: colors.text, textAlign: 'center' }}>
                Rapor oluşturulmadan önce lütfen bugün çalışılan bölgeyi teyit edin.
            </Text>
            
            <View style={[styles.inputWrapper, { borderColor: colors.primary, backgroundColor: colors.cardBackground }]}>
                <Ionicons name="map-outline" size={20} color={colors.primary} style={{ marginRight: 10 }} />
                <TextInput 
                    value={workingRegion}
                    onChangeText={setWorkingRegion}
                    placeholder="Örn: İstanbul Avrupa - Beylikdüzü"
                    placeholderTextColor={colors.textTertiary}
                    style={{ flex: 1, color: colors.text, paddingVertical: 8 }}
                />
            </View>

            <ModalButton 
                title="Raporu Oluştur" 
                onPress={handleConfirmExport} 
                variant="primary" 
                style={{ marginTop: 20 }} 
            />
        </View>
      </CustomModal>

      {/* Genel Uyarı Modalı */}
      <CustomModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        type={modalType}
        title={modalType === 'success' ? 'Başarılı' : 'Hata'}
      >
        <Text style={{ textAlign: 'center', marginBottom: 20, color: colors.text }}>{modalMessage}</Text>
        <ModalButton title="Tamam" onPress={() => setModalVisible(false)} />
      </CustomModal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ... (Eski stillerin aynen kalacak) ...
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  dateControl: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  arrowBtn: { padding: 8 },
  dateTitle: { fontSize: 16, fontWeight: 'bold' },
  subTitle: { fontSize: 12 },
  pdfButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 25, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 3 },
  pdfBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  metricsContainer: { paddingVertical: 5, gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  metricCard: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, gap: 10 },
  metricIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 15, fontWeight: 'bold', marginTop: 2 },
  metricLabel: { fontSize: 10 },
  sectionHeader: { marginTop: 20, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', letterSpacing: 0.5 },
  emptyBox: { padding: 40, alignItems: 'center', marginTop: 20, opacity: 0.7 },
  timelineRow: { flexDirection: 'row', marginBottom: 0, minHeight: 100 },
  timelineLeft: { width: 55, alignItems: 'flex-end', marginRight: 12, paddingTop: 16 },
  timelineTime: { fontSize: 12, fontWeight: 'bold' },
  timelineLineContainer: { alignItems: 'center', width: 20, position: 'absolute', right: -11, top: 20, bottom: 0 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, zIndex: 2, backgroundColor: '#fff' },
  timelineLine: { width: 2, flex: 1, marginTop: -2, opacity: 0.2 },
  timelineCard: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 15, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2, justifyContent: 'center' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  placeName: { fontSize: 15, fontWeight: 'bold', flex: 1, marginRight: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  addressText: { fontSize: 12, marginBottom: 12 },
  miniStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', marginBottom: 8 },
  miniStat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  miniStatText: { fontSize: 11, fontWeight: '500' },
  compactContact: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 8, marginTop: 4 },
  contactText: { fontSize: 11, fontWeight: '500', flex: 1 },

  // YENİ INPUT STİLİ (MODAL İÇİN)
  inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 15,
      paddingVertical: 5
  }
});