import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Switch, FlatList, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { CustomModal, ModalButton } from '@/components/CustomModal';
import { generateAndSharePDF } from '@/services/pdfService';
import { Product } from '@/types/product';
import { CustomInput } from '@/components/CustomInput'; 

// Sabitler
const FIXED_ACTIVATION_FEE_NO_KDV = 4560;
const PER_WIRED_PRODUCT_FEE = 216; // Adet başı kablolu ürün montaj farkı (Net)
const KDV_RATE = 0.20; // %20 KDV

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

// Kampanya Akordiyon Bileşeni (Aylık Abonelik İçin - Detaylı)
const CampaignAccordion = ({ monthlyNet, colors }: { monthlyNet: number, colors: any }) => {
    const [expanded, setExpanded] = useState(false);
    
    // Kampanya: İlk 3 ay %50 indirim (Sadece aylık abonelik üzerinden)
    const discountedNet = monthlyNet / 2;
    const vatAmount = discountedNet * KDV_RATE;
    const discountedTotal = discountedNet + vatAmount;
    
    // 3 Aylık Toplam Fayda (Toplam üzerinden)
    const normalTotal = monthlyNet * (1 + KDV_RATE);
    const benefitTotal = (normalTotal * 3) - (discountedTotal * 3);

    return (
        <View style={[styles.accordionContainer, { borderColor: colors.success, marginBottom: 15 }]}>
            <TouchableOpacity onPress={() => setExpanded(!expanded)} style={[styles.accordionHeader, { backgroundColor: colors.success + '15' }]}>
                <View style={{flexDirection:'row', alignItems:'center'}}>
                    <Ionicons name="gift-outline" size={20} color={colors.success} style={{marginRight: 8}} />
                    <Text style={[styles.accordionTitle, { color: colors.success }]}>İlk 3 Ay %50 İndirim Kampanyası</Text>
                </View>
                <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={colors.success} />
            </TouchableOpacity>
            {expanded && (
                <View style={styles.accordionContent}>
                    <View style={styles.accordionRow}>
                        <Text style={{color: colors.textSecondary}}>İndirimli Aylık (Net):</Text>
                        <Text style={{color: colors.text, fontWeight:'600'}}>{formatPrice(discountedNet)}</Text>
                    </View>
                    <View style={styles.accordionRow}>
                        <Text style={{color: colors.textSecondary}}>KDV (%20):</Text>
                        <Text style={{color: colors.text}}>{formatPrice(vatAmount)}</Text>
                    </View>
                    <View style={styles.accordionRow}>
                        <Text style={{color: colors.textSecondary}}>İndirimli Aylık (Toplam):</Text>
                        <Text style={{color: colors.text, fontWeight:'bold'}}>{formatPrice(discountedTotal)}</Text>
                    </View>
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <View style={styles.accordionRow}>
                        <Text style={{color: colors.success, fontWeight:'bold'}}>3 Aylık Toplam Fayda:</Text>
                        <Text style={{color: colors.success, fontWeight:'bold'}}>{formatPrice(benefitTotal)}</Text>
                    </View>
                    <Text style={{fontSize: 11, color: colors.textTertiary, marginTop: 5}}>
                        * Kampanya kapsamında ilk 3 fatura %50 indirimli yansıtılacaktır.
                    </Text>
                </View>
            )}
        </View>
    );
};

