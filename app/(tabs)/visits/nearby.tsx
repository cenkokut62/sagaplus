import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useTheme } from '@/contexts/ThemeContext';
import { searchNearbyPlaces } from '@/services/placesService';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { getDistance } from 'geolib';
import { CustomModal, ModalButton } from '@/components/CustomModal';
import { CustomInput } from '@/components/CustomInput';

export default function NearbyPlaces() {
  const { colors } = useTheme();
  const router = useRouter();
  
  // Data States
  const [places, setPlaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<any>(null);

  // Manual Visit States
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualPlaceName, setManualPlaceName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [creatingManual, setCreatingManual] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false); // Adres çözümleniyor mu?

  // Custom Alert Modal States
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');
  const [infoTitle, setInfoTitle] = useState('');
  const [infoType, setInfoType] = useState<'error' | 'success' | 'warning'>('error');

  useEffect(() => {
    fetchPlaces();
  }, []);

  const showCustomAlert = (title: string, message: string, type: 'error' | 'success' | 'warning' = 'error') => {
    setInfoTitle(title);
    setInfoMessage(message);
    setInfoType(type);
    setInfoModalVisible(true);
  };

  const fetchPlaces = async () => {
    try {
      setLoading(true);
      
      // 1. Konum Al
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showCustomAlert('İzin Hatası', 'Konum izni verilmediği için işlem yapılamıyor.', 'error');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation(location.coords);
      
      // 2. Servisi Çağır
      const results = await searchNearbyPlaces(location.coords.latitude, location.coords.longitude, 500);
      setPlaces(results);

    } catch (error) {
      console.error('❌ [NearbyScreen] Hata:', error);
      showCustomAlert('Hata', 'Konum alınamadı veya yerler bulunamadı.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Google Place Seçimi
  const handleSelectPlace = async (place: any) => {
    if (!currentLocation) {
        showCustomAlert('Hata', 'Mevcut konum bilgisi alınamadı.', 'error');
        return;
    }

    // Mesafe Kontrolü
    const dist = getDistance(
      { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
      { latitude: place.location.latitude, longitude: place.location.longitude }
    );

    if (dist > 600) {
      showCustomAlert('Uzaklık Hatası', 'Seçilen işletmeye çok uzaksınız. Ziyaret başlatılamaz.', 'warning');
      return;
    }

    createVisitRecord(
      place.id,
      place.displayName.text,
      place.formattedAddress,
      place.location
    );
  };

  // Manuel Ziyaret Başlatma Butonu (GÜNCELLENDİ: Adres Otomatik Çekiliyor)
  const handleManualStartPress = async () => {
    if (!currentLocation) {
        showCustomAlert('Hata', 'Henüz konum bilgisi alınamadı. Lütfen bekleyin.', 'error');
        return;
    }

    setManualPlaceName('');
    setAddressLoading(true); // Butonda loading gösterilebilir veya modal açılana kadar beklenebilir

    try {
        // Koordinattan Adres Çözümleme (Reverse Geocoding)
        const reverseGeocode = await Location.reverseGeocodeAsync({
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude
        });

        if (reverseGeocode && reverseGeocode.length > 0) {
            const addr = reverseGeocode[0];
            // Adres parçalarını birleştir
            const formattedParts = [
                addr.street, 
                addr.name !== addr.street ? addr.name : null, // Sokak ile isim aynıysa tekrar etme
                addr.district, 
                addr.city, 
                addr.region
            ].filter(Boolean); // Boş olanları filtrele
            
            setManualAddress(formattedParts.join(', '));
        } else {
            setManualAddress('Adres detayı alınamadı, lütfen elle giriniz.');
        }
    } catch (error) {
        console.log('Adres çözümleme hatası:', error);
        setManualAddress(''); // Hata olursa boş bırak, kullanıcı girsin
    } finally {
        setAddressLoading(false);
        setManualModalVisible(true);
    }
  };

  // Manuel Ziyareti Kaydet
  const confirmManualVisit = async () => {
    if (!manualPlaceName.trim()) {
        showCustomAlert('Eksik Bilgi', 'Lütfen bir işletme adı giriniz.', 'warning');
        return;
    }

    setCreatingManual(true);
    
    // Rastgele bir ID ve mevcut konumu kullanarak kayıt oluştur
    const manualId = `manual_${Date.now()}`;
    const locationJson = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude
    };

    await createVisitRecord(
        manualId,
        manualPlaceName,
        manualAddress || 'Konum İşaretlendi (Manuel)',
        locationJson
    );

    setCreatingManual(false);
    setManualModalVisible(false);
  };

  // Ortak Ziyaret Oluşturma Fonksiyonu
  const createVisitRecord = async (placeId: string, placeName: string, placeAddress: string, location: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('visits')
        .insert({
          user_id: user.id,
          place_id: placeId,
          place_name: placeName,
          place_address: placeAddress,
          place_location: location,
          status: 'active',
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Modal varsa kapat ve yönlendir
      setManualModalVisible(false);
      
      router.replace({
        pathname: '/(tabs)/visits/active',
        params: { visitId: data.id }
      });

    } catch (error: any) {
      console.error('Ziyaret başlatma hatası:', error);
      showCustomAlert('Hata', 'Ziyaret başlatılamadı: ' + error.message, 'error');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{flex: 1}}>
            <Text style={[styles.title, { color: colors.text }]}>Yakındaki İşletmeler</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Listede yoksa manuel ekleyebilirsiniz.
            </Text>
        </View>
        
        {/* MANUEL ZİYARET BUTONU */}
        <TouchableOpacity 
            style={[styles.manualButton, { backgroundColor: colors.primary + '15' }]} 
            onPress={handleManualStartPress}
            disabled={addressLoading}
        >
            {addressLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
            ) : (
                <>
                    <Ionicons name="add-circle" size={24} color={colors.primary} />
                    <Text style={[styles.manualButtonText, { color: colors.primary }]}>Manuel</Text>
                </>
            )}
        </TouchableOpacity>
      </View>

      {/* Liste veya Loading */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textSecondary, marginTop: 10 }}>Konum alınıyor ve işletmeler aranıyor...</Text>
        </View>
      ) : (
        <FlatList
          data={places}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.center}>
               <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
               <Text style={{ color: colors.textSecondary, marginTop: 10, textAlign: 'center' }}>
                   Yakında kayıtlı işletme bulunamadı.{'\n'}Sağ üstten manuel ziyaret başlatabilirsiniz.
               </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
              onPress={() => handleSelectPlace(item)}
            >
              <View style={styles.iconBox}>
                <Ionicons name="business" size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.placeName, { color: colors.text }]}>{item.displayName.text}</Text>
                <Text style={[styles.placeAddr, { color: colors.textSecondary }]}>{item.formattedAddress}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        />
      )}

      {/* MANUEL ZİYARET GİRİŞ MODALI */}
      <CustomModal
        visible={manualModalVisible}
        onClose={() => setManualModalVisible(false)}
        title="Manuel Ziyaret Başlat"
        type="default"
      >
        <View style={{ gap: 10, marginTop: 10 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 5 }}>
                Bulunduğunuz konum adresi otomatik olarak doldurulmuştur. Dilerseniz düzenleyebilirsiniz.
            </Text>
            
            <CustomInput 
                label="İşletme Adı *" 
                placeholder="Örn: Yılmaz Market"
                value={manualPlaceName}
                onChangeText={setManualPlaceName}
                icon="business-outline"
            />
            
            <CustomInput 
                label="Adres / Açıklama" 
                placeholder="Adres bilgisi..."
                value={manualAddress}
                onChangeText={setManualAddress}
                icon="map-outline"
                multiline
                style={{ height: 60 }} // Adres için biraz daha yer
            />

            <View style={styles.modalButtons}>
                <View style={{flex: 1}}>
                    <ModalButton 
                        title="İptal" 
                        onPress={() => setManualModalVisible(false)} 
                        variant="secondary" 
                    />
                </View>
                <View style={{width: 10}} />
                <View style={{flex: 1}}>
                    <ModalButton 
                        title={creatingManual ? "Başlatılıyor..." : "Başlat"} 
                        onPress={confirmManualVisit} 
                    />
                </View>
            </View>
        </View>
      </CustomModal>

      {/* HATA / BİLGİ MODALI (Alert Yerine) */}
      <CustomModal
        visible={infoModalVisible}
        onClose={() => setInfoModalVisible(false)}
        title={infoTitle}
        type={infoType}
      >
        <Text style={{ textAlign: 'center', marginBottom: 20, color: colors.text }}>
           {infoMessage}
        </Text>
        <ModalButton 
          title="Tamam" 
          onPress={() => setInfoModalVisible(false)} 
          variant={infoType === 'error' ? 'danger' : 'primary'}
        />
      </CustomModal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
      padding: 20, 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'space-between' 
  },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 2 },
  
  manualButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 20,
      gap: 5,
      minWidth: 90,
      justifyContent: 'center'
  },
  manualButtonText: { fontWeight: '600', fontSize: 13 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  
  card: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      padding: 16, 
      marginHorizontal: 20, 
      marginBottom: 12, 
      borderRadius: 12, 
      borderWidth: 1 
  },
  iconBox: { 
      width: 40, height: 40, 
      borderRadius: 20, 
      backgroundColor: 'rgba(0,0,0,0.05)', 
      justifyContent: 'center', 
      alignItems: 'center', 
      marginRight: 12 
  },
  placeName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  placeAddr: { fontSize: 12 },

  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }
});