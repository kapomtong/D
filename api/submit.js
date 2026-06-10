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
async function getFirebaseBlacklist() {
    try {
        const res = await fetch(`${FIREBASE_DB_URL}/ngl_blacklist_users.json`);
        const data = await res.json();
        return data || {};
    } catch (e) { return {}; }
}
async function updateFirebaseBlacklist(list) {
    await fetch(`${FIREBASE_DB_URL}/ngl_blacklist_users.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(list)
    });
}
async function fetchFreeProxies() {
    try {
        const res = await fetch('https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=5000&country=all&ssl=all&anonymity=all');
        const text = await res.json().catch(() => res.text());
        if (typeof text === 'string') return text.split('\r\n').filter(p => p.trim() !== '');
        return [];
    } catch (e) { return []; }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'ส่งข้อมูลไม่ถูกต้องตามรูปแบบ' });

    try {
        const { action, username, question, deviceId, key, targetKey, targetUser, requestedMode } = req.body;

        let allowedKeys = await getFirebaseKeys();
        let blacklistUsers = await getFirebaseBlacklist();

        // ==========================================
        // 🤫 [ADMIN CONTROL ZONE]
        // ==========================================
        if (action === 'admin_get_keys') {
            return res.status(200).json({ success: true, keys: allowedKeys, blacklist: blacklistUsers });
        }
        if (action === 'admin_add_key') {
            allowedKeys[targetKey] = { usedBy: "none", isSpeedAllowed: false };
            await updateFirebaseKeys(allowedKeys);
            return res.status(200).json({ success: true, message: `➕ สร้างคีย์ [ ${targetKey} ] เรียบร้อยแล้ว!` });
        }
        if (action === 'admin_toggle_speed') {
            if (allowedKeys[targetKey]) {
                const currentStatus = allowedKeys[targetKey].isSpeedAllowed || false;
                allowedKeys[targetKey].isSpeedAllowed = !currentStatus;
                await updateFirebaseKeys(allowedKeys);
                return res.status(200).json({ success: true, message: `⚡ คีย์ [ ${targetKey} ] -> โหมดเร็ว: ${!currentStatus ? 'เปิดใช้งานแล้ว' : 'ปิดการใช้งานแล้ว'}` });
            }
            return res.status(404).json({ error: 'ไม่พบคีย์นี้ในระบบนะบอส' });
        }
        if (action === 'admin_delete_key') {
            if (allowedKeys[targetKey]) { delete allowedKeys[targetKey]; await updateFirebaseKeys(allowedKeys); }
            return res.status(200).json({ success: true, message: `❌ ลบคีย์ออกจากระบบคลาวด์แล้ว` });
        }
        if (action === 'admin_reset_key') {
            if (allowedKeys[targetKey]) { allowedKeys[targetKey].usedBy = "none"; await updateFirebaseKeys(allowedKeys); }
            return res.status(200).json({ success: true, message: `🔄 ปลดล็อกเครื่องให้คีย์นี้สำเร็จ!` });
        }
        if (action === 'admin_add_blacklist') {
            if(!targetUser) return res.status(400).json({ error: 'ลืมใส่ชื่อที่จะแบนหรือเปล่าครับบอส' });
            blacklistUsers[targetUser.toLowerCase()] = true;
            await updateFirebaseBlacklist(blacklistUsers);
            return res.status(200).json({ success: true, message: `🚫 ขึ้นบัญชีดำห้ามยิงคนชื่อ [ ${targetUser} ] แล้ว!` });
        }
        if (action === 'admin_remove_blacklist') {
            if (blacklistUsers[targetUser.toLowerCase()]) {
                delete blacklistUsers[targetUser.toLowerCase()];
                await updateFirebaseBlacklist(blacklistUsers);
            }
            return res.status(200).json({ success: true, message: `🔓 ปลดแบนให้คนชื่อ [ ${targetUser} ] เรียบร้อย` });
        }

        // ==========================================
        // 🔒 [SECURITY ZONE] ระบบตรวจสอบสิทธิ์
        // ==========================================
        if (username && blacklistUsers[username.toLowerCase()]) {
            return res.status(403).json({ error: 'ชื่อนี้ถูกระบบแบน ห้ามยิงเด็ดขาด!' });
        }

        const isPermanentKey = (key === 'admin' || key === 'mhon');
        let keyData = allowedKeys[key];

        if (!isPermanentKey) {
            if (!keyData) return res.status(403).json({ error: 'คีย์มั่วหรือหมดอายุแล้วจ้า' });
            
            if (requestedMode === 'cyber' && !keyData.isSpeedAllowed) {
                return res.status(403).json({ error: 'สิทธิ์คีย์นี้ยิงโหมดโหดไม่ได้จ้า (ยิงได้เฉพาะโหมดชิล ๆ)' });
            }

            if (keyData.usedBy && keyData.usedBy !== "none" && keyData.usedBy !== deviceId) {
                return res.status(403).json({ error: 'คีย์นี้โดนล็อกไว้กับเครื่องอื่นแล้ว เอามาซ้ำไม่ได้!' });
            }
            if (!keyData.usedBy || keyData.usedBy === "none") {
                allowedKeys[key].usedBy = deviceId;
                await updateFirebaseKeys(allowedKeys);
            }
        }

        // ==========================================
        // 🚀 [SPAMMER ZONE] พร้อมรองรับภาษาไทย 100%
        // ==========================================
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
        ];
        const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

        const proxyList = await fetchFreeProxies();
        let randomIP = `${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`;
        if (proxyList.length > 0) {
            randomIP = proxyList[Math.floor(Math.random() * proxyList.length)].split(':')[0];
        }

        // เข้ารหัสแบบปลอดภัยแมนนวลเพื่อรองรับอักษรไทย/Unicode ป้องกัน ByteString Error
        const rawBody = `username=${encodeURIComponent(username || '')}&question=${encodeURIComponent(question || '')}&deviceId=${encodeURIComponent(deviceId || '')}&gameSlug=&referrer=`;

        const response = await fetch('https://ngl.link/api/submit', {
            method: 'POST',
            headers: {
                'accept': '*/*',
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'user-agent': randomUA,
                'referer': `https://ngl.link/${encodeURIComponent(username || '')}`,
                'X-Forwarded-For': randomIP,
                'Client-IP': randomIP
            },
            body: rawBody
        });

        if (response.ok) {
            return res.status(200).json({ success: true });
        } else {
            return res.status(response.status).json({ error: `ทาง NGL ปฏิเสธคำขอรหัส [${response.status}]` });
        }

    } catch (error) {
        return res.status(500).json({ error: 'ระบบเซิร์ฟเวอร์หลังบ้านขัดข้องชั่วคราว' });
    }
                                     }

