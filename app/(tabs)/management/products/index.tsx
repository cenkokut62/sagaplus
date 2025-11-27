import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Product, ProductCategory } from '@/types/product';
import { CustomInput } from '@/components/CustomInput';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CustomModal, ModalButton } from '@/components/CustomModal';

export default function ProductsIndex() {
  const { colors } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<ProductCategory>('standard');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [infoModalMessage, setInfoModalMessage] = useState('');
  const [infoModalType, setInfoModalType] = useState<'error' | 'success'>('error');

  // Delete Confirmation State
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('category', activeTab)
        .order('code', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      console.error('Error fetching products:', error);
      showInfoModal('Ürünler yüklenirken bir hata oluştu: ' + (error.message || ''), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, refreshing]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProducts();
  };

  const showInfoModal = (message: string, type: 'error' | 'success') => {
    setInfoModalMessage(message);
    setInfoModalType(type);
    setInfoModalVisible(true);
  };

  const confirmDelete = (id: string) => {
    setSelectedProductId(id);
    setDeleteModalVisible(true);
  };

  const handleDelete = async () => {
    if (!selectedProductId) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', selectedProductId);
        
      if (error) throw error;
      
      setDeleteModalVisible(false);
      setSelectedProductId(null);
      onRefresh(); // Listeyi yenile
    } catch (error) {
      setDeleteModalVisible(false);
      showInfoModal('Silme işlemi başarısız oldu.', 'error');
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderProductItem = ({ item }: { item: Product }) => (
    <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
      <View style={styles.cardHeader}>
        <View style={styles.codeContainer}>
          {item.category === 'standard' ? (
             <View>
                {item.code_wireless && (
                  <Text style={[styles.code, { color: colors.primary, fontSize: 12 }]}>
                    Wless: {item.code_wireless}
                  </Text>
                )}
                {item.code_wired && (
                  <Text style={[styles.code, { color: colors.textSecondary, fontSize: 12 }]}>
                    Wired: {item.code_wired}
                  </Text>
                )}
                {!item.code_wired && !item.code_wireless && (
                  <Text style={[styles.code, { color: colors.primary }]}>{item.code}</Text>
                )}
             </View>
          ) : (
             <Text style={[styles.code, { color: colors.primary }]}>{item.code}</Text>
          )}
          
          <Text style={[styles.typeBadge, { color: colors.textSecondary }]}>
            {item.type === 'package' ? 'PAKET' : 'UÇ BİRİM'}
          </Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => router.push({
                pathname: '/(tabs)/management/products/manage',
                params: { id: item.id }
            })}
            style={styles.actionButton}
          >
            <Ionicons name="create-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => confirmDelete(item.id)}
            style={styles.actionButton}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
      
      <Text style={[styles.productName, { color: colors.text }]}>{item.name}</Text>
      
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      
      <View style={styles.priceContainer}>
        {item.category === 'standard' ? (
          <>
            {item.subscription_price_wired !== null && (
               <View style={styles.priceRow}>
               <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Kablolu Ab.:</Text>
               <Text style={[styles.priceValue, { color: colors.text }]}>
                 ₺{item.subscription_price_wired?.toLocaleString('tr-TR')}
               </Text>
             </View>
            )}
             {item.subscription_price_wireless !== null && (
               <View style={styles.priceRow}>
               <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Kablosuz Ab.:</Text>
               <Text style={[styles.priceValue, { color: colors.text }]}>
                 ₺{item.subscription_price_wireless?.toLocaleString('tr-TR')}
               </Text>
             </View>
            )}
          </>
        ) : (
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Abonelik:</Text>
            <Text style={[styles.priceValue, { color: colors.text }]}>
              ₺{item.subscription_price?.toLocaleString('tr-TR')}
            </Text>
          </View>
        )}
      </View>

      {item.category === 'premium' && (
        <View style={styles.compatibilityContainer}>
           <View style={[styles.badge, { backgroundColor: item.is_hub_compatible ? colors.success + '20' : colors.error + '20' }]}>
              <Text style={{ fontSize: 10, color: item.is_hub_compatible ? colors.success : colors.error }}>
                Hub 4G: {item.is_hub_compatible ? 'Uyumlu' : 'Uyumsuz'}
              </Text>
           </View>
           <View style={[styles.badge, { backgroundColor: item.is_hub2_compatible ? colors.success + '20' : colors.error + '20' }]}>
              <Text style={{ fontSize: 10, color: item.is_hub2_compatible ? colors.success : colors.error }}>
                Hub 2: {item.is_hub2_compatible ? 'Uyumlu' : 'Uyumsuz'}
              </Text>
           </View>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
             <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Ürün Yönetimi</Text>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(tabs)/management/products/manage')}
          >
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'standard' && { borderBottomColor: colors.primary },
            ]}
            onPress={() => setActiveTab('standard')}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'standard' ? colors.primary : colors.textSecondary },
              ]}
            >
              Kale Alarm 2025
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'premium' && { borderBottomColor: colors.primary },
            ]}
            onPress={() => setActiveTab('premium')}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'premium' ? colors.primary : colors.textSecondary },
              ]}
            >
              Kale Alarm X
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <CustomInput
            placeholder="Ürün adı veya kodu ile ara..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            icon="search"
          />
        </View>

        {loading && !refreshing ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            renderItem={renderProductItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Bu kategoride ürün bulunamadı.
              </Text>
            }
          />
        )}
      </View>

      {/* Bilgilendirme Modalı (Hata vb.) */}
      <CustomModal
        visible={infoModalVisible}
        onClose={() => setInfoModalVisible(false)}
        type={infoModalType}
        title={infoModalType === 'error' ? 'Hata' : 'Başarılı'}
      >
        <Text style={{ color: colors.text, textAlign: 'center', marginBottom: 16 }}>{infoModalMessage}</Text>
        <ModalButton title="Tamam" onPress={() => setInfoModalVisible(false)} />
      </CustomModal>

      {/* Silme Onay Modalı */}
      <CustomModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        type="warning"
        title="Ürünü Sil"
      >
        <Text style={{ color: colors.text, textAlign: 'center', marginBottom: 16 }}>
          Bu ürünü silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
        </Text>
        <View style={styles.modalButtonRow}>
           <View style={{ flex: 1, marginRight: 8 }}>
             <ModalButton title="İptal" variant="secondary" onPress={() => setDeleteModalVisible(false)} />
           </View>
           <View style={{ flex: 1, marginLeft: 8 }}>
             <ModalButton title="Sil" variant="danger" onPress={handleDelete} />
           </View>
        </View>
      </CustomModal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 8,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    padding: 16,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 100,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  codeContainer: {
    flexDirection: 'column',
  },
  code: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  typeBadge: {
    fontSize: 10,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  actions: {
    flexDirection: 'row',
  },
  actionButton: {
    marginLeft: 12,
    padding: 4,
  },
  productName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  divider: {
    height: 1,
    marginBottom: 12,
    opacity: 0.2,
  },
  priceContainer: {
    gap: 4,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 12,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  compatibilityContainer: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 16,
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  }
});