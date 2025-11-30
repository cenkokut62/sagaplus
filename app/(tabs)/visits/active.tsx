import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image, Platform, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { CustomModal, ModalButton } from '@/components/CustomModal';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker'; 
import * as Notifications from 'expo-notifications'; 
// RNDateTimePicker'ı tamamen kaldırdık.
import { Clock, Calculator, Calendar as CalendarIcon, Check } from 'lucide-react-native';

// Ses Tanıma Modülü
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

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
  
  // Form State'leri
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [cardImageUrl, setCardImageUrl] = useState<string | null>(null);

  // Sesli Not State'leri
  const [isRecording, setIsRecording] = useState(false);
  const [initialNotesLength, setInitialNotesLength] = useState(0);
  
  // Süre Takibi
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  
  // Modal State'leri
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'success' | 'error' | 'warning' | 'default'>('default');
  const [modalMessage, setModalMessage] = useState('');
  const [modalAction, setModalAction] = useState<() => void>(() => {}); 
  const [choiceModalVisible, setChoiceModalVisible] = useState(false);

  // --- CUSTOM DATE PICKER STATE'LERİ ---
  const [customPickerVisible, setCustomPickerVisible] = useState(false);
  const [selectedDateIndex, setSelectedDateIndex] = useState(0); // 0 = Bugün
  const [selectedHour, setSelectedHour] = useState('09');
  const [selectedMinute, setSelectedMinute] = useState('00');
  
  // Gelecek 30 günü hesapla
  const generateDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        dates.push(d);
    }
    return dates;
  };
  const dateOptions = generateDates();
  const hours = Array.from({ length: 14 }, (_, i) => (i + 8).toString().padStart(2, '0')); // 08:00 - 21:00 arası
  const minutes = ['00', '15', '30', '45'];

  // --- SES TANIMA HOOK ---
  useSpeechRecognitionEvent("start", () => {
      setInitialNotesLength(visitNotes.length);
      setIsRecording(true);
  });
  
  useSpeechRecognitionEvent("end", () => {
      setIsRecording(false);
  });

  useSpeechRecognitionEvent("result", (event: any) => {
    if (event.results && event.results.length > 0) {
      const newTranscript = event.results[0]?.transcript || '';
      const staticNotes = visitNotes.substring(0, initialNotesLength);
      setVisitNotes(staticNotes + newTranscript);
    }
  });

  // Ziyaret Süresi Sayacı
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
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const fetchVisitData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('visits')
        .select(`*, offers(id, pdf_url, total_price, is_campaign_applied, created_at)`)
        .eq('id', visitId)
        .single();
      
      if (error) throw error;
      
      setVisit(data);
      setStartTime(new Date(data?.started_at || new Date()));

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
  
  // --- KARTVİZİT İŞLEMLERİ ---
  const handleUploadCard = async () => {
      let permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
          setModalType('error');
          setModalMessage('Kamera izni gerekli.');
          setModalVisible(true);
          return;
      }
      
      let result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
      });

      if (result.canceled || !result.assets) return;

      const uri = result.assets[0].uri;
      const fileExt = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const fileName = `${visitId}_card_${Date.now()}.${fileExt}`;
      const storagePath = `visit-cards/${fileName}`;

      try {
          setLoading(true);
          const response = await fetch(uri);
          const arraybuffer = await response.arrayBuffer();

          const { error: uploadError } = await supabase.storage
              .from('visit-cards')
              .upload(storagePath, arraybuffer, { contentType: `image/${fileExt}`, upsert: true });

          if (uploadError) throw uploadError;

          const { data: publicUrlData } = supabase.storage.from('visit-cards').getPublicUrl(storagePath);
          setCardImageUrl(publicUrlData.publicUrl);

          setModalType('success');
          setModalMessage('Kartvizit yüklendi.');
          setModalVisible(true);
      } catch (error) {
          setModalType('error');
          setModalMessage('Yükleme hatası.');
          setModalVisible(true);
      } finally {
          setLoading(false);
      }
  };
  
  const handleDeleteCard = async () => {
      setCardImageUrl(null);
      setModalType('success');
      setModalMessage('Görsel kaldırıldı.');
      setModalVisible(true);
  };
  
  // --- SESLİ NOT ---
  const handleStartRecording = async () => {
    if (isRecording) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) {
      setModalType('error');
      setModalMessage('Mikrofon izni gerekli.');
      setModalVisible(true);
      return;
    }
    ExpoSpeechRecognitionModule.start({
      lang: 'tr-TR',
      interimResults: true,
      maxAlternatives: 1,
      continuous: false,
      requiresOnDeviceRecognition: false,
      addsPunctuation: true,
    });
  };

  // --- YENİ MANUEL PLANLAMA FLOW ---
  const startRescheduleFlow = () => {
      // Modalı aç
      setCustomPickerVisible(true);
  };

  const handleCustomDateConfirm = () => {
      setCustomPickerVisible(false);
      
      // Seçilen tarihi oluştur
      const targetDate = new Date(dateOptions[selectedDateIndex]);
      targetDate.setHours(parseInt(selectedHour));
      targetDate.setMinutes(parseInt(selectedMinute));
      targetDate.setSeconds(0);

      confirmRescheduleRequest(targetDate);
  };

  const confirmRescheduleRequest = (date: Date) => {
      setModalType('warning');
      setModalMessage(`Ziyareti ${date.toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' })} tarihine ertelemek istiyor musunuz?`);
      setModalAction(() => () => executeReschedule(date));
      setModalVisible(true);
  };

  const executeReschedule = async (date: Date) => {
      try {
          setLoading(true);
          const { error } = await supabase
              .from('visits')
              .update({
                  status: 'planned',
                  started_at: date.toISOString(),
                  visit_notes: visitNotes.trim() || null,
                  last_reminded_at: null 
              })
              .eq('id', visitId);

          if (error) throw error;

          await Notifications.scheduleNotificationAsync({
              content: {
                  title: "Ziyaret Hatırlatması 📍",
                  body: `${visit?.place_name || 'Müşteri'} ziyareti için zaman geldi.`,
                  sound: true,
                  data: { visitId: visitId },
              },
              trigger: { date: date },
          });

          setModalType('success');
          setModalMessage('Ziyaret planlandı ve hatırlatıcı kuruldu.');
          setModalAction(() => () => router.replace('/(tabs)/visits'));
          setModalVisible(true);

      } catch (error: any) {
          setModalType('error');
          setModalMessage('Hata: ' + error.message);
          setModalVisible(true);
      } finally {
          setLoading(false);
      }
  };

  const handleFinishVisit = async () => {
    setModalVisible(false);
    setIsFinishing(true);
    try {
      const now = new Date();
      const durationSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      const { error } = await supabase.from('visits').update({
          status: 'completed',
          ended_at: now.toISOString(),
          duration_seconds: durationSeconds,
          contact_name: contactName,
          contact_phone: contactPhone,
          visit_notes: visitNotes.trim() || null, 
          card_image_url: cardImageUrl,
        }).eq('id', visitId);

      if (error) throw error;

      setModalType('success');
      setModalMessage('Ziyaret tamamlandı.');
      setModalAction(() => () => router.replace('/(tabs)/visits'));
      setModalVisible(true);
    } catch (error) {
      setModalType('error');
      setModalMessage('Hata oluştu.');
      setModalVisible(true);
    } finally {
      setIsFinishing(false);
    }
  };

  const handlePrepareOffer = () => setChoiceModalVisible(true);
  
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
    if (!offer?.pdf_url) {
        setModalType('error');
        setModalMessage('PDF bulunamadı.');
        setModalVisible(true);
        return;
    }
    await Sharing.shareAsync(offer.pdf_url);
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
            <Text style={[styles.headerTitle, { color: colors.primary }]}>Ziyaret İşlemleri</Text>
            <View style={{ width: 24 }} />
        </View>

        {/* Bilgi Kartı */}
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.placeName, { color: colors.text }]}>{visit.place_name}</Text>
          <Text style={[styles.placeAddress, { color: colors.textSecondary }]}>
            <Ionicons name="location-outline" size={14} /> {visit.place_address}
          </Text>
          <View style={styles.timerCard}>
             <Clock size={24} color={colors.primary} />
             <View style={styles.timerContent}>
                <Text style={[styles.timerLabel, { color: colors.textSecondary }]}>Geçen Süre</Text>
                <Text style={[styles.timerValue, { color: colors.primary }]}>{formatTime(elapsedTime)}</Text>
             </View>
          </View>
        </View>

        {/* Kartvizit */}
        <View style={styles.actionSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Kartvizit</Text>
            {cardImageUrl ? (
                <View style={[styles.imageContainer, { borderColor: colors.border }]}>
                    <Image source={{ uri: cardImageUrl }} style={styles.cardImage} resizeMode="cover" />
                    <TouchableOpacity style={[styles.deleteButton, { backgroundColor: colors.error }]} onPress={handleDeleteCard}>
                       <Ionicons name="trash-outline" size={20} color="#fff" />
                       <Text style={styles.deleteButtonText}>Kaldır</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity style={[styles.uploadButton, { backgroundColor: colors.primary }]} onPress={handleUploadCard}>
                    <Ionicons name="camera-outline" size={20} color="#fff" style={{ marginRight: 10 }} />
                    <Text style={styles.deleteButtonText}>Fotoğraf Çek</Text>
                </TouchableOpacity>
            )}
        </View>
        
        {/* Teklif */}
        <View style={styles.actionSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Teklif</Text>
            {offer ? (
                <View style={[styles.offerCard, { backgroundColor: colors.surface, borderColor: colors.success }]}>
                    <Ionicons name="document-text" size={20} color={colors.success} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.offerText, { color: colors.text }]}>Teklif Hazır: {offer.total_price} ₺</Text>
                    </View>
                    <TouchableOpacity style={[styles.shareButton, { backgroundColor: colors.primary }]} onPress={handleShareOffer}>
                         <Ionicons name="share-social-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.editButton, { backgroundColor: colors.warning }]} onPress={handlePrepareOffer}>
                         <Ionicons name="create-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity style={[styles.offerButton, { backgroundColor: colors.primary }]} onPress={handlePrepareOffer}>
                    <Calculator size={24} color="#fff" style={{ marginRight: 15 }} />
                    <Text style={styles.offerButtonText}>Teklif Hazırla</Text>
                </TouchableOpacity>
            )}
        </View>

        {/* Form */}
        <View style={styles.formSection}>
          <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 15 }]}>Ziyareti Sonlandırma</Text>
          
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
                  <TouchableOpacity style={[styles.micButton, { backgroundColor: isRecording ? colors.error : colors.warning }]} onPress={handleStartRecording}>
                      <Ionicons name={isRecording ? "stop" : "mic"} size={18} color="#fff" />
                  </TouchableOpacity>
              </View>
          </View>
          
          {isRecording && <Text style={{ color: colors.error, marginTop: 5 }}>Kayıt yapılıyor...</Text>}

          {/* PLANLA BUTONU */}
          <TouchableOpacity 
              onPress={startRescheduleFlow} 
              style={[styles.planButtonMain, { borderColor: colors.primary }]}
          >
              <CalendarIcon size={20} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.planButtonMainText, { color: colors.primary }]}>Ziyareti İleri Tarihe Planla</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.finishButton, { backgroundColor: colors.error, opacity: isFinishing ? 0.7 : 1 }]} 
            onPress={() => {
                setModalType('warning');
                setModalMessage('Ziyareti bitirmek istiyor musunuz?');
                setModalAction(() => handleFinishVisit);
                setModalVisible(true);
            }} 
            disabled={isFinishing}
          >
            {isFinishing ? <ActivityIndicator color="#fff" /> : <Text style={styles.finishButtonText}>Ziyareti Kaydet ve Bitir</Text>}
          </TouchableOpacity>
        </View>

      </ScrollView>
      
      {/* Modallar */}
      <CustomModal visible={modalVisible} onClose={() => setModalVisible(false)} title={modalType === 'warning' ? 'Onay' : 'Bilgi'} type={modalType}>
        <Text style={{ textAlign: 'center', marginBottom: 20, color: colors.text }}>{modalMessage}</Text>
        <ModalButton title={modalType === 'warning' ? 'Evet' : 'Tamam'} onPress={() => { setModalVisible(false); modalAction(); }} variant={modalType === 'warning' ? 'danger' : 'primary'} />
        {modalType === 'warning' && <ModalButton title="Vazgeç" onPress={() => setModalVisible(false)} variant="secondary" />}
      </CustomModal>
      
      <CustomModal visible={choiceModalVisible} onClose={() => setChoiceModalVisible(false)} title="Teklif Tipi" type="default">
        <ModalButton title="Paradox (Standart)" onPress={() => navigateToCalculator('standard')} variant="primary" style={{ marginBottom: 10 }} />
        <ModalButton title="Kale Alarm X (Premium)" onPress={() => navigateToCalculator('premium')} variant="secondary" />
      </CustomModal>

      {/* --- CUSTOM MANUEL TARİH SEÇİCİ MODAL --- */}
      <CustomModal 
        visible={customPickerVisible} 
        onClose={() => setCustomPickerVisible(false)} 
        title="Tarih ve Saat Seçimi"
        type="default"
      >
        <View style={{ width: '100%', height: 400 }}>
            {/* 1. Tarih Seçimi (Yatay Liste) */}
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 10 }}>Tarih</Text>
            <View style={{ height: 80, marginBottom: 20 }}>
                <FlatList
                    data={dateOptions}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(_, index) => index.toString()}
                    renderItem={({ item, index }) => {
                        const isSelected = selectedDateIndex === index;
                        return (
                            <TouchableOpacity
                                onPress={() => setSelectedDateIndex(index)}
                                style={{
                                    width: 70,
                                    height: 70,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    backgroundColor: isSelected ? colors.primary : colors.cardBackground,
                                    borderRadius: 12,
                                    marginRight: 10,
                                    borderWidth: 1,
                                    borderColor: isSelected ? colors.primary : colors.border
                                }}
                            >
                                <Text style={{ color: isSelected ? '#fff' : colors.text, fontWeight: 'bold', fontSize: 18 }}>
                                    {item.getDate()}
                                </Text>
                                <Text style={{ color: isSelected ? '#fff' : colors.textSecondary, fontSize: 12 }}>
                                    {item.toLocaleDateString('tr-TR', { month: 'short' })}
                                </Text>
                            </TouchableOpacity>
                        );
                    }}
                />
            </View>

            {/* 2. Saat ve Dakika Seçimi */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', flex: 1, gap: 10 }}>
                {/* Saat */}
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 10 }}>Saat</Text>
                    <FlatList
                        data={hours}
                        keyExtractor={(item) => item}
                        style={{ backgroundColor: colors.cardBackground, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => setSelectedHour(item)}
                                style={{
                                    padding: 12,
                                    alignItems: 'center',
                                    backgroundColor: selectedHour === item ? colors.primary + '20' : 'transparent',
                                    borderBottomWidth: 1,
                                    borderBottomColor: colors.border + '50'
                                }}
                            >
                                <Text style={{ 
                                    color: selectedHour === item ? colors.primary : colors.text, 
                                    fontWeight: selectedHour === item ? 'bold' : 'normal',
                                    fontSize: 16
                                }}>{item}</Text>
                                {selectedHour === item && <Check size={16} color={colors.primary} style={{ position: 'absolute', right: 10, top: 14 }} />}
                            </TouchableOpacity>
                        )}
                    />
                </View>

                {/* Dakika */}
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 10 }}>Dakika</Text>
                    <FlatList
                        data={minutes}
                        keyExtractor={(item) => item}
                        style={{ backgroundColor: colors.cardBackground, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => setSelectedMinute(item)}
                                style={{
                                    padding: 12,
                                    alignItems: 'center',
                                    backgroundColor: selectedMinute === item ? colors.primary + '20' : 'transparent',
                                    borderBottomWidth: 1,
                                    borderBottomColor: colors.border + '50'
                                }}
                            >
                                <Text style={{ 
                                    color: selectedMinute === item ? colors.primary : colors.text, 
                                    fontWeight: selectedMinute === item ? 'bold' : 'normal',
                                    fontSize: 16
                                }}>{item}</Text>
                                {selectedMinute === item && <Check size={16} color={colors.primary} style={{ position: 'absolute', right: 10, top: 14 }} />}
                            </TouchableOpacity>
                        )}
                    />
                </View>
            </View>

            <ModalButton 
                title="Seçimi Onayla" 
                onPress={handleCustomDateConfirm} 
                variant="primary" 
                style={{ marginTop: 20 }}
            />
        </View>
      </CustomModal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  
  card: { padding: 15, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
  placeName: { fontSize: 20, fontWeight: 'bold' },
  placeAddress: { fontSize: 13, marginTop: 4 },
  timerCard: { flexDirection: 'row', alignItems: 'center', marginTop: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#eee' },
  timerContent: { marginLeft: 10 },
  timerLabel: { fontSize: 12, opacity: 0.8 },
  timerValue: { fontSize: 24, fontWeight: 'bold' },
  actionSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  imageContainer: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', height: 180, marginBottom: 10 },
  cardImage: { width: '100%', height: '100%' },
  uploadButton: { padding: 15, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  deleteButton: { position: 'absolute', bottom: 10, right: 10, padding: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  deleteButtonText: { color: '#fff', fontWeight: 'bold' },
  offerButton: { padding: 15, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 6 },
  offerButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  offerCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, borderWidth: 1 },
  offerText: { fontSize: 15, fontWeight: 'bold' },
  shareButton: { padding: 8, borderRadius: 8, marginLeft: 10 },
  editButton: { padding: 8, borderRadius: 8, marginLeft: 5 },
  
  formSection: { padding: 10, borderRadius: 12 },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 5, paddingLeft: 5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, borderWidth: 1, minHeight: 48 },
  inputField: { flex: 1, paddingVertical: 5, fontSize: 16 },
  multilineWrapper: { alignItems: 'flex-start' },
  largeInput: { flex: 1, height: 100, textAlignVertical: 'top', padding: 10, fontSize: 16 },
  micButton: { position: 'absolute', right: 10, top: 10, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  
  planButtonMain: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: 14, 
      borderRadius: 12, 
      borderWidth: 1, 
      marginTop: 20, 
      marginBottom: 10 
  },
  planButtonMainText: { fontWeight: '600', fontSize: 16 },

  finishButton: { padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  finishButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});