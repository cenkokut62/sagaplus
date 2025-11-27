import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { CustomInput } from '@/components/CustomInput';
import { CustomPicker } from '@/components/CustomPicker';
import { supabase } from '@/lib/supabase';
import { ProductFormData } from '@/types/product';
import { ModalButton, CustomModal } from '@/components/CustomModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function ManageProduct() {
  const { id } = useLocalSearchParams();
  const isEditing = !!id;
  const router = useRouter();
  const { colors } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error' | 'warning'>('success');
  const [modalTitle, setModalTitle] = useState('');

  const [formData, setFormData] = useState<ProductFormData>({
    code: '',
    name: '',
    category: 'standard',
    type: 'peripheral',
    subscription_price_wired: '',
    subscription_price_wireless: '',
    code_wired: '',
    code_wireless: '',
    subscription_price: '',
    is_hub_compatible: true,
    is_hub2_compatible: true,
  });

  useEffect(() => {
    if (isEditing) {
      fetchProductDetails();
    }
  }, [id]);

  const showModal = (title: string, message: string, type: 'success' | 'error' | 'warning') => {
    setModalTitle(title);
    setModalMessage(message);
    setModalType(type);
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    if (modalType === 'success') {
      router.back();
    }
  };

  const fetchProductDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        setFormData({
          code: data.code,
          name: data.name,
          category: data.category,
          type: data.type,
          
          // Standart Alanlar
          subscription_price_wired: data.subscription_price_wired?.toString() || '',
          subscription_price_wireless: data.subscription_price_wireless?.toString() || '',
          code_wired: data.code_wired || '',
          code_wireless: data.code_wireless || '',
          
          // Premium Alanlar
          subscription_price: data.subscription_price?.toString() || '',
          is_hub_compatible: data.is_hub_compatible ?? true,
          is_hub2_compatible: data.is_hub2_compatible ?? true,
        });
      }
    } catch (error) {
      showModal('Hata', 'Ürün bilgileri getirilemedi.', 'error');
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    // Validasyon
    if (!formData.name) {
      showModal('Uyarı', 'Lütfen Ürün Adı alanını doldurun.', 'warning');
      return;
    }

    // Kod Validasyonu
    if (formData.category === 'premium' && !formData.code) {
      showModal('Uyarı', 'Lütfen Ürün Kodunu giriniz.', 'warning');
      return;
    }
    if (formData.category === 'standard' && (!formData.code_wired && !formData.code_wireless)) {
      showModal('Uyarı', 'Lütfen en az bir tane (Kablolu veya Kablosuz) ürün kodu giriniz.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        name: formData.name,
        category: formData.category,
        type: formData.type,
      };

      if (formData.category === 'standard') {
        payload.code = formData.code_wireless || formData.code_wired;
        payload.code_wired = formData.code_wired || null;
        payload.code_wireless = formData.code_wireless || null;
        
        payload.subscription_price_wired = formData.subscription_price_wired ? parseFloat(formData.subscription_price_wired) : null;
        payload.subscription_price_wireless = formData.subscription_price_wireless ? parseFloat(formData.subscription_price_wireless) : null;
        
        payload.subscription_price = null;
        payload.is_hub_compatible = true; 
        payload.is_hub2_compatible = true; 
      } else {
        payload.code = formData.code;
        payload.code_wired = null;
        payload.code_wireless = null;
        payload.subscription_price_wired = null;
        payload.subscription_price_wireless = null;
        
        payload.subscription_price = formData.subscription_price ? parseFloat(formData.subscription_price) : null;
        payload.is_hub_compatible = formData.is_hub_compatible;
        payload.is_hub2_compatible = formData.is_hub2_compatible;
      }

      let error;
      if (isEditing) {
        const { error: updateError } = await supabase
          .from('products')
          .update(payload)
          .eq('id', id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('products')
          .insert([payload]);
        error = insertError;
      }

      if (error) throw error;

      showModal(
        'Başarılı',
        `Ürün başarıyla ${isEditing ? 'güncellendi' : 'eklendi'}.`,
        'success'
      );
      
    } catch (error: any) {
      showModal('Hata', error.message || 'Bir hata oluştu.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, flex: 1 }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} /> 
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
           <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isEditing ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Temel Bilgiler</Text>
            
            <CustomPicker
              label="Katalog Tipi"
              value={formData.category}
              options={[
                { label: 'Kale Alarm 2025 (Standart)', value: 'standard' },
                { label: 'Kale Alarm X (Premium)', value: 'premium' },
              ]}
              onValueChange={(val) => setFormData({ ...formData, category: val as any })}
            />

            <CustomPicker
              label="Ürün Tipi"
              value={formData.type}
              options={[
                { label: 'Uç Birim / Parça', value: 'peripheral' },
                { label: 'Ana Paket', value: 'package' },
              ]}
              onValueChange={(val) => setFormData({ ...formData, type: val as any })}
            />

            {formData.category === 'premium' && (
              <CustomInput
                label="Ürün Kodu"
                placeholder="Örn: KGS1111011"
                value={formData.code}
                onChangeText={(text) => setFormData({ ...formData, code: text })}
              />
            )}

            <CustomInput
              label="Ürün Adı"
              placeholder="Ürünün tam adı"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              multiline
            />
          </View>

          {formData.category === 'standard' ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>2025 Abonelik & Varyantlar</Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                Kablolu ve kablosuz varyantlar için ayrı kod ve abonelik fiyatı girebilirsiniz.
              </Text>
              
              <View style={styles.subsection}>
                <Text style={[styles.subsectionTitle, { color: colors.primary }]}>Kablolu Sistem</Text>
                <CustomInput
                  label="Kablolu Ürün Kodu"
                  placeholder="Örn: KGS... (Kablolu)"
                  value={formData.code_wired}
                  onChangeText={(text) => setFormData({ ...formData, code_wired: text })}
                />
                <CustomInput
                  label="Kablolu Abonelik Bedeli (TL)"
                  placeholder="0.00"
                  value={formData.subscription_price_wired}
                  onChangeText={(text) => setFormData({ ...formData, subscription_price_wired: text })}
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.subsection}>
                <Text style={[styles.subsectionTitle, { color: colors.primary }]}>Kablosuz Sistem</Text>
                <CustomInput
                  label="Kablosuz Ürün Kodu"
                  placeholder="Örn: KGS... (Kablosuz)"
                  value={formData.code_wireless}
                  onChangeText={(text) => setFormData({ ...formData, code_wireless: text })}
                />
                <CustomInput
                  label="Kablosuz Abonelik Bedeli (TL)"
                  placeholder="0.00"
                  value={formData.subscription_price_wireless}
                  onChangeText={(text) => setFormData({ ...formData, subscription_price_wireless: text })}
                  keyboardType="numeric"
                />
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Kale Alarm X Detayları</Text>
              
              <CustomInput
                label="Abonelik Bedeli (TL)"
                placeholder="0.00"
                value={formData.subscription_price}
                onChangeText={(text) => setFormData({ ...formData, subscription_price: text })}
                keyboardType="numeric"
              />

              <View style={styles.switchContainer}>
                <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: colors.text }]}>Hub 4G Uyumlu</Text>
                  <Switch
                    value={formData.is_hub_compatible}
                    onValueChange={(val) => setFormData({ ...formData, is_hub_compatible: val })}
                    trackColor={{ false: colors.border, true: colors.primary }}
                  />
                </View>
                
                <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: colors.text }]}>Hub 2 (4G) Uyumlu</Text>
                  <Switch
                    value={formData.is_hub2_compatible}
                    onValueChange={(val) => setFormData({ ...formData, is_hub2_compatible: val })}
                    trackColor={{ false: colors.border, true: colors.primary }}
                  />
                </View>
              </View>
            </View>
          )}

          <View style={styles.buttonContainer}>
            <ModalButton
              title={loading ? "Kaydediliyor..." : "Kaydet"}
              onPress={handleSave}
            />
          </View>
          
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomModal
        visible={modalVisible}
        onClose={handleModalClose}
        type={modalType}
        title={modalTitle}
      >
        <Text style={{ color: colors.text, textAlign: 'center', marginBottom: 16 }}>{modalMessage}</Text>
        <ModalButton title="Tamam" onPress={handleModalClose} />
      </CustomModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subsection: {
    gap: 8,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  hint: {
    fontSize: 13,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  switchContainer: {
    marginTop: 8,
    gap: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 16,
  },
  buttonContainer: {
    marginTop: 8,
  }
});