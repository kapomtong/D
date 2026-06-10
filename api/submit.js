const FIREBASE_DB_URL = "https://shop-25ffb-default-rtdb.asia-southeast1.firebasedatabase.app";

// --- ฟังก์ชันจัดการระบบคีย์บน Firebase ---
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

// --- ฟังก์ชันจัดการระบบ Blacklist บน Firebase ---
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

// --- ฟังก์ชันดึง Proxy ฟรี ---
async function fetchFreeProxies() {
    try {
        const res = await fetch('https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=5000&country=all&ssl=all&anonymity=all');
        const text = await res.json().catch(() => res.text());
        if (typeof text === 'string') {
            return text.split('\r\n').filter(p => p.trim() !== '');
        }
        return [];
    } catch (e) { return []; }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { action, username, question, deviceId, key, targetKey, targetUser } = req.body;

        // โหลดข้อมูลจาก Firebase ชนิดขนาน
        let allowedKeys = await getFirebaseKeys();
        let blacklistUsers = await getFirebaseBlacklist();

        // ==========================================
        // 🤫 [ADMIN CONTROL ZONE] (เปิดผ่านคำสั่ง mnn หน้าบ้าน)
        // ==========================================
        
        // --- การจัดการคีย์ ---
        if (action === 'admin_get_keys') {
            return res.status(200).json({ success: true, keys: allowedKeys, blacklist: blacklistUsers });
        }
        if (action === 'admin_add_key') {
            allowedKeys[targetKey] = { usedBy: "none" };
            await updateFirebaseKeys(allowedKeys);
            return res.status(200).json({ success: true, message: `➕ สร้างคีย์ [ ${targetKey} ] สำเร็จ!` });
        }
        if (action === 'admin_delete_key') {
            if (allowedKeys[targetKey]) { delete allowedKeys[targetKey]; await updateFirebaseKeys(allowedKeys); }
            return res.status(200).json({ success: true, message: `❌ ลบคีย์เรียบร้อย` });
        }
        if (action === 'admin_reset_key') {
            if (allowedKeys[targetKey]) { allowedKeys[targetKey].usedBy = "none"; await updateFirebaseKeys(allowedKeys); }
            return res.status(200).json({ success: true, message: `🔄 รีเซ็ตล็อกเครื่องสำเร็จ!` });
        }

        // --- การจัดการ Blacklist ---
        if (action === 'admin_add_blacklist') {
            if(!targetUser) return res.status(400).json({ error: 'ระบุชื่อด้วย' });
            blacklistUsers[targetUser.toLowerCase()] = true; // บันทึกเป็นตัวพิมพ์เล็กป้องกันการเลี่ยง
            await updateFirebaseBlacklist(blacklistUsers);
            return res.status(200).json({ success: true, message: `🚫 แบนเป้าหมาย [ ${targetUser} ] เรียบร้อย!` });
        }
        if (action === 'admin_remove_blacklist') {
            if (blacklistUsers[targetUser.toLowerCase()]) {
                delete blacklistUsers[targetUser.toLowerCase()];
                await updateFirebaseBlacklist(blacklistUsers);
            }
            return res.status(200).json({ success: true, message: `🔓 ปลดแบน [ ${targetUser} ] เรียบร้อย!` });
        }

        // ==========================================
        // 🔒 [SECURITY ZONE] ระบบตรวจสอบสิทธิ์และความปลอดภัย
        // ==========================================
        
        // 1. ตรวจสอบ Blacklist Username (ถ้าชื่อโดนแบน จะยิงไม่ได้เด็ดขาด)
        if (username && blacklistUsers[username.toLowerCase()]) {
            return res.status(403).json({ error: 'USERNAME_IS_BLACKLISTED (ชื่อนี้ถูกแบนโดยผู้พัฒนา)' });
        }

        // 2. ตรวจสอบ License Key
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

        // ==========================================
        // 🚀 [SPAMMER ZONE] ส่งข้อความผ่านพร็อกซี่สลับ IP
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

        const response = await fetch('https://ngl.link/api/submit', {
            method: 'POST',
            headers: {
                'accept': '*/*',
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'user-agent': randomUA,
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
