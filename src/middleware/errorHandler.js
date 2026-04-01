// Error handler centralizado
function errorHandler(err, req, res, next) {
  console.error('Erro:', err);
  
  // Erro de validação do express-validator
  if (err.array) {
    return res.status(422).json({
      success: false,
      message: 'Erro de validação',
      errors: err.array()
    });
  }
  
  // Erro CSRF
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      success: false,
      message: 'Token CSRF inválido. Por favor, recarregue a página.'
    });
  }
  
  // Erro de banco de dados
  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(409).json({
      success: false,
      message: 'Violação de restrição: dados duplicados ou inválidos'
    });
  }
  
  // Erro genérico
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Erro interno do servidor';
  
  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ?'Erro interno do servidor' 
      : message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}

// Handler para rotas não encontradas
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada'
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
