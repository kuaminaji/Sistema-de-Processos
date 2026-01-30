// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Default error status and message
    const status = err.status || 500;
    const message = err.message || 'Erro interno do servidor';

    // Send error response
    res.status(status).json({
        success: false,
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

// 404 Not Found handler
const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Rota não encontrada'
    });
};

module.exports = {
    errorHandler,
    notFoundHandler
};