// Kablolu Montaj Farkı Akordiyonu
const InstallationFeeAccordion = ({ feeNet, count, colors }: { feeNet: number, count: number, colors: any }) => {
    const [expanded, setExpanded] = useState(false);
    
    if (feeNet <= 0) return null;

    const vat = feeNet * KDV_RATE;
    const total = feeNet + vat;

    return (
        <View style={[styles.accordionContainer, { borderColor: colors.warning, marginBottom: 15 }]}>
             <TouchableOpacity onPress={() => setExpanded(!expanded)} style={[styles.accordionHeader, { backgroundColor: colors.warning + '15' }]}>
                <View style={{flexDirection:'row', alignItems:'center'}}>
                    <Ionicons name="construct-outline" size={20} color={colors.warning} style={{marginRight: 8}} />
                    <Text style={[styles.accordionTitle, { color: colors.warning }]}>Kablolu Montaj Farkı</Text>
                </View>
                <View style={{flexDirection:'row', alignItems:'center'}}>
                     <Text style={{fontWeight:'bold', color: colors.warning, marginRight: 5, fontSize:12}}>{formatPrice(total)} (Dahil)</Text>
                     <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={colors.warning} />
                </View>
            </TouchableOpacity>
            {expanded && (
                <View style={styles.accordionContent}>
                     <View style={styles.accordionRow}>
                        <Text style={{color: colors.textSecondary}}>Hesaplama:</Text>
                        <Text style={{color: colors.text}}>{formatPrice(PER_WIRED_PRODUCT_FEE)} x {count} Adet (Net)</Text>
                    </View>
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <View style={styles.accordionRow}>
                        <Text style={{color: colors.textSecondary}}>Ara Toplam (Net):</Text>
                        <Text style={{color: colors.text, fontWeight:'600'}}>{formatPrice(feeNet)}</Text>
                    </View>
                     <View style={styles.accordionRow}>
                        <Text style={{color: colors.textSecondary}}>KDV (%20):</Text>
                        <Text style={{color: colors.text}}>{formatPrice(vat)}</Text>
                    </View>
                    <View style={[styles.accordionRow, { marginTop:4 }]}>
                        <Text style={{color: colors.text, fontWeight:'bold'}}>Toplam Tutar:</Text>
                        <Text style={{color: colors.text, fontWeight:'bold'}}>{formatPrice(total)}</Text>
                    </View>
                    <Text style={{fontSize: 11, color: colors.textTertiary, marginTop: 8, fontStyle:'italic'}}>
                        * Kablosuz ana pakete eklenen kablolu ürünler için montaj bedeli yansıtılır. Bu bedel kampanya indirimine dahil değildir.
                    </Text>
                </View>
            )}
        </View>
    )
}

