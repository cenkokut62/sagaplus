import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { CustomInput } from '@/components/CustomInput';
import { CustomPicker, PickerOption } from '@/components/CustomPicker';
import { CustomModal, ModalButton } from '@/components/CustomModal';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

export default function EditTeamScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedLeader, setSelectedLeader] = useState('');
  const [personnelList, setPersonnelList] = useState<PickerOption[]>([]);
  
  const [initialLeader, setInitialLeader] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    fetchTeamData();
    fetchPersonnel();
  }, [id]);

  const fetchPersonnel = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name');
    if (data) {
      setPersonnelList(data.map((p: any) => ({ label: p.full_name, value: p.id })));
    }
  };

  const fetchTeamData = async () => {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', id)
      .single();

    if (!error && data) {
      setName(data.name);
      setDescription(data.description || '');
      const leaderId = data.leader_id || '';
      setSelectedLeader(leaderId);
      setInitialLeader(leaderId);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const updates: any = {
      name,
      description,
      leader_id: selectedLeader || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', id);

    if (error) {
      setSaving(false);
      setModalType('error');
      setModalMessage('Hata: ' + error.message);
      setModalVisible(true);
      return;
    }

    // BİLDİRİM TETİKLEME: Lider Değişikliği Varsa
    if (selectedLeader !== initialLeader && selectedLeader) {
      try {
        await supabase.functions.invoke('handle-team-activity', {
          body: {
            event: 'LEADER_UPDATE',
            user_id: selectedLeader,
            team_id: id,
          }
        });
        setInitialLeader(selectedLeader);
      } catch (e) {
        console.error('Bildirim hatası:', e);
      }
    }

    setSaving(false);
    setModalType('success');
    setModalMessage('Ekip güncellendi.');
    setModalVisible(true);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Ekibi Düzenle</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <View style={styles.content}>
          <CustomInput
            label="Ekip Adı"
            value={name}
            onChangeText={setName}
          />
          <CustomInput
            label="Açıklama"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            style={{ height: 80 }}
          />
          
          <CustomPicker
            label="Ekip Lideri"
            options={personnelList}
            value={selectedLeader}
            onValueChange={setSelectedLeader}
            placeholder="Lider Seçiniz"
            icon="ribbon-outline"
          />

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Değişiklikleri Kaydet</Text>}
          </TouchableOpacity>
        </View>
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
  content: { padding: 20 },
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