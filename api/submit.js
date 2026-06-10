export default async function handler(req, res) {
    // รองรับคำขอจากหน้าเว็บหลัก
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // รับค่ามาจากตัวแปรในหน้าเว็บ
        const { username, question, deviceId } = req.body;

        // รายการ User-Agent จำลองเพื่อไม่ให้ซ้ำกัน
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36'
        ];
        const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

        // ประกอบร่าง Headers ให้เหมือนใน Python สคริปต์แรกของคุณ
        const headers = {
            'accept': '*/*',
            'accept-language': 'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'sec-ch-ua-mobile': randomUA.includes('Mobile') ? '?1' : '?0',
            'user-agent': randomUA,
            'origin': 'https://ngl.link',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-mode': 'cors',
            'sec-fetch-dest': 'empty',
            'referer': `https://ngl.link/${username}`,
            'x-requested-with': 'XMLHttpRequest'
        };

        const data = new URLSearchParams({
            'username': username,
            'question': question,
            'deviceId': deviceId,
            'gameSlug': '',
            'referrer': ''
        });

        // ส่งคำขอออกไปจากเซิร์ฟเวอร์
        const response = await fetch('https://ngl.link/api/submit', {
            method: 'POST',
            headers: headers,
            body: data
        });

        if (response.ok) {
            return res.status(200).json({ success: true });
        } else {
            return res.status(response.status).json({ error: `NGL_RETURNED_${response.status}` });
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

