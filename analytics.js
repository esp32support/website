/**
 * Website Statistics Tracking
 * Tracks page views and download events for internal analytics
 * Data is sent to backend API endpoint (not visible to clients)
 */

(function() {
    'use strict';
    
    // Configuration - Update this with your API endpoint
    const STATS_API_ENDPOINT = 'https://your-api-domain.com/api/track-stats'; // Replace with your actual API endpoint
    
    // Track page view
    function trackPageView() {
        const pageData = {
            event: 'page_view',
            page: window.location.pathname,
            referrer: document.referrer || 'direct',
            timestamp: new Date().toISOString(),
            user_agent: navigator.userAgent,
            screen_resolution: `${window.screen.width}x${window.screen.height}`,
            language: navigator.language || navigator.userLanguage
        };
        
        sendStats(pageData);
    }
    
    // Track download click
    function trackDownload(source) {
        const downloadData = {
            event: 'download_click',
            source: source || 'unknown',
            page: window.location.pathname,
            timestamp: new Date().toISOString(),
            user_agent: navigator.userAgent
        };
        
        sendStats(downloadData);
    }
    
    // Send statistics to backend API
    function sendStats(data) {
        // Only send if API endpoint is configured
        if (!STATS_API_ENDPOINT || STATS_API_ENDPOINT.includes('your-api-domain.com')) {
            console.log('Stats tracking (API not configured):', data);
            return;
        }
        
        // Use fetch with error handling
        fetch(STATS_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
            // Don't wait for response - fire and forget
            keepalive: true
        }).catch(err => {
            // Silently fail - don't interrupt user experience
            console.debug('Stats tracking failed:', err);
        });
    }
    
    // Track page view on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', trackPageView);
    } else {
        trackPageView();
    }
    
    // Track download button clicks
    document.addEventListener('click', function(e) {
        const target = e.target.closest('a[href*="github.com"], a[href*="releases"], a[download]');
        if (target) {
            const href = target.getAttribute('href') || '';
            // Check if it's a download link
            if (href.includes('releases') || href.includes('download') || target.hasAttribute('download')) {
                const source = target.textContent.trim() || target.getAttribute('id') || 'link';
                trackDownload(source);
            }
        }
    });
    
    // Expose tracking function globally for manual tracking if needed
    window.trackStats = {
        download: trackDownload,
        pageView: trackPageView
    };
})();

