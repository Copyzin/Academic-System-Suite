# EduManage - Manual de Instalação e Uso (Local)

## Pré-requisitos

1. **Node.js 18+** (documentado em `package.json`).
2. **PostgreSQL (local)**: crie o banco e as credenciais que constam em `.env`. Exemplo:
   ```sql
   CREATE DATABASE academic_system;
   CREATE USER academic_user WITH PASSWORD 'strongpwd';
   GRANT ALL PRIVILEGES ON DATABASE academic_system TO academic_user;
   ```
   Depois, dentro do banco:
   ```sql
   \c academic_system
   GRANT ALL PRIVILEGES ON SCHEMA public TO academic_user;
   GRANT ALL PRIVILEGES ON ALL TABLES AND SEQUENCES IN SCHEMA public TO academic_user;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO academic_user;
   ```

## Passos para rodar local

1. **Instalar dependências**
   ```bash
   npm install
   ```

2. **Configurar variáveis de ambiente**
   Crie `.env` (ex.: copiando `.env.example`) com:
   ```
   DATABASE_URL=postgresql://academic_user:strongpwd@localhost:5432/academic_system
   SESSION_SECRET=<string longa>
   APP_URL=http://localhost:5000
   ```
   O arquivo é carregado automaticamente via `dotenv` antes de qualquer conexão.

3. **Aplicar o schema**
   ```bash
   npm run db:push
   ```
   Isso faz o Drizzle comparar `shared/schema.ts` com o banco e criar todas as tabelas/índices necessárias.

4. **Executar em modo dev**
   ```bash
   npm run dev
   ```
   O servidor combina backend (Express) com o frontend (Vite) e fica escutando em `http://localhost:5000`.

5. **Cheque de tipos**
   ```bash
   npm run check
   ```

## Dados seeded (Seed)

Após o `seedDatabase` rodar automaticamente no `npm run dev`, os logins iniciais são:

| Papel | E-mail | R.A. |
|-------|--------|------|
| **Admin** | `admin@academic.local` | `26548998` |
| **Professor** | `professor@academic.local` | `26560877` |
| **Aluno** | `aluno@academic.local` | `26711596` |

Todas as senhas iniciais seguem o padrão (`Admin@12345`, `Professor@123`, `Aluno@12345`). Recomenda-se alterar cedo.

## Fluxos importantes

- **Recuperação de senha**: gera token numérico de 5 dígitos, expira em 10 minutos e bloqueia o dispositivo em caso de cancelamento.
- **Autenticação**: aceita R.A, CPF ou e-mail + senha. Há rate-limit básico e o campo `ra` serve como chave lógica pública.
- **Anúncios**: `isGlobal` ou direcionados via N:N para cursos; `expiresAt` oculta automaticamente.
- **Curso/matriz**: materias (`subjects`) estão ligadas a cursos (`course_subjects`) e possuem CRUD com validações de administrador.

## Estrutura do projeto

- `client/`: React + Tailwind + hooks para chamadas (`use-auth`, `use-courses`, `use-password-recovery` etc.).
- `server/`: Express, Drizzle, Passport (sessões) e fluxos de senha/recuperação.
- `shared/`: Zod + Drizzle (schemas/contratos) usados tanto no server quanto no client.
- `drizzle.config.ts`: define `schema.ts` e usa `DATABASE_URL`.
