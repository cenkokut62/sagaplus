import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { CustomModal, ModalButton } from '@/components/CustomModal';
import { CustomInput } from '@/components/CustomInput';
import { CustomPicker } from '@/components/CustomPicker';

type TargetType = 'user' | 'team';

interface MonthlyTarget {
  id: string;
  target_type: TargetType;
  target_amount: number;
  target_month: string;
  profiles?: { full_name: string };
  teams?: { name: string };
}

export default function TargetManagement() {
  const { colors } = useTheme();
  const router = useRouter();

  // State
  const [loading, setLoading] = useState(false);
  const [targets, setTargets] = useState<MonthlyTarget[]>([]);
  const [activeTab, setActiveTab] = useState<TargetType>('user');
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formType, setFormType] = useState<TargetType>('user');
  const [formEntityId, setFormEntityId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  
  // Tarih Seçim State'leri
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  
  // Veriler
  const [usersList, setUsersList] = useState<{label: string, value: string}[]>([]);
  const [teamsList, setTeamsList] = useState<{label: string, value: string}[]>([]);

  // Sabit Veriler: Aylar ve Yıllar
  const months = [
    { label: 'Ocak', value: '1' }, { label: 'Şubat', value: '2' }, 
    { label: 'Mart', value: '3' }, { label: 'Nisan', value: '4' },
    { label: 'Mayıs', value: '5' }, { label: 'Haziran', value: '6' },
    { label: 'Temmuz', value: '7' }, { label: 'Ağustos', value: '8' },
    { label: 'Eylül', value: '9' }, { label: 'Ekim', value: '10' },
    { label: 'Kasım', value: '11' }, { label: 'Aralık', value: '12' }
  ];

  const years = Array.from({ length: 5 }, (_, i) => ({
    label: (currentYear + i).toString(),
    value: (currentYear + i).toString()
  }));

  const fetchBaseData = async () => {
    const { data: users } = await supabase.from('profiles').select('id, full_name');
    if (users) setUsersList(users.map(u => ({ label: u.full_name, value: u.id })));

    const { data: teams } = await supabase.from('teams').select('id, name');
    if (teams) setTeamsList(teams.map(t => ({ label: t.name, value: t.id.toString() })));
  };

  const fetchTargets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('monthly_targets')
        .select(`*, profiles(full_name), teams(name)`)
        .eq('target_type', activeTab)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTargets(data || []);
    } catch (error) {
      console.error(error);
      Alert.alert('Hata', 'Hedefler yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBaseData(); }, []);
  useEffect(() => { fetchTargets(); }, [activeTab]);

  const handleOpenModal = (target?: MonthlyTarget) => {
    if (target) {
      // Düzenleme
      setSelectedId(target.id);
      setFormType(target.target_type);
      setFormEntityId(target.target_type === 'user' ? (target as any).user_id : (target as any).team_id.toString());
      setFormAmount(target.target_amount.toString());
      
      const date = new Date(target.target_month);
      setSelectedMonth((date.getMonth() + 1).toString());
      setSelectedYear(date.getFullYear().toString());
    } else {
      // Yeni Ekleme
      setSelectedId(null);
      setFormType(activeTab);
      setFormEntityId('');
      setFormAmount('');
      // Varsayılan tarih bu ay
      setSelectedMonth((new Date().getMonth() + 1).toString());
      setSelectedYear(currentYear.toString());
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formEntityId || !formAmount) {
      Alert.alert('Uyarı', 'Lütfen personel/ekip ve hedef tutarını giriniz.');
      return;
    }

    setLoading(true);
    try {
      // Tarihi YYYY-MM-01 formatına getir
      const formattedMonth = selectedMonth.padStart(2, '0');
      const targetDate = `${selectedYear}-${formattedMonth}-01`;

      const payload: any = {
        target_type: formType,
        target_amount: parseInt(formAmount),
        target_month: targetDate,
        updated_at: new Date().toISOString(),
      };

      if (formType === 'user') {
        payload.user_id = formEntityId;
        payload.team_id = null;
      } else {
        payload.team_id = parseInt(formEntityId);
        payload.user_id = null;
      }

      if (selectedId) {
        const { error } = await supabase.from('monthly_targets').update(payload).eq('id', selectedId);
        if (error) throw error;
      } else {
        // Kontrol: Aynı ay için hedef var mı?
        const checkQuery = supabase.from('monthly_targets')
          .select('id')
          .eq('target_month', targetDate)
          .eq('target_type', formType);

        if (formType === 'user') checkQuery.eq('user_id', formEntityId);
        else checkQuery.eq('team_id', formEntityId);

        const { data: existing } = await checkQuery.single();
        
        if (existing) {
          Alert.alert('Hata', 'Bu kayıt için seçilen ayda zaten bir hedef tanımlı. Lütfen var olanı düzenleyin.');
          setLoading(false);
          return;
        }

        const { error } = await supabase.from('monthly_targets').insert(payload);
        if (error) throw error;
      }

      setModalVisible(false);
      fetchTargets();
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'İşlem başarısız.');
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: MonthlyTarget }) => {
    const date = new Date(item.target_month);
    const dateStr = date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

    return (
      <TouchableOpacity 
        style={[styles.card, { backgroundColor: colors.cardBackground }]}
        onPress={() => handleOpenModal(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.iconBox}>
            <Ionicons name="calendar" size={20} color={colors.primary} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {item.target_type === 'user' ? item.profiles?.full_name : item.teams?.name}
            </Text>
            <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
              Hedef Ayı: {dateStr}
            </Text>
          </View>
          <View style={styles.targetBadge}>
            <Text style={[styles.targetValue, { color: colors.primary }]}>{item.target_amount}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Hedef Yönetimi</Text>
        <TouchableOpacity 
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => handleOpenModal()}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'user' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('user')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'user' ? colors.primary : colors.textSecondary }]}>Personel</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'team' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('team')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'team' ? colors.primary : colors.textSecondary }]}>Ekip</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={targets}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchTargets} />}
        ListEmptyComponent={<View style={styles.emptyState}><Text style={{ color: colors.textSecondary }}>Kayıt bulunamadı.</Text></View>}
      />

      <CustomModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={selectedId ? "Hedefi Düzenle" : "Yeni Hedef Ata"}
      >
        <View style={{ gap: 12 }}>
          {/* Tip Seçimi */}
          {!selectedId && (
            <CustomPicker
              label="Hedef Tipi"
              options={[
                { label: 'Personel Hedefi', value: 'user', icon: 'person' },
                { label: 'Ekip Hedefi', value: 'team', icon: 'people' },
              ]}
              value={formType}
              onValueChange={(val) => {
                setFormType(val as TargetType);
                setFormEntityId('');
              }}
            />
          )}

          {/* Kişi/Ekip Seçimi */}
          <CustomPicker
            label={formType === 'user' ? "Personel Seçiniz" : "Ekip Seçiniz"}
            placeholder="Seçim Yapınız"
            options={formType === 'user' ? usersList : teamsList}
            value={formEntityId}
            onValueChange={setFormEntityId}
          />

          {/* Tarih Seçimi (Yan Yana) */}
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <CustomPicker
                label="Ay"
                options={months}
                value={selectedMonth}
                onValueChange={setSelectedMonth}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <CustomPicker
                label="Yıl"
                options={years}
                value={selectedYear}
                onValueChange={setSelectedYear}
              />
            </View>
          </View>

          <CustomInput
            label="Hedef Tutarı (Adet)"
            placeholder="Örn: 100"
            keyboardType="numeric"
            value={formAmount}
            onChangeText={setFormAmount}
            icon="trending-up"
          />

          <View style={styles.modalButtons}>
            <ModalButton title="İptal" onPress={() => setModalVisible(false)} variant="secondary" />
            <View style={{ width: 10 }} />
            <ModalButton title="Kaydet" onPress={handleSave} />
          </View>
        </View>
      </CustomModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  backButton: { padding: 4 },
  addButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 10 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'transparent' },
  tabText: { fontSize: 15, fontWeight: '600' },
  listContent: { padding: 20 },
  card: { borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardSubtitle: { fontSize: 12, marginTop: 2 },
  targetBadge: { backgroundColor: 'rgba(76, 175, 80, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  targetValue: { fontWeight: '700', fontSize: 14 },
  emptyState: { padding: 40, alignItems: 'center' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' }
});