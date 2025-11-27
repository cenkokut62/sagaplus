import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json();
    const { type, table, record, old_record } = payload;

    console.log(`➡️ [İŞLEM] Tablo: ${table} | Tip: ${type}`);

    const notifications: any[] = []

    // --- YARDIMCI FONKSİYON: Ekip Üyelerine ve Lidere Bildirim ---
    const notifyTeam = async (teamId: number, title: string, body: string, excludeUserId?: string) => {
      // Üyeleri Çek
      const { data: members } = await supabaseAdmin
        .from('profiles')
        .select('id, expo_push_token')
        .eq('team_id', teamId);
      
      // Lideri Çek
      const { data: team } = await supabaseAdmin
        .from('teams')
        .select('leader_id, name')
        .eq('id', teamId)
        .single();
        
      const recipients = new Map();

      // Üyeleri listeye ekle
      if (members) {
        members.forEach((m: any) => {
          if (m.id !== excludeUserId && m.expo_push_token) {
            recipients.set(m.id, m.expo_push_token);
          }
        });
      }

      // Lideri listeye ekle
      if (team?.leader_id && team.leader_id !== excludeUserId) {
        if (!recipients.has(team.leader_id)) {
           const { data: leader } = await supabaseAdmin.from('profiles').select('expo_push_token').eq('id', team.leader_id).single();
           if (leader?.expo_push_token) recipients.set(team.leader_id, leader.expo_push_token);
        }
      }

      recipients.forEach((token) => {
        notifications.push({ to: token, title, body, sound: 'default' });
      });
      
      return team?.name;
    }

    // =================================================================
    // 1. MODÜL: EKİP YÖNETİMİ (team_members)
    // =================================================================
    if (table === 'team_members') {
      
      if (type === 'INSERT') {
        const { user_id, team_id, role } = record;
        const { data: user } = await supabaseAdmin.from('profiles').select('full_name, expo_push_token').eq('id', user_id).single();
        
        if (user) {
          // A) Personelin Kendisine
          if (user.expo_push_token) {
             const title = role === 'leader' ? 'Tebrikler! Lider Seçildiniz 👑' : 'Ekibe Hoş Geldiniz';
             const body = role === 'leader' ? 'Bir ekibe lider olarak atandınız.' : 'Yeni bir ekibe üye olarak eklendiniz.';
             notifications.push({ to: user.expo_push_token, title, body, sound: 'default' });
          }
          // B) Ekibe (Lider Dahil)
          const msgBody = role === 'leader' ? `${user.full_name} ekibin Lideri olarak atandı.` : `${user.full_name} ekibe katıldı.`;
          await notifyTeam(team_id, 'Ekip Güncellemesi', msgBody, user_id);
        }
      } 
      
      else if (type === 'DELETE') {
        // Not: DELETE işleminde veriler 'old_record' içinde veya 'record' içinde gelebilir (konfigürasyona göre)
        const targetRecord = old_record || record;
        const { user_id, team_id } = targetRecord;
        const { data: user } = await supabaseAdmin.from('profiles').select('full_name, expo_push_token').eq('id', user_id).single();

        if (user) {
          // A) Personelin Kendisine
          if (user.expo_push_token) {
            notifications.push({ to: user.expo_push_token, title: 'Ekip Ayrılığı', body: 'Bulunduğunuz ekipten çıkarıldınız.', sound: 'default' });
          }
          // B) Ekibe
          await notifyTeam(team_id, 'Ekip Ayrılığı', `${user.full_name} ekipten ayrıldı.`, user_id);
        }
      }
    }

    // =================================================================
    // 2. MODÜL: EKİP GÜNCELLEME (teams)
    // =================================================================
    if (table === 'teams' && type === 'UPDATE') {
       const { id, name } = record;
       const oldName = old_record?.name;
       if (name !== oldName) {
         await notifyTeam(id, 'Ekip Bilgisi Güncellendi', `Ekibinizin adı "${name}" olarak değiştirildi.`);
       }
    }

    // =================================================================
    // 3. MODÜL: HEDEF YÖNETİMİ (monthly_targets)
    // =================================================================
    if (table === 'monthly_targets' && (type === 'INSERT' || type === 'UPDATE')) {
      const dateObj = new Date(record.target_month);
      const monthName = dateObj.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
      const amount = record.target_amount;

      // A) Kişisel Hedef
      if (record.target_type === 'user' && record.user_id) {
        const { data: user } = await supabaseAdmin.from('profiles').select('expo_push_token').eq('id', record.user_id).single();
        if (user?.expo_push_token) {
          notifications.push({ 
            to: user.expo_push_token, 
            title: '🎯 Yeni Satış Hedefi', 
            body: `${monthName} ayı için hedefiniz: ${amount} Adet. Başarılar!`, 
            sound: 'default' 
          });
        }
      } 
      // B) Ekip Hedefi
      else if (record.target_type === 'team' && record.team_id) {
         await notifyTeam(
           record.team_id, 
           '🎯 Yeni Satış Hedefi', 
           `Ekibinizin ${monthName} ayı satış hedefi: ${amount} Adet olarak belirlendi.`
         );
      }
    }

    // --- GÖNDERİM ---
    if (notifications.length > 0) {
      console.log(`🚀 ${notifications.length} bildirim gönderiliyor...`);
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notifications),
      });
    } else {
      console.log('⚠️ Gönderilecek bildirim yok.');
    }

    return new Response(JSON.stringify({ success: true, count: notifications.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('❌ HATA:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})