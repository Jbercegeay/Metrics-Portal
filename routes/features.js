const express = require('express');

function createFeatureRouter(features) {
    const router = express.Router();

    router.get('/features', (req, res) => {
        res.json({
            success: true,
            features: {
                durableSubmissions: features.durableSubmissions,
                serverSessions: features.serverSessions,
                serverWorkspaces: features.serverWorkspaces,
                plDatabaseSubmissions: features.plDatabaseSubmissions,
                sessionDepartments: features.sessionDepartments
            }
        });
    });

    return router;
}

module.exports = { createFeatureRouter };
