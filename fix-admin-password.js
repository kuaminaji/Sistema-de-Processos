#!/usr/bin/env node
/**
 * Script para corrigir o flag de troca de senha forçada do admin
 * Permite que o admin faça login direto no dashboard sem precisar trocar senha
 */

require('dotenv').config();
const { Database } = require('./src/database/init');

async function fixAdminPassword() {
  const db = new Database();
  
  try {
    console.log('🔧 Corrigindo configuração de troca de senha do admin...\n');
    
    await db.connect();
    
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@local';
    
    // Verificar se admin existe
    const admin = await db.get('SELECT id, email, forcar_troca_senha FROM usuarios WHERE email = ?', [adminEmail]);
    
    if (!admin) {
      console.log(`❌ Admin não encontrado (email: ${adminEmail})`);
      console.log('Execute primeiro: npm run init-db');
      await db.close();
      process.exit(1);
    }
    
    console.log(`✅ Admin encontrado: ${admin.email}`);
    console.log(`   Status atual: forcar_troca_senha = ${admin.forcar_troca_senha}`);
    
    if (admin.forcar_troca_senha === 0) {
      console.log('\n✅ Admin já está configurado corretamente!');
      console.log('   Não é necessário trocar senha no primeiro login.');
      await db.close();
      return;
    }
    
    // Atualizar para não forçar troca de senha
    await db.run(
      'UPDATE usuarios SET forcar_troca_senha = 0 WHERE id = ?',
      [admin.id]
    );
    
    console.log('\n✅ Configuração atualizada com sucesso!');
    console.log('   forcar_troca_senha = 0');
    console.log('\n🎉 Agora você pode fazer login e ir direto para o dashboard!');
    console.log(`   URL: http://127.0.0.1:3000/login.html`);
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Senha: ${process.env.ADMIN_PASSWORD || 'admin123'}`);
    console.log('\n💡 Você pode trocar a senha quando quiser através do menu Perfil.');
    
    await db.close();
    
  } catch (error) {
    console.error('\n❌ Erro ao corrigir configuração:', error);
    try {
      await db.close();
    } catch (e) {}
    process.exit(1);
  }
}

// Executar
fixAdminPassword();
