# SSDBench — Disk Benchmark Suite (Docker Edition)

Benchmark de discos em Linux via `fio`, com interface moderna em tempo real, histórico persistente em MongoDB e execução em Docker.

## ✨ Destaques
- Interface web reativa (React + Tailwind) com tema dark neon
- Execução real de `fio` (Flexible I/O Tester) no backend FastAPI
- Logs de execução em tempo real via WebSocket
- 5 estágios de benchmark: Leitura/Escrita Sequencial, Leitura/Escrita Aleatória (4K), Mixed R/W 70/30
- Presets de duração: Rápido / Médio / Completo
- Histórico em MongoDB + exportação JSON
- Suporte a block devices reais (`/dev/nvme0n1`, `/dev/sda`…) ou arquivo de teste como fallback

## 🚀 Subindo com Docker

```bash
docker compose up -d --build
```

Acesse:
- UI: http://localhost:8080
- API: http://localhost:8001/api/

> Para testar discos reais, o backend precisa rodar em modo `privileged: true` com `/dev` montado (já configurado no `docker-compose.yml`). Caso rode sem privilégios, apenas o alvo "Arquivo de teste" (`/data/ssdbench.test`) estará disponível.

## Desenvolvimento local

Backend:
```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8001
```

Frontend:
```bash
cd frontend
yarn install
yarn start
```
