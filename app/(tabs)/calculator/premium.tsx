import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { CustomModal, ModalButton } from '@/components/CustomModal';
import { generateAndSharePDF } from '@/services/pdfService';
import { Product } from '@/types/product';
import { CustomInput } from '@/components/CustomInput'; 

// Sabit Aktivasyon Ücreti (KDV Hariç)
const FIXED_ACTIVATION_FEE_NO_KDV = 4560;
const KDV_RATE = 1.20;

const formatPrice = (price: number | string) => {
    const num = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(num)) return '0.00 ₺';
    return num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
};

interface VisitParams {
    visitId: string;
    clientName: string;
    placeAddress: string;
    isVisitFlow: string; 
}

export default function PremiumCalculatorScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const params = useLocalSearchParams<VisitParams>();
    const isVisitFlow = params.isVisitFlow === 'true' && !!params.visitId;

    const [loading, setLoading] = useState(true);
    const [personnel, setPersonnel] = useState<any>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
    
    const [selectedHub, setSelectedHub] = useState<Product | null>(null); // Yeni Hub State

    const [isCampaignApplied, setIsCampaignApplied] = useState(false);
    const [wiredInstallationFee, setWiredInstallationFee] = useState('');

    const [modalVisible, setModalVisible] = useState(false);
    const [modalType, setModalType] = useState<'success' | 'error' | 'warning'>('default');
    const [modalMessage, setModalMessage] = useState('');
    const [modalAction, setModalAction] = useState<() => void>(() => { setModalVisible(false); });

    const fetchInitialData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase
                .from('profiles')
                .select(`full_name, title, email, phone`)
                .eq('id', user.id)
                .single();
            setPersonnel(profile);

            // Sadece Premium ürünleri çek
            const { data: productsData } = await supabase
                .from('products')
                .select('*')
                .eq('category', 'premium');
            setProducts(productsData || []);

        } catch (error) {
            console.error('Veri çekme hatası:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => {
        fetchInitialData();
    }, []));

    // Ürünleri Hub'lara ve Uç Birimlere ayır
    const hubs = products.filter(p => p.type === 'package').sort((a, b) => (a.subscription_price || 0) - (b.subscription_price || 0));
    
    const compatiblePeripherals = products.filter(p => {
        if (p.type !== 'peripheral' || !selectedHub) return false;
        
        // Basit Hub/Hub2 uyumluluk kontrolü (varsayımsal)
        const isCompatible = selectedHub.is_hub_compatible && p.is_hub_compatible || selectedHub.is_hub2_compatible && p.is_hub2_compatible;
        return isCompatible;
    }).sort((a, b) => a.name.localeCompare(b.name));

    // Hesaplama
    const subTotal = selectedProducts.reduce((sum, p) => 
        sum + (p.price * p.quantity), 0
    );

    const totalInstallationFee = parseFloat(wiredInstallationFee || '0');
    const activationFeeDisplay = FIXED_ACTIVATION_FEE_NO_KDV * KDV_RATE;
    const grandTotal = subTotal + totalInstallationFee;

    const handleHubSelection = (hub: Product) => {
        // Yeni Hub seçildiğinde önceki tüm ürünleri (Hub hariç) sıfırla
        setSelectedHub(hub);
        const existingHub = selectedProducts.find(p => p.id === hub.id);
        const hubPrice = hub.subscription_price || 0;

        // Önceki Hub'ı kaldır, yenisini ekle (miktar 1)
        setSelectedProducts(prev => {
            const filtered = prev.filter(p => p.type !== 'package');
            return [...filtered, { id: hub.id, name: hub.name, quantity: 1, price: hubPrice, type: 'package' }];
        });
    };
    
    const handlePeripheralQuantityChange = (product: Product, quantity: number) => {
        if (!selectedHub) return; // Hub seçilmeden ek birim eklenemez
        
        if (quantity <= 0) {
            setSelectedProducts(prev => prev.filter(p => p.id !== product.id));
        } else {
            setSelectedProducts(prev => {
                const existing = prev.find(p => p.id === product.id);
                // Premium fiyatı
                const price = product.subscription_price || 0; 

                if (existing) {
                    return prev.map(p => p.id === product.id ? { ...p, quantity, price, name: product.name } : p);
                } else {
                    return [...prev, { id: product.id, name: product.name, quantity, price, type: 'peripheral' }];
                }
            });
        }
    };

    const handleCreateAndSaveOffer = async () => {
        if (!isVisitFlow || !params.visitId) {
            setModalType('error');
            setModalMessage('Ziyaret bilgisi eksik. Teklif kaydedilemiyor.');
            setModalVisible(true);
            return;
        }

        if (subTotal <= 0 || !selectedHub) {
            setModalType('warning');
            setModalMessage('Teklif oluşturmak için lütfen öncelikle bir HUB seçin ve en az bir ürün seçin.');
            setModalVisible(true);
            return;
        }

        try {
            setLoading(true);
            
            const pdfData = {
                businessName: params.clientName || 'Yeni Müşteri',
                date: new Date().toLocaleDateString('tr-TR'),
                products: selectedProducts.map(p => ({ name: p.name, quantity: p.quantity, price: p.price })),
                totalPrice: subTotal, 
                isCampaignApplied: isCampaignApplied,
                wiredInstallationFee: totalInstallationFee, 
                personnel: {
                    fullName: personnel?.full_name || 'Bilinmiyor',
                    title: personnel?.title || 'Danışman',
                    email: personnel?.email || '',
                    phone: personnel?.phone || '',
                },
            };
            
            const pdfUri = await generateAndSharePDF(pdfData);

            await supabase
                .from('offers')
                .insert({
                    visit_id: params.visitId,
                    user_id: supabase.auth.user()?.id,
                    products_data: pdfData, 
                    total_price: grandTotal, 
                    is_campaign_applied: isCampaignApplied,
                    pdf_url: pdfUri, 
                })
                .select()
                .single();

            setModalType('success');
            setModalMessage('Teklif başarıyla oluşturuldu ve ziyarete kaydedildi.');
            setModalAction(() => () => router.replace({ 
                pathname: '/(tabs)/visits/active', 
                params: { visitId: params.visitId } 
            }));
            setModalVisible(true);

        } catch (error) {
            console.error('Teklif kaydetme hatası:', error);
            setModalType('error');
            setModalMessage('Teklif oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.');
            setModalAction(() => { setLoading(false); setModalVisible(false); });
            setModalVisible(true);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                    {isVisitFlow ? `${params.clientName} Teklif Hazırlama (Premium)` : 'Hesaplayıcı (Premium)'}
                </Text>
                <View style={{ width: 24 }} />
            </View>
            
            <ScrollView contentContainerStyle={styles.scrollContent}>
                
                {isVisitFlow && (
                    <View style={[styles.visitInfoCard, { backgroundColor: colors.primary + '10' }]}>
                        <Ionicons name="location-outline" size={20} color={colors.primary} />
                        <Text style={[styles.visitInfoText, { color: colors.primary }]}>Müşteri: {params.clientName}</Text>
                    </View>
                )}

                {/* HUB SEÇİMİ */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>1. HUB Seçimi (Ana Panel)</Text>
                {hubs.map(product => {
                    const isSelected = selectedHub && selectedHub.id === product.id;
                    const price = product.subscription_price || 0;

                    return (
                        <TouchableOpacity
                            key={product.id} 
                            style={[
                                styles.productRow, 
                                { borderColor: isSelected ? colors.primary : colors.border, borderWidth: isSelected ? 2 : 1 }
                            ]}
                            onPress={() => handleHubSelection(product)}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.productName, { color: colors.text }]}>{product.name}</Text>
                                <Text style={[styles.productPrice, { color: colors.textSecondary }]}>
                                    Aylık: {formatPrice(price)}
                                </Text>
                            </View>
                            <Ionicons 
                                name={isSelected ? "checkmark-circle" : "radio-button-off-outline"} 
                                size={26} 
                                color={isSelected ? colors.success : colors.textTertiary} 
                            />
                        </TouchableOpacity>
                    );
                })}

                {/* UYUMLU UÇ BİRİM SEÇİMİ */}
                <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>2. Uyumlu Uç Birimler (Aksesuarlar)</Text>
                {!selectedHub ? (
                    <Text style={[styles.warningText, { color: colors.error }]}>Lütfen önce bir HUB (Ana Panel) seçin.</Text>
                ) : (
                    compatiblePeripherals.map(product => {
                        const selected = selectedProducts.find(p => p.id === product.id);
                        const quantity = selected ? selected.quantity : 0;
                        const price = product.subscription_price || 0; 

                        return (
                            <View key={product.id} style={[styles.productRow, { borderColor: colors.border }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.productName, { color: colors.text }]}>{product.name}</Text>
                                    <Text style={[styles.productPrice, { color: colors.textSecondary }]}>
                                        Aylık: {formatPrice(price)}
                                    </Text>
                                </View>
                                <View style={styles.quantityControl}>
                                    <TouchableOpacity onPress={() => handlePeripheralQuantityChange(product, quantity - 1)} disabled={quantity === 0}>
                                        <Ionicons name="remove-circle-outline" size={26} color={quantity > 0 ? colors.error : colors.textTertiary} />
                                    </TouchableOpacity>
                                    <Text style={[styles.quantityText, { color: colors.text }]}>{quantity}</Text>
                                    <TouchableOpacity onPress={() => handlePeripheralQuantityChange(product, quantity + 1)}>
                                        <Ionicons name="add-circle-outline" size={26} color={colors.primary} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })
                )}
                
                {/* Kampanya ve Montaj Ücreti */}
                <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>Aktivasyon ve Montaj Ücretleri</Text>
                
                <View style={[styles.extraRow, { borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.productName, { color: colors.text }]}>Tek Seferlik Aktivasyon Bedeli</Text>
                        <Text style={[styles.productPrice, { color: colors.textSecondary }]}>4560₺ + KDV (Kampanyasız Toplam: {formatPrice(activationFeeDisplay)})</Text>
                    </View>
                    <Switch
                        trackColor={{ false: colors.border, true: colors.success }}
                        thumbColor={isCampaignApplied ? colors.cardBackground : colors.textSecondary}
                        onValueChange={setIsCampaignApplied}
                        value={isCampaignApplied}
                    />
                </View>

                <View style={[styles.extraRow, { borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.productName, { color: colors.text }]}>Kablolu Montaj Farkı (₺)</Text>
                        <Text style={[styles.productPrice, { color: colors.textSecondary }]}>Bu tutar teklife KDV hariç eklenir.</Text>
                    </View>
                    <View style={{ width: 100 }}>
                        <CustomInput 
                            value={wiredInstallationFee}
                            onChangeText={setWiredInstallationFee}
                            keyboardType="numeric"
                            placeholder="0"
                            textAlign='right'
                        />
                    </View>
                </View>


                {/* ÖZET KUTUSU */}
                <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
                    <Text style={[styles.summaryTitle, { color: colors.text }]}>Teklif Özeti (KDV HARİÇ)</Text>
                    
                    <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Abonelik Toplamı:</Text>
                        <Text style={[styles.summaryValue, { color: colors.text }]}>{formatPrice(subTotal)}</Text>
                    </View>
                    
                    <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Montaj Farkı:</Text>
                        <Text style={[styles.summaryValue, { color: colors.text }]}>{formatPrice(totalInstallationFee)}</Text>
                    </View>

                    <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Aktivasyon (KDV Dahil):</Text>
                        <Text style={[styles.summaryValue, { color: isCampaignApplied ? colors.success : colors.error }]}>
                            {isCampaignApplied ? 'Ücretsiz (Kampanya)' : formatPrice(activationFeeDisplay)}
                        </Text>
                    </View>
                        
                    <View style={styles.summaryRowTotal}>
                        <Text style={[styles.summaryTotalLabel, { color: colors.primary }]}>Teklif Toplam Tutar (KDV HARİÇ):</Text>
                        <Text style={[styles.summaryTotalValue, { color: colors.primary }]}>
                            {formatPrice(grandTotal)}
                        </Text>
                    </View>
                </View>

                {/* TEKLİF KAYDET VE ÇIK BUTONU */}
                {isVisitFlow && (
                    <TouchableOpacity 
                        style={[styles.saveButton, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
                        onPress={handleCreateAndSaveOffer}
                        disabled={loading || !selectedHub || subTotal <= 0}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="save-outline" size={20} color="#fff" style={{ marginRight: 10 }} />
                                <Text style={styles.saveButtonText}>Teklifi Oluştur ve Ziyarete Kaydet</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}

            </ScrollView>

            {/* CUSTOM MODAL */}
            <CustomModal
                visible={modalVisible}
                onClose={() => { setModalVisible(false); }}
                type={modalType}
                title={modalType === 'success' ? 'Başarılı' : modalType === 'warning' ? 'Uyarı' : 'Hata'}
            >
                <Text style={{ textAlign: 'center', marginBottom: 20, color: colors.text }}>{modalMessage}</Text>
                <ModalButton 
                   title="Tamam" 
                   onPress={() => { setModalVisible(false); modalType === 'success' && modalAction(); }} 
                   variant={modalType === 'error' || modalType === 'warning' ? 'danger' : 'primary'}
                />
            </CustomModal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
    headerTitle: { fontSize: 18, fontWeight: '600' },
    backButton: { padding: 4 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
    
    visitInfoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        marginBottom: 20,
        gap: 8,
    },
    visitInfoText: { fontSize: 14, fontWeight: '600' },
    
    sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
    warningText: { fontSize: 14, fontStyle: 'italic', marginBottom: 10, paddingLeft: 5 },
    
    productRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 5,
        borderBottomWidth: 1,
        borderRadius: 10,
        marginBottom: 5,
    },
    productName: { fontSize: 15, fontWeight: '500' },
    productPrice: { fontSize: 13, marginTop: 2 },
    
    quantityControl: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    quantityText: { fontSize: 16, fontWeight: '600', minWidth: 20, textAlign: 'center' },
    
    extraRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
    },

    summaryCard: {
        marginTop: 25,
        padding: 18,
        borderRadius: 12,
        borderWidth: 1,
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
        borderBottomWidth: 1,
        paddingBottom: 8,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    summaryLabel: { fontSize: 13 },
    summaryValue: { fontSize: 13, fontWeight: 'bold' },

    summaryRowTotal: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderColor: 'rgba(0,0,0,0.2)',
    },
    summaryTotalLabel: { fontSize: 14, fontWeight: 'bold' },
    summaryTotalValue: { fontSize: 16, fontWeight: 'bold' },

    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        marginTop: 30,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    }
});