// モリタ（Genifix）予約データ取得プロキシ
// dental-subchart の Mac mini 経由 API を呼び出し、
// dental-scheduler の schedule 形式 { date, chairs:[{name, appointments:[...]}] } に変換して返す。

const MORITA_PROXY = 'https://morita-proxy.kubosubcarte.com/api/genifix/appointments';

const FREE_KEYWORDS = ['誰でも', 'だれでも', 'フリー', '空き', 'どなたでも'];
const CHAIR_COLORS = ['#3b7dd8','#0b7c6e','#c45c15','#6e34a8','#b91c1c','#1e7e4e','#7c6400','#1a6e8a','#7c3a8a'];

function isFreeText(text) {
  if (!text) return false;
  return FREE_KEYWORDS.some(k => text.includes(k));
}

function stripFreeMarker(name) {
  // "DH誰でも" → ""（担当未定として扱う）
  if (!name) return '';
  if (FREE_KEYWORDS.some(k => name.includes(k))) return '';
  return name.replace(/^(DH|Dr\.?|Dr|歯科医師|衛生士)\s*/i, '').trim();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const date = (req.query?.date) || (req.body?.date);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date (YYYY-MM-DD) is required' });
  }

  try {
    const upstream = await fetch(MORITA_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, days: 1 }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      return res.status(502).json({ error: 'upstream error', status: upstream.status, body: errText.slice(0, 500) });
    }

    const data = await upstream.json();
    const appts = Array.isArray(data.appointments) ? data.appointments : [];

    // チェア別にグルーピング（元の順序を保持するため Map 使用）
    const chairMap = new Map();
    for (const a of appts) {
      const chairName = a.chairName || '不明';
      if (!chairMap.has(chairName)) chairMap.set(chairName, []);
      const isFreeStaff = isFreeText(a.staffName);
      const isFreeTreat = isFreeText(a.treatmentName);
      const existingStaff = isFreeStaff ? '' : stripFreeMarker(a.staffName || '');
      chairMap.get(chairName).push({
        time: a.startTime || '',
        patient: a.patientName || '',
        treatment: a.treatmentName || a.complaint || '',
        duration: a.durationMin || 30,
        is_free_slot: isFreeStaff || isFreeTreat,
        existing_staff: existingStaff,
        _patientNo: a.patientNo || '',
        _reserveId: a.reserveId,
      });
    }

    // 時刻順ソート
    const chairs = [];
    let idx = 0;
    for (const [name, items] of chairMap.entries()) {
      items.sort((x, y) => (x.time || '').localeCompare(y.time || ''));
      chairs.push({
        name,
        color: CHAIR_COLORS[idx % CHAIR_COLORS.length],
        appointments: items,
      });
      idx++;
    }

    return res.status(200).json({ date, chairs, total: appts.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
