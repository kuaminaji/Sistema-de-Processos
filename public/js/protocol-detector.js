// Protocol Detector - Detects HTTPS and redirects to HTTP
// This must be loaded as early as possible in the page

(function() {
    'use strict';
    
    // Check if we're being accessed via HTTPS
    if (window.location.protocol === 'https:') {
        console.warn('⚠️ Sistema detectou acesso via HTTPS. Servidor roda apenas em HTTP.');
        
        // Try to redirect to HTTP
        const httpUrl = window.location.href.replace('https://', 'http://');
        
        // Show a message before redirect
        const style = document.createElement('style');
        style.textContent = `
            .protocol-redirect-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            .protocol-redirect-content {
                text-align: center;
                padding: 40px;
                max-width: 600px;
            }
            .protocol-redirect-content h1 {
                font-size: 32px;
                margin-bottom: 20px;
            }
            .protocol-redirect-content p {
                font-size: 18px;
                margin-bottom: 15px;
                opacity: 0.9;
            }
            .protocol-redirect-link {
                display: inline-block;
                margin-top: 20px;
                padding: 15px 30px;
                background: white;
                color: #667eea;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                font-size: 16px;
                transition: transform 0.2s;
            }
            .protocol-redirect-link:hover {
                transform: translateY(-2px);
            }
            .protocol-spinner {
                width: 40px;
                height: 40px;
                margin: 20px auto;
                border: 4px solid rgba(255,255,255,0.3);
                border-top-color: white;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'protocol-redirect-overlay';
        overlay.innerHTML = `
            <div class="protocol-redirect-content">
                <h1>🔄 Redirecionando...</h1>
                <div class="protocol-spinner"></div>
                <p>O sistema foi acessado via HTTPS mas o servidor roda em HTTP.</p>
                <p><strong>Você será redirecionado automaticamente em 2 segundos.</strong></p>
                <p style="font-size: 14px; opacity: 0.7;">
                    Se o redirecionamento não funcionar, clique no botão abaixo:
                </p>
                <a href="${httpUrl}" class="protocol-redirect-link">
                    Acessar via HTTP
                </a>
                <p style="font-size: 12px; margin-top: 20px; opacity: 0.6;">
                    Para evitar este problema no futuro:<br>
                    1. Use sempre http:// (não https://)<br>
                    2. Ou acesse: <strong>http://127.0.0.1:3000</strong>
                </p>
            </div>
        `;
        
        // Wait for DOM to be ready
        if (document.body) {
            document.body.appendChild(overlay);
        } else {
            document.addEventListener('DOMContentLoaded', function() {
                document.body.appendChild(overlay);
            });
        }
        
        // Attempt automatic redirect after 2 seconds
        setTimeout(function() {
            try {
                window.location.replace(httpUrl);
            } catch (e) {
                console.error('Falha no redirecionamento automático:', e);
                // If replace fails, try assign
                try {
                    window.location.assign(httpUrl);
                } catch (e2) {
                    console.error('Falha no redirecionamento:', e2);
                    // Manual click required
                }
            }
        }, 2000);
        
        // Prevent the rest of the page from loading
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function(e) {
                e.stopImmediatePropagation();
            }, true);
        }
    }
})();
