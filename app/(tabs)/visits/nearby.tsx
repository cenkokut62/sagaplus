import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useTheme } from '@/contexts/ThemeContext';
import { searchNearbyPlaces } from '@/services/placesService';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { getDistance } from 'geolib';

export default function NearbyPlaces() {
  const { colors } = useTheme();
  const router = useRouter();
  const [places, setPlaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<any>(null);

  useEffect(() => {
    fetchPlaces();
  }, []);

  const fetchPlaces = async () => {
    try {
      console.log('🔄 [NearbyScreen] İşlem başlıyor...');
      setLoading(true);
      
      // 1. Konum Al
      console.log('📍 [NearbyScreen] Konum izni ve koordinat alınıyor...');
      const location = await Location.getCurrentPositionAsync({});
      console.log('✅ [NearbyScreen] Konum Alındı:', location.coords.latitude, location.coords.longitude);
      
      setCurrentLocation(location.coords);
      
      // 2. Servisi Çağır
      console.log('🚀 [NearbyScreen] Servis çağrılıyor...');
      const results = await searchNearbyPlaces(location.coords.latitude, location.coords.longitude, 500);
      
      console.log('📦 [NearbyScreen] UI tarafına gelen veri sayısı:', results.length);
      setPlaces(results);

    } catch (error) {
      console.error('❌ [NearbyScreen] Hata:', error);
      Alert.alert('Hata', 'Konum alınamadı veya yerler bulunamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlace = async (place: any) => {
    if (!currentLocation) return;

    // Mesafe Kontrolü
    const dist = getDistance(
      { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
      { latitude: place.location.latitude, longitude: place.location.longitude }
    );

    console.log(`📏 [Mesafe Kontrolü] Seçilen yer: ${place.displayName.text}, Mesafe: ${dist}m`);

    if (dist > 600) {
      Alert.alert('Uzaklık Hatası', 'Seçilen işletmeye çok uzaksınız. Ziyaret başlatılamaz.');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('visits')
        .insert({
          user_id: user.id,
          place_id: place.id,
          place_name: place.displayName.text,
          place_address: place.formattedAddress,
          place_location: place.location,
          status: 'active',
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      router.replace({
        pathname: '/(tabs)/visits/active',
        params: { visitId: data.id }
      });

    } catch (error) {
      console.error('Ziyaret başlatma hatası:', error);
      Alert.alert('Hata', 'Ziyaret başlatılamadı.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Yakındaki İşletmeler</Text>
        <Text style={{ color: colors.textSecondary }}>Konumunuza en yakın noktalar listeleniyor.</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textSecondary, marginTop: 10 }}>İşletmeler aranıyor...</Text>
        </View>
      ) : (
        <FlatList
          data={places}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.center}>
               <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
               <Text style={{ color: colors.textSecondary, marginTop: 10 }}>Yakında uygun işletme bulunamadı.</Text>
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
                {/* Debug için türü de yazdırabilirsin */}
                {/* <Text style={{fontSize: 10, color: 'gray'}}>{item.primaryType}</Text> */}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 16, marginHorizontal: 20, marginBottom: 12, borderRadius: 12, borderWidth: 1 },
  iconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  placeName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  placeAddr: { fontSize: 12 }
});