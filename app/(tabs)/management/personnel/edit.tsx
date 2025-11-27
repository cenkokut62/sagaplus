import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { CustomInput } from '@/components/CustomInput';
import { CustomPicker, PickerOption } from '@/components/CustomPicker';
import { CustomModal, ModalButton } from '@/components/CustomModal';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

export default function EditPersonnelScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedTitle, setSelectedTitle] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  
  // Takım değişikliğini algılamak için
  const [initialTeam, setInitialTeam] = useState('');

  const [cities, setCities] = useState<PickerOption[]>([]);
  const [titles, setTitles] = useState<PickerOption[]>([]);
  const [teams, setTeams] = useState<PickerOption[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error'>('success');
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  useEffect(() => {
    fetchDropdownData();
    if (id) fetchProfileData();
  }, [id]);

  const fetchDropdownData = async () => {
    const [citiesRes, titlesRes, teamsRes] = await Promise.all([
      supabase.from('cities').select('id, name'),
      supabase.from('titles').select('id, name'),
      supabase.from('teams').select('id, name'),
    ]);

    if (citiesRes.data) setCities(citiesRes.data.map((c: any) => ({ label: c.name, value: c.id.toString() })));
    if (titlesRes.data) setTitles(titlesRes.data.map((t: any) => ({ label: t.name, value: t.id.toString() })));
    if (teamsRes.data) setTeams(teamsRes.data.map((t: any) => ({ label: t.name, value: t.id.toString() })));
  };

  const fetchProfileData = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (!error && data) {
      setFullName(data.full_name || '');
      setPhone(data.phone || '');
      setSelectedCity(data.city_id?.toString() || '');
      setSelectedTitle(data.title_id?.toString() || '');
      
      const currentTeam = data.team_id?.toString() || '';
      setSelectedTeam(currentTeam);
      setInitialTeam(currentTeam); // İlk takımı kaydet
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const updates = {
      full_name: fullName,
      phone: phone,
      city_id: selectedCity ? parseInt(selectedCity) : null,
      title_id: selectedTitle ? parseInt(selectedTitle) : null,
      team_id: selectedTeam ? parseInt(selectedTeam) : null,
    };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id);

    if (error) {
      setSaving(false);
      setModalType('error');
      setModalMessage('Güncelleme başarısız: ' + error.message);
      setModalVisible(true);
      return;
    }

    // BİLDİRİM TETİKLEME: Takım Değişikliği Varsa
    if (selectedTeam !== initialTeam) {
      try {
        await supabase.functions.invoke('handle-team-activity', {
          body: {
            event: 'PERSONNEL_UPDATE',
            user_id: id,
            old_team_id: initialTeam ? parseInt(initialTeam) : null,
            new_team_id: selectedTeam ? parseInt(selectedTeam) : null,
          }
        });
        // State'i güncelle ki tekrar basarsa bildirim gitmesin
        setInitialTeam(selectedTeam);
      } catch (e) {
        console.error('Bildirim hatası:', e);
      }
    }

    setSaving(false);
    setModalType('success');
    setModalMessage('Personel bilgileri başarıyla güncellendi.');
    setModalVisible(true);
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteModalVisible(false);

    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setModalType('success');
      setModalMessage('Personel kalıcı olarak silindi.');
      setModalVisible(true);
    } catch (err: any) {
      setModalType('error');
      setModalMessage('Silme işlemi başarısız: ' + (err.message || 'Bilinmeyen hata'));
      setModalVisible(true);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Personel Düzenle</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <CustomInput
            label="Ad Soyad"
            value={fullName}
            onChangeText={setFullName}
            icon="person-outline"
          />
          
          <CustomInput
            label="Telefon"
            value={phone}
            onChangeText={setPhone}
            icon="call-outline"
            keyboardType="phone-pad"
          />

          <CustomPicker
            label="Şehir"
            options={cities}
            value={selectedCity}
            onValueChange={setSelectedCity}
            icon="location-outline"
          />

          <CustomPicker
            label="Unvan"
            options={titles}
            value={selectedTitle}
            onValueChange={setSelectedTitle}
            icon="id-card-outline"
          />

          <CustomPicker
            label="Ekip"
            options={teams}
            value={selectedTeam}
            onValueChange={setSelectedTeam}
            icon="people-outline"
          />

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={saving || deleting}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Kaydet</Text>}
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={[styles.deleteButton, { borderColor: colors.error }]}
            onPress={() => setDeleteModalVisible(true)}
            disabled={saving || deleting}
          >
            {deleting ? (
              <ActivityIndicator color={colors.error} />
            ) : (
              <Text style={[styles.deleteButtonText, { color: colors.error }]}>Personeli Sil</Text>
            )}
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

      <CustomModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        title="Personeli Sil"
        type="error"
      >
        <Text style={[styles.modalText, { color: colors.text }]}>
          Bu personeli silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve personelin tüm verileri silinir.
        </Text>
        <View style={styles.modalButtonRow}>
          <View style={{ flex: 1 }}>
            <ModalButton
              title="İptal"
              onPress={() => setDeleteModalVisible(false)}
              variant="secondary"
            />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <ModalButton
              title="Sil"
              onPress={handleDelete}
              variant="danger"
            />
          </View>
        </View>
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
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 24 },
  deleteButton: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  deleteButtonText: { fontSize: 16, fontWeight: '600' },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
});