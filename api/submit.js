// ฟังก์ชันสำหรับเชื่อมต่อและส่งข้อมูลเข้า Firebase Realtime Database ผ่าน REST API (เนื่องจากรันบน Serverless เบาและเสถียรที่สุด)
const FIREBASE_DB_URL = "https://shop-25ffb-default-rtdb.asia-southeast1.firebasedatabase.app";

// ดึงคีย์ทั้งหมดจาก Firebase
async function getFirebaseKeys() {
    try {
        const res = await fetch(`${FIREBASE_DB_URL}/ngl_spammer_keys.json`);
        const data = await res.json();
        return data || {};
    } catch (e) {
        return {};
    }
}

// อัปเดตคีย์เข้า Firebase
async function updateFirebaseKeys(keys) {
    await fetch(`${FIREBASE_DB_URL}/ngl_spammer_keys.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keys)
    });
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { action, username, question, deviceId, key, targetKey } = req.body;

        // ดึงข้อมูลคีย์ปัจจุบันจาก Firebase มาเตรียมพร้อมใช้งาน
        let allowedKeys = await getFirebaseKeys();

        // ==========================================
        // [ZONE ลับ] สำหรับแอดมิน (เมื่อใช้ username เป็น mnn)
        // ==========================================
        if (action === 'admin_get_keys') {
            return res.status(200).json({ success: true, keys: allowedKeys });
        }

        if (action === 'admin_add_key') {
            allowedKeys[targetKey] = { usedBy: "none" }; // กำหนดค่าเริ่มต้นเป็นข้อความ เพื่อไม่ให้ Firebase บันทึกเป็นค่าว่าง
            await updateFirebaseKeys(allowedKeys);
            return res.status(200).json({ success: true, message: `➕ สร้างคีย์ [ ${targetKey} ] ลง Firebase สำเร็จ!` });
        }

        if (action === 'admin_delete_key') {
            if (allowedKeys[targetKey]) {
                delete allowedKeys[targetKey];
                await updateFirebaseKeys(allowedKeys);
                return res.status(200).json({ success: true, message: `❌ ลบคีย์ [ ${targetKey} ] ออกจากคลาวด์แล้ว` });
            }
            return res.status(404).json({ error: 'ไม่พบคีย์นี้' });
        }

        if (action === 'admin_reset_key') {
            if (allowedKeys[targetKey]) {
                allowedKeys[targetKey].usedBy = "none"; // ล้างการล็อกเครื่อง
                await updateFirebaseKeys(allowedKeys);
                return res.status(200).json({ success: true, message: `🔄 ปลดล็อกเครื่องสำหรับคีย์ [ ${targetKey} ] เรียบร้อย!` });
            }
            return res.status(404).json({ error: 'ไม่พบคีย์นี้ในฐานข้อมูล' });
        }

        // ==========================================
        // [ZONE ใช้งานปกติ] ระบบตรวจสอบคีย์และการส่งข้อความ
        // ==========================================
        
        const isPermanentKey = (key === 'admin' || key === 'mhon');

        if (!isPermanentKey) {
            // ตรวจสอบว่ามีคีย์นี้ใน Firebase ไหม
            if (!allowedKeys[key]) {
                return res.status(403).json({ error: 'คีย์ไม่ถูกต้องหรือหมดอายุ' });
            }

            // ถ้ามีคนเปิดซิงล็อกเครื่องอื่นไปแล้ว
            if (allowedKeys[key].usedBy && allowedKeys[key].usedBy !== "none" && allowedKeys[key].usedBy !== deviceId) {
                return res.status(403).json({ error: 'คีย์นี้ถูกใช้งานไปแล้วกับเครื่องอื่น' });
            }

            // ถ้าเป็นเครื่องแรกที่กดรัน ให้ทำการบันทึกไอดีเครื่องลง Firebase ทันที
            if (!allowedKeys[key].usedBy || allowedKeys[key].usedBy === "none") {
                allowedKeys[key].usedBy = deviceId;
                await updateFirebaseKeys(allowedKeys);
            }
        }

        // ตัวแปรส่งข้อความจำลองเข้า NGL
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
