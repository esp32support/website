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
        
        if (!hasGoogleAnalytics()) return;
        
        console.log('Loading Google Analytics...');
        
        const gaId = window.gaId;
        
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
                    'send_page_view': false, // We'll send this manually
                    'cookie_flags': 'SameSite=None;Secure'
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
        banner.style.cssText = 'background-color: rgba(8, 10, 16, 0.98); color: #ffffff; position: fixed; bottom: 0; left: 0; right: 0; padding: 1.5rem; z-index: 9999; display: none; border-top: 2px solid rgba(125, 211, 252, 0.3); box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5);';
        
        banner.innerHTML = `
            <h2 id="cookie-banner-title" style="display:none;">Cookie Settings</h2>
            <p id="cookie-banner-desc" style="margin: 0 0 1rem 0; line-height: 1.6;">
                We use cookies to improve your experience and analyze website traffic. You can allow, reject, or customize cookie usage.
                <a href="privacy.html#cookies" style="color: #7dd3fc; text-decoration: underline;">Learn More</a>
            </p>
            <div style="display: flex; justify-content: center; align-items: center; gap: 10px; flex-wrap: wrap;">
                <button id="cookie-accept-all" class="cookie-btn cookie-btn-accept" style="background-color: #00AA00; color: #ffffff; border: 2px solid #00AA00; padding: 10px 20px; cursor: pointer; border-radius: 4px; font-weight: 600;" aria-label="Accept all cookies">Accept All</button>
                <button id="cookie-reject-all" class="cookie-btn cookie-btn-decline" style="background-color: rgba(125, 211, 252, 0.2); color: #7dd3fc; border: 1px solid rgba(125, 211, 252, 0.3); padding: 10px 20px; cursor: pointer; border-radius: 4px; font-weight: 600;" aria-label="Reject all cookies">Reject</button>
                <button id="cookie-customize" class="cookie-btn" style="background-color: rgba(125, 211, 252, 0.2); color: #7dd3fc; border: 1px solid rgba(125, 211, 252, 0.3); padding: 10px 20px; cursor: pointer; border-radius: 4px; font-weight: 600;" aria-label="Customize cookie settings">Customize</button>
            </div>
            <p style="margin: 0.5rem 0 0 0; text-align: center; font-size: 0.9rem;">
                <a href="privacy.html#cookies" style="color: #7dd3fc; text-decoration: underline;">Learn More</a>
            </p>
        `;
        
        document.body.appendChild(banner);
        
        // Show banner
        setTimeout(() => {
            banner.style.display = 'block';
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
        modal.style.cssText = 'display:none; position: fixed; left: 0; right: 0; top: 0; bottom: 0; background: rgba(0,0,0,0.85); z-index: 10001; align-items: center; justify-content: center;';
        
        modal.innerHTML = `
            <div style="background: rgba(8, 10, 16, 1); color: #cbd5f5; max-width: 500px; margin: 40px auto; padding: 30px 20px; border-radius: 8px; position: relative; border: 2px solid rgba(125, 211, 252, 0.5); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);">
                <h3 id="cookie-modal-title" style="margin-top:0; color: #7dd3fc;">Cookie Settings</h3>
                <div id="cookie-modal-desc">
                    <form id="cookie-preferences-form">
                        <label style="display:block; margin-bottom: 15px; padding: 10px; background: rgba(125, 211, 252, 0.1); border-radius: 4px;">
                            <input type="checkbox" checked disabled style="margin-right: 10px;">
                            <strong>Essential Cookies</strong> (always active) - Required for website functionality
                        </label>
                        <label style="display:block; margin-bottom: 15px; padding: 10px; background: rgba(125, 211, 252, 0.1); border-radius: 4px;">
                            <input type="checkbox" id="analytics-cookies" style="margin-right: 10px;">
                            <strong>Analytics Cookies</strong> (Google Analytics) - Help us understand how visitors interact with our website
                        </label>
                        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                            <button type="button" id="cookie-save-preferences" style="background-color: #00AA00; color: #fff; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: 600;">Save Preferences</button>
                            <button type="button" id="cookie-cancel-preferences" style="background-color: rgba(125, 211, 252, 0.2); color: #7dd3fc; border: 1px solid rgba(125, 211, 252, 0.3); padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: 600;">Cancel</button>
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
                document.getElementById("cookie-preferences-modal").style.display = "flex";
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

