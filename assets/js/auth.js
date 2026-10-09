/**
 * Money Bunny - PIN + fingerprint authentication UI
 */

const Auth = {
    TOKEN_KEY: 'mb_auth_token',
    BIOMETRIC_FLAG_KEY: 'mb_biometric_enabled',
    CREDENTIAL_KEY: 'mb_webauthn_cred',
    PERSISTENT_TOKEN_KEY: 'mb_auth_token_persistent',
    WEBAUTHN_USER_KEY: 'mb_webauthn_user_id',
    HAD_PIN_KEY: 'mb_had_pin',
    MAX_PIN_LEN: 6,
    _submitting: false,
    _submitTimer: null,
    _biometricAttempted: false,
    _onlineRetryBound: false,
    _setupStage: 'enter',
    _setupFirstPin: null,

    getToken() {
        return sessionStorage.getItem(this.TOKEN_KEY) || '';
    },

    setToken(token) {
        if (token) {
            sessionStorage.setItem(this.TOKEN_KEY, token);
            this.persistTokenForBiometric();
        } else {
            sessionStorage.removeItem(this.TOKEN_KEY);
        }
    },

    persistTokenForBiometric() {
        if (!this.isBiometricEnabled()) return;
        const token = sessionStorage.getItem(this.TOKEN_KEY);
        if (token) localStorage.setItem(this.PERSISTENT_TOKEN_KEY, token);
    },

    isBiometricSupported() {
        return !!(window.PublicKeyCredential && navigator.credentials?.create);
    },

    isBiometricEnabled() {
        return localStorage.getItem(this.BIOMETRIC_FLAG_KEY) === '1'
            && !!localStorage.getItem(this.CREDENTIAL_KEY);
    },

    getRpId() {
        const host = window.location.hostname;
        return host || 'localhost';
    },

    bufferToBase64url(buffer) {
        const bytes = new Uint8Array(buffer);
        let str = '';
        bytes.forEach((b) => { str += String.fromCharCode(b); });
        return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },

    base64urlToBuffer(base64url) {
        const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
        const pad = base64.length % 4;
        const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
        const str = atob(padded);
        const bytes = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
        return bytes.buffer;
    },

    getStoredCredential() {
        try {
            const raw = localStorage.getItem(this.CREDENTIAL_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },

    saveCredential(credential) {
        localStorage.setItem(this.CREDENTIAL_KEY, JSON.stringify({
            id: credential.id,
            rawId: this.bufferToBase64url(credential.rawId),
        }));
    },

    clearBiometric() {
        localStorage.removeItem(this.BIOMETRIC_FLAG_KEY);
        localStorage.removeItem(this.CREDENTIAL_KEY);
        localStorage.removeItem(this.PERSISTENT_TOKEN_KEY);
    },

    async registerBiometric() {
        if (!this.isBiometricSupported()) {
            throw new Error('Fingerprint is not available in this browser');
        }
        if (!this.getToken()) {
            throw new Error('Unlock with PIN first, then enable fingerprint');
        }

        let userId = localStorage.getItem(this.WEBAUTHN_USER_KEY);
        if (!userId) {
            userId = this.bufferToBase64url(crypto.getRandomValues(new Uint8Array(16)));
            localStorage.setItem(this.WEBAUTHN_USER_KEY, userId);
        }

        const credential = await navigator.credentials.create({
            publicKey: {
                challenge: crypto.getRandomValues(new Uint8Array(32)),
                rp: { name: 'Money Bunny', id: this.getRpId() },
                user: {
                    id: this.base64urlToBuffer(userId),
                    name: 'money-bunny-user',
                    displayName: 'Money Bunny',
                },
                pubKeyCredParams: [
                    { alg: -7, type: 'public-key' },
                    { alg: -257, type: 'public-key' },
                ],
                authenticatorSelection: {
                    authenticatorAttachment: 'platform',
                    userVerification: 'required',
                    residentKey: 'discouraged',
                },
                timeout: 60000,
                attestation: 'none',
            },
        });

        this.saveCredential(credential);
        localStorage.setItem(this.BIOMETRIC_FLAG_KEY, '1');
        this.persistTokenForBiometric();
    },

    async parseAuthResponse(res) {
        const data = await MB.parseJsonResponse(res);
        if (!data.success) {
            throw new Error(data.error || 'Request failed');
        }
        return data;
    },

    async checkStatus() {
        const res = await fetch((window.MB_BASE || '') + '/api/auth.php', {
            headers: { 'X-MB-Token': this.getToken() },
        });
        const data = await this.parseAuthResponse(res);
        return data.data;
    },

    async login(pin) {
        const res = await fetch((window.MB_BASE || '') + '/api/auth.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin }),
        });
        const data = await this.parseAuthResponse(res);
        this.setToken(data.data.token);
        localStorage.setItem(this.HAD_PIN_KEY, '1');
        return data.data;
    },

    async setPin(pin, oldPin = null) {
        const body = { pin };
        if (oldPin) body.old_pin = oldPin;
        const res = await fetch((window.MB_BASE || '') + '/api/auth.php', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-MB-Token': this.getToken(),
            },
            body: JSON.stringify(body),
        });
        const data = await this.parseAuthResponse(res);
        this.clearBiometric();
        if (data.data.token) this.setToken(data.data.token);
        localStorage.setItem(this.HAD_PIN_KEY, '1');
        return data.data;
    },

    async removePin(pin) {
        const res = await fetch((window.MB_BASE || '') + '/api/auth.php', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-MB-Token': this.getToken(),
            },
            body: JSON.stringify({ pin }),
        });
        await this.parseAuthResponse(res);
        this.clearBiometric();
        this.setToken('');
        localStorage.removeItem(this.HAD_PIN_KEY);
    },

    getPinInput() {
        return document.getElementById('pin-input');
    },

    getPinValue() {
        return this.getPinInput()?.value.trim() || '';
    },

    updatePinDots() {
        const len = this.getPinValue().length;
        document.querySelectorAll('#pin-dots .pin-dot').forEach((dot, i) => {
            dot.classList.toggle('filled', i < len);
        });
        this.updateUnlockButton();
    },

    setPinError(message) {
        const err = document.getElementById('pin-error');
        if (!err) return;
        if (message) {
            err.textContent = message;
            err.classList.remove('hidden');
        } else {
            err.textContent = '';
            err.classList.add('hidden');
        }
    },

    setPinLoading(loading, statusText = null) {
        this._submitting = loading;
        const status = document.getElementById('pin-status');
        const keys = document.querySelectorAll('.pin-key');
        const bioBtn = document.getElementById('pin-biometric');
        if (status) {
            if (loading) {
                status.innerHTML = '<span class="pin-lock-loading inline-block" aria-hidden="true"></span><span class="sr-only">Unlocking…</span>';
            } else {
                status.textContent = statusText || this.getLockStatusText();
            }
        }
        keys.forEach((key) => {
            key.disabled = loading;
        });
        if (bioBtn) bioBtn.disabled = loading;
        this.updateUnlockButton();
    },

    getLockStatusText() {
        return this.isBiometricEnabled()
            ? 'Use fingerprint or enter your PIN'
            : 'Enter your PIN to unlock';
    },

    shakePinDots() {
        const dots = document.getElementById('pin-dots');
        if (!dots) return;
        dots.classList.remove('shake');
        void dots.offsetWidth;
        dots.classList.add('shake');
    },

    clearPinInput() {
        clearTimeout(this._submitTimer);
        const input = this.getPinInput();
        if (input) input.value = '';
        this.updatePinDots();
    },

    schedulePinSubmit() {
        clearTimeout(this._submitTimer);
        if (this.getPinValue().length === this.MAX_PIN_LEN) {
            this.submitPin();
        }
    },

    updateUnlockButton() {
        const btn = document.getElementById('pin-unlock');
        if (!btn) return;
        const len = this.getPinValue().length;
        const ready = len >= 4 && len <= this.MAX_PIN_LEN;
        btn.disabled = !ready || this._submitting;
    },

    appendPinDigit(digit) {
        if (this._submitting) return;
        this.setPinError('');
        const input = this.getPinInput();
        if (!input || input.value.length >= this.MAX_PIN_LEN) return;
        input.value += digit;
        this.updatePinDots();
        this.schedulePinSubmit();
    },

    deletePinDigit() {
        if (this._submitting) return;
        clearTimeout(this._submitTimer);
        this.setPinError('');
        const input = this.getPinInput();
        if (!input || !input.value.length) return;
        input.value = input.value.slice(0, -1);
        this.updatePinDots();
    },

    bindLockScreenEvents() {
        document.getElementById('pin-keypad')?.addEventListener('click', (e) => {
            const key = e.target.closest('[data-digit]');
            if (key) {
                this.appendPinDigit(key.dataset.digit);
                return;
            }
            if (e.target.closest('#pin-backspace')) {
                this.deletePinDigit();
            }
        });

        const input = this.getPinInput();
        input?.addEventListener('input', () => {
            input.value = input.value.replace(/\D/g, '').slice(0, this.MAX_PIN_LEN);
            this.updatePinDots();
            this.setPinError('');
            this.schedulePinSubmit();
        });
        input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.submitPin();
            if (e.key === 'Backspace') {
                clearTimeout(this._submitTimer);
                this.setPinError('');
            }
        });

        document.getElementById('pin-unlock')?.addEventListener('click', () => this.submitPin());
        document.getElementById('pin-biometric')?.addEventListener('click', () => this.unlockWithBiometric());
    },

    updateLockScreenBiometric() {
        const enabled = this.isBiometricEnabled();
        const bioBtn = document.getElementById('pin-biometric');
        const divider = document.getElementById('pin-or-divider');
        const status = document.getElementById('pin-status');

        bioBtn?.classList.toggle('hidden', !enabled);
        divider?.classList.toggle('hidden', !enabled);
        if (status && !this._submitting) {
            status.textContent = this.getLockStatusText();
        }
    },

    showLockScreen() {
        let overlay = document.getElementById('pin-lock');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'pin-lock';
            overlay.className = 'pin-lock-screen';
            overlay.innerHTML = `
                <div class="pin-lock-card">
                    <div class="pin-lock-icon">
                        <img src="${MB.logoUrl()}" alt="Money Bunny" class="mb-logo mb-logo-xl" width="80" height="80">
                    </div>
                    <h2 class="pin-lock-title">Money Bunny</h2>
                    <p id="pin-status" class="pin-lock-status">Enter your PIN to unlock</p>

                    <button type="button" id="pin-biometric" class="pin-biometric-btn hidden" aria-label="Unlock with fingerprint">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75"
                                d="M12 10.5V6.75m0 0A2.25 2.25 0 1014.25 9m-2.25 0A2.25 2.25 0 109.75 6.75M12 10.5v3.75m0 0a6.01 6.01 0 01-4.5 5.82M12 14.25a6.01 6.01 0 004.5 5.82M8.25 10.5a2.25 2.25 0 114.5 0m-4.5 0a2.25 2.25 0 00-4.5 0m9 0a2.25 2.25 0 00-4.5 0"/>
                        </svg>
                        <span>Use fingerprint</span>
                    </button>

                    <p id="pin-or-divider" class="pin-lock-divider hidden">— or enter PIN —</p>

                    <div id="pin-dots" class="pin-dots" aria-hidden="true">
                        ${Array.from({ length: 6 }, () => '<span class="pin-dot"></span>').join('')}
                    </div>

                    <input type="password"
                        inputmode="numeric"
                        maxlength="6"
                        id="pin-input"
                        class="sr-only"
                        autocomplete="off"
                        autocorrect="off"
                        spellcheck="false"
                        aria-label="PIN">

                    <div id="pin-keypad" role="group" aria-label="PIN keypad">
                        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `
                            <button type="button" class="pin-key" data-digit="${n}" aria-label="Digit ${n}">${n}</button>
                        `).join('')}
                        <span class="keypad-grid-spacer" aria-hidden="true"></span>
                        <button type="button" class="pin-key" data-digit="0" aria-label="Digit 0">0</button>
                        <button type="button" id="pin-backspace" class="pin-key pin-key-back" aria-label="Delete">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12"/>
                            </svg>
                        </button>
                    </div>

                    <button type="button" id="pin-unlock" class="pin-unlock-btn" disabled>
                        Unlock
                    </button>

                    <p id="pin-error" class="pin-lock-error hidden" role="alert"></p>
                    <p class="pin-lock-hint">4–6 digits</p>
                </div>`;
            document.body.appendChild(overlay);
            this.bindLockScreenEvents();
        }

        this._submitting = false;
        this._biometricAttempted = false;
        this.clearPinInput();
        this.setPinError('');
        this.setPinLoading(false);
        this.updateLockScreenBiometric();
        overlay.classList.remove('hidden');
        document.getElementById('app')?.classList.add('hidden');

        if (this.isBiometricEnabled()) {
            setTimeout(() => this.unlockWithBiometric(true), 350);
        } else {
            setTimeout(() => this.getPinInput()?.focus(), 150);
        }
    },

    hideLockScreen() {
        document.getElementById('pin-lock')?.classList.add('hidden');
        document.getElementById('app')?.classList.remove('hidden');
    },

    async onUnlockSuccess() {
        this.hideLockScreen();
        if (window.App && !window.App._started) {
            window.App._started = true;
            await App.init();
        } else if (window.App) {
            App.router();
        }
    },

    async unlockWithBiometric(auto = false) {
        if (this._submitting || !this.isBiometricEnabled()) return false;

        const stored = this.getStoredCredential();
        if (!stored) {
            this.clearBiometric();
            this.updateLockScreenBiometric();
            return false;
        }

        this.setPinLoading(true);
        try {
            await navigator.credentials.get({
                publicKey: {
                    challenge: crypto.getRandomValues(new Uint8Array(32)),
                    rpId: this.getRpId(),
                    allowCredentials: [{
                        type: 'public-key',
                        id: this.base64urlToBuffer(stored.rawId),
                    }],
                    userVerification: 'required',
                    timeout: 60000,
                },
            });

            const token = localStorage.getItem(this.PERSISTENT_TOKEN_KEY);
            if (!token) {
                throw new Error('Enter your PIN once to refresh fingerprint unlock');
            }

            sessionStorage.setItem(this.TOKEN_KEY, token);
            const status = await this.checkStatus();
            if (!status.authenticated) {
                localStorage.removeItem(this.PERSISTENT_TOKEN_KEY);
                throw new Error('Session expired — enter your PIN once');
            }

            await this.onUnlockSuccess();
            return true;
        } catch (e) {
            if (e.name === 'NotAllowedError' || e.name === 'AbortError') {
                if (!auto) this.setPinError('');
                return false;
            }
            if (e.name === 'SecurityError') {
                this.setPinError('Fingerprint unavailable here — use PIN or open via HTTPS');
                return false;
            }
            this.setPinError(e.message || 'Fingerprint failed — use PIN');
            return false;
        } finally {
            this.setPinLoading(false);
            this._biometricAttempted = true;
        }
    },

    async submitPin() {
        if (this._submitting) return;

        const pin = this.getPinValue();
        if (!/^\d{4,6}$/.test(pin)) {
            if (pin.length >= this.MAX_PIN_LEN) {
                this.setPinError('PIN must be 4–6 digits');
                this.shakePinDots();
                this.clearPinInput();
            }
            return;
        }

        this.setPinLoading(true);
        try {
            await this.login(pin);
            await this.onUnlockSuccess();
        } catch (e) {
            const message = e.message || 'Wrong PIN — try again';
            this.setPinError(message);
            if (!/too many attempts/i.test(message)) {
                this.shakePinDots();
                this.clearPinInput();
            } else {
                this.clearPinInput();
            }
        } finally {
            this.setPinLoading(false);
        }
    },

    // --- First-time PIN setup ---

    getSetupInput() {
        return document.getElementById('setup-pin-input');
    },

    getSetupValue() {
        return this.getSetupInput()?.value.trim() || '';
    },

    updateSetupDots() {
        const len = this.getSetupValue().length;
        document.querySelectorAll('#setup-pin-dots .pin-dot').forEach((dot, i) => {
            dot.classList.toggle('filled', i < len);
        });
        this.updateSetupButton();
    },

    updateSetupButton() {
        const btn = document.getElementById('setup-pin-continue');
        if (!btn) return;
        const len = this.getSetupValue().length;
        const ready = len >= 4 && len <= this.MAX_PIN_LEN;
        btn.disabled = !ready || this._submitting;
        btn.textContent = this._setupStage === 'enter' ? 'Continue' : 'Create PIN';
    },

    setSetupError(message) {
        const err = document.getElementById('setup-pin-error');
        if (!err) return;
        if (message) {
            err.textContent = message;
            err.classList.remove('hidden');
        } else {
            err.textContent = '';
            err.classList.add('hidden');
        }
    },

    shakeSetupDots() {
        const dots = document.getElementById('setup-pin-dots');
        if (!dots) return;
        dots.classList.remove('shake');
        void dots.offsetWidth;
        dots.classList.add('shake');
    },

    clearSetupInput() {
        const input = this.getSetupInput();
        if (input) input.value = '';
        this.updateSetupDots();
    },

    resetSetupFlow() {
        this._setupStage = 'enter';
        this._setupFirstPin = null;
        this.clearSetupInput();
        this.setSetupError('');
        const title = document.getElementById('setup-pin-title');
        const status = document.getElementById('setup-pin-status');
        if (title) title.textContent = 'Create your PIN';
        if (status) status.textContent = 'Choose a 4–6 digit PIN to protect your data';
        this.updateSetupButton();
    },

    appendSetupDigit(digit) {
        if (this._submitting) return;
        this.setSetupError('');
        const input = this.getSetupInput();
        if (!input || input.value.length >= this.MAX_PIN_LEN) return;
        input.value += digit;
        this.updateSetupDots();
    },

    deleteSetupDigit() {
        if (this._submitting) return;
        this.setSetupError('');
        const input = this.getSetupInput();
        if (!input || !input.value.length) return;
        input.value = input.value.slice(0, -1);
        this.updateSetupDots();
    },

    async advanceSetup() {
        const value = this.getSetupValue();
        if (!/^\d{4,6}$/.test(value)) {
            this.setSetupError('PIN must be 4–6 digits');
            this.shakeSetupDots();
            return;
        }

        if (this._setupStage === 'enter') {
            this._setupFirstPin = value;
            this._setupStage = 'confirm';
            this.clearSetupInput();
            const title = document.getElementById('setup-pin-title');
            const status = document.getElementById('setup-pin-status');
            if (title) title.textContent = 'Confirm your PIN';
            if (status) status.textContent = 'Enter your PIN again to confirm';
            this.updateSetupButton();
            return;
        }

        if (value !== this._setupFirstPin) {
            this.setSetupError('PINs do not match — try again');
            this.shakeSetupDots();
            this.clearSetupInput();
            this._setupStage = 'enter';
            this._setupFirstPin = null;
            const title = document.getElementById('setup-pin-title');
            const status = document.getElementById('setup-pin-status');
            if (title) title.textContent = 'Create your PIN';
            if (status) status.textContent = 'Choose a 4–6 digit PIN to protect your data';
            this.updateSetupButton();
            return;
        }

        this._submitting = true;
        this.updateSetupButton();
        const status = document.getElementById('setup-pin-status');
        if (status) status.innerHTML = '<span class="pin-lock-loading inline-block" aria-hidden="true"></span><span class="sr-only">Creating PIN…</span>';
        try {
            await this.setPin(value);
            this.hideSetupScreen();
            await this.onUnlockSuccess();
        } catch (e) {
            this.setSetupError(e.message || 'Could not set PIN — try again');
            this.shakeSetupDots();
            this.clearSetupInput();
        } finally {
            this._submitting = false;
            if (status && this._setupStage === 'confirm') status.textContent = 'Enter your PIN again to confirm';
            this.updateSetupButton();
        }
    },

    bindSetupScreenEvents() {
        document.getElementById('setup-pin-keypad')?.addEventListener('click', (e) => {
            const key = e.target.closest('[data-setup-digit]');
            if (key) {
                this.appendSetupDigit(key.dataset.setupDigit);
                return;
            }
            if (e.target.closest('#setup-pin-backspace')) {
                this.deleteSetupDigit();
            }
        });

        const input = this.getSetupInput();
        input?.addEventListener('input', () => {
            input.value = input.value.replace(/\D/g, '').slice(0, this.MAX_PIN_LEN);
            this.updateSetupDots();
            this.setSetupError('');
        });
        input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.advanceSetup();
        });

        document.getElementById('setup-pin-continue')?.addEventListener('click', () => this.advanceSetup());
    },

    showSetupScreen() {
        let overlay = document.getElementById('pin-setup');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'pin-setup';
            overlay.className = 'pin-lock-screen';
            overlay.innerHTML = `
                <div class="pin-lock-card">
                    <div class="pin-lock-icon">
                        <img src="${MB.logoUrl()}" alt="Money Bunny" class="mb-logo mb-logo-xl" width="80" height="80">
                    </div>
                    <h2 id="setup-pin-title" class="pin-lock-title">Create your PIN</h2>
                    <p id="setup-pin-status" class="pin-lock-status">Choose a 4–6 digit PIN to protect your data</p>

                    <div id="setup-pin-dots" class="pin-dots" aria-hidden="true">
                        ${Array.from({ length: 6 }, () => '<span class="pin-dot"></span>').join('')}
                    </div>

                    <input type="password"
                        inputmode="numeric"
                        maxlength="6"
                        id="setup-pin-input"
                        class="sr-only"
                        autocomplete="off"
                        autocorrect="off"
                        spellcheck="false"
                        aria-label="New PIN">

                    <div id="setup-pin-keypad" role="group" aria-label="PIN keypad">
                        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `
                            <button type="button" class="pin-key" data-setup-digit="${n}" aria-label="Digit ${n}">${n}</button>
                        `).join('')}
                        <span class="keypad-grid-spacer" aria-hidden="true"></span>
                        <button type="button" class="pin-key" data-setup-digit="0" aria-label="Digit 0">0</button>
                        <button type="button" id="setup-pin-backspace" class="pin-key pin-key-back" aria-label="Delete">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12"/>
                            </svg>
                        </button>
                    </div>

                    <button type="button" id="setup-pin-continue" class="pin-unlock-btn" disabled>
                        Continue
                    </button>

                    <p id="setup-pin-error" class="pin-lock-error hidden" role="alert"></p>
                    <p class="pin-lock-hint">4–6 digits · you'll enter it twice</p>
                </div>`;
            document.body.appendChild(overlay);
            this.bindSetupScreenEvents();
        }

        this._submitting = false;
        this.resetSetupFlow();
        overlay.classList.remove('hidden');
        document.getElementById('app')?.classList.add('hidden');
        document.getElementById('pin-lock')?.classList.add('hidden');
        setTimeout(() => this.getSetupInput()?.focus(), 150);
    },

    hideSetupScreen() {
        document.getElementById('pin-setup')?.classList.add('hidden');
        document.getElementById('app')?.classList.remove('hidden');
    },

    /** Retry the gate automatically once connectivity returns */
    awaitOnlineRetry() {
        if (this._onlineRetryBound) return;
        this._onlineRetryBound = true;
        const retry = async () => {
            window.removeEventListener('online', retry);
            this._onlineRetryBound = false;
            const unlocked = await this.gateAppStart();
            if (unlocked) await this.onUnlockSuccess();
        };
        window.addEventListener('online', retry);
    },

    /** Handle checkStatus() failure — usually offline */
    handleOfflineGate(err) {
        if (navigator.onLine) {
            this.showLockScreen();
            this.setPinError(err.message || 'Could not verify lock status. Enter PIN to continue.');
            return false;
        }

        const hadPin = localStorage.getItem(this.HAD_PIN_KEY) === '1';
        const hasSessionToken = !!this.getToken();

        if (hasSessionToken) {
            // Trust the existing session while offline — server will re-validate once reachable
            return true;
        }

        if (hadPin) {
            this.showLockScreen();
            this.setPinError('');
            const status = document.getElementById('pin-status');
            if (status) status.textContent = 'Offline — enter PIN if you have a session, or reconnect to unlock';
            this.awaitOnlineRetry();
            return false;
        }

        // Never completed setup and can't reach the server to check — block until online
        this.showLockScreen();
        this.setPinError('Offline — connect to the internet once to finish PIN setup');
        this.awaitOnlineRetry();
        return false;
    },

    async gateAppStart() {
        try {
            const status = await this.checkStatus();
            if (status.needs_setup) {
                this.showSetupScreen();
                return false;
            }
            if (status.pin_required && !status.authenticated) {
                this.showLockScreen();
                return false;
            }
            return true;
        } catch (e) {
            return this.handleOfflineGate(e);
        }
    },
};

window.Auth = Auth;
