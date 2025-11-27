import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { CustomModal, ModalButton } from '@/components/CustomModal';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker'; 
import { Clock, Calculator } from 'lucide-react-native'; // Lucide ikonları

// --- KULLANICININ GERÇEK SES TANIMA MODÜLÜ TANIMLARI ---
// Bu importların çalışması için 'expo-speech-recognition' paketinin yüklü olması gerekmektedir.
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
// --- TANIMLAR SONU ---

interface Offer {
    id: string;
    pdf_url: string;
    total_price: number;
    is_campaign_applied: boolean;
    created_at: string;
}

export default function ActiveVisitScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  
  const [visit, setVisit] = useState<any>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);
  
  // Ziyaret Tamamlama Formu State'leri
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [cardImageUrl, setCardImageUrl] = useState<string | null>(null);

  // Sesli Konuşma State'leri
  const [isRecording, setIsRecording] = useState(false);
  
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  
  // Modal State'leri
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'success' | 'error' | 'warning' | 'default'>('default');
  const [modalMessage, setModalMessage] = useState('');
  const [modalAction, setModalAction] = useState<() => void>(() => {}); // Default olarak boş fonksiyon

  const [choiceModalVisible, setChoiceModalVisible] = useState(false);

  // Sesli not kaydı durduğunda, konuşmanın ekleneceği başlangıç noktası
  const [initialNotesLength, setInitialNotesLength] = useState(0);


  // --- SES TANIMA HOOK ENTEGRASYONU ---
  useSpeechRecognitionEvent("start", () => {
      // Kayıt başladığında mevcut notların uzunluğunu kaydet (bu noktadan sonra ekleme yapacağız)
      setInitialNotesLength(visitNotes.length);
      setIsRecording(true);
  });
  
  useSpeechRecognitionEvent("end", () => {
      setIsRecording(false);
  });

  useSpeechRecognitionEvent("result", (event: any) => {
    if (event.results && event.results.length > 0) {
      const newTranscript = event.results[0]?.transcript || '';
      
      // Mevcut notların başlangıç kısmını koru
      const staticNotes = visitNotes.substring(0, initialNotesLength);
      
      // Notları, statik kısım + yeni transkript olarak güncelle
      setVisitNotes(staticNotes + newTranscript);
    }
  });
  // --- SES TANIMA HOOK ENTEGRASYONU SONU ---

  // Ziyaret Süresi Takibi
  useEffect(() => {
    const interval = setInterval(() => {
        if (visit && visit.status === 'active') {
            const now = new Date();
            const diff = Math.floor((now.getTime() - new Date(visit.started_at).getTime()) / 1000);
            setElapsedTime(diff > 0 ? diff : 0);
        }
    }, 1000);
    return () => clearInterval(interval);
  }, [visit]);

  useFocusEffect(
    useCallback(() => {
        if (visitId) {
            fetchVisitData();
        }
    }, [visitId])
  );

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const fetchVisitData = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('visits')
        .select(`
            *,
            offers(id, pdf_url, total_price, is_campaign_applied, created_at)
        `)
        .eq('id', visitId)
        .single();
      
      if (error) throw error;
      
      setVisit(data);
      setStartTime(new Date(data?.started_at || new Date()));

      // En son oluşturulan teklifi al
      const lastOffer = data?.offers?.length > 0 ? data.offers.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] : null;
      setOffer(lastOffer); 

      setContactName(data?.contact_name || '');
      setContactPhone(data?.contact_phone || '');
      setVisitNotes(data?.visit_notes || '');
      setCardImageUrl(data?.card_image_url || null);

    } catch (error) {
      console.error('Ziyaret verisi çekilemedi:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // KARTVİZİT İŞLEMLERİ: Kamera ile Anlık Çekme ve Kırpma 
  const handleUploadCard = async () => {
      // Kamera izni iste
      let cameraPermissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (!cameraPermissionResult.granted) {
          setModalType('error');
          setModalMessage('Kartvizit fotoğrafı çekmek için kamera erişim izni gerekiyor.');
          setModalAction(() => () => {}); // Hata durumunda boş aksiyon
          setModalVisible(true);
          return;
      }
      
      // Kamerayı aç, kırpmaya izin ver
      let pickerResult = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true, // Kırpma aktif
          aspect: [4, 3], // Kartvizit için standart bir oran
          quality: 0.8,
      });

      if (pickerResult.canceled || !pickerResult.assets) return;

      const uri = pickerResult.assets[0].uri;
      const fileExt = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const fileName = `${visitId}_card_${Date.now()}.${fileExt}`;
      // *** DÜZELTME: Bucket adı visit-cards olarak değiştirildi. ***
      const storagePath = `visit-cards/${fileName}`;

      try {
          setLoading(true);
          // 1. ArrayBuffer al
          const response = await fetch(uri);
          const arraybuffer = await response.arrayBuffer();

          // 2. Supabase Storage'a yükle
          const { error: uploadError } = await supabase.storage
              .from('visit-cards') // DÜZELTME: Bucket adı visit-cards
              .upload(storagePath, arraybuffer, {
                  contentType: `image/${fileExt}`,
                  upsert: true,
              });

          if (uploadError) throw uploadError;

          // 3. Public URL'i al
          const { data: publicUrlData } = supabase.storage
              .from('visit-cards') // DÜZELTME: Bucket adı visit-cards
              .getPublicUrl(storagePath);
          
          const newUrl = publicUrlData.publicUrl;
          
          setCardImageUrl(newUrl);

          setModalType('success');
          setModalMessage('Kartvizit fotoğrafı başarıyla yüklendi.');
          setModalAction(() => () => {}); // Başarı durumunda boş aksiyon
          setModalVisible(true);
      } catch (error) {
          console.error('Kartvizit yükleme hatası:', error);
          setModalType('error');
          setModalMessage('Kartvizit yüklenirken bir hata oluştu. Dosya boyutu veya bağlantı hatası olabilir.');
          setModalAction(() => () => {}); // Hata durumunda boş aksiyon
          setModalVisible(true);
      } finally {
          setLoading(false);
      }
  };
  
  const handleDeleteCard = async () => {
      setCardImageUrl(null);
      setModalType('success');
      setModalMessage('Kartvizit görseli kaldırıldı.');
      setModalAction(() => () => {}); // Başarı durumunda boş aksiyon
      setModalVisible(true);
  };
  
  // SESLİ NOT İŞLEMLERİ: START/STOP 
  const handleStartRecording = async () => {
    if (isRecording) {
      ExpoSpeechRecognitionModule.stop();
      // stop() çağrıldığında useSpeechRecognitionEvent("end", ...) hook'u çalışacak.
      
      setModalType('default');
      setModalMessage('Sesli not kaydı durduruldu.');
      setModalAction(() => () => {}); // Default durumda boş aksiyon
      setModalVisible(true);
      return;
    }

    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) {
      setModalType('error');
      setModalMessage('Mikrofon ve ses tanıma izni vermeniz gerekiyor.');
      setModalAction(() => () => {}); // Hata durumunda boş aksiyon
      setModalVisible(true);
      return;
    }

    // Gerçek başlatma
    ExpoSpeechRecognitionModule.start({
      lang: 'tr-TR',
      interimResults: true, // Anlık sonuçları al
      maxAlternatives: 1,
      continuous: false,
      requiresOnDeviceRecognition: false,
      addsPunctuation: true,
    });
  };

  const handleFinishVisit = async () => {
    setModalVisible(false);
    setIsFinishing(true);
    try {
      const now = new Date();
      const durationSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
          
      const { error } = await supabase
        .from('visits')
        .update({
          status: 'completed',
          ended_at: now.toISOString(),
          duration_seconds: durationSeconds,
          contact_name: contactName,
          contact_phone: contactPhone,
          visit_notes: visitNotes.trim() || null, 
          card_image_url: cardImageUrl,
        })
        .eq('id', visitId);

      if (error) throw error;

      setModalType('success');
      setModalMessage('Ziyaret başarıyla tamamlandı ve kaydedildi.');
      setModalAction(() => () => router.replace('/(tabs)/visits'));
      setModalVisible(true);

    } catch (error) {
      console.error('Ziyaret sonlandırılamadı:', error);
      setModalType('error');
      setModalMessage('Ziyaret sonlandırma hatası.');
      setModalAction(() => { setModalVisible(false); });
      setModalVisible(true);
    } finally {
      setIsFinishing(false);
    }
  };

  const handlePrepareOffer = () => { setChoiceModalVisible(true); };
  
  const navigateToCalculator = (type: 'standard' | 'premium') => {
      setChoiceModalVisible(false);
      router.push({ 
          pathname: `/(tabs)/calculator/${type}`, 
          params: { 
              visitId: visitId,
              clientName: visit?.place_name, 
              placeAddress: visit?.place_address,
              isVisitFlow: 'true'
          } 
      });
  };

  const handleShareOffer = async () => {
    if (!offer || !offer.pdf_url) {
        setModalType('error');
        setModalMessage('PDF dosyası bulunamadı. Lütfen teklifi tekrar oluşturun.');
        setModalAction(() => () => {}); // Hata durumunda boş aksiyon
        setModalVisible(true);
        return;
    }
    try { await Sharing.shareAsync(offer.pdf_url); } catch (error) {
        setModalType('error');
        setModalMessage('Teklif paylaşılırken bir hata oluştu.');
        setModalAction(() => () => {}); // Hata durumunda boş aksiyon
        setModalVisible(true);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
                <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.primary }]}>Ziyaret Devam Ediyor</Text>
            <View style={{ width: 24 }} />
        </View>

        {/* Place Info */}
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.placeName, { color: colors.text }]}>{visit.place_name}</Text>
          <Text style={[styles.placeAddress, { color: colors.textSecondary, marginTop: 4 }]}>
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} /> {visit.place_address}
          </Text>
          <View style={styles.timerCard}>
             <Clock size={24} color={colors.primary} />
             <View style={styles.timerContent}>
                <Text style={[styles.timerLabel, { color: colors.textSecondary }]}>Ziyaret Süresi</Text>
                <Text style={[styles.timerValue, { color: colors.primary }]}>{formatTime(elapsedTime)}</Text>
                <Text style={[styles.startTimeText, { color: colors.textTertiary }]}>
                     Başlangıç: {new Date(visit.started_at).toLocaleTimeString('tr-TR')}
                </Text>
             </View>
          </View>
        </View>

        {/* KARTVİZİT BÖLÜMÜ */}
        <View style={styles.actionSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Kartvizit Görseli</Text>
            {cardImageUrl ? (
                <View style={[styles.imageContainer, { borderColor: colors.border }]}>
                    <Image source={{ uri: cardImageUrl }} style={styles.cardImage} resizeMode="cover" />
                    <View style={styles.imageActions}>
                        <TouchableOpacity style={[styles.deleteButton, { backgroundColor: colors.error }]} onPress={() => {
                            setModalType('warning');
                            setModalMessage('Kartvizit görselini kaldırmak istediğinizden emin misiniz?');
                            setModalAction(() => handleDeleteCard);
                            setModalVisible(true);
                        }}>
                           <Ionicons name="trash-outline" size={20} color="#fff" />
                           <Text style={styles.deleteButtonText}>Kaldır</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                <TouchableOpacity 
                    style={[styles.uploadButton, { backgroundColor: colors.primary }]} 
                    onPress={handleUploadCard}
                    disabled={loading}
                >
                    <Ionicons name="camera-outline" size={20} color="#fff" style={{ marginRight: 10 }} />
                    <Text style={styles.deleteButtonText}>Kartvizit Fotoğrafı Çek</Text>
                </TouchableOpacity>
            )}
             <Text style={[styles.infoText, { color: colors.textSecondary, marginTop: 5 }]}>
                {cardImageUrl ? `Görsel yüklendi: ${cardImageUrl.substring(0, 50)}...` : 'Kartvizit yüklenmemiş.'}
             </Text>
        </View>
        
        {/* Teklif Yönetimi */}
        <View style={styles.actionSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Teklif Yönetimi</Text>
            
            {offer ? (
                <View style={[styles.offerCard, { backgroundColor: colors.surface, borderColor: colors.success }]}>
                    <Ionicons name="document-text" size={20} color={colors.success} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.offerText, { color: colors.text, fontWeight: 'bold' }]}>
                            Teklif Hazır: {offer.total_price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </Text>
                        <Text style={[styles.offerSubText, { color: colors.textSecondary }]}>
                            {offer.is_campaign_applied ? 'Kampanyalı Teklif' : 'Standart Teklif'} ({new Date(offer.created_at).toLocaleDateString('tr-TR')})
                        </Text>
                        <Text style={[styles.offerPdfText, { color: colors.textTertiary, marginTop: 2 }]}>
                           PDF URL: {offer.pdf_url ? `${offer.pdf_url.substring(0, 30)}...` : 'Bulunamadı'}
                        </Text>
                    </View>
                    {/* Paylaş Butonu */}
                    <TouchableOpacity style={[styles.shareButton, { backgroundColor: colors.primary }]} onPress={handleShareOffer}>
                         <Ionicons name="share-social-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                    {/* Güncelle Butonu */}
                    <TouchableOpacity style={[styles.editButton, { backgroundColor: colors.warning }]} onPress={handlePrepareOffer}>
                         <Ionicons name="create-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            ) : (
                // Dikkat çekici Teklif Hazırla Butonu
                <TouchableOpacity 
                    style={[styles.offerButton, { backgroundColor: colors.primary }]}
                    onPress={handlePrepareOffer}
                >
                    <Calculator size={24} color="#fff" style={{ marginRight: 15 }} />
                    <Text style={styles.offerButtonText}>Teklif Hazırla</Text>
                </TouchableOpacity>
            )}
        </View>

        {/* Ziyaret Sonlandırma Formu (TextInput Kullanımı) */}
        <View style={styles.formSection}>
          <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 15 }]}>Ziyareti Sonlandırma Bilgileri</Text>
          
          {/* Yetkili Adı Soyadı */}
          <View style={{ marginBottom: 15 }}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Yetkili Adı Soyadı</Text>
              <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}>
                  <Ionicons name="person-outline" size={20} color={colors.textSecondary} style={{ marginRight: 10 }} />
                  <TextInput
                      style={[styles.inputField, { color: colors.text }]}
                      value={contactName}
                      onChangeText={setContactName}
                      placeholder="Görüştüğünüz yetkili"
                      placeholderTextColor={colors.textTertiary}
                  />
              </View>
          </View>

          {/* Yetkili Telefonu */}
          <View style={{ marginBottom: 15 }}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Yetkili Telefonu</Text>
              <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}>
                  <Ionicons name="call-outline" size={20} color={colors.textSecondary} style={{ marginRight: 10 }} />
                  <TextInput
                      style={[styles.inputField, { color: colors.text }]}
                      value={contactPhone}
                      onChangeText={setContactPhone}
                      placeholder="5XX XXX XX XX"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="phone-pad"
                  />
              </View>
          </View>
          
          {/* Ziyaret Notları (Sesli Not Anlık Entegre) */}
          <View style={{ marginBottom: 15 }}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Ziyaret Notları</Text>
              <View style={[styles.inputWrapper, styles.multilineWrapper, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}>
                  <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} style={{ marginRight: 10, alignSelf: 'flex-start', marginTop: 15 }} />
                  <TextInput
                      style={[styles.inputField, styles.largeInput, { color: colors.text }]}
                      value={visitNotes}
                      onChangeText={setVisitNotes}
                      placeholder="Ziyaret detayları, sonuçlar vb."
                      placeholderTextColor={colors.textTertiary}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                  />
                  {/* Mic Button integrated */}
                  <TouchableOpacity 
                      style={[styles.micButton, { 
                          backgroundColor: isRecording ? colors.error : colors.warning 
                      }]}
                      onPress={handleStartRecording}
                  >
                      <Ionicons 
                          name={isRecording ? "stop" : "mic"} 
                          size={18} 
                          color="#fff" 
                      />
                  </TouchableOpacity>
              </View>
          </View>
          
          {isRecording && (
              <Text style={[styles.recordingText, { color: colors.error }]}>
                  <Ionicons name="pulse" size={14} color={colors.error} /> KAYIT DEVAM EDİYOR... 
              </Text>
          )}
          
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
             * Konuşma tanıma, siz konuşurken doğrudan not alanına ekleme yapar.
          </Text>

          <TouchableOpacity 
            style={[styles.finishButton, { backgroundColor: colors.error, opacity: isFinishing ? 0.7 : 1 }]}
            onPress={() => {
                setModalType('warning');
                setModalMessage('Ziyareti tamamlamak istediğinize emin misiniz? Bu işlem geri alınamaz ve ziyaret geçmişe taşınır.');
                setModalAction(() => handleFinishVisit);
                setModalVisible(true);
            }}
            disabled={isFinishing}
          >
            {isFinishing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.finishButtonText}>Ziyareti Kaydet ve Bitir</Text>
            )}
          </TouchableOpacity>
          
        </View>

      </ScrollView>
      
      {/* Onay Modalı */}
      <CustomModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={modalType === 'warning' ? 'Ziyaret Sonlandırma Onayı' : modalType === 'success' ? 'Başarılı' : modalType === 'default' ? 'Bilgi' : 'Hata'}
        type={modalType}
      >
        <Text style={{ textAlign: 'center', marginBottom: 20, color: colors.text }}>{modalMessage}</Text>
        <ModalButton 
          title={modalType === 'warning' ? 'Evet, Bitir' : 'Tamam'} 
          onPress={() => { setModalVisible(false); modalAction(); }} 
          variant={modalType === 'warning' ? 'danger' : 'primary'}
        />
        {modalType === 'warning' && (
            <ModalButton 
                title="Vazgeç" 
                onPress={() => setModalVisible(false)} 
                variant="secondary"
            />
        )}
      </CustomModal>
      
      {/* Teklif Tipi Seçme Modalı */}
      <CustomModal
        visible={choiceModalVisible}
        onClose={() => setChoiceModalVisible(false)}
        title="Teklif Tipini Seçin"
        type="default"
      >
        <Text style={{ textAlign: 'center', marginBottom: 20, color: colors.text }}>
           Hangi tip paket üzerinden teklif oluşturmak istersiniz?
        </Text>
        <ModalButton 
          title="Paradox Paket (Standart)" 
          onPress={() => navigateToCalculator('standard')} 
          variant="primary"
          style={{ marginBottom: 10 }}
        />
        <ModalButton 
          title="Kale Alarm X (Premium - Hub Uyumlu)" 
          onPress={() => navigateToCalculator('premium')} 
          variant="secondary"
        />
      </CustomModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  
  card: { padding: 15, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
  placeName: { fontSize: 20, fontWeight: 'bold' },
  placeAddress: { fontSize: 13, flexDirection: 'row', alignItems: 'center' },

  timerCard: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      marginTop: 15, 
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: '#eee',
  },
  timerContent: { marginLeft: 10 },
  timerLabel: { fontSize: 12, opacity: 0.8 },
  timerValue: { fontSize: 24, fontWeight: 'bold' },
  startTimeText: { fontSize: 12, opacity: 0.7 },

  actionSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  
  // KARTVİZİT STYLES
  imageContainer: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', height: 180, marginBottom: 10 },
  cardImage: { width: '100%', height: '100%' },
  imageActions: { position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  uploadButton: {
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  deleteButton: {
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  deleteButtonText: { color: '#fff', fontWeight: 'bold' },
  // KARTVİZİT STYLES SONU

  // TEKLİF STYLES
  offerButton: {
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  offerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  offerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
  },
  offerText: { fontSize: 15 },
  offerSubText: { fontSize: 12, marginTop: 2 },
  offerPdfText: { fontSize: 10 }, 
  shareButton: {
    padding: 8,
    borderRadius: 8,
    marginLeft: 10,
  },
  editButton: {
    padding: 8,
    borderRadius: 8,
    marginLeft: 5,
  },
  // TEKLİF STYLES SONU

  formSection: { padding: 10, borderRadius: 12, borderWidth: 0 },
  
  // INPUT STYLES (TextInput Kullanımı)
  inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 5,
      paddingLeft: 5,
  },
  inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 15,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      minHeight: 48,
  },
  inputField: {
      flex: 1,
      paddingVertical: 5,
      fontSize: 16,
  },
  multilineWrapper: {
    alignItems: 'flex-start', // İkonu üste hizala
  },
  largeInput: {
      height: 100, // Multiline için yeterli yükseklik
      textAlignVertical: 'top',
  },
  micButton: {
      position: 'absolute',
      right: 10,
      top: 10,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
  },
  // INPUT STYLES SONU

  recordingText: { fontSize: 12, marginTop: 5, fontWeight: 'bold' },
  infoText: { fontSize: 11, marginTop: 5, marginBottom: 20 },

  finishButton: {
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  finishButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});