# Deployment Guide

This guide will help you deploy the frontend to Vercel and the backend to Render.

## Prerequisites

1. GitHub repository with your code
2. Vercel account (free)
3. Render account (free)
4. PostgreSQL database (Neon, Supabase, or Render)

## Step 1: Database Setup

### Option A: Neon (Recommended)
1. Go to [neon.tech](https://neon.tech)
2. Create a free account
3. Create a new project
4. Copy the connection string

### Option B: Supabase
1. Go to [supabase.com](https://supabase.com)
2. Create a free account
3. Create a new project
4. Go to Settings > Database
5. Copy the connection string

### Option C: Render
1. Go to [render.com](https://render.com)
2. Create a free PostgreSQL database
3. Copy the connection string

## Step 2: Deploy Backend to Render

1. **Connect Repository**
   - Go to [render.com](https://render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the repository

2. **Configure Service**
   - **Name**: `shop-backend`
   - **Environment**: `Node`
   - **Region**: Choose closest to you
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

3. **Environment Variables**
   Add these environment variables in Render:
   ```
   NODE_ENV=production
   DATABASE_URL=your-database-connection-string
   SESSION_SECRET=your-random-secret-key
   FRONTEND_URL=https://your-frontend.vercel.app
   REPLIT_CLIENT_ID=your-replit-client-id
   REPLIT_CLIENT_SECRET=your-replit-client-secret
   ```

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Copy the URL (e.g., `https://shop-backend.onrender.com`)

## Step 3: Deploy Frontend to Vercel

1. **Connect Repository**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Select the repository

2. **Configure Project**
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

3. **Environment Variables**
   Add this environment variable in Vercel:
   ```
   VITE_API_URL=https://your-backend.onrender.com
   ```

4. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete
   - Copy the URL (e.g., `https://shop-frontend.vercel.app`)

## Step 4: Update Environment Variables

After both deployments are complete:

1. **Update Backend (Render)**
   - Go to your Render service
   - Update `FRONTEND_URL` with your Vercel URL

2. **Update Frontend (Vercel)**
   - Go to your Vercel project
   - Update `VITE_API_URL` with your Render URL

3. **Redeploy**
   - Both services will automatically redeploy

## Step 5: Database Migration

1. **Run Migrations**
   ```bash
   cd backend
   npm run db:push
   ```

2. **Or use Render's shell**
   - Go to your Render service
   - Click "Shell"
   - Run: `npm run db:push`

## Step 6: Test Your Deployment

1. **Frontend**: Visit your Vercel URL
2. **Backend Health Check**: Visit `https://your-backend.onrender.com/health`
3. **Test Features**: 
   - Browse products
   - Add to cart
   - Create account
   - Place order

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Check that `FRONTEND_URL` in backend matches your Vercel URL exactly
   - Ensure no trailing slashes

2. **Database Connection**
   - Verify `DATABASE_URL` is correct
   - Check if database is accessible from Render

3. **Build Failures**
   - Check build logs in Vercel/Render
   - Ensure all dependencies are in package.json

4. **Environment Variables**
   - Double-check all environment variables are set
   - Ensure no typos in variable names

### Debugging

1. **Backend Logs**: Check Render service logs
2. **Frontend Logs**: Check Vercel deployment logs
3. **Network**: Use browser dev tools to check API calls

## Performance Optimization

### Frontend (Vercel)
- ✅ Automatic CDN
- ✅ Edge caching
- ✅ Automatic HTTPS

### Backend (Render)
- ⚠️ Free tier has cold starts
- ⚠️ Consider upgrading for production

## Security

1. **Environment Variables**: Never commit secrets
2. **CORS**: Only allow your frontend domain
3. **HTTPS**: Both platforms provide automatic HTTPS
4. **Session Secret**: Use a strong random string

## Monitoring

1. **Vercel Analytics**: Built-in performance monitoring
2. **Render Logs**: Real-time application logs
3. **Database**: Monitor connection usage

## Cost

### Free Tier Limits
- **Vercel**: 100GB bandwidth/month
- **Render**: 750 hours/month
- **Neon**: 0.5GB storage, 10GB transfer

### Scaling
- Upgrade plans as needed
- Monitor usage in dashboards

## Support

- **Vercel**: [vercel.com/support](https://vercel.com/support)
- **Render**: [render.com/docs](https://render.com/docs)
- **Neon**: [neon.tech/docs](https://neon.tech/docs) 