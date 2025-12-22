# Deployment Checklist

## ✅ Pre-Deployment (Ready to Push)

All files are ready for GitHub! You can push now.

### Files Ready:
- ✅ All HTML files
- ✅ CSS and JavaScript files
- ✅ Images and documentation
- ✅ `.gitignore` configured
- ✅ `README.md` with instructions

### Configuration Needed After Deployment:
- ⚠️ Update API URL in `purchase.html` (after backend API is deployed)
- ⚪ Statistics API (optional)

---

## 🚀 Step 1: Push to GitHub

1. **Navigate to website folder:**
   ```bash
   cd server_side/web
   ```

2. **Initialize Git (if not already):**
   ```bash
   git init
   git add .
   git commit -m "Initial website deployment with promo codes and statistics"
   ```

3. **Add remote and push:**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git branch -M main
   git push -u origin main
   ```

---

## 🌐 Step 2: Deploy to Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Pages** → **Create a project**
3. Connect your GitHub repository
4. Build settings:
   - **Framework preset**: None (or Static)
   - **Build command**: (leave empty)
   - **Output directory**: `/` (root)
5. Click **Save and Deploy**

✅ Website is now live!

---

## 🔧 Step 3: Deploy Backend API (For Promo Codes)

**Important:** Promo codes won't work until the backend API is deployed.

### Deploy to Render (Connects to GitHub):

1. **Create new private GitHub repo** for API:
   - Name: `esp32-promo-api`
   - Make it **Private** (contains promo codes)

2. **Copy these files to new repo:**
   - `save_purchase_info.py`
   - `purchase_storage.py`
   - `requirements_promo_api.txt` (rename to `requirements.txt`)
   - `Procfile`

3. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial API deployment"
   git remote add origin https://github.com/YOUR_USERNAME/esp32-promo-api.git
   git push -u origin main
   ```

4. **Deploy on Render (connects to GitHub):**
   - Go to [render.com](https://render.com)
   - **Sign up with GitHub** (one-click login)
   - **New** → **Web Service**
   - **Connect GitHub** → Select `esp32-promo-api` repository
   - **Settings:**
     - **Name**: `esp32-promo-api`
     - **Environment**: Python 3
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `python save_purchase_info.py`
     - **Plan**: Free
   - **Create Web Service**
   - Get your API URL: `https://esp32-promo-api.onrender.com`

5. **Update website:**
   - Edit `purchase.html` in your website repo
   - Find: `const PRODUCTION_API_URL = 'https://your-api-domain.com';`
   - Replace with: `const PRODUCTION_API_URL = 'https://esp32-promo-api.onrender.com';`
   - Commit and push
   - Cloudflare Pages auto-deploys

✅ Promo codes now work on live site! Render auto-deploys on every GitHub push.

---

## ✅ Step 4: Test Everything

### Test Website:
- [ ] Homepage loads correctly
- [ ] Navigation works
- [ ] Purchase page loads
- [ ] Terms checkbox works
- [ ] Promo code field appears

### Test Promo Codes (After API Deployment):
- [ ] Select Yearly plan
- [ ] Enter `SIERRA` → Should show "✓ 10% off yearly plan applied!"
- [ ] Enter `DingDongPong` → Should show "✓ 5% off yearly plan applied!"
- [ ] Price updates correctly

### Test Purchase Flow:
- [ ] Fill in email and hardware ID
- [ ] Select plan
- [ ] Check terms checkbox
- [ ] Click "Proceed to Payment"
- [ ] Redirects to Stripe

---

## 📝 Notes

- **Website works without API** - Promo codes just won't validate
- **Local testing** - Use `http://localhost:5000` (auto-detected)
- **Production** - Update `PRODUCTION_API_URL` in `purchase.html`
- **Statistics** - Optional, can be configured later

---

## 🆘 Troubleshooting

### Promo codes show "Unable to validate":
- Check backend API is deployed and running
- Check API URL in `purchase.html` is correct
- Check browser console (F12) for errors
- Verify CORS is enabled (already done in code)

### Website not deploying:
- Check Cloudflare Pages build logs
- Verify all files are in repository
- Check for any build errors

---

## 📚 Documentation

- `README.md` - General website info
- `CONFIGURATION.md` - Configuration guide
- `../PROMO_API_DEPLOYMENT.md` - Backend API deployment guide

