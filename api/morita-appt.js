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

// Genifix の staffName を役職別フィールドに振り分ける
// 返り値: { existing_staff, existing_dr, treat_type, is_free_slot }
//   existing_staff: DH/TC/その他スタッフ名（プレフィックス除去済）
//   existing_dr: 院長 or Dr名（Drチェア用）
//   treat_type: 'DH' | 'Dr' | '' （dental-scheduler の chair-role 推定ヒント）
function parseStaff(raw) {
  const name = (raw || '').trim();
  if (!name) return { existing_staff: '', existing_dr: '', treat_type: '' };
  if (FREE_KEYWORDS.some(k => name.includes(k))) {
    return { existing_staff: '', existing_dr: '', treat_type: '', is_free_slot: true };
  }
  // Dr系: "院長", "Dr岡崎", "岡崎Dr" 等
  if (name === '院長') return { existing_staff: '', existing_dr: '院長', treat_type: 'Dr' };
  const mDrPrefix = name.match(/^(?:Dr\.?|[DＤ][rｒ])\s*(.+)$/i);
  if (mDrPrefix) return { existing_staff: '', existing_dr: mDrPrefix[1].trim(), treat_type: 'Dr' };
  const mDrSuffix = name.match(/^(.+?)\s*(?:Dr\.?|[DＤ][rｒ])$/i);
  if (mDrSuffix) return { existing_staff: '', existing_dr: mDrSuffix[1].trim(), treat_type: 'Dr' };
  // DH系
  const mDh = name.match(/^(?:DH|[DＤ][HＨ]|歯科衛生士|衛生士)\s*(.+)$/i);
  if (mDh) return { existing_staff: mDh[1].trim(), existing_dr: '', treat_type: 'DH' };
  // TC系
  const mTc = name.match(/^(?:TC|Ｔ[CＣ])\s*(.+)$/i);
  if (mTc) return { existing_staff: mTc[1].trim(), existing_dr: '', treat_type: '' };
  // プレフィックス無し → そのままスタッフ名として扱う
  return { existing_staff: name, existing_dr: '', treat_type: '' };
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
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.MORITA_PROXY_SECRET) {
      headers['X-Morita-Secret'] = process.env.MORITA_PROXY_SECRET;
    }
    const upstream = await fetch(MORITA_PROXY, {
      method: 'POST',
      headers,
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
      const parsed = parseStaff(a.staffName);
      const isFreeTreat = isFreeText(a.treatmentName);
      chairMap.get(chairName).push({
        time: a.startTime || '',
        patient: a.patientName || '',
        treatment: a.treatmentName || a.complaint || '',
        duration: a.durationMin || 30,
        is_free_slot: parsed.is_free_slot || isFreeTreat,
        existing_staff: parsed.existing_staff,
        existing_dr: parsed.existing_dr,
        treat_type: parsed.treat_type,
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
