// ============================================
// CONFIGURAÇÕES INICIAIS
// ============================================

// ⚠️ ATENÇÃO: Substitua pela sua chave da API Groq
// Para obter: https://console.groq.com/keys
const GROQ_API_KEY = "SUA_CHAVE_API_GROQ_AQUI";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Configuração do modelo
const MODELO = "llama3-70b-8192";  // Ou "mixtral-8x7b-32768"
const TEMPERATURA = 0.3;           // 0 = mais técnico, 1 = mais criativo
const MAX_TOKENS = 1000;

// Histórico da conversa (para contexto)
let historicoConversa = [];

// ============================================
// ELEMENTOS DO DOM
// ============================================
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Adiciona uma mensagem ao chat
 * @param {string} texto - Conteúdo da mensagem
 * @param {boolean} isUser - Se true, é mensagem do usuário; se false, do bot
 */
function adicionarMensagem(texto, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = isUser ? '👤' : '🤖';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    
    // Processa markdown básico
    let textoProcessado = texto
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
    
    textDiv.innerHTML = textoProcessado;
    contentDiv.appendChild(textDiv);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    
    chatMessages.appendChild(messageDiv);
    
    // Scroll para o final
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Armazena no histórico (para contexto)
    historicoConversa.push({
        role: isUser ? 'user' : 'assistant',
        content: texto
    });
    
    // Mantém apenas os últimos 10 pares para não estourar o limite de tokens
    if (historicoConversa.length > 20) {
        historicoConversa = historicoConversa.slice(-20);
    }
}

/**
 * Mostra o indicador de "digitando..."
 */
function mostrarDigitando() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot';
    typingDiv.id = 'typingIndicator';
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🤖';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const typingContent = document.createElement('div');
    typingContent.className = 'typing-indicator';
    typingContent.innerHTML = '<span></span><span></span><span></span>';
    
    contentDiv.appendChild(typingContent);
    typingDiv.appendChild(avatar);
    typingDiv.appendChild(contentDiv);
    
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Remove o indicador de "digitando..."
 */
function removerDigitando() {
    const typing = document.getElementById('typingIndicator');
    if (typing) {
        typing.remove();
    }
}

/**
 * Gera o prompt do sistema (com as regras do seu livro)
 * @param {string} pergunta - Pergunta do usuário
 */
function gerarSystemPrompt(pergunta) {
    return `Você é o "Robô do Parecer Fiscal", um assistente especialista em Conselho Fiscal Condominial baseado no livro "Conselho Fiscal 4.0".

REGRAS IMPORTANTES:
1. SEMPRE baseie suas respostas no conteúdo do livro sobre Conselho Fiscal Condominial.
2. Cite referências ao livro quando possível (ex: "conforme abordado no capítulo sobre prestação de contas...").
3. Seja claro, didático e use linguagem técnica acessível.
4. Se o usuário pedir para GERAR uma notificação, parecer ou documento, forneça no formato de minuta pronta para uso.
5. Se o usuário pedir para ANALISAR um documento (contrato, ata, balancete), forneça uma lista de verificação do que deve ser examinado.
6. Se não souber responder com base no livro, diga: "Não encontro essa informação específica no material disponível. Recomendo consultar um advogado especializado."
7. Mantenha um tom profissional, cordial e colaborativo.

Pergunta do usuário: ${pergunta}`;
}

/**
 * Chama a API do Groq para obter resposta da IA
 * @param {string} pergunta - Pergunta do usuário
 * @returns {Promise<string>} - Resposta da IA
 */
