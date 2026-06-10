import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { action, username, question, deviceId, key, targetKey } = req.body;

        // ==========================================
        // [ZONE ลับ] สำหรับแอดมิน (เมื่อใช้ username เป็น mnn)
        // ==========================================
        if (action === 'admin_get_keys') {
            const keys = await kv.get('ngl_spammer_keys') || {};
            return res.status(200).json({ success: true, keys });
        }

        if (action === 'admin_add_key') {
            const keys = await kv.get('ngl_spammer_keys') || {};
            keys[targetKey] = { usedBy: null }; // คีย์ว่าง รอการผูกเครื่อง
            await kv.set('ngl_spammer_keys', keys);
            return res.status(200).json({ success: true, message: 'สร้างคีย์สำเร็จ' });
        }

        if (action === 'admin_delete_key') {
            const keys = await kv.get('ngl_spammer_keys') || {};
            delete keys[targetKey];
            await kv.set('ngl_spammer_keys', keys);
            return res.status(200).json({ success: true, message: 'ลบคีย์สำเร็จ' });
        }

        if (action === 'admin_reset_key') {
            const keys = await kv.get('ngl_spammer_keys') || {};
            if (keys[targetKey]) {
                keys[targetKey].usedBy = null; // ปลดล็อกเครื่องเพื่อให้เครื่องอื่นผูกได้
                await kv.set('ngl_spammer_keys', keys);
                return res.status(200).json({ success: true, message: 'รีเซ็ตเครื่องสำเร็จ' });
            }
            return res.status(404).json({ error: 'ไม่พบคีย์นี้' });
        }

        // ==========================================
        // [ZONE ใช้งานปกติ] ระบบตรวจสอบคีย์และการส่งข้อความ
        // ==========================================
        
        // 1. ตรวจสอบเงื่อนไขคีย์ถาวรพิเศษ
        const isPermanentKey = (key === 'admin' || key === 'mhon');

        if (!isPermanentKey) {
            // ตรวจสอบคีย์ปกติในฐานข้อมูล
            const keys = await kv.get('ngl_spammer_keys') || {};
            
            if (!keys[key]) {
                return res.status(403).json({ error: 'คีย์ไม่ถูกต้องหรือหมดอายุ' });
            }

            // ถ้างดการใช้งานคีย์นี้กับเครื่องอื่น (Lock เครื่อง)
            if (keys[key].usedBy && keys[key].usedBy !== deviceId) {
                return res.status(403).json({ error: 'คีย์นี้ถูกใช้งานไปแล้วกับเครื่องอื่น' });
            }

            // ถ้าเป็นคีย์ใหม่ที่ยังไม่มีใครใช้ ให้บันทึกเครื่องปัจจุบันลงไปทันที (เซฟล็อกเครื่อง)
            if (!keys[key].usedBy) {
                keys[key].usedBy = deviceId;
                await kv.set('ngl_spammer_keys', keys);
            }
        }

        // ถ้าผ่านการตรวจคีย์ หรือเป็นคีย์ถาวร ให้ดำเนินกระบวนการส่งข้อความไป NGL
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36'
        ];
        const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

        const response = await fetch('https://ngl.link/api/submit', {
            method: 'POST',
            headers: {
                'accept': '*/*',
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'user-agent': randomUA,
                'x-requested-with': 'XMLHttpRequest',
                'referer': `https://ngl.link/${username}`
            },
            body: new URLSearchParams({
                'username': username,
                'question': question,
                'deviceId': deviceId,
                'gameSlug': '',
                'referrer': ''
            })
        });

        if (response.ok) {
            return res.status(200).json({ success: true });
        } else {
            return res.status(response.status).json({ error: `NGL_ERROR_${response.status}` });
        }

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
