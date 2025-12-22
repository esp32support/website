/**
 * Simple Cookie Consent Banner
 * Only shows if cookies are actually being used
 * GDPR Compliant
 */

(function() {
    'use strict';
    
    // Check if we're using cookies (you can customize this)
    function hasCookies() {
        // Check for common cookie-based services
        return (
            typeof gtag !== 'undefined' ||           // Google Analytics
            typeof _gaq !== 'undefined' ||           // Google Analytics (old)
            typeof fbq !== 'undefined' ||             // Facebook Pixel
            document.cookie.includes('_ga') ||       // Google Analytics cookie
            document.cookie.includes('_gid')         // Google Analytics cookie
        );
    }
    
    // Check if user has already accepted/rejected
    function hasConsent() {
        return localStorage.getItem('cookie_consent') !== null;
    }
    
    // Show consent banner
    function showBanner() {
        const banner = document.createElement('div');
        banner.id = 'cookie-consent-banner';
        banner.innerHTML = `
            <div class="cookie-consent-content">
                <div class="cookie-consent-text">
                    <strong>Cookie Notice</strong>
                    <p>We use cookies to improve your experience and analyze website traffic. By clicking "Accept", you consent to our use of cookies.</p>
                </div>
                <div class="cookie-consent-buttons">
                    <button id="cookie-accept" class="cookie-btn cookie-btn-accept">Accept</button>
                    <button id="cookie-decline" class="cookie-btn cookie-btn-decline">Decline</button>
                    <a href="docs/terms.html#cookies" class="cookie-link">Learn More</a>
                </div>
            </div>
        `;
        document.body.appendChild(banner);
        
        // Animate in
        setTimeout(() => banner.classList.add('show'), 100);
        
        // Handle accept
        document.getElementById('cookie-accept').addEventListener('click', function() {
            localStorage.setItem('cookie_consent', 'accepted');
            hideBanner();
        });
        
        // Handle decline
        document.getElementById('cookie-decline').addEventListener('click', function() {
            localStorage.setItem('cookie_consent', 'declined');
            hideBanner();
            // Optionally disable analytics here
        });
    }
    
    // Hide banner
    function hideBanner() {
        const banner = document.getElementById('cookie-consent-banner');
        if (banner) {
            banner.classList.remove('show');
            setTimeout(() => banner.remove(), 300);
        }
    }
    
    // Initialize
    if (hasCookies() && !hasConsent()) {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', showBanner);
        } else {
            showBanner();
        }
    }
})();

