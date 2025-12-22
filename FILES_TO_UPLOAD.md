# Files to Upload to GitHub

## ✅ Required Files (Upload These)

### Main Website Files:
- `index.html` - Homepage
- `purchase.html` - Purchase page
- `purchase-success.html` - Success page
- `styles.css` - Main stylesheet
- `analytics.js` - Statistics tracking
- `cookie-consent.js` - Cookie consent banner
- `cookie-consent.css` - Cookie consent styles
- `README.md` - Repository documentation (optional but recommended)

### Folders:
- `docs/` - All documentation pages
  - `about.html`
  - `faq.html`
  - `terms.html`
  - `user_manual.html`
- `images/` - All images
  - `dashboard.png`
  - `decoder.png`
  - `themes.png`

### Configuration:
- `.gitignore` - Git ignore rules

---

## ❌ Do NOT Upload (Excluded by .gitignore)

- `CONFIGURATION.md` - Internal setup guide
- `DEPLOYMENT_CHECKLIST.md` - Internal deployment notes
- Any `.log` files
- Any temporary files
- Editor configuration files

---

## 📋 Quick Upload Checklist

```
server_side/web/
├── index.html ✅
├── purchase.html ✅
├── purchase-success.html ✅
├── styles.css ✅
├── analytics.js ✅
├── cookie-consent.js ✅
├── cookie-consent.css ✅
├── README.md ✅ (optional)
├── .gitignore ✅
├── docs/ ✅
│   ├── about.html
│   ├── faq.html
│   ├── terms.html
│   └── user_manual.html
└── images/ ✅
    ├── dashboard.png
    ├── decoder.png
    └── themes.png
```

---

## 🚀 Upload Command

```bash
cd server_side/web
git add .
git commit -m "Website with promo codes, analytics, and cookie consent"
git push
```

The `.gitignore` file will automatically exclude the internal documentation files.

