const SPECIAL_CHARS_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;

function normalizarDocumento(documento) {
  return String(documento || '').replace(/[^\d]/g, '');
}

function validarCPF(cpf) {
  cpf = normalizarDocumento(cpf);

  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i += 1) {
    soma += parseInt(cpf.charAt(i), 10) * (10 - i);
  }

  let resto = soma % 11;
  const digito1 = resto < 2 ?0 : 11 - resto;
  if (parseInt(cpf.charAt(9), 10) !== digito1) return false;

  soma = 0;
  for (let i = 0; i < 10; i += 1) {
    soma += parseInt(cpf.charAt(i), 10) * (11 - i);
  }

  resto = soma % 11;
  const digito2 = resto < 2 ?0 : 11 - resto;
  return parseInt(cpf.charAt(10), 10) === digito2;
}

function validarCNPJ(cnpj) {
  cnpj = normalizarDocumento(cnpj);

  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  let tamanho = cnpj.length - 2;
  let numeros = cnpj.substring(0, tamanho);
  const digitos = cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i -= 1) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos;
    pos -= 1;
    if (pos < 2) pos = 9;
  }

  let resultado = soma % 11 < 2 ?0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0), 10)) return false;

  tamanho += 1;
  numeros = cnpj.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i -= 1) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos;
    pos -= 1;
    if (pos < 2) pos = 9;
  }

  resultado = soma % 11 < 2 ?0 : 11 - (soma % 11);
  return resultado === parseInt(digitos.charAt(1), 10);
}

function formatarCPF(cpf) {
  cpf = normalizarDocumento(cpf);
  if (cpf.length !== 11) return cpf;
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatarCNPJ(cnpj) {
  cnpj = normalizarDocumento(cnpj);
  if (cnpj.length !== 14) return cnpj;
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

function inferirTipoDocumento(documento, tipoDocumento) {
  const documentoLimpo = normalizarDocumento(documento);
  const tipo = String(tipoDocumento || '').trim().toUpperCase();

  if (tipo === 'CPF' || tipo === 'CNPJ') return tipo;
  if (documentoLimpo.length === 11) return 'CPF';
  if (documentoLimpo.length === 14) return 'CNPJ';
  return null;
}

function validarDocumento(documento, tipoDocumento) {
  const documentoLimpo = normalizarDocumento(documento);
  const tipo = inferirTipoDocumento(documentoLimpo, tipoDocumento);

  if (!tipo) {
    return {
      valido: false,
      tipo: null,
      documento: documentoLimpo,
      mensagem: 'Documento deve ser um CPF ou CNPJ válido'
    };
  }

  const valido = tipo === 'CPF' ?validarCPF(documentoLimpo) : validarCNPJ(documentoLimpo);

  return {
    valido,
    tipo,
    documento: documentoLimpo,
    mensagem: valido ?null : `${tipo} inválido`
  };
}

function formatarDocumento(documento, tipoDocumento) {
  const documentoLimpo = normalizarDocumento(documento);
  const tipo = inferirTipoDocumento(documentoLimpo, tipoDocumento);

  if (tipo === 'CPF') return formatarCPF(documentoLimpo);
  if (tipo === 'CNPJ') return formatarCNPJ(documentoLimpo);
  return documentoLimpo;
}

function validarNumeroProcesso(numero) {
  numero = normalizarDocumento(numero);
  return numero.length === 20;
}

function formatarNumeroProcesso(numero) {
  numero = normalizarDocumento(numero);
  if (numero.length !== 20) return numero;

  return numero.replace(
    /(\d{7})(\d{2})(\d{4})(\d{1})(\d{2})(\d{4})/,
    '$1-$2.$3.$4.$5.$6'
  );
}

function validarSenhaForte(senha) {
  if (!senha || String(senha).length < 6) {
    return { valida: false, mensagem: 'Senha deve ter no minimo 6 caracteres' };
  }

  return { valida: true };
}

function sanitizarInput(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto).replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

function validarIdentificadorAcesso(emailOuUsuario) {
  const valor = String(emailOuUsuario || '').trim();
  if (!valor) return false;

  if (validarEmail(valor)) {
    return true;
  }

  if (/^[^\s@]+@[A-Za-z0-9_-]+$/.test(valor)) {
    return true;
  }

  return /^[A-Za-z0-9._-]{3,255}$/.test(valor);
}

function validarTelefone(telefone) {
  const telefoneLimpo = normalizarDocumento(telefone);
  return telefoneLimpo.length >= 10 && telefoneLimpo.length <= 13;
}

function formatarTelefoneWhatsApp(telefone) {
  let telefoneLimpo = normalizarDocumento(telefone);
  if (!telefoneLimpo) return '';

  if (!telefoneLimpo.startsWith('55') && telefoneLimpo.length === 11) {
    telefoneLimpo = `55${telefoneLimpo}`;
  }

  return telefoneLimpo;
}

module.exports = {
  validarCPF,
  validarCNPJ,
  formatarCPF,
  formatarCNPJ,
  normalizarDocumento,
  inferirTipoDocumento,
  validarDocumento,
  formatarDocumento,
  validarNumeroProcesso,
  formatarNumeroProcesso,
  validarSenhaForte,
  sanitizarInput,
  validarEmail,
  validarIdentificadorAcesso,
  validarTelefone,
  formatarTelefoneWhatsApp
};

