import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { CustomInput } from '@/components/CustomInput';
import { CustomModal, ModalButton } from '@/components/CustomModal';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

// Personel veri tipi
interface Profile {
  id: string;
  full_name: string;
  email: string;
}

export default function CreateTeamScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  // Lider Seçimi İçin State'ler
  const [leaders, setLeaders] = useState<Profile[]>([]);
  const [selectedLeader, setSelectedLeader] = useState<Profile | null>(null);
  const [loadingLeaders, setLoadingLeaders] = useState(false);
  const [leaderModalVisible, setLeaderModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    fetchLeaders();
  }, [user]);

  const fetchLeaders = async () => {
    try {
      setLoadingLeaders(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');

      if (error) throw error;

      if (data) {
        setLeaders(data);
        // Varsayılan olarak giriş yapan kullanıcıyı lider seç
        if (user) {
          const currentUser = data.find(p => p.id === user.id);
          if (currentUser) setSelectedLeader(currentUser);
        }
      }
    } catch (error) {
      console.log('Error fetching leaders:', error);
    } finally {
      setLoadingLeaders(false);
    }
  };

  const handleCreate = async () => {
    if (!name) {
        setModalType('error');
        setModalMessage('Ekip adı zorunludur.');
        setModalVisible(true);
        return;
    }

    if (!selectedLeader) {
        setModalType('error');
        setModalMessage('Lütfen bir ekip lideri seçiniz.');
        setModalVisible(true);
        return;
    }

    setSaving(true);
    
    // GÜNCELLENDİ: Seçilen liderin ID'si gönderiliyor
    const { error } = await supabase
      .from('teams')
      .insert([
        { 
            name, 
            description,
            leader_id: selectedLeader.id // <-- Manuel seçilen lider
        }
      ]);

    setSaving(false);
    
    if (error) {
      setModalType('error');
      setModalMessage('Hata: ' + error.message);
    } else {
      setModalType('success');
      setModalMessage('Ekip başarıyla oluşturuldu.');
    }
    setModalVisible(true);
  };

  // Modal içindeki filtreleme
  const filteredLeaders = leaders.filter(l => 
    l.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Yeni Ekip Oluştur</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <CustomInput
          label="Ekip Adı"
          value={name}
          onChangeText={setName}
          placeholder="Örn: Saha Satış Ekibi"
        />
        
        {/* LİDER SEÇİM ALANI */}
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: colors.text }]}>Ekip Lideri</Text>
          <TouchableOpacity 
            style={[styles.selector, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={() => setLeaderModalVisible(true)}
          >
            {loadingLeaders ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <View style={styles.selectorContent}>
                 <Text style={[styles.selectorText, { color: selectedLeader ? colors.text : colors.textSecondary }]}>
                    {selectedLeader ? selectedLeader.full_name || selectedLeader.email : 'Lider Seçiniz'}
                 </Text>
                 <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <CustomInput
          label="Açıklama"
          value={description}
          onChangeText={setDescription}
          placeholder="Ekip hakkında kısa bilgi"
          multiline
          numberOfLines={3}
          style={{ height: 80, textAlignVertical: 'top' }}
        />

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }]}
          onPress={handleCreate}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Oluştur</Text>}
        </TouchableOpacity>
      </View>

      {/* LİDER SEÇİM MODALI */}
      <Modal
        visible={leaderModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setLeaderModalVisible(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
             <Text style={[styles.modalTitle, { color: colors.text }]}>Lider Seçin</Text>
             <TouchableOpacity onPress={() => setLeaderModalVisible(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.text} />
             </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
             <Ionicons name="search" size={20} color={colors.textSecondary} style={{ marginRight: 8 }} />
             <CustomInput 
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="İsim veya E-posta ara..."
                containerStyle={{ flex: 1, marginBottom: 0 }}
                style={{ height: 40 }}
             />
          </View>

          <FlatList
            data={filteredLeaders}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 20 }}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[
                    styles.leaderItem, 
                    { backgroundColor: colors.card, borderColor: colors.border },
                    selectedLeader?.id === item.id && { borderColor: colors.primary, borderWidth: 2 }
                ]}
                onPress={() => {
                    setSelectedLeader(item);
                    setLeaderModalVisible(false);
                }}
              >
                 <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={{ color: colors.primary, fontWeight: 'bold' }}>
                        {item.full_name ? item.full_name.charAt(0).toUpperCase() : '?'}
                    </Text>
                 </View>
                 <View style={{ flex: 1 }}>
                    <Text style={[styles.leaderName, { color: colors.text }]}>{item.full_name || 'İsimsiz'}</Text>
                    <Text style={[styles.leaderEmail, { color: colors.textSecondary }]}>{item.email}</Text>
                 </View>
                 {selectedLeader?.id === item.id && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                 )}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Mesaj Modalı */}
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
  
  // Selector Stilleri
  inputContainer: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  selector: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  selectorContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorText: { fontSize: 16 },

  // Modal Stilleri
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  closeButton: { padding: 4 },
  searchContainer: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  leaderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  leaderName: { fontSize: 16, fontWeight: '600' },
  leaderEmail: { fontSize: 12 },
  modalText: { fontSize: 16, textAlign: 'center', marginBottom: 16 },
});