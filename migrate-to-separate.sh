#!/bin/bash

echo "🚀 Starting migration to separate frontend/backend structure..."

# Create directories if they don't exist
mkdir -p frontend/src
mkdir -p backend/src
mkdir -p shared

echo "📁 Created directory structure"

# Copy frontend files
echo "📋 Copying frontend files..."
cp -r client/src/* frontend/src/
cp client/index.html frontend/
cp client/src/index.css frontend/src/

# Copy backend files
echo "📋 Copying backend files..."
cp -r server/* backend/src/
cp shared/schema.ts shared/

# Copy configuration files
echo "📋 Copying configuration files..."
cp tailwind.config.ts frontend/
cp postcss.config.js frontend/
cp components.json frontend/

# Copy package files (already created)
echo "✅ Package files already created"

# Copy environment examples
echo "📋 Copying environment examples..."
cp frontend/env.example frontend/.env.local.example

echo "🎉 Migration complete!"
echo ""
echo "Next steps:"
echo "1. cd frontend && npm install"
echo "2. cd backend && npm install"
echo "3. Set up environment variables"
echo "4. Test locally"
echo "5. Deploy to Vercel (frontend) and Render (backend)"
echo ""
echo "See README.md for detailed instructions." 