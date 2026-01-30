// Authentication middleware
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ 
            success: false, 
            error: 'Autenticação necessária' 
        });
    }
    next();
};

// Admin role check
const requireAdmin = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ 
            success: false, 
            error: 'Autenticação necessária' 
        });
    }
    
    if (req.session.userRole !== 'admin') {
        return res.status(403).json({ 
            success: false, 
            error: 'Acesso negado. Apenas administradores' 
        });
    }
    
    next();
};

module.exports = {
    requireAuth,
    requireAdmin
};
