import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Image, Alert, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useTheme } from '@/contexts/ThemeContext';

const { width, height } = Dimensions.get('window');

type PermissionType = 'location' | 'microphone' | 'notification';

// İzin Adımları Tanımları
const STEPS: { type: PermissionType; title: string; desc: string; icon: string; color: string; bgColor: string }[] = [
  {
    type: 'location',
    title: 'Konum Erişimi',
    desc: 'Saha operasyonlarında doğru lokasyon tespiti ve müşteri ziyaretlerinizin doğrulanması için konum iznine ihtiyacımız var.',
    icon: 'location',
    color: '#2563EB', // Mavi
    bgColor: '#EFF6FF',
  },
  {
    type: 'microphone',
    title: 'Mikrofon Erişimi',
    desc: 'Ziyaret notlarınızı sesli olarak hızlıca girebilmeniz ve konuşmayı metne çevirebilmemiz için mikrofon izni gereklidir.',
    icon: 'mic',
    color: '#D97706', // Turuncu
    bgColor: '#FFFBEB',
  },
  {
    type: 'notification',
    title: 'Bildirim İzni',
    desc: 'Planlanan ziyaretlerinizi hatırlatmak ve önemli operasyonel güncellemelerden haberdar olmanız için bildirim izni verin.',
    icon: 'notifications',
    color: '#7C3AED', // Mor
    bgColor: '#F5F3FF',
  },
];

export default function PermissionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  // Mevcut adımın verisi
  const currentStep = STEPS[currentStepIndex];

  // İzin İsteme Fonksiyonu
  const requestPermission = async () => {
    setLoading(true);
    let status = 'undetermined';
    let canAskAgain = true;

    try {
      if (currentStep.type === 'location') {
        const { status: locStatus, canAskAgain: locAsk } = await Location.requestForegroundPermissionsAsync();
        status = locStatus;
        canAskAgain = locAsk;
      } 
      else if (currentStep.type === 'microphone') {
        // Expo Speech Recognition mikrofon iznini de kapsar
        const { status: micStatus, canAskAgain: micAsk } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        status = micStatus;
        canAskAgain = micAsk;
      } 
      else if (currentStep.type === 'notification') {
        const { status: notifStatus, canAskAgain: notifAsk } = await Notifications.requestPermissionsAsync();
        status = notifStatus;
        canAskAgain = notifAsk;
      }

      if (status === 'granted') {
        handleNext();
      } else {
        // İzin reddedildiyse uyar ve ayarlara yönlendir
        Alert.alert(
          'İzin Gerekli',
          `Uygulamanın tam fonksiyonlu çalışması için ${currentStep.title} şarttır. Lütfen ayarlardan izin verin.`,
          [
            { text: 'Vazgeç', style: 'cancel' },
            { text: 'Ayarları Aç', onPress: () => Linking.openSettings() }
          ]
        );
      }
    } catch (error) {
      console.error('Permission Error:', error);
      Alert.alert('Hata', 'İzin istenirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Sonraki adıma geçiş veya bitiş
  const handleNext = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      // Hepsi bitti, ana akışa dön
      // replace kullanarak geri gelmeyi engelliyoruz
      router.replace('/login'); 
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* İlerleme Çubuğu */}
      <View style={styles.paginationContainer}>
        {STEPS.map((_, index) => (
          <View
            key={index}
            style={[
              styles.paginationDot,
              { 
                backgroundColor: index === currentStepIndex ? currentStep.color : '#E2E8F0',
                width: index === currentStepIndex ? 30 : 10
              }
            ]}
          />
        ))}
      </View>

      {/* İçerik */}
      <View style={styles.contentContainer}>
        <View style={[styles.iconContainer, { backgroundColor: currentStep.bgColor }]}>
          <Ionicons name={currentStep.icon as any} size={80} color={currentStep.color} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>{currentStep.title}</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {currentStep.desc}
        </Text>
      </View>

      {/* Aksiyon Butonu */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: currentStep.color }]}
          onPress={requestPermission}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Kontrol Ediliyor...' : 'İzin Ver ve Devam Et'}
          </Text>
          {!loading && <Ionicons name="arrow-forward" size={20} color="#FFF" />}
        </TouchableOpacity>
        
        {/* Opsiyonel: Şimdilik Geç (Tavsiye edilmez ama acil durumlar için) */}
        {/* <TouchableOpacity onPress={handleNext} style={styles.skipButton}>
          <Text style={{ color: colors.textSecondary }}>Şimdilik Geç</Text>
        </TouchableOpacity> */}
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'space-between' },
  paginationContainer: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 20 },
  paginationDot: { height: 10, borderRadius: 5 },
  
  contentContainer: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  description: { fontSize: 16, textAlign: 'center', lineHeight: 24, paddingHorizontal: 10 },
  
  footer: { gap: 16, marginBottom: 20 },
  button: {
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: { color: '#FFF', fontSize: 18, fontWeight: '600' },
  skipButton: { alignItems: 'center', padding: 10 }
});