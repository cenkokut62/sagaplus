const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export const searchNearbyPlaces = async (lat: number, lng: number, radius: number = 500) => {
  console.log('📍 [PlacesService] İstek Başlatılıyor...');
  console.log(`📍 [Konum] Lat: ${lat}, Lng: ${lng}, Yarıçap: ${radius}`);

  const url = 'https://places.googleapis.com/v1/places:searchNearby';
  
  // 1. İSTENMEYEN TÜRLER (Gizlenecekler)
  const excludedTypes = [
    // Eğitim
    'school', 
    'primary_school', 
    'secondary_school', 
    'university', 
    'preschool',
    
    // AVM
    'shopping_mall', 

    // Kamusal / Devlet
    'park', 
    'national_park', 
    'campground',
    'local_government_office', 
    'city_hall', 
    'courthouse', 
    'embassy', 
    'police', 
    'fire_station',
    'cemetery', 
    'hospital',

    // İbadethaneler
    'mosque', 
    'church', 
    'synagogue', 
    'hindu_temple'
  ];

  // 2. İSTENEN TÜRLER (Gösterilecekler)
  // 'driving_school' API tarafından desteklenmediği için çıkarıldı.
  const includedTypes = [
    // İşletmeler
    'store', 
    'restaurant', 
    'cafe', 
    'bakery',
    'bar',
    'supermarket',
    'clothing_store',
    'electronics_store',
    'home_goods_store',
    'convenience_store',
    'hair_salon',
    'gym',
    'car_dealer',           
    'auto_parts_store',     
    'furniture_store',      
    'hardware_store',       
    'jewelry_store',        
    'pet_store',            
    'pharmacy',             
    'real_estate_agency',   
    'travel_agency'         
  ];

  const requestBody = {
    includedTypes: includedTypes,
    excludedTypes: excludedTypes,
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: radius,
      },
    },
  };

  console.log('📦 [Giden Veri]:', JSON.stringify(requestBody));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY!,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.primaryType',
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`📡 [HTTP Durumu]: ${response.status}`);

    if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [API Hatası]:', errorText);
        return [];
    }

    const data = await response.json();
    const results = data.places || [];

    console.log(`✅ [Sonuç]: ${results.length} adet yer bulundu.`);
    
    if (results.length > 0) {
        results.forEach((p: any, i: number) => {
            console.log(`   ${i + 1}. ${p.displayName?.text} [Tür: ${p.primaryType}]`);
        });
    } else {
        console.log('⚠️ [Uyarı]: İstek başarılı ama liste boş döndü.');
    }

    return results;
  } catch (error) {
    console.error('❌ [Catch Hatası]:', error);
    return [];
  }
};