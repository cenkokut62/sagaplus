import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase, Profile } from '@/lib/supabase';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Bildirim ayarları
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>;
  uploadAvatar: (uri: string) => Promise<{ error: any; url?: string }>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// OTURUM ZAMAN AŞIMI SÜRESİ (Dakika)
const SESSION_TIMEOUT_MINUTES = 10;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // AppState takibi için referans
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // İlk yükleme
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
        
        // --- LOGLU BİLDİRİM KAYDI ---
        console.log("🔔 Bildirim kaydı başlatılıyor...");
        registerForPushNotificationsAsync().then(token => {
          if (token) {
            console.log("✅ Token alındı, veritabanına yazılıyor...");
            updatePushToken(session.user.id, token);
          } else {
            console.log("❌ Token alınamadı (Fonksiyon null döndü).");
          }
        });
        // -----------------------------

      } else {
        setLoading(false);
      }
    });

    // Oturum değişikliklerini dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          loadProfile(session.user.id);
        } else {
          setProfile(null);
          setIsAdmin(false);
          setLoading(false);
        }
      }
    );

    // AppState Listener (Arka Plan Kontrolü)
    const subscriptionAppState = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.unsubscribe();
      subscriptionAppState.remove();
    };
  }, []);

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // Uygulama ön plana geldi (Foreground)
      const lastBackgroundStr = await AsyncStorage.getItem('last_background_time');
      
      if (lastBackgroundStr) {
        const lastBackgroundTime = parseInt(lastBackgroundStr, 10);
        const now = Date.now();
        const diffMinutes = (now - lastBackgroundTime) / 1000 / 60;

        // Süre aşımı kontrolü
        if (diffMinutes > SESSION_TIMEOUT_MINUTES) {
          console.log('Oturum zaman aşımına uğradı, güvenlik için çıkış yapılıyor...');
          await signOut();
        }
      }
      await AsyncStorage.removeItem('last_background_time');
    } else if (nextAppState.match(/inactive|background/)) {
      // Uygulama arka plana gidiyor (Background)
      await AsyncStorage.setItem('last_background_time', Date.now().toString());
    }
    appState.current = nextAppState;
  };

  const loadProfile = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        cities (name),
        titles (name),
        team_members (
          role,
          teams (
            name
          )
        )
      `) // <-- BURASI DEĞİŞTİ (Eski: teams!profiles_team_id_fkey...)
      .eq('id', userId)
      .maybeSingle();

      if (error) throw error;
      setProfile(data);
      // @ts-ignore
      setIsAdmin(data?.is_admin || false);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePushToken = async (userId: string, token: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ expo_push_token: token })
        .eq('id', userId);
      
      if (error) {
         console.error('❌ Supabase Token Update Error:', error);
      } else {
         console.log('✅ Token Supabase Success: Token başarıyla profile tablosuna işlendi.');
      }

    } catch (error) {
      console.error('Push token update error:', error);
    }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No user logged in') };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (!error && profile) {
      setProfile({ ...profile, ...updates });
    }

    return { error };
  };

  const uploadAvatar = async (uri: string) => {
    if (!user) return { error: { message: 'Kullanıcı oturumu bulunamadı' } };

    try {
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      
      const uriParts = uri.split('.');
      const fileExt = uriParts.length > 1 ? uriParts.pop()?.toLowerCase() : 'jpg';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, {
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      await updateProfile({ avatar_url: publicUrl });

      return { error: null, url: publicUrl };
    } catch (error: any) {
      console.error('Upload Avatar Error:', error);
      return { error: error };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        updateProfile,
        uploadAvatar,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Push Notification Helper
async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    console.log(`📱 Mevcut İzin Durumu: ${existingStatus}`);

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log(`📱 İzin istendi, yeni durum: ${status}`);
    }
    
    if (finalStatus !== 'granted') {
      console.log('❌ Failed to get push token: İzin verilmedi!');
      return;
    }
    
    // Proje ID Kontrolü (Development Build'de en sık patlayan yer)
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    console.log(`🆔 Kullanılan Project ID: ${projectId}`);
    
    if (!projectId) {
        console.error("❌ HATA: Project ID bulunamadı. app.json > extra > eas > projectId ayarını kontrol et.");
    }

    try {
      token = (await Notifications.getExpoPushTokenAsync({
        projectId,
      })).data;
      
      // 🔥 İŞTE BURASI: Token'ı terminale basıyoruz
      console.log("🔥 EXPO PUSH TOKEN:", token);

    } catch (e) {
      console.error("❌ Push Token Alma Hatası:", e);
    }
  } else {
    console.log('⚠️ Fiziksel cihaz gerekli. Emülatörde push token üretilmez.');
  }

  return token;
}