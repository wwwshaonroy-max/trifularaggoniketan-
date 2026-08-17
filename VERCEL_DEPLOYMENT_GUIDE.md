# Vercel Deployment Guide - Tanhomeo Homeopathy App

## 📋 Project Overview
- **Framework:** Next.js 16 (latest)
- **Type:** Full-stack application
- **Key Features:**
  - Genkit AI Integration (Homeopathic Assistant)
  - Firebase Firestore & Real-time Database
  - Steadfast Shipping API Integration
  - Next.js API Routes
  - TypeScript

---

## ✅ Pre-Deployment Checklist

### 1. **Local Build Verification** (CRITICAL)
```bash
# Clean install
npm ci

# Build for production
npm run build

# Run production server locally
npm start

# Test API endpoints
curl http://localhost:3000/api/ai/homeopathic-assistant
```

### 2. **Environment Variables Setup**

#### Required Environment Variables:

**FRONTEND VARIABLES (Public):**
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tanhomeo.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://tanhomeo-default-rtdb.asia-southeast1.firebasedatabase.app
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tanhomeo
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tanhomeo.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=709846650080
NEXT_PUBLIC_FIREBASE_APP_ID=1:709846650080:web:4b485a68b58fa29d899485
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-1G9T1EJJJ1
```

**BACKEND VARIABLES (Secret - Server-only):**
```env
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_GENAI_API_KEY=your_google_genai_api_key
STEADFAST_API_URL=https://api.steadfast.com.bd
STEADFAST_API_KEY=your_steadfast_key
STEADFAST_SECRET_KEY=your_steadfast_secret
STEADFAST_WEBHOOK_SECRET=your_webhook_secret
```

---

## 🚀 Step-by-Step Deployment

### **Phase 1: Vercel Setup**

#### Step 1.1: Create Vercel Project
```bash
# Option A: CLI (Recommended)
npm install -g vercel
vercel login
vercel

