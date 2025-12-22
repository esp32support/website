/**
 * Cookie Consent Banner - GDPR Compliant
 * Shows if Google Analytics is configured
 * Loads Google Analytics only after user accepts
 */

(function() {
    'use strict';
    
    // Check if Google Analytics is configured
    function hasGoogleAnalytics() {
        return window.gaId && window.gaId !== 'G-XXXXXXXXXX' && window.gaId.startsWith('G-') && window.gaId.length > 5;
    }
    
    // Check if user has already accepted/rejected
    function hasConsent() {
        return localStorage.getItem('cookie_consent') !== null;
    }
    
    // Get user's consent choice
    function getConsent() {
        return localStorage.getItem('cookie_consent');
    }
    
    // Load Google Analytics (only if user accepted)
    function loadGoogleAnalytics() {
        if (!hasGoogleAnalytics()) return;
        
        const gaId = window.gaId;
        
        // Load Google Analytics script
        const script1 = document.createElement('script');
        script1.async = true;
        script1.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
        document.head.appendChild(script1);
        
        // Initialize Google Analytics
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', gaId, {
            'anonymize_ip': true,  // GDPR: Anonymize IP addresses
            'cookie_flags': 'SameSite=None;Secure'
        });
        
        console.log('Google Analytics loaded');
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
            localStorage.setItem('cookie_consent_date', new Date().toISOString());
            hideBanner();
            loadGoogleAnalytics(); // Load Google Analytics after consent
        });
        
        // Handle decline
        document.getElementById('cookie-decline').addEventListener('click', function() {
            localStorage.setItem('cookie_consent', 'declined');
            localStorage.setItem('cookie_consent_date', new Date().toISOString());
            hideBanner();
            // Google Analytics will not be loaded
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
    if (hasGoogleAnalytics()) {
        // Check if user already gave consent
        const consent = getConsent();
        if (consent === 'accepted') {
            // User previously accepted - load Google Analytics
            loadGoogleAnalytics();
        } else if (!hasConsent()) {
            // Show banner if no consent given yet
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', showBanner);
            } else {
                showBanner();
            }
        }
        // If declined, do nothing (don't load GA)
    }
})();