async function chamarIA(pergunta) {
    // Prepara as mensagens para a API
    const messages = [
        { 
            role: "system", 
            content: gerarSystemPrompt(pergunta)
        },
        ...historicoConversa.slice(-6)  // Últimas 3 interações para contexto
    ];
    
    // Se não tiver histórico, adiciona a pergunta atual
    if (!messages.find(m => m.role === 'user' && m.content === pergunta)) {
        messages.push({ role: "user", content: pergunta });
    }
    
    try {
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: MODELO,
                messages: messages,
                temperature: TEMPERATURA,
                max_tokens: MAX_TOKENS
            })
        });
        
        if (!response.ok) {
            const erroData = await response.json();
            console.error('Erro da API:', erroData);
            
            if (response.status === 401) {
                throw new Error('Chave da API inválida. Verifique sua chave do Groq.');
            } else if (response.status === 429) {
                throw new Error('Limite de requisições atingido. Aguarde alguns segundos e tente novamente.');
            } else {
                throw new Error(`Erro ${response.status}: ${erroData.error?.message || 'Falha na comunicação'}`);
            }
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
        
    } catch (error) {
        console.error('Erro ao chamar IA:', error);
        
        // Fallback amigável para erros
        if (error.message.includes('Chave da API')) {
            return "❌ **Erro de configuração**: A chave da API não está configurada corretamente. Por favor, entre em contato com o administrador do sistema.";
        }
        
        return `❌ **Desculpe, ocorreu um erro:**\n\n${error.message}\n\nVerifique sua conexão com a internet e tente novamente. Se o problema persistir, utilize o guia impresso do livro.`;
    }
}

/**
 * Função principal para enviar mensagem
 */
async function enviarMensagem() {
    const pergunta = userInput.value.trim();
    
    if (!pergunta) {
        // Feedback visual para input vazio
        userInput.style.borderColor = '#ef4444';
        setTimeout(() => {
            userInput.style.borderColor = '#e2e8f0';
        }, 1000);
        return;
    }
    
    // Limpa o campo e desabilita o botão temporariamente
    userInput.value = '';
    sendButton.disabled = true;
    sendButton.style.opacity = '0.6';
    
    // Adiciona a mensagem do usuário
    adicionarMensagem(pergunta, true);
    
    // Mostra indicador de digitando
    mostrarDigitando();
    
    try {
        // Chama a IA
        const resposta = await chamarIA(pergunta);
        
        // Remove o indicador e adiciona a resposta
        removerDigitando();
        adicionarMensagem(resposta, false);
        
    } catch (error) {
        removerDigitando();
        adicionarMensagem(`❌ Erro: ${error.message}`, false);
    } finally {
        // Reabilita o botão
        sendButton.disabled = false;
        sendButton.style.opacity = '1';
        userInput.focus();
    }
}

/**
 * Envia uma sugestão de pergunta (para os chips de sugestão)
 * @param {string} texto - Texto da sugestão
 */
function enviarSugestao(texto) {
    userInput.value = texto;
    enviarMensagem();
}

/**
 * Limpa o histórico da conversa
 */
function limparHistorico() {
    historicoConversa = [];
    chatMessages.innerHTML = '';
    adicionarMensagem("Histórico limpo! Como posso ajudar?", false);
}

/**
 * Alterna tema claro/escuro (opcional)
 */
function alternarTema() {
    document.body.classList.toggle('dark-theme');
}

// ============================================
// EVENTOS E INICIALIZAÇÃO
// ============================================

// Enviar com Enter
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !sendButton.disabled) {
        enviarMensagem();
    }
});

// Salvar conversa no localStorage (opcional)
function salvarConversa() {
    const conversa = historicoConversa.filter(msg => msg.role !== 'system');
    localStorage.setItem('conversaConselhoFiscal', JSON.stringify(conversa));
}

function carregarConversa() {
    const salva = localStorage.getItem('conversaConselhoFiscal');
    if (salva) {
        const conversa = JSON.parse(salva);
        conversa.forEach(msg => {
            adicionarMensagem(msg.content, msg.role === 'user');
        });
    }
}

// Carregar conversa salva ao iniciar (opcional, descomente se quiser)
// carregarConversa();

// Salvar conversa automaticamente a cada nova mensagem
const originalAdicionarMensagem = adicionarMensagem;
window.adicionarMensagem = function(texto, isUser) {
    originalAdicionarMensagem(texto, isUser);
    salvarConversa();
};

console.log('✅ Chatbot do Conselho Fiscal carregado com sucesso!');
