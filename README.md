# E-commerce Shop - Frontend & Backend Separation

This project has been separated into frontend and backend for deployment on Vercel and Render respectively.

## Project Structure

```
shop/
├── frontend/          # React + Vite app (deploy to Vercel)
├── backend/           # Express.js API (deploy to Render)
└── shared/            # Shared types and schemas
```

## Quick Start

### Frontend (Vercel)

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp env.example .env.local
   ```
   Edit `.env.local` and set your backend API URL.

4. Run development server:
   ```bash
   npm run dev
   ```

5. Deploy to Vercel:
   ```bash
   npm run build
   ```
   Then connect your GitHub repository to Vercel.

### Backend (Render)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp env.example .env
   ```
   Edit `.env` with your database and other configuration.

4. Run development server:
   ```bash
   npm run dev
   ```

5. Deploy to Render:
   - Connect your GitHub repository to Render
   - Use the `render.yaml` configuration
   - Set environment variables in Render dashboard

## Environment Variables

### Frontend (.env.local)
```
VITE_API_URL=http://localhost:5000  # Development
VITE_API_URL=https://your-backend.onrender.com  # Production
```

### Backend (.env)
```
DATABASE_URL=postgresql://...
SESSION_SECRET=your-secret
FRONTEND_URL=http://localhost:3000  # Development
FRONTEND_URL=https://your-frontend.vercel.app  # Production
```

## Deployment Steps

### 1. Deploy Backend to Render

1. Push your code to GitHub
2. Connect repository to Render
3. Create a new Web Service
4. Configure environment variables
5. Deploy

### 2. Deploy Frontend to Vercel

1. Push your code to GitHub
2. Connect repository to Vercel
3. Set environment variables
4. Deploy

### 3. Update URLs

After deployment, update the environment variables with the actual URLs.

## Development

### Running Both Locally

1. Start backend:
   ```bash
   cd backend
   npm run dev
   ```

2. Start frontend:
   ```bash
   cd frontend
   npm run dev
   ```

### Database Setup

1. Set up PostgreSQL database
2. Update `DATABASE_URL` in backend `.env`
3. Run migrations:
   ```bash
   cd backend
   npm run db:push
   ```

## Features

- ✅ Frontend/Backend separation
- ✅ CORS configuration
- ✅ Environment variable management
- ✅ TypeScript support
- ✅ Database migrations
- ✅ Session management
- ✅ Admin dashboard
- ✅ Product management
- ✅ Shopping cart
- ✅ Order processing
- ✅ Contact forms

## Tech Stack

### Frontend
- React 18
- Vite
- TypeScript
- Tailwind CSS
- Radix UI
- React Query
- React Hook Form

### Backend
- Node.js
- Express.js
- TypeScript
- Drizzle ORM
- PostgreSQL
- Passport.js
- Express Session

## Support

For issues and questions, please check the individual README files in the frontend and backend directories. 