export default function StandardCalculatorScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const params = useLocalSearchParams<VisitParams>();
    const isVisitFlow = params.isVisitFlow === 'true' && !!params.visitId;

    const [loading, setLoading] = useState(true);
    const [personnel, setPersonnel] = useState<any>(null);
    const [products, setProducts] = useState<Product[]>([]);
    
    // SEÇİMLER
    const [selectedPackage, setSelectedPackage] = useState<Product | null>(null);
    const [isPackageWireless, setIsPackageWireless] = useState(true); // Default Kablosuz
    const [selectedPeripherals, setSelectedPeripherals] = useState<any[]>([]);

    // MODAL CONTROLS
    const [packageModalVisible, setPackageModalVisible] = useState(false);
    const [peripheralModalVisible, setPeripheralModalVisible] = useState(false);
    
    const [variantSelectionVisible, setVariantSelectionVisible] = useState(false);
    const [tempSelectedProduct, setTempSelectedProduct] = useState<Product | null>(null);

    // AYARLAR
    const [isActivationFree, setIsActivationFree] = useState(false); 

    // UI Feedback & Custom Modal
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

            const { data: productsData } = await supabase
                .from('products')
                .select('*')
                .eq('category', 'standard');
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

    const packages = products.filter(p => p.type === 'package').sort((a, b) => (a.subscription_price_wireless || 0) - (b.subscription_price_wireless || 0));
    const peripheralsList = products.filter(p => p.type === 'peripheral').sort((a, b) => a.name.localeCompare(b.name));

    // --- HESAPLAMALAR ---
    
    // 1. Aylık Abonelik Hesabı
    const packagePrice = selectedPackage 
        ? (isPackageWireless ? (selectedPackage.subscription_price_wireless || 0) : (selectedPackage.subscription_price_wired || 0))
        : 0;
    
    const peripheralsSubscriptionTotal = selectedPeripherals.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const monthlyNet = packagePrice + peripheralsSubscriptionTotal;
    const monthlyVAT = monthlyNet * KDV_RATE;
    const monthlyTotal = monthlyNet + monthlyVAT;

    // 2. Kablolu Montaj Farkı Hesabı (Otomatik)
    let automaticWiredInstallationFeeNet = 0;
    let wiredCount = 0;
    if (isPackageWireless) {
        const wiredItems = selectedPeripherals.filter(p => p.variant === 'wired');
        wiredCount = wiredItems.reduce((acc, item) => acc + item.quantity, 0);
        automaticWiredInstallationFeeNet = wiredCount * PER_WIRED_PRODUCT_FEE;
    }
    const installationFeeVAT = automaticWiredInstallationFeeNet * KDV_RATE;
    const installationFeeTotal = automaticWiredInstallationFeeNet + installationFeeVAT;

    // 3. Aktivasyon Hesabı
    const activationFeeNet = isVisitFlow 
        ? (isActivationFree ? 0 : FIXED_ACTIVATION_FEE_NO_KDV)
        : 0;
    const activationFeeVAT = activationFeeNet * KDV_RATE;
    const activationFeeTotal = activationFeeNet + activationFeeVAT;

    // --- FONKSİYONLAR ---

    const initiateAddPeripheral = (product: Product) => {
        setPeripheralModalVisible(false);
        setTempSelectedProduct(product);
        setVariantSelectionVisible(true);
    };

    const confirmAddPeripheral = (variant: 'wired' | 'wireless') => {
        setVariantSelectionVisible(false);
        if (!tempSelectedProduct) return;

        // KURAL: Kablosuz Ana Paket + Max 2 Kablolu Ürün
        if (isPackageWireless && variant === 'wired') {
            const currentWiredCount = selectedPeripherals
                .filter(p => p.variant === 'wired')
                .reduce((acc, curr) => acc + curr.quantity, 0);
            
            if (currentWiredCount >= 2) {
                setModalType('warning');
                setModalMessage('Kablosuz ana pakete en fazla 2 adet kablolu ilave ürün ekleyebilirsiniz!');
                setModalVisible(true);
                return;
            }
        }

        const price = variant === 'wireless' 
            ? (tempSelectedProduct.subscription_price_wireless || 0) 
            : (tempSelectedProduct.subscription_price_wired || 0);

        setSelectedPeripherals(prev => {
            const existing = prev.find(p => p.id === tempSelectedProduct.id && p.variant === variant);
            if (existing) {
                return prev.map(p => p.id === tempSelectedProduct.id && p.variant === variant ? { ...p, quantity: p.quantity + 1 } : p);
            } else {
                return [...prev, { 
                    id: tempSelectedProduct.id, 
                    name: tempSelectedProduct.name, 
                    quantity: 1, 
                    price: price, 
                    variant: variant,
                    code: variant === 'wireless' ? tempSelectedProduct.code_wireless : tempSelectedProduct.code_wired 
                }];
            }
        });
        setTempSelectedProduct(null);
    };

    const updateQuantity = (index: number, change: number) => {
        const item = selectedPeripherals[index];
        
        // Kural Kontrolü (Artırma işlemi ve kablolu ise)
        if (change > 0 && isPackageWireless && item.variant === 'wired') {
            const currentWiredCount = selectedPeripherals
                .filter(p => p.variant === 'wired')
                .reduce((acc, curr) => acc + curr.quantity, 0);
            
            if (currentWiredCount >= 2) {
                setModalType('warning');
                setModalMessage('Kablosuz ana pakete en fazla 2 adet kablolu ilave ürün ekleyebilirsiniz!');
                setModalVisible(true);
                return;
            }
        }

        const newQuantity = item.quantity + change;

        if (newQuantity <= 0) {
            const newList = [...selectedPeripherals];
            newList.splice(index, 1);
            setSelectedPeripherals(newList);
        } else {
            const newList = [...selectedPeripherals];
            newList[index].quantity = newQuantity;
            setSelectedPeripherals(newList);
        }
    };

    const handleCreateAndSaveOffer = async () => {
        if (!isVisitFlow || !params.visitId || !selectedPackage) {
            setModalType('error');
            setModalMessage('Paket seçimi yapılmadı veya ziyaret bilgisi eksik.');
            setModalVisible(true);
            return;
        }

        try {
            setLoading(true);
            
            const productList = [
                { 
                    name: `${selectedPackage.name} (${isPackageWireless ? 'Kablosuz' : 'Kablolu'})`, 
                    quantity: 1, 
                    price: packagePrice 
                },
                ...selectedPeripherals.map(p => ({
                    name: `${p.name} (${p.variant === 'wired' ? 'Kablolu' : 'Kablosuz'})`,
                    quantity: p.quantity,
                    price: p.price
                }))
            ];

            if (isVisitFlow) {
                productList.push({ 
                    name: isActivationFree ? 'Aktivasyon Bedeli (Kampanyalı)' : 'Aktivasyon Bedeli', 
                    quantity: 1, 
                    price: activationFeeNet // Net tutar
                });
            }

            if (automaticWiredInstallationFeeNet > 0) {
                productList.push({ 
                    name: `Kablolu Montaj Farkı (${wiredCount} Adet)`, 
                    quantity: 1, 
                    price: automaticWiredInstallationFeeNet // Net tutar
                });
            }

            // PDF ve DB için toplam (Her şey dahil genel toplam)
            const offerGrandTotal = monthlyTotal + installationFeeTotal + activationFeeTotal;

            const pdfData = {
                businessName: params.clientName || 'Yeni Müşteri',
                date: new Date().toLocaleDateString('tr-TR'),
                products: productList,
                totalPrice: monthlyNet, // Abonelik matrahı (PDF'te bu baz alınır, diğerleri eklenir)
                isCampaignApplied: isActivationFree,
                wiredInstallationFee: automaticWiredInstallationFeeNet, 
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
                    total_price: offerGrandTotal, 
                    is_campaign_applied: isActivationFree,
                    pdf_url: pdfUri, 
                })
                .select()
                .single();

            setModalType('success');
            setModalMessage('Teklif başarıyla oluşturuldu.');
            setModalAction(() => () => router.replace({ 
                pathname: '/(tabs)/visits/active', 
                params: { visitId: params.visitId } 
            }));
            setModalVisible(true);

        } catch (error) {
            console.error('Teklif hatası:', error);
            setModalType('error');
            setModalMessage('Teklif oluşturulurken bir hata oluştu.');
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
                    {isVisitFlow ? `${params.clientName} (Standart)` : 'Hesaplayıcı (Standart)'}
                </Text>
                <View style={{ width: 24 }} />
            </View>
            
            <ScrollView contentContainerStyle={styles.scrollContent}>
                
                {/* 1. ANA PAKET */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>1. Ana Paket Seçimi</Text>
                    {selectedPackage ? (
                        <View style={[styles.selectedItemCard, { borderColor: colors.primary }]}>
                            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                                <View style={{flex: 1}}>
                                    <Text style={[styles.itemName, { color: colors.text }]}>{selectedPackage.name}</Text>
                                    <Text style={{color: colors.textSecondary, fontSize: 12}}>
                                        {isPackageWireless ? 'Kablosuz' : 'Kablolu'} Sistem
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => setSelectedPackage(null)}>
                                    <Ionicons name="close-circle" size={24} color={colors.error} />
                                </TouchableOpacity>
                            </View>
                            
                            <View style={styles.switchRow}>
                                <Text style={{color: colors.text}}>Kablolu</Text>
                                <Switch
                                    value={isPackageWireless}
                                    onValueChange={setIsPackageWireless}
                                    trackColor={{ false: colors.border, true: colors.primary }}
                                />
                                <Text style={{color: colors.text, fontWeight: 'bold'}}>Kablosuz</Text>
                            </View>
                            
                            <Text style={[styles.itemPrice, { color: colors.primary }]}>
                                {formatPrice(packagePrice)} / Ay
                            </Text>
                        </View>
                    ) : (
                        <TouchableOpacity 
                            style={[styles.selectButton, { borderColor: colors.border, borderStyle: 'dashed' }]}
                            onPress={() => setPackageModalVisible(true)}
                        >
                            <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                            <Text style={[styles.selectButtonText, { color: colors.primary }]}>Ana Paket Seçiniz</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* 2. UÇ BİRİMLER */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>2. İlave Ürünler</Text>
                    {selectedPeripherals.map((item, index) => (
                        <View key={index} style={[styles.peripheralRow, { borderBottomColor: colors.border }]}>
                            <View style={{flex: 1}}>
                                <Text style={[styles.pName, { color: colors.text }]}>{item.name}</Text>
                                <Text style={[styles.pVariant, { color: colors.textTertiary }]}>
                                    {item.variant === 'wired' ? 'Kablolu' : 'Kablosuz'}
                                </Text>
                            </View>
                            
                            {/* Miktar Kontrolü */}
                            <View style={styles.quantityControl}>
                                <TouchableOpacity onPress={() => updateQuantity(index, -1)}>
                                    <Ionicons name="remove-circle-outline" size={26} color={colors.error} />
                                </TouchableOpacity>
                                <Text style={[styles.quantityText, { color: colors.text }]}>{item.quantity}</Text>
                                <TouchableOpacity onPress={() => updateQuantity(index, 1)}>
                                    <Ionicons name="add-circle-outline" size={26} color={colors.primary} />
                                </TouchableOpacity>
                            </View>

                            <Text style={[styles.pPrice, { color: colors.text, minWidth: 70, textAlign:'right' }]}>{formatPrice(item.price * item.quantity)}</Text>
                        </View>
                    ))}
                    <TouchableOpacity 
                        style={[styles.smallAddButton, { backgroundColor: colors.surface }]}
                        onPress={() => {
                            if (!selectedPackage) {
                                setModalType('warning');
                                setModalMessage("Önce ana paket seçmelisiniz.");
                                setModalVisible(true);
                                return;
                            }
                            setPeripheralModalVisible(true);
                        }}
                    >
                        <Ionicons name="add" size={18} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontWeight: '600' }}>Ürün Ekle</Text>
                    </TouchableOpacity>
                </View>

                {/* 3. AKTİVASYON (Ziyaret Modu) */}
                {isVisitFlow && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Hizmet Bedelleri</Text>
                        <View style={[styles.activationBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <View style={styles.activationHeader}>
                                <Text style={{color: colors.text, fontWeight:'600'}}>Aktivasyon Bedeli</Text>
                                <TouchableOpacity 
                                    onPress={() => setIsActivationFree(!isActivationFree)}
                                    style={[styles.freeBtn, { backgroundColor: isActivationFree ? colors.success : colors.textTertiary }]}
                                >
                                    <Text style={{color: '#fff', fontSize: 11, fontWeight:'bold'}}>
                                        {isActivationFree ? 'Ücretsiz Yapıldı' : 'Ücretsiz Yap'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <View style={{flexDirection:'row', alignItems:'center', marginTop: 5}}>
                                <Text style={[
                                    styles.activationPrice, 
                                    { color: colors.text, textDecorationLine: isActivationFree ? 'line-through' : 'none', opacity: isActivationFree ? 0.5 : 1 }
                                ]}>
                                    {formatPrice(FIXED_ACTIVATION_FEE_NO_KDV)} + KDV
                                </Text>
                                {isActivationFree && (
                                    <Text style={{color: colors.success, fontWeight:'bold', marginLeft: 10}}>0.00 ₺</Text>
                                )}
                            </View>
                        </View>
                    </View>
                )}

                {/* 4. FİYAT KARTI */}
                <View style={[styles.priceCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <Text style={[styles.priceCardTitle, { color: colors.text }]}>Fiyat Özeti (Aylık Abonelik)</Text>
                    
                    {/* Kampanya Bilgisi */}
                    <CampaignAccordion monthlyNet={monthlyNet} colors={colors} />

                    {/* Kablolu Montaj Farkı (Varsa) */}
                    <InstallationFeeAccordion feeNet={automaticWiredInstallationFeeNet} count={wiredCount} colors={colors} />

                    {/* Abonelik Detayları */}
                    <View style={styles.priceRow}>
                        <Text style={{color: colors.textSecondary}}>Aylık Abonelik (Net):</Text>
                        <Text style={{color: colors.text, fontWeight: '600'}}>{formatPrice(monthlyNet)}</Text>
                    </View>
                    <View style={styles.priceRow}>
                        <Text style={{color: colors.textSecondary}}>KDV (%20):</Text>
                        <Text style={{color: colors.text}}>{formatPrice(monthlyVAT)}</Text>
                    </View>
                    
                    <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
                        <Text style={[styles.totalLabel, { color: colors.primary }]}>AYLIK TOPLAM:</Text>
                        <Text style={[styles.totalValue, { color: colors.primary }]}>{formatPrice(monthlyTotal)}</Text>
                    </View>
                </View>

                {/* KAYDET BUTONU */}
                {isVisitFlow && (
                    <TouchableOpacity 
                        style={[styles.saveButton, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
                        onPress={handleCreateAndSaveOffer}
                        disabled={loading || !selectedPackage}
                    >
                        {loading ? <ActivityIndicator color="#fff" /> : (
                            <Text style={styles.saveButtonText}>Teklifi Oluştur ve Kaydet</Text>
                        )}
                    </TouchableOpacity>
                )}

            </ScrollView>

            {/* PAKET SEÇİM MODALI */}
            <Modal visible={packageModalVisible} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={{flex: 1, backgroundColor: colors.background}}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, {color: colors.text}]}>Ana Paket Seçiniz</Text>
                        <TouchableOpacity onPress={() => setPackageModalVisible(false)}><Ionicons name="close" size={24} color={colors.text}/></TouchableOpacity>
                    </View>
                    <FlatList
                        data={packages}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{padding: 20}}
                        renderItem={({item}) => (
                            <TouchableOpacity 
                                style={[styles.modalItem, {backgroundColor: colors.surface}]}
                                onPress={() => { setSelectedPackage(item); setPackageModalVisible(false); }}
                            >
                                <Text style={[styles.modalItemText, {color: colors.text}]}>{item.name}</Text>
                                <Text style={{color: colors.primary}}>{formatPrice(item.subscription_price_wireless || 0)}</Text>
                            </TouchableOpacity>
                        )}
                    />
                </SafeAreaView>
            </Modal>

            {/* UÇ BİRİM SEÇİM MODALI */}
            <Modal visible={peripheralModalVisible} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={{flex: 1, backgroundColor: colors.background}}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, {color: colors.text}]}>Ürün Ekle</Text>
                        <TouchableOpacity onPress={() => setPeripheralModalVisible(false)}><Ionicons name="close" size={24} color={colors.text}/></TouchableOpacity>
                    </View>
                    <FlatList
                        data={peripheralsList}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{padding: 20}}
                        renderItem={({item}) => (
                            <TouchableOpacity 
                                style={[styles.modalItem, {backgroundColor: colors.surface}]}
                                onPress={() => initiateAddPeripheral(item)}
                            >
                                <Text style={[styles.modalItemText, {color: colors.text}]}>{item.name}</Text>
                                <Ionicons name="add-circle" size={24} color={colors.primary} />
                            </TouchableOpacity>
                        )}
                    />
                </SafeAreaView>
            </Modal>

            {/* VARYANT SEÇİM MODALI (CUSTOM) */}
            <CustomModal 
                visible={variantSelectionVisible} 
                onClose={() => setVariantSelectionVisible(false)}
                title="Ürün Tipi Seçimi"
            >
                <Text style={{textAlign:'center', marginBottom:20, color: colors.text}}>
                    {tempSelectedProduct?.name} için bağlantı tipini seçiniz:
                </Text>
                <View style={{gap: 10}}>
                    <ModalButton title="Kablosuz" onPress={() => confirmAddPeripheral('wireless')} variant="primary" />
                    <ModalButton title="Kablolu" onPress={() => confirmAddPeripheral('wired')} variant="secondary" />
                </View>
            </CustomModal>

            {/* UYARI MODALI */}
            <CustomModal visible={modalVisible} onClose={() => setModalVisible(false)} type={modalType}>
                <Text style={{textAlign:'center', marginBottom:15, color: colors.text}}>{modalMessage}</Text>
                <ModalButton title="Tamam" onPress={() => { setModalVisible(false); if(modalType==='success') modalAction(); }} />
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
    
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
    
    selectButton: { borderWidth: 2, borderRadius: 12, height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    selectButtonText: { fontSize: 16, fontWeight: '600' },
    
    selectedItemCard: { borderWidth: 1, borderRadius: 12, padding: 15 },
    itemName: { fontSize: 16, fontWeight: 'bold' },
    itemPrice: { fontSize: 18, fontWeight: 'bold', marginTop: 10, textAlign: 'right' },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
    
    peripheralRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    pName: { fontSize: 14, fontWeight: '500' },
    pVariant: { fontSize: 12 },
    pPrice: { fontWeight: '600' },
    quantityControl: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 10 },
    quantityText: { fontSize: 16, fontWeight: '600', minWidth: 20, textAlign: 'center' },

    smallAddButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 8, marginTop: 10, gap: 5 },
    
    activationBox: { padding: 12, borderRadius: 8, borderWidth: 1, marginTop: 5 },
    activationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    activationPrice: { fontSize: 16, fontWeight: 'bold' },
    freeBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },

    priceCard: { borderWidth: 1, borderRadius: 16, padding: 16 },
    priceCardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
    priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    divider: { height: 1, marginVertical: 8 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, marginTop: 5 },
    totalLabel: { fontSize: 16, fontWeight: 'bold' },
    totalValue: { fontSize: 20, fontWeight: 'bold' },
    
    saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, marginTop: 20 },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    modalItem: { padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalItemText: { fontSize: 16, fontWeight: '500', flex: 1 },

    accordionContainer: { borderWidth: 1, borderRadius: 8, marginBottom: 15, overflow: 'hidden' },
    accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10 },
    accordionTitle: { fontSize: 13, fontWeight: '600' },
    accordionContent: { padding: 10 },
    accordionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
});