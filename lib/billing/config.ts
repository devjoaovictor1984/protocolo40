/**
 * A chave da cobrança.
 *
 * O produto começa inteiro de graça: o objetivo agora é movimento, não
 * receita. Nada foi apagado — planos, assinatura, webhook e auditoria
 * continuam de pé e testados. Este interruptor decide se o paywall existe.
 *
 * Com a cobrança desligada:
 *
 * - `temAcesso()` responde sempre que sim, sem consultar o banco;
 * - a tela de Planos sai do ar e o link some das Configurações;
 * - a administração de planos continua acessível, para preparar preço e
 *   identificador do Stripe antes de ligar.
 *
 * Para ligar: `NEXT_PUBLIC_COBRANCA_ATIVA=1` no ambiente. É a única mudança
 * necessária do lado da aplicação.
 */
export const cobrancaAtiva = process.env.NEXT_PUBLIC_COBRANCA_ATIVA?.trim() === '1';
