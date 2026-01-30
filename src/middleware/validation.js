const { body, param, validationResult } = require('express-validator');

// Validation rules for creating a process
const validateCreateProcesso = [
    body('numero_processo')
        .trim()
        .notEmpty().withMessage('Número do processo é obrigatório')
        .isLength({ max: 50 }).withMessage('Número do processo deve ter no máximo 50 caracteres'),
    
    body('titulo')
        .trim()
        .notEmpty().withMessage('Título é obrigatório')
        .isLength({ max: 200 }).withMessage('Título deve ter no máximo 200 caracteres'),
    
    body('autor')
        .trim()
        .notEmpty().withMessage('Nome do autor é obrigatório')
        .isLength({ max: 150 }).withMessage('Nome do autor deve ter no máximo 150 caracteres'),
    
    body('reu')
        .trim()
        .notEmpty().withMessage('Nome do réu é obrigatório')
        .isLength({ max: 150 }).withMessage('Nome do réu deve ter no máximo 150 caracteres'),
    
    body('data_distribuicao')
        .notEmpty().withMessage('Data de distribuição é obrigatória')
        .isISO8601().withMessage('Data de distribuição inválida'),
    
    body('status')
        .optional()
        .isIn(['Em Andamento', 'Suspenso', 'Arquivado', 'Finalizado'])
        .withMessage('Status inválido'),
    
    body('valor_causa')
        .optional()
        .isFloat({ min: 0 }).withMessage('Valor da causa deve ser um número positivo'),
    
    body('tipo_acao')
        .optional()
        .isLength({ max: 100 }).withMessage('Tipo de ação deve ter no máximo 100 caracteres'),
    
    body('vara')
        .optional()
        .isLength({ max: 100 }).withMessage('Vara deve ter no máximo 100 caracteres'),
    
    body('comarca')
        .optional()
        .isLength({ max: 100 }).withMessage('Comarca deve ter no máximo 100 caracteres'),
    
    body('advogado_autor')
        .optional()
        .isLength({ max: 150 }).withMessage('Nome do advogado do autor deve ter no máximo 150 caracteres'),
    
    body('advogado_reu')
        .optional()
        .isLength({ max: 150 }).withMessage('Nome do advogado do réu deve ter no máximo 150 caracteres')
];

// Validation rules for updating a process
const validateUpdateProcesso = [
    param('id').isInt({ min: 1 }).withMessage('ID inválido'),
    ...validateCreateProcesso
];

// Validation rules for adding movimentacao
const validateMovimentacao = [
    param('id').isInt({ min: 1 }).withMessage('ID do processo inválido'),
    body('tipo')
        .trim()
        .notEmpty().withMessage('Tipo de movimentação é obrigatório')
        .isLength({ max: 100 }).withMessage('Tipo deve ter no máximo 100 caracteres'),
    
    body('descricao')
        .trim()
        .notEmpty().withMessage('Descrição é obrigatória'),
    
    body('data_movimentacao')
        .notEmpty().withMessage('Data da movimentação é obrigatória')
        .isISO8601().withMessage('Data da movimentação inválida')
];

// Validation rules for ID parameter
const validateId = [
    param('id').isInt({ min: 1 }).withMessage('ID inválido')
];

// Middleware to handle validation results
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
};

module.exports = {
    validateCreateProcesso,
    validateUpdateProcesso,
    validateMovimentacao,
    validateId,
    handleValidationErrors
};
