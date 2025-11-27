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
    // Service Role Key ile Supabase istemcisi oluştur (Admin yetkisi)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // İstekten gelen verileri al
    const { email, password, full_name, phone, city_id, title_id, team_id } = await req.json()

    // 1. Auth Kullanıcısını Oluştur
    const { data: user, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // E-posta onayı beklemeden giriş yapabilsin
      user_metadata: { full_name: full_name }
    })

    if (createUserError) {
      console.error('Auth Error:', createUserError)
      return new Response(JSON.stringify({ error: createUserError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (user.user) {
      // 2. Profil Bilgilerini Güncelle
      // Not: Trigger zaten handle_new_user ile satırı oluşturdu, biz detayları güncelliyoruz.
      // Trigger'ın çalışması için kısa bir gecikme gerekebilir veya doğrudan update/upsert yapılabilir.
      
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          phone: phone,
          city_id: city_id ? parseInt(city_id) : null,
          title_id: title_id ? parseInt(title_id) : null,
          team_id: team_id ? parseInt(team_id) : null
        })
        .eq('id', user.user.id)

      if (updateError) {
        console.error('Profile Update Error:', updateError)
        return new Response(JSON.stringify({ error: updateError.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
    }

    return new Response(
      JSON.stringify({ user: user.user, message: "Personel başarıyla oluşturuldu" }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})