# Política de segurança

## Como reportar uma vulnerabilidade

Não abra uma issue pública. Use o reporte privado do GitHub:
aba **Security → Report a vulnerability** deste repositório.

Inclua o passo a passo para reproduzir e o impacto esperado. A resposta inicial sai em até 7 dias.

## O que já protege este repositório

- Branch `main` protegida: só recebe mudanças por Pull Request com o CI verde.
- Varredura de segredos: gitleaks no commit local e no CI, mais o secret scanning com push protection do GitHub.
- Dependabot: alertas e atualizações de segurança das dependências e das GitHub Actions.
