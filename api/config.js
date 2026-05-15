const { fetchConfigData, normalizeDept } = require('../lib/config');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const dept = normalizeDept(req.query?.dept || 'PL');
        const data = await fetchConfigData(null, dept, {
            includeSupplemental: req.query?.scope !== 'login'
        });
        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Error fetching master config:', error.response?.data || error.message);
        return res.status(500).json({ success: false, error: 'Failed to fetch config' });
    }
};
