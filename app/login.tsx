import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
  Dimensions,
  StatusBar,
  useColorScheme as useSystemColorScheme
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// Senin paylaştığın ThemeContext yapısına uygun import
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { CustomInput } from '@/components/CustomInput';
import { CustomModal, ModalButton } from '@/components/CustomModal';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');

const COMPANY_LOGO_URL = "https://i.hizliresim.com/gb1rqdh.png";

interface SavedUser {
  email: string;
  password: string;
  fullName: string;
  avatarUrl: string | null;
}

export default function LoginScreen() {
  // DÜZELTME: Senin Context yapında 'dark' yok, 'colorScheme' var.
  const { colors, colorScheme } = useTheme(); 
  
  // Boolean değişkeni burada kendimiz türetiyoruz
  const isDarkMode = colorScheme === 'dark';

  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [savedUser, setSavedUser] = useState<SavedUser | null>(null);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'success' | 'error' | 'warning'>('success');
  const [modalMessage, setModalMessage] = useState('');

  useEffect(() => {
    checkBiometrics();
    loadSavedUser();
    checkForUpdates();
  }, []);

  const checkBiometrics = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setIsBiometricSupported(compatible && enrolled);
  };

  const loadSavedUser = async () => {
    try {
      const userJson = await SecureStore.getItemAsync('saved_user_credentials');
      if (userJson) {
        const user: SavedUser = JSON.parse(userJson);
        setSavedUser(user);
        setEmail(user.email);
        setRememberMe(true);
      }
    } catch (e) {
      console.error('Kayıtlı kullanıcı yüklenemedi', e);
    }
  };

  const checkForUpdates = async () => {
    if (__DEV__) return;
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        setModalType('warning');
        setModalMessage('Yeni güncelleme mevcut. Yükleniyor...');
        setModalVisible(true);
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      }
    } catch (error) {
      console.log('Update check error:', error);
    }
  };

  const showModal = (type: 'success' | 'error', message: string) => {
    setModalType(type);
    setModalMessage(message);
    setModalVisible(true);
  };

  const handleLogin = async (useBiometricCreds = false) => {
    const loginEmail = useBiometricCreds && savedUser ? savedUser.email : email;
    const loginPass = useBiometricCreds && savedUser ? savedUser.password : password;

    if (!loginEmail || !loginPass) {
      showModal('error', 'Lütfen e-posta ve şifre giriniz.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await signIn(loginEmail, loginPass);
      if (error) throw error;

      if (rememberMe || useBiometricCreds) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('email', loginEmail)
          .single();

        const userData: SavedUser = {
          email: loginEmail,
          password: loginPass,
          fullName: profile?.full_name || 'Kullanıcı',
          avatarUrl: profile?.avatar_url || null
        };

        await SecureStore.setItemAsync('saved_user_credentials', JSON.stringify(userData));
      } else {
        await SecureStore.deleteItemAsync('saved_user_credentials');
      }

      router.replace('/(tabs)');
    } catch (err: any) {
      showModal('error', err.message || 'Giriş yapılamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricAuth = async () => {
    if (!savedUser) return;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Giriş yapmak için doğrulama gerekli',
      fallbackLabel: 'Şifre kullan',
    });

    if (result.success) {
      handleLogin(true);
    } else {
      if (result.error !== 'user_cancel') {
        showModal('error', 'Biyometrik doğrulama başarısız.');
      }
    }
  };

  const handleSwitchAccount = () => {
    setSavedUser(null);
    setEmail('');
    setPassword('');
    setRememberMe(false);
    SecureStore.deleteItemAsync('saved_user_credentials');
  };

  // --- RENK AYARLARI (SENİN CONTEXT YAPINA GÖRE) ---
  // isDarkMode değişkenini yukarıda colorScheme === 'dark' ile belirledik.
  
  // 1. Kart Arka Planı: Koyu modda koyu gri, açık modda beyaz
  const dynamicCardBg = isDarkMode ? '#1E1E1E' : '#FFFFFF';
  
  // 2. Kart Kenarlığı
  const dynamicBorderColor = isDarkMode ? '#333333' : '#F0F0F0';
  
  // 3. Yazı Rengi: Eğer colors.text yoksa manuel ayarla
  const dynamicTextColor = colors.text || (isDarkMode ? '#FFFFFF' : '#000000');
  
  // 4. İkincil Yazı Rengi
  const dynamicSubTextColor = colors.textSecondary || (isDarkMode ? '#A0A0A0' : '#666666');

  // 5. Arka plan rengi
  const dynamicBackground = colors.background || (isDarkMode ? '#121212' : '#F8F9FA');

  return (
    <View style={[styles.mainContainer, { backgroundColor: dynamicBackground }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      
      {/* Arka Plan Dekoratif Öğeler */}
      <View style={[styles.bgCircle, { backgroundColor: colors.primary || '#007AFF', opacity: 0.08, top: -100, right: -100 }]} />
      <View style={[styles.bgCircle, { backgroundColor: colors.primary || '#007AFF', opacity: 0.05, bottom: -50, left: -50 }]} />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent} 
            showsVerticalScrollIndicator={false}
          >
            
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                 <Image 
                    source={{ uri: COMPANY_LOGO_URL }} 
                    style={styles.logoImage} 
                    resizeMode="contain"
                 />
              </View>
              
              <Text style={[styles.title, { color: dynamicTextColor }]}>
                {savedUser ? 'Tekrar Hoş Geldin.' : 'Hesabına Giriş Yap.'}
              </Text>
              
              <Text style={[styles.subtitle, { color: dynamicSubTextColor }]}>
                {savedUser 
                  ? 'Devam etmek için kimliğini doğrula.' 
                  : 'Saha operasyonlarını yönetmek için başla.'}
              </Text>
            </View>

            <View style={styles.formContainer}>
              
              {savedUser ? (
                // --- KART YAPISI ---
                <View style={[
                  styles.savedUserCard, 
                  { 
                    backgroundColor: dynamicCardBg, 
                    borderColor: dynamicBorderColor,
                    // Gölgeyi dark modda biraz daha belirgin veya farklı yapabiliriz
                    shadowOpacity: isDarkMode ? 0.3 : 0.1 
                  }
                ]}>
                  <View style={[
                    styles.avatarContainer, 
                    { 
                      borderColor: colors.primary || '#007AFF',
                      backgroundColor: dynamicCardBg
                    }
                  ]}>
                    {savedUser.avatarUrl ? (
                      <Image source={{ uri: savedUser.avatarUrl }} style={styles.avatarImage} />
                    ) : (
                      <Text style={[styles.avatarInitials, { color: colors.primary || '#007AFF' }]}>
                        {savedUser.fullName.charAt(0)}
                      </Text>
                    )}
                  </View>
                  
                  <Text style={[styles.savedUserName, { color: dynamicTextColor }]}>
                    {savedUser.fullName}
                  </Text>
                  <Text style={[styles.savedUserEmail, { color: dynamicSubTextColor }]}>
                    {savedUser.email}
                  </Text>

                  {isBiometricSupported && (
                    <TouchableOpacity 
                      style={[styles.biometricButton, { backgroundColor: colors.primary || '#007AFF' }]}
                      onPress={handleBiometricAuth}
                      activeOpacity={0.8}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <>
                          <Ionicons name="finger-print-outline" size={26} color="#FFF" />
                          <Text style={styles.biometricButtonText}>Biyometrik Veri ile Giriş</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity onPress={handleSwitchAccount} style={styles.switchAccountButton}>
                    <Text style={[styles.switchAccountText, { color: dynamicSubTextColor }]}>
                      Farklı bir hesap kullan
                    </Text>
                  </TouchableOpacity>
                </View>

              ) : (
                // --- STANDART FORM ---
                <>
                  <View style={styles.inputGroup}>
                    <CustomInput
                      label="E-posta Adresi"
                      placeholder="ad.soyad@sirket.com"
                      value={email}
                      onChangeText={setEmail}
                      icon="mail-outline"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    
                    <View style={{ height: 16 }} />

                    <CustomInput
                      label="Şifre"
                      placeholder="••••••••"
                      value={password}
                      onChangeText={setPassword}
                      icon="lock-closed-outline"
                      secureTextEntry={!showPassword}
                      rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      onRightIconPress={() => setShowPassword(!showPassword)}
                    />
                  </View>

                  <View style={styles.optionsRow}>
                    <TouchableOpacity 
                      style={styles.rememberMeContainer} 
                      onPress={() => setRememberMe(!rememberMe)}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.checkbox, 
                        { 
                          borderColor: rememberMe ? (colors.primary || '#007AFF') : dynamicBorderColor, 
                          backgroundColor: rememberMe ? (colors.primary || '#007AFF') : 'transparent' 
                        }
                      ]}>
                        {rememberMe && <Ionicons name="checkmark" size={14} color="#FFF" />}
                      </View>
                      <Text style={[styles.rememberMeText, { color: dynamicSubTextColor }]}>
                        Beni hatırla
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity>
                      <Text style={[styles.forgotPasswordText, { color: colors.primary || '#007AFF' }]}>
                        Şifremi unuttum
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[styles.loginButton, { backgroundColor: colors.primary || '#007AFF' }]}
                    onPress={() => handleLogin(false)}
                    activeOpacity={0.9}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <>
                        <Text style={styles.loginButtonText}>Giriş Yap</Text>
                        <Ionicons name="arrow-forward" size={20} color="#FFF" style={{ marginLeft: 8 }} />
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <CustomModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        type={modalType}
      >
        <Text style={[styles.modalText, { color: dynamicTextColor }]}>{modalMessage}</Text>
        <ModalButton title="Tamam" onPress={() => setModalVisible(false)} />
      </CustomModal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  bgCircle: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: (width * 0.8) / 2,
    zIndex: -1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28, 
    justifyContent: 'center',
    paddingBottom: 40,
  },
  header: {
    marginBottom: 48,
    marginTop: 20,
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 24,
    height: 50,
    justifyContent: 'center',
  },
  logoImage: {
    width: 150,
    height: '100%', 
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.7,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 24,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  rememberMeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    height: 60,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  savedUserCard: {
    alignItems: 'center',
    borderRadius: 24,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 4,
    borderWidth: 1,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    borderWidth: 2,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  savedUserName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  savedUserEmail: {
    fontSize: 14,
    marginBottom: 32,
    opacity: 0.6,
  },
  biometricButton: {
    flexDirection: 'row',
    height: 56,
    width: '100%',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  biometricButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  switchAccountButton: {
    padding: 12,
  },
  switchAccountText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
});