const mqtt  = require('mqtt');
const fetch = require('node-fetch');

// ── AYARLAR ──
const MQTT_BROKER   = 'mqtt://broker.emqx.io:1883';
const MQTT_TOPIC    = 'datvalue/#';  // tüm datvalue topic'lerini dinle

const SUPABASE_URL  = 'https://kqjpfujvccggzanibinm.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxanBmdWp2Y2NnZ3phbmliaW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTUzMzQsImV4cCI6MjA5NDA5MTMzNH0.pzTb0E81wDx_HutsOsMsfNx57JY93jcVe2P4lwsKCaE';
const USER_ID       = 'f9637548-53a5-4bfc-b63f-0d632cdd960d';

console.log('DATVALUE MQTT Bridge başlatılıyor...');

// ── MQTT BAĞLANTI ──
const client = mqtt.connect(MQTT_BROKER, {
  clientId: 'datvalue-bridge-' + Math.random().toString(16).substr(2, 8),
  clean: true,
  reconnectPeriod: 5000,
});

client.on('connect', () => {
  console.log('MQTT bağlantısı kuruldu:', MQTT_BROKER);
  client.subscribe(MQTT_TOPIC, (err) => {
    if (err) console.error('Subscribe hatası:', err);
    else console.log('Topic dinleniyor:', MQTT_TOPIC);
  });
});

client.on('error', (err) => {
  console.error('MQTT hatası:', err.message);
});

client.on('reconnect', () => {
  console.log('MQTT yeniden bağlanıyor...');
});

// ── MESAJ GEL ──
client.on('message', async (topic, message) => {
  console.log('\n--- Yeni mesaj ---');
  console.log('Topic:', topic);
  console.log('Mesaj:', message.toString());

  try {
    const payload = JSON.parse(message.toString());

    // Topic: datvalue/varsayilan/makine1
    const parts       = topic.split('/');
    const companyName = parts[1] || 'Varsayilan';
    const machineName = parts[2] || 'Makine-1';

    // Weintek JSON yapısı — "d" objesi içinde geliyor
    const data = payload.d || payload;

    // Tarih/saat — Weintek zaman damgası veya şimdiki zaman
    const now       = new Date();
    const recDate   = payload.ts
      ? new Date(payload.ts).toISOString().split('T')[0]
      : now.toISOString().split('T')[0];
    const recTime   = payload.ts
      ? new Date(payload.ts).toTimeString().substring(0, 8)
      : now.toTimeString().substring(0, 8);

    // Supabase'e gönder
    const record = {
      user_id:                      USER_ID,
      company_name:                 companyName,
      machine_name:                 machineName,
      recorded_date:                recDate,
      recorded_time:                recTime,
      lazer_sicaklik_c:             data.lazer_sicaklik_c             ?? null,
      firin_termokupul_sicaklik_c:  data.firin_termokupul_sicaklik_c  ?? null,
      rekuperator_cikis_sicaklik_c: data.rekuperator_cikis_sicaklik_c ?? null,
      firin_ic_basinc_pa:           data.firin_ic_basinc_pa           ?? null,
      hava_basinc_giris_mbar:       data.hava_basinc_giris_mbar       ?? null,
      gaz_sayac_m3:                 data.gaz_sayac_m3                 ?? null,
      gaz_giris_basinci_bar:        data.gaz_giris_basinci_bar        ?? null,
      hava_basinc_cikis_mbar:       data.hava_basinc_cikis_mbar       ?? null,
      source_file:                  'mqtt:' + topic,
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/sensor_data`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Prefer':        'resolution=ignore-duplicates',
      },
      body: JSON.stringify([record]),
    });

    if (res.status === 201 || res.status === 200) {
      console.log('✅ Supabase\'e kaydedildi:', companyName, '/', machineName, recDate, recTime);
    } else {
      const err = await res.text();
      console.error('❌ Supabase hatası:', res.status, err);
    }

  } catch (e) {
    console.error('Parse/gönderme hatası:', e.message);
  }
});

// Canlı tut
setInterval(() => {
  console.log('Heartbeat:', new Date().toLocaleTimeString('tr-TR'));
}, 60000);