# Option B: Web Dashboard
# Visit: https://vercel.com
# Click "New Project"
# Select your GitHub repository: wwwshaonroy-max/trifularaggoniketan-
```

#### Step 1.2: Configure Project Settings
- **Root Directory:** `.` (default)
- **Framework Preset:** Next.js
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Install Command:** `npm ci`

---

### **Phase 2: Environment Variables in Vercel**

#### Step 2.1: Add Environment Variables
1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

2. Add all variables from the `.env.example` file:
   - **Public variables** (NEXT_PUBLIC_*) → Available in all environments
   - **Secret variables** → Only in server-side code

#### Step 2.2: Critical Variables Setup
```
Environment | Variable | Value
------------|----------|-------
Production | GEMINI_API_KEY | [Your actual key]
Production | GOOGLE_GENAI_API_KEY | [Your actual key]
Production | STEADFAST_API_KEY | [Your actual key]
Production | STEADFAST_SECRET_KEY | [Your actual key]
Production | STEADFAST_WEBHOOK_SECRET | [Your actual key]
Preview | [Same as above for testing]
Development | [Same as above for local development]
```

#### Step 2.3: Verify Variables Are Set
```bash
# In Vercel dashboard, verify under Settings → Environment Variables
# You should see:
# ✓ 7 NEXT_PUBLIC_* variables
# ✓ 5 Secret variables
```

---

### **Phase 3: Firebase Configuration**

#### Step 3.1: Firebase Blaze Plan (Required)
- Your app uses Firebase, which requires **Blaze (pay-as-you-go)** plan
- Visit: https://console.firebase.google.com/project/tanhomeo/billing
- Upgrade if needed

#### Step 3.2: Firebase Security Rules
Your current rules in `firestore.rules` will be deployed with Firebase Hosting.
For Vercel, ensure Firebase rules are updated in Firebase Console.

#### Step 3.3: Test Firebase Connectivity
```bash
# Create a test API endpoint to verify Firebase works
# Example: /api/health-check (see below)
```

---

### **Phase 4: API Routes Configuration**

#### Your API Routes Structure:
```
src/app/api/
├── ai/
│   ├── homeopathic-assistant/route.ts       (Genkit)
│   ├── categorize-notes/route.ts             (Genkit)
│   ├── remedy-details/route.ts               (Genkit)
│   └── suggest-remedies/route.ts             (Genkit)
├── steadfast/
│   ├── balance/route.ts
│   ├── consignments/route.ts
│   ├── order/route.ts
│   ├── order/bulk/route.ts
│   ├── return-requests/route.ts
│   ├── return-requests/[id]/route.ts
│   ├── status-by-cid/route.ts
│   ├── status-by-invoice/route.ts
│   ├── status-by-tracking/route.ts
│   └── steadfast-webhook/route.ts
└── health-check/route.ts                    (Add this)
```

#### Step 4.1: Add Health Check Endpoint
Create: `src/app/api/health-check/route.ts`
```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date(),
    environment: process.env.NODE_ENV,
    firebase: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    genkit: !!process.env.GEMINI_API_KEY,
    steadfast: !!process.env.STEADFAST_API_KEY,
  });
}
```

#### Step 4.2: Verify API Timeout Configuration
Next.js on Vercel has timeout limits:
- **Free Plan:** 10 seconds
- **Pro Plan:** 30 seconds
- **Enterprise:** Custom

Your Genkit AI calls might be slow. Monitor and upgrade if needed.

---

### **Phase 5: Genkit AI Integration**

#### Step 5.1: Genkit Configuration
Genkit uses these environment variables:
```env
GEMINI_API_KEY=sk-...          # Google AI API Key
GOOGLE_GENAI_API_KEY=sk-...    # Alternative Google API Key
```

#### Step 5.2: Test Genkit Locally
```bash
# Before deploying, test AI endpoints locally:
curl -X POST http://localhost:3000/api/ai/homeopathic-assistant \
  -H "Content-Type: application/json" \
  -d '{
    "caseData": "রোগীর বর্ণনা: মাথা ব্যথা, জ্বর, কমনীয়তা"
  }'
```

#### Step 5.3: Deployment Considerations
- AI API calls are **CPU intensive**
- May trigger Vercel timeouts on free plan
- Monitor logs for performance issues
- Consider upgrading Vercel plan if calls timeout

---

### **Phase 6: Steadfast API Integration**

#### Step 6.1: Webhook Configuration
Your app has `src/app/api/steadfast-webhook/route.ts`

**Important:** Configure webhook in Steadfast Dashboard:
1. Go to: https://steadfast.com.bd/developer
2. Set webhook URL: `https://yourdomain.vercel.app/api/steadfast-webhook`
3. Set webhook secret: (add to environment variables)

#### Step 6.2: API Rate Limiting
Steadfast has rate limits. Add these headers:
```typescript
// In your steadfast API routes
const headers = {
  'Authorization': `Bearer ${process.env.STEADFAST_API_KEY}`,
  'Secret': process.env.STEADFAST_SECRET_KEY,
};
```

---

## 🔧 Deployment Steps

### **Step 1: Test Production Build Locally**
```bash
npm run build
npm start
# Visit http://localhost:3000
# Test all major flows:
# - Homeopathic Assistant (AI)
# - Order creation (Steadfast)
# - Webhook handling
```

### **Step 2: Push to GitHub**
```bash
git add .
git commit -m "chore: prepare for vercel deployment"
git push origin main
```

### **Step 3: Deploy via Vercel**

**Option A: Automatic (Recommended)**
- Vercel automatically deploys when you push to `main` branch

**Option B: Manual CLI**
```bash
vercel --prod
```

### **Step 4: Monitor Deployment**
```bash
# Watch logs in real-time
vercel logs --follow

# Or check in Vercel Dashboard:
# Your Project → Deployments → Click latest → View Logs
```

---

## ✅ Post-Deployment Testing

### **1. Health Check**
```bash
curl https://yourdomain.vercel.app/api/health-check
# Response should show all services as true
```

