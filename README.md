# Pharmacy

Full-stack pharmacy management app with a React/Vite frontend and Express/MongoDB backend.

## Local Development

```bash
npm run install:all
npm run dev:backend
npm run dev:frontend
```

Backend runs on `http://localhost:5000`; frontend runs on `http://localhost:5173` and proxies `/api` to the backend.

## Live Upload

```bash
npm run install:all
npm run build
NODE_ENV=production npm start
```

The backend serves `frontend/dist` automatically when it exists. Set production values in `backend/.env` or directly on the server environment. Use `backend/.env.example` and `frontend/.env.example` as templates.

For separate frontend hosting, build the frontend with `VITE_API_BASE_URL=https://your-api-domain.com/api`.
