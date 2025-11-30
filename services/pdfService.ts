import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

// --- TİP TANIMLAMALARI ---
interface PersonnelData {
  fullName: string;
  title: string;
  email: string;
  phone: string;
}

interface OfferData {
  businessName: string;
  date: string;
  products: any[];
  totalPrice: number;
  isCampaignApplied: boolean;
  wiredInstallationFee: number;
  personnel: PersonnelData;
}

interface PersonnelInfo {
  fullName: string;
  title: string;
  city: string; // Modal'dan gelen Bölge bilgisi buraya gelecek
  team: string;
}

interface ReportMetrics {
  totalVisits: number;
  plannedVisits: number;
  completedVisits: number;
  totalDurationMinutes: number;
  offerCount: number;
  conversionRate: number;
}

// Ortak Stil ve Yardımcılar
const logoUrl = "https://i.hizliresim.com/fggvd7x.png"; 
const primaryColor = "#E63946"; 
const secondaryColor = "#1D3557"; 

// =================================================================
// 1. FONKSİYON: GELİŞMİŞ TEKLİF PDF (SENİN KODUN - AYNI KALDI)
// =================================================================
export const generateAndSharePDF = async (data: OfferData, shouldShare: boolean = true) => {
  const { businessName, date, products, totalPrice, isCampaignApplied, wiredInstallationFee, personnel } = data;
  const standardActivationFee = 4560 * 1.20;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Open Sans', sans-serif; color: #333; margin: 0; padding: 0; }
          .page-header { background: ${primaryColor}; color: white; padding: 40px; display: flex; justify-content: space-between; align-items: center; border-bottom: 5px solid ${secondaryColor}; }
          .brand h1 { font-family: 'Montserrat', sans-serif; font-size: 28px; margin: 0; letter-spacing: 1px; }
          .brand p { margin: 5px 0 0; font-size: 12px; opacity: 0.9; }
          .logo-box { background: white; padding: 10px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .logo-img { height: 60px; display: block; }
          
          .client-bar { background: #f8f9fa; padding: 25px 40px; display: flex; justify-content: space-between; border-bottom: 1px solid #ddd; }
          .client-info h3 { margin: 0 0 5px; color: ${secondaryColor}; font-family: 'Montserrat', sans-serif; }
          .meta-info { text-align: right; }
          .meta-label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
          .meta-value { font-weight: bold; color: #333; font-size: 14px; }

          .container { padding: 40px; }
          
          .data-table { width: 100%; border-collapse: collapse; margin-top: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
          .data-table th { background: ${secondaryColor}; color: white; padding: 12px 15px; text-align: left; font-size: 12px; font-family: 'Montserrat', sans-serif; }
          .data-table td { padding: 12px 15px; border-bottom: 1px solid #eee; font-size: 13px; }
          .data-table tr:nth-child(even) { background: #fcfcfc; }
          .price-col { text-align: right; font-family: 'Montserrat', sans-serif; font-weight: 600; }

          .total-section { display: flex; justify-content: flex-end; margin-top: 30px; }
          .total-box { width: 350px; background: #fff; border: 1px solid #eee; border-radius: 8px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; color: #555; }
          .grand-total { border-top: 2px solid ${primaryColor}; margin-top: 15px; padding-top: 15px; font-size: 20px; color: ${primaryColor}; font-weight: bold; font-family: 'Montserrat', sans-serif; }

          .footer { margin-top: 50px; border-top: 2px solid #eee; padding-top: 30px; display: flex; justify-content: space-between; font-size: 11px; color: #666; }
          .personnel-badge { display: flex; align-items: center; gap: 15px; }
          .avatar-circle { width: 40px; height: 40px; background: ${secondaryColor}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; }
          
          .watermark { position: fixed; bottom: 20px; right: 20px; opacity: 0.05; font-size: 100px; font-weight: bold; color: #000; z-index: -1; transform: rotate(-45deg); pointer-events: none; }
        </style>
      </head>
      <body>
        <div class="watermark">TEKLİF</div>
        
        <div class="page-header">
          <div class="brand">
            <h1>GÜVENLİK ÇÖZÜMLERİ</h1>
            <p>SAGA PLUS & KALE GÜVENLİK ÇÖZÜM ORTAKLIĞI</p>
          </div>
          <div class="logo-box">
            <img src="${logoUrl}" class="logo-img" />
          </div>
        </div>

        <div class="client-bar">
          <div class="client-info">
            <div class="meta-label">MÜŞTERİ</div>
            <h3>${businessName}</h3>
          </div>
          <div class="meta-info">
            <div class="meta-label">TEKLİF TARİHİ</div>
            <div class="meta-value">${date}</div>
          </div>
        </div>

        <div class="container">
          <p style="color: #666; font-size: 13px; line-height: 1.6;">
            Sayın İlgili,<br>
            İşletmenizin güvenlik ihtiyaçları için hazırlanan özel teklifimiz aşağıda detaylandırılmıştır.
          </p>

          <table class="data-table">
            <thead>
              <tr>
                <th>ÜRÜN / HİZMET</th>
                <th style="text-align: center;">ADET</th>
                <th style="text-align: right;">BİRİM FİYAT</th>
                <th style="text-align: right;">TOPLAM</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong style="color:${secondaryColor}">STANDART GÜVENLİK PAKETİ</strong><br>
                  <span style="font-size:10px; color:#888;">Ana Panel, Keypad, PIR Dedektör, Siren, Akü</span>
                </td>
                <td style="text-align: center;">1</td>
                <td class="price-col">-</td>
                <td class="price-col">-</td>
              </tr>
              ${products.map(p => `
                <tr>
                  <td>${p.name}</td>
                  <td style="text-align: center;">${p.quantity}</td>
                  <td class="price-col">${p.price.toLocaleString('tr-TR')} ₺</td>
                  <td class="price-col">${(p.price * p.quantity).toLocaleString('tr-TR')} ₺</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="total-section">
            <div class="total-box">
              <div class="total-row">
                <span>Ara Toplam</span>
                <span>${totalPrice.toLocaleString('tr-TR')} ₺</span>
              </div>
              ${isCampaignApplied ? `
                <div class="total-row" style="color: #27ae60; font-weight: bold;">
                  <span>Kampanya İndirimi</span>
                  <span>AKTİVASYON ÜCRETSİZ</span>
                </div>
              ` : `
                <div class="total-row">
                  <span>Aktivasyon Bedeli</span>
                  <span>${standardActivationFee.toLocaleString('tr-TR')} ₺</span>
                </div>
              `}
              ${wiredInstallationFee > 0 ? `
                <div class="total-row">
                  <span>Kablolu Montaj Farkı</span>
                  <span>${wiredInstallationFee.toLocaleString('tr-TR')} ₺</span>
                </div>
              ` : ''}
              <div class="total-row grand-total">
                <span>GENEL TOPLAM</span>
                <span>${totalPrice.toLocaleString('tr-TR')} ₺</span>
              </div>
              <div style="text-align: right; font-size: 10px; color: #999; margin-top: 5px;">+ KDV</div>
            </div>
          </div>

          <div class="footer">
            <div class="personnel-badge">
              <div class="avatar-circle">${personnel.fullName ? personnel.fullName.charAt(0) : 'S'}</div>
              <div>
                <strong style="display:block; color:${secondaryColor}; font-size:13px;">${personnel.fullName || 'Satış Temsilcisi'}</strong>
                <span>${personnel.title || 'Güvenlik Danışmanı'}</span><br>
                <span>${personnel.phone || ''}</span>
              </div>
            </div>
            <div style="text-align: right;">
              <strong>SAGA PLUS GÜVENLİK SİSTEMLERİ</strong><br>
              www.sagaguvenlik.com<br>
              Bu teklif 15 gün süreyle geçerlidir.
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const cleanName = businessName.replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ]/g, '_');
    const fileName = `${cleanName}_Teklif_${date.replace(/\./g, '-')}.pdf`;
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const newUri = FileSystem.documentDirectory + fileName;
    await FileSystem.moveAsync({ from: uri, to: newUri });
    if (shouldShare) await Sharing.shareAsync(newUri);
    return newUri;
  } catch (error) {
    console.error('PDF Hatası:', error);
    throw error;
  }
};

// =================================================================
// 2. FONKSİYON: GELİŞMİŞ GÜNLÜK RAPOR (GÜNCELLENMİŞ HALİ)
// =================================================================
export const generateDailyReportPDF = async (
  metrics: ReportMetrics,
  visits: any[],
  personnel: PersonnelInfo,
  date: Date
) => {
  // Manuel tarih formatlama (UTC sorununu çözer)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const formattedDate = `${day}.${month}.${year}`;
  const fileDate = `${year}-${month}-${day}`;

  const safeName = personnel.fullName || "Personel";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Roboto', sans-serif; background: #f4f6f8; padding: 20px; -webkit-print-color-adjust: exact; }
          
          /* HEADER ALANI */
          .header-card {
            background: linear-gradient(135deg, ${primaryColor} 0%, #c1121f 100%);
            color: white;
            border-radius: 12px;
            padding: 25px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 4px 10px rgba(230, 57, 70, 0.3);
            margin-bottom: 25px;
          }
          .header-info h1 { margin: 0; font-size: 22px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
          .header-info p { margin: 5px 0 0; opacity: 0.9; font-size: 13px; }
          .date-badge { background: rgba(255,255,255,0.2); padding: 8px 15px; border-radius: 20px; font-weight: bold; font-size: 14px; backdrop-filter: blur(5px); }

          /* PERSONEL KARTI */
          .user-card {
            background: white;
            border-left: 5px solid ${secondaryColor};
            border-radius: 8px;
            padding: 20px;
            display: flex;
            align-items: center;
            gap: 20px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            margin-bottom: 25px;
          }
          .user-avatar {
            width: 50px; height: 50px; background: #eee; border-radius: 50%; 
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; font-weight: bold; color: ${secondaryColor};
          }
          .user-details div { line-height: 1.4; }
          .u-name { font-weight: bold; font-size: 16px; color: #333; }
          .u-role { font-size: 12px; color: #666; text-transform: uppercase; }
          .u-region { font-size: 13px; color: ${primaryColor}; font-weight: bold; margin-top: 4px; display: flex; align-items: center; gap: 5px; }

          /* METRİK KARTLARI (GRID) */
          .grid { display: flex; gap: 15px; margin-bottom: 30px; }
          .card { 
            flex: 1; 
            background: white; 
            padding: 20px; 
            border-radius: 12px; 
            text-align: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
            border-top: 4px solid transparent;
          }
          
          .card-val { font-size: 24px; font-weight: 700; color: #333; margin: 5px 0; }
          .card-lbl { font-size: 11px; color: #888; text-transform: uppercase; font-weight: 600; }
          
          .br-blue { border-color: #457b9d; } .c-blue { color: #457b9d; }
          .br-green { border-color: #2a9d8f; } .c-green { color: #2a9d8f; }
          .br-orange { border-color: #e9c46a; } .c-orange { color: #e9c46a; }
          .br-red { border-color: #e76f51; } .c-red { color: #e76f51; }

          /* TABLO */
          .table-container { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
          .table-header { padding: 15px 20px; background: #f8f9fa; border-bottom: 1px solid #eee; font-weight: bold; color: #444; }
          
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: white; color: #888; text-transform: uppercase; font-size: 10px; padding: 15px; text-align: left; border-bottom: 2px solid #f0f0f0; }
          td { padding: 15px; border-bottom: 1px solid #f0f0f0; color: #444; }
          tr:last-child td { border-bottom: none; }

          /* Durum Badge'leri */
          .badge { padding: 4px 10px; border-radius: 12px; font-size: 10px; font-weight: bold; }
          .bg-completed { background: #e8f5e9; color: #2e7d32; }
          .bg-cancelled { background: #ffebee; color: #c62828; }
          .bg-planned { background: #e3f2fd; color: #1565c0; }

          .icon-check { color: #2e7d32; font-weight: bold; }
          .icon-cross { color: #ddd; }

          .footer-note { text-align: center; margin-top: 30px; font-size: 10px; color: #aaa; }
        </style>
      </head>
      <body>

        <div class="header-card">
          <div class="header-info">
            <h1>GÜNLÜK FAALİYET RAPORU</h1>
            <p>Saha Operasyon Özeti</p>
          </div>
          <div class="date-badge">${formattedDate}</div>
        </div>

        <div class="user-card">
          <div class="user-avatar">${safeName.charAt(0)}</div>
          <div class="user-details">
            <div class="u-name">${safeName}</div>
            <div class="u-role">${personnel.title || 'Saha Personeli'}</div>
            <div class="u-region">📍 Çalışılan Bölge: ${personnel.city || 'Belirtilmedi'}</div>
          </div>
        </div>

        <div class="grid">
          <div class="card br-blue">
            <div class="card-lbl">Toplam Ziyaret</div>
            <div class="card-val c-blue">${metrics.totalVisits}</div>
          </div>
          <div class="card br-green">
            <div class="card-lbl">Tamamlanan</div>
            <div class="card-val c-green">${metrics.completedVisits}</div>
          </div>
          <div class="card br-orange">
            <div class="card-lbl">Verilen Teklif</div>
            <div class="card-val c-orange">${metrics.offerCount}</div>
          </div>
          <div class="card br-red">
            <div class="card-lbl">Başarı Oranı</div>
            <div class="card-val c-red">%${metrics.conversionRate}</div>
          </div>
        </div>

        <div class="table-container">
          <div class="table-header">Ziyaret Dökümü</div>
          <table>
            <thead>
              <tr>
                <th width="30%">Müşteri / Lokasyon</th>
                <th>Zaman</th>
                <th>Yetkili</th>
                <th style="text-align:center;">Teklif</th>
                <th style="text-align:center;">Görsel</th>
                <th style="text-align:right;">Durum</th>
              </tr>
            </thead>
            <tbody>
              ${visits.map(v => {
                const start = new Date(v.started_at).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'});
                
                // --- DÜZELTME: Planlanan ziyaretler için süre kontrolü ---
                const duration = v.duration_seconds ? Math.round(v.duration_seconds / 60) + ' dk' : '-';
                
                let statusClass = 'bg-planned';
                let statusText = 'Planlandı'; // Varsayılan durum
                
                if(v.status === 'completed') { statusClass = 'bg-completed'; statusText = 'Tamamlandı'; }
                if(v.status === 'cancelled') { statusClass = 'bg-cancelled'; statusText = 'İptal'; }

                return `
                  <tr>
                    <td>
                      <div style="font-weight:bold;">${v.place_name}</div>
                      <div style="font-size:10px; color:#888; margin-top:2px;">${v.place_address || ''}</div>
                    </td>
                    <td>
                      <div style="font-weight:bold;">${start}</div>
                      <div style="font-size:10px; color:#888;">${duration}</div>
                    </td>
                    <td>${v.contact_name || '<span style="color:#ccc">-</span>'}</td>
                    <td style="text-align:center;">${v.offer_given ? '<span class="icon-check">✓</span>' : '<span class="icon-cross">·</span>'}</td>
                    <td style="text-align:center;">${v.card_image_url ? '<span class="icon-check">✓</span>' : '<span class="icon-cross">·</span>'}</td>
                    <td style="text-align:right;">
                      <span class="badge ${statusClass}">${statusText}</span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div class="footer-note">
          Rapor Oluşturulma: ${new Date().toLocaleString('tr-TR')} • Saga Plus Mobil
        </div>

      </body>
    </html>
  `;

  try {
    const cleanFileName = safeName
      .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
      .replace(/ü/g, 'u').replace(/Ü/g, 'U')
      .replace(/ş/g, 's').replace(/Ş/g, 'S')
      .replace(/ı/g, 'i').replace(/İ/g, 'I')
      .replace(/ö/g, 'o').replace(/Ö/g, 'O')
      .replace(/ç/g, 'c').replace(/Ç/g, 'C')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();
      
    const fileName = `rapor_${cleanFileName}_${fileDate}.pdf`;
    
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const newUri = FileSystem.documentDirectory + fileName;
    
    await FileSystem.moveAsync({ from: uri, to: newUri });
    await Sharing.shareAsync(newUri);
    return newUri;
  } catch (error) {
    console.error('PDF Report Error:', error);
    throw error;
  }
};