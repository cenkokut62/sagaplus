import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { generateDailyReportPDF } from '@/services/pdfService';
import { CustomModal, ModalButton } from '@/components/CustomModal';

// Bu ekran, sagaplus/app/(tabs)/reports/index.tsx olarak kaydedilecektir.

export default function ReportsIndex() {
  const { colors } = useTheme();
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
  const [personnelInfo, setPersonnelInfo] = useState<any>(null);

  // Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'success' | 'error'>('success');
  const [modalMessage, setModalMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchReportData();
    }, [currentDate]) // Tarih değişince tetiklenir
  );

  const fetchReportData = async () => {
    try {
      if (!refreshing) setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Personel Bilgilerini Çek
      const { data: profile } = await supabase
        .from('profiles')
        .select(`
          full_name,
          title,
          city,
          team_members (
            teams ( name )
          )
        `)
        .eq('id', user.id)
        .single();

      const pInfo = {
        fullName: profile?.full_name || 'Bilinmiyor',
        title: profile?.title || 'Personel',
        city: profile?.city || 'Belirtilmedi',
        team: profile?.team_members?.[0]?.teams?.name || 'Ekipsiz'
      };
      setPersonnelInfo(pInfo);

      // 2. Günün Ziyaretlerini Çek (Tarih Aralığı: 00:00 - 23:59)
      const startOfDay = new Date(currentDate);
      startOfDay.setHours(0,0,0,0);
      const endOfDay = new Date(currentDate);
      endOfDay.setHours(23,59,59,999);

      // Ziyaretleri ve o ziyarete ait teklif sayısını çekmek için
      const { data: visitsData, error } = await supabase
        .from('visits')
        .select(`
          *,
          offers (id)
        `)
        .eq('user_id', user.id)
        .gte('started_at', startOfDay.toISOString())
        .lte('started_at', endOfDay.toISOString())
        .order('started_at', { ascending: false });

      if (error) throw error;

      // 3. Metrikleri Hesapla
      let planned = 0;
      let completed = 0;
      let durationSec = 0;
      let offerCnt = 0;
      
      const processedVisits = (visitsData || []).map((v: any) => {
        if(v.status === 'planned') planned++;
        if(v.status === 'completed') completed++;
        if(v.duration_seconds) durationSec += v.duration_seconds;
        
        // Teklif var mı? (offers dizisinin uzunluğu > 0)
        const hasOffer = v.offers && v.offers.length > 0;
        if(hasOffer) offerCnt++;

        return {
          ...v,
          offer_given: hasOffer
        };
      });

      setVisits(processedVisits);
      setMetrics({
        totalVisits: processedVisits.length,
        plannedVisits: planned,
        completedVisits: completed,
        totalDurationMinutes: Math.floor(durationSec / 60),
        offerCount: offerCnt,
        // Dönüşüm Oranı: (Teklif Sayısı / Tamamlanan Ziyaret Adedi) * 100
        conversionRate: completed > 0 ? Math.floor((offerCnt / completed) * 100) : 0
      });

    } catch (error) {
      console.error('Rapor hatası:', error);
      setModalType('error');
      setModalMessage('Rapor verileri çekilirken bir hata oluştu.');
      setModalVisible(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleExportPDF = async () => {
    if (visits.length === 0) {
      setModalType('error');
      setModalMessage('Bu güne ait ziyaret kaydı bulunmadığı için rapor oluşturulamıyor.');
      setModalVisible(true);
      return;
    }
    
    try {
      setLoading(true);
      await generateDailyReportPDF(metrics, visits, personnelInfo, currentDate);
      setModalType('success');
      setModalMessage('PDF Raporu başarıyla oluşturuldu ve paylaşıma hazır.');
      setModalVisible(true);
    } catch (e) {
      console.error(e);
      setModalType('error');
      setModalMessage('PDF oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.');
      setModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const changeDate = (days: number) => {
    // Sadece geçmişe ve bugüne gidilebilir
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    
    // Eğer yeni tarih bugünden büyükse (gelecekse) işlemi engelle
    const today = new Date();
    today.setHours(23,59,59,999);

    if (newDate.getTime() > today.getTime()) {
        return; // Geleceğe gitmeyi engelle
    }

    setCurrentDate(newDate);
  };
  
  const isToday = currentDate.toDateString() === new Date().toDateString();

  const onRefresh = () => {
    setRefreshing(true);
    fetchReportData();
  };

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

  const renderVisitRow = ({ item }: { item: any }) => {
    const isMissingContact = !item.contact_name && !item.contact_phone;
    
    return (
      <View style={[styles.visitRow, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <View style={styles.visitHeader}>
           <Text style={[styles.placeName, { color: colors.text }]}>{item.place_name}</Text>
           <View style={[styles.statusBadge, { 
             backgroundColor: item.status === 'completed' ? '#E8F5E9' : item.status === 'cancelled' ? '#FFEBEE' : '#E3F2FD'
           }]}>
             <Text style={{ 
               fontSize: 10, 
               color: item.status === 'completed' ? '#2E7D32' : item.status === 'cancelled' ? '#C62828' : '#1565C0', 
               fontWeight: 'bold' 
             }}>
               {item.status === 'completed' ? 'TAMAMLANDI' : item.status === 'cancelled' ? 'İPTAL' : 'PLANLI'}
             </Text>
           </View>
        </View>
        <Text style={[styles.addressText, { color: colors.textTertiary, marginBottom: 8 }]}>{item.place_address}</Text>

        <View style={styles.visitDetails}>
          <View style={styles.detailItem}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              Süre: {Math.floor((item.duration_seconds || 0) / 60)} dk
            </Text>
          </View>
          
          <View style={styles.detailItem}>
            <Ionicons name="document-text-outline" size={14} color={item.offer_given ? colors.success : colors.textSecondary} />
            <Text style={[styles.detailText, { color: item.offer_given ? colors.success : colors.textSecondary }]}>
              {item.offer_given ? 'Teklif Verildi' : 'Teklif Yok'}
            </Text>
          </View>

          <View style={styles.detailItem}>
            <Ionicons name="image-outline" size={14} color={item.card_image_url ? colors.primary : colors.textSecondary} />
            <Text style={[styles.detailText, { color: item.card_image_url ? colors.primary : colors.textSecondary }]}>
              {item.card_image_url ? 'Kartvizit Var' : 'Kartvizit Yok'}
            </Text>
          </View>
        </View>

        {(isMissingContact || item.contact_name) && (
             <View style={[styles.contactBox, { 
                 borderColor: isMissingContact ? colors.error : colors.border,
                 backgroundColor: isMissingContact ? colors.error + '10' : colors.surface
             }]}>
                 {isMissingContact ? (
                     <View style={styles.contactItem}>
                        <Ionicons name="alert-circle" size={14} color={colors.error} />
                        <Text style={[styles.contactText, { color: colors.error, fontWeight: '500' }]}>Yetkili/İletişim bilgisi EKLEMEMİŞ</Text>
                     </View>
                 ) : (
                    <>
                       <View style={styles.contactItem}>
                           <Ionicons name="person-outline" size={14} color={colors.text} />
                           <Text style={[styles.contactText, { color: colors.text }]}>{item.contact_name}</Text>
                       </View>
                       {item.contact_phone && (
                           <View style={styles.contactItem}>
                               <Ionicons name="call-outline" size={14} color={colors.text} />
                               <Text style={[styles.contactText, { color: colors.text }]}>{item.contact_phone}</Text>
                           </View>
                       )}
                    </>
                 )}
             </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      
      {/* HEADER & DATE PICKER */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.dateControl}>
           <TouchableOpacity onPress={() => changeDate(-1)} style={styles.arrowBtn}>
             <Ionicons name="chevron-back" size={24} color={colors.text} />
           </TouchableOpacity>
           <View style={{ alignItems: 'center' }}>
             <Text style={[styles.dateTitle, { color: colors.text }]}>
               {isToday ? 'BUGÜN' : currentDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
             </Text>
             <Text style={[styles.subTitle, { color: colors.textSecondary }]}>Günlük Rapor</Text>
           </View>
           <TouchableOpacity onPress={() => changeDate(1)} style={styles.arrowBtn} disabled={isToday}>
             <Ionicons name="chevron-forward" size={24} color={isToday ? colors.textTertiary : colors.text} />
           </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
           style={[styles.pdfButton, { backgroundColor: colors.primary }]} 
           onPress={handleExportPDF}
           disabled={loading}
        >
          {loading ? (
             <ActivityIndicator color="#fff" size="small" />
          ) : (
             <>
               <Ionicons name="print" size={20} color="#fff" />
               <Text style={styles.pdfBtnText}>PDF</Text>
             </>
          )}
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={visits} // Listeyi FlatList'e aktardık
          keyExtractor={(item) => item.id}
          renderItem={renderVisitRow}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
          ListHeaderComponent={() => (
             <View style={{ paddingBottom: 10 }}>
                {/* METRICS GRID */}
                <View style={styles.metricsContainer}>
                  <View style={styles.row}>
                    {renderMetricCard('Toplam Ziyaret', metrics.totalVisits, 'location', colors.primary)}
                    {renderMetricCard('Tamamlanan', metrics.completedVisits, 'checkmark-circle', colors.success)}
                    {renderMetricCard('Planlanan', metrics.plannedVisits, 'calendar', '#455A64')}
                  </View>
                  <View style={styles.row}>
                    {renderMetricCard('Teklif Sayısı', metrics.offerCount, 'document-text', '#F57C00')}
                    {renderMetricCard('Dönüşüm', `%${metrics.conversionRate}`, 'trending-up', '#7B1FA2')}
                    {renderMetricCard('Toplam Süre', `${metrics.totalDurationMinutes} dk`, 'time', '#0288D1')}
                  </View>
                </View>
                
                {/* VISIT LIST HEADER */}
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Ziyaret Hareketleri</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{visits.length} Kayıt</Text>
                </View>
             </View>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="alert-circle-outline" size={32} color={colors.textSecondary} style={{ marginBottom: 10 }} />
              <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>Bu tarihte size ait tamamlanmış/planlanmış ziyaret kaydı bulunamadı.</Text>
            </View>
          }
        />
      )}

      {/* CUSTOM MODAL */}
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
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    padding: 16, borderBottomWidth: 1 
  },
  dateControl: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  arrowBtn: { padding: 5 },
  dateTitle: { fontSize: 16, fontWeight: 'bold' },
  subTitle: { fontSize: 12 },
  pdfButton: { 
    flexDirection: 'row', alignItems: 'center', gap: 6, 
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 
  },
  pdfBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  
  metricsContainer: { paddingVertical: 10, gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  metricCard: { 
    flex: 1, flexDirection: 'row', alignItems: 'center', 
    padding: 12, borderRadius: 12, borderWidth: 1, gap: 12 
  },
  metricIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 16, fontWeight: 'bold', marginTop: 2 },
  metricLabel: { fontSize: 11 },

  sectionHeader: { 
    paddingVertical: 10, 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' 
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold' },
  
  emptyBox: { padding: 20, alignItems: 'center', marginTop: 20, borderTopWidth: 1, borderTopColor: '#eee' },
  
  visitRow: { 
    padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 10 
  },
  visitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  placeName: { fontWeight: 'bold', fontSize: 15, flex: 1 },
  addressText: { fontSize: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginLeft: 8, alignSelf: 'flex-start' },
  
  visitDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginBottom: 12, marginTop: 4 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: 11 },
  
  contactBox: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
      borderRadius: 8,
      borderWidth: 1,
      marginTop: 8,
      justifyContent: 'space-between',
      flexWrap: 'wrap'
  },
  contactItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginRight: 10,
  },
  contactText: { fontSize: 12 },
});