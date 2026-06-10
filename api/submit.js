const FIREBASE_DB_URL = "https://shop-25ffb-default-rtdb.asia-southeast1.firebasedatabase.app";

async function getFirebaseKeys() {
    try {
        const res = await fetch(`${FIREBASE_DB_URL}/ngl_spammer_keys.json`);
        const data = await res.json();
        return data || {};
    } catch (e) { return {}; }
}

async function updateFirebaseKeys(keys) {
    await fetch(`${FIREBASE_DB_URL}/ngl_spammer_keys.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keys)
    });
}

// ฟังก์ชันสำหรับดึงรายชื่อ Free Proxy มาใช้สลับ IP
async function fetchFreeProxies() {
    try {
        // ดึงข้อมูล Proxy ฟรีจาก API สาธารณะ (รองรับโปรโตคอล HTTP/HTTPS)
        const res = await fetch('https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=5000&country=all&ssl=all&anonymity=all');
        const text = await res.json().catch(() => res.text());
        if (typeof text === 'string') {
            return text.split('\r\n').filter(p => p.trim() !== '');
        }
        return [];
    } catch (e) {
        return [];
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { action, username, question, deviceId, key, targetKey } = req.body;
        let allowedKeys = await getFirebaseKeys();

        // Admin Zone
        if (action === 'admin_get_keys') return res.status(200).json({ success: true, keys: allowedKeys });
        if (action === 'admin_add_key') {
            allowedKeys[targetKey] = { usedBy: "none" };
            await updateFirebaseKeys(allowedKeys);
            return res.status(200).json({ success: true, message: `➕ สร้างคีย์ [ ${targetKey} ] สำเร็จ!` });
        }
        if (action === 'admin_delete_key') {
            if (allowedKeys[targetKey]) {
                delete allowedKeys[targetKey];
                await updateFirebaseKeys(allowedKeys);
                return res.status(200).json({ success: true, message: `❌ ลบคีย์ [ ${targetKey} ] เรียบร้อย` });
            }
            return res.status(404).json({ error: 'ไม่พบคีย์' });
        }
        if (action === 'admin_reset_key') {
            if (allowedKeys[targetKey]) {
                allowedKeys[targetKey].usedBy = "none";
                await updateFirebaseKeys(allowedKeys);
                return res.status(200).json({ success: true, message: `🔄 ปลดล็อกคีย์ [ ${targetKey} ] สำเร็จ!` });
            }
            return res.status(404).json({ error: 'ไม่พบคีย์' });
        }

        // Check License Key
        const isPermanentKey = (key === 'admin' || key === 'mhon');
        if (!isPermanentKey) {
            if (!allowedKeys[key]) return res.status(403).json({ error: 'คีย์ไม่ถูกต้องหรือหมดอายุ' });
            if (allowedKeys[key].usedBy && allowedKeys[key].usedBy !== "none" && allowedKeys[key].usedBy !== deviceId) {
                return res.status(403).json({ error: 'คีย์นี้ถูกใช้งานไปแล้วกับเครื่องอื่น' });
            }
            if (!allowedKeys[key].usedBy || allowedKeys[key].usedBy === "none") {
                allowedKeys[key].usedBy = deviceId;
                await updateFirebaseKeys(allowedKeys);
            }
        }

        // สุ่ม User-Agent เพื่อพรางลายนิ้วมือบราวเซอร์
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
            'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
        ];
        const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

        // จัดเตรียมชุด IP และจำลอง Header เพื่อส่งคำขอให้แนบเนียนที่สุด
        const proxyList = await fetchFreeProxies();
        let randomIP = `${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`;
        
        if (proxyList.length > 0) {
            const selectedProxy = proxyList[Math.floor(Math.random() * proxyList.length)];
            randomIP = selectedProxy.split(':')[0]; // ดึงเอาเฉพาะไอพีจาก Proxy มาพรางตาในคำขอ
        }

        const response = await fetch('https://ngl.link/api/submit', {
            method: 'POST',
            headers: {
                'accept': '*/*',
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'user-agent': randomUA,
                'x-requested-with': 'XMLHttpRequest',
                'referer': `https://ngl.link/${username}`,
                'X-Forwarded-For': randomIP,
                'Client-IP': randomIP
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
            return res.status(response.status).json({ error: `NGL_RESPONSE_${response.status}` });
        }

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