### **2. Firebase Connectivity**
- Create test record in Firestore
- Verify it appears in Firebase Console

### **3. Genkit AI Testing**
```bash
curl -X POST https://yourdomain.vercel.app/api/ai/homeopathic-assistant \
  -H "Content-Type: application/json" \
  -d '{"caseData": "test symptoms"}'
```

### **4. Steadfast Integration**
```bash
# Get account balance
curl https://yourdomain.vercel.app/api/steadfast/balance

# List consignments
curl https://yourdomain.vercel.app/api/steadfast/consignments
```

### **5. Load Testing**
- Simulate real user traffic
- Monitor performance in Vercel Dashboard
- Check for timeouts or errors

---

## 🐛 Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| **500 Error on AI endpoints** | Missing GEMINI_API_KEY | Add to Vercel env vars |
| **Firestore connection fails** | Firebase credentials missing | Add NEXT_PUBLIC_FIREBASE_* vars |
| **API timeout (>30s)** | Slow AI/external API calls | Upgrade Vercel plan or optimize code |
| **Webhook not triggering** | Wrong webhook URL | Update in Steadfast Dashboard |
| **CORS errors** | Frontend calling API with wrong domain | Use relative paths `/api/...` |
| **Build fails** | TypeScript errors | Run `npm run type-check` locally |

---

## 📊 Monitoring & Performance

### **Setup Error Tracking**
1. Enable Vercel Analytics: Dashboard → Settings → Analytics
2. Monitor key metrics:
   - First Contentful Paint (FCP)
   - Largest Contentful Paint (LCP)
   - Cumulative Layout Shift (CLS)

### **Setup Logging**
```typescript
// In your API routes
import { log } from 'console';

export async function POST(request: Request) {
  console.log(`[${new Date()}] POST /api/endpoint`, {
    method: request.method,
    url: request.url,
  });
  // ...
}
```

### **View Logs**
```bash
vercel logs [project-name]
```

---

## 🔐 Security Checklist

- ✓ **All secrets in environment variables** (not in code)
- ✓ **Webhook signature validation** (Steadfast)
- ✓ **Firebase security rules enforced**
- ✓ **HTTPS enforced** (Vercel auto-enables)
- ✓ **No hardcoded API keys**
- ✓ **Rate limiting enabled** (if needed)
- ✓ **CORS configured** (if needed)

---

## 📈 Scaling Recommendations

### **If experiencing issues:**

1. **Slow AI responses:**
   - Upgrade Vercel Pro ($20/month)
   - Increase timeout to 30s
   - Cache AI responses where possible

2. **High traffic:**
   - Enable Edge Middleware caching
   - Use CDN for static assets
   - Implement database query optimization

3. **Firebase costs high:**
   - Optimize Firestore queries
   - Use indexes
   - Archive old data

---

## 🎯 Success Criteria

After deployment, verify:
- ✅ All API endpoints respond with HTTP 200
- ✅ Firebase reads/writes work
- ✅ Genkit AI requests complete within timeout
- ✅ Steadfast shipping API works
- ✅ No console errors in browser
- ✅ Performance metrics acceptable (LCP < 2.5s)

---

## 📞 Support Resources

- **Vercel Docs:** https://vercel.com/docs
- **Next.js Docs:** https://nextjs.org/docs
- **Firebase Docs:** https://firebase.google.com/docs
- **Genkit Docs:** https://firebase.google.com/docs/genkit
- **Steadfast API:** https://steadfast.com.bd/api-docs

---

## 🚨 Critical Reminders

1. **NEVER commit `.env` files to git**
2. **All secrets must be added via Vercel dashboard**
3. **Test locally with `npm start` before deploying**
4. **Monitor logs after first deployment**
5. **Set up error alerting (Slack, email)**
6. **Keep Firebase on Blaze plan**
7. **Backup Firestore regularly**

---

**Last Updated:** 2026-08-17
**Status:** Ready for deployment ✅
