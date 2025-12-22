# ESP32 CAN Sniffer - Official Website

This is the official marketing website for the ESP32 CAN Sniffer application.

## 🚀 Live Site

The website is automatically deployed via Cloudflare Pages.

## 📁 Structure

```
/
├── index.html          # Main homepage
├── styles.css          # Website styles
├── analytics.js        # Statistics tracking (optional)
├── cookie-consent.js   # Cookie consent banner (optional)
├── cookie-consent.css  # Cookie consent styles (optional)
├── images/             # Screenshots and assets
│   ├── dashboard.png
│   ├── decoder.png
│   └── themes.png
└── docs/               # Documentation pages
    ├── about.html      # About the project
    ├── faq.html        # FAQ & Troubleshooting
    ├── terms.html      # Terms, Privacy & Refund Policy
    └── user_manual.html # User Manual & Installation Guide
```

## ⚙️ Configuration

### Promo Code API (Required for promo codes)

Before deploying, update the API URL in `purchase.html`:

1. Open `purchase.html`
2. Find line 271: `const API_BASE_URL = ...`
3. Replace `'https://your-api-domain.com'` with your actual API URL

**Example:**
```javascript
const PRODUCTION_API_URL = 'https://esp32-promo-api.onrender.com';  // Your Render API URL
```

**Note:** See `PROMO_API_DEPLOYMENT.md` in project root for deploying the API to Render (connects directly to GitHub).

**Note:** The code automatically detects localhost for local testing. For production, update the production URL.

### Statistics Tracking (Optional)

If you want to track website statistics:

1. Open `analytics.js`
2. Find line 11: `const STATS_API_ENDPOINT = ...`
3. Replace with your statistics API endpoint

**Note:** Statistics tracking is optional. If not configured, it will log to console only.

## 🛠️ Local Development

To view the website locally:

1. Clone this repository
2. Open `index.html` in a web browser
3. Or use a local server:
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Node.js
   npx serve
   ```

### Testing Promo Codes Locally

1. Start the backend API server:
   ```bash
   python save_purchase_info.py
   ```

2. Open `purchase.html` in browser
3. The code will automatically use `http://localhost:5000` for API calls

## 📝 Content Updates

- Edit HTML files directly
- Update styles in `styles.css`
- Add new images to `images/` folder
- Push changes to trigger automatic deployment on Cloudflare Pages

## 🔗 Links

- **Support Email**: esp32contact@gmail.com
- **Documentation**: See `docs/` folder

## 📄 License

Website content and design are proprietary.

---

**Note**: This repository contains only the static website. The API backend and application code are in separate private repositories.

## 🚀 Deployment

### Cloudflare Pages Setup

1. Connect this GitHub repository to Cloudflare Pages
2. Build settings:
   - **Framework preset**: None (or Static)
   - **Build command**: (leave empty)
   - **Output directory**: `/` (root)
3. Deploy!

The website will automatically deploy on every push to the main branch.
