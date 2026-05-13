const mqtt  = require('mqtt');
const fetch = require('node-fetch');

const MQTT_BROKER  = 'mqtt://broker.emqx.io:1883';
const MQTT_TOPIC   = 'datvalue/#';
const SUPABASE_URL = 'https://kqjpfujvccggzanibinm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxanBmdWp2Y2NnZ3phbmliaW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUxNTMzNCwiZXhwIjoyMDk0MDkxMzM0fQ.1PmkFuq7D0v4dEMHwuLArUvR9UXK8t8kh-p7WICwMs8';
const USER_ID      = 'f9637548-53a5-4bfc-b63f-0d632cdd960d';

// Weintek [ 1 ] veya "[4]" veya 5 → sayıya çevir
function parseVal(v) {
  if (v === null || v === undefined) return null;
  // String ise köşeli parantezleri temizle: "[4]" → "4"
  if (typeof v === 'string') {
    v = v.replace(/[\[\]]/g, '').trim();
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  }
  // Array ise ilk elemanı al
  if (Array.isArray(v)) {
    if (v.length === 0) return null;
    const first = v[0];
    if (typeof first === 'string') {
      const n = parseFloat(first.replace(/[\[\]]/g, '').trim());
      return isNaN(n) ? null : n;
    }
    const n = parseFloat(first);
    return isNaN(n) ? null : n;
  }
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

console.log('DATVALUE MQTT Bridge baslatiliyor...');

const client = mqtt.connect(MQTT_BROKER, {
  clientId: 'datvalue-bridge-' + Math.random().toString(16).substr(2, 8),
  clean: true,
  reconnectPeriod: 5000,
});

client.on('connect', () => {
  console.log('MQTT baglantisi kuruldu:', MQTT_BROKER);
  client.subscribe(MQTT_TOPIC, (err) => {
    if (err) console.error('Subscribe hatasi:', err);
    else console.log('Topic dinleniyor:', MQTT_TOPIC);
  });
});

client.on('error', (err) => console.error('MQTT hatasi:', err.message));
client.on('reconnect', () => console.log('MQTT yeniden baglanıyor...'));

client.on('message', async (topic, message) => {
  console.log('\n--- Yeni mesaj ---');
  console.log('Topic:', topic);

  try {
    const payload = JSON.parse(message.toString());
    const parts       = topic.split('/');
    const companyName = parts[1] || 'Varsayilan';
    const machineName = parts[2] || 'Makine-1';
    const data = payload.d || payload;

    const now     = new Date();
    const recDate = payload.ts
      ? new Date(payload.ts).toISOString().split('T')[0]
      : now.toISOString().split('T')[0];
    const recTime = payload.ts
      ? new Date(payload.ts).toTimeString().substring(0, 8)
      : now.toTimeString().substring(0, 8);

    const record = {
      user_id:                      USER_ID,
      company_name:                 companyName,
      machine_name:                 machineName,
      recorded_date:                recDate,
      recorded_time:                recTime,
      lazer_sicaklik_c:             parseVal(data.lazer_sicaklik_c),
      firin_termokupul_sicaklik_c:  parseVal(data.firin_termokupul_sicaklik_c),
      rekuperator_cikis_sicaklik_c: parseVal(data.rekuperator_cikis_sicaklik_c),
      firin_ic_basinc_pa:           parseVal(data.firin_ic_basinc_pa),
      hava_basinc_giris_mbar:       parseVal(data.hava_basinc_giris_mbar),
      gaz_sayac_m3:                 parseVal(data.gaz_sayac_m3),
      gaz_giris_basinci_bar:        parseVal(data.gaz_giris_basinci_bar),
      hava_basinc_cikis_mbar:       parseVal(data.hava_basinc_cikis_mbar),
      source_file:                  'mqtt:' + topic,
    };

    console.log('Kaydediliyor:', JSON.stringify(record));

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
      console.log('Kaydedildi:', companyName, '/', machineName, recDate, recTime);
    } else {
      const err = await res.text();
      console.error('Supabase hatasi:', res.status, err);
    }

  } catch (e) {
    console.error('Hata:', e.message);
  }
});

setInterval(() => {
  console.log('Heartbeat:', new Date().toLocaleTimeString('tr-TR'));
}, 60000);
