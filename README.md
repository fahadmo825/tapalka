# Tapalka
- Ссылка на приложение: [tapalka](https://t.me/ITWorkinTest_bot/Tapalka)
- Ссылка на github: [github](https://github.com/cruiserrrrrr/tapalka)

## Для запуска проекта локально:
- npm install 
- npm run dev

## AGENB API

The optional API uses Neon PostgreSQL through `DATABASE_URL` and creates the `users` table on startup.

```bash
DATABASE_URL="postgresql://..." npm run api
```

It exposes `GET /api/mining/:telegramId` and `POST /api/mining/:telegramId/claim`. Without the API, the Mini App keeps a local persistent fallback so it remains usable during local preview.

Фронтенд захостил на vercel: [tapalka](https://tapalka.vercel.app/)
Фронтенд не будет работать вне телеграмма.
Для запуска проекта локально в файле wild.tsx  изменить переменные, в файле есть инструкция.

Бэкенд уже развернут на сервере, поэтому необходимость в локальной установке отсутствует. Если требуется использовать локальный бэкенд, замените соответствующие ссылки в файле .env.
This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.
