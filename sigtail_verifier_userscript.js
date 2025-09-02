// ==UserScript==
// @name         SigTail Verifier
// @namespace    GreaseMonkey
// @version      1.1.1
// @description  Replaces SigTail strings with verified status badge using Ed25519 signature verification.
// @author       @willnjohnson
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const SIGTAIL_REGEX = /sigtail:([a-zA-Z0-9]+)::([a-zA-Z0-9+/=]+(?:={0,2}))/g;

    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            for (const node of Array.from(mutation.addedNodes)) {
                if (node.nodeType === 3) processTextNode(node);
                else if (node.nodeType === 1) {
                    node.querySelectorAll("*").forEach(child => {
                        if (child.children.length === 0 && child.textContent && child.textContent.match(SIGTAIL_REGEX)) {
                            if (child.firstChild && child.firstChild.nodeType === 3) processTextNode(child.firstChild);
                        }
                    });
                }
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.querySelectorAll("body *").forEach(node => {
        if (node.children.length === 0 && node.textContent && node.textContent.match(SIGTAIL_REGEX)) {
            if (node.firstChild && node.firstChild.nodeType === 3) processTextNode(node.firstChild);
        }
    });

    async function processTextNode(textNode) {
        if (!textNode || textNode.nodeType !== 3) return;
        const originalText = textNode.textContent;
        const matches = [...originalText.matchAll(SIGTAIL_REGEX)];
        if (matches.length === 0) return;

        const parent = textNode.parentNode;
        if (!parent) return;

        const frag = document.createDocumentFragment();
        let lastIndex = 0;

        for (const match of matches) {
            const fullMatch = match[0];
            const pasteId = match[1];
            const signatureB64 = match[2];
            const matchIndex = match.index;

            if (matchIndex > lastIndex) frag.appendChild(document.createTextNode(originalText.slice(lastIndex, matchIndex)));

            const placeholder = document.createElement('span');
            placeholder.setAttribute('data-sigtail-placeholder', pasteId);
            placeholder.style.display = 'inline-block';
            placeholder.style.verticalAlign = 'baseline';
            frag.appendChild(placeholder);

            const url = new URL(window.location.href);
            let normalized = url.origin + url.pathname;
            if (normalized.endsWith("/") && normalized !== url.origin + "/") normalized = normalized.slice(0, -1);
            const message = normalized;

            (async () => {
                const valid = await verifySigTail(pasteId, signatureB64, message);
                attachBadgeToPlaceholder(placeholder, valid, pasteId);
            })();

            lastIndex = matchIndex + fullMatch.length;
        }

        if (lastIndex < originalText.length) frag.appendChild(document.createTextNode(originalText.slice(lastIndex)));

        parent.replaceChild(frag, textNode);
    }

    function attachBadgeToPlaceholder(placeholder, valid, pasteId) {
        const sr = placeholder.attachShadow({ mode: 'closed' });
        const container = document.createElement('span');
        container.className = 'sigtail-badge-host';

        const color = valid ? '#28a745' : '#dc3545';
        const mainText = valid ? 'SigTail Verified' : 'SigTail Verification Failed';
        const svgInner = valid ? checkPath() : crossPath();

        container.style.filter = `drop-shadow(0 -0 4px ${color})`;

        container.innerHTML = `
            <span class="badge" role="status" aria-label="${mainText}">
                <svg class="badge-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                    ${svgInner}
                </svg>
                <span class="badge-text">${escapeHtml(mainText)}</span>
                <span class="badge-id">Public ID: <code class="badge-code">${escapeHtml(pasteId)}</code></span>
            </span>
        `;

        const style = document.createElement('style');
        style.textContent = `
            :host { all: initial; display: inline-block; font-family: Arial, Helvetica, sans-serif; }
            .sigtail-badge-host { display: inline-block !important; }
            .badge {
                position: relative;
                display: inline-flex !important;
                align-items: center !important;
                padding: 3px 7px !important;
                margin: 10px !important;
                border-radius: 10px !important;
                font-style: italic !important;
                font-weight: 700 !important;
                font-size: 0.85em !important;
                line-height: 1 !important;
                color: white !important;
                gap: 8px !important;
                background-color: ${color} !important;
                user-select: text !important;
                -webkit-user-select: text !important;
                box-shadow: 0 -3px 6px color-mix(in srgb, ${color} 30%, transparent) !important;
                border: none !important;
                vertical-align: middle !important;
                white-space: nowrap !important;
                overflow: hidden !important;
            }
            .badge::before {
                content: "";
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: linear-gradient(120deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%);
                transform: rotate(25deg);
                pointer-events: none;
                filter: blur(6px);
                animation: shine 2.5s linear infinite;
            }
            @keyframes shine {
                0% { transform: translateX(100%) rotate(25deg); }
                100% { transform: translateX(-100%) rotate(25deg); }
            }
            .badge:focus { outline: none !important; }
            .badge-icon { margin-top: 2px; vertical-align: text-bottom; fill: white !important; stroke: none !important; }
            .badge-text { font-style: italic !important; font-weight: 700 !important; color: white !important; }
            .badge-id { font-style: normal !important; font-weight: 400 !important; font-size: 0.85em !important; opacity: 0.9 !important; margin-left: 6px !important; }
            .badge-code {
                background: rgba(255,255,255,0.18) !important;
                color: white !important;
                padding: 0 4px !important;
                border-radius: 3px !important;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', monospace !important;
                font-weight: 600 !important;
            }
            svg { display: inline-block !important; vertical-align: middle !important; }
        `;

        sr.appendChild(style);
        sr.appendChild(container);
    }

    function checkPath() {
        return `<path d="M13.485 1.929a1 1 0 0 1 0 1.414l-7.07 7.071a1 1 0 0 1-1.415 0L2.515 7.07a1 1 0 1 1 1.414-1.414L6 7.727l6.071-6.07a1 1 0 0 1 1.414 0z"/>`;
    }

    function crossPath() {
        return `<path d="M3 3 L13 13" stroke="white" stroke-width="2.2" stroke-linecap="round" fill="none"/><path d="M13 3 L3 13" stroke="white" stroke-width="2.2" stroke-linecap="round" fill="none"/>`;
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }

    async function verifySigTail(pasteId, signatureB64, message) {
        try {
            const res = await fetch(`https://pastebin.com/raw/${pasteId}`);
            if (!res.ok) throw new Error("Paste fetch failed: " + res.status);

            const jwk = await res.json();
            if (!jwk || jwk.kty !== "OKP" || jwk.crv !== "Ed25519") throw new Error("Invalid or unsupported JWK");

            const key = await importPublicKey(jwk);
            const signature = base64ToBytes(signatureB64);
            const encoder = new TextEncoder();
            const msgBuffer = encoder.encode(message);

            const verified = await crypto.subtle.verify({ name: "Ed25519" }, key, signature, msgBuffer);
            return !!verified;
        } catch (err) {
            console.error("SigTail verify error:", err);
            return false;
        }
    }

    async function importPublicKey(jwk) {
        const rawKey = base64urlToBytes(jwk.x);
        return await crypto.subtle.importKey("raw", rawKey, { name: "Ed25519", namedCurve: "Ed25519" }, true, ["verify"]);
    }

    function base64urlToBytes(b64url) {
        b64url = b64url.replace(/-/g, '+').replace(/_/g, '/');
        while (b64url.length % 4 !== 0) b64url += '=';
        return base64ToBytes(b64url);
    }

    function base64ToBytes(b64) {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    }
})();
