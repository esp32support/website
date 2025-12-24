# Website Configuration Guide

## Required Configuration

### 1. Promo Code API URL

**File:** `purchase.html`  
**Line:** ~271

**What to do:**
1. Deploy your backend API to Render (see `PROMO_API_DEPLOYMENT.md` in project root)
2. Get your API URL from Render (e.g., `https://esp32-promo-api.onrender.com`)
3. Open `purchase.html`
4. Find: `const PRODUCTION_API_URL = 'https://your-api-domain.com';`
5. Replace with your actual Render API URL:
   ```javascript
   const PRODUCTION_API_URL = 'https://esp32-promo-api.onrender.com';
   ```

**Note:** The code automatically uses `http://localhost:5000` when testing locally. Only update the production URL.

---

## Google Analytics

Google Analytics is already configured and will load automatically after users accept cookies. No additional configuration needed.

**View Statistics:**
- Go to: **https://analytics.google.com**
- Sign in with your Google account
- View: Page views, user sessions, traffic sources, country data, etc.

---

## Testing Locally

### Promo Codes

1. Start backend server:
   ```bash
   python save_purchase_info.py
   ```

2. Open `purchase.html` in browser
3. Promo codes will automatically use `http://localhost:5000`

---

## After Configuration

1. **Test locally** to verify everything works
2. **Commit changes** to GitHub
3. **Cloudflare Pages** will auto-deploy
4. **Test on live site** to confirm production API works

---

## Troubleshooting

### Promo codes not working on live site:
- ✅ Check API URL is updated in `purchase.html`
- ✅ Check backend API is deployed and running
- ✅ Check browser console (F12) for errors
- ✅ Verify CORS is enabled on backend (already done in `save_purchase_info.py`)

### Google Analytics not working:
- ✅ Check cookie consent banner appears
- ✅ Verify user accepts cookies
- ✅ Check Google Analytics ID is set: `window.gaId = 'G-6KFL6RX1SM';`
- ✅ View statistics at https://analytics.google.com

---

## Files That Need Configuration

- ✅ `purchase.html` - **REQUIRED** (for promo codes)

All other files work without configuration!

