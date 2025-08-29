corepack enable
corepack prepare pnpm@9.0.0 --activate

pnpm i

pnpm dev

Server listens on http://localhost:18080
Client on http://localhost:15173

--

docker compose up --build
