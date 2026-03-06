export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SB_URL = "https://gvxdmldpimjvicllrhll.supabase.co";
  const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2eGRtbGRwaW1qdmljbGxyaGxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MTE2OTUsImV4cCI6MjA4Nzk4NzY5NX0.6EnrECgVy79VUNsbRQGL_shmhaWnPAq0BL2uYz6ilF0";

  const { key } = req.query;
  if (!key) return res.status(400).json({ error: 'key required' });

  try {
    const response = await fetch(
      `${SB_URL}/rest/v1/app_data?key=eq.${key}&select=value`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    );
    const rows = await response.json();
    if (!rows || !rows[0]) return res.status(404).json({ error: 'not found' });
    
    // valueが文字列の場合とオブジェクトの場合の両方に対応
    const value = rows[0].value;
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
