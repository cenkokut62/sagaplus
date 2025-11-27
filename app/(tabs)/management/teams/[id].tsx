import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { CustomModal, ModalButton } from '@/components/CustomModal';

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();

  const [team, setTeam] = useState<any>(null);
  const [teamTarget, setTeamTarget] = useState<number>(0); // Ekip Hedefi State'i
  const [leader, setLeader] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal State
  const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [availablePersonnel, setAvailablePersonnel] = useState<any[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);

  useEffect(() => {
    fetchTeamDetails();
  }, [id]);

  const fetchTeamDetails = async () => {
    if (!refreshing) setLoading(true);
    
    try {
      // Şu anki ayın başlangıç tarihini bul (YYYY-MM-01)
      const date = new Date();
      const currentMonthStart = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;

      // 1. Ekip bilgilerini çek
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', id)
        .single();

      if (teamError) throw teamError;
      setTeam(teamData);

      // 2. Ekibin Bu Ayki Hedefini Çek
      const { data: tTargetData } = await supabase
        .from('monthly_targets')
        .select('target_amount')
        .eq('team_id', id)
        .eq('target_month', currentMonthStart)
        .eq('target_type', 'team')
        .single();
      
      setTeamTarget(tTargetData?.target_amount || 0);

      // 3. Lider Bilgisini Çek
      if (teamData.leader_id) {
        const { data: leaderData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, titles(name)')
          .eq('id', teamData.leader_id)
          .single();
        
        setLeader(leaderData);
      } else {
        setLeader(null);
      }

      // 4. Üyeleri ve Kişisel Hedeflerini Çek
      const { data: memberData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, titles(name)')
        .eq('team_id', id);

      if (memberData && memberData.length > 0) {
        // Bu üyelerin bu ayki hedeflerini topluca çek
        const memberIds = memberData.map(m => m.id);
        const { data: targetsData } = await supabase
          .from('monthly_targets')
          .select('user_id, target_amount')
          .eq('target_month', currentMonthStart)
          .eq('target_type', 'user')
          .in('user_id', memberIds);

        // Hedefleri üye verisiyle birleştir
        const membersWithTargets = memberData.map(member => {
          const target = targetsData?.find(t => t.user_id === member.id);
          return {
            ...member,
            current_target: target?.target_amount || 0
          };
        });

        setMembers(membersWithTargets);
      } else {
        setMembers([]);
      }

    } catch (error) {
      console.error('Veri çekme hatası:', error);
      Alert.alert('Hata', 'Ekip bilgileri yüklenirken bir sorun oluştu.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTeamDetails();
  }, []);

  // Üye Ekleme İşlemleri
  const handleOpenAddMember = async () => {
    setAddMemberModalVisible(true);
    setLoadingAvailable(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, titles(name)')
      .is('team_id', null)
      .order('full_name');
    if (data) setAvailablePersonnel(data);
    setLoadingAvailable(false);
  };

  const handleAddMember = async (userId: string) => {
    const { error } = await supabase.from('profiles').update({ team_id: id }).eq('id', userId);
    if (!error) {
      setAddMemberModalVisible(false);
      fetchTeamDetails();
    } else {
      Alert.alert('Hata', 'Üye eklenemedi.');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    Alert.alert('Onay', 'Personeli ekipten çıkarmak istiyor musunuz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Çıkar',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('profiles').update({ team_id: null }).eq('id', userId);
          if (!error) fetchTeamDetails();
        }
      }
    ]);
  };

  const renderAvatar = (url: string | null, name: string, size = 40) => {
    if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: size * 0.4, fontWeight: '600', color: colors.text }}>{name?.charAt(0).toUpperCase() || '?'}</Text>
      </View>
    );
  };

  const ListHeader = () => (
    <View>
      <View style={styles.teamHeader}>
        <View style={[styles.teamIcon, { backgroundColor: colors.primary + '20' }]}>
          <Ionicons name="people" size={32} color={colors.primary} />
        </View>
        <Text style={[styles.teamName, { color: colors.text }]}>{team?.name}</Text>
        <Text style={[styles.teamDesc, { color: colors.textSecondary }]}>{team?.description || 'Açıklama yok'}</Text>
        
        {/* EKİP HEDEFİ KARTI */}
        <View style={[styles.targetCard, { backgroundColor: colors.surface, borderColor: colors.primary + '30' }]}>
           <View style={{flexDirection: 'row', alignItems: 'center'}}>
             <Ionicons name="trending-up" size={20} color={colors.primary} style={{marginRight: 8}} />
             <Text style={[styles.targetLabel, { color: colors.textSecondary }]}>Bu Ayki Hedef:</Text>
           </View>
           <Text style={[styles.targetValue, { color: colors.primary }]}>{teamTarget} Adet</Text>
        </View>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>EKİP LİDERİ</Text>
        {leader ? (
          <View style={[styles.leaderCard, { backgroundColor: colors.cardBackground, borderColor: colors.primary }]}>
            <View style={styles.leaderInfo}>
               {renderAvatar(leader.avatar_url, leader.full_name, 50)}
               <View style={{ marginLeft: 16 }}>
                 <Text style={[styles.leaderName, { color: colors.text }]}>{leader.full_name}</Text>
                 <Text style={[styles.leaderTitle, { color: colors.primary }]}>{leader.titles?.name || 'Ekip Lideri'}</Text>
               </View>
            </View>
            <Ionicons name="star" size={24} color={colors.primary} />
          </View>
        ) : (
          <View style={[styles.emptyLeaderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
             <Text style={{ color: colors.textTertiary }}>Henüz lider atanmamış</Text>
          </View>
        )}
      </View>

      <View style={styles.membersHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ÜYELER ({members.length})</Text>
        <TouchableOpacity onPress={handleOpenAddMember} style={styles.addMemberBtn}>
          <Ionicons name="add" size={20} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '600', marginLeft: 4 }}>Üye Ekle</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderMemberItem = ({ item }: { item: any }) => (
    <View style={[styles.memberCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
      <View style={styles.memberInfo}>
        {renderAvatar(item.avatar_url, item.full_name)}
        <View style={{ marginLeft: 12 }}>
          <Text style={[styles.memberName, { color: colors.text }]}>{item.full_name}</Text>
          <Text style={[styles.memberTitle, { color: colors.textSecondary }]}>{item.titles?.name || 'Unvan Yok'}</Text>
        </View>
      </View>
      
      {/* Sağ Taraf: Hedef ve Silme */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {/* Üye Hedefi */}
        <View style={[styles.memberTargetBadge, { backgroundColor: colors.primary + '10' }]}>
           <Ionicons name="disc" size={14} color={colors.primary} style={{ marginRight: 4 }} />
           <Text style={[styles.memberTargetText, { color: colors.primary }]}>
             {item.current_target > 0 ? `${item.current_target}` : '-'}
           </Text>
        </View>

        {item.id !== team?.leader_id && (
          <TouchableOpacity onPress={() => handleRemoveMember(item.id)}>
            <Ionicons name="remove-circle-outline" size={24} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Ekip Detayı</Text>
        <TouchableOpacity onPress={() => router.push({ pathname: '/(tabs)/management/teams/edit', params: { id } })}>
          <Ionicons name="create-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          renderItem={renderMemberItem}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: 20 }}>Bu ekipte henüz üye yok.</Text>}
        />
      )}

      <CustomModal visible={addMemberModalVisible} onClose={() => setAddMemberModalVisible(false)} title="Üye Ekle" type="success">
        <View style={{ height: 400, width: '100%' }}>
          {loadingAvailable ? <ActivityIndicator color={colors.primary} /> : (
            <FlatList
              data={availablePersonnel}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={<Text style={{ textAlign: 'center', color: colors.textSecondary }}>Uygun personel bulunamadı.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.modalItem, { borderBottomColor: colors.border }]} onPress={() => handleAddMember(item.id)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {renderAvatar(item.avatar_url, item.full_name, 32)}
                    <View style={{ marginLeft: 12 }}>
                      <Text style={{ color: colors.text, fontWeight: '500' }}>{item.full_name}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.titles?.name}</Text>
                    </View>
                  </View>
                  <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
        <ModalButton title="Kapat" onPress={() => setAddMemberModalVisible(false)} variant="secondary" />
      </CustomModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontSize: 20, fontWeight: '600' },
  backButton: { padding: 4 },
  listContent: { paddingBottom: 40 },
  teamHeader: { alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee', marginBottom: 10 },
  teamIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  teamName: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  teamDesc: { fontSize: 14, textAlign: 'center', paddingHorizontal: 20, marginBottom: 16 },
  
  targetCard: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
    width: '100%', maxWidth: 300 
  },
  targetLabel: { fontSize: 14, fontWeight: '500' },
  targetValue: { fontSize: 16, fontWeight: '700' },

  sectionContainer: { paddingHorizontal: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '600', letterSpacing: 1, marginBottom: 10 },
  leaderCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 16, borderWidth: 1 },
  leaderInfo: { flexDirection: 'row', alignItems: 'center' },
  leaderName: { fontSize: 18, fontWeight: '700' },
  leaderTitle: { fontSize: 14, fontWeight: '500' },
  emptyLeaderCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed' },
  membersHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 10, marginBottom: 10 },
  addMemberBtn: { flexDirection: 'row', alignItems: 'center' },
  memberCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, marginBottom: 10, marginHorizontal: 20, borderRadius: 12, borderWidth: 1 },
  memberInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  memberName: { fontSize: 16, fontWeight: '600' },
  memberTitle: { fontSize: 13 },
  memberTargetBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  memberTargetText: { fontSize: 12, fontWeight: '700' },
  modalItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
});