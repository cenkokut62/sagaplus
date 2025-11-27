import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { CustomModal, ModalButton } from '@/components/CustomModal';

export default function ProfileScreen() {
  // ThemeContext'ten toggleTheme ve colorScheme'i de alıyoruz
  const { colors, toggleTheme, colorScheme } = useTheme();
  const { signOut, user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [teamInfo, setTeamInfo] = useState<any>(null);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchProfileData();
    }, [])
  );

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          titles (name),
          team_members (
            role,
            teams (
              id,
              name,
              leader_id
            )
          )
        `)
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setProfileData(data);

      if (data.team_members && data.team_members.length > 0) {
        const memberRecord = data.team_members[0];
        setTeamInfo({
          name: memberRecord.teams?.name,
          role: memberRecord.role,
          isLeader: memberRecord.role === 'leader',
          teamId: memberRecord.teams?.id
        });
      } else {
        setTeamInfo(null);
      }

    } catch (error) {
      console.error('Profil yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLogoutModalVisible(false);
    try {
      await signOut();
      router.replace('/login');
    } catch (error) {
      Alert.alert('Hata', 'Çıkış yapılırken bir sorun oluştu.');
    }
  };

  const getRoleText = (role: string) => {
    if (role === 'leader') return 'Ekip Lideri 👑';
    if (role === 'admin') return 'Yönetici 🛡️';
    return 'Ekip Üyesi 👤';
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        
        {/* --- PROFİL BAŞLIĞI --- */}
        <View style={styles.header}>
          <View style={[styles.avatarContainer, { borderColor: colors.primary }]}>
             {profileData?.avatar_url ? (
               <Image source={{ uri: profileData.avatar_url }} style={styles.avatar} />
             ) : (
               <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surface }]}>
                 <Text style={[styles.avatarInitial, { color: colors.primary }]}>
                   {profileData?.full_name?.charAt(0).toUpperCase() || 'U'}
                 </Text>
               </View>
             )}
             <View style={styles.statusDot} />
          </View>
          
          <Text style={[styles.nameText, { color: colors.text }]}>
            {profileData?.full_name || 'Kullanıcı Adı'}
          </Text>
          
          <Text style={[styles.titleText, { color: colors.textSecondary }]}>
            {profileData?.titles?.name || 'Unvan Belirtilmemiş'}
          </Text>

          <View style={styles.badges}>
             <View style={[styles.badge, { backgroundColor: colors.primary + '15' }]}>
               <Text style={[styles.badgeText, { color: colors.primary }]}>Aktif Personel</Text>
             </View>
          </View>
        </View>

        {/* --- EKİP BİLGİ KARTI --- */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
           <View style={styles.sectionHeader}>
             <Ionicons name="people" size={20} color={colors.primary} />
             <Text style={[styles.sectionTitle, { color: colors.text }]}>Ekip Bilgisi</Text>
           </View>
           
           {teamInfo ? (
             <View style={styles.teamCard}>
               <View>
                 <Text style={[styles.teamName, { color: colors.text }]}>{teamInfo.name}</Text>
                 <Text style={[styles.teamRole, { color: teamInfo.isLeader ? colors.primary : colors.textSecondary }]}>
                   {getRoleText(teamInfo.role)}
                 </Text>
               </View>
               {teamInfo.isLeader && (
                 <Ionicons name="star" size={24} color={colors.warning} />
               )}
             </View>
           ) : (
             <View style={styles.noTeamState}>
               <Text style={[styles.noTeamText, { color: colors.textSecondary }]}>
                 Herhangi bir ekibe dahil değilsiniz.
               </Text>
             </View>
           )}
        </View>

        {/* --- İLETİŞİM BİLGİLERİ --- */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
           <View style={styles.sectionHeader}>
             <Ionicons name="information-circle" size={20} color={colors.primary} />
             <Text style={[styles.sectionTitle, { color: colors.text }]}>İletişim Bilgileri</Text>
           </View>
           
           <View style={styles.infoRow}>
             <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>E-posta</Text>
             <Text style={[styles.infoValue, { color: colors.text }]}>{profileData?.email || user?.email}</Text>
           </View>
           <View style={[styles.divider, { backgroundColor: colors.border }]} />
           <View style={styles.infoRow}>
             <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Telefon</Text>
             <Text style={[styles.infoValue, { color: colors.text }]}>{profileData?.phone || '-'}</Text>
           </View>
        </View>

        {/* --- AYARLAR MENÜSÜ (SADELEŞTİRİLMİŞ) --- */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
           <TouchableOpacity 
             style={styles.menuItem}
             onPress={toggleTheme} // Butona tıklanınca temayı değiştir
           >
             <View style={styles.menuLeft}>
               {/* Temaya göre ikon değişir: Ay (Koyu) veya Güneş (Açık) */}
               <Ionicons 
                 name={colorScheme === 'dark' ? "moon" : "sunny"} 
                 size={22} 
                 color={colors.text} 
               />
               <Text style={[styles.menuText, { color: colors.text }]}>
                 {colorScheme === 'dark' ? 'Koyu Tema' : 'Açık Tema'}
               </Text>
             </View>
             {/* Sağ tarafta durum ikonu */}
             <Ionicons 
                name={colorScheme === 'dark' ? "toggle" : "toggle-outline"} 
                size={24} 
                color={colors.primary} 
             />
           </TouchableOpacity>
        </View>

        {/* --- ÇIKIŞ BUTONU --- */}
        <TouchableOpacity 
          style={[styles.logoutButton, { backgroundColor: colors.error + '15' }]}
          onPress={() => setLogoutModalVisible(true)}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>Oturumu Kapat</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Çıkış Onay Modalı */}
      <CustomModal
        visible={logoutModalVisible}
        onClose={() => setLogoutModalVisible(false)}
        title="Çıkış Yap"
        type="warning"
      >
        <Text style={{ color: colors.text, marginBottom: 20, textAlign: 'center' }}>
          Hesabınızdan çıkış yapmak istediğinize emin misiniz?
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
          <ModalButton title="Vazgeç" onPress={() => setLogoutModalVisible(false)} variant="secondary" />
          <ModalButton title="Çıkış Yap" onPress={handleSignOut} variant="danger" />
        </View>
      </CustomModal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20 },
  
  header: { alignItems: 'center', marginBottom: 24 },
  avatarContainer: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, padding: 3, marginBottom: 12, position: 'relative' },
  avatar: { width: '100%', height: '100%', borderRadius: 50 },
  avatarPlaceholder: { width: '100%', height: '100%', borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 36, fontWeight: 'bold' },
  statusDot: { position: 'absolute', bottom: 5, right: 5, width: 18, height: 18, borderRadius: 9, backgroundColor: '#10B981', borderWidth: 3, borderColor: '#fff' },
  
  nameText: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  titleText: { fontSize: 16 },
  badges: { flexDirection: 'row', marginTop: 12, gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  
  section: { borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginLeft: 8 },
  
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: '500' },
  divider: { height: 1, width: '100%' },
  
  teamCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  teamName: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  teamRole: { fontSize: 14, fontWeight: '600' },
  noTeamState: { padding: 10, alignItems: 'center' },
  noTeamText: { fontStyle: 'italic' },
  
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuText: { fontSize: 16, fontWeight: '500' },
  
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, gap: 8 },
  logoutText: { fontSize: 16, fontWeight: '600' }
});