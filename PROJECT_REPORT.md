# EduManage - Sistema de Gestão Acadêmica Simplificado

## 1. Descrição do Projeto

### Tema
Sistema de Gestão Acadêmica para instituições de ensino.

### Título Provisório
EduManage

### Justificativa de Escolha
A gestão acadêmica envolve múltiplos atores (alunos, professores, administradores) e um grande volume de dados (notas, frequências, cursos). Sistemas manuais ou descentralizados geram inconsistências e retrabalho. O EduManage centraliza essas informações, melhorando a comunicação e a eficiência operacional, sendo relevante para modernizar processos educacionais em pequenas e médias instituições.

### Público Alvo
- **Administradores:** Para gestão de cadastros e ofertas de cursos.
- **Professores:** Para lançamento de notas, frequências e comunicados.
- **Alunos:** Para consulta de desempenho acadêmico e materiais.

### Objetivos
**Objetivo Geral:**
Desenvolver uma plataforma web centralizada para facilitar a gestão acadêmica, integrando controle de matrículas, notas e comunicação.

**Objetivos Específicos:**
- Permitir o cadastro e gestão de usuários com diferentes perfis de acesso.
- Possibilitar a criação e oferta de disciplinas/cursos.
- Automatizar o registro de matrículas e vínculos aluno-disciplina.
- Fornecer interface para lançamento e consulta de notas e frequência.
- Estabelecer um canal de comunicação via mural de avisos.

## 2. Escopo do Projeto

### Funcionalidades Obrigatórias
- **Autenticação e Autorização:** Login seguro com sessões e controle de acesso baseado em papéis (Admin, Professor, Aluno).
- **CRUD de Usuários:** Cadastro de alunos e professores (perfil Admin).
- **Gestão de Cursos:** Criação e edição de disciplinas e horários.
- **Gestão de Matrículas:** Vinculação de alunos a cursos.
- **Lançamento de Notas e Frequência:** Interface para professores.
- **Painel do Aluno:** Visualização de boletim e avisos.
- **Interface Responsiva:** Acesso via desktop e dispositivos móveis.

### Funcionalidades Opcionais/Avançadas
- **Dashboard Analítico:** Gráficos de desempenho e distribuição de notas.
- **Mural de Avisos:** Sistema de postagem de comunicados por curso.

### Limitações
- Não contempla suporte multi-idioma (apenas Português).
- Não possui aplicativo móvel nativo (apenas Web App Responsivo).
- Não integra com sistemas financeiros ou bancários para pagamentos.

### Tecnologias Previstas
- **Frontend:** React, Tailwind CSS, Shadcn UI, Recharts (para dashboards).
- **Backend:** Node.js, Express.
- **Banco de Dados:** PostgreSQL (Relacional) com Drizzle ORM.
- **Autenticação:** Passport.js (Local Strategy).
- **Hospedagem:** Replit.

## 3. Entregáveis
1. **Protótipo Inicial:** Interface gerada com componentes visuais modernos.
2. **MVP Funcional:** Sistema rodando com as funcionalidades principais de cadastro e consulta.
3. **Documentação Técnica:** README com instruções de instalação e uso.
4. **Relatório Final:** Este documento descrevendo a concepção do projeto.
