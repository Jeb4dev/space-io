corepack enable
corepack prepare pnpm@9.0.0 --activate

pnpm i

pnpm dev

Server listens on http://localhost:8080
Client on http://localhost:5173

--

docker compose up --build
