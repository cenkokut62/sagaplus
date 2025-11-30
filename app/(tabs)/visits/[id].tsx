import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { generateAndSharePDF } from '@/services/pdfService';

export default function VisitDetailScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const router = useRouter();
  
  const [visit, setVisit] = useState<any>(null);
  const [offer, setOffer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVisitDetails();
  }, [id]);

  const fetchVisitDetails = async () => {
    try {
      // 1. Ziyaret Detayını Çek
      const { data: visitData, error: visitError } = await supabase
        .from('visits')
        .select('*')
        .eq('id', id)
        .single();
      
      if (visitError) throw visitError;
      setVisit(visitData);

      // 2. Teklif Detayını Çek (Varsa, oluşturan personel bilgisiyle birlikte)
      const { data: offerData, error: offerError } = await supabase
        .from('offers')
        .select(`
          *,
          profiles:user_id (
            full_name,
            email,
            phone,
            titles (name)
          )
        `)
        .eq('visit_id', id)
        .maybeSingle();
      
      if (offerData) setOffer(offerData);

    } catch (error) {
      console.error('Detay hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h === 0 && m === 0) return "< 1 dk";
    return `${h > 0 ? h + ' sa ' : ''}${m} dk`;
  };

  const getDisplayDuration = () => {
    if (visit.duration_seconds && visit.duration_seconds > 0) {
        return formatDuration(visit.duration_seconds);
    }
    if (visit.started_at && visit.ended_at) {
        const start = new Date(visit.started_at).getTime();
        const end = new Date(visit.ended_at).getTime();
        const diffSec = Math.floor((end - start) / 1000);
        return formatDuration(diffSec);
    }
    return "0 dk";
  };

  const handleOpenPDF = async () => {
    if (!offer || !offer.products_data) {
        Alert.alert('Hata', 'Görüntülenecek teklif verisi bulunamadı.');
        return;
    }

    try {
      // Veritabanındaki kayıtlı PDF verisini al
      let pdfPayload = { ...offer.products_data };

      // EĞER kayıtlı veride personel bilgisi yoksa (Eski kayıtlar için düzeltme)
      // İlişkili tablodan (profiles) gelen güncel bilgiyi ekle
      if (!pdfPayload.personnel && offer.profiles) {
          pdfPayload.personnel = {
              fullName: offer.profiles.full_name || 'Yetkili',
              title: offer.profiles.titles?.name || 'Güvenlik Danışmanı',
              email: offer.profiles.email || '',
              phone: offer.profiles.phone || ''
          };
      }

      // PDF oluştur ve paylaşımı aç (true parametresi ile)
      await generateAndSharePDF(pdfPayload, true);

    } catch (e) {
      console.error('PDF Oluşturma Hatası:', e);
      Alert.alert('Hata', 'PDF dosyası oluşturulurken bir sorun oluştu.');
    }
  };

  if (loading) return <View style={[styles.center, {backgroundColor: colors.background}]}><ActivityIndicator color={colors.primary} /></View>;
  if (!visit) return <View style={[styles.center, {backgroundColor: colors.background}]}><Text style={{color: colors.text}}>Ziyaret bulunamadı.</Text></View>;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Ziyaret Detayı</Text>
        <View style={{ width: 32 }} /> 
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* İşletme Kartı */}
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          <View style={[styles.iconBox, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="business" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.placeName, { color: colors.text }]}>{visit.place_name}</Text>
          <Text style={[styles.placeAddress, { color: colors.textSecondary }]}>{visit.place_address}</Text>
          
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {new Date(visit.started_at).toLocaleDateString('tr-TR')}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {getDisplayDuration()}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: visit.status === 'completed' ? '#E8F5E9' : (visit.status === 'planned' ? '#E3F2FD' : '#FFF3E0') }]}>
              <Text style={{ 
                color: visit.status === 'completed' ? '#2E7D32' : (visit.status === 'planned' ? '#1565C0' : '#EF6C00'), 
                fontSize: 12, fontWeight: 'bold' 
              }}>
                {visit.status === 'completed' ? 'Tamamlandı' : (visit.status === 'planned' ? 'Planlandı' : 'Devam Ediyor')}
              </Text>
            </View>
          </View>
        </View>

        {/* Yetkili Bilgileri */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Yetkili Bilgileri</Text>
          <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Ad Soyad:</Text>
              <Text style={[styles.value, { color: colors.text }]}>{visit.contact_name || '-'}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Telefon:</Text>
              <Text style={[styles.value, { color: colors.text }]}>{visit.contact_phone || '-'}</Text>
            </View>
          </View>
        </View>

        {/* Kartvizit Görseli */}
        {visit.card_image_url && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Kartvizit</Text>
            <Image 
              source={{ uri: visit.card_image_url }} 
              style={styles.cardImage} 
              resizeMode="cover"
            />
          </View>
        )}

        {/* Teklif Detayı */}
        {offer && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Hazırlanan Teklif</Text>
            <View style={[styles.offerCard, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
                <View style={styles.offerHeader}>
                  <Ionicons name="document-text" size={24} color={colors.primary} />
                  <View>
                    <Text style={[styles.offerTitle, { color: colors.text }]}>Güvenlik Sistemi Teklifi</Text>
                    <Text style={[styles.offerDate, { color: colors.textSecondary }]}>
                      {new Date(offer.created_at).toLocaleString('tr-TR')}
                    </Text>
                  </View>
                </View>

                <View style={styles.offerDetails}>
                  <Text style={[styles.offerPriceLabel, { color: colors.textSecondary }]}>Toplam Tutar:</Text>
                  <Text style={[styles.offerPrice, { color: colors.primary }]}>
                    {offer.total_price?.toLocaleString('tr-TR')} ₺
                  </Text>
                </View>

                {offer.is_campaign_applied && (
                  <View style={styles.campaignTag}>
                    <Ionicons name="checkmark-circle" size={16} color="#155724" />
                    <Text style={styles.campaignText}>Ücretsiz Aktivasyon Kampanyası</Text>
                  </View>
                )}

                <TouchableOpacity 
                  style={[styles.pdfButton, { backgroundColor: colors.primary }]}
                  onPress={handleOpenPDF}
                >
                  <Text style={styles.pdfButtonText}>Teklifi Görüntüle / Paylaş</Text>
                  <Ionicons name="share-outline" size={20} color="#fff" />
                </TouchableOpacity>
             </View>
          </View>
        )}

        {/* ZİYARET NOTLARI */}
        {visit.visit_notes && (
          <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Ziyaret Notları</Text>
              <View style={[styles.noteCard, { backgroundColor: colors.surface }]}>
                <Text style={{ color: colors.text, fontStyle: 'italic' }}>"{visit.visit_notes}"</Text>
              </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  backButton: { padding: 4 },
  content: { padding: 20, paddingBottom: 40 },
  
  card: { padding: 20, borderRadius: 16, alignItems: 'center', marginBottom: 24, shadowColor: "#000", shadowOffset: {width:0, height:2}, shadowOpacity:0.1, shadowRadius:4, elevation:3 },
  iconBox: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  placeName: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  placeAddress: { fontSize: 14, textAlign: 'center', marginBottom: 16 },
  
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 14, fontWeight: '500' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  infoCard: { borderRadius: 12, padding: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  label: { fontSize: 14 },
  value: { fontSize: 14, fontWeight: '600' },
  divider: { height: 1, width: '100%' },
  
  cardImage: { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#eee' },
  
  offerCard: { borderWidth: 1, borderRadius: 16, padding: 16 },
  offerHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  offerTitle: { fontSize: 16, fontWeight: 'bold' },
  offerDate: { fontSize: 12 },
  offerDetails: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  offerPriceLabel: { fontSize: 14 },
  offerPrice: { fontSize: 20, fontWeight: 'bold' },
  
  campaignTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#d4edda', padding: 10, borderRadius: 8, marginBottom: 16, gap: 8 },
  campaignText: { color: '#155724', fontWeight: '600', fontSize: 13 },
  
  pdfButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 8 },
  pdfButtonText: { color: '#fff', fontWeight: 'bold' },
  
  noteCard: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#eee', borderStyle: 'dashed' }
});