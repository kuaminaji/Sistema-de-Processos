// Caracteres especiais permitidos para validação de senha
const SPECIAL_CHARS_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;

// Validação de CPF
function validarCPF(cpf) {
  if (!cpf) return false;
  
  // Remove caracteres não numéricos
  cpf = cpf.replace(/[^\d]/g, '');
  
  // Verifica se tem 11 dígitos
  if (cpf.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  
  // Validação do primeiro dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let resto = soma % 11;
  let digito1 = resto < 2 ? 0 : 11 - resto;
  
  if (parseInt(cpf.charAt(9)) !== digito1) return false;
  
  // Validação do segundo dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i)) * (11 - i);
  }
  resto = soma % 11;
  let digito2 = resto < 2 ? 0 : 11 - resto;
  
  if (parseInt(cpf.charAt(10)) !== digito2) return false;
  
  return true;
}

// Formatar CPF
function formatarCPF(cpf) {
  if (!cpf) return '';
  cpf = cpf.replace(/[^\d]/g, '');
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

// Validação de número de processo
function validarNumeroProcesso(numero) {
  if (!numero) return false;
  
  // Remove caracteres não numéricos
  numero = numero.replace(/[^\d]/g, '');
  
  // Formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO (20 dígitos)
  if (numero.length !== 20) return false;
  
  return true;
}

// Formatar número de processo (formato CNJ)
function formatarNumeroProcesso(numero) {
  if (!numero) return '';
  numero = numero.replace(/[^\d]/g, '');
  if (numero.length !== 20) return numero;
  
  // NNNNNNN-DD.AAAA.J.TR.OOOO
  return numero.replace(
    /(\d{7})(\d{2})(\d{4})(\d{1})(\d{2})(\d{4})/,
    '$1-$2.$3.$4.$5.$6'
  );
}

// Validação de senha forte
function validarSenhaForte(senha) {
  if (!senha || senha.length < 10) {
    return {
      valida: false,
      mensagem: 'Senha deve ter no mínimo 10 caracteres'
    };
  }
  
  if (!/[A-Z]/.test(senha)) {
    return {
      valida: false,
      mensagem: 'Senha deve conter pelo menos uma letra maiúscula'
    };
  }
  
  if (!/[a-z]/.test(senha)) {
    return {
      valida: false,
      mensagem: 'Senha deve conter pelo menos uma letra minúscula'
    };
  }
  
  if (!/[0-9]/.test(senha)) {
    return {
      valida: false,
      mensagem: 'Senha deve conter pelo menos um número'
    };
  }
  
  if (!SPECIAL_CHARS_REGEX.test(senha)) {
    return {
      valida: false,
      mensagem: 'Senha deve conter pelo menos um símbolo'
    };
  }
  
  return { valida: true };
}

// Sanitização de entrada
function sanitizarInput(texto) {
  if (!texto) return '';
  
  // Remove tags HTML de forma mais segura
  texto = String(texto).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  return texto.trim();
}

// Validação de email
function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// Validação de telefone (WhatsApp)
function validarTelefone(telefone) {
  if (!telefone) return false;
  
  // Remove caracteres não numéricos
  telefone = telefone.replace(/[^\d]/g, '');
  
  // Deve ter entre 10 e 13 dígitos (com ou sem DDI)
  return telefone.length >= 10 && telefone.length <= 13;
}

// Formatar telefone para WhatsApp (formato internacional)
function formatarTelefoneWhatsApp(telefone) {
  if (!telefone) return '';
  
  telefone = telefone.replace(/[^\d]/g, '');
  
  // Se não tiver DDI (55), adicionar
  if (!telefone.startsWith('55') && telefone.length === 11) {
    telefone = '55' + telefone;
  }
  
  return telefone;
}

module.exports = {
  validarCPF,
  formatarCPF,
  validarNumeroProcesso,
  formatarNumeroProcesso,
  validarSenhaForte,
  sanitizarInput,
  validarEmail,
  validarTelefone,
  formatarTelefoneWhatsApp
};
