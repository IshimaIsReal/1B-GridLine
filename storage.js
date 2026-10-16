(() => {
    const accountKey = 'monitor-local-accounts';
    const reportKey = 'monitor-local-reports';
    const sessionKey = 'monitor-current-user';
    const adminEmail = 'admin123@gmail.com';

    const read = (key, fallback) => {
        try {
            const value = JSON.parse(localStorage.getItem(key) || 'null');
            return value ?? fallback;
        } catch {
            return fallback;
        }
    };

    const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

    const bytesToBase64 = bytes => btoa(String.fromCharCode(...bytes));
    const base64ToBytes = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));

    const derivePasswordHash = async (password, salt) => {
        const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits({
            name: 'PBKDF2',
            hash: 'SHA-256',
            salt,
            iterations: 120000
        }, key, 256);
        return bytesToBase64(new Uint8Array(bits));
    };

    window.monitorStorage = Object.freeze({
        isAdminEmail: email => String(email || '').trim().toLowerCase() === adminEmail,
        getAccounts: () => read(accountKey, []),
        saveAccounts: accounts => write(accountKey, accounts),
        getReports: () => read(reportKey, []),
        saveReports: reports => write(reportKey, reports),
        getCurrentUser: () => {
            try {
                return JSON.parse(sessionStorage.getItem(sessionKey) || 'null');
            } catch {
                return null;
            }
        },
        setCurrentUser: user => sessionStorage.setItem(sessionKey, JSON.stringify(user)),
        clearCurrentUser: () => sessionStorage.removeItem(sessionKey),
        createPasswordRecord: async password => {
            const salt = crypto.getRandomValues(new Uint8Array(16));
            return { salt: bytesToBase64(salt), hash: await derivePasswordHash(password, salt) };
        },
        verifyPassword: async (password, salt, expectedHash) => {
            const hash = await derivePasswordHash(password, base64ToBytes(salt));
            return hash === expectedHash;
        }
    });
})();