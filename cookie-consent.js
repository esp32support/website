/**
 * Cookie Consent Banner - GDPR Compliant (Enhanced Version)
 * Shows if Google Analytics is configured
 * Loads Google Analytics only after user accepts
 * Includes cookie preferences modal and enhanced tracking
 */

(function() {
    'use strict';
    
    // Cookie management functions
    function setCookie(cname, cvalue, exdays) {
        var d = new Date();
        d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
        var expires = "expires=" + d.toUTCString();
        document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/;SameSite=Strict";
    }
    
    function getCookie(cname) {
        var name = cname + "=";
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) == ' ') {
                c = c.substring(1);
            }
            if (c.indexOf(name) == 0) {
                return c.substring(name.length, c.length);
            }
        }
        return "";
    }
    
    // Check if Google Analytics is configured
    function hasGoogleAnalytics() {
        return window.gaId && window.gaId !== 'G-XXXXXXXXXX' && window.gaId.startsWith('G-') && window.gaId.length > 5;
    }
    
    // Check if user has already accepted/rejected
    function hasConsent() {
        return getCookie("cookie-consent") !== "";
    }
    
    // Get user's consent choice
    function getConsent() {
        return getCookie("cookie-consent");
    }
    
    // Load Google Analytics (only if user accepted)
    function loadAnalytics() {
        if (window.gtagLoaded) {
            console.log('Analytics already loaded');
            return;
        }
        
        if (!hasGoogleAnalytics()) {
            console.warn('Google Analytics ID not configured or invalid');
            return;
        }
        
        const gaId = window.gaId;
        console.log('Loading Google Analytics with ID:', gaId);
        
        // Verify gaId is valid before attempting to load
        if (!gaId || !gaId.startsWith('G-')) {
            console.error('Invalid Google Analytics ID:', gaId);
            return;
        }
        
        // Load Google Analytics script dynamically after consent
        if (!document.querySelector('script[src*="googletagmanager.com"]')) {
            const script = document.createElement('script');
            script.async = true;
            script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
            document.head.appendChild(script);
            
            script.onload = function() {
                console.log('Google Analytics script loaded, initializing...');
                
                // Initialize Google Analytics immediately
                window.dataLayer = window.dataLayer || [];
                window.gtag = function(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', gaId, {
                    'anonymize_ip': true,  // GDPR: Anonymize IP addresses
                    'send_page_view': false // We'll send this manually
                });
                
                console.log('Google Analytics initialized, sending page view...');
                
                // Send page view immediately after initialization
                try {
                    gtag('event', 'page_view', {
                        'page_title': document.title,
                        'page_location': window.location.href,
                        'custom_parameter_1': document.referrer || 'direct'
                    });
                    
                    console.log('Page view sent to Google Analytics');
                    window.gtagLoaded = true;
                    
                    // Enhanced Analytics Tracking
                    setupAnalyticsTracking();
                } catch (error) {
                    console.error('Error sending page view:', error);
                }
            };
            
            script.onerror = function() {
                console.error('Failed to load Google Analytics script');
            };
        } else {
            console.log('Google Analytics script already exists');
            // Script already exists, try to use it
            if (typeof gtag !== 'undefined' && gtag) {
                try {
                    gtag('event', 'page_view', {
                        'page_title': document.title,
                        'page_location': window.location.href,
                        'custom_parameter_1': document.referrer || 'direct'
                    });
                    
                    console.log('Page view sent to Google Analytics');
                    window.gtagLoaded = true;
                    
                    // Enhanced Analytics Tracking
                    setupAnalyticsTracking();
                } catch (error) {
                    console.error('Error sending page view:', error);
                }
            } else {
                console.error('Google Analytics script exists but gtag function not available');
            }
        }
    }
    
    // Enhanced Analytics Tracking Functions
    function setupAnalyticsTracking() {
        console.log('Setting up enhanced analytics tracking...');
        
        // Track form submissions
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            form.addEventListener('submit', function() {
                try {
                    gtag('event', 'form_submit', {
                        'event_category': 'engagement',
                        'event_label': 'form_submission',
                        'value': 1
                    });
                    console.log('Form submission tracked');
                } catch (error) {
                    console.error('Error tracking form submission:', error);
                }
            });
        });
        
        // Track download button clicks
        const downloadLinks = document.querySelectorAll('a[href*="github.com"], a[href*="releases"], a[download]');
        downloadLinks.forEach(link => {
            link.addEventListener('click', function() {
                try {
                    gtag('event', 'download_click', {
                        'event_category': 'engagement',
                        'event_label': 'download',
                        'value': 1
                    });
                    console.log('Download click tracked');
                } catch (error) {
                    console.error('Error tracking download click:', error);
                }
            });
        });
        
        // Track scroll depth
        let maxScroll = 0;
        let scrollTracked = new Set();
        
        window.addEventListener('scroll', function() {
            const scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
            
            if (scrollPercent > maxScroll) {
                maxScroll = scrollPercent;
                
                // Track at 25%, 50%, 75%, 100%
                [25, 50, 75, 100].forEach(threshold => {
                    if (scrollPercent >= threshold && !scrollTracked.has(threshold)) {
                        scrollTracked.add(threshold);
                        try {
                            gtag('event', 'scroll_depth', {
                                'event_category': 'engagement',
                                'event_label': threshold + '%',
                                'value': threshold
                            });
                            console.log('Scroll depth tracked:', threshold + '%');
                        } catch (error) {
                            console.error('Error tracking scroll depth:', error);
                        }
                    }
                });
            }
        });
        
        // Track time on page
        const startTime = Date.now();
        window.addEventListener('beforeunload', function() {
            try {
                const timeOnPage = Math.round((Date.now() - startTime) / 1000); // seconds
                gtag('event', 'timing_complete', {
                    'name': 'page_load_time',
                    'value': timeOnPage,
                    'event_category': 'timing'
                });
                console.log('Time on page tracked:', timeOnPage + 's');
            } catch (error) {
                console.error('Error tracking time on page:', error);
            }
        });
        
        console.log('Enhanced analytics tracking setup complete');
    }
    
    // Show consent banner
    function showBanner() {
        // Check if banner already exists
        if (document.getElementById('cookie-consent-banner')) {
            document.getElementById('cookie-consent-banner').style.display = 'block';
            return;
        }
        
        const banner = document.createElement('div');
        banner.id = 'cookie-consent-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-modal', 'true');
        banner.setAttribute('aria-labelledby', 'cookie-banner-title');
        banner.setAttribute('aria-describedby', 'cookie-banner-desc');
        banner.style.cssText = 'background-color: #080a10 !important; color: #ffffff !important; position: fixed !important; bottom: 0 !important; left: 0 !important; right: 0 !important; padding: 1.5rem !important; z-index: 9999 !important; display: none !important; border-top: 2px solid rgba(125, 211, 252, 0.5) !important; box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.8) !important; opacity: 1 !important;';
        
        banner.innerHTML = `
            <div style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 2rem; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 250px;">
                    <p id="cookie-banner-desc" style="margin: 0; line-height: 1.6; color: #cbd5f5;">
                        We use cookies to improve your experience and analyze website traffic. You can allow, reject, or customize cookie usage. 
                        <a href="privacy.html#cookies" style="color: #7dd3fc; text-decoration: underline;">Read more</a>
                    </p>
                </div>
                <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                    <button id="cookie-accept-all" class="cookie-btn cookie-btn-accept" style="background-color: #00AA00; color: #ffffff; border: 2px solid #00AA00; padding: 10px 20px; cursor: pointer; border-radius: 4px; font-weight: 600; white-space: nowrap;" aria-label="Accept all cookies">Accept All</button>
                    <button id="cookie-reject-all" class="cookie-btn cookie-btn-decline" style="background-color: #dc2626; color: #ffffff; border: 2px solid #dc2626; padding: 10px 20px; cursor: pointer; border-radius: 4px; font-weight: 600; white-space: nowrap;" aria-label="Reject all cookies">Reject</button>
                    <button id="cookie-customize" class="cookie-btn" style="background-color: rgba(125, 211, 252, 0.2); color: #7dd3fc; border: 1px solid rgba(125, 211, 252, 0.3); padding: 10px 20px; cursor: pointer; border-radius: 4px; font-weight: 600; white-space: nowrap;" aria-label="Customize cookie settings">Customize</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(banner);
        
        // Show banner
        setTimeout(() => {
            banner.style.display = 'block';
            banner.style.opacity = '1';
            banner.style.backgroundColor = '#080a10';
            banner.classList.add('show');
        }, 100);
        
        // Create preferences modal if it doesn't exist
        if (!document.getElementById('cookie-preferences-modal')) {
            createPreferencesModal();
        }
        
        // Attach event listeners
        attachBannerListeners();
    }
    
    // Create preferences modal
    function createPreferencesModal() {
        const modal = document.createElement('div');
        modal.id = 'cookie-preferences-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'cookie-modal-title');
        modal.setAttribute('aria-describedby', 'cookie-modal-desc');
        modal.style.cssText = 'display:none !important; position: fixed !important; left: 0 !important; right: 0 !important; top: 0 !important; bottom: 0 !important; background: #000000 !important; z-index: 10001 !important; align-items: center !important; justify-content: center !important; opacity: 1 !important;';
        
        modal.innerHTML = `
            <div style="background: #080a10 !important; color: #cbd5f5 !important; max-width: 550px; margin: 40px auto; padding: 30px; border-radius: 8px; position: relative; border: 2px solid rgba(125, 211, 252, 0.7); box-shadow: 0 8px 32px rgba(0, 0, 0, 1); opacity: 1 !important;">
                <h3 id="cookie-modal-title" style="margin-top:0; margin-bottom: 1.5rem; color: #7dd3fc; font-size: 1.5rem;">Cookie Settings</h3>
                <div id="cookie-modal-desc">
                    <form id="cookie-preferences-form">
                        <div style="margin-bottom: 1rem; padding: 15px; background: rgba(125, 211, 252, 0.1); border-radius: 6px; border: 1px solid rgba(125, 211, 252, 0.2);">
                            <label style="display: flex; align-items: flex-start; cursor: default;">
                                <input type="checkbox" checked disabled style="margin-right: 12px; margin-top: 3px; cursor: not-allowed; width: 18px; height: 18px;">
                                <div>
                                    <strong style="color: #7dd3fc; display: block; margin-bottom: 4px;">Essential Cookies</strong>
                                    <span style="color: #cbd5f5; font-size: 0.9rem;">Always active - Required for website functionality</span>
                                </div>
                            </label>
                        </div>
                        <div style="margin-bottom: 1.5rem; padding: 15px; background: rgba(125, 211, 252, 0.1); border-radius: 6px; border: 1px solid rgba(125, 211, 252, 0.2);">
                            <label style="display: flex; align-items: flex-start; cursor: pointer;">
                                <input type="checkbox" id="analytics-cookies" style="margin-right: 12px; margin-top: 3px; cursor: pointer; width: 18px; height: 18px;">
                                <div>
                                    <strong style="color: #7dd3fc; display: block; margin-bottom: 4px;">Analytics Cookies</strong>
                                    <span style="color: #cbd5f5; font-size: 0.9rem;">Google Analytics - Help us understand how visitors interact with our website</span>
                                </div>
                            </label>
                        </div>
                        <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; padding-top: 20px; border-top: 1px solid rgba(125, 211, 252, 0.2);">
                            <button type="button" id="cookie-save-preferences" style="background-color: #00AA00; color: #fff; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 1rem;">Save Settings</button>
                            <button type="button" id="cookie-cancel-preferences" style="background-color: rgba(125, 211, 252, 0.2); color: #7dd3fc; border: 1px solid rgba(125, 211, 252, 0.3); padding: 12px 24px; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 1rem;">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        attachModalListeners();
    }
    
    // Attach banner event listeners
    function attachBannerListeners() {
        var acceptBtn = document.getElementById("cookie-accept-all");
        if (acceptBtn) {
            acceptBtn.addEventListener("click", function() {
                console.log('Cookie consent accepted');
                setCookie("cookie-consent", "allow", 365);
                hideBanner();
                loadAnalytics();
                // Force a page view after accepting (in case user was already on the page)
                setTimeout(function() {
                    if (window.gtagLoaded && typeof gtag !== 'undefined') {
                        gtag('event', 'page_view', {
                            'page_title': document.title,
                            'page_location': window.location.href,
                            'page_path': window.location.pathname + window.location.search
                        });
                        console.log('Page view sent after accepting cookies');
                    }
                }, 500);
            });
        }
        
        var denyBtn = document.getElementById("cookie-reject-all");
        if (denyBtn) {
            denyBtn.addEventListener("click", function() {
                console.log('Cookie consent denied');
                setCookie("cookie-consent", "deny", 365);
                hideBanner();
            });
        }
        
        var customizeBtn = document.getElementById("cookie-customize");
        if (customizeBtn) {
            customizeBtn.addEventListener("click", function() {
                var modal = document.getElementById("cookie-preferences-modal");
                modal.style.display = "flex";
                modal.style.opacity = "1";
                modal.style.backgroundColor = "#000000";
                var modalContent = modal.querySelector("div");
                if (modalContent) {
                    modalContent.style.opacity = "1";
                    modalContent.style.backgroundColor = "#080a10";
                }
            });
        }
    }
    
    // Attach modal event listeners
    function attachModalListeners() {
        var savePreferencesBtn = document.getElementById("cookie-save-preferences");
        if (savePreferencesBtn) {
            savePreferencesBtn.addEventListener("click", function() {
                var analyticsAllowed = document.getElementById("analytics-cookies") ? document.getElementById("analytics-cookies").checked : false;
                console.log('Cookie preferences saved, analytics allowed:', analyticsAllowed);
                setCookie("cookie-consent", analyticsAllowed ? "allow" : "deny", 365);
                hideBanner();
                document.getElementById("cookie-preferences-modal").style.display = "none";
                if (analyticsAllowed) {
                    loadAnalytics();
                    // Force a page view after accepting (in case user was already on the page)
                    setTimeout(function() {
                        if (window.gtagLoaded && typeof gtag !== 'undefined') {
                            gtag('event', 'page_view', {
                                'page_title': document.title,
                                'page_location': window.location.href,
                                'page_path': window.location.pathname + window.location.search
                            });
                            console.log('Page view sent after saving preferences');
                        }
                    }, 500);
                }
            });
        }
        
        var cancelPreferencesBtn = document.getElementById("cookie-cancel-preferences");
        if (cancelPreferencesBtn) {
            cancelPreferencesBtn.addEventListener("click", function() {
                document.getElementById("cookie-preferences-modal").style.display = "none";
            });
        }
    }
    
    // Hide banner
    function hideBanner() {
        const banner = document.getElementById('cookie-consent-banner');
        if (banner) {
            banner.classList.remove('show');
            setTimeout(() => {
                banner.style.display = 'none';
            }, 300);
        }
    }
    
    // Check and show banner
    function checkCookieConsentBanner() {
        var consent = getCookie("cookie-consent");
        if (!consent) {
            showBanner();
        }
    }
    
    // Initialize
    if (hasGoogleAnalytics()) {
        // Check if user already gave consent
        const consent = getConsent();
        if (consent === "allow") {
            console.log('Cookie consent already allowed, loading analytics...');
            loadAnalytics();
        } else if (!hasConsent()) {
            // Show banner if no consent given yet
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', checkCookieConsentBanner);
            } else {
                checkCookieConsentBanner();
            }
        }
        // If declined, do nothing (don't load GA)
    }
})();

