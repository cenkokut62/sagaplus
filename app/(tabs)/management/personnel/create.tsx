import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { CustomInput } from '@/components/CustomInput';
import { CustomPicker, PickerOption } from '@/components/CustomPicker';
import { CustomModal, ModalButton } from '@/components/CustomModal';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function CreatePersonnelScreen() {
  const { colors } = useTheme();
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedTitle, setSelectedTitle] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  
  // Dropdown Data
  const [cities, setCities] = useState<PickerOption[]>([]);
  const [titles, setTitles] = useState<PickerOption[]>([]);
  const [teams, setTeams] = useState<PickerOption[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    fetchDropdownData();
  }, []);

  const fetchDropdownData = async () => {
    setLoading(true);
    try {
      const [citiesRes, titlesRes, teamsRes] = await Promise.all([
        supabase.from('cities').select('id, name'),
        supabase.from('titles').select('id, name'),
        supabase.from('teams').select('id, name'),
      ]);

      if (citiesRes.data) setCities(citiesRes.data.map((c: any) => ({ label: c.name, value: c.id.toString() })));
      if (titlesRes.data) setTitles(titlesRes.data.map((t: any) => ({ label: t.name, value: t.id.toString() })));
      if (teamsRes.data) setTeams(teamsRes.data.map((t: any) => ({ label: t.name, value: t.id.toString() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    // Validasyon
    if (!email || !password || !fullName) {
      setModalType('error');
      setModalMessage('Ad Soyad, E-posta ve Şifre alanları zorunludur.');
      setModalVisible(true);
      return;
    }

    setSaving(true);

    try {
      // Edge Function Çağırısı
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email,
          password,
          full_name: fullName,
          phone,
          city_id: selectedCity || null,
          title_id: selectedTitle || null,
          team_id: selectedTeam || null,
        },
      });

      if (error) throw error;
      
      if (data?.error) {
        throw new Error(data.error);
      }

      setModalType('success');
      setModalMessage('Personel hesabı ve profili başarıyla oluşturuldu.');
      setModalVisible(true);

    } catch (err: any) {
      console.error('Create Personnel Error:', err);
      setModalType('error');
      // Edge Function'dan dönen hatayı veya genel hatayı göster
      setModalMessage('Oluşturma hatası: ' + (err.message || 'Bilinmeyen hata'));
      setModalVisible(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Yeni Personel</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <CustomInput
            label="Ad Soyad *"
            value={fullName}
            onChangeText={setFullName}
            icon="person-outline"
            placeholder="Örn: Ahmet Yılmaz"
          />
          
          <CustomInput
            label="E-posta *"
            value={email}
            onChangeText={setEmail}
            icon="mail-outline"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="ornek@sirket.com"
          />

          <CustomInput
            label="Şifre *"
            value={password}
            onChangeText={setPassword}
            icon="lock-closed-outline"
            secureTextEntry
            placeholder="******"
          />
          
          <CustomInput
            label="Telefon"
            value={phone}
            onChangeText={setPhone}
            icon="call-outline"
            keyboardType="phone-pad"
            placeholder="0555 555 55 55"
          />

          <CustomPicker
            label="Şehir"
            options={cities}
            value={selectedCity}
            onValueChange={setSelectedCity}
            icon="location-outline"
            placeholder="Şehir Seçiniz"
          />

          <CustomPicker
            label="Unvan"
            options={titles}
            value={selectedTitle}
            onValueChange={setSelectedTitle}
            icon="id-card-outline"
            placeholder="Unvan Seçiniz"
          />

          <CustomPicker
            label="Ekip"
            options={teams}
            value={selectedTeam}
            onValueChange={setSelectedTeam}
            icon="people-outline"
            placeholder="Ekip Seçiniz"
          />

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleCreate}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Hesabı Oluştur</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}

      <CustomModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        type={modalType}
      >
        <Text style={[styles.modalText, { color: colors.text }]}>{modalMessage}</Text>
        <ModalButton title="Tamam" onPress={() => {
          setModalVisible(false);
          if (modalType === 'success') router.back();
        }} />
      </CustomModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: { fontSize: 20, fontWeight: '600' },
  backButton: { padding: 4 },
  content: { padding: 20, paddingBottom: 40 },
  saveButton: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalText: { fontSize: 16, textAlign: 'center', marginBottom: 16 },
});