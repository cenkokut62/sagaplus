import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy'; // HATA DÜZELTMESİ: Legacy import kullanıldı.

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
  personnel: PersonnelData; // Yeni eklenen personel bilgisi
}

// --- MEVCUT TEKLİF PDF FONKSİYONU ---
export const generateAndSharePDF = async (data: OfferData) => {
  const { businessName, date, products, totalPrice, isCampaignApplied, wiredInstallationFee, personnel } = data;
  
  const standardActivationFee = 4560 * 1.20; 

  // Logo ve Kapak Görseli (Base64 veya URL)
  // Not: Gerçek uygulamada bunları projenin assets klasöründen base64'e çevirip gömmek en garantisidir.
  // Şimdilik örnek olması için Kale Alarm renklerine uygun online placeholder kullanıyorum.
  const logoUrl = "https://i.hizliresim.com/fggvd7x.png"; 
  const coverImageUrl = "https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=1000&auto=format&fit=crop"; // Güvenlik/Teknoloji temalı görsel

  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Roboto', sans-serif; color: #333; margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
          
          /* KAPAK VE BAŞLIK ALANI */
          .header-hero {
            background-color: #E63946; /* Kale Kırmızısı */
            color: white;
            padding: 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .header-left h1 { margin: 0; font-size: 24px; font-weight: bold; text-transform: uppercase; }
          .header-left p { margin: 5px 0 0; font-size: 12px; opacity: 0.9; }
          .logo-img { height: 60px; background: white; padding: 5px; border-radius: 4px; }

          .slogan-bar {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            border-bottom: 2px solid #E63946;
          }
          .slogan-text { color: #E63946; font-size: 22px; font-weight: bold; letter-spacing: 1px; }

          /* İÇERİK ALANI */
          .container { padding: 30px; }
          
          .intro-text { font-size: 12px; margin-bottom: 20px; line-height: 1.5; color: #555; }

          /* TABLO TASARIMI (DOCX Tarzı) */
          .table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
          .table th { background-color: #E63946; color: white; text-align: left; padding: 8px; border: 1px solid #b71c1c; }
          .table td { padding: 8px; border: 1px solid #dee2e6; }
          .table tr:nth-child(even) { background-color: #f2f2f2; }
          
          .price-cell { text-align: right; font-family: monospace; font-size: 13px; }

          /* TOPLAM KUTUSU */
          .summary-box { 
            float: right; width: 40%; 
            border: 2px solid #E63946; border-radius: 8px; 
            padding: 15px; margin-bottom: 30px; 
            background: #fff5f5;
          }
          .summary-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
          .final-total { font-size: 16px; font-weight: bold; color: #E63946; border-top: 1px solid #ccc; padding-top: 8px; margin-top: 8px; }

          /* HÜKÜMLER (Maddeler) */
          .terms-section { clear: both; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; }
          .terms-title { font-size: 14px; font-weight: bold; color: #E63946; margin-bottom: 10px; }
          .terms-list { font-size: 8px; color: #666; column-count: 2; column-gap: 20px; }
          .terms-list li { margin-bottom: 4px; }

          /* ALTBİLGİ VE PERSONEL KARTI */
          .footer-wrap { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 2px solid #E63946; padding-top: 15px; }
          
          .personnel-card { display: flex; gap: 10px; align-items: center; }
          .personnel-info div { font-size: 11px; line-height: 1.4; }
          .p-name { font-weight: bold; font-size: 13px; color: #333; }
          .p-title { color: #E63946; font-weight: 500; }
          
          .company-info { text-align: right; font-size: 10px; color: #888; }
        </style>
      </head>
      <body>
        
        <div class="header-hero">
          <div class="header-left">
            <h1>ABONELİK HİZMETİ TEKLİFİ</h1>
            <p>Sayın Yetkili, işletmeniz için hazırladığımız özel teklifimizdir.</p>
          </div>
          <img src="${logoUrl}" class="logo-img" />
        </div>

        <div class="slogan-bar">
          <div class="slogan-text">"SİZ YOKSANIZ BİZ VARIZ!"</div>
        </div>

        <div class="container">
          
          <div class="intro-text">
            <strong>Müşteri:</strong> ${businessName}<br/>
            <strong>Tarih:</strong> ${date}<br/><br/>
            Sizinle yapmış olduğumuz görüşmeye istinaden tarafımızdan talep etmiş olduğunuz KALE GÜVENLİK SİSTEMLERİ ile ilgili fiyat teklifimizi bilgilerinize sunarız.
          </div>

          <table class="table">
            <thead>
              <tr>
                <th>Ürün / Hizmet Adı</th>
                <th style="width: 50px; text-align: center;">Adet</th>
                <th style="text-align: right;">Birim Fiyat</th>
                <th style="text-align: right;">Toplam</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>STANDART GÜVENLİK PAKETİ</strong><br/><small style="color:#666;">Panel, Keypad, Pır Dedektör, Siren, Akü, Trafo dahildir.</small></td>
                <td style="text-align: center;">1</td>
                <td class="price-cell">-</td>
                <td class="price-cell">-</td>
              </tr>
              ${products.map(p => `
                <tr>
                  <td>${p.name}</td>
                  <td style="text-align: center;">${p.quantity}</td>
                  <td class="price-cell">${p.price.toLocaleString('tr-TR')} ₺</td>
                  <td class="price-cell">${(p.price * p.quantity).toLocaleString('tr-TR')} ₺</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="summary-box">
             <div class="summary-row">
               <span>Ara Toplam:</span>
               <span>${totalPrice.toLocaleString('tr-TR')} ₺</span>
             </div>
             ${isCampaignApplied ? `
              <div class="summary-row" style="color: green;">
                 <span>Kampanya İndirimi:</span>
                 <span>Aktivasyon Ücretsiz</span>
              </div>
             ` : `
              <div class="summary-row">
                 <span>Aktivasyon Bedeli:</span>
                 <span>${standardActivationFee.toLocaleString('tr-TR')} ₺</span>
              </div>
             `}
             ${wiredInstallationFee > 0 ? `
              <div class="summary-row">
                 <span>Kablolu Montaj Farkı:</span>
                 <span>${wiredInstallationFee.toLocaleString('tr-TR')} ₺</span>
              </div>
             ` : ''}
             <div class="summary-row final-total">
               <span>GENEL TOPLAM:</span>
               <span>${totalPrice.toLocaleString('tr-TR')} ₺ + KDV</span>
             </div>
          </div>

          <div class="terms-section">
            <div class="terms-title">GENEL HÜKÜMLER</div>
            <ul class="terms-list">
               <li>Teklif edilen fiyatlar standart ürünlere ait sabit fiyatlardır.</li>
               <li>Fiyatlara KDV dâhil değildir.</li>
               <li>Ürünler 24 ay taahhütlü olarak kiralanmaktadır ve mülkiyeti Kale Alarm’a aittir.</li>
               <li>Montaj ve aktivasyon öncesinde ilk ay abonelik bedeli tahsil edilir.</li>
               <li>Abonelik süresince sınırsız servis garantimiz vardır. (Kullanıcı hatası hariç).</li>
               <li>Bu teklif 15 gün süreyle geçerlidir.</li>
            </ul>
          </div>

          <div class="footer-wrap">
            <div class="personnel-card">
              <div class="personnel-info">
                <div class="p-name">${personnel.fullName}</div>
                <div class="p-title">${personnel.title || 'Güvenlik Danışmanı'}</div>
                <div>${personnel.phone || ''}</div>
                <div>${personnel.email}</div>
              </div>
            </div>
            <div class="company-info">
              <strong>SAGA PLUS GÜVENLİK SİSTEMLERİ</strong><br/>
              Yetkili Çözüm Ortağı<br/>
              www.sagaguvenlik.com
            </div>
          </div>

        </div>
      </body>
    </html>
  `;

  try {
    const cleanName = businessName.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${cleanName}_Teklif_${date.replace(/\./g, '-')}.pdf`;
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const newUri = FileSystem.documentDirectory + fileName;
    await FileSystem.moveAsync({ from: uri, to: newUri });
    await Sharing.shareAsync(newUri);
    return newUri;
  } catch (error) {
    console.error('PDF Hatası:', error);
    throw error;
  }
};

// --- YENİ RAPOR MODÜLÜ INTERFACE VE FONKSİYONU ---

interface PersonnelInfo {
  fullName: string;
  title: string;
  city: string;
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

export const generateDailyReportPDF = async (
  metrics: ReportMetrics,
  visits: any[],
  personnel: PersonnelInfo,
  date: Date
) => {
  const formattedDate = date.toLocaleDateString('tr-TR');
  const fileDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Logo placeholder
  const logoUrl = "https://i.hizliresim.com/fggvd7x.png"; 

  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Roboto', sans-serif; color: #333; padding: 20px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #E63946; padding-bottom: 20px; margin-bottom: 20px; }
          .logo { height: 50px; }
          .title { font-size: 24px; font-weight: bold; color: #E63946; }
          .subtitle { font-size: 14px; color: #666; margin-top: 5px; }
          
          .personnel-box { background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #ddd; margin-bottom: 20px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 5px; }
          .label { font-weight: bold; color: #555; }
          
          .metrics-grid { 
            display: flex; 
            justify-content: space-between; 
            flex-wrap: wrap; 
            margin-bottom: 30px; 
            gap: 10px;
          }
          .metric-card { 
            width: calc(33.33% - 7px); 
            background: #E63946; color: white; padding: 15px; border-radius: 8px; text-align: center; 
          }
          .metric-val { font-size: 20px; font-weight: bold; }
          .metric-lbl { font-size: 10px; opacity: 0.9; text-transform: uppercase; }

          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 15px; }
          th { background: #333; color: white; padding: 8px; text-align: left; }
          td { border-bottom: 1px solid #ddd; padding: 8px; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          
          .status-completed { color: green; font-weight: bold; }
          .status-cancelled { color: red; }
          .status-planned { color: blue; }
          
          .footer { margin-top: 30px; font-size: 10px; text-align: center; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
        </style>
      </head>
      <body>
        
        <div class="header">
          <div>
            <div class="title">GÜNLÜK FAALİYET RAPORU</div>
            <div class="subtitle">Tarih: ${formattedDate}</div>
          </div>
          <img src="${logoUrl}" class="logo" />
        </div>

        <div class="personnel-box">
          <div class="row">
            <span><span class="label">Personel:</span> ${personnel.fullName}</span>
            <span><span class="label">Unvan:</span> ${personnel.title}</span>
          </div>
          <div class="row">
            <span><span class="label">Ekip:</span> ${personnel.team}</span>
            <span><span class="label">Bölge:</span> ${personnel.city}</span>
          </div>
        </div>

        <div class="metrics-grid">
          <div class="metric-card" style="background:#E63946;">
            <div class="metric-val">${metrics.totalVisits}</div>
            <div class="metric-lbl">Toplam Ziyaret</div>
          </div>
          <div class="metric-card" style="background:#4CAF50;">
            <div class="metric-val">${metrics.completedVisits}</div>
            <div class="metric-lbl">Tamamlanan</div>
          </div>
          <div class="metric-card" style="background:#FF9800;">
            <div class="metric-val">${metrics.offerCount}</div>
            <div class="metric-lbl">Teklif Sayısı</div>
          </div>
          <div class="metric-card" style="background:#9C27B0; width: calc(50% - 5px);">
            <div class="metric-val">%${metrics.conversionRate}</div>
            <div class="metric-lbl">Dönüşüm Oranı (Tamamlanan Ziyaret Üzerinden)</div>
          </div>
          <div class="metric-card" style="background:#2196F3; width: calc(50% - 5px);">
            <div class="metric-val">${metrics.totalDurationMinutes} dk</div>
            <div class="metric-lbl">Toplam Ziyaret Süresi</div>
          </div>
        </div>

        <h3>Ziyaret Detayları</h3>
        <table>
          <thead>
            <tr>
              <th>İşletme / Lokasyon</th>
              <th>Saat</th>
              <th>Süre</th>
              <th>Yetkili</th>
              <th>Teklif?</th>
              <th>Kartvizit?</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            ${visits.map(v => {
              const start = new Date(v.started_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
              const duration = v.duration_seconds ? Math.round(v.duration_seconds / 60) + ' dk' : '-';
              const contact = (v.contact_name || v.contact_phone) 
                ? `${v.contact_name || ''} ${v.contact_phone ? '(' + v.contact_phone + ')' : ''}` 
                : '<span style="color:red; font-style:italic;">Eklenmemiş</span>';
              
              const offerStatus = v.offer_given ? 'Evet' : 'Hayır';
              const cardStatus = v.card_image_url ? 'Evet' : 'Hayır';

              return `
                <tr>
                  <td><strong>${v.place_name}</strong><br/><small>${v.place_address || ''}</small></td>
                  <td>${start}</td>
                  <td>${duration}</td>
                  <td>${contact}</td>
                  <td style="color: ${v.offer_given ? 'green' : 'red'};">${offerStatus}</td>
                  <td style="color: ${v.card_image_url ? 'green' : 'red'};">${cardStatus}</td>
                  <td class="status-${v.status}">${v.status === 'completed' ? 'Tamamlandı' : v.status === 'cancelled' ? 'İptal' : 'Planlandı'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer">
          Bu rapor Saga Plus Mobil Uygulaması üzerinden ${new Date().toLocaleString('tr-TR')} tarihinde oluşturulmuştur.
        </div>

      </body>
    </html>
  `;

  try {
    const cleanName = personnel.fullName.replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ]/g, '_').toLowerCase();
    const fileName = `${cleanName}_${fileDate}.pdf`;
    
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