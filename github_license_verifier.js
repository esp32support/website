/**
 * GitHub API License Verifier
 * 
 * This library uses GitHub API directly to verify licenses without needing
 * a separate backend server. It requires a read-only GitHub token.
 * 
 * For security, the passphrase is NOT exposed in this file. Instead, we use
 * a minimal serverless function (Cloudflare Worker) that handles decryption.
 */

class GitHubLicenseVerifier {
    constructor(config) {
        this.repo = config.repo || 'esp32support/esp32-can-sniffer-api';
        this.branch = config.branch || 'main';
        this.dbPath = config.dbPath || 'license_admin/data/licenses.db.enc';
        this.apiBase = 'https://api.github.com';
        // Use a read-only token (public_repo scope is enough for public repos)
        // For private repos, you need repo scope but can limit to read-only
        this.token = config.token || '';
        this.verifierUrl = config.verifierUrl || null; // Optional: URL to minimal verifier service
    }

    /**
     * Download encrypted database from GitHub
     */
    async downloadDatabase() {
        const url = `${this.apiBase}/repos/${this.repo}/contents/${this.dbPath}?ref=${this.branch}`;
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'ESP32-CAN-Sniffer-Web'
        };
        
        if (this.token) {
            headers['Authorization'] = `token ${this.token}`;
        }

        try {
            const response = await fetch(url, { headers });
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Database not found on GitHub');
                } else if (response.status === 403 || response.status === 401) {
                    throw new Error('GitHub authentication failed. Check your token.');
                }
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const data = await response.json();
            if (!data.content) {
                throw new Error('Invalid response from GitHub API');
            }

            // Decode base64 content (GitHub API returns base64 with newlines)
            const content = data.content.replace(/\n/g, '');
            const encryptedBytes = this.base64ToBytes(content);
            
            return {
                encrypted: encryptedBytes,
                sha: data.sha
            };
        } catch (error) {
            console.error('Failed to download database from GitHub:', error);
            throw error;
        }
    }

    /**
     * Verify license using minimal verifier service (Cloudflare Worker)
     * This service handles decryption server-side without exposing the passphrase
     */
    async verifyLicense(licenseKey, email = '') {
        // Normalize license key
        const normalizedKey = licenseKey.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        
        if (normalizedKey.length !== 32) {
            return {
                valid: false,
                error: 'Invalid license key format'
            };
        }

        // If we have a verifier URL (Cloudflare Worker), use it
        if (this.verifierUrl) {
            try {
                const response = await fetch(this.verifierUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        license_key: normalizedKey,
                        email: email,
                        repo: this.repo,
                        branch: this.branch,
                        db_path: this.dbPath
                    })
                });

                if (!response.ok) {
                    throw new Error(`Verifier service error: ${response.status}`);
                }

                return await response.json();
            } catch (error) {
                console.error('Verifier service error:', error);
                throw new Error(`Failed to verify license: ${error.message}`);
            }
        }

        // Fallback: Download database and verify client-side
        // NOTE: This requires exposing the passphrase, which is a security risk
        // Only use this for testing or if you accept the security implications
        throw new Error('No verifier service configured. Please set verifierUrl in config.');
    }

    /**
     * Helper: Convert base64 string to Uint8Array
     */
    base64ToBytes(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GitHubLicenseVerifier;
}